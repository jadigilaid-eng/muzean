import { getOrCreateCachedArtwork } from '../domain/artwork';
import { createDefaultEqBands, createDefaultEqConfig, EQ_PRESETS } from '../domain/audioMath';
import { calculateSourceQualityScore, normalizeMetadataString } from '../domain/duplicates';
import type {
  Album,
  Artist,
  ArtworkCacheEntry,
  DACProfile,
  DuplicateCandidate,
  EQConfig,
  Lyrics,
  MuzeanDatabaseState,
  PlayHistory,
  Playlist,
  PlaylistTrack,
  Track,
  TrackPlayCount,
  TrackSource,
} from '../domain/types';

export function createSeedDatabaseState(now = Date.now()): MuzeanDatabaseState {
  const artworkCache: Record<string, ArtworkCacheEntry> = {};

  const rawTracks: Array<{
    id: string;
    title: string;
    artist: string;
    album: string;
    genre: string;
    year: number;
    trackNumber: number | null;
    durationMs: number;
    folder: string;
    synthPresetIndex: number;
    sources: Array<{
      id: string;
      fileName: string;
      container: string;
      codec: string;
      bitrate: number;
      sampleRate: number;
      bitDepth: number;
      size: number;
      status?: 'AVAILABLE' | 'CORRUPT' | 'UNSUPPORTED';
      errorDetail?: string;
    }>;
  }> = [
    {
      id: 'trk_01',
      title: '真夜中のプラネタリウム',
      artist: 'Neon Drift 1998',
      album: 'Tokyo Bay CRT',
      genre: 'Vaporwave',
      year: 1998,
      trackNumber: 1,
      durationMs: 28_000,
      folder: 'Music/Japanese_City_Vapor',
      synthPresetIndex: 0,
      sources: [
        {
          id: 'src_01_flac',
          fileName: '01 - 真夜中のプラネタリウム.flac',
          container: 'FLAC',
          codec: 'FLAC',
          bitrate: 2_140_000,
          sampleRate: 96000,
          bitDepth: 24,
          size: 32_450_000,
        },
        {
          id: 'src_01_mp3',
          fileName: '01 - 真夜中のプラネタリウム (Archive).mp3',
          container: 'MP3',
          codec: 'MP3',
          bitrate: 320_000,
          sampleRate: 44100,
          bitDepth: 16,
          size: 7_210_000,
        },
      ],
    },
    {
      id: 'trk_02',
      title: 'Senja di Kota Tua',
      artist: 'Kaset Malam',
      album: 'Sinyal Y2K',
      genre: 'Synth Pop',
      year: 1999,
      trackNumber: 2,
      durationMs: 24_000,
      folder: 'Music/Nusantara_Wave',
      synthPresetIndex: 1,
      sources: [
        {
          id: 'src_02_opus',
          fileName: 'Senja di Kota Tua.opus',
          container: 'OPUS',
          codec: 'OPUS',
          bitrate: 256_000,
          sampleRate: 48000,
          bitDepth: 16,
          size: 5_100_000,
        },
      ],
    },
    {
      id: 'trk_03',
      title: 'Windows 98 Sunset Plaza',
      artist: 'Silver Mall Audio',
      album: 'Atrium Reflections',
      genre: 'Mallsoft',
      year: 1997,
      trackNumber: 1,
      durationMs: 26_000,
      folder: 'Music/Atrium_Reflections',
      synthPresetIndex: 2,
      sources: [
        {
          id: 'src_03_wav',
          fileName: 'Windows 98 Sunset Plaza.wav',
          container: 'WAV',
          codec: 'PCM',
          bitrate: 1_411_200,
          sampleRate: 44100,
          bitDepth: 16,
          size: 28_600_000,
        },
      ],
    },
    {
      id: 'trk_04',
      title: '별빛 카세트 (Starlight Cassette)',
      artist: 'Seoul Wave Club',
      album: 'Midnight FM 99.4',
      genre: 'Future Funk',
      year: 2000,
      trackNumber: 3,
      durationMs: 22_000,
      folder: 'Music/Seoul_Wave',
      synthPresetIndex: 3,
      sources: [
        {
          id: 'src_04_m4a',
          fileName: '03_starlight_cassette.m4a',
          container: 'M4A',
          codec: 'AAC',
          bitrate: 256_000,
          sampleRate: 44100,
          bitDepth: 16,
          size: 6_300_000,
        },
      ],
    },
    {
      id: 'trk_05',
      title: 'ネオン東京 1999',
      artist: 'Neon Drift 1998',
      album: 'Tokyo Bay CRT',
      genre: 'Vaporwave',
      year: 1998,
      trackNumber: 2,
      durationMs: 25_000,
      folder: 'Music/Japanese_City_Vapor',
      synthPresetIndex: 4,
      sources: [
        {
          id: 'src_05_flac',
          fileName: '02 - ネオン東京 1999.flac',
          container: 'FLAC',
          codec: 'FLAC',
          bitrate: 1_680_000,
          sampleRate: 48000,
          bitDepth: 24,
          size: 24_800_000,
        },
      ],
    },
    {
      id: 'trk_06',
      title: 'Chrome Dial-Up Memory',
      artist: 'Silver Mall Audio',
      album: 'Atrium Reflections',
      genre: 'Chillwave',
      year: 2001,
      trackNumber: 2,
      durationMs: 24_000,
      folder: 'Music/Atrium_Reflections',
      synthPresetIndex: 5,
      sources: [
        {
          id: 'src_06_mp3',
          fileName: 'Chrome Dial-Up Memory.mp3',
          container: 'MP3',
          codec: 'MP3',
          bitrate: 320_000,
          sampleRate: 44100,
          bitDepth: 16,
          size: 8_100_000,
        },
      ],
    },
    {
      id: 'trk_07',
      title: 'Chrome Dial-Up Memory',
      artist: 'Unknown Artist',
      album: 'Unsorted Rip 2001',
      genre: 'Chillwave',
      year: 2001,
      trackNumber: null,
      durationMs: 24_300,
      folder: 'Music/Unsorted',
      synthPresetIndex: 5,
      sources: [
        {
          id: 'src_07_ogg',
          fileName: 'dialup_rip_01.ogg',
          container: 'OGG',
          codec: 'VORBIS',
          bitrate: 192_000,
          sampleRate: 44100,
          bitDepth: 16,
          size: 4_200_000,
        },
      ],
    },
    {
      id: 'trk_08',
      title: 'Glitch Tape Sector 04',
      artist: 'Kaset Malam',
      album: 'Sinyal Y2K',
      genre: 'Ambient',
      year: 1999,
      trackNumber: 5,
      durationMs: 0,
      folder: 'Music/Nusantara_Wave',
      synthPresetIndex: 0,
      sources: [
        {
          id: 'src_08_corrupt',
          fileName: 'sector_04_damaged.flac',
          container: 'FLAC',
          codec: 'FLAC',
          bitrate: 0,
          sampleRate: 44100,
          bitDepth: 16,
          size: 4_096,
          status: 'CORRUPT',
          errorDetail: 'FLAC stream header truncated at byte 128',
        },
      ],
    },
    {
      id: 'trk_09',
      title: 'Pacific Mall Escalator',
      artist: 'Silver Mall Audio',
      album: 'Atrium Reflections',
      genre: 'Mallsoft',
      year: 1997,
      trackNumber: 3,
      durationMs: 21_000,
      folder: 'Music/Atrium_Reflections',
      synthPresetIndex: 1,
      sources: [
        {
          id: 'src_09_flac',
          fileName: '03 - Pacific Mall Escalator.flac',
          container: 'FLAC',
          codec: 'FLAC',
          bitrate: 1_520_000,
          sampleRate: 48000,
          bitDepth: 24,
          size: 21_300_000,
        },
      ],
    },
    {
      id: 'trk_10',
      title: 'Hujan di Jalan Sudirman',
      artist: 'Kaset Malam',
      album: 'Sinyal Y2K',
      genre: 'Synth Pop',
      year: 1999,
      trackNumber: 3,
      durationMs: 23_000,
      folder: 'Music/Nusantara_Wave',
      synthPresetIndex: 2,
      sources: [
        {
          id: 'src_10_m4a',
          fileName: '03 - Hujan di Jalan Sudirman.m4a',
          container: 'M4A',
          codec: 'AAC',
          bitrate: 256_000,
          sampleRate: 44100,
          bitDepth: 16,
          size: 5_800_000,
        },
      ],
    },
    {
      id: 'trk_11',
      title: '渋谷モノレール 23:45',
      artist: 'Neon Drift 1998',
      album: 'Tokyo Bay CRT',
      genre: 'Vaporwave',
      year: 1998,
      trackNumber: 3,
      durationMs: 27_000,
      folder: 'Music/Japanese_City_Vapor',
      synthPresetIndex: 3,
      sources: [
        {
          id: 'src_11_opus',
          fileName: '03 - Shibuya Monorail.opus',
          container: 'OPUS',
          codec: 'OPUS',
          bitrate: 192_000,
          sampleRate: 48000,
          bitDepth: 16,
          size: 4_100_000,
        },
      ],
    },
    {
      id: 'trk_12',
      title: '한강 네온 드라이브 (Hangang Neon)',
      artist: 'Seoul Wave Club',
      album: 'Midnight FM 99.4',
      genre: 'Future Funk',
      year: 2000,
      trackNumber: 4,
      durationMs: 25_000,
      folder: 'Music/Seoul_Wave',
      synthPresetIndex: 4,
      sources: [
        {
          id: 'src_12_mp3',
          fileName: '04_hangang_neon.mp3',
          container: 'MP3',
          codec: 'MP3',
          bitrate: 320_000,
          sampleRate: 44100,
          bitDepth: 16,
          size: 6_900_000,
        },
      ],
    },
  ];

  const tracks: Track[] = [];
  const trackSources: TrackSource[] = [];
  const albumMap = new Map<string, Album>();
  const artistMap = new Map<string, Artist>();

  rawTracks.forEach((raw, idx) => {
    const scoredSources: TrackSource[] = raw.sources.map((s) => {
      const score = calculateSourceQualityScore({
        codec: s.codec,
        containerFormat: s.container,
        bitrateBps: s.bitrate,
        sampleRateHz: s.sampleRate,
        bitDepth: s.bitDepth,
      });
      return {
        sourceId: s.id,
        trackId: raw.id,
        documentUri: `saf://MUZEAN_Library/${raw.folder}/${s.fileName}`,
        relativePath: `${raw.folder}/${s.fileName}`,
        folderPath: raw.folder,
        fileName: s.fileName,
        mimeType: `audio/${s.container.toLowerCase()}`,
        containerFormat: s.container,
        codec: s.codec,
        bitrateBps: s.bitrate,
        sampleRateHz: s.sampleRate,
        bitDepth: s.bitDepth,
        fileSizeBytes: s.size,
        modifiedAt: now - (10 - idx) * 86_400_000,
        sourceStatus: s.status ?? 'AVAILABLE',
        qualityScore: score,
        isPrimary: false,
        lastScannedAt: now - 3600_000,
        errorDetail: s.errorDetail,
      };
    });

    const available = scoredSources.filter((s) => s.sourceStatus === 'AVAILABLE');
    const primary =
      available.sort((a, b) => b.qualityScore - a.qualityScore)[0] ?? scoredSources[0];
    primary.isPrimary = true;

    const normAlbum = normalizeMetadataString(raw.album);
    const normArtist = normalizeMetadataString(raw.artist);

    const albumArt = getOrCreateCachedArtwork(
      artworkCache,
      'ALBUM',
      normAlbum,
      `${raw.album}:${raw.artist}`,
      now
    );
    if (albumArt.createdEntry) {
      artworkCache[albumArt.key] = albumArt.createdEntry;
    }

    if (!albumMap.has(normAlbum)) {
      albumMap.set(normAlbum, {
        albumId: `alb_${normAlbum.replace(/[^a-z0-9]/g, '_') || idx}`,
        name: raw.album,
        normalizedName: normAlbum,
        artistDisplay: raw.artist,
        year: raw.year,
        artworkCacheKey: albumArt.key,
        artworkOrigin: 'GENERATED_VAPORWAVE',
      });
    }

    const artistArt = getOrCreateCachedArtwork(
      artworkCache,
      'ARTIST',
      normArtist,
      raw.artist,
      now
    );
    if (artistArt.createdEntry) {
      artworkCache[artistArt.key] = artistArt.createdEntry;
    }

    if (!artistMap.has(normArtist)) {
      artistMap.set(normArtist, {
        artistId: `art_${normArtist.replace(/[^a-z0-9]/g, '_') || idx}`,
        name: raw.artist,
        normalizedName: normArtist,
        artworkCacheKey: artistArt.key,
        artworkOrigin: 'GENERATED_VAPORWAVE',
      });
    }

    tracks.push({
      trackId: raw.id,
      displayTitle: raw.title,
      displayArtist: raw.artist,
      displayAlbum: raw.album,
      normalizedTitle: normalizeMetadataString(raw.title),
      normalizedArtist: normArtist,
      normalizedAlbum: normAlbum,
      durationMs: raw.durationMs,
      genre: raw.genre,
      year: raw.year,
      trackNumber: raw.trackNumber,
      primarySourceId: primary.sourceId,
      availabilityStatus: primary.sourceStatus,
      artworkCacheKey: albumArt.key,
      synthPresetIndex: raw.synthPresetIndex,
      createdAt: now - (10 - idx) * 86_400_000,
      updatedAt: now,
    });

    trackSources.push(...scoredSources);
  });

  const duplicateCandidates: DuplicateCandidate[] = [
    {
      candidateId: 'dup_01',
      sourceTrackId: 'trk_07',
      targetTrackId: 'trk_06',
      matchReason: 'Same title & similar duration (24.0s vs 24.3s) with incomplete artist/album metadata',
      status: 'PENDING',
      createdAt: now - 3600_000,
      resolvedAt: null,
    },
  ];

  const playlists: Playlist[] = [
    {
      playlistId: 'pl_smart_recent',
      name: 'Recently Played',
      playlistType: 'SMART',
      smartType: 'RECENTLY_PLAYED',
      sortMode: 'dateAdded',
      artworkCacheKey: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      playlistId: 'pl_smart_most',
      name: 'Most Played',
      playlistType: 'SMART',
      smartType: 'MOST_PLAYED',
      sortMode: 'dateAdded',
      artworkCacheKey: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      playlistId: 'pl_smart_history',
      name: 'Play History',
      playlistType: 'SMART',
      smartType: 'PLAY_HISTORY',
      sortMode: 'dateAdded',
      artworkCacheKey: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      playlistId: 'pl_vapor_late_night',
      name: 'Late Night CRT Mix',
      playlistType: 'USER',
      smartType: null,
      sortMode: 'dateAdded',
      artworkCacheKey: '',
      createdAt: now - 86_400_000,
      updatedAt: now - 86_400_000,
    },
  ];

  const playlistTracks: PlaylistTrack[] = [
    { playlistId: 'pl_vapor_late_night', trackId: 'trk_01', position: 0, addedAt: now - 72_000_000 },
    { playlistId: 'pl_vapor_late_night', trackId: 'trk_02', position: 1, addedAt: now - 70_000_000 },
    { playlistId: 'pl_vapor_late_night', trackId: 'trk_03', position: 2, addedAt: now - 68_000_000 },
    { playlistId: 'pl_vapor_late_night', trackId: 'trk_04', position: 3, addedAt: now - 66_000_000 },
  ];

  const lyrics: Lyrics[] = [
    {
      lyricsId: 'lyr_01',
      trackId: 'trk_01',
      sourceType: 'EMBEDDED',
      format: 'LRC',
      content: `[00:00.50]真夜中のプラネタリウム — Neon Drift 1998
[00:03.20]Static hum on the CRT horizon
[00:06.80]蛍光灯の海に浮かぶ記憶 (Memories floating in neon)
[00:10.50]Cassette reels turning at 48 kilohertz
[00:14.20]Midnight escalators through Tokyo Bay
[00:18.00]Chrome moons reflect on rain-soaked glass
[00:22.40]Rewind the tape before sunrise arrives`,
      languageTag: 'ja',
      createdAt: now,
      updatedAt: now,
    },
    {
      lyricsId: 'lyr_02',
      trackId: 'trk_02',
      sourceType: 'EMBEDDED',
      format: 'PLAIN',
      content: `Langit jingga di atas bangunan tua
Menunggu gelombang radio malam tiba
Kaset berputar perlahan di dek perak
Membawa sinyal dari tahun sembilan sembilan

Di antara frekuensi dan gema kota
Kita simpan nada hangat dalam pita suara`,
      languageTag: 'id',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const globalEq = createDefaultEqConfig('eq_global', 'Global Studio EQ', 'GLOBAL', now);
  const vaporPreset = EQ_PRESETS[1];
  globalEq.presetKey = vaporPreset.key;
  globalEq.bands = createDefaultEqBands('eq_global', vaporPreset.gains);

  const dacEq = createDefaultEqConfig('eq_dac_usb', 'USB-C DAC Reference', 'DAC', now);
  const studioPreset = EQ_PRESETS[9];
  dacEq.presetKey = studioPreset.key;
  dacEq.bands = createDefaultEqBands('eq_dac_usb', studioPreset.gains);

  const eqConfigs: EQConfig[] = [globalEq, dacEq];

  const dacProfiles: DACProfile[] = [
    {
      dacProfileId: 'dac_builtin',
      deviceFingerprint: 'default_system_output',
      displayName: 'Standard Audio Output',
      connectionType: 'BUILTIN',
      enabled: true,
      eqConfigId: 'eq_global',
      outputMode: 'AUTOMATIC',
      preferredSampleRateHz: 48000,
      preferredBitDepth: 16,
      supportedSampleRates: [44100, 48000],
      supportedBitDepths: [16, 24],
      passthroughSupported: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      dacProfileId: 'dac_usb_ref',
      deviceFingerprint: 'usb_c_hires_dac',
      displayName: 'USB-C Hi-Res DAC (Registered)',
      connectionType: 'USB_C',
      enabled: false,
      eqConfigId: 'eq_dac_usb',
      outputMode: 'AUTOMATIC',
      preferredSampleRateHz: 96000,
      preferredBitDepth: 24,
      supportedSampleRates: [44100, 48000, 96000, 192000],
      supportedBitDepths: [16, 24, 32],
      passthroughSupported: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const playHistory: PlayHistory[] = [
    {
      historyId: 'hist_01',
      trackId: 'trk_01',
      sourceId: 'src_01_flac',
      trackTitleSnapshot: '真夜中のプラネタリウム',
      trackArtistSnapshot: 'Neon Drift 1998',
      playedAt: now - 1_800_000,
      durationPlayedMs: 28_000,
      completed: true,
      sessionId: 'sess_init',
    },
    {
      historyId: 'hist_02',
      trackId: 'trk_02',
      sourceId: 'src_02_opus',
      trackTitleSnapshot: 'Senja di Kota Tua',
      trackArtistSnapshot: 'Kaset Malam',
      playedAt: now - 3_600_000,
      durationPlayedMs: 24_000,
      completed: true,
      sessionId: 'sess_init',
    },
    {
      historyId: 'hist_03',
      trackId: 'trk_04',
      sourceId: 'src_04_m4a',
      trackTitleSnapshot: '별빛 카세트 (Starlight Cassette)',
      trackArtistSnapshot: 'Seoul Wave Club',
      playedAt: now - 7_200_000,
      durationPlayedMs: 22_000,
      completed: true,
      sessionId: 'sess_init',
    },
  ];

  const trackPlayCounts: TrackPlayCount[] = [
    { trackId: 'trk_01', playCount: 14, lastPlayedAt: now - 1_800_000 },
    { trackId: 'trk_02', playCount: 9, lastPlayedAt: now - 3_600_000 },
    { trackId: 'trk_03', playCount: 5, lastPlayedAt: now - 18_000_000 },
    { trackId: 'trk_04', playCount: 11, lastPlayedAt: now - 7_200_000 },
  ];

  const availableTracks = tracks.filter((t) => t.availabilityStatus === 'AVAILABLE');
  const queue = availableTracks.map((t, idx) => ({
    queueItemId: `qi_seed_${idx}`,
    trackId: t.trackId,
    position: idx,
    sourceContextType: 'TRACKS' as const,
    sourceContextId: 'all',
    addedAt: now,
    shuffleRank: idx,
  }));

  return {
    schemaVersion: 1,
    tracks,
    trackSources,
    duplicateCandidates,
    albums: Array.from(albumMap.values()),
    artists: Array.from(artistMap.values()),
    playlists,
    playlistTracks,
    queue,
    session: {
      sessionId: 'sess_init',
      startedAt: now,
      endedAt: null,
      queueContext: 'all',
      shuffleEnabled: false,
      repeatMode: 'REPEAT_ALL',
      currentQueueItemId: queue[0]?.queueItemId ?? null,
    },
    playHistory,
    trackPlayCounts,
    lyrics,
    eqConfigs,
    dacProfiles,
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
      updatedAt: now,
    },
    musicRoot: {
      musicRootId: 'root_default',
      treeUri: 'saf://MUZEAN_Library',
      displayName: 'MUZEAN Local Library',
      permissionPersisted: true,
      lastScanAt: now - 3600_000,
      rootStatus: 'READY',
    },
    scanRuns: [
      {
        scanRunId: 'scan_init',
        startedAt: now - 3602_000,
        finishedAt: now - 3600_000,
        status: 'PARTIAL',
        filesDiscovered: 9,
        filesAdded: 8,
        filesUpdated: 0,
        filesMissing: 0,
        filesFailed: 1,
        errorSummary: '1 damaged FLAC file isolated without interrupting scan',
      },
    ],
    artworkCache,
    backupRecords: [],
  };
}
