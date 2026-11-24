import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { APPLE_SPRING, GlassButton } from './GlassUI';

interface SleepTimerModalProps {
  activeRemainingSec: number | null;
  onStart: (minutes: number) => void;
  onCancelTimer: () => void;
  onClose: () => void;
  labels: {
    sleepTimer: string;
    sleepTimerMinutes: string;
    startTimer: string;
    cancelTimer: string;
    cancel: string;
  };
}

export function SleepTimerModal({
  activeRemainingSec,
  onStart,
  onCancelTimer,
  onClose,
  labels,
}: SleepTimerModalProps) {
  const [minutes, setMinutes] = useState(
    activeRemainingSec !== null ? Math.max(15, Math.min(120, Math.ceil(activeRemainingSec / 60))) : 30
  );
  const svgRef = useRef<SVGSVGElement | null>(null);

  const minVal = 15;
  const maxVal = 120;
  const ratio = (minutes - minVal) / (maxVal - minVal);
  const angle = -Math.PI / 2 + ratio * Math.PI * 2;
  const radius = 78;
  const cx = 100;
  const cy = 100;
  const knobX = cx + Math.cos(angle) * radius;
  const knobY = cy + Math.sin(angle) * radius;
  const circumference = 2 * Math.PI * radius;

  const updateFromPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let theta = Math.atan2(dy, dx) + Math.PI / 2;
    if (theta < 0) theta += Math.PI * 2;
    const nextMin = Math.round(minVal + (theta / (Math.PI * 2)) * (maxVal - minVal));
    setMinutes(Math.max(minVal, Math.min(maxVal, nextMin)));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={labels.sleepTimer}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={APPLE_SPRING}
        className="glass-modal w-full max-w-sm overflow-hidden shadow-none"
      >
        <div className="glass-titlebar px-4 py-3 flex items-center justify-between">
          <span className="font-neon-script text-xl leading-none pr-2">{labels.sleepTimer}</span>
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

        <div className="p-5 flex flex-col items-center gap-4">
          <svg
            ref={svgRef}
            width="200"
            height="200"
            viewBox="0 0 200 200"
            className="cursor-pointer touch-none select-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              updateFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) updateFromPointer(e.clientX, e.clientY);
            }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="var(--muzean-border)"
              strokeWidth="10"
            />
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="var(--muzean-accent-2)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${circumference * Math.max(0.05, ratio)} ${circumference}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            <circle
              cx={knobX}
              cy={knobY}
              r="11"
              fill="var(--muzean-accent)"
              stroke="var(--muzean-text)"
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className="fill-[var(--muzean-text)] font-mono-tabular text-3xl font-bold"
            >
              {minutes}
            </text>
            <text
              x={cx}
              y={cy + 18}
              textAnchor="middle"
              className="fill-[var(--muzean-text-muted)] text-xs"
            >
              {labels.sleepTimerMinutes}
            </text>
          </svg>

          <input
            type="range"
            min={15}
            max={120}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            aria-label="Sleep timer minutes"
            className="w-full accent-[var(--muzean-accent-2)] glass-zoom"
          />

          <div className="flex items-center gap-2 w-full">
            {activeRemainingSec !== null && (
              <GlassButton
                type="button"
                tone="danger"
                onClick={() => {
                  onCancelTimer();
                  onClose();
                }}
                className="flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold"
              >
                {labels.cancelTimer}
              </GlassButton>
            )}
            <GlassButton
              type="button"
              tone="accent"
              onClick={() => {
                onStart(minutes);
                onClose();
              }}
              className="flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold"
            >
              {labels.startTimer}
            </GlassButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
