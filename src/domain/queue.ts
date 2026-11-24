import type { PlayHistory, PlaybackQueueItem, PlaylistTrack, RepeatMode } from './types';

export function buildQueueFromTracks(
  trackIds: string[],
  sourceContextType: PlaybackQueueItem['sourceContextType'],
  sourceContextId: string,
  shuffleEnabled: boolean,
  startTrackId?: string,
  recentHistory: PlayHistory[] = [],
  now = Date.now()
): { queue: PlaybackQueueItem[]; currentQueueItemId: string | null } {
  if (trackIds.length === 0) {
    return { queue: [], currentQueueItemId: null };
  }

  const items: PlaybackQueueItem[] = trackIds.map((trackId, index) => ({
    queueItemId: `qi_${index}_${trackId}_${now.toString(36)}`,
    trackId,
    position: index,
    sourceContextType,
    sourceContextId,
    addedAt: now,
    shuffleRank: index,
  }));

  const targetIndex = startTrackId
    ? Math.max(0, items.findIndex((i) => i.trackId === startTrackId))
    : 0;
  const currentItem = items[targetIndex] ?? items[0];

  if (!shuffleEnabled) {
    return { queue: items, currentQueueItemId: currentItem.queueItemId };
  }

  const shuffled = applySmartShuffleKeepingCurrent(items, currentItem.queueItemId, recentHistory, now);
  return { queue: shuffled, currentQueueItemId: currentItem.queueItemId };
}

/**
 * Smart Shuffle: keeps currentQueueItemId at its position (index 0 in playback sequence)
 * and shuffles only upcoming items, penalizing recently played tracks so they appear later.
 */
export function applySmartShuffleKeepingCurrent(
  queue: PlaybackQueueItem[],
  currentQueueItemId: string | null,
  recentHistory: PlayHistory[],
  seedNow = Date.now()
): PlaybackQueueItem[] {
  if (queue.length <= 1) return queue;

  const recentSet = new Set(
    recentHistory
      .slice(0, 12)
      .map((h) => h.trackId)
      .filter((id): id is string => Boolean(id))
  );

  const currentIdx = currentQueueItemId
    ? queue.findIndex((q) => q.queueItemId === currentQueueItemId)
    : 0;
  const safeCurrentIdx = currentIdx >= 0 ? currentIdx : 0;
  const current = queue[safeCurrentIdx];

  const others = queue.filter((_, idx) => idx !== safeCurrentIdx);

  // Deterministic-friendly weighted sort using Fisher-Yates + recency penalty
  const fresh: PlaybackQueueItem[] = [];
  const recent: PlaybackQueueItem[] = [];

  for (const item of others) {
    if (recentSet.has(item.trackId)) {
      recent.push(item);
    } else {
      fresh.push(item);
    }
  }

  shuffleArrayInPlace(fresh, seedNow);
  shuffleArrayInPlace(recent, seedNow + 1337);

  // Place fresh tracks first, recently played tracks toward the tail of upcoming queue
  const reordered = [current, ...fresh, ...recent].map((item, idx) => ({
    ...item,
    shuffleRank: idx,
  }));

  return reordered;
}

/**
 * Restores context order when Shuffle is turned OFF, keeping track of the current item.
 */
export function restoreContextOrderQueue(queue: PlaybackQueueItem[]): PlaybackQueueItem[] {
  return [...queue].sort((a, b) => a.position - b.position);
}

/**
 * Returns the next index with Repeat All semantics.
 */
export function getNextQueueIndex(currentIndex: number, queueLength: number): number {
  if (queueLength <= 0) return -1;
  if (currentIndex < 0) return 0;
  return (currentIndex + 1) % queueLength;
}

/**
 * Previous always moves to the previous track in the queue (wrapping under Repeat All).
 */
export function getPreviousQueueIndex(currentIndex: number, queueLength: number): number {
  if (queueLength <= 0) return -1;
  if (currentIndex <= 0) return queueLength - 1;
  return currentIndex - 1;
}

export function cycleRepeatMode(current: RepeatMode): RepeatMode {
  switch (current) {
    case 'REPEAT_ALL':
      return 'REPEAT_ONE';
    case 'REPEAT_ONE':
      return 'REPEAT_OFF';
    case 'REPEAT_OFF':
    default:
      return 'REPEAT_ALL';
  }
}

export function resolveNextTrackOnEnded(
  currentIndex: number,
  queueLength: number,
  repeatMode: RepeatMode
): number | null {
  if (queueLength <= 0) return null;
  if (repeatMode === 'REPEAT_ONE') {
    return currentIndex >= 0 && currentIndex < queueLength ? currentIndex : 0;
  }
  if (repeatMode === 'REPEAT_ALL') {
    return currentIndex < 0 ? 0 : (currentIndex + 1) % queueLength;
  }
  const next = currentIndex < 0 ? 0 : currentIndex + 1;
  return next < queueLength ? next : null;
}

export function reorderPlaylistTracks(
  items: PlaylistTrack[],
  playlistId: string,
  fromIndex: number,
  toIndex: number
): PlaylistTrack[] {
  const target = items
    .filter((i) => i.playlistId === playlistId)
    .sort((a, b) => a.position - b.position);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= target.length ||
    toIndex >= target.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const [moved] = target.splice(fromIndex, 1);
  target.splice(toIndex, 0, moved);

  const reindexed = target.map((item, idx) => ({ ...item, position: idx }));
  const others = items.filter((i) => i.playlistId !== playlistId);
  return [...others, ...reindexed];
}

function shuffleArrayInPlace<T>(arr: T[], seed: number): void {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  const nextRand = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
