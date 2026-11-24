import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSourceQualityScore,
  isExactDuplicateTrack,
  mergeScannedTracks,
  normalizeMetadataString,
  resolveDuplicateCandidateMerge,
  selectBestAvailableSource,
} from './duplicates';
import {
  applySmartShuffleKeepingCurrent,
  buildQueueFromTracks,
  cycleRepeatMode,
  getNextQueueIndex,
  getPreviousQueueIndex,
  reorderPlaylistTracks,
  resolveNextTrackOnEnded,
  restoreContextOrderQueue,
} from './queue';
import { formatDurationMs, getActiveLrcLineIndex, parseLrcLyrics } from './lyrics';
import {
  buildSmoothEqCurvePath,
  computeClippingRisk,
  createDefaultEqBands,
  resolveTransitionMode,
  validateDacOutputConfig,
} from './audioMath';
import { generateVaporwaveArtworkDataUri } from './artwork';
import { createMuzeanBackupZip, validateMuzeanBackupZip } from './backup';
import type { MuzeanDatabaseState, TrackSource } from './types';

test('quality score ranks lossless FLAC above 320kbps MP3 and 256kbps Opus above 320kbps MP3', () => {
  const mp3_320 = calculateSourceQualityScore({
    codec: 'MP3',
    bitrateBps: 320000,
    sampleRateHz: 44100,
    bitDepth: 16,
  });
  const opus_256 = calculateSourceQualityScore({
    codec: 'OPUS',
    bitrateBps: 256000,
    sampleRateHz: 48000,
    bitDepth: 16,
  });
  const flac_24 = calculateSourceQualityScore({
    codec: 'FLAC',
    bitrateBps: 2100000,
    sampleRateHz: 96000,
    bitDepth: 24,
  });

  assert.ok(opus_256 > mp3_320, '256kbps Opus should outrank 320kbps MP3');
  assert.ok(flac_24 > opus_256, '24-bit/96kHz FLAC should outrank Opus');
});

test('duplicate detection merges exact metadata+duration and keeps physical sources as alternatives', () => {
  const now = 1700000000000;
  const res = mergeScannedTracks(
    [],
    [],
    [],
    [
      {
        documentUri: 'root/album/track1.mp3',
        relativePath: 'album/track1.mp3',
        folderPath: 'album',
        fileName: 'track1.mp3',
        mimeType: 'audio/mpeg',
        containerFormat: 'MP3',
        codec: 'MP3',
        bitrateBps: 320000,
        sampleRateHz: 44100,
        bitDepth: 16,
        fileSizeBytes: 5_000_000,
        modifiedAt: now,
        title: '真夜中のプラネタリウム',
        artist: 'Neon Drift',
        album: 'Tokyo 1999',
        genre: 'Vaporwave',
        year: 1999,
        trackNumber: 1,
        durationMs: 210_000,
        artworkDataUri: null,
        embeddedLyrics: null,
        status: 'AVAILABLE',
      },
      {
        documentUri: 'root/flac/track1.flac',
        relativePath: 'flac/track1.flac',
        folderPath: 'flac',
        fileName: 'track1.flac',
        mimeType: 'audio/flac',
        containerFormat: 'FLAC',
        codec: 'FLAC',
        bitrateBps: 1_800_000,
        sampleRateHz: 96000,
        bitDepth: 24,
        fileSizeBytes: 28_000_000,
        modifiedAt: now,
        title: '真夜中のプラネタリウム',
        artist: 'Neon Drift',
        album: 'Tokyo 1999',
        genre: 'Vaporwave',
        year: 1999,
        trackNumber: 1,
        durationMs: 210_500,
        artworkDataUri: null,
        embeddedLyrics: null,
        status: 'AVAILABLE',
      },
    ],
    now
  );

  assert.equal(res.tracks.length, 1, 'Merged into 1 logical track');
  assert.equal(res.sources.length, 2, 'Both physical sources preserved');
  const flacSrc = res.sources.find((s) => s.codec === 'FLAC');
  assert.equal(res.tracks[0].primarySourceId, flacSrc?.sourceId, 'FLAC selected as primary source');
});

test('source fallback picks next available source when primary is missing', () => {
  const sources: TrackSource[] = [
    {
      sourceId: 's1',
      trackId: 't1',
      documentUri: 'a.flac',
      relativePath: 'a.flac',
      folderPath: 'root',
      fileName: 'a.flac',
      mimeType: 'audio/flac',
      containerFormat: 'FLAC',
      codec: 'FLAC',
      bitrateBps: 1500000,
      sampleRateHz: 44100,
      bitDepth: 16,
      fileSizeBytes: 20000000,
      modifiedAt: 0,
      sourceStatus: 'MISSING',
      qualityScore: 1100,
      isPrimary: true,
      lastScannedAt: 0,
    },
    {
      sourceId: 's2',
      trackId: 't1',
      documentUri: 'a.mp3',
      relativePath: 'a.mp3',
      folderPath: 'root',
      fileName: 'a.mp3',
      mimeType: 'audio/mpeg',
      containerFormat: 'MP3',
      codec: 'MP3',
      bitrateBps: 320000,
      sampleRateHz: 44100,
      bitDepth: 16,
      fileSizeBytes: 5000000,
      modifiedAt: 0,
      sourceStatus: 'AVAILABLE',
      qualityScore: 604,
      isPrimary: false,
      lastScannedAt: 0,
    },
  ];
  const fallback = selectBestAvailableSource(sources);
  assert.equal(fallback?.sourceId, 's2');
});

