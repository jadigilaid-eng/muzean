import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock,
  Edit3,
  GripVertical,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { resolvePlaylistCoverArts } from '../domain/artwork';
import { formatDurationMs } from '../domain/lyrics';
import type {
  ArtworkCacheEntry,
  PlayHistory,
  Playlist,
  PlaylistTrack,
  Track,
  TrackPlayCount,
} from '../domain/types';
import { APPLE_SPRING, GlassButton, GlassPanel } from './GlassUI';

interface PlaylistsViewProps {
  playlists: Playlist[];
  playlistTracks: PlaylistTrack[];
  tracks: Track[];
  playHistory: PlayHistory[];
  trackPlayCounts: TrackPlayCount[];
  artworkCache: Record<string, ArtworkCacheEntry>;
  onCreatePlaylist: (name: string) => void;
  onRenamePlaylist: (playlistId: string, newName: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  onReorderPlaylistTrack: (playlistId: string, fromIndex: number, toIndex: number) => void;
  onClearHistory: () => void;
  onPlayContext: (trackId: string, orderedTrackIds: string[], playlistId: string) => void;
  labels: {
    smartPlaylists: string;
    userPlaylists: string;
    createPlaylist: string;
    playlistNamePlaceholder: string;
    rename: string;
    delete: string;
    confirmDeletePlaylist: string;
    confirmClearHistory: string;
    cancel: string;
    confirm: string;
    save: string;
    tracksCount: string;
    playNow: string;
  };
}

export function PlaylistsView({
  playlists,
  playlistTracks,
  tracks,
  playHistory,
  trackPlayCounts,
  artworkCache,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onRemoveTrackFromPlaylist,
  onReorderPlaylistTrack,
  onClearHistory,
  onPlayContext,
  labels,
}: PlaylistsViewProps) {
  const [newName, setNewName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearHistoryConfirm, setClearHistoryConfirm] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const tracksById = useMemo(() => new Map(tracks.map((t) => [t.trackId, t])), [tracks]);

  const smartLists = useMemo(() => playlists.filter((p) => p.playlistType === 'SMART'), [playlists]);
  const userLists = useMemo(() => playlists.filter((p) => p.playlistType === 'USER'), [playlists]);

  const getTracksForPlaylist = (pl: Playlist): { track: Track; meta?: string }[] => {
    if (pl.smartType === 'RECENTLY_PLAYED') {
      const seen = new Set<string>();
      const out: { track: Track; meta?: string }[] = [];
      for (const h of [...playHistory].sort((a, b) => b.playedAt - a.playedAt)) {
        if (!h.trackId || seen.has(h.trackId)) continue;
        const trk = tracksById.get(h.trackId);
        if (!trk) continue;
        seen.add(h.trackId);
        out.push({ track: trk, meta: new Date(h.playedAt).toLocaleString() });
      }
      return out;
    }
    if (pl.smartType === 'MOST_PLAYED') {
      return [...trackPlayCounts]
        .sort((a, b) => b.playCount - a.playCount)
        .map((c) => {
          const trk = tracksById.get(c.trackId);
          return trk ? { track: trk, meta: `${c.playCount} plays` } : null;
        })
        .filter((x): x is { track: Track; meta: string } => x !== null);
    }
    if (pl.smartType === 'PLAY_HISTORY') {
      return [...playHistory]
        .sort((a, b) => b.playedAt - a.playedAt)
        .map((h) => {
          const trk = h.trackId ? tracksById.get(h.trackId) : undefined;
          return trk ? { track: trk, meta: new Date(h.playedAt).toLocaleString() } : null;
        })
        .filter((x): x is { track: Track; meta: string } => x !== null);
    }

    return playlistTracks
      .filter((pt) => pt.playlistId === pl.playlistId)
      .sort((a, b) => a.position - b.position)
      .map((pt) => {
        const trk = tracksById.get(pt.trackId);
        return trk ? { track: trk } : null;
      })
      .filter((x): x is { track: Track } => x !== null);
  };

  const selectedPlaylist = playlists.find((p) => p.playlistId === selectedPlaylistId) ?? null;

  if (selectedPlaylist) {
    const entries = getTracksForPlaylist(selectedPlaylist);
    const totalDuration = entries.reduce((sum, e) => sum + e.track.durationMs, 0);
    const playableIds = entries
      .filter((e) => e.track.availabilityStatus === 'AVAILABLE')
      .map((e) => e.track.trackId);
    const isUserPlaylist = selectedPlaylist.playlistType === 'USER';

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <GlassButton
            type="button"
            onClick={() => setSelectedPlaylistId(null)}
            className="min-h-[40px] px-3.5 py-1.5 inline-flex items-center gap-2 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </GlassButton>

          {selectedPlaylist.smartType === 'PLAY_HISTORY' && playHistory.length > 0 && (
            <GlassButton
              type="button"
              tone="danger"
              onClick={() => setClearHistoryConfirm(true)}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </GlassButton>
          )}
        </div>

        <GlassPanel className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-neon-script text-2xl sm:text-3xl leading-snug pr-2">{selectedPlaylist.name}</h2>
            <div className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
              {entries.length} {labels.tracksCount} · {formatDurationMs(totalDuration)}
            </div>
          </div>
          {playableIds.length > 0 && (
            <GlassButton
              type="button"
              tone="accent"
              onClick={() =>
                onPlayContext(playableIds[0], playableIds, selectedPlaylist.playlistId)
              }
              className="min-h-[42px] px-4 py-2 text-xs font-semibold inline-flex items-center gap-2 self-start"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{labels.playNow}</span>
            </GlassButton>
          )}
        </GlassPanel>

        {entries.length === 0 ? (
          <GlassPanel className="p-8 text-center text-sm text-[var(--muzean-text-muted)]">
            0 {labels.tracksCount}
          </GlassPanel>
        ) : (
          <GlassPanel className="divide-y divide-[var(--muzean-border)] overflow-hidden">
            {entries.map((entry, idx) => (
              <motion.div
                key={`${entry.track.trackId}_${idx}`}
                whileHover={{ scale: 1.01 }}
                transition={APPLE_SPRING}
                draggable={isUserPlaylist}
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => {
                  if (isUserPlaylist) e.preventDefault();
                }}
                onDrop={() => {
                  if (isUserPlaylist && dragIndex !== null && dragIndex !== idx) {
                    onReorderPlaylistTrack(selectedPlaylist.playlistId, dragIndex, idx);
                  }
                  setDragIndex(null);
                }}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isUserPlaylist && (
                    <GripVertical className="w-4 h-4 text-[var(--muzean-text-muted)] shrink-0 cursor-grab" />
                  )}
                  <button
                    type="button"
                    disabled={entry.track.availabilityStatus !== 'AVAILABLE'}
                    onClick={() =>
                      onPlayContext(entry.track.trackId, playableIds, selectedPlaylist.playlistId)
                    }
                    className="min-w-0 flex-1 min-h-[40px] text-left flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-outrun text-sm font-semibold truncate">{entry.track.displayTitle}</div>
                      <div className="text-xs text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                        {entry.track.displayArtist}
                        {entry.meta ? ` · ${entry.meta}` : ''}
                      </div>
                    </div>
                    <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)] shrink-0">
                      {formatDurationMs(entry.track.durationMs)}
                    </span>
                  </button>
                </div>

                {isUserPlaylist && (
                  <div className="flex items-center gap-1 shrink-0">
                    <GlassButton
                      type="button"
                      shape="circle"
                      disabled={idx === 0}
                      onClick={() =>
                        onReorderPlaylistTrack(selectedPlaylist.playlistId, idx, idx - 1)
                      }
                      aria-label={`Move ${entry.track.displayTitle} up`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </GlassButton>
                    <GlassButton
                      type="button"
                      shape="circle"
                      disabled={idx === entries.length - 1}
                      onClick={() =>
                        onReorderPlaylistTrack(selectedPlaylist.playlistId, idx, idx + 1)
                      }
                      aria-label={`Move ${entry.track.displayTitle} down`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </GlassButton>
                    <GlassButton
                      type="button"
                      shape="circle"
                      tone="danger"
                      onClick={() =>
                        onRemoveTrackFromPlaylist(selectedPlaylist.playlistId, entry.track.trackId)
                      }
                      aria-label={`Remove ${entry.track.displayTitle} from playlist`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </GlassButton>
                  </div>
                )}
              </motion.div>
            ))}
          </GlassPanel>
        )}

        {clearHistoryConfirm && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="glass-modal max-w-sm w-full p-5 space-y-4">
              <p className="text-sm">{labels.confirmClearHistory}</p>
              <div className="flex justify-end gap-2">
                <GlassButton
                  type="button"
                  onClick={() => setClearHistoryConfirm(false)}
                  className="min-h-[38px] px-3.5 py-1.5 text-xs"
                >
                  {labels.cancel}
                </GlassButton>
                <GlassButton
                  type="button"
                  tone="danger"
                  onClick={() => {
                    onClearHistory();
                    setClearHistoryConfirm(false);
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold"
                >
                  {labels.confirm}
                </GlassButton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = newName.trim();
            if (!trimmed) return;
            onCreatePlaylist(trimmed);
            setNewName('');
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={labels.playlistNamePlaceholder}
            aria-label={labels.playlistNamePlaceholder}
            className="flex-1 min-h-[42px] px-4 py-2 glass-btn text-xs text-[var(--muzean-text)] placeholder:text-[var(--muzean-text-muted)]"
          />
          <GlassButton
            type="submit"
            tone="accent"
            className="min-h-[42px] px-4 py-2 text-xs font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{labels.createPlaylist}</span>
          </GlassButton>
        </form>
      </GlassPanel>

      <section className="space-y-2.5">
        <h2 className="font-neon-script text-xl leading-tight text-[var(--muzean-text-muted)]">
          {labels.smartPlaylists}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {smartLists.map((pl) => {
            const entries = getTracksForPlaylist(pl);
            const totalDuration = entries.reduce((sum, e) => sum + e.track.durationMs, 0);
            return (
              <motion.button
                key={pl.playlistId}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={APPLE_SPRING}
                type="button"
                onClick={() => setSelectedPlaylistId(pl.playlistId)}
                className="glass-panel p-3 text-left flex items-center gap-3 min-h-[64px]"
              >
                <div className="w-10 h-10 rounded-full border border-[var(--muzean-border)] flex items-center justify-center text-[var(--muzean-accent-2)] shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-outrun text-sm font-semibold truncate">{pl.name}</div>
                  <div className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
                    {entries.length} {labels.tracksCount} · {formatDurationMs(totalDuration)}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="font-neon-script text-xl leading-tight text-[var(--muzean-text-muted)]">
          {labels.userPlaylists}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {userLists.map((pl) => {
            const entries = getTracksForPlaylist(pl);
            const totalDuration = entries.reduce((sum, e) => sum + e.track.durationMs, 0);
            const cover = resolvePlaylistCoverArts(
              pl.playlistId,
              pl.name,
              playlistTracks,
              tracksById,
              artworkCache
            );

            return (
              <GlassPanel key={pl.playlistId} interactiveZoom className="p-3.5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlaylistId(pl.playlistId)}
                  className="flex items-center gap-3 text-left"
                >
                  <div className="w-14 h-14 rounded-2xl shrink-0 border border-[var(--muzean-border)] overflow-hidden">
                    {cover.mode === 'COLLAGE' ? (
                      <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                        {cover.uris.map((u, i) => (
                          <img
                            key={i}
                            src={u}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <img
                        src={cover.uris[0]}
                        alt={pl.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-outrun text-sm font-semibold truncate">{pl.name}</div>
                    <div className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
                      {entries.length} {labels.tracksCount} · {formatDurationMs(totalDuration)}
                    </div>
                  </div>
                </button>

                {renamingId === pl.playlistId ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (renameValue.trim()) {
                        onRenamePlaylist(pl.playlistId, renameValue.trim());
                      }
                      setRenamingId(null);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 min-h-[36px] px-3 py-1 glass-btn text-xs"
                    />
                    <GlassButton
                      type="submit"
                      tone="accent"
                      className="min-h-[36px] px-3 text-xs font-semibold"
                    >
                      {labels.save}
                    </GlassButton>
                  </form>
                ) : (
                  <div className="flex items-center justify-end gap-2 border-t border-[var(--muzean-border)] pt-2.5">
                    <GlassButton
                      type="button"
                      onClick={() => {
                        setRenamingId(pl.playlistId);
                        setRenameValue(pl.name);
                      }}
                      aria-label={`${labels.rename} ${pl.name}`}
                      className="min-h-[36px] px-3 text-xs inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{labels.rename}</span>
                    </GlassButton>
                    <GlassButton
                      type="button"
                      tone="danger"
                      onClick={() => setDeleteConfirmId(pl.playlistId)}
                      aria-label={`${labels.delete} ${pl.name}`}
                      className="min-h-[36px] px-3 text-xs inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{labels.delete}</span>
                    </GlassButton>
                  </div>
                )}
              </GlassPanel>
            );
          })}
        </div>
      </section>

      {deleteConfirmId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-modal max-w-sm w-full p-5 space-y-4">
            <p className="text-sm">{labels.confirmDeletePlaylist}</p>
            <div className="flex justify-end gap-2">
              <GlassButton
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="min-h-[38px] px-3.5 py-1.5 text-xs"
              >
                {labels.cancel}
              </GlassButton>
              <GlassButton
                type="button"
                tone="danger"
                onClick={() => {
                  onDeletePlaylist(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold"
              >
                {labels.confirm}
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
