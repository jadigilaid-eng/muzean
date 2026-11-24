import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { generateVaporwaveArtworkDataUri } from '../domain/artwork';
import { formatDurationMs, getActiveLrcLineIndex, parseLrcLyrics } from '../domain/lyrics';
import type { ArtworkCacheEntry, Lyrics, LyricsSourceType, Track } from '../domain/types';
import { APPLE_SPRING, GlassButton } from './GlassUI';

interface LyricsSheetProps {
  track: Track;
  artworkCache: Record<string, ArtworkCacheEntry>;
  trackLyrics: Lyrics[];
  positionMs: number;
  onSeekMs: (ms: number) => void;
  onSaveManualLyrics: (trackId: string, content: string) => void;
  onDeleteManualLyrics: (lyricsId: string) => void;
  onClose: () => void;
  labels: {
    lyrics: string;
    lyricsEmbedded: string;
    lyricsManual: string;
    lyricsPasteLabel: string;
    lyricsTapHint: string;
    lyricsEmpty: string;
    save: string;
    delete: string;
    confirmDeleteLyrics: string;
    cancel: string;
    confirm: string;
  };
}

export function LyricsSheet({
  track,
  artworkCache,
  trackLyrics,
  positionMs,
  onSeekMs,
  onSaveManualLyrics,
  onDeleteManualLyrics,
  onClose,
  labels,
}: LyricsSheetProps) {
  const embedded = trackLyrics.find((l) => l.sourceType === 'EMBEDDED') ?? null;
  const manual = trackLyrics.find((l) => l.sourceType === 'MANUAL') ?? null;

  const [selectedSource, setSelectedSource] = useState<LyricsSourceType>(
    embedded ? 'EMBEDDED' : 'MANUAL'
  );
  const [expanded, setExpanded] = useState(false);
  const [editingManual, setEditingManual] = useState(!embedded && !manual);
  const [draftText, setDraftText] = useState(manual?.content ?? '');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);

  const activeLyricsRecord = selectedSource === 'EMBEDDED' ? embedded : manual;

  const parsed = useMemo(
    () => parseLrcLyrics(activeLyricsRecord?.content ?? ''),
    [activeLyricsRecord?.content]
  );

  const activeIndex = useMemo(
    () => (parsed.isLrc ? getActiveLrcLineIndex(parsed.lines, positionMs) : -1),
    [parsed, positionMs]
  );

  useEffect(() => {
    if (parsed.isLrc && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, parsed.isLrc]);

  const artUri =
    (track.artworkCacheKey && artworkCache[track.artworkCacheKey]?.dataUri) ||
    generateVaporwaveArtworkDataUri(`ALBUM:${track.displayAlbum}:${track.displayArtist}`);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.lyrics}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex flex-col justify-end p-2 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={APPLE_SPRING}
        className={`glass-modal w-full max-w-2xl mx-auto flex flex-col overflow-hidden transition-all ${
          expanded ? 'h-[86vh]' : 'h-[62vh]'
        }`}
      >
        <div className="glass-titlebar px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={artUri}
              alt={track.displayAlbum}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover border border-[var(--muzean-border)] shrink-0"
            />
            <div className="min-w-0">
              <div className="font-outrun text-sm font-bold truncate">{track.displayTitle}</div>
              <div className="text-[11px] text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                {track.displayArtist}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <GlassButton
              type="button"
              shape="circle"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? 'Collapse sheet' : 'Expand sheet'}
              className="min-h-[34px] min-w-[34px] flex items-center justify-center"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </GlassButton>
            <GlassButton
              type="button"
              shape="circle"
              onClick={onClose}
              aria-label="Close"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </GlassButton>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-[var(--muzean-border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {embedded && (
              <GlassButton
                type="button"
                active={selectedSource === 'EMBEDDED'}
                onClick={() => {
                  setSelectedSource('EMBEDDED');
                  setEditingManual(false);
                }}
                className="min-h-[34px] px-3 py-1 text-xs font-medium"
              >
                {labels.lyricsEmbedded}
              </GlassButton>
            )}
            <GlassButton
              type="button"
              active={selectedSource === 'MANUAL'}
              onClick={() => setSelectedSource('MANUAL')}
              className="min-h-[34px] px-3 py-1 text-xs font-medium"
            >
              {labels.lyricsManual}
            </GlassButton>
          </div>

          {selectedSource === 'MANUAL' && (
            <div className="flex items-center gap-1.5">
              <GlassButton
                type="button"
                onClick={() => {
                  setDraftText(manual?.content ?? '');
                  setEditingManual((e) => !e);
                }}
                className="min-h-[34px] px-3 py-1 text-xs font-medium"
              >
                {editingManual ? labels.cancel : 'Edit'}
              </GlassButton>
              {manual && (
                <GlassButton
                  type="button"
                  shape="circle"
                  tone="danger"
                  onClick={() => setDeleteConfirmId(manual.lyricsId)}
                  aria-label={labels.delete}
                  className="min-h-[34px] min-w-[34px] flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </GlassButton>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {editingManual && selectedSource === 'MANUAL' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!draftText.trim()) return;
                onSaveManualLyrics(track.trackId, draftText);
                setEditingManual(false);
              }}
              className="space-y-3 h-full flex flex-col"
            >
              <label htmlFor="manual-lyrics-textarea" className="text-xs text-[var(--muzean-text-muted)]">
                {labels.lyricsPasteLabel}
              </label>
              <textarea
                id="manual-lyrics-textarea"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={8}
                placeholder="[00:05.00] First lyric line..."
                className="flex-1 w-full p-3 glass-inset text-xs font-mono-tabular text-[var(--muzean-text)]"
              />
              <GlassButton
                type="submit"
                tone="accent"
                className="min-h-[40px] px-4 py-2 text-xs font-semibold self-end"
              >
                {labels.save}
              </GlassButton>
            </form>
          ) : !activeLyricsRecord ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-xs text-[var(--muzean-text-muted)]">{labels.lyricsEmpty}</p>
              <GlassButton
                type="button"
                tone="accent"
                onClick={() => {
                  setSelectedSource('MANUAL');
                  setEditingManual(true);
                }}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold"
              >
                + {labels.lyricsManual}
              </GlassButton>
            </div>
          ) : parsed.isLrc ? (
            <div className="space-y-1.5">
              <p className="text-xs text-[var(--muzean-text-muted)] pb-2">{labels.lyricsTapHint}</p>
              {parsed.lines.map((line, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <motion.button
                    key={`${line.timeMs}_${idx}`}
                    ref={isActive ? activeLineRef : undefined}
                    whileHover={{ scale: 1.015 }}
                    transition={APPLE_SPRING}
                    type="button"
                    onClick={() => onSeekMs(line.timeMs)}
                    className={`w-full text-left px-3 py-2 rounded-2xl flex items-baseline gap-3 transition-colors ${
                      isActive
                        ? 'border border-[var(--muzean-accent)] text-[var(--muzean-accent)] font-outrun font-bold text-base'
                        : 'text-sm text-[var(--muzean-text-muted)] hover:text-[var(--muzean-text)]'
                    }`}
                  >
                    <span className="font-mono-tabular text-[11px] opacity-70 shrink-0">
                      {formatDurationMs(line.timeMs)}
                    </span>
                    <span className="font-outrun">{line.text}</span>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 font-outrun text-base leading-relaxed whitespace-pre-wrap text-[var(--muzean-text)]">
              {parsed.plainLines.map((line, idx) => (
                <p key={idx} className="min-h-[1.2em]">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {deleteConfirmId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-modal max-w-sm w-full p-5 space-y-4">
            <p className="text-sm">{labels.confirmDeleteLyrics}</p>
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
                  onDeleteManualLyrics(deleteConfirmId);
                  setDeleteConfirmId(null);
                  setDraftText('');
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
