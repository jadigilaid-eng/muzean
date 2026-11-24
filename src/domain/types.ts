export type AvailabilityStatus = 'AVAILABLE' | 'MISSING' | 'CORRUPT' | 'UNSUPPORTED';

export type SourceStatus = 'AVAILABLE' | 'MISSING' | 'CORRUPT' | 'UNSUPPORTED';

export type DuplicateCandidateStatus = 'PENDING' | 'MERGED' | 'DISMISSED';

export type ArtworkOrigin = 'EMBEDDED' | 'GENERATED_VAPORWAVE';

export type PlaylistType = 'USER' | 'SMART';

export type SmartPlaylistType = 'RECENTLY_PLAYED' | 'MOST_PLAYED' | 'PLAY_HISTORY';

export type LyricsSourceType = 'EMBEDDED' | 'MANUAL';

export type LyricsFormat = 'LRC' | 'PLAIN';

export type SpatialPreset = 'NARROW' | 'NORMAL' | 'WIDE' | 'EXTRA_WIDE';

export type OutputMode = 'AUTOMATIC' | 'MANUAL';

export type ConnectionType = 'BUILTIN' | 'USB_C' | 'BLUETOOTH' | 'LINE_OUT';

export type VisualizerMode = 'SPECTRUM' | 'WAVEFORM' | 'AURORA' | 'PARTICLES' | 'NEON_TUNNEL';

export type AppLanguage = 'id' | 'en';

export type AppTheme = 'dark' | 'light';

export type TextScale = 'small' | 'medium' | 'large';

export type UiScale = 'compact' | 'standard' | 'comfortable';

export type SortField = 'title' | 'artist' | 'album' | 'duration' | 'dateAdded';

export type SortDirection = 'asc' | 'desc';

export type ViewRoute =
  | 'tracks'
  | 'playlists'
  | 'albums'
  | 'artists'
  | 'folders'
  | 'nowplaying'
  | 'equalizer'
  | 'settings';

export interface Track {
  trackId: string;
  displayTitle: string;
  displayArtist: string;
  displayAlbum: string;
  normalizedTitle: string;
  normalizedArtist: string;
  normalizedAlbum: string;
  durationMs: number;
  genre: string;
  year: number | null;
  trackNumber: number | null;
  primarySourceId: string;
  availabilityStatus: AvailabilityStatus;
  artworkCacheKey: string | null;
  synthPresetIndex?: number; // For built-in playable synth tracks
  createdAt: number;
  updatedAt: number;
}

export interface TrackSource {
  sourceId: string;
  trackId: string;
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
  sourceStatus: SourceStatus;
  qualityScore: number;
  isPrimary: boolean;
  lastScannedAt: number;
  objectUrl?: string; // Ephemeral browser Blob URL when loaded from disk
  errorDetail?: string;
}

export interface DuplicateCandidate {
  candidateId: string;
  sourceTrackId: string;
  targetTrackId: string;
  matchReason: string;
  status: DuplicateCandidateStatus;
  createdAt: number;
  resolvedAt: number | null;
}

export interface Album {
  albumId: string;
  name: string;
  normalizedName: string;
  artistDisplay: string;
  year: number | null;
  artworkCacheKey: string;
  artworkOrigin: ArtworkOrigin;
}

export interface Artist {
  artistId: string;
  name: string;
  normalizedName: string;
  artworkCacheKey: string;
  artworkOrigin: ArtworkOrigin;
}

