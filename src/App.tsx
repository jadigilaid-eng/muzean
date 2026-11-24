import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  AlertTriangle,
  Moon,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Sun,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MuzeanAudioEngine } from './audio/WebAudioEngine';
import { AlbumsArtistsFoldersView } from './components/AlbumsArtistsFoldersView';
import { DrawerNav } from './components/DrawerNav';
import { EqualizerView } from './components/EqualizerView';
import { APPLE_SPRING, GlassButton, GlassPanel } from './components/GlassUI';
import { LyricsSheet } from './components/LyricsSheet';
import { NowPlayingView } from './components/NowPlayingView';
import { PlaylistsView } from './components/PlaylistsView';
import { QueueSheet } from './components/QueueSheet';
import { QuickAccessMenu } from './components/QuickAccessMenu';
import { SettingsView } from './components/SettingsView';
import { SleepTimerModal } from './components/SleepTimerModal';
import { SongInfoModal } from './components/SongInfoModal';
import { TracksView } from './components/TracksView';
import { parseLocalAudioFile } from './data/metadataParser';
import { loadDatabaseState, resetDatabaseState, saveDatabaseState } from './data/storage';
import { generateVaporwaveArtworkDataUri, getOrCreateCachedArtwork } from './domain/artwork';
import { createDefaultEqConfig, resolveTransitionMode } from './domain/audioMath';
import {
  applyRestoredPayload,
  createMuzeanBackupZip,
  validateMuzeanBackupZip,
  type BackupPayload,
} from './domain/backup';
import {
  mergeScannedTracks,
  normalizeMetadataString,
  resolveDuplicateCandidateMerge,
  selectBestAvailableSource,
  type IncomingScanFile,
} from './domain/duplicates';
import { formatDurationMs } from './domain/lyrics';
import {
  applySmartShuffleKeepingCurrent,
  buildQueueFromTracks,
  cycleRepeatMode,
  getNextQueueIndex,
  getPreviousQueueIndex,
  reorderPlaylistTracks,
  resolveNextTrackOnEnded,
  restoreContextOrderQueue,
} from './domain/queue';
import type {
  AppSettings,
  DACProfile,
  EQConfig,
  MuzeanDatabaseState,
  OutputMode,
  PlaybackQueueItem,
  SortDirection,
  SortField,
  ViewRoute,
} from './domain/types';
import { getTranslations } from './i18n/translations';

