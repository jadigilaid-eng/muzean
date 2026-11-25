import type { Playlist, PlaylistTrack } from './types';

/** Builds a new USER playlist, or null when the name is blank. */
export function buildUserPlaylist(name: string, now: number, rand: string = Math.random().toString(36).slice(2, 7)): Playlist | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return {
    playlistId: `pl_${now}_${rand}`,
    name: trimmed,
    playlistType: 'USER',
    smartType: null,
    sortMode: 'dateAdded',
    artworkCacheKey: '',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Appends several tracks to a playlist in the given order. Tracks already in the playlist (and duplicates inside
 * trackIds) are skipped. Returns the new list plus how many were really added.
 */
export function addTracksToPlaylist(
  items: PlaylistTrack[],
  playlistId: string,
  trackIds: string[],
  now: number,
): { items: PlaylistTrack[]; added: number } {
  const existing = new Set(items.filter((i) => i.playlistId === playlistId).map((i) => i.trackId));
  let position = existing.size;
  const next = [...items];
  let added = 0;
  for (const trackId of trackIds) {
    if (existing.has(trackId)) continue;
    existing.add(trackId);
    next.push({ playlistId, trackId, position: position++, addedAt: now });
    added++;
  }
  return added === 0 ? { items, added: 0 } : { items: next, added };
}
