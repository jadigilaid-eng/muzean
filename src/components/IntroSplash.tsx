import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

export const INTRO_DURATION_MS = 1900;

/** Animated launch screen: the MUZEAN logo spins in over the same teal as the native splash, then fades out. */
export function IntroSplash({ durationMs = INTRO_DURATION_MS }: { durationMs?: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="intro"
          data-testid="intro-splash"
          role="presentation"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5"
          style={{ background: 'radial-gradient(circle at 50% 42%, #14a3a3 0%, #008080 55%, #004d4d 100%)' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <motion.img
            src="/assets/muzean-logo.png"
            alt=""
            draggable={false}
            className="w-32 h-32 object-contain"
            style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 18px rgba(255,255,255,0.35))' }}
            initial={{ scale: 0.4, rotate: -140, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14, duration: 0.9 }}
          />
          <motion.div
            className="font-outrun text-2xl tracking-[0.4em] text-white"
            initial={{ opacity: 0, y: 12, letterSpacing: '0.1em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.4em' }}
            transition={{ delay: 0.35, duration: 0.8, ease: 'easeOut' }}
          >
            MUZEAN
          </motion.div>
          <motion.div
            className="h-1 w-28 rounded-full bg-white/25 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div
              className="h-full bg-white/80"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ delay: 0.5, duration: Math.max(0.4, durationMs / 1000 - 0.7), ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