export interface Playlist {
  playlistId: string;
  name: string;
  playlistType: PlaylistType;
  smartType: SmartPlaylistType | null;
  sortMode: SortField;
  artworkCacheKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistTrack {
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: number;
}

export interface PlaybackQueueItem {
  queueItemId: string;
  trackId: string;
  position: number;
  sourceContextType: 'TRACKS' | 'ALBUM' | 'ARTIST' | 'FOLDER' | 'PLAYLIST' | 'SEARCH' | 'MANUAL';
  sourceContextId: string;
  addedAt: number;
  shuffleRank: number;
}

export type RepeatMode = 'REPEAT_ALL' | 'REPEAT_ONE' | 'REPEAT_OFF';

export interface PlaybackSession {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  queueContext: string;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  currentQueueItemId: string | null;
}

export interface PlayHistory {
  historyId: string;
  trackId: string | null;
  sourceId: string | null;
  trackTitleSnapshot: string;
  trackArtistSnapshot: string;
  playedAt: number;
  durationPlayedMs: number;
  completed: boolean;
  sessionId: string;
}

export interface TrackPlayCount {
  trackId: string;
  playCount: number;
  lastPlayedAt: number;
}

export interface Lyrics {
  lyricsId: string;
  trackId: string;
  sourceType: LyricsSourceType;
  format: LyricsFormat;
  content: string;
  languageTag: string;
  createdAt: number;
  updatedAt: number;
}

export interface EQBand {
  eqBandId: string;
  eqConfigId: string;
  frequencyHz: number;
  gainDb: number;
  position: number;
}

export interface EQConfig {
  eqConfigId: string;
  name: string;
  scope: 'GLOBAL' | 'DAC';
  presetKey: string;
  isManual: boolean;
  preampDb: number;
  spatialPreset: SpatialPreset;
  spatialIntensity: number; // 0..100
  replayGainAlbumEnabled: boolean;
  bands: EQBand[];
  createdAt: number;
  updatedAt: number;
}

export interface DACProfile {
  dacProfileId: string;
  deviceFingerprint: string;
  displayName: string;
  connectionType: ConnectionType;
  enabled: boolean;
  eqConfigId: string;
  outputMode: OutputMode;
  preferredSampleRateHz: number;
  preferredBitDepth: number;
  supportedSampleRates: number[];
  supportedBitDepths: number[];
  passthroughSupported: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  settingsId: string;
  language: AppLanguage;
  theme: AppTheme;
  textScale: TextScale;
  uiScale: UiScale;
  hapticsEnabled: boolean;
  crossfadeEnabled: boolean;
  crossfadeDurationSec: 3 | 5 | 8 | 10;
  gaplessEnabled: boolean;
  outputMode: OutputMode;
  preferredSampleRateHz: number;
  preferredBitDepth: number;
  lyricsDisplayMode: 'EMBEDDED_FIRST' | 'MANUAL_FIRST';
  visualizerMode: VisualizerMode;
  artworkAccentEnabled: boolean;
  updatedAt: number;
}

export interface MusicRoot {
  musicRootId: string;
  treeUri: string;
  displayName: string;
  permissionPersisted: boolean;
  lastScanAt: number | null;
  rootStatus: 'READY' | 'MISSING' | 'PERMISSION_REVOKED';
}

export interface ScanRun {
  scanRunId: string;
  startedAt: number;
  finishedAt: number | null;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  filesDiscovered: number;
  filesAdded: number;
  filesUpdated: number;
  filesMissing: number;
  filesFailed: number;
  errorSummary: string | null;
}

export interface ArtworkCacheEntry {
  artworkCacheKey: string;
  ownerType: 'ALBUM' | 'ARTIST' | 'PLAYLIST' | 'TRACK';
  ownerId: string;
  dataUri: string;
  generationSeed: string;
  sourceHash: string;
  createdAt: number;
}

export interface BackupRecord {
  backupId: string;
  fileName: string;
  createdAt: number;
  appVersion: string;
  schemaVersion: number;
  backupStatus: 'SUCCESS' | 'FAILED';
  contentSummary: string;
}

export interface MuzeanDatabaseState {
  schemaVersion: number;
  tracks: Track[];
  trackSources: TrackSource[];
  duplicateCandidates: DuplicateCandidate[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  playlistTracks: PlaylistTrack[];
  queue: PlaybackQueueItem[];
  session: PlaybackSession;
  playHistory: PlayHistory[];
  trackPlayCounts: TrackPlayCount[];
  lyrics: Lyrics[];
  eqConfigs: EQConfig[];
  dacProfiles: DACProfile[];
  settings: AppSettings;
  musicRoot: MusicRoot | null;
  scanRuns: ScanRun[];
  artworkCache: Record<string, ArtworkCacheEntry>;
  backupRecords: BackupRecord[];
}
