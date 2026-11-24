import type { DuplicateCandidate, Track, TrackSource } from './types';

export const DUPLICATE_DURATION_TOLERANCE_MS = 2500;

/**
 * Normalizes strings for matching while preserving non-Latin scripts
 * (Japanese, Korean, Arabic, Cyrillic, etc.) untouched in meaning.
 */
export function normalizeMetadataString(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const CODEC_BASE_TIER: Record<string, number> = {
  FLAC: 1000,
  ALAC: 980,
  WAV: 960,
  PCM: 960,
  AIFF: 950,
  OPUS: 540,
  AAC: 500,
  M4A: 500,
  VORBIS: 460,
  OGG: 460,
  MP3: 400,
};

/**
 * Estimates source quality without naively comparing bitrate across codecs
 * (e.g., 256 kbps Opus/AAC beats 320 kbps MP3, and lossless always outranks lossy).
 */
export function calculateSourceQualityScore(source: {
  codec: string;
  containerFormat?: string;
  bitrateBps: number;
  sampleRateHz: number;
  bitDepth: number;
}): number {
  const codecKey = source.codec.trim().toUpperCase();
  const containerKey = (source.containerFormat ?? '').trim().toUpperCase();
  const tier = CODEC_BASE_TIER[codecKey] ?? CODEC_BASE_TIER[containerKey] ?? 300;

  const isLossless = tier >= 900;
  const sampleRateBonus = Math.min(source.sampleRateHz, 192000) / 1000; // up to +192
  const bitDepthBonus = Math.min(source.bitDepth || 16, 32) * 5; // up to +160
  const bitrateKbps = Math.max(0, source.bitrateBps / 1000);
  const bitrateBonus = isLossless ? Math.min(bitrateKbps / 100, 40) : Math.min(bitrateKbps / 4, 100);

  return Math.round(tier + sampleRateBonus + bitDepthBonus + bitrateBonus);
}

export function isExactDuplicateTrack(
  a: Pick<Track, 'normalizedTitle' | 'normalizedArtist' | 'normalizedAlbum' | 'durationMs'>,
  b: Pick<Track, 'normalizedTitle' | 'normalizedArtist' | 'normalizedAlbum' | 'durationMs'>,
  toleranceMs = DUPLICATE_DURATION_TOLERANCE_MS
): boolean {
  if (!a.normalizedTitle || !a.normalizedArtist || !a.normalizedAlbum) {
    return false;
  }
  const sameMeta =
    a.normalizedTitle === b.normalizedTitle &&
    a.normalizedArtist === b.normalizedArtist &&
    a.normalizedAlbum === b.normalizedAlbum;
  if (!sameMeta) return false;
  return Math.abs(a.durationMs - b.durationMs) <= toleranceMs;
}

export function isLikelyDuplicateCandidate(
  a: Pick<Track, 'normalizedTitle' | 'normalizedArtist' | 'normalizedAlbum' | 'durationMs'>,
  b: Pick<Track, 'normalizedTitle' | 'normalizedArtist' | 'normalizedAlbum' | 'durationMs'>,
  toleranceMs = DUPLICATE_DURATION_TOLERANCE_MS
): { isCandidate: boolean; reason: string } {
  if (!a.normalizedTitle || !b.normalizedTitle) {
    return { isCandidate: false, reason: '' };
  }
  if (a.normalizedTitle !== b.normalizedTitle) {
    return { isCandidate: false, reason: '' };
  }

  const durationClose = Math.abs(a.durationMs - b.durationMs) <= toleranceMs * 2;
  const missingArtistOrAlbum =
    !a.normalizedArtist ||
    !b.normalizedArtist ||
    !a.normalizedAlbum ||
    !b.normalizedAlbum ||
    a.normalizedArtist === 'unknown artist' ||
    b.normalizedArtist === 'unknown artist';

  if (durationClose && missingArtistOrAlbum) {
    return {
      isCandidate: true,
      reason: 'Same title & similar duration with incomplete artist/album metadata',
    };
  }

  if (
    a.normalizedArtist &&
    a.normalizedArtist === b.normalizedArtist &&
    a.normalizedAlbum !== b.normalizedAlbum &&
    Math.abs(a.durationMs - b.durationMs) <= toleranceMs
  ) {
    return {
      isCandidate: true,
      reason: 'Same title, artist & duration across different album tags',
    };
  }

  return { isCandidate: false, reason: '' };
}

/**
 * Selects the highest quality AVAILABLE source for a track.
 * Falls back cleanly if the current primary source is missing/corrupt.
 */
export function selectBestAvailableSource(sources: TrackSource[]): TrackSource | null {
  const available = sources.filter((s) => s.sourceStatus === 'AVAILABLE');
  if (available.length === 0) return null;
  return [...available].sort((a, b) => b.qualityScore - a.qualityScore)[0];
}

export interface IncomingScanFile {
  documentUri: string;
  relativePath: string;
  folderPath: string;
  fileName: string;
  mimeType: string;
  containerFormat: string;
  codec: string;
  bitrateBps: number;
  sampleRateHz: number;
  bitDepth: number;
  fileSizeBytes: number;
  modifiedAt: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number | null;
  trackNumber: number | null;
  durationMs: number;
  artworkDataUri: string | null;
  embeddedLyrics: string | null;
  status: 'AVAILABLE' | 'CORRUPT' | 'UNSUPPORTED';
  errorDetail?: string;
  objectUrl?: string;
}

export function mergeScannedTracks(
  existingTracks: Track[],
  existingSources: TrackSource[],
  existingCandidates: DuplicateCandidate[],
  incomingFiles: IncomingScanFile[],
  now: number
): {
  tracks: Track[];
  sources: TrackSource[];
  candidates: DuplicateCandidate[];
  addedCount: number;
  updatedCount: number;
  failedCount: number;
} {
  const tracks = existingTracks.map((t) => ({ ...t }));
  const sources = existingSources.map((s) => ({ ...s }));
  const candidates = existingCandidates.map((c) => ({ ...c }));

  let addedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (const file of incomingFiles) {
    if (file.status !== 'AVAILABLE') {
      failedCount++;
    }

    const existingSourceIndex = sources.findIndex((s) => s.documentUri === file.documentUri);
    const qualityScore = calculateSourceQualityScore({
      codec: file.codec,
      containerFormat: file.containerFormat,
      bitrateBps: file.bitrateBps,
      sampleRateHz: file.sampleRateHz,
      bitDepth: file.bitDepth,
    });

    if (existingSourceIndex !== -1) {
      const prev = sources[existingSourceIndex];
      sources[existingSourceIndex] = {
        ...prev,
        fileName: file.fileName,
        relativePath: file.relativePath,
        folderPath: file.folderPath,
        bitrateBps: file.bitrateBps,
        sampleRateHz: file.sampleRateHz,
        bitDepth: file.bitDepth,
        fileSizeBytes: file.fileSizeBytes,
        modifiedAt: file.modifiedAt,
        sourceStatus: file.status,
        qualityScore,
        lastScannedAt: now,
        objectUrl: file.objectUrl ?? prev.objectUrl,
        errorDetail: file.errorDetail,
      };
      updatedCount++;
      continue;
    }

    const normTitle = normalizeMetadataString(file.title || file.fileName.replace(/\.[^.]+$/, ''));
    const normArtist = normalizeMetadataString(file.artist);
    const normAlbum = normalizeMetadataString(file.album);

    const exactMatch =
      file.status === 'AVAILABLE'
        ? tracks.find((t) =>
            isExactDuplicateTrack(t, {
              normalizedTitle: normTitle,
              normalizedArtist: normArtist,
              normalizedAlbum: normAlbum,
              durationMs: file.durationMs,
            })
          )
        : undefined;

    if (exactMatch) {
      const newSourceId = `src_${cryptoRandomId()}`;
      sources.push({
        sourceId: newSourceId,
        trackId: exactMatch.trackId,
        documentUri: file.documentUri,
        relativePath: file.relativePath,
        folderPath: file.folderPath,
        fileName: file.fileName,
        mimeType: file.mimeType,
        containerFormat: file.containerFormat,
        codec: file.codec,
        bitrateBps: file.bitrateBps,
        sampleRateHz: file.sampleRateHz,
        bitDepth: file.bitDepth,
        fileSizeBytes: file.fileSizeBytes,
        modifiedAt: file.modifiedAt,
        sourceStatus: file.status,
        qualityScore,
        isPrimary: false,
        lastScannedAt: now,
        objectUrl: file.objectUrl,
      });

      // Re-evaluate primary source for this track
      const trackSources = sources.filter((s) => s.trackId === exactMatch.trackId);
      const best = selectBestAvailableSource(trackSources);
      if (best) {
        for (const s of trackSources) {
          s.isPrimary = s.sourceId === best.sourceId;
        }
        exactMatch.primarySourceId = best.sourceId;
        exactMatch.availabilityStatus = 'AVAILABLE';
        exactMatch.updatedAt = now;
      }
      addedCount++;
      continue;
    }

    const trackId = `trk_${cryptoRandomId()}`;
    const sourceId = `src_${cryptoRandomId()}`;

    const newTrack: Track = {
      trackId,
      displayTitle: file.title || file.fileName.replace(/\.[^.]+$/, ''),
      displayArtist: file.artist || 'Unknown Artist',
      displayAlbum: file.album || 'Unknown Album',
      normalizedTitle: normTitle,
      normalizedArtist: normArtist,
      normalizedAlbum: normAlbum,
      durationMs: file.durationMs,
      genre: file.genre || '',
      year: file.year,
      trackNumber: file.trackNumber,
      primarySourceId: sourceId,
      availabilityStatus: file.status,
      artworkCacheKey: null,
      createdAt: now,
      updatedAt: now,
    };

    const newSource: TrackSource = {
      sourceId,
      trackId,
      documentUri: file.documentUri,
      relativePath: file.relativePath,
      folderPath: file.folderPath,
      fileName: file.fileName,
      mimeType: file.mimeType,
      containerFormat: file.containerFormat,
      codec: file.codec,
      bitrateBps: file.bitrateBps,
      sampleRateHz: file.sampleRateHz,
      bitDepth: file.bitDepth,
      fileSizeBytes: file.fileSizeBytes,
      modifiedAt: file.modifiedAt,
      sourceStatus: file.status,
      qualityScore,
      isPrimary: true,
      lastScannedAt: now,
      objectUrl: file.objectUrl,
      errorDetail: file.errorDetail,
    };

    // Check for incomplete duplicate candidates
    for (const existing of tracks) {
      if (existing.availabilityStatus !== 'AVAILABLE') continue;
      const check = isLikelyDuplicateCandidate(existing, newTrack);
      if (check.isCandidate) {
        const alreadyLogged = candidates.some(
          (c) =>
            (c.sourceTrackId === newTrack.trackId && c.targetTrackId === existing.trackId) ||
            (c.sourceTrackId === existing.trackId && c.targetTrackId === newTrack.trackId)
        );
        if (!alreadyLogged) {
          candidates.push({
            candidateId: `dup_${cryptoRandomId()}`,
            sourceTrackId: newTrack.trackId,
            targetTrackId: existing.trackId,
            matchReason: check.reason,
            status: 'PENDING',
            createdAt: now,
            resolvedAt: null,
          });
        }
      }
    }

    tracks.push(newTrack);
    sources.push(newSource);
    addedCount++;
  }

  // Ensure every track's availabilityStatus & primarySourceId matches its best available source
  for (const track of tracks) {
    const tSources = sources.filter((s) => s.trackId === track.trackId);
    const best = selectBestAvailableSource(tSources);
    if (best) {
      for (const s of tSources) {
        s.isPrimary = s.sourceId === best.sourceId;
      }
      track.primarySourceId = best.sourceId;
      track.availabilityStatus = 'AVAILABLE';
    } else if (tSources.length > 0) {
      track.availabilityStatus = tSources[0].sourceStatus;
    } else {
      track.availabilityStatus = 'MISSING';
    }
  }

  return {
    tracks,
    sources,
    candidates,
    addedCount,
    updatedCount,
    failedCount,
  };
}

/**
 * Merges a confirmed duplicate candidate track into the target track,
 * reassigning all TrackSources without deleting any physical files.
 */
export function resolveDuplicateCandidateMerge(
  tracks: Track[],
  sources: TrackSource[],
  candidates: DuplicateCandidate[],
  candidateId: string,
  action: 'MERGE' | 'DISMISS',
  now: number
): {
  tracks: Track[];
  sources: TrackSource[];
  candidates: DuplicateCandidate[];
} {
  const candidate = candidates.find((c) => c.candidateId === candidateId);
  if (!candidate) return { tracks, sources, candidates };

  if (action === 'DISMISS') {
    return {
      tracks,
      sources,
      candidates: candidates.map((c) =>
        c.candidateId === candidateId ? { ...c, status: 'DISMISSED', resolvedAt: now } : c
      ),
    };
  }

  const nextSources = sources.map((s) =>
    s.trackId === candidate.sourceTrackId
      ? { ...s, trackId: candidate.targetTrackId, isPrimary: false }
      : { ...s }
  );

  const targetSources = nextSources.filter((s) => s.trackId === candidate.targetTrackId);
  const best = selectBestAvailableSource(targetSources);
  if (best) {
    for (const s of targetSources) {
      s.isPrimary = s.sourceId === best.sourceId;
    }
  }

  const nextTracks = tracks
    .filter((t) => t.trackId !== candidate.sourceTrackId)
    .map((t) =>
      t.trackId === candidate.targetTrackId && best
        ? { ...t, primarySourceId: best.sourceId, updatedAt: now }
        : t
    );

  const nextCandidates = candidates.map((c) =>
    c.candidateId === candidateId ? { ...c, status: 'MERGED' as const, resolvedAt: now } : c
  );

  return { tracks: nextTracks, sources: nextSources, candidates: nextCandidates };
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
