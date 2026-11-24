import { motion } from 'motion/react';
import {
  Clock,
  FileText,
  Info,
  ListOrdered,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
} from 'lucide-react';
import { generateVaporwaveArtworkDataUri } from '../domain/artwork';
import { formatDurationMs } from '../domain/lyrics';
import type { ArtworkCacheEntry, RepeatMode, Track, TrackSource } from '../domain/types';
import { APPLE_SPRING, GlassButton, GlassPanel } from './GlassUI';

interface NowPlayingViewProps {
  track: Track | null;
  activeSource: TrackSource | null;
  artworkCache: Record<string, ArtworkCacheEntry>;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  artworkAccentEnabled: boolean;
  sleepTimerRemainingSec: number | null;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeekMs: (ms: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onOpenQueue: () => void;
  onOpenLyrics: () => void;
  onOpenSleepTimer: () => void;
  onOpenEqualizer: () => void;
  onOpenSongInfo: () => void;
  labels: {
    nowPlaying: string;
    queue: string;
    lyrics: string;
    sleepTimer: string;
    equalizer: string;
    shuffleOn: string;
    shuffleOff: string;
    repeatAll: string;
    repeatOne: string;
    repeatOff: string;
    songInfo: string;
  };
}

export function NowPlayingView({
  track,
  activeSource,
  artworkCache,
  isPlaying,
  positionMs,
  durationMs,
  shuffleEnabled,
  repeatMode,
  artworkAccentEnabled,
  sleepTimerRemainingSec,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeekMs,
  onToggleShuffle,
  onToggleRepeat,
  onOpenQueue,
  onOpenLyrics,
  onOpenSleepTimer,
  onOpenEqualizer,
  onOpenSongInfo,
  labels,
}: NowPlayingViewProps) {
  if (!track) {
    return (
      <GlassPanel className="p-8 text-center text-sm text-[var(--muzean-text-muted)]">
        Select a track from your library to start playback.
      </GlassPanel>
    );
  }

  const artUri =
    (track.artworkCacheKey && artworkCache[track.artworkCacheKey]?.dataUri) ||
    generateVaporwaveArtworkDataUri(`ALBUM:${track.displayAlbum}:${track.displayArtist}`);

  const safeDuration = Math.max(durationMs, track.durationMs, 1);
  const progressPct = Math.min(100, Math.max(0, (positionMs / safeDuration) * 100));

  return (
    <GlassPanel
      className="overflow-hidden"
      style={
        artworkAccentEnabled
          ? {
              backgroundImage:
                'radial-gradient(circle at 20% 15%, rgba(224, 64, 251, 0.12), transparent 55%), radial-gradient(circle at 82% 85%, rgba(20, 184, 166, 0.1), transparent 50%)',
            }
          : undefined
      }
    >
      <div className="glass-titlebar px-5 py-3 flex items-center justify-between text-xs">
        <span className="font-neon-script text-lg leading-none pr-1.5">{labels.nowPlaying}</span>
        {activeSource && (
          <span className="font-mono-tabular text-[var(--muzean-text-muted)]">
            {activeSource.codec} · {(activeSource.sampleRateHz / 1000).toFixed(1)} kHz · {activeSource.bitDepth}-bit
          </span>
        )}
      </div>

      <div className="p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Artwork Focus with Apple zoom on hover */}
        <div className="lg:col-span-5 flex justify-center">
          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={APPLE_SPRING}
            className="w-60 h-60 sm:w-72 sm:h-72 rounded-3xl border border-[var(--muzean-border)] p-1.5 overflow-hidden"
          >
            <img
              src={artUri}
              alt={`${track.displayAlbum} cover`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-2xl"
            />
          </motion.div>
        </div>

        {/* Track Info + Scrubber + Transport + Secondary Actions (Visualizer completely removed) */}
        <div className="lg:col-span-7 space-y-6 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="font-neon-script text-3xl sm:text-4xl leading-snug pr-2 truncate">
                {track.displayTitle}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                {track.displayArtist} · {track.displayAlbum}
              </p>
            </div>
            <GlassButton
              type="button"
              shape="circle"
              onClick={onOpenSongInfo}
              aria-label={labels.songInfo}
              title={labels.songInfo}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            >
              <Info className="w-4 h-4" />
            </GlassButton>
          </div>

          {/* Progress Scrubber */}
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={safeDuration}
              value={Math.min(positionMs, safeDuration)}
              onChange={(e) => onSeekMs(Number(e.target.value))}
              aria-label="Playback progress"
              className="w-full accent-[var(--muzean-accent)] cursor-pointer"
            />
            <div className="flex items-center justify-between font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
              <span>{formatDurationMs(positionMs)}</span>
              <span>{progressPct.toFixed(0)}%</span>
              <span>{formatDurationMs(safeDuration)}</span>
            </div>
          </div>

          {/* Primary Transport Controls */}
          <div className="flex items-center justify-between gap-2">
            <GlassButton
              type="button"
              shape="circle"
              active={shuffleEnabled}
              onClick={onToggleShuffle}
              aria-pressed={shuffleEnabled}
              aria-label={shuffleEnabled ? labels.shuffleOn : labels.shuffleOff}
              title={shuffleEnabled ? labels.shuffleOn : labels.shuffleOff}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Shuffle className="w-4 h-4" />
            </GlassButton>

            <div className="flex items-center gap-3">
              <GlassButton
                type="button"
                shape="circle"
                onClick={onPrevious}
                aria-label="Previous track"
                className="min-h-[48px] min-w-[48px] flex items-center justify-center"
              >
                <SkipBack className="w-5 h-5" />
              </GlassButton>

              <GlassButton
                type="button"
                shape="pill"
                tone="accent"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="min-h-[54px] min-w-[76px] px-6 flex items-center justify-center"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </GlassButton>

              <GlassButton
                type="button"
                shape="circle"
                onClick={onNext}
                aria-label="Next track"
                className="min-h-[48px] min-w-[48px] flex items-center justify-center"
              >
                <SkipForward className="w-5 h-5" />
              </GlassButton>
            </div>

            <GlassButton
              type="button"
              shape="pill"
              active={repeatMode !== 'REPEAT_OFF'}
              tone={repeatMode === 'REPEAT_ONE' ? 'accent' : repeatMode === 'REPEAT_ALL' ? 'teal' : 'default'}
              onClick={onToggleRepeat}
              aria-label={
                repeatMode === 'REPEAT_ONE'
                  ? labels.repeatOne
                  : repeatMode === 'REPEAT_ALL'
                  ? labels.repeatAll
                  : labels.repeatOff
              }
              title={
                repeatMode === 'REPEAT_ONE'
                  ? labels.repeatOne
                  : repeatMode === 'REPEAT_ALL'
                  ? labels.repeatAll
                  : labels.repeatOff
              }
              className="min-h-[44px] px-3 flex items-center gap-1.5 text-xs font-medium"
            >
              {repeatMode === 'REPEAT_ONE' ? (
                <Repeat1 className="w-3.5 h-3.5" />
              ) : (
                <Repeat className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {repeatMode === 'REPEAT_ONE' ? '1' : repeatMode === 'REPEAT_ALL' ? 'All' : 'Off'}
              </span>
            </GlassButton>
          </div>

          {/* Secondary Action Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-[var(--muzean-border)]">
            <GlassButton
              type="button"
              shape="pill"
              tone="teal"
              onClick={onOpenSleepTimer}
              className="min-h-[42px] px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {sleepTimerRemainingSec !== null
                  ? `${Math.ceil(sleepTimerRemainingSec / 60)}m`
                  : labels.sleepTimer}
              </span>
            </GlassButton>

            <GlassButton
              type="button"
              shape="pill"
              onClick={onOpenQueue}
              className="min-h-[42px] px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>{labels.queue}</span>
            </GlassButton>

            <GlassButton
              type="button"
              shape="pill"
              onClick={onOpenEqualizer}
              className="min-h-[42px] px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{labels.equalizer}</span>
            </GlassButton>

            <GlassButton
              type="button"
              shape="pill"
              tone="accent"
              onClick={onOpenLyrics}
              className="min-h-[42px] px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{labels.lyrics}</span>
            </GlassButton>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
