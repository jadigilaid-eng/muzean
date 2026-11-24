import { motion } from 'motion/react';
import { Check, FileAudio, X } from 'lucide-react';
import { formatDurationMs } from '../domain/lyrics';
import type { Track, TrackSource } from '../domain/types';
import { APPLE_SPRING, GlassButton, GlassPanel } from './GlassUI';

interface SongInfoModalProps {
  track: Track;
  sources: TrackSource[];
  onSwitchPrimarySource: (trackId: string, sourceId: string) => void;
  onClose: () => void;
  labels: {
    songInfo: string;
    altSourcesTitle: string;
    activeSource: string;
    setAsActiveSource: string;
  };
}

export function SongInfoModal({
  track,
  sources,
  onSwitchPrimarySource,
  onClose,
  labels,
}: SongInfoModalProps) {
  const activeSource = sources.find((s) => s.sourceId === track.primarySourceId) ?? sources[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={labels.songInfo}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={APPLE_SPRING}
        className="glass-modal w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden shadow-none"
      >
        <div className="glass-titlebar px-4 py-3 flex items-center justify-between">
          <span className="font-neon-script text-xl leading-none pr-2">{labels.songInfo}</span>
          <GlassButton
            type="button"
            shape="circle"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </GlassButton>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          <GlassPanel className="p-4 space-y-2.5">
            <div className="font-neon-script text-2xl leading-snug pr-2 text-[var(--muzean-text)]">
              {track.displayTitle}
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
              <span className="text-[var(--muzean-text-muted)]">Artist</span>
              <span className="font-medium">{track.displayArtist}</span>
              <span className="text-[var(--muzean-text-muted)]">Album</span>
              <span className="font-medium">{track.displayAlbum}</span>
              <span className="text-[var(--muzean-text-muted)]">Genre / Year</span>
              <span className="font-mono-tabular">
                {track.genre || '—'} · {track.year ?? '—'}
              </span>
              <span className="text-[var(--muzean-text-muted)]">Track # / Duration</span>
              <span className="font-mono-tabular">
                {track.trackNumber ?? '—'} · {formatDurationMs(track.durationMs)}
              </span>
              {activeSource && (
                <>
                  <span className="text-[var(--muzean-text-muted)]">Codec / Container</span>
                  <span className="font-mono-tabular">
                    {activeSource.codec} / {activeSource.containerFormat}
                  </span>
                  <span className="text-[var(--muzean-text-muted)]">Audio Stream</span>
                  <span className="font-mono-tabular">
                    {Math.round(activeSource.bitrateBps / 1000)} kbps ·{' '}
                    {(activeSource.sampleRateHz / 1000).toFixed(1)} kHz · {activeSource.bitDepth}-bit
                  </span>
                </>
              )}
            </div>
          </GlassPanel>

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muzean-text-muted)] px-1">
              {labels.altSourcesTitle} ({sources.length})
            </h3>
            <div className="space-y-2.5">
              {sources.map((src) => {
                const isActive = src.sourceId === track.primarySourceId;
                return (
                  <GlassPanel key={src.sourceId} interactiveZoom className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <FileAudio className="w-4 h-4 text-[var(--muzean-accent-2)] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--muzean-text)] break-all">
                            {src.fileName}
                          </div>
                          <div className="text-[11px] text-[var(--muzean-text-muted)] break-all">
                            {src.relativePath}
                          </div>
                        </div>
                      </div>
                      <span className="glass-btn font-mono-tabular text-[11px] px-2.5 py-0.5 shrink-0">
                        Score {src.qualityScore}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--muzean-border)]">
                      <span className="font-mono-tabular text-[11px] text-[var(--muzean-text-muted)]">
                        {src.codec} · {Math.round(src.bitrateBps / 1000)} kbps ·{' '}
                        {(src.sampleRateHz / 1000).toFixed(1)} kHz/{src.bitDepth}-bit ·{' '}
                        {(src.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB · {src.sourceStatus}
                      </span>

                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--muzean-accent-2)]">
                          <Check className="w-3.5 h-3.5" />
                          <span>{labels.activeSource}</span>
                        </span>
                      ) : (
                        <GlassButton
                          type="button"
                          tone="accent"
                          disabled={src.sourceStatus !== 'AVAILABLE'}
                          onClick={() => onSwitchPrimarySource(track.trackId, src.sourceId)}
                          className="min-h-[34px] px-3 text-[11px] font-semibold"
                        >
                          {labels.setAsActiveSource}
                        </GlassButton>
                      )}
                    </div>

                    {src.errorDetail && (
                      <div className="text-[11px] text-rose-500">{src.errorDetail}</div>
                    )}
                  </GlassPanel>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