test('duplicate candidate flagging & manual merge preserves non-Latin strings', () => {
  assert.equal(normalizeMetadataString('  ネオン 東京  '), 'ネオン 東京');
  assert.equal(
    isExactDuplicateTrack(
      { normalizedTitle: 'senja', normalizedArtist: 'kota', normalizedAlbum: '98', durationMs: 180000 },
      { normalizedTitle: 'senja', normalizedArtist: 'kota', normalizedAlbum: '98', durationMs: 181200 }
    ),
    true
  );

  const now = 1700000000000;
  const scanned = mergeScannedTracks(
    [],
    [],
    [],
    [
      {
        documentUri: 'u1',
        relativePath: 'u1.mp3',
        folderPath: 'f1',
        fileName: 'u1.mp3',
        mimeType: 'audio/mpeg',
        containerFormat: 'MP3',
        codec: 'MP3',
        bitrateBps: 320000,
        sampleRateHz: 44100,
        bitDepth: 16,
        fileSizeBytes: 1000,
        modifiedAt: now,
        title: 'Cassette Dreams',
        artist: 'Y2K',
        album: 'Blue',
        genre: '',
        year: null,
        trackNumber: null,
        durationMs: 190000,
        artworkDataUri: null,
        embeddedLyrics: null,
        status: 'AVAILABLE',
      },
      {
        documentUri: 'u2',
        relativePath: 'u2.mp3',
        folderPath: 'f2',
        fileName: 'u2.mp3',
        mimeType: 'audio/mpeg',
        containerFormat: 'MP3',
        codec: 'MP3',
        bitrateBps: 192000,
        sampleRateHz: 44100,
        bitDepth: 16,
        fileSizeBytes: 800,
        modifiedAt: now,
        title: 'Cassette Dreams',
        artist: '',
        album: '',
        genre: '',
        year: null,
        trackNumber: null,
        durationMs: 190500,
        artworkDataUri: null,
        embeddedLyrics: null,
        status: 'AVAILABLE',
      },
    ],
    now
  );

  assert.equal(scanned.tracks.length, 2);
  assert.equal(scanned.candidates.length, 1);

  const merged = resolveDuplicateCandidateMerge(
    scanned.tracks,
    scanned.sources,
    scanned.candidates,
    scanned.candidates[0].candidateId,
    'MERGE',
    now + 10
  );
  assert.equal(merged.tracks.length, 1);
  assert.equal(merged.sources.length, 2);
  assert.equal(merged.candidates[0].status, 'MERGED');
});

test('smart shuffle keeps current track and repeat-all wraps next/previous cleanly', () => {
  const { queue, currentQueueItemId } = buildQueueFromTracks(
    ['t1', 't2', 't3', 't4'],
    'ALBUM',
    'alb_1',
    false,
    't2',
    [],
    1000
  );
  assert.equal(queue[1].queueItemId, currentQueueItemId);

  const shuffled = applySmartShuffleKeepingCurrent(queue, currentQueueItemId, [
    {
      historyId: 'h1',
      trackId: 't3',
      sourceId: null,
      trackTitleSnapshot: 't3',
      trackArtistSnapshot: 'a',
      playedAt: 900,
      durationPlayedMs: 10000,
      completed: true,
      sessionId: 's1',
    },
  ]);

  assert.equal(shuffled[0].trackId, 't2', 'Current track remains anchored first');
  assert.equal(shuffled[shuffled.length - 1].trackId, 't3', 'Recently played track deprioritized');

  const restored = restoreContextOrderQueue(shuffled);
  assert.deepEqual(
    restored.map((i) => i.trackId),
    ['t1', 't2', 't3', 't4']
  );

  assert.equal(getNextQueueIndex(3, 4), 0);
  assert.equal(getPreviousQueueIndex(0, 4), 3);

  assert.equal(cycleRepeatMode('REPEAT_ALL'), 'REPEAT_ONE');
  assert.equal(cycleRepeatMode('REPEAT_ONE'), 'REPEAT_OFF');
  assert.equal(cycleRepeatMode('REPEAT_OFF'), 'REPEAT_ALL');

  assert.equal(resolveNextTrackOnEnded(2, 4, 'REPEAT_ONE'), 2);
  assert.equal(resolveNextTrackOnEnded(3, 4, 'REPEAT_ALL'), 0);
  assert.equal(resolveNextTrackOnEnded(3, 4, 'REPEAT_OFF'), null);
  assert.equal(resolveNextTrackOnEnded(1, 4, 'REPEAT_OFF'), 2);

  const reordered = reorderPlaylistTracks(
    [
      { playlistId: 'p1', trackId: 'a', position: 0, addedAt: 1 },
      { playlistId: 'p1', trackId: 'b', position: 1, addedAt: 1 },
      { playlistId: 'p1', trackId: 'c', position: 2, addedAt: 1 },
    ],
    'p1',
    2,
    0
  );
  assert.deepEqual(
    reordered.map((x) => x.trackId),
    ['c', 'a', 'b']
  );
});

