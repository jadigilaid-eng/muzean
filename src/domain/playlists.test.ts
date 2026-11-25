import assert from 'node:assert/strict';
import test from 'node:test';
import { addTracksToPlaylist, buildUserPlaylist } from './playlists';
import type { PlaylistTrack } from './types';

test('buildUserPlaylist trims the name and rejects blanks', () => {
  assert.equal(buildUserPlaylist('   ', 1), null);
  const pl = buildUserPlaylist('  Santai  ', 5, 'abc');
  assert.ok(pl);
  assert.equal(pl.name, 'Santai');
  assert.equal(pl.playlistType, 'USER');
  assert.equal(pl.playlistId, 'pl_5_abc');
});

test('two playlists created in the same millisecond get different ids', () => {
  const a = buildUserPlaylist('A', 10);
  const b = buildUserPlaylist('B', 10);
  assert.ok(a && b);
  assert.notEqual(a.playlistId, b.playlistId);
});

test('addTracksToPlaylist appends in order with consecutive positions', () => {
  const r = addTracksToPlaylist([], 'p1', ['a', 'b', 'c'], 100);
  assert.equal(r.added, 3);
  assert.deepEqual(r.items.map((i) => [i.trackId, i.position]), [['a', 0], ['b', 1], ['c', 2]]);
});

test('addTracksToPlaylist skips tracks already present and duplicates in the batch', () => {
  const start: PlaylistTrack[] = [{ playlistId: 'p1', trackId: 'a', position: 0, addedAt: 1 }];
  const r = addTracksToPlaylist(start, 'p1', ['a', 'b', 'b', 'c'], 2);
  assert.equal(r.added, 2);
  assert.deepEqual(r.items.filter((i) => i.playlistId === 'p1').map((i) => [i.trackId, i.position]), [['a', 0], ['b', 1], ['c', 2]]);
});

test('addTracksToPlaylist leaves other playlists alone and returns the same array when nothing is added', () => {
  const start: PlaylistTrack[] = [
    { playlistId: 'p1', trackId: 'a', position: 0, addedAt: 1 },
    { playlistId: 'p2', trackId: 'a', position: 0, addedAt: 1 },
  ];
  const r = addTracksToPlaylist(start, 'p2', ['a'], 3);
  assert.equal(r.added, 0);
  assert.equal(r.items, start);
  const r2 = addTracksToPlaylist(start, 'p2', ['z'], 3);
  assert.equal(r2.items.filter((i) => i.playlistId === 'p1').length, 1);
});
