import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDownUp,
  Info,
  ListPlus,
  Play,
  PlusSquare,
  Volume2,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { generateVaporwaveArtworkDataUri } from '../domain/artwork';
import { formatDurationMs } from '../domain/lyrics';
import type {
  ArtworkCacheEntry,
  DuplicateCandidate,
  Playlist,
  SortDirection,
  SortField,
  Track,
  TrackSource,
} from '../domain/types';
import { APPLE_SPRING, GlassButton, GlassPanel } from './GlassUI';

interface TracksViewProps {
  tracks: Track[];
  trackSources: TrackSource[];
  artworkCache: Record<string, ArtworkCacheEntry>;
  playlists: Playlist[];
  duplicateCandidates: DuplicateCandidate[];
  currentTrackId: string | null;
  isPlaying: boolean;
  searchQuery: string;
  onClearSearch: () => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, dir: SortDirection) => void;
  onPlayTrack: (trackId: string, orderedTrackIds: string[]) => void;
  onAddToQueue: (trackId: string) => void;
  onAddToPlaylist: (trackId: string, playlistId: string) => void;
  onOpenSongInfo: (trackId: string) => void;
  onResolveDuplicateCandidate: (candidateId: string, action: 'MERGE' | 'DISMISS') => void;
  labels: {
    sortBy: string;
    sortTitle: string;
    sortArtist: string;
    sortAlbum: string;
    sortDuration: string;
    sortDateAdded: string;
    addToPlaylist: string;
    addToQueue: string;
    songInfo: string;
    emptyTracks: string;
    duplicateCandidatesBanner: string;
    mergeTracks: string;
    keepSeparate: string;
    tracksCount: string;
  };
}

