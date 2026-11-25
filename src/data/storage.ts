import type { MuzeanDatabaseState } from '../domain/types';
import { createSeedDatabaseState } from './seedLibrary';

const DB_STORAGE_KEY = 'muzean_local_db_v2';
const USER_DATA_KEY = 'muzean_user_data_v1';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): KeyValueStorage {
  return window.localStorage;
}

function trySet(storage: KeyValueStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export interface LoadDbResult {
  state: MuzeanDatabaseState;
  recoveryTriggered: boolean;
  corruptionDetected: boolean;
  recoveryMessage: string | null;
}

/**
 * Strips ephemeral browser objectUrls before persisting so reloads never hold dead Blob URIs.
 */
function sanitizeForPersistence(state: MuzeanDatabaseState): MuzeanDatabaseState {
  return {
    ...state,
    trackSources: state.trackSources.map((s) => {
      const { objectUrl: _omit, ...rest } = s;
      return rest;
    }),
  };
}

export function loadDatabaseState(storage: KeyValueStorage = defaultStorage()): LoadDbResult {
  try {
    const raw = storage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedDatabaseState();
      saveDatabaseState(seeded, storage);
      return {
        state: seeded,
        recoveryTriggered: false,
        corruptionDetected: false,
        recoveryMessage: null,
      };
    }

    const parsed = JSON.parse(raw) as Partial<MuzeanDatabaseState>;
    // Structural integrity check & safe auto-repair
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.tracks) ||
      !Array.isArray(parsed.trackSources) ||
      !parsed.settings
    ) {
      return {
        state: createSeedDatabaseState(),
        recoveryTriggered: true,
        corruptionDetected: true,
        recoveryMessage: 'Database structure invalid. You can restore from a ZIP backup or initialize a fresh database.',
      };
    }

    const fallback = createSeedDatabaseState();
    const repaired: MuzeanDatabaseState = {
      ...fallback,
      ...parsed,
      settings: { ...fallback.settings, ...parsed.settings },
      session: { ...fallback.session, ...(parsed.session ?? {}) },
      artworkCache: parsed.artworkCache ?? fallback.artworkCache,
    };

    // The small user-data record is written first on every save, so it is at least as new as the full snapshot.
    try {
      const rawUser = storage.getItem(USER_DATA_KEY);
      const user = rawUser ? (JSON.parse(rawUser) as Partial<MuzeanDatabaseState>) : null;
      if (user && Array.isArray(user.playlists) && Array.isArray(user.playlistTracks)) {
        repaired.playlists = user.playlists;
        repaired.playlistTracks = user.playlistTracks;
        if (user.settings) repaired.settings = { ...repaired.settings, ...user.settings };
      }
    } catch {
      // ignore a damaged user-data record; the main snapshot is still used
    }

    return {
      state: repaired,
      recoveryTriggered: false,
      corruptionDetected: false,
      recoveryMessage: null,
    };
  } catch {
    return {
      state: createSeedDatabaseState(),
      recoveryTriggered: true,
      corruptionDetected: true,
      recoveryMessage: 'Database JSON failed to parse safely. Restore from a ZIP backup or initialize a fresh database.',
    };
  }
}

export function saveDatabaseState(state: MuzeanDatabaseState, storage: KeyValueStorage = defaultStorage()): void {
  try {
    // Small, essential data first: playlists and settings must survive even when the full snapshot is too big
    // for localStorage (large scanned libraries with generated artwork).
    trySet(
      storage,
      USER_DATA_KEY,
      JSON.stringify({ playlists: state.playlists, playlistTracks: state.playlistTracks, settings: state.settings }),
    );
    const clean = sanitizeForPersistence(state);
    if (trySet(storage, DB_STORAGE_KEY, JSON.stringify(clean))) return;
    // Artwork cache is regenerable; drop it and retry.
    trySet(storage, DB_STORAGE_KEY, JSON.stringify({ ...clean, artworkCache: {} }));
  } catch {
    // Never crash playback because persistence failed
  }
}

export function resetDatabaseState(storage: KeyValueStorage = defaultStorage()): MuzeanDatabaseState {
  const fresh = createSeedDatabaseState();
  saveDatabaseState(fresh, storage);
  return fresh;
}