test('LRC parser syncs timestamps and plain text falls back cleanly', () => {
  const lrc = parseLrcLyrics('[00:05.00]Line one\n[00:12.50]Line two\n[00:20.00]Line three');
  assert.equal(lrc.isLrc, true);
  assert.equal(lrc.lines.length, 3);
  assert.equal(getActiveLrcLineIndex(lrc.lines, 4000), -1);
  assert.equal(getActiveLrcLineIndex(lrc.lines, 13000), 1);

  const plain = parseLrcLyrics('Just plain lyrics\nSecond line');
  assert.equal(plain.isLrc, false);
  assert.equal(plain.plainLines.length, 2);

  assert.equal(formatDurationMs(215000), '3:35');
});

test('EQ clipping, smooth curve, crossfade precedence, and DAC fallback validation', () => {
  const bands = createDefaultEqBands('eq1', [8, 6, 0, 0, 0, 0, 0, 0, 0, 0]);
  const clip = computeClippingRisk(4, bands);
  assert.equal(clip.hasWarning, true);
  assert.equal(clip.severity, 'HIGH');

  const path = buildSmoothEqCurvePath([
    { x: 0, y: 50 },
    { x: 50, y: 20 },
    { x: 100, y: 50 },
  ]);
  assert.ok(path.startsWith('M 0.00 50.00 C '));

  const trans = resolveTransitionMode(true, 5, true);
  assert.equal(trans.mode, 'CROSSFADE');
  assert.equal(trans.crossfadeSec, 5);

  const dacCheck = validateDacOutputConfig(
    { supportedSampleRates: [44100, 48000], supportedBitDepths: [16, 24] },
    'MANUAL',
    192000,
    32
  );
  assert.equal(dacCheck.fallbackUsed, true);
  assert.equal(dacCheck.appliedSampleRateHz, 48000);
});

test('Vaporwave artwork generator produces unique data URIs per seed and ZIP backup excludes audio', async () => {
  const art1 = generateVaporwaveArtworkDataUri('ALBUM:Midnight 98');
  const art2 = generateVaporwaveArtworkDataUri('ALBUM:Crystal Plaza');
  assert.ok(art1.startsWith('data:image/svg+xml;utf8,'));
  assert.notEqual(art1, art2);

  const mockState: MuzeanDatabaseState = {
    schemaVersion: 1,
    tracks: [],
    trackSources: [],
    duplicateCandidates: [],
    albums: [],
    artists: [],
    playlists: [
      {
        playlistId: 'pl_1',
        name: 'Vapor Favorites',
        playlistType: 'USER',
        smartType: null,
        sortMode: 'dateAdded',
        artworkCacheKey: '',
        createdAt: 100,
        updatedAt: 100,
      },
    ],
    playlistTracks: [],
    queue: [],
    session: {
      sessionId: 's1',
      startedAt: 100,
      endedAt: null,
      queueContext: 'tracks',
      shuffleEnabled: false,
      repeatMode: 'REPEAT_ALL',
      currentQueueItemId: null,
    },
    playHistory: [],
    trackPlayCounts: [],
    lyrics: [],
    eqConfigs: [],
    dacProfiles: [],
    settings: {
      settingsId: 'default',
      language: 'id',
      theme: 'dark',
      textScale: 'medium',
      uiScale: 'standard',
      hapticsEnabled: true,
      crossfadeEnabled: false,
      crossfadeDurationSec: 5,
      gaplessEnabled: true,
      outputMode: 'AUTOMATIC',
      preferredSampleRateHz: 48000,
      preferredBitDepth: 24,
      lyricsDisplayMode: 'EMBEDDED_FIRST',
      visualizerMode: 'SPECTRUM',
      artworkAccentEnabled: true,
      updatedAt: 100,
    },
    musicRoot: null,
    scanRuns: [],
    artworkCache: {},
    backupRecords: [],
  };

  const { blob, manifest } = await createMuzeanBackupZip(mockState, 1700000000000);
  assert.equal(manifest.excludesOriginalAudio, true);
  assert.equal(manifest.counts.playlists, 1);

  const buffer = await blob.arrayBuffer();
  const validation = await validateMuzeanBackupZip(buffer);
  assert.equal(validation.valid, true);
  assert.equal(validation.payload?.playlists[0].name, 'Vapor Favorites');
});
