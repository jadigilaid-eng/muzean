import JSZip from 'jszip';
import type {
  AppSettings,
  DACProfile,
  EQConfig,
  Lyrics,
  MuzeanDatabaseState,
  PlayHistory,
  Playlist,
  PlaylistTrack,
  TrackPlayCount,
} from './types';

export const BACKUP_APP_VERSION = '1.0.0';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupManifest {
  appName: 'MUZEAN';
  appVersion: string;
  schemaVersion: number;
  createdAt: number;
  checksum: string;
  excludesOriginalAudio: true;
  counts: {
    playlists: number;
    playlistTracks: number;
    eqConfigs: number;
    dacProfiles: number;
    lyrics: number;
    playHistory: number;
    trackPlayCounts: number;
  };
}

export interface BackupPayload {
  playlists: Playlist[];
  playlistTracks: PlaylistTrack[];
  eqConfigs: EQConfig[];
  dacProfiles: DACProfile[];
  lyrics: Lyrics[];
  playHistory: PlayHistory[];
  trackPlayCounts: TrackPlayCount[];
  settings: AppSettings;
}

export function computeSimpleChecksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function extractBackupPayload(state: MuzeanDatabaseState): BackupPayload {
  return {
    playlists: state.playlists,
    playlistTracks: state.playlistTracks,
    eqConfigs: state.eqConfigs,
    dacProfiles: state.dacProfiles,
    lyrics: state.lyrics,
    playHistory: state.playHistory,
    trackPlayCounts: state.trackPlayCounts,
    settings: state.settings,
  };
}

/**
 * Generates a real ZIP archive containing manifest.json and payload.json.
 * Strictly excludes original audio files per PRD.
 */
export async function createMuzeanBackupZip(
  state: MuzeanDatabaseState,
  now = Date.now()
): Promise<{ blob: Blob; fileName: string; manifest: BackupManifest }> {
  const payload = extractBackupPayload(state);
  const payloadJson = JSON.stringify(payload, null, 2);
  const checksum = computeSimpleChecksum(payloadJson);

  const manifest: BackupManifest = {
    appName: 'MUZEAN',
    appVersion: BACKUP_APP_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: now,
    checksum,
    excludesOriginalAudio: true,
    counts: {
      playlists: payload.playlists.length,
      playlistTracks: payload.playlistTracks.length,
      eqConfigs: payload.eqConfigs.length,
      dacProfiles: payload.dacProfiles.length,
      lyrics: payload.lyrics.length,
      playHistory: payload.playHistory.length,
      trackPlayCounts: payload.trackPlayCounts.length,
    },
  };

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('payload.json', payloadJson);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const dateTag = new Date(now).toISOString().slice(0, 10);
  const fileName = `muzean-backup-${dateTag}.zip`;
  return { blob, fileName, manifest };
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  manifest?: BackupManifest;
  payload?: BackupPayload;
}

export async function validateMuzeanBackupZip(
  input: ArrayBuffer | Uint8Array | Blob
): Promise<BackupValidationResult> {
  try {
    const zip = await JSZip.loadAsync(input);
    const manifestFile = zip.file('manifest.json');
    const payloadFile = zip.file('payload.json');

    if (!manifestFile || !payloadFile) {
      return { valid: false, error: 'Archive is missing manifest.json or payload.json.' };
    }

    const manifestRaw = await manifestFile.async('string');
    const payloadRaw = await payloadFile.async('string');

    const manifest = JSON.parse(manifestRaw) as BackupManifest;
    if (manifest.appName !== 'MUZEAN') {
      return { valid: false, error: 'Not a valid MUZEAN backup archive.' };
    }

    const actualChecksum = computeSimpleChecksum(payloadRaw);
    if (manifest.checksum !== actualChecksum) {
      return { valid: false, error: 'Backup checksum mismatch — archive may be corrupted.' };
    }

    const payload = JSON.parse(payloadRaw) as BackupPayload;
    if (!Array.isArray(payload.playlists) || !Array.isArray(payload.eqConfigs) || !payload.settings) {
      return { valid: false, error: 'Backup payload structure is incomplete.' };
    }

    return { valid: true, manifest, payload };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unable to read ZIP backup.',
    };
  }
}

export function applyRestoredPayload(
  currentState: MuzeanDatabaseState,
  payload: BackupPayload
): MuzeanDatabaseState {
  return {
    ...currentState,
    playlists: payload.playlists,
    playlistTracks: payload.playlistTracks,
    eqConfigs: payload.eqConfigs,
    dacProfiles: payload.dacProfiles,
    lyrics: payload.lyrics,
    playHistory: payload.playHistory,
    trackPlayCounts: payload.trackPlayCounts,
    settings: {
      ...currentState.settings,
      ...payload.settings,
      updatedAt: Date.now(),
    },
  };
}
