import { motion } from 'motion/react';
import { ArrowLeft, Folder, LayoutGrid, List, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateVaporwaveArtworkDataUri } from '../domain/artwork';
import { formatDurationMs } from '../domain/lyrics';
import type { Album, Artist, ArtworkCacheEntry, Track, TrackSource } from '../domain/types';
import { APPLE_SPRING, GlassButton, GlassPanel } from './GlassUI';

interface AlbumsArtistsFoldersViewProps {
  mode: 'albums' | 'artists' | 'folders';
  tracks: Track[];
  trackSources: TrackSource[];
  albums: Album[];
  artists: Artist[];
  artworkCache: Record<string, ArtworkCacheEntry>;
  onPlayContext: (
    trackId: string,
    orderedTrackIds: string[],
    contextType: 'ALBUM' | 'ARTIST' | 'FOLDER',
    contextId: string
  ) => void;
  labels: {
    grid: string;
    list: string;
    tracksCount: string;
    playNow: string;
  };
}

export function AlbumsArtistsFoldersView({
  mode,
  tracks,
  trackSources,
  albums,
  artists,
  artworkCache,
  onPlayContext,
  labels,
}: AlbumsArtistsFoldersViewProps) {
  const [layoutMode, setLayoutMode] = useState<'GRID' | 'LIST'>('GRID');
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(null);
  const [selectedArtistKey, setSelectedArtistKey] = useState<string | null>(null);

  const albumGroups = useMemo(() => {
    const map = new Map<string, { album: Album; tracks: Track[] }>();
    for (const alb of albums) {
      map.set(alb.normalizedName, { album: alb, tracks: [] });
    }
    for (const trk of tracks) {
      const existing = map.get(trk.normalizedAlbum);
      if (existing) {
        existing.tracks.push(trk);
      } else {
        const key = trk.normalizedAlbum || 'unknown';
        map.set(key, {
          album: {
            albumId: `alb_${key}`,
            name: trk.displayAlbum,
            normalizedName: key,
            artistDisplay: trk.displayArtist,
            year: trk.year,
            artworkCacheKey: trk.artworkCacheKey ?? '',
            artworkOrigin: 'GENERATED_VAPORWAVE',
          },
          tracks: [trk],
        });
      }
    }
    for (const group of map.values()) {
      group.tracks.sort((a, b) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999));
    }
    return Array.from(map.values()).filter((g) => g.tracks.length > 0);
  }, [albums, tracks]);

  const artistGroups = useMemo(() => {
    const map = new Map<string, { artist: Artist; tracks: Track[] }>();
    for (const art of artists) {
      map.set(art.normalizedName, { artist: art, tracks: [] });
    }
    for (const trk of tracks) {
      const existing = map.get(trk.normalizedArtist);
      if (existing) {
        existing.tracks.push(trk);
      } else {
        const key = trk.normalizedArtist || 'unknown';
        map.set(key, {
          artist: {
            artistId: `art_${key}`,
            name: trk.displayArtist,
            normalizedName: key,
            artworkCacheKey: '',
            artworkOrigin: 'GENERATED_VAPORWAVE',
          },
          tracks: [trk],
        });
      }
    }
    return Array.from(map.values()).filter((g) => g.tracks.length > 0);
  }, [artists, tracks]);

  const folderGroups = useMemo(() => {
    const map = new Map<string, Track[]>();
    const tracksById = new Map(tracks.map((t) => [t.trackId, t]));
    const seenPerFolder = new Map<string, Set<string>>();

    for (const src of trackSources) {
      const trk = tracksById.get(src.trackId);
      if (!trk) continue;
      const folder = src.folderPath || 'Root';
      if (!map.has(folder)) {
        map.set(folder, []);
        seenPerFolder.set(folder, new Set());
      }
      const seen = seenPerFolder.get(folder)!;
      if (!seen.has(trk.trackId)) {
        seen.add(trk.trackId);
        map.get(folder)!.push(trk);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, trackSources]);

  if (mode === 'folders') {
    return (
      <div className="space-y-4">
        {folderGroups.map(([folderPath, folderTracks]) => {
          const playableIds = folderTracks
            .filter((t) => t.availabilityStatus === 'AVAILABLE')
            .map((t) => t.trackId);
          return (
            <GlassPanel key={folderPath} className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--muzean-border)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-4 h-4 text-[var(--muzean-accent-2)] shrink-0" />
                  <h3 className="font-outrun text-sm font-semibold truncate">{folderPath}</h3>
                </div>
                <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)] shrink-0">
                  {folderTracks.length} {labels.tracksCount}
                </span>
              </div>
              <div className="divide-y divide-[var(--muzean-border)]">
                {folderTracks.map((trk) => (
                  <motion.button
                    key={trk.trackId}
                    whileHover={{ scale: 1.01 }}
                    transition={APPLE_SPRING}
                    type="button"
                    disabled={trk.availabilityStatus !== 'AVAILABLE'}
                    onClick={() => onPlayContext(trk.trackId, playableIds, 'FOLDER', folderPath)}
                    className="w-full min-h-[44px] px-4 py-2 flex items-center justify-between gap-3 text-left disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="font-outrun text-sm font-semibold truncate">{trk.displayTitle}</div>
                      <div className="text-xs text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                        {trk.displayArtist} · {trk.displayAlbum}
                      </div>
                    </div>
                    <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)] shrink-0">
                      {formatDurationMs(trk.durationMs)}
                    </span>
                  </motion.button>
                ))}
              </div>
            </GlassPanel>
          );
        })}
      </div>
    );
  }

  if (mode === 'albums' && selectedAlbumKey) {
    const group = albumGroups.find((g) => g.album.normalizedName === selectedAlbumKey);
    if (group) {
      const playableIds = group.tracks
        .filter((t) => t.availabilityStatus === 'AVAILABLE')
        .map((t) => t.trackId);
      const artUri =
        artworkCache[group.album.artworkCacheKey]?.dataUri ||
        generateVaporwaveArtworkDataUri(`ALBUM:${group.album.name}:${group.album.artistDisplay}`);

      return (
        <div className="space-y-4">
          <GlassButton
            type="button"
            onClick={() => setSelectedAlbumKey(null)}
            className="min-h-[40px] px-3.5 py-1.5 inline-flex items-center gap-2 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </GlassButton>

          <GlassPanel className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <img
              src={artUri}
              alt={group.album.name}
              referrerPolicy="no-referrer"
              className="w-28 h-28 object-cover rounded-2xl border border-[var(--muzean-border)] shrink-0"
            />
            <div className="space-y-2 min-w-0 flex-1">
              <h2 className="font-neon-script text-2xl sm:text-3xl leading-snug pr-2 truncate">{group.album.name}</h2>
              <div className="text-xs text-[var(--muzean-text-muted)] font-mono-tabular">
                {group.album.artistDisplay} · {group.tracks.length} {labels.tracksCount}
              </div>
              {playableIds.length > 0 && (
                <GlassButton
                  type="button"
                  tone="accent"
                  onClick={() =>
                    onPlayContext(playableIds[0], playableIds, 'ALBUM', group.album.albumId)
                  }
                  className="min-h-[40px] px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{labels.playNow}</span>
                </GlassButton>
              )}
            </div>
          </GlassPanel>

          <GlassPanel className="divide-y divide-[var(--muzean-border)] overflow-hidden">
            {group.tracks.map((trk, idx) => (
              <motion.button
                key={trk.trackId}
                whileHover={{ scale: 1.01 }}
                transition={APPLE_SPRING}
                type="button"
                disabled={trk.availabilityStatus !== 'AVAILABLE'}
                onClick={() => onPlayContext(trk.trackId, playableIds, 'ALBUM', group.album.albumId)}
                className="w-full min-h-[44px] px-4 py-2 flex items-center justify-between gap-3 text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)] w-6">
                    {trk.trackNumber ?? idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-outrun text-sm font-semibold truncate">{trk.displayTitle}</div>
                    <div className="text-xs text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                      {trk.displayArtist}
                    </div>
                  </div>
                </div>
                <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
                  {formatDurationMs(trk.durationMs)}
                </span>
              </motion.button>
            ))}
          </GlassPanel>
        </div>
      );
    }
  }

  if (mode === 'artists' && selectedArtistKey) {
    const group = artistGroups.find((g) => g.artist.normalizedName === selectedArtistKey);
    if (group) {
      const playableIds = group.tracks
        .filter((t) => t.availabilityStatus === 'AVAILABLE')
        .map((t) => t.trackId);
      const artUri =
        artworkCache[group.artist.artworkCacheKey]?.dataUri ||
        generateVaporwaveArtworkDataUri(`ARTIST:${group.artist.name}`);

      return (
        <div className="space-y-4">
          <GlassButton
            type="button"
            onClick={() => setSelectedArtistKey(null)}
            className="min-h-[40px] px-3.5 py-1.5 inline-flex items-center gap-2 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </GlassButton>

          <GlassPanel className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <img
              src={artUri}
              alt={group.artist.name}
              referrerPolicy="no-referrer"
              className="w-28 h-28 object-cover rounded-2xl border border-[var(--muzean-border)] shrink-0"
            />
            <div className="space-y-2 min-w-0 flex-1">
              <h2 className="font-neon-script text-2xl sm:text-3xl leading-snug pr-2 truncate">{group.artist.name}</h2>
              <div className="text-xs text-[var(--muzean-text-muted)] font-mono-tabular">
                {group.tracks.length} {labels.tracksCount}
              </div>
              {playableIds.length > 0 && (
                <GlassButton
                  type="button"
                  tone="accent"
                  onClick={() =>
                    onPlayContext(playableIds[0], playableIds, 'ARTIST', group.artist.artistId)
                  }
                  className="min-h-[40px] px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{labels.playNow}</span>
                </GlassButton>
              )}
            </div>
          </GlassPanel>

          <GlassPanel className="divide-y divide-[var(--muzean-border)] overflow-hidden">
            {group.tracks.map((trk) => (
              <motion.button
                key={trk.trackId}
                whileHover={{ scale: 1.01 }}
                transition={APPLE_SPRING}
                type="button"
                disabled={trk.availabilityStatus !== 'AVAILABLE'}
                onClick={() =>
                  onPlayContext(trk.trackId, playableIds, 'ARTIST', group.artist.artistId)
                }
                className="w-full min-h-[44px] px-4 py-2 flex items-center justify-between gap-3 text-left disabled:opacity-50"
              >
                <div className="min-w-0">
                  <div className="font-outrun text-sm font-semibold truncate">{trk.displayTitle}</div>
                  <div className="text-xs text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                    {trk.displayAlbum}
                  </div>
                </div>
                <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
                  {formatDurationMs(trk.durationMs)}
                </span>
              </motion.button>
            ))}
          </GlassPanel>
        </div>
      );
    }
  }

  const items =
    mode === 'albums'
      ? albumGroups.map((g) => ({
          key: g.album.normalizedName,
          title: g.album.name,
          subtitle: `${g.album.artistDisplay} · ${g.tracks.length} ${labels.tracksCount}`,
          artUri:
            artworkCache[g.album.artworkCacheKey]?.dataUri ||
            generateVaporwaveArtworkDataUri(`ALBUM:${g.album.name}:${g.album.artistDisplay}`),
          onOpen: () => setSelectedAlbumKey(g.album.normalizedName),
        }))
      : artistGroups.map((g) => ({
          key: g.artist.normalizedName,
          title: g.artist.name,
          subtitle: `${g.tracks.length} ${labels.tracksCount}`,
          artUri:
            artworkCache[g.artist.artworkCacheKey]?.dataUri ||
            generateVaporwaveArtworkDataUri(`ARTIST:${g.artist.name}`),
          onOpen: () => setSelectedArtistKey(g.artist.normalizedName),
        }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1.5">
          <GlassButton
            type="button"
            active={layoutMode === 'GRID'}
            onClick={() => setLayoutMode('GRID')}
            aria-pressed={layoutMode === 'GRID'}
            className="min-h-[38px] px-3.5 py-1 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{labels.grid}</span>
          </GlassButton>
          <GlassButton
            type="button"
            active={layoutMode === 'LIST'}
            onClick={() => setLayoutMode('LIST')}
            aria-pressed={layoutMode === 'LIST'}
            className="min-h-[38px] px-3.5 py-1 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <List className="w-3.5 h-3.5" />
            <span>{labels.list}</span>
          </GlassButton>
        </div>
      </div>

      {layoutMode === 'GRID' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <motion.button
              key={item.key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={APPLE_SPRING}
              type="button"
              onClick={item.onOpen}
              className="glass-panel p-3 text-left flex flex-col gap-2.5"
            >
              <div className="aspect-square w-full rounded-xl border border-[var(--muzean-border)] overflow-hidden">
                <img
                  src={item.artUri}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="font-outrun text-sm font-semibold truncate">{item.title}</div>
                <div className="text-xs text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                  {item.subtitle}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <GlassPanel className="divide-y divide-[var(--muzean-border)] overflow-hidden">
          {items.map((item) => (
            <motion.button
              key={item.key}
              whileHover={{ scale: 1.012 }}
              transition={APPLE_SPRING}
              type="button"
              onClick={item.onOpen}
              className="w-full min-h-[56px] px-3 py-2 flex items-center gap-3 text-left"
            >
              <img
                src={item.artUri}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-xl object-cover border border-[var(--muzean-border)] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-outrun text-sm font-semibold truncate">{item.title}</div>
                <div className="text-xs text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                  {item.subtitle}
                </div>
              </div>
            </motion.button>
          ))}
        </GlassPanel>
      )}
    </div>
  );
}
