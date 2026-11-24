import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';

export const APPLE_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.82,
};

export const APPLE_EASE = [0.22, 1, 0.36, 1] as const;

interface GlassButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  active?: boolean;
  tone?: 'default' | 'accent' | 'teal' | 'danger';
  shape?: 'pill' | 'circle' | 'rounded';
}

export function GlassButton({
  children,
  active = false,
  tone = 'default',
  shape = 'pill',
  className = '',
  disabled,
  ...rest
}: GlassButtonProps) {
  const radiusClass =
    shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-2xl' : 'rounded-full';

  const toneBorder =
    active || tone === 'accent'
      ? 'border-[var(--muzean-accent)] text-[var(--muzean-accent)]'
      : tone === 'teal'
      ? 'border-[var(--muzean-accent-2)] text-[var(--muzean-accent-2)]'
      : tone === 'danger'
      ? 'border-rose-500/70 text-rose-500'
      : 'border-[var(--muzean-border)] text-[var(--muzean-text)]';

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.045 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={APPLE_SPRING}
      disabled={disabled}
      className={`glass-btn ${radiusClass} ${toneBorder} shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--muzean-accent)] disabled:opacity-45 ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

interface GlassPanelProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  interactiveZoom?: boolean;
}

export function GlassPanel({
  children,
  interactiveZoom = false,
  className = '',
  ...rest
}: GlassPanelProps) {
  return (
    <motion.div
      whileHover={interactiveZoom ? { scale: 1.018 } : undefined}
      transition={APPLE_SPRING}
      className={`glass-panel shadow-none ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
