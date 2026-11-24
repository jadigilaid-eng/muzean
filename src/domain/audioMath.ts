import type { DACProfile, EQBand, EQConfig, OutputMode } from './types';

export const EQ_FREQUENCIES_HZ = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export interface EQPresetDefinition {
  key: string;
  labelId: string;
  labelEn: string;
  gains: number[]; // 10 values in dB (-12..+12)
}

export const EQ_PRESETS: EQPresetDefinition[] = [
  { key: 'flat', labelId: 'Flat (Referensi)', labelEn: 'Flat (Reference)', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { key: 'vaporwave', labelId: 'Vaporwave Warmth', labelEn: 'Vaporwave Warmth', gains: [4.5, 3.5, 2.0, 0.5, -1.0, -1.5, 1.0, 2.5, 3.5, 2.0] },
  { key: 'rock', labelId: 'Classic Rock', labelEn: 'Classic Rock', gains: [4.0, 3.0, 1.5, 0.0, -1.5, -0.5, 1.5, 3.0, 4.0, 3.5] },
  { key: 'acoustic', labelId: 'Akustik', labelEn: 'Acoustic', gains: [2.0, 2.5, 1.5, 0.5, 1.5, 2.0, 2.5, 3.0, 2.5, 1.5] },
  { key: 'vocal', labelId: 'Kejelasan Vokal', labelEn: 'Vocal Clarity', gains: [-2.0, -1.5, -0.5, 1.0, 3.0, 4.0, 3.5, 2.0, 0.5, -0.5] },
  { key: 'latenight', labelId: 'Larut Malam', labelEn: 'Late Night', gains: [3.0, 2.0, 1.0, 0.0, -1.0, -1.0, 0.5, 1.5, 2.0, 1.0] },
  { key: 'jazz', labelId: 'Jazz Lounge', labelEn: 'Jazz Lounge', gains: [2.5, 2.0, 1.0, 1.5, -1.0, -1.0, 0.5, 2.0, 3.0, 2.5] },
  { key: 'y2k_electronic', labelId: 'Electronic Y2K', labelEn: 'Electronic Y2K', gains: [5.5, 4.5, 2.5, 0.0, -2.0, 0.0, 2.0, 4.0, 5.0, 4.5] },
  { key: 'classical', labelId: 'Klasik', labelEn: 'Classical', gains: [3.0, 2.0, 1.0, 0.0, -0.5, -0.5, 0.5, 2.0, 3.0, 3.5] },
  { key: 'studio', labelId: 'Studio Monitor', labelEn: 'Studio Monitor', gains: [1.0, 0.5, 0.0, 0.0, 0.5, 0.5, 1.0, 1.5, 1.5, 1.0] },
];

export function createDefaultEqBands(eqConfigId: string, gains: number[] = EQ_PRESETS[0].gains): EQBand[] {
  return EQ_FREQUENCIES_HZ.map((freq, idx) => ({
    eqBandId: `${eqConfigId}_b_${freq}`,
    eqConfigId,
    frequencyHz: freq,
    gainDb: clampGain(gains[idx] ?? 0),
    position: idx,
  }));
}

export function clampGain(db: number): number {
  return Math.max(-12, Math.min(12, Math.round(db * 10) / 10));
}

export function computeClippingRisk(preampDb: number, bands: EQBand[]): {
  peakGainDb: number;
  hasWarning: boolean;
  severity: 'NONE' | 'MODERATE' | 'HIGH';
} {
  const maxBand = bands.reduce((max, b) => Math.max(max, b.gainDb), 0);
  const peakGainDb = Math.round((preampDb + maxBand) * 10) / 10;
  if (peakGainDb > 9) {
    return { peakGainDb, hasWarning: true, severity: 'HIGH' };
  }
  if (peakGainDb > 4.5) {
    return { peakGainDb, hasWarning: true, severity: 'MODERATE' };
  }
  return { peakGainDb, hasWarning: false, severity: 'NONE' };
}

/**
 * Generates a smooth Catmull-Rom cubic Bézier SVG path through 10 EQ points.
 */
export function buildSmoothEqCurvePath(
  points: { x: number; y: number }[]
): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

/**
 * Resolves playback transition mode:
 * Crossfade takes precedence over Gapless when both are enabled.
 */
export function resolveTransitionMode(
  crossfadeEnabled: boolean,
  crossfadeDurationSec: number,
  gaplessEnabled: boolean
): { mode: 'CROSSFADE' | 'GAPLESS' | 'STANDARD'; crossfadeSec: number } {
  if (crossfadeEnabled) {
    return { mode: 'CROSSFADE', crossfadeSec: crossfadeDurationSec };
  }
  if (gaplessEnabled) {
    return { mode: 'GAPLESS', crossfadeSec: 0 };
  }
  return { mode: 'STANDARD', crossfadeSec: 0 };
}

export interface DacValidationResult {
  appliedSampleRateHz: number;
  appliedBitDepth: number;
  fallbackUsed: boolean;
  reason: string | null;
}

export function validateDacOutputConfig(
  profile: Pick<DACProfile, 'supportedSampleRates' | 'supportedBitDepths'>,
  outputMode: OutputMode,
  requestedSampleRateHz: number,
  requestedBitDepth: number
): DacValidationResult {
  if (outputMode === 'AUTOMATIC') {
    const bestRate = profile.supportedSampleRates.includes(48000)
      ? 48000
      : profile.supportedSampleRates[0] ?? 48000;
    const bestDepth = profile.supportedBitDepths.includes(24)
      ? 24
      : profile.supportedBitDepths[0] ?? 16;
    return {
      appliedSampleRateHz: bestRate,
      appliedBitDepth: bestDepth,
      fallbackUsed: false,
      reason: null,
    };
  }

  const rateSupported = profile.supportedSampleRates.includes(requestedSampleRateHz);
  const depthSupported = profile.supportedBitDepths.includes(requestedBitDepth);

  if (rateSupported && depthSupported) {
    return {
      appliedSampleRateHz: requestedSampleRateHz,
      appliedBitDepth: requestedBitDepth,
      fallbackUsed: false,
      reason: null,
    };
  }

  // Fallback safely to standard Android/Web Audio output
  return {
    appliedSampleRateHz: 48000,
    appliedBitDepth: 16,
    fallbackUsed: true,
    reason: `Requested ${requestedSampleRateHz} Hz / ${requestedBitDepth}-bit is unsupported by active output; safely fallen back to 48000 Hz / 16-bit standard output.`,
  };
}

export function createDefaultEqConfig(
  eqConfigId: string,
  name: string,
  scope: 'GLOBAL' | 'DAC',
  now = Date.now()
): EQConfig {
  return {
    eqConfigId,
    name,
    scope,
    presetKey: 'flat',
    isManual: false,
    preampDb: 0,
    spatialPreset: 'NORMAL',
    spatialIntensity: 25,
    replayGainAlbumEnabled: false,
    bands: createDefaultEqBands(eqConfigId),
    createdAt: now,
    updatedAt: now,
  };
}
