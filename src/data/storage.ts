import type { MuzeanDatabaseState } from '../domain/types';
import { createSeedDatabaseState } from './seedLibrary';

const DB_STORAGE_KEY = 'muzean_local_db_v2';

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

export function loadDatabaseState(): LoadDbResult {
  try {
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedDatabaseState();
      saveDatabaseState(seeded);
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

export function saveDatabaseState(state: MuzeanDatabaseState): void {
  try {
    const clean = sanitizeForPersistence(state);
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Handle storage quota gracefully without crashing playback
  }
}

export function resetDatabaseState(): MuzeanDatabaseState {
  const fresh = createSeedDatabaseState();
  saveDatabaseState(fresh);
  return fresh;
}
