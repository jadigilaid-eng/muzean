import { AnimatePresence, motion } from 'motion/react';
import { Disc3, ListMusic, Search, Sliders, UserRound, X, Zap } from 'lucide-react';
import { useState } from 'react';
import type { ViewRoute } from '../domain/types';
import { APPLE_SPRING, GlassButton } from './GlassUI';

interface QuickAccessMenuProps {
  onAction: (target: 'search' | ViewRoute) => void;
  label: string;
  hasMiniPlayer: boolean;
}

export function QuickAccessMenu({ onAction, label, hasMiniPlayer }: QuickAccessMenuProps) {
  const [open, setOpen] = useState(false);

  // 5 radial items evenly spaced every 72 degrees around the shifted popup button
  const items: Array<{
    key: 'search' | ViewRoute;
    title: string;
    icon: typeof Search;
    angleDeg: number;
  }> = [
    { key: 'tracks', title: 'Search', icon: Search, angleDeg: -90 },
    { key: 'playlists', title: 'Playlists', icon: ListMusic, angleDeg: -18 },
    { key: 'artists', title: 'Artists', icon: UserRound, angleDeg: 54 },
    { key: 'albums', title: 'Albums', icon: Disc3, angleDeg: 126 },
    { key: 'equalizer', title: 'Equalizer', icon: Sliders, angleDeg: 198 },
  ];

  const radius = 68;
  const shiftX = open ? -76 : 0;
  const shiftY = open ? -64 : 0;

  return (
    <div className={`fixed right-5 z-40 ${hasMiniPlayer ? 'bottom-20' : 'bottom-6'}`}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-0 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Shifted center container for popup button + evenly spaced surrounding ring with active shadow */}
      <motion.div
        animate={{ x: shiftX, y: shiftY }}
        transition={APPLE_SPRING}
        className="relative z-20"
      >
        <AnimatePresence>
          {open && (
            <>
              {items.map((item, idx) => {
                const rad = (item.angleDeg * Math.PI) / 180;
                const dx = Math.cos(rad) * radius;
                const dy = Math.sin(rad) * radius;
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                    animate={{ opacity: 1, x: dx, y: dy, scale: 1 }}
                    exit={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                    transition={{ ...APPLE_SPRING, delay: idx * 0.025 }}
                    className="absolute top-0.5 left-0.5 z-20"
                  >
                    <GlassButton
                      type="button"
                      shape="circle"
                      aria-label={`Quick Access: ${item.title}`}
                      title={item.title}
                      onClick={() => {
                        setOpen(false);
                        onAction(item.key === 'tracks' ? 'search' : item.key);
                      }}
                      className="w-11 h-11 flex items-center justify-center quick-access-shadow"
                    >
                      <Icon className="w-4 h-4 text-[var(--muzean-text)] drop-shadow-xs" />
                    </GlassButton>
                  </motion.div>
                );
              })}
            </>
          )}
        </AnimatePresence>

        <GlassButton
          type="button"
          shape="circle"
          tone="accent"
          active={open}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={label}
          title={label}
          className={`relative z-30 w-12 h-12 flex items-center justify-center ${
            open ? 'quick-access-shadow' : ''
          }`}
        >
          {open ? <X className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
        </GlassButton>
      </motion.div>
    </div>
  );
}