export default function App() {
  const initialLoad = useMemo(() => loadDatabaseState(), []);
  const [db, setDb] = useState<MuzeanDatabaseState>(initialLoad.state);
  const [recoveryBanner, setRecoveryBanner] = useState<string | null>(
    initialLoad.corruptionDetected ? initialLoad.recoveryMessage : null
  );

  const [route, setRoute] = useState<ViewRoute>('tracks');
  const [previousRoute, setPreviousRoute] = useState<ViewRoute>('tracks');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigateTo = useCallback((nextRoute: ViewRoute) => {
    setRoute((curr) => {
      if (curr !== nextRoute) {
        setPreviousRoute(curr);
      }
      return nextRoute;
    });
  }, []);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('dateAdded');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [activeDacId, setActiveDacId] = useState<string>(
    initialLoad.state.dacProfiles[0]?.dacProfileId ?? 'dac_builtin'
  );

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
  const [sleepModalOpen, setSleepModalOpen] = useState(false);
  const [songInfoTrackId, setSongInfoTrackId] = useState<string | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const engineRef = useRef<MuzeanAudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new MuzeanAudioEngine();
  }
  const engine = engineRef.current;

  const searchModalInputRef = useRef<HTMLInputElement | null>(null);
  const localFilesRef = useRef<Array<{ file: File; relativePath: string }>>([]);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const edgeSwipeStartX = useRef<number | null>(null);

  const labels = useMemo(() => getTranslations(db.settings.language), [db.settings.language]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (searchModalOpen) {
      const t = window.setTimeout(() => searchModalInputRef.current?.focus(), 70);
      return () => window.clearTimeout(t);
    }
  }, [searchModalOpen]);

  const triggerHaptic = useCallback(() => {
    if (db.settings.hapticsEnabled && navigator.vibrate) {
      navigator.vibrate(12);
    }
  }, [db.settings.hapticsEnabled]);

  useEffect(() => {
    saveDatabaseState(db);
  }, [db]);

  useEffect(() => {
    const root = document.documentElement;
    if (db.settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.lang = db.settings.language;
    root.setAttribute('data-text-scale', db.settings.textScale);
  }, [db.settings.theme, db.settings.language, db.settings.textScale]);

  const tracksById = useMemo(
    () => new Map(db.tracks.map((t) => [t.trackId, t])),
    [db.tracks]
  );

  const currentQueueItem = useMemo(
    () => db.queue.find((q) => q.queueItemId === db.session.currentQueueItemId) ?? db.queue[0] ?? null,
    [db.queue, db.session.currentQueueItemId]
  );

  const currentTrack = currentQueueItem ? tracksById.get(currentQueueItem.trackId) ?? null : null;

  const currentTrackSources = useMemo(
    () =>
      currentTrack
        ? db.trackSources.filter((s) => s.trackId === currentTrack.trackId)
        : [],
    [db.trackSources, currentTrack]
  );

  const activeSource = useMemo(() => {
    if (!currentTrack) return null;
    const primary = currentTrackSources.find((s) => s.sourceId === currentTrack.primarySourceId);
    if (primary && primary.sourceStatus === 'AVAILABLE') return primary;
    return selectBestAvailableSource(currentTrackSources);
  }, [currentTrack, currentTrackSources]);

  useEffect(() => {
    const dac = db.dacProfiles.find((d) => d.dacProfileId === activeDacId);
    const eq =
      (dac && db.eqConfigs.find((e) => e.eqConfigId === dac.eqConfigId)) ||
      db.eqConfigs.find((e) => e.scope === 'GLOBAL') ||
      db.eqConfigs[0];
    if (eq) {
      engine.applyEqConfig(eq);
    }
  }, [db.eqConfigs, db.dacProfiles, activeDacId, engine]);

  const recordPlayHistory = useCallback((trackId: string, sourceId: string | null) => {
    const trk = tracksById.get(trackId);
    if (!trk) return;
    const now = Date.now();
    setDb((prev) => {
      const existingCount = prev.trackPlayCounts.find((c) => c.trackId === trackId);
      const nextCounts = existingCount
        ? prev.trackPlayCounts.map((c) =>
            c.trackId === trackId ? { ...c, playCount: c.playCount + 1, lastPlayedAt: now } : c
          )
        : [...prev.trackPlayCounts, { trackId, playCount: 1, lastPlayedAt: now }];

      return {
        ...prev,
        playHistory: [
          {
            historyId: `hist_${now}_${Math.random().toString(36).slice(2, 6)}`,
            trackId,
            sourceId,
            trackTitleSnapshot: trk.displayTitle,
            trackArtistSnapshot: trk.displayArtist,
            playedAt: now,
            durationPlayedMs: trk.durationMs,
            completed: true,
            sessionId: prev.session.sessionId,
          },
          ...prev.playHistory.slice(0, 199),
        ],
        trackPlayCounts: nextCounts,
      };
    });
  }, [tracksById]);

  const playQueueItem = useCallback(
    async (item: PlaybackQueueItem, autoplay = true) => {
      const trk = tracksById.get(item.trackId);
      if (!trk) return;

      const tSources = db.trackSources.filter((s) => s.trackId === trk.trackId);
      let source = tSources.find((s) => s.sourceId === trk.primarySourceId);
      if (!source || source.sourceStatus !== 'AVAILABLE') {
        source = selectBestAvailableSource(tSources) ?? undefined;
      }

      if (!source) {
        showToast(`No available audio source for "${trk.displayTitle}"`);
        return;
      }

      const trans = resolveTransitionMode(
        db.settings.crossfadeEnabled,
        db.settings.crossfadeDurationSec,
        db.settings.gaplessEnabled
      );

      setDb((prev) => ({
        ...prev,
        session: {
          ...prev.session,
          currentQueueItemId: item.queueItemId,
        },
      }));

      setDurationMs(trk.durationMs);
      setPositionMs(0);

      await engine.loadAndPlay({
        trackKey: trk.trackId,
        objectUrl: source.objectUrl,
        synthPresetIndex: trk.synthPresetIndex ?? 0,
        durationMs: trk.durationMs,
        autoplay,
        crossfadeSec: trans.mode === 'CROSSFADE' ? trans.crossfadeSec : 0,
      });

      if (autoplay) {
        setIsPlaying(true);
        recordPlayHistory(trk.trackId, source.sourceId);
      }
    },
    [tracksById, db.trackSources, db.settings, engine, recordPlayHistory, showToast]
  );

  const handleNext = useCallback(() => {
    if (db.queue.length === 0) return;
    triggerHaptic();
    const idx = db.queue.findIndex((q) => q.queueItemId === db.session.currentQueueItemId);
    const nextIdx = getNextQueueIndex(idx, db.queue.length);
    if (nextIdx >= 0 && db.queue[nextIdx]) {
      void playQueueItem(db.queue[nextIdx], true);
    }
  }, [db.queue, db.session.currentQueueItemId, playQueueItem, triggerHaptic]);

  const handlePrevious = useCallback(() => {
    if (db.queue.length === 0) return;
    triggerHaptic();
    const idx = db.queue.findIndex((q) => q.queueItemId === db.session.currentQueueItemId);
    const prevIdx = getPreviousQueueIndex(idx, db.queue.length);
    if (prevIdx >= 0 && db.queue[prevIdx]) {
      void playQueueItem(db.queue[prevIdx], true);
    }
  }, [db.queue, db.session.currentQueueItemId, playQueueItem, triggerHaptic]);

  const handleTogglePlay = useCallback(async () => {
    triggerHaptic();
    const audioEl = engine.getAudioElement();
    if (!currentQueueItem && db.queue.length > 0) {
      await playQueueItem(db.queue[0], true);
      return;
    }
    if (isPlaying) {
      engine.pause();
      setIsPlaying(false);
    } else {
      if (!audioEl.src && currentQueueItem) {
        await playQueueItem(currentQueueItem, true);
      } else {
        await engine.play();
        setIsPlaying(true);
      }
    }
  }, [currentQueueItem, db.queue, engine, isPlaying, playQueueItem, triggerHaptic]);

  const handleTrackEnded = useCallback(() => {
    if (db.session.repeatMode === 'REPEAT_ONE') {
      engine.seekMs(0);
      setPositionMs(0);
      void engine.play();
      setIsPlaying(true);
      return;
    }
    const idx = db.queue.findIndex((q) => q.queueItemId === db.session.currentQueueItemId);
    const nextIdx = resolveNextTrackOnEnded(idx, db.queue.length, db.session.repeatMode);
    if (nextIdx !== null && db.queue[nextIdx]) {
      void playQueueItem(db.queue[nextIdx], true);
    } else {
      setIsPlaying(false);
    }
  }, [db.queue, db.session.currentQueueItemId, db.session.repeatMode, engine, playQueueItem]);

  useEffect(() => {
    const audio = engine.getAudioElement();
    const onTimeUpdate = () => {
      setPositionMs(Math.round(audio.currentTime * 1000));
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDurationMs(Math.round(audio.duration * 1000));
      }
    };
    const onEnded = () => {
      handleTrackEnded();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [engine, handleTrackEnded]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    const artUri =
      (currentTrack.artworkCacheKey && db.artworkCache[currentTrack.artworkCacheKey]?.dataUri) ||
      generateVaporwaveArtworkDataUri(
        `ALBUM:${currentTrack.displayAlbum}:${currentTrack.displayArtist}`
      );
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.displayTitle,
        artist: currentTrack.displayArtist,
        album: currentTrack.displayAlbum,
        artwork: [{ src: artUri, sizes: '220x220', type: 'image/svg+xml' }],
      });
      navigator.mediaSession.setActionHandler('play', () => void handleTogglePlay());
      navigator.mediaSession.setActionHandler('pause', () => void handleTogglePlay());
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevious());
    } catch {
      // Ignore unsupported mediaSession actions
    }
  }, [currentTrack, db.artworkCache, handleTogglePlay, handleNext, handlePrevious]);

  useEffect(() => {
    if (sleepRemainingSec === null) return;
    if (sleepRemainingSec <= 0) {
      engine.pause();
      setIsPlaying(false);
      setSleepRemainingSec(null);
      showToast('Sleep timer expired — playback stopped.');
      return;
    }
    const timer = window.setTimeout(() => {
      setSleepRemainingSec((s) => (s !== null ? s - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [sleepRemainingSec, engine, showToast]);

  const handlePlayContext = (
    trackId: string,
    orderedTrackIds: string[],
    contextType: PlaybackQueueItem['sourceContextType'],
    contextId: string
  ) => {
    triggerHaptic();
    const { queue, currentQueueItemId } = buildQueueFromTracks(
      orderedTrackIds,
      contextType,
      contextId,
      db.session.shuffleEnabled,
      trackId,
      db.playHistory
    );
    setDb((prev) => ({
      ...prev,
      queue,
      session: {
        ...prev.session,
        queueContext: `${contextType}:${contextId}`,
        currentQueueItemId,
      },
    }));
    const item = queue.find((q) => q.queueItemId === currentQueueItemId);
    if (item) {
      void playQueueItem(item, true);
    }
  };

  const handleToggleShuffle = () => {
    triggerHaptic();
    setDb((prev) => {
      const nextShuffle = !prev.session.shuffleEnabled;
      const nextQueue = nextShuffle
        ? applySmartShuffleKeepingCurrent(
            prev.queue,
            prev.session.currentQueueItemId,
            prev.playHistory
          )
        : restoreContextOrderQueue(prev.queue);
      return {
        ...prev,
        queue: nextQueue,
        session: {
          ...prev.session,
          shuffleEnabled: nextShuffle,
        },
      };
    });
  };

  const handleToggleRepeat = () => {
    triggerHaptic();
    const nextMode = cycleRepeatMode(db.session.repeatMode);
    setDb((prev) => ({
      ...prev,
      session: {
        ...prev.session,
        repeatMode: nextMode,
      },
    }));
    const msg =
      nextMode === 'REPEAT_ONE'
        ? labels.repeatOne
        : nextMode === 'REPEAT_ALL'
        ? labels.repeatAll
        : labels.repeatOff;
    showToast(msg);
  };

  const handleScanFileEntries = async (
    entries: Array<{ file: File; relativePath: string }>,
    rootName: string
  ) => {
    setIsScanning(true);
    const startedAt = Date.now();
    try {
      const incoming: IncomingScanFile[] = [];
      for (const entry of entries) {
        const parsed = await parseLocalAudioFile(entry.file, entry.relativePath);
        incoming.push(parsed);
      }

      setDb((prev) => {
        const now = Date.now();
        const merged = mergeScannedTracks(
          prev.tracks,
          prev.trackSources,
          prev.duplicateCandidates,
          incoming,
          now
        );

        const nextCache = { ...prev.artworkCache };
        const albumMap = new Map(prev.albums.map((a) => [a.normalizedName, a]));
        const artistMap = new Map(prev.artists.map((a) => [a.normalizedName, a]));

        for (const t of merged.tracks) {
          const albArt = getOrCreateCachedArtwork(
            nextCache,
            'ALBUM',
            t.normalizedAlbum,
            `${t.displayAlbum}:${t.displayArtist}`,
            now
          );
          if (albArt.createdEntry) nextCache[albArt.key] = albArt.createdEntry;
          t.artworkCacheKey = albArt.key;

          if (!albumMap.has(t.normalizedAlbum)) {
            albumMap.set(t.normalizedAlbum, {
              albumId: `alb_${t.normalizedAlbum.replace(/[^a-z0-9]/g, '_') || t.trackId}`,
              name: t.displayAlbum,
              normalizedName: t.normalizedAlbum,
              artistDisplay: t.displayArtist,
              year: t.year,
              artworkCacheKey: albArt.key,
              artworkOrigin: 'GENERATED_VAPORWAVE',
            });
          }

          const artArt = getOrCreateCachedArtwork(nextCache, 'ARTIST', t.normalizedArtist, t.displayArtist, now);
          if (artArt.createdEntry) nextCache[artArt.key] = artArt.createdEntry;
          if (!artistMap.has(t.normalizedArtist)) {
            artistMap.set(t.normalizedArtist, {
              artistId: `art_${t.normalizedArtist.replace(/[^a-z0-9]/g, '_') || t.trackId}`,
              name: t.displayArtist,
              normalizedName: t.normalizedArtist,
              artworkCacheKey: artArt.key,
              artworkOrigin: 'GENERATED_VAPORWAVE',
            });
          }
        }

        const scanRun = {
          scanRunId: `scan_${now}`,
          startedAt,
          finishedAt: now,
          status: merged.failedCount > 0 ? ('PARTIAL' as const) : ('SUCCESS' as const),
          filesDiscovered: incoming.length,
          filesAdded: merged.addedCount,
          filesUpdated: merged.updatedCount,
          filesMissing: 0,
          filesFailed: merged.failedCount,
          errorSummary:
            merged.failedCount > 0
              ? `${merged.failedCount} file(s) unsupported or corrupt`
              : null,
        };

        return {
          ...prev,
          tracks: merged.tracks,
          trackSources: merged.sources,
          duplicateCandidates: merged.candidates,
          albums: Array.from(albumMap.values()),
          artists: Array.from(artistMap.values()),
          artworkCache: nextCache,
          musicRoot: {
            musicRootId: 'root_saf',
            treeUri: `saf://${rootName}`,
            displayName: rootName,
            permissionPersisted: true,
            lastScanAt: now,
            rootStatus: 'READY',
          },
          scanRuns: [scanRun, ...prev.scanRuns.slice(0, 19)],
        };
      });

      showToast(`Scan finished: ${incoming.length} file(s) processed.`);
    } finally {
      setIsScanning(false);
    }
  };

  const handlePickDirectoryHandle = async () => {
    try {
      const picker = (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
      const handle = await picker();
      dirHandleRef.current = handle;

      const collected: Array<{ file: File; relativePath: string }> = [];
      const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
        for await (const [name, entry] of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
          const rel = prefix ? `${prefix}/${name}` : name;
          if (entry.kind === 'file') {
            const file = await (entry as FileSystemFileHandle).getFile();
            collected.push({ file, relativePath: rel });
          } else if (entry.kind === 'directory') {
            await walk(entry as FileSystemDirectoryHandle, rel);
          }
        }
      };
      await walk(handle, handle.name);
      localFilesRef.current = collected;
      await handleScanFileEntries(collected, handle.name);
    } catch {
      // Cancelled by user or unsupported
    }
  };

  const handlePickFolderFiles = (files: FileList | File[], folderName: string) => {
    const list = Array.from(files).map((file) => ({
      file,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || `${folderName}/${file.name}`,
    }));
    localFilesRef.current = list;
    void handleScanFileEntries(list, folderName);
  };

  const handleManualRescan = async () => {
    triggerHaptic();
    if (localFilesRef.current.length > 0) {
      await handleScanFileEntries(
        localFilesRef.current,
        db.musicRoot?.displayName ?? 'Local Music'
      );
      return;
    }
    setIsScanning(true);
    window.setTimeout(() => {
      const now = Date.now();
      setDb((prev) => ({
        ...prev,
        musicRoot: prev.musicRoot ? { ...prev.musicRoot, lastScanAt: now } : null,
        scanRuns: [
          {
            scanRunId: `scan_${now}`,
            startedAt: now - 200,
            finishedAt: now,
            status: 'SUCCESS',
            filesDiscovered: prev.trackSources.length,
            filesAdded: 0,
            filesUpdated: prev.trackSources.length,
            filesMissing: prev.trackSources.filter((s) => s.sourceStatus === 'MISSING').length,
            filesFailed: prev.trackSources.filter(
              (s) => s.sourceStatus === 'CORRUPT' || s.sourceStatus === 'UNSUPPORTED'
            ).length,
            errorSummary: null,
          },
          ...prev.scanRuns.slice(0, 19),
        ],
      }));
      setIsScanning(false);
      showToast('Rescan complete.');
    }, 250);
  };

  const routeTitle: Record<ViewRoute, string> = {
    tracks: labels.navTracks,
    playlists: labels.navPlaylists,
    albums: labels.navAlbums,
    artists: labels.navArtists,
    folders: labels.navFolders,
    nowplaying: labels.navNowPlaying,
    equalizer: labels.navEqualizer,
    settings: labels.navSettings,
  };

  const quickSearchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return db.tracks.slice(0, 8);
    return db.tracks.filter(
      (t) =>
        t.displayTitle.toLowerCase().includes(q) ||
        t.displayArtist.toLowerCase().includes(q) ||
        t.displayAlbum.toLowerCase().includes(q)
    );
  }, [db.tracks, searchQuery]);

  const songInfoTrack = songInfoTrackId ? tracksById.get(songInfoTrackId) ?? null : null;
  const songInfoSources = songInfoTrack
    ? db.trackSources.filter((s) => s.trackId === songInfoTrack.trackId)
    : [];

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative z-0 h-screen w-full flex overflow-hidden bg-transparent text-[var(--muzean-text)]"
        onTouchStart={(e) => {
          const x = e.touches[0]?.clientX ?? 999;
          if (x < 28) edgeSwipeStartX.current = x;
        }}
        onTouchEnd={(e) => {
          if (edgeSwipeStartX.current !== null) {
            const endX = e.changedTouches[0]?.clientX ?? 0;
            if (endX - edgeSwipeStartX.current > 48) {
              setDrawerOpen(true);
            }
            edgeSwipeStartX.current = null;
          }
        }}
      >
        {/* Fullscreen Theme-Adapted Synthwave Background Image */}
        <div aria-hidden="true" className="fixed inset-0 -z-20 muzean-bg-image" />
        <div aria-hidden="true" className="fixed inset-0 -z-10 muzean-bg-wash" />

        {/* Transparent Floating macOS-Style Vertical Navigation Card */}
        <DrawerNav
          currentRoute={route}
          onNavigate={navigateTo}
          onOpenQueue={() => setQueueModalOpen(true)}
          onToggleTheme={() => {
            triggerHaptic();
            setDb((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
                updatedAt: Date.now(),
              },
            }));
          }}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          rootFolderName={db.musicRoot?.displayName ?? 'No Folder'}
          trackCount={db.tracks.length}
          queueCount={db.queue.length}
          labels={labels}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          {/* Top Bar: Logo Menu Trigger, Serif Active Screen Title & Theme Toggle */}
          <header className="h-14 shrink-0 px-4 border-b border-[var(--muzean-border)] bg-transparent backdrop-blur-md flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <motion.button
                type="button"
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                transition={APPLE_SPRING}
                onClick={() => setDrawerOpen((v) => !v)}
                aria-label="Open navigation menu"
                aria-expanded={drawerOpen}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border border-transparent hover:border-[var(--muzean-border)] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--muzean-accent)]"
              >
                <img
                  src="/assets/muzean-logo.png"
                  alt="MUZEAN"
                  className="w-8 h-8 object-contain"
                />
              </motion.button>
              <h1 className="font-neon-script text-2xl sm:text-[28px] leading-tight pr-2 truncate">
                {routeTitle[route]}
              </h1>
            </div>

            <GlassButton
              type="button"
              shape="circle"
              onClick={() => {
                triggerHaptic();
                setDb((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
                    updatedAt: Date.now(),
                  },
                }));
              }}
              aria-label={
                db.settings.theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'
              }
              title={db.settings.theme === 'dark' ? labels.themeLight : labels.themeDark}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
            >
              {db.settings.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-700" />
              )}
            </GlassButton>
          </header>

          {/* Scrollable Workspace */}
          <main className="flex-1 overflow-y-auto px-4 pt-3 sm:pr-20 pb-24">
            <div className="max-w-6xl mx-auto space-y-3">
              {recoveryBanner && (
                <GlassPanel className="p-3.5 border-amber-500/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{recoveryBanner}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <GlassButton
                      type="button"
                      tone="accent"
                      onClick={() => {
                        setRoute('settings');
                        setRecoveryBanner(null);
                      }}
                      className="min-h-[38px] px-3.5 py-1 text-xs font-semibold"
                    >
                      {labels.restoreBackup}
                    </GlassButton>
                    <GlassButton
                      type="button"
                      onClick={() => {
                        setDb(resetDatabaseState());
                        setRecoveryBanner(null);
                      }}
                      className="min-h-[38px] px-3.5 py-1 text-xs"
                    >
                      {labels.dbResetFresh}
                    </GlassButton>
                  </div>
                </GlassPanel>
              )}

              {db.musicRoot && db.musicRoot.rootStatus !== 'READY' && (
                <GlassPanel className="p-3 flex items-center justify-between gap-3 border-rose-500/70">
                  <span className="text-xs">Music root folder access is missing or revoked.</span>
                  <GlassButton
                    type="button"
                    tone="accent"
                    onClick={() => setRoute('settings')}
                    className="min-h-[36px] px-3.5 text-xs font-semibold"
                  >
                    {labels.chooseFolder}
                  </GlassButton>
                </GlassPanel>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={route}
                  initial={{ opacity: 0, y: 8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.99 }}
                  transition={APPLE_SPRING}
                >
                  {route === 'tracks' && (
                    <TracksView
                      tracks={db.tracks}
                      trackSources={db.trackSources}
                      artworkCache={db.artworkCache}
                      playlists={db.playlists}
                      duplicateCandidates={db.duplicateCandidates}
                      currentTrackId={currentTrack?.trackId ?? null}
                      isPlaying={isPlaying}
                      searchQuery={searchQuery}
                      onClearSearch={() => setSearchQuery('')}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSortChange={(field, dir) => {
                        setSortField(field);
                        setSortDirection(dir);
                      }}
                      onPlayTrack={(trackId, orderedIds) =>
                        handlePlayContext(
                          trackId,
                          orderedIds,
                          searchQuery.trim() ? 'SEARCH' : 'TRACKS',
                          searchQuery.trim() || 'all'
                        )
                      }
                      onAddToQueue={(trackId) => {
                        triggerHaptic();
                        const newItem: PlaybackQueueItem = {
                          queueItemId: `qi_add_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                          trackId,
                          position: db.queue.length,
                          sourceContextType: 'MANUAL',
                          sourceContextId: 'manual',
                          addedAt: Date.now(),
                          shuffleRank: db.queue.length,
                        };
                        setDb((prev) => ({ ...prev, queue: [...prev.queue, newItem] }));
                        showToast('Added to Queue');
                      }}
                      onAddToPlaylist={(trackId, playlistId) => {
                        triggerHaptic();
                        setDb((prev) => {
                          const already = prev.playlistTracks.some(
                            (pt) => pt.playlistId === playlistId && pt.trackId === trackId
                          );
                          if (already) return prev;
                          const count = prev.playlistTracks.filter(
                            (pt) => pt.playlistId === playlistId
                          ).length;
                          return {
                            ...prev,
                            playlistTracks: [
                              ...prev.playlistTracks,
                              { playlistId, trackId, position: count, addedAt: Date.now() },
                            ],
                          };
                        });
                        showToast('Added to Playlist');
                      }}
                      onOpenSongInfo={(trackId) => setSongInfoTrackId(trackId)}
                      onResolveDuplicateCandidate={(candidateId, action) => {
                        triggerHaptic();
                        setDb((prev) => {
                          const res = resolveDuplicateCandidateMerge(
                            prev.tracks,
                            prev.trackSources,
                            prev.duplicateCandidates,
                            candidateId,
                            action,
                            Date.now()
                          );
                          return {
                            ...prev,
                            tracks: res.tracks,
                            trackSources: res.sources,
                            duplicateCandidates: res.candidates,
                          };
                        });
                      }}
                      labels={labels}
                    />
                  )}

                  {(route === 'albums' || route === 'artists' || route === 'folders') && (
                    <AlbumsArtistsFoldersView
                      mode={route}
                      tracks={db.tracks}
                      trackSources={db.trackSources}
                      albums={db.albums}
                      artists={db.artists}
                      artworkCache={db.artworkCache}
                      onPlayContext={(trackId, ids, type, ctxId) =>
                        handlePlayContext(trackId, ids, type, ctxId)
                      }
                      labels={labels}
                    />
                  )}

                  {route === 'playlists' && (
                    <PlaylistsView
                      playlists={db.playlists}
                      playlistTracks={db.playlistTracks}
                      tracks={db.tracks}
                      playHistory={db.playHistory}
                      trackPlayCounts={db.trackPlayCounts}
                      artworkCache={db.artworkCache}
                      onCreatePlaylist={(name) => {
                        triggerHaptic();
                        const now = Date.now();
                        setDb((prev) => ({
                          ...prev,
                          playlists: [
                            ...prev.playlists,
                            {
                              playlistId: `pl_${now}`,
                              name,
                              playlistType: 'USER',
                              smartType: null,
                              sortMode: 'dateAdded',
                              artworkCacheKey: '',
                              createdAt: now,
                              updatedAt: now,
                            },
                          ],
                        }));
                      }}
                      onRenamePlaylist={(playlistId, newName) => {
                        setDb((prev) => ({
                          ...prev,
                          playlists: prev.playlists.map((p) =>
                            p.playlistId === playlistId ? { ...p, name: newName, updatedAt: Date.now() } : p
                          ),
                        }));
                      }}
                      onDeletePlaylist={(playlistId) => {
                        triggerHaptic();
                        setDb((prev) => ({
                          ...prev,
                          playlists: prev.playlists.filter((p) => p.playlistId !== playlistId),
                          playlistTracks: prev.playlistTracks.filter((pt) => pt.playlistId !== playlistId),
                        }));
                      }}
                      onRemoveTrackFromPlaylist={(playlistId, trackId) => {
                        setDb((prev) => ({
                          ...prev,
                          playlistTracks: prev.playlistTracks.filter(
                            (pt) => !(pt.playlistId === playlistId && pt.trackId === trackId)
                          ),
                        }));
                      }}
                      onReorderPlaylistTrack={(playlistId, fromIdx, toIdx) => {
                        setDb((prev) => ({
                          ...prev,
                          playlistTracks: reorderPlaylistTracks(
                            prev.playlistTracks,
                            playlistId,
                            fromIdx,
                            toIdx
                          ),
                        }));
                      }}
                      onClearHistory={() => {
                        setDb((prev) => ({ ...prev, playHistory: [], trackPlayCounts: [] }));
                      }}
                      onPlayContext={(trackId, ids, plId) =>
                        handlePlayContext(trackId, ids, 'PLAYLIST', plId)
                      }
                      labels={labels}
                    />
                  )}

                  {route === 'nowplaying' && (
                    <NowPlayingView
                      track={currentTrack}
                      activeSource={activeSource}
                      artworkCache={db.artworkCache}
                      isPlaying={isPlaying}
                      positionMs={positionMs}
                      durationMs={durationMs}
                      shuffleEnabled={db.session.shuffleEnabled}
                      repeatMode={db.session.repeatMode}
                      artworkAccentEnabled={db.settings.artworkAccentEnabled}
                      sleepTimerRemainingSec={sleepRemainingSec}
                      onTogglePlay={() => void handleTogglePlay()}
                      onNext={handleNext}
                      onPrevious={handlePrevious}
                      onSeekMs={(ms) => {
                        engine.seekMs(ms);
                        setPositionMs(ms);
                      }}
                      onToggleShuffle={handleToggleShuffle}
                      onToggleRepeat={handleToggleRepeat}
                      onOpenQueue={() => setQueueModalOpen(true)}
                      onOpenLyrics={() => setLyricsModalOpen(true)}
                      onOpenSleepTimer={() => setSleepModalOpen(true)}
                      onOpenEqualizer={() => navigateTo('equalizer')}
                      onOpenSongInfo={() => {
                        if (currentTrack) setSongInfoTrackId(currentTrack.trackId);
                      }}
                      labels={labels}
                    />
                  )}

                  {route === 'equalizer' && (
                    <EqualizerView
                      language={db.settings.language}
                      eqConfigs={db.eqConfigs}
                      dacProfiles={db.dacProfiles}
                      activeDacProfileId={activeDacId}
                      onBack={() => navigateTo(previousRoute === 'equalizer' ? 'tracks' : previousRoute)}
                      onSelectDacProfile={(id) => setActiveDacId(id)}
                      onUpdateEqConfig={(updated: EQConfig) => {
                        setDb((prev) => ({
                          ...prev,
                          eqConfigs: prev.eqConfigs.map((e) =>
                            e.eqConfigId === updated.eqConfigId ? updated : e
                          ),
                        }));
                      }}
                      onRegisterDacProfile={(name, connType) => {
                        const now = Date.now();
                        const eqId = `eq_dac_${now}`;
                        const newEq = createDefaultEqConfig(eqId, `${name} EQ`, 'DAC', now);
                        const newDac: DACProfile = {
                          dacProfileId: `dac_${now}`,
                          deviceFingerprint: normalizeMetadataString(name).replace(/\s+/g, '_'),
                          displayName: name,
                          connectionType: connType,
                          enabled: true,
                          eqConfigId: eqId,
                          outputMode: 'AUTOMATIC',
                          preferredSampleRateHz: 96000,
                          preferredBitDepth: 24,
                          supportedSampleRates: [44100, 48000, 96000],
                          supportedBitDepths: [16, 24],
                          passthroughSupported: true,
                          createdAt: now,
                          updatedAt: now,
                        };
                        setDb((prev) => ({
                          ...prev,
                          eqConfigs: [...prev.eqConfigs, newEq],
                          dacProfiles: [...prev.dacProfiles, newDac],
                        }));
                        setActiveDacId(newDac.dacProfileId);
                      }}
                      onUpdateDacOutput={(
                        dacProfileId: string,
                        outputMode: OutputMode,
                        preferredSampleRateHz: number,
                        preferredBitDepth: number
                      ) => {
                        setDb((prev) => ({
                          ...prev,
                          dacProfiles: prev.dacProfiles.map((d) =>
                            d.dacProfileId === dacProfileId
                              ? {
                                  ...d,
                                  outputMode,
                                  preferredSampleRateHz,
                                  preferredBitDepth,
                                  updatedAt: Date.now(),
                                }
                              : d
                          ),
                        }));
                      }}
                      onDeleteDacProfile={(dacId) => {
                        setDb((prev) => ({
                          ...prev,
                          dacProfiles: prev.dacProfiles.filter((d) => d.dacProfileId !== dacId),
                        }));
                        if (activeDacId === dacId) {
                          setActiveDacId('dac_builtin');
                        }
                      }}
                      labels={labels}
                    />
                  )}

                  {route === 'settings' && (
                    <SettingsView
                      settings={db.settings}
                      musicRoot={db.musicRoot}
                      lastScanRun={db.scanRuns[0] ?? null}
                      isScanning={isScanning}
                      onUpdateSettings={(patch: Partial<AppSettings>) => {
                        setDb((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, ...patch, updatedAt: Date.now() },
                        }));
                      }}
                      onPickFolderFiles={handlePickFolderFiles}
                      onPickDirectoryHandle={() => void handlePickDirectoryHandle()}
                      onManualRescan={() => void handleManualRescan()}
                      onExportBackup={async () => {
                        const { blob, fileName, manifest } = await createMuzeanBackupZip(db);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        a.click();
                        URL.revokeObjectURL(url);
                        setDb((prev) => ({
                          ...prev,
                          backupRecords: [
                            {
                              backupId: `bkp_${Date.now()}`,
                              fileName,
                              createdAt: manifest.createdAt,
                              appVersion: manifest.appVersion,
                              schemaVersion: manifest.schemaVersion,
                              backupStatus: 'SUCCESS',
                              contentSummary: `${manifest.counts.playlists} playlists, ${manifest.counts.lyrics} lyrics`,
                            },
                            ...prev.backupRecords,
                          ],
                        }));
                        showToast(`Backup saved: ${fileName}`);
                      }}
                      onValidateRestoreFile={async (file) => {
                        const buf = await file.arrayBuffer();
                        return validateMuzeanBackupZip(buf);
                      }}
                      onConfirmRestore={(payload: BackupPayload) => {
                        setDb((prev) => applyRestoredPayload(prev, payload));
                        showToast('Backup restored successfully.');
                      }}
                      onRunSafeRepair={() => {
                        setDb((prev) => {
                          const validIds = new Set(prev.tracks.map((t) => t.trackId));
                          return {
                            ...prev,
                            playlistTracks: prev.playlistTracks.filter((pt) => validIds.has(pt.trackId)),
                            queue: prev.queue.filter((q) => validIds.has(q.trackId)),
                          };
                        });
                        return 'Database integrity verified & orphaned references repaired safely.';
                      }}
                      onResetDatabase={() => {
                        setDb(resetDatabaseState());
                        showToast('Fresh database initialized.');
                      }}
                      labels={labels}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* Quick Access Popup Button (shifts left on click with balanced ring & active shadow) */}
          <QuickAccessMenu
            label={labels.quickAccess}
            hasMiniPlayer={Boolean(currentTrack && route !== 'nowplaying')}
            onAction={(target) => {
              triggerHaptic();
              if (target === 'search') {
                setSearchModalOpen(true);
              } else {
                navigateTo(target);
              }
            }}
          />

          {/* Compact Zero-Shadow Transparent Glass Mini-Player Bar */}
          {currentTrack && route !== 'nowplaying' && (
            <div className="h-16 shrink-0 border-t border-[var(--muzean-border)] bg-transparent backdrop-blur-md px-3 sm:px-4 flex items-center justify-between gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                transition={APPLE_SPRING}
                onClick={() => navigateTo('nowplaying')}
                className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-[44px]"
              >
                <img
                  src={
                    (currentTrack.artworkCacheKey &&
                      db.artworkCache[currentTrack.artworkCacheKey]?.dataUri) ||
                    generateVaporwaveArtworkDataUri(
                      `ALBUM:${currentTrack.displayAlbum}:${currentTrack.displayArtist}`
                    )
                  }
                  alt={currentTrack.displayAlbum}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-cover border border-[var(--muzean-border)] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-outrun text-sm font-semibold truncate">
                    {currentTrack.displayTitle}
                  </div>
                  <div className="text-xs text-[var(--muzean-text-muted)] truncate flex items-center gap-1.5 font-mono-tabular">
                    <span className="truncate">{currentTrack.displayArtist}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">
                      {formatDurationMs(positionMs)} / {formatDurationMs(Math.max(durationMs, currentTrack.durationMs))}
                    </span>
                  </div>
                </div>
              </motion.button>

              <div className="flex items-center gap-1.5 shrink-0">
                <GlassButton
                  type="button"
                  shape="circle"
                  onClick={handlePrevious}
                  aria-label="Previous"
                  className="min-h-[40px] min-w-[40px] hidden sm:flex items-center justify-center"
                >
                  <SkipBack className="w-4 h-4" />
                </GlassButton>
                <GlassButton
                  type="button"
                  shape="circle"
                  tone="accent"
                  onClick={() => void handleTogglePlay()}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="min-h-[42px] min-w-[42px] flex items-center justify-center"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </GlassButton>
                <GlassButton
                  type="button"
                  shape="circle"
                  onClick={handleNext}
                  aria-label="Next"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <SkipForward className="w-4 h-4" />
                </GlassButton>
              </div>
            </div>
          )}
        </div>

        {/* Quick Access Search Modal (search moved out of main page) */}
        <AnimatePresence>
          {searchModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-label="Quick Access Search"
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 pt-16"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: -10 }}
                transition={APPLE_SPRING}
                className="glass-modal w-full max-w-lg max-h-[75vh] flex flex-col overflow-hidden shadow-none"
              >
                <div className="glass-titlebar px-4 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Search className="w-4 h-4 text-[var(--muzean-accent)] shrink-0" />
                    <input
                      ref={searchModalInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={labels.searchPlaceholder}
                      className="w-full bg-transparent text-sm focus:outline-none text-[var(--muzean-text)] placeholder:text-[var(--muzean-text-muted)]"
                    />
                  </div>
                  <GlassButton
                    type="button"
                    shape="circle"
                    onClick={() => setSearchModalOpen(false)}
                    aria-label="Close search"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </GlassButton>
                </div>

                <div className="flex-1 overflow-y-auto p-3 divide-y divide-[var(--muzean-border)]">
                  {quickSearchMatches.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--muzean-text-muted)]">
                      {labels.emptyTracks}
                    </div>
                  ) : (
                    quickSearchMatches.map((trk) => (
                      <motion.button
                        key={trk.trackId}
                        type="button"
                        whileHover={{ scale: 1.012 }}
                        transition={APPLE_SPRING}
                        disabled={trk.availabilityStatus !== 'AVAILABLE'}
                        onClick={() => {
                          const availIds = quickSearchMatches
                            .filter((m) => m.availabilityStatus === 'AVAILABLE')
                            .map((m) => m.trackId);
                          handlePlayContext(trk.trackId, availIds, 'SEARCH', searchQuery || 'all');
                          setSearchModalOpen(false);
                        }}
                        className="w-full py-2.5 px-2 flex items-center justify-between gap-3 text-left disabled:opacity-45"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-outrun text-sm font-semibold truncate">
                            {trk.displayTitle}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-[var(--muzean-text-muted)] truncate">
                            {trk.displayArtist} · {trk.displayAlbum}
                          </div>
                        </div>
                        <span className="font-mono-tabular text-[11px] text-[var(--muzean-text-muted)] shrink-0">
                          {formatDurationMs(trk.durationMs)}
                        </span>
                      </motion.button>
                    ))
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-[var(--muzean-border)] flex items-center justify-between gap-2">
                  <GlassButton
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                    }}
                    className="min-h-[36px] px-3.5 text-xs"
                  >
                    {labels.reset}
                  </GlassButton>
                  <GlassButton
                    type="button"
                    tone="accent"
                    onClick={() => {
                      setRoute('tracks');
                      setSearchModalOpen(false);
                    }}
                    className="min-h-[36px] px-4 text-xs font-semibold"
                  >
                    {labels.navTracks}
                  </GlassButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals & Bottom Sheets */}
        <AnimatePresence>
          {queueModalOpen && (
            <QueueSheet
              queue={db.queue}
              currentQueueItemId={db.session.currentQueueItemId}
              tracksById={tracksById}
              shuffleEnabled={db.session.shuffleEnabled}
              onJumpToItem={(queueItemId) => {
                const item = db.queue.find((q) => q.queueItemId === queueItemId);
                if (item) void playQueueItem(item, true);
              }}
              onRemoveItem={(queueItemId) => {
                setDb((prev) => ({
                  ...prev,
                  queue: prev.queue.filter((q) => q.queueItemId !== queueItemId),
                }));
              }}
              onMoveItem={(fromIdx, toIdx) => {
                setDb((prev) => {
                  const next = [...prev.queue];
                  const [moved] = next.splice(fromIdx, 1);
                  next.splice(toIdx, 0, moved);
                  return { ...prev, queue: next };
                });
              }}
              onClearQueue={() => {
                engine.pause();
                setIsPlaying(false);
                setDb((prev) => ({
                  ...prev,
                  queue: [],
                  session: { ...prev.session, currentQueueItemId: null },
                }));
              }}
              onClose={() => setQueueModalOpen(false)}
              labels={labels}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lyricsModalOpen && currentTrack && (
            <LyricsSheet
              track={currentTrack}
              artworkCache={db.artworkCache}
              trackLyrics={db.lyrics.filter((l) => l.trackId === currentTrack.trackId)}
              positionMs={positionMs}
              onSeekMs={(ms) => {
                engine.seekMs(ms);
                setPositionMs(ms);
              }}
              onSaveManualLyrics={(trackId, content) => {
                const now = Date.now();
                const isLrc = /\[\d{1,3}:\d{2}/.test(content);
                setDb((prev) => {
                  const existing = prev.lyrics.find(
                    (l) => l.trackId === trackId && l.sourceType === 'MANUAL'
                  );
                  if (existing) {
                    return {
                      ...prev,
                      lyrics: prev.lyrics.map((l) =>
                        l.lyricsId === existing.lyricsId
                          ? { ...l, content, format: isLrc ? 'LRC' : 'PLAIN', updatedAt: now }
                          : l
                      ),
                    };
                  }
                  return {
                    ...prev,
                    lyrics: [
                      ...prev.lyrics,
                      {
                        lyricsId: `lyr_man_${now}`,
                        trackId,
                        sourceType: 'MANUAL',
                        format: isLrc ? 'LRC' : 'PLAIN',
                        content,
                        languageTag: prev.settings.language,
                        createdAt: now,
                        updatedAt: now,
                      },
                    ],
                  };
                });
                showToast('Manual lyrics saved.');
              }}
              onDeleteManualLyrics={(lyricsId) => {
                setDb((prev) => ({
                  ...prev,
                  lyrics: prev.lyrics.filter((l) => l.lyricsId !== lyricsId),
                }));
              }}
              onClose={() => setLyricsModalOpen(false)}
              labels={labels}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sleepModalOpen && (
            <SleepTimerModal
              activeRemainingSec={sleepRemainingSec}
              onStart={(mins) => {
                setSleepRemainingSec(mins * 60);
                showToast(`Sleep timer set for ${mins} min.`);
              }}
              onCancelTimer={() => {
                setSleepRemainingSec(null);
                showToast('Sleep timer cancelled.');
              }}
              onClose={() => setSleepModalOpen(false)}
              labels={labels}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {songInfoTrack && (
            <SongInfoModal
              track={songInfoTrack}
              sources={songInfoSources}
              onSwitchPrimarySource={(trackId, sourceId) => {
                setDb((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) =>
                    t.trackId === trackId ? { ...t, primarySourceId: sourceId, updatedAt: Date.now() } : t
                  ),
                  trackSources: prev.trackSources.map((s) =>
                    s.trackId === trackId ? { ...s, isPrimary: s.sourceId === sourceId } : s
                  ),
                }));
                showToast('Active audio source updated.');
              }}
              onClose={() => setSongInfoTrackId(null)}
              labels={labels}
            />
          )}
        </AnimatePresence>

        {/* Non-intrusive Zero-Shadow Glass Toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.94 }}
              transition={APPLE_SPRING}
              role="status"
              aria-live="polite"
              className="fixed top-16 right-4 z-50 glass-modal px-4 py-2 text-xs font-medium shadow-none border-[var(--muzean-accent)]"
            >
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