export function TracksView({
  tracks,
  trackSources,
  artworkCache,
  playlists,
  duplicateCandidates,
  currentTrackId,
  isPlaying,
  searchQuery,
  onClearSearch,
  sortField,
  sortDirection,
  onSortChange,
  onPlayTrack,
  onAddToQueue,
  onAddToPlaylist,
  onOpenSongInfo,
  onResolveDuplicateCandidate,
  labels,
}: TracksViewProps) {
  const [swipedTrackId, setSwipedTrackId] = useState<string | null>(null);
  const [playlistPickerTrackId, setPlaylistPickerTrackId] = useState<string | null>(null);
  const [showDupPanel, setShowDupPanel] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const pendingDuplicates = useMemo(
    () => duplicateCandidates.filter((c) => c.status === 'PENDING'),
    [duplicateCandidates]
  );

  const userPlaylists = useMemo(
    () => playlists.filter((p) => p.playlistType === 'USER'),
    [playlists]
  );

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? tracks.filter(
          (t) =>
            t.displayTitle.toLowerCase().includes(q) ||
            t.displayArtist.toLowerCase().includes(q) ||
            t.displayAlbum.toLowerCase().includes(q)
        )
      : tracks;

    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case 'title':
          return a.displayTitle.localeCompare(b.displayTitle) * dir;
        case 'artist':
          return a.displayArtist.localeCompare(b.displayArtist) * dir;
        case 'album':
          return a.displayAlbum.localeCompare(b.displayAlbum) * dir;
        case 'duration':
          return (a.durationMs - b.durationMs) * dir;
        case 'dateAdded':
        default:
          return (a.createdAt - b.createdAt) * dir;
      }
    });
  }, [tracks, searchQuery, sortField, sortDirection]);

  const orderedAvailableIds = useMemo(
    () => filteredAndSorted.filter((t) => t.availabilityStatus === 'AVAILABLE').map((t) => t.trackId),
    [filteredAndSorted]
  );

  const sourceCountByTrack = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of trackSources) {
      map.set(s.trackId, (map.get(s.trackId) ?? 0) + 1);
    }
    return map;
  }, [trackSources]);

  const tracksById = useMemo(() => new Map(tracks.map((t) => [t.trackId, t])), [tracks]);

  return (
    <div className="space-y-2.5 tracks-transparent-scope">
      {/* Compact Header Strip: Track count, optional active search filter, Sort */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-3">
          <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
            {filteredAndSorted.length} {labels.tracksCount}
          </span>
          {searchQuery.trim() && (
            <GlassButton
              type="button"
              tone="accent"
              onClick={onClearSearch}
              className="min-h-[32px] px-3 py-1 text-xs inline-flex items-center gap-1.5"
            >
              <span>Filter: &ldquo;{searchQuery.trim()}&rdquo;</span>
              <X className="w-3.5 h-3.5" />
            </GlassButton>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="track-sort-select" className="text-xs text-[var(--muzean-text-muted)] whitespace-nowrap hidden sm:inline">
            {labels.sortBy}:
          </label>
          <select
            id="track-sort-select"
            value={sortField}
            onChange={(e) => onSortChange(e.target.value as SortField, sortDirection)}
            className="min-h-[36px] px-3 py-1 glass-btn text-xs text-[var(--muzean-text)]"
          >
            <option value="title" className="bg-[var(--muzean-bg)]">{labels.sortTitle}</option>
            <option value="artist" className="bg-[var(--muzean-bg)]">{labels.sortArtist}</option>
            <option value="album" className="bg-[var(--muzean-bg)]">{labels.sortAlbum}</option>
            <option value="duration" className="bg-[var(--muzean-bg)]">{labels.sortDuration}</option>
            <option value="dateAdded" className="bg-[var(--muzean-bg)]">{labels.sortDateAdded}</option>
          </select>
          <GlassButton
            type="button"
            shape="circle"
            onClick={() => onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc')}
            aria-label={`Sort direction: ${sortDirection}`}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
          </GlassButton>
        </div>
      </div>

      {/* Pending Duplicate Candidates Confirmation Banner */}
      {pendingDuplicates.length > 0 && (
        <GlassPanel className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-amber-500/50">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              <strong className="font-mono-tabular">{pendingDuplicates.length}</strong>{' '}
              {labels.duplicateCandidatesBanner}
            </span>
          </div>
          <GlassButton
            type="button"
            onClick={() => setShowDupPanel((v) => !v)}
            className="min-h-[34px] px-3 py-1 text-xs font-medium whitespace-nowrap"
          >
            {showDupPanel ? 'Hide' : 'Review'}
          </GlassButton>
        </GlassPanel>
      )}

      {showDupPanel && pendingDuplicates.length > 0 && (
        <GlassPanel className="p-3 space-y-2">
          {pendingDuplicates.map((cand) => {
            const srcTrack = tracksById.get(cand.sourceTrackId);
            const tgtTrack = tracksById.get(cand.targetTrackId);
            if (!srcTrack || !tgtTrack) return null;
            return (
              <div
                key={cand.candidateId}
                className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 last:pb-0 border-b last:border-b-0 border-[var(--muzean-border)]"
              >
                <div className="space-y-0.5 text-xs">
                  <div className="font-outrun font-semibold text-sm">
                    {srcTrack.displayTitle} ↔ {tgtTrack.displayTitle}
                  </div>
                  <div className="text-[var(--muzean-text-muted)]">{cand.matchReason}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <GlassButton
                    type="button"
                    tone="accent"
                    onClick={() => onResolveDuplicateCandidate(cand.candidateId, 'MERGE')}
                    className="min-h-[36px] px-3 py-1 text-xs font-semibold whitespace-nowrap"
                  >
                    {labels.mergeTracks}
                  </GlassButton>
                  <GlassButton
                    type="button"
                    onClick={() => onResolveDuplicateCandidate(cand.candidateId, 'DISMISS')}
                    className="min-h-[36px] px-3 py-1 text-xs whitespace-nowrap"
                  >
                    {labels.keepSeparate}
                  </GlassButton>
                </div>
              </div>
            );
          })}
        </GlassPanel>
      )}

      {/* Dense 12-track-friendly Glass Track List with zoom-on-slide/hover */}
      {filteredAndSorted.length === 0 ? (
        <GlassPanel className="p-8 text-center text-sm text-[var(--muzean-text-muted)]">
          {labels.emptyTracks}
        </GlassPanel>
      ) : (
        <div className="space-y-1.5">
          {filteredAndSorted.map((track) => {
            const isCurrent = currentTrackId === track.trackId;
            const isCorrupt = track.availabilityStatus !== 'AVAILABLE';
            const artUri =
              (track.artworkCacheKey && artworkCache[track.artworkCacheKey]?.dataUri) ||
              generateVaporwaveArtworkDataUri(`ALBUM:${track.displayAlbum}:${track.displayArtist}`);
            const altCount = sourceCountByTrack.get(track.trackId) ?? 1;
            const isSwiped = swipedTrackId === track.trackId;

            return (
              <motion.div
                key={track.trackId}
                whileHover={{ scale: 1.012 }}
                transition={APPLE_SPRING}
                onTouchStart={(e) => {
                  touchStartXRef.current = e.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  if (touchStartXRef.current === null) return;
                  const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
                  const dx = endX - touchStartXRef.current;
                  if (dx < -48) setSwipedTrackId(track.trackId);
                  else if (dx > 40 && isSwiped) setSwipedTrackId(null);
                  touchStartXRef.current = null;
                }}
                data-active={isCurrent ? 'true' : undefined}
                className={`glass-inset flex items-center justify-between gap-2.5 px-3 py-1.5 transition-colors ${
                  isCurrent ? 'border-[var(--muzean-accent)] text-[var(--muzean-accent)]' : ''
                }`}
              >
                <button
                  type="button"
                  disabled={isCorrupt}
                  onClick={() => onPlayTrack(track.trackId, orderedAvailableIds)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left min-h-[40px] disabled:opacity-55"
                >
                  <div className="relative w-9 h-9 rounded-xl shrink-0 border border-[var(--muzean-border)] overflow-hidden">
                    <img
                      src={artUri}
                      alt={`${track.displayAlbum} artwork`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {isCurrent && (
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-[var(--muzean-accent)]">
                        {isPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-outrun text-sm font-semibold truncate leading-tight ${
                        isCurrent ? 'text-[var(--muzean-accent)]' : 'text-[var(--muzean-text)]'
                      }`}
                    >
                      {track.displayTitle}
                    </div>
                    <div className="text-[11px] text-[var(--muzean-text-muted)] truncate flex items-center gap-1.5 font-mono-tabular">
                      <span>{track.displayArtist}</span>
                      <span aria-hidden="true">·</span>
                      <span>{track.displayAlbum}</span>
                      {altCount > 1 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--muzean-accent-2)]">{altCount} src</span>
                        </>
                      )}
                      {isCorrupt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-rose-500 font-medium">{track.availabilityStatus}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-mono-tabular text-[11px] text-[var(--muzean-text-muted)] mr-1 hidden sm:inline">
                    {formatDurationMs(track.durationMs)}
                  </span>

                  <GlassButton
                    type="button"
                    shape="circle"
                    disabled={isCorrupt}
                    active={isSwiped}
                    onClick={() => setPlaylistPickerTrackId(track.trackId)}
                    aria-label={`${labels.addToPlaylist}: ${track.displayTitle}`}
                    title={labels.addToPlaylist}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <PlusSquare className="w-3.5 h-3.5" />
                  </GlassButton>

                  <GlassButton
                    type="button"
                    shape="circle"
                    disabled={isCorrupt}
                    tone={isSwiped ? 'teal' : 'default'}
                    onClick={() => onAddToQueue(track.trackId)}
                    aria-label={`${labels.addToQueue}: ${track.displayTitle}`}
                    title={labels.addToQueue}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                  </GlassButton>

                  <GlassButton
                    type="button"
                    shape="circle"
                    onClick={() => onOpenSongInfo(track.trackId)}
                    aria-label={`${labels.songInfo}: ${track.displayTitle}`}
                    title={labels.songInfo}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </GlassButton>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add to Playlist Modal */}
      {playlistPickerTrackId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={labels.addToPlaylist}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="glass-modal w-full max-w-sm overflow-hidden">
            <div className="glass-titlebar px-4 py-3 flex items-center justify-between text-sm font-semibold">
              <span className="font-neon-script text-xl leading-none pr-2">{labels.addToPlaylist}</span>
              <GlassButton
                type="button"
                shape="circle"
                onClick={() => setPlaylistPickerTrackId(null)}
                aria-label="Close"
                className="min-h-[34px] min-w-[34px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </GlassButton>
            </div>
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {userPlaylists.length === 0 ? (
                <p className="text-xs text-[var(--muzean-text-muted)] py-4 text-center">
                  No custom playlists yet.
                </p>
              ) : (
                userPlaylists.map((pl) => (
                  <GlassButton
                    key={pl.playlistId}
                    type="button"
                    shape="rounded"
                    onClick={() => {
                      onAddToPlaylist(playlistPickerTrackId, pl.playlistId);
                      setPlaylistPickerTrackId(null);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-left text-xs font-medium"
                  >
                    {pl.name}
                  </GlassButton>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
