import type { IncomingScanFile } from '../domain/duplicates';
import { nativeMediaUrl, type NativeAudioEntry } from '../native/muzeanStorage';

const SUPPORTED_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'alac', 'webm']);

function detectContainerAndCodec(fileName: string, mimeType: string): { container: string; codec: string; supported: boolean } {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (!SUPPORTED_EXTENSIONS.has(ext) && !mimeType.startsWith('audio/')) {
    return { container: ext.toUpperCase() || 'UNKNOWN', codec: 'UNKNOWN', supported: false };
  }
  switch (ext) {
    case 'flac':
      return { container: 'FLAC', codec: 'FLAC', supported: true };
    case 'wav':
      return { container: 'WAV', codec: 'PCM', supported: true };
    case 'm4a':
      return { container: 'M4A', codec: 'AAC', supported: true };
    case 'alac':
      return { container: 'ALAC', codec: 'ALAC', supported: true };
    case 'aac':
      return { container: 'AAC', codec: 'AAC', supported: true };
    case 'ogg':
      return { container: 'OGG', codec: 'VORBIS', supported: true };
    case 'opus':
      return { container: 'OPUS', codec: 'OPUS', supported: true };
    case 'mp3':
      return { container: 'MP3', codec: 'MP3', supported: true };
    default:
      return { container: ext.toUpperCase() || 'AUDIO', codec: ext.toUpperCase() || 'AAC', supported: true };
  }
}

/**
 * Parses basic ID3v2 text frames (TIT2, TPE1, TALB, TCON, TYER, TRCK) if present in MP3 header.
 */
function parseBasicId3v2(buffer: ArrayBuffer): {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number | null;
  trackNumber?: number | null;
} {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return {};
  }
  const version = bytes[3];
  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const end = Math.min(bytes.length, 10 + tagSize);
  let offset = 10;
  const out: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: number | null;
    trackNumber?: number | null;
  } = {};

  while (offset + 10 < end && version >= 3) {
    const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (frameId === '\u0000\u0000\u0000\u0000') break;
    const frameSize =
      version === 4
        ? ((bytes[offset + 4] & 0x7f) << 21) |
          ((bytes[offset + 5] & 0x7f) << 14) |
          ((bytes[offset + 6] & 0x7f) << 7) |
          (bytes[offset + 7] & 0x7f)
        : (bytes[offset + 4] << 24) |
          (bytes[offset + 5] << 16) |
          (bytes[offset + 6] << 8) |
          bytes[offset + 7];
    offset += 10;
    if (frameSize <= 0 || offset + frameSize > end) break;

    if (frameId.startsWith('T') && frameSize > 1) {
      const encoding = bytes[offset];
      const payload = bytes.slice(offset + 1, offset + frameSize);
      let text = '';
      try {
        if (encoding === 1 || encoding === 2) {
          text = new TextDecoder(encoding === 1 ? 'utf-16' : 'utf-16be').decode(payload);
        } else {
          text = new TextDecoder('utf-8').decode(payload);
        }
      } catch {
        text = '';
      }
      text = text.replace(/\u0000/g, '').trim();
      if (frameId === 'TIT2' && text) out.title = text;
      if (frameId === 'TPE1' && text) out.artist = text;
      if (frameId === 'TALB' && text) out.album = text;
      if (frameId === 'TCON' && text) out.genre = text;
      if (frameId === 'TYER' || frameId === 'TDRC') {
        const yr = parseInt(text.slice(0, 4), 10);
        if (!Number.isNaN(yr)) out.year = yr;
      }
      if (frameId === 'TRCK') {
        const trk = parseInt(text.split('/')[0], 10);
        if (!Number.isNaN(trk)) out.trackNumber = trk;
      }
    }
    offset += frameSize;
  }

  return out;
}

function probeAudioElement(objectUrl: string): Promise<{ durationMs: number; playable: boolean }> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const timer = window.setTimeout(() => {
      cleanup();
      resolve({ durationMs: 0, playable: false });
    }, 2500);

    const cleanup = () => {
      window.clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      audio.src = '';
    };

    const onLoaded = () => {
      const dur = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
      cleanup();
      resolve({ durationMs: dur, playable: dur > 0 });
    };

    const onError = () => {
      cleanup();
      resolve({ durationMs: 0, playable: false });
    };

    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.src = objectUrl;
  });
}

