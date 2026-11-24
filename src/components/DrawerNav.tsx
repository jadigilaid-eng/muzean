import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import {
  ChevronRight,
  Disc3,
  FolderOpen,
  ListMusic,
  ListOrdered,
  Music2,
  Radio,
  Settings,
  Sliders,
  UserRound,
} from 'lucide-react';
import type { ViewRoute } from '../domain/types';
import { APPLE_SPRING } from './GlassUI';

interface DrawerNavProps {
  currentRoute: ViewRoute;
  onNavigate: (route: ViewRoute) => void;
  onOpenQueue: () => void;
  onToggleTheme: () => void;
  open: boolean;
  onClose: () => void;
  rootFolderName: string;
  trackCount: number;
  queueCount: number;
  labels: {
    appTitle: string;
    navTracks: string;
    navPlaylists: string;
    navAlbums: string;
    navArtists: string;
    navFolders: string;
    navNowPlaying: string;
    navEqualizer: string;
    navSettings: string;
    queue: string;
    menuSection: string;
    categorySection: string;
    generalSection: string;
    tracksCount: string;
  };
}

interface MenuEntry {
  key: ViewRoute | 'queue';
  label: string;
  icon: typeof Music2;
  badgeCount?: number;
  tagText?: string;
}

export function DrawerNav({
  currentRoute,
  onNavigate,
  onOpenQueue,
  onToggleTheme,
  open,
  onClose,
  rootFolderName,
  trackCount,
  queueCount,
  labels,
}: DrawerNavProps) {
  const sections: Array<{ title: string; items: MenuEntry[] }> = [
    {
      title: labels.menuSection,
      items: [
        { key: 'tracks', label: labels.navTracks, icon: Music2 },
        { key: 'playlists', label: labels.navPlaylists, icon: ListMusic },
        { key: 'nowplaying', label: labels.navNowPlaying, icon: Radio },
        {
          key: 'queue',
          label: labels.queue,
          icon: ListOrdered,
          badgeCount: queueCount,
        },
      ],
    },
    {
      title: labels.categorySection,
      items: [
        { key: 'albums', label: labels.navAlbums, icon: Disc3 },
        { key: 'artists', label: labels.navArtists, icon: UserRound },
        { key: 'folders', label: labels.navFolders, icon: FolderOpen },
      ],
    },
    {
      title: labels.generalSection,
      items: [
        {
          key: 'equalizer',
          label: labels.navEqualizer,
          icon: Sliders,
          tagText: '10-Band',
        },
        { key: 'settings', label: labels.navSettings, icon: Settings },
      ],
    },
  ];

  const handleSelect = (key: ViewRoute | 'queue') => {
    if (key === 'queue') {
      onClose();
      onOpenQueue();
      return;
    }
    onNavigate(key);
    onClose();
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -64 || info.velocity.x < -280) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="drawer-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.14 } }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-50 flex items-center justify-start p-3"
        >
          {/* Backdrop Scrim */}
          <div
            className="fixed inset-0 bg-white/25 dark:bg-black/45 backdrop-blur-md"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Transparent Floating macOS-Style Vertical Glass Navigation Card */}
          <motion.aside
            initial={{ x: -24, opacity: 0, scale: 0.97 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: -20, opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', stiffness: 540, damping: 38, mass: 0.65 }}
            drag="x"
            dragConstraints={{ left: -240, right: 0 }}
            dragElastic={0.08}
            onDragEnd={handleDragEnd}
            aria-label="Main Library Navigation"
            className="relative z-10 w-[276px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] rounded-2xl border border-[var(--muzean-border)] bg-transparent backdrop-blur-2xl shadow-none flex flex-col overflow-hidden"
          >
            {/* Top macOS Window Controls + Brand Header (Selected 4-dot button removed) */}
            <div className="px-5 pt-4 pb-3.5 border-b border-[var(--muzean-border)] shrink-0">
              <div className="flex items-center gap-2 mb-3.5">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation menu"
                  title="Close"
                  className="w-3 h-3 rounded-full bg-[#FF5F56] hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                />
                <button
                  type="button"
                  onClick={onToggleTheme}
                  aria-label="Toggle Light/Dark theme"
                  title="Theme"
                  className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                />
                <button
                  type="button"
                  onClick={() => handleSelect('nowplaying')}
                  aria-label="Open Now Playing"
                  title="Now Playing"
                  className="w-3 h-3 rounded-full bg-[#27C93F] hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                />
              </div>

              <div className="flex items-center justify-start gap-2.5 min-w-0">
                <img
                  src="/assets/muzean-logo.png"
                  alt="MUZEAN Logo"
                  className="w-7 h-7 object-contain shrink-0"
                />
                <span className="font-neon-script tracking-wide text-[26px] leading-none text-[var(--muzean-text)] pr-2 truncate">
                  {labels.appTitle}
                </span>
              </div>
            </div>

            {/* Grouped Navigation Sections (MENU / CATEGORY / GENERAL) without hover tooltips */}
            <nav className="flex-1 overflow-y-auto py-3 divide-y divide-[var(--muzean-border)]">
              {sections.map((section) => (
                <div key={section.title} className="py-2.5 first:pt-1 last:pb-1">
                  <div className="px-5 pb-1.5 text-[10px] font-mono-tabular tracking-[0.14em] text-[var(--muzean-text-muted)]">
                    {section.title}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = item.key !== 'queue' && currentRoute === item.key;

                      return (
                        <motion.button
                          key={item.key}
                          type="button"
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.985 }}
                          transition={APPLE_SPRING}
                          onClick={() => handleSelect(item.key)}
                          aria-current={active ? 'page' : undefined}
                          className={`relative w-full px-5 py-2 min-h-[38px] flex items-center justify-between gap-2.5 text-left transition-colors focus-visible:outline-none focus-visible:bg-white/5 ${
                            active
                              ? 'text-[var(--muzean-text)] font-semibold'
                              : 'text-[var(--muzean-text-muted)] hover:text-[var(--muzean-text)]'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="muzean-active-nav-indicator"
                              transition={APPLE_SPRING}
                              aria-hidden="true"
                              className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[var(--muzean-accent)]"
                            />
                          )}

                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                active ? 'text-[var(--muzean-accent)]' : 'opacity-80'
                              }`}
                            />
                            <span className="text-[13px] leading-tight truncate">
                              {item.label}
                            </span>
                            {item.tagText && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono-tabular rounded border border-[var(--muzean-border)] text-[var(--muzean-text-muted)] shrink-0">
                                {item.tagText}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--muzean-accent)] text-white dark:text-[#120624] text-[10px] font-mono-tabular font-bold flex items-center justify-center">
                                {item.badgeCount}
                              </span>
                            )}
                            {active && (
                              <ChevronRight className="w-3.5 h-3.5 text-[var(--muzean-text-muted)]" />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Bottom Library / Audio Profile Row */}
            <button
              type="button"
              onClick={() => handleSelect('settings')}
              className="px-5 py-3.5 border-t border-[var(--muzean-border)] flex items-center justify-between gap-3 text-left hover:bg-white/5 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--muzean-accent)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full border border-[var(--muzean-border)] flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="/assets/muzean-logo.png"
                    alt="MUZEAN Library"
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--muzean-text)] truncate">
                    {rootFolderName}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[var(--muzean-text-muted)] truncate">
                    {trackCount} {labels.tracksCount}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--muzean-text-muted)] shrink-0" />
            </button>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
