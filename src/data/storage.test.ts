import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDatabaseState, saveDatabaseState, type KeyValueStorage } from './storage';
import { createSeedDatabaseState } from './seedLibrary';
import { addTracksToPlaylist, buildUserPlaylist } from '../domain/playlists';

/** localStorage stand-in that rejects any single value larger than maxValueLength (like a full quota). */
function fakeStorage(maxValueLength: number): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (v.length > maxValueLength) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  };
}

function withPlaylist() {
  const base = createSeedDatabaseState();
  const pl = buildUserPlaylist('Baru', 123, 'x')!;
  const added = addTracksToPlaylist(base.playlistTracks, pl.playlistId, [base.tracks[0].trackId, base.tracks[1].trackId], 123);
  return { state: { ...base, playlists: [...base.playlists, pl], playlistTracks: added.items }, pl };
}

test('state round-trips through storage', () => {
  const st = fakeStorage(Infinity);
  const { state, pl } = withPlaylist();
  saveDatabaseState(state, st);
  const loaded = loadDatabaseState(st).state;
  assert.ok(loaded.playlists.some((p) => p.playlistId === pl.playlistId));
  assert.equal(loaded.playlistTracks.filter((t) => t.playlistId === pl.playlistId).length, 2);
});

test('a new playlist survives a restart even when the full snapshot does not fit the quota', () => {
  const { state, pl } = withPlaylist();
  const userLen = JSON.stringify({ playlists: state.playlists, playlistTracks: state.playlistTracks, settings: state.settings }).length;
  const st = fakeStorage(userLen + 50); // too small for any snapshot, big enough for the user data
  saveDatabaseState(state, st);
  assert.ok(!st.data.has('muzean_local_db_v2'), 'snapshot should not have fit');
  // First launch after the failed save has no snapshot: seed is used, but playlists must not be lost on a later run
  // where an older snapshot exists.
  const older = fakeStorage(Infinity);
  saveDatabaseState(createSeedDatabaseState(), older);
  older.data.set('muzean_user_data_v1', st.data.get('muzean_user_data_v1')!);
  const loaded = loadDatabaseState(older).state;
  assert.ok(loaded.playlists.some((p) => p.playlistId === pl.playlistId));
  assert.equal(loaded.playlistTracks.filter((t) => t.playlistId === pl.playlistId).length, 2);
});

test('when the snapshot is too big, it is retried without the artwork cache', () => {
  const { state } = withPlaylist();
  const withArt = {
    ...state,
    artworkCache: Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`k${i}`, { dataUri: 'x'.repeat(2000) } as never]),
    ),
  };
  const slim = JSON.stringify({ ...withArt, artworkCache: {} }).length;
  const st = fakeStorage(slim + 10);
  saveDatabaseState(withArt, st);
  const saved = JSON.parse(st.data.get('muzean_local_db_v2')!);
  assert.deepEqual(saved.artworkCache, {});
  assert.ok(saved.playlists.length > 0);
});

test('save never throws when storage rejects everything', () => {
  const st = fakeStorage(0);
  assert.doesNotThrow(() => saveDatabaseState(createSeedDatabaseState(), st));
});