export async function parseLocalAudioFile(
  file: File,
  relativePath: string,
  native?: NativeAudioEntry
): Promise<IncomingScanFile> {
  const parts = relativePath.split('/');
  const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';
  const { container, codec, supported } = detectContainerAndCodec(file.name, file.type);
  const fileSize = native ? native.size : file.size;
  const docUri = native ? native.uri : `saf://${relativePath}`;

  if (!supported) {
    return {
      documentUri: docUri,
      relativePath,
      folderPath,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      containerFormat: container,
      codec,
      bitrateBps: 0,
      sampleRateHz: 0,
      bitDepth: 0,
      fileSizeBytes: fileSize,
      modifiedAt: file.lastModified,
      title: file.name.replace(/\.[^.]+$/, ''),
      artist: 'Unknown Artist',
      album: folderPath,
      genre: '',
      year: null,
      trackNumber: null,
      durationMs: 0,
      artworkDataUri: null,
      embeddedLyrics: null,
      status: 'UNSUPPORTED',
      errorDetail: `Format ${container} is not supported by browser decoder`,
    };
  }

  const objectUrl = native ? nativeMediaUrl(native.uri) : URL.createObjectURL(file);
  try {
    const headSlice = await file.slice(0, 65536).arrayBuffer();
    const id3 = container === 'MP3' ? parseBasicId3v2(headSlice) : {};
    const probe = await probeAudioElement(objectUrl);

    if (!probe.playable || fileSize === 0) {
      return {
        documentUri: docUri,
        relativePath,
        folderPath,
        fileName: file.name,
        mimeType: file.type || 'audio/mpeg',
        containerFormat: container,
        codec,
        bitrateBps: 0,
        sampleRateHz: 44100,
        bitDepth: 16,
        fileSizeBytes: fileSize,
        modifiedAt: file.lastModified,
        title: id3.title || file.name.replace(/\.[^.]+$/, ''),
        artist: id3.artist || 'Unknown Artist',
        album: id3.album || folderPath,
        genre: id3.genre || '',
        year: id3.year ?? null,
        trackNumber: id3.trackNumber ?? null,
        durationMs: 0,
        artworkDataUri: null,
        embeddedLyrics: null,
        status: 'CORRUPT',
        errorDetail: 'Unable to decode audio stream metadata',
      };
    }

    const durationSec = Math.max(1, probe.durationMs / 1000);
    const estimatedBitrate = Math.round((fileSize * 8) / durationSec);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const dashSplit = baseName.split(' - ');
    const fallbackArtist = dashSplit.length > 1 ? dashSplit[0].trim() : 'Unknown Artist';
    const fallbackTitle = dashSplit.length > 1 ? dashSplit.slice(1).join(' - ').trim() : baseName;

    return {
      documentUri: docUri,
      relativePath,
      folderPath,
      fileName: file.name,
      mimeType: file.type || 'audio/mpeg',
      containerFormat: container,
      codec,
      bitrateBps: estimatedBitrate,
      sampleRateHz: container === 'FLAC' || container === 'WAV' ? 48000 : 44100,
      bitDepth: container === 'FLAC' || container === 'WAV' ? 24 : 16,
      fileSizeBytes: fileSize,
      modifiedAt: file.lastModified,
      title: id3.title || fallbackTitle,
      artist: id3.artist || fallbackArtist,
      album: id3.album || folderPath,
      genre: id3.genre || '',
      year: id3.year ?? null,
      trackNumber: id3.trackNumber ?? null,
      durationMs: probe.durationMs,
      artworkDataUri: null,
      embeddedLyrics: null,
      status: 'AVAILABLE',
      objectUrl,
    };
  } catch (err) {
    return {
      documentUri: docUri,
      relativePath,
      folderPath,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      containerFormat: container,
      codec,
      bitrateBps: 0,
      sampleRateHz: 0,
      bitDepth: 0,
      fileSizeBytes: fileSize,
      modifiedAt: file.lastModified,
      title: file.name.replace(/\.[^.]+$/, ''),
      artist: 'Unknown Artist',
      album: folderPath,
      genre: '',
      year: null,
      trackNumber: null,
      durationMs: 0,
      artworkDataUri: null,
      embeddedLyrics: null,
      status: 'CORRUPT',
      errorDetail: err instanceof Error ? err.message : 'File read error',
    };
  }
}
