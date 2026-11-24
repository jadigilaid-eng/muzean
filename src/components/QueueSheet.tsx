import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, Play, Trash2, X } from 'lucide-react';
import { formatDurationMs } from '../domain/lyrics';
import type { PlaybackQueueItem, Track } from '../domain/types';
import { APPLE_SPRING, GlassButton } from './GlassUI';

interface QueueSheetProps {
  queue: PlaybackQueueItem[];
  currentQueueItemId: string | null;
  tracksById: Map<string, Track>;
  shuffleEnabled: boolean;
  onJumpToItem: (queueItemId: string) => void;
  onRemoveItem: (queueItemId: string) => void;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onClose: () => void;
  labels: {
    queue: string;
    shuffleOn: string;
    shuffleOff: string;
    repeatAll: string;
    clearQueue: string;
  };
}

export function QueueSheet({
  queue,
  currentQueueItemId,
  tracksById,
  shuffleEnabled,
  onJumpToItem,
  onRemoveItem,
  onMoveItem,
  onClearQueue,
  onClose,
  labels,
}: QueueSheetProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.queue}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={APPLE_SPRING}
        className="glass-modal w-full max-w-xl max-h-[82vh] flex flex-col overflow-hidden"
      >
        <div className="glass-titlebar px-4 py-3 flex items-center justify-between text-sm font-semibold">
          <span className="font-neon-script text-xl leading-none pr-2">
            {labels.queue} ({queue.length})
          </span>
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

        <div className="px-4 py-2 border-b border-[var(--muzean-border)] flex items-center justify-between text-xs text-[var(--muzean-text-muted)]">
          <span>
            {shuffleEnabled ? labels.shuffleOn : labels.shuffleOff} · {labels.repeatAll}
          </span>
          {queue.length > 0 && (
            <GlassButton
              type="button"
              tone="danger"
              onClick={onClearQueue}
              className="min-h-[34px] px-3 py-1 text-xs font-medium"
            >
              {labels.clearQueue}
            </GlassButton>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--muzean-border)]">
          {queue.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--muzean-text-muted)]">
              Queue is empty.
            </div>
          ) : (
            queue.map((item, idx) => {
              const trk = tracksById.get(item.trackId);
              if (!trk) return null;
              const isCurrent = item.queueItemId === currentQueueItemId;

              return (
                <motion.div
                  key={item.queueItemId}
                  whileHover={{ scale: 1.01 }}
                  transition={APPLE_SPRING}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onJumpToItem(item.queueItemId)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left min-h-[40px]"
                  >
                    <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)] w-5 shrink-0">
                      {isCurrent ? <Play className="w-3.5 h-3.5 text-[var(--muzean-accent)]" /> : idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`font-outrun text-sm font-semibold truncate ${
                          isCurrent ? 'text-[var(--muzean-accent)]' : ''
                        }`}
                      >
                        {trk.displayTitle}
                      </div>
                      <div className="text-xs text-[var(--muzean-text-muted)] truncate font-mono-tabular">
                        {trk.displayArtist} · {formatDurationMs(trk.durationMs)}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <GlassButton
                      type="button"
                      shape="circle"
                      disabled={idx === 0}
                      onClick={() => onMoveItem(idx, idx - 1)}
                      aria-label={`Move ${trk.displayTitle} up`}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </GlassButton>
                    <GlassButton
                      type="button"
                      shape="circle"
                      disabled={idx === queue.length - 1}
                      onClick={() => onMoveItem(idx, idx + 1)}
                      aria-label={`Move ${trk.displayTitle} down`}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </GlassButton>
                    <GlassButton
                      type="button"
                      shape="circle"
                      tone="danger"
                      onClick={() => onRemoveItem(item.queueItemId)}
                      aria-label={`Remove ${trk.displayTitle} from queue`}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </GlassButton>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
