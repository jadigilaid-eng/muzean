import { AlertTriangle, ArrowLeft, Cpu, Headphones, RefreshCw, RotateCcw, Trash2, Usb } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildSmoothEqCurvePath,
  clampGain,
  computeClippingRisk,
  EQ_FREQUENCIES_HZ,
  EQ_PRESETS,
  validateDacOutputConfig,
} from '../domain/audioMath';
import type {
  AppLanguage,
  DACProfile,
  EQConfig,
  OutputMode,
  SpatialPreset,
} from '../domain/types';
import { GlassButton, GlassPanel } from './GlassUI';

interface EqualizerViewProps {
  language: AppLanguage;
  eqConfigs: EQConfig[];
  dacProfiles: DACProfile[];
  activeDacProfileId: string;
  onSelectDacProfile: (dacProfileId: string) => void;
  onUpdateEqConfig: (updated: EQConfig) => void;
  onRegisterDacProfile: (name: string, connectionType: DACProfile['connectionType']) => void;
  onUpdateDacOutput: (
    dacProfileId: string,
    outputMode: OutputMode,
    sampleRateHz: number,
    bitDepth: number
  ) => void;
  onDeleteDacProfile: (dacProfileId: string) => void;
  onBack?: () => void;
  labels: {
    equalizer: string;
    back: string;
    eqPresets: string;
    eqManual: string;
    eqGlobalProfile: string;
    eqDacProfile: string;
    preamp: string;
    clippingWarning: string;
    spatialAudio: string;
    spatialIntensity: string;
    auditionReset: string;
    replayGain: string;
    dacPanelTitle: string;
    dacScanDevices: string;
    dacRegisterPrompt: string;
    dacRegisterAction: string;
    outputMode: string;
    outputAuto: string;
    outputManual: string;
    sampleRate: string;
    bitDepth: string;
    reset: string;
    confirmRemoveDac: string;
    cancel: string;
    confirm: string;
  };
}

const SPATIAL_PRESETS: Array<{ key: SpatialPreset; label: string }> = [
  { key: 'NARROW', label: 'Narrow' },
  { key: 'NORMAL', label: 'Normal' },
  { key: 'WIDE', label: 'Wide' },
  { key: 'EXTRA_WIDE', label: 'Extra Wide' },
];

export function EqualizerView({
  language,
  eqConfigs,
  dacProfiles,
  activeDacProfileId,
  onSelectDacProfile,
  onUpdateEqConfig,
  onRegisterDacProfile,
  onUpdateDacOutput,
  onDeleteDacProfile,
  onBack,
  labels,
}: EqualizerViewProps) {
  const [profileScope, setProfileScope] = useState<'GLOBAL' | 'DAC'>('GLOBAL');
  const [detectedDeviceHint, setDetectedDeviceHint] = useState<string | null>(null);
  const [dacDeleteConfirmId, setDacDeleteConfirmId] = useState<string | null>(null);

  const activeDac =
    dacProfiles.find((d) => d.dacProfileId === activeDacProfileId) ?? dacProfiles[0];

  const activeEq = useMemo(() => {
    if (profileScope === 'DAC' && activeDac) {
      return eqConfigs.find((e) => e.eqConfigId === activeDac.eqConfigId) ?? eqConfigs[0];
    }
    return eqConfigs.find((e) => e.scope === 'GLOBAL') ?? eqConfigs[0];
  }, [eqConfigs, profileScope, activeDac]);

  const clipping = useMemo(
    () =>
      activeEq
        ? computeClippingRisk(activeEq.preampDb, activeEq.bands)
        : { peakGainDb: 0, hasWarning: false, severity: 'NONE' as const },
    [activeEq]
  );

  const dacValidation = useMemo(() => {
    if (!activeDac) return null;
    return validateDacOutputConfig(
      activeDac,
      activeDac.outputMode,
      activeDac.preferredSampleRateHz,
      activeDac.preferredBitDepth
    );
  }, [activeDac]);

  if (!activeEq) return null;

  const svgWidth = 600;
  const svgHeight = 140;
  const padX = 24;
  const padY = 18;
  const usableW = svgWidth - padX * 2;
  const usableH = svgHeight - padY * 2;

  const curvePoints = activeEq.bands.map((band, idx) => {
    const x = padX + (idx / (activeEq.bands.length - 1)) * usableW;
    const norm = (12 - band.gainDb) / 24;
    const y = padY + norm * usableH;
    return { x, y, band };
  });
  const curvePath = buildSmoothEqCurvePath(curvePoints);

  const handleBandChange = (freqHz: number, gainDb: number) => {
    const nextBands = activeEq.bands.map((b) =>
      b.frequencyHz === freqHz ? { ...b, gainDb: clampGain(gainDb) } : b
    );
    onUpdateEqConfig({
      ...activeEq,
      isManual: true,
      presetKey: 'manual',
      bands: nextBands,
      updatedAt: Date.now(),
    });
  };

  const handlePresetSelect = (presetKey: string) => {
    const preset = EQ_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    onUpdateEqConfig({
      ...activeEq,
      presetKey: preset.key,
      isManual: false,
      bands: activeEq.bands.map((b, idx) => ({
        ...b,
        gainDb: preset.gains[idx] ?? 0,
      })),
      updatedAt: Date.now(),
    });
  };

  const handleResetEq = () => {
    onUpdateEqConfig({
      ...activeEq,
      presetKey: 'flat',
      isManual: false,
      preampDb: 0,
      bands: activeEq.bands.map((b) => ({ ...b, gainDb: 0 })),
      updatedAt: Date.now(),
    });
  };

  const handleDetectAudioHardware = async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        const label =
          outputs.find((o) => o.label && !o.label.toLowerCase().includes('default'))?.label ||
          `External Audio Sink (${outputs.length || 1} detected)`;
        setDetectedDeviceHint(label);
      } else {
        setDetectedDeviceHint('USB-C Hi-Res Audio Bridge');
      }
    } catch {
      setDetectedDeviceHint('Bluetooth / USB-C Audio Output');
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      {onBack && (
        <div className="flex items-center justify-between gap-2">
          <GlassButton
            type="button"
            onClick={onBack}
            aria-label={labels.back}
            className="min-h-[38px] px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{labels.back}</span>
          </GlassButton>
        </div>
      )}

      {/* Single-Column 10-Band EQ Panel */}
      <GlassPanel className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <GlassButton
              type="button"
              active={profileScope === 'GLOBAL'}
              onClick={() => setProfileScope('GLOBAL')}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium"
            >
              {labels.eqGlobalProfile}
            </GlassButton>
            <GlassButton
              type="button"
              active={profileScope === 'DAC'}
              onClick={() => setProfileScope('DAC')}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium"
            >
              {labels.eqDacProfile}
            </GlassButton>
          </div>

          <div className="flex items-center gap-2">
            <select
              id="eq-preset-select"
              aria-label={labels.eqPresets}
              value={activeEq.isManual ? 'manual' : activeEq.presetKey}
              onChange={(e) => {
                if (e.target.value !== 'manual') handlePresetSelect(e.target.value);
              }}
              className="min-h-[38px] px-3 py-1 glass-btn text-xs font-medium text-[var(--muzean-text)]"
            >
              {EQ_PRESETS.map((p) => (
                <option key={p.key} value={p.key} className="bg-[var(--muzean-bg)]">
                  {language === 'id' ? p.labelId : p.labelEn}
                </option>
              ))}
              <option value="manual" className="bg-[var(--muzean-bg)]">{labels.eqManual}</option>
            </select>

            <GlassButton
              type="button"
              onClick={handleResetEq}
              className="min-h-[38px] px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{labels.reset}</span>
            </GlassButton>
          </div>
        </div>

        {/* Real-time Smooth EQ Curve SVG */}
        <div className="glass-inset p-3">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-32 overflow-visible"
            role="img"
            aria-label="10-band equalizer frequency response curve"
          >
            <line x1={padX} y1={padY} x2={svgWidth - padX} y2={padY} stroke="var(--muzean-border)" strokeDasharray="3 3" />
            <line x1={padX} y1={svgHeight / 2} x2={svgWidth - padX} y2={svgHeight / 2} stroke="var(--muzean-border)" strokeWidth="1" />
            <line x1={padX} y1={svgHeight - padY} x2={svgWidth - padX} y2={svgHeight - padY} stroke="var(--muzean-border)" strokeDasharray="3 3" />

            <path
              d={curvePath}
              fill="none"
              stroke="var(--muzean-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {curvePoints.map((pt) => (
              <circle
                key={pt.band.frequencyHz}
                cx={pt.x}
                cy={pt.y}
                r="4"
                fill="var(--muzean-accent-2)"
                stroke="var(--muzean-text)"
                strokeWidth="1.2"
              />
            ))}
          </svg>
        </div>

        {/* 10-Band EQ Strictly Single-Column Stack */}
        <div className="flex flex-col gap-2">
          {EQ_FREQUENCIES_HZ.map((freq) => {
            const band = activeEq.bands.find((b) => b.frequencyHz === freq);
            const gain = band?.gainDb ?? 0;
            const freqLabel = freq >= 1000 ? `${freq / 1000} kHz` : `${freq} Hz`;
            return (
              <div
                key={freq}
                className="flex items-center gap-3 px-2 py-1.5 rounded-xl border border-[var(--muzean-border)] glass-zoom"
              >
                <span className="font-mono-tabular text-xs text-[var(--muzean-text-muted)] w-16 shrink-0">
                  {freqLabel}
                </span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={gain}
                  onChange={(e) => handleBandChange(freq, Number(e.target.value))}
                  aria-label={`${freqLabel} gain`}
                  className="flex-1 accent-[var(--muzean-accent)] cursor-pointer"
                />
                <span className="font-mono-tabular text-xs font-semibold text-[var(--muzean-accent-2)] w-14 text-right shrink-0">
                  {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)} dB
                </span>
              </div>
            );
          })}
        </div>

        {clipping.hasWarning && (
          <div className="p-3 rounded-2xl border border-amber-500/70 text-xs flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {labels.clippingWarning} (Peak: +{clipping.peakGainDb} dB)
            </span>
          </div>
        )}
      </GlassPanel>

      {/* Single-Column Preamp & ReplayGain */}
      <GlassPanel className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="preamp-slider" className="font-neon-script text-xl leading-snug pr-2">
            {labels.preamp}
          </label>
          <span className="font-mono-tabular text-xs font-semibold text-[var(--muzean-accent)]">
            {activeEq.preampDb > 0 ? `+${activeEq.preampDb.toFixed(1)}` : activeEq.preampDb.toFixed(1)} dB
          </span>
        </div>
        <input
          id="preamp-slider"
          type="range"
          min={-12}
          max={12}
          step={0.5}
          value={activeEq.preampDb}
          onChange={(e) =>
            onUpdateEqConfig({
              ...activeEq,
              preampDb: Number(e.target.value),
              updatedAt: Date.now(),
            })
          }
          className="w-full accent-[var(--muzean-accent)]"
        />

        <div className="pt-3 border-t border-[var(--muzean-border)] flex items-center justify-between gap-3">
          <span className="text-xs font-medium">{labels.replayGain}</span>
          <GlassButton
            type="button"
            role="switch"
            tone={activeEq.replayGainAlbumEnabled ? 'teal' : 'default'}
            aria-checked={activeEq.replayGainAlbumEnabled}
            onClick={() =>
              onUpdateEqConfig({
                ...activeEq,
                replayGainAlbumEnabled: !activeEq.replayGainAlbumEnabled,
                updatedAt: Date.now(),
              })
            }
            className="min-h-[38px] px-4 py-1 text-xs font-semibold"
          >
            {activeEq.replayGainAlbumEnabled ? 'ON' : 'OFF'}
          </GlassButton>
        </div>
      </GlassPanel>

      {/* Single-Column Spatial Audio */}
      <GlassPanel className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-neon-script text-xl leading-snug pr-2">{labels.spatialAudio}</span>
          <GlassButton
            type="button"
            onClick={() =>
              onUpdateEqConfig({
                ...activeEq,
                spatialPreset: 'NORMAL',
                spatialIntensity: 25,
                updatedAt: Date.now(),
              })
            }
            className="min-h-[34px] px-3 text-xs"
          >
            {labels.auditionReset}
          </GlassButton>
        </div>

        <div className="flex flex-wrap gap-2">
          {SPATIAL_PRESETS.map((sp) => (
            <GlassButton
              key={sp.key}
              type="button"
              active={activeEq.spatialPreset === sp.key}
              onClick={() =>
                onUpdateEqConfig({
                  ...activeEq,
                  spatialPreset: sp.key,
                  updatedAt: Date.now(),
                })
              }
              className="min-h-[38px] px-3.5 py-1 text-xs font-medium"
            >
              {sp.label}
            </GlassButton>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span>{labels.spatialIntensity}</span>
            <span className="font-mono-tabular">{activeEq.spatialIntensity}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={activeEq.spatialIntensity}
            onChange={(e) =>
              onUpdateEqConfig({
                ...activeEq,
                spatialIntensity: Number(e.target.value),
                updatedAt: Date.now(),
              })
            }
            aria-label={labels.spatialIntensity}
            className="w-full accent-[var(--muzean-accent-2)]"
          />
        </div>
      </GlassPanel>

      {/* Single-Column DAC & Output Panel */}
      <GlassPanel className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-[var(--muzean-accent-2)]" />
            <h3 className="font-neon-script text-xl leading-snug pr-2">{labels.dacPanelTitle}</h3>
          </div>
          <GlassButton
            type="button"
            onClick={handleDetectAudioHardware}
            className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{labels.dacScanDevices}</span>
          </GlassButton>
        </div>

        {detectedDeviceHint && (
          <div className="glass-inset p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Usb className="w-4 h-4 text-[var(--muzean-accent)]" />
              <span>
                {labels.dacRegisterPrompt} <strong>{detectedDeviceHint}</strong>
              </span>
            </div>
            <GlassButton
              type="button"
              tone="accent"
              onClick={() => {
                onRegisterDacProfile(detectedDeviceHint, 'USB_C');
                setDetectedDeviceHint(null);
              }}
              className="min-h-[36px] px-3 py-1 font-semibold"
            >
              {labels.dacRegisterAction}
            </GlassButton>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {dacProfiles.map((dac) => {
            const isSelected = dac.dacProfileId === activeDac?.dacProfileId;
            return (
              <div
                key={dac.dacProfileId}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2 glass-zoom ${
                  isSelected ? 'border-[var(--muzean-accent)]' : 'border-[var(--muzean-border)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDacProfile(dac.dacProfileId)}
                  className="text-left min-w-0 flex-1 min-h-[40px]"
                >
                  <div className="font-outrun text-sm font-semibold truncate">
                    {dac.displayName}
                  </div>
                  <div className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
                    {dac.connectionType} · {dac.preferredSampleRateHz / 1000} kHz / {dac.preferredBitDepth}-bit
                  </div>
                </button>
                {dac.connectionType !== 'BUILTIN' && (
                  <GlassButton
                    type="button"
                    shape="circle"
                    tone="danger"
                    onClick={() => setDacDeleteConfirmId(dac.dacProfileId)}
                    aria-label={`Remove ${dac.displayName}`}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </GlassButton>
                )}
              </div>
            );
          })}
        </div>

        {activeDac && (
          <div className="pt-2 border-t border-[var(--muzean-border)] space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Cpu className="w-4 h-4 text-[var(--muzean-accent-2)]" />
              <span className="font-semibold">{activeDac.displayName}</span>
              <span className="text-[var(--muzean-text-muted)] font-mono-tabular">
                · {activeDac.supportedSampleRates.map((r) => `${r / 1000}k`).join('/')} Hz ·{' '}
                {activeDac.supportedBitDepths.join('/')}-bit
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <div>
                <label htmlFor="dac-output-mode" className="block text-[11px] text-[var(--muzean-text-muted)] mb-1">
                  {labels.outputMode}
                </label>
                <select
                  id="dac-output-mode"
                  value={activeDac.outputMode}
                  onChange={(e) =>
                    onUpdateDacOutput(
                      activeDac.dacProfileId,
                      e.target.value as OutputMode,
                      activeDac.preferredSampleRateHz,
                      activeDac.preferredBitDepth
                    )
                  }
                  className="w-full min-h-[38px] px-3 glass-btn"
                >
                  <option value="AUTOMATIC" className="bg-[var(--muzean-bg)]">{labels.outputAuto}</option>
                  <option value="MANUAL" className="bg-[var(--muzean-bg)]">{labels.outputManual}</option>
                </select>
              </div>

              <div>
                <label htmlFor="dac-sample-rate" className="block text-[11px] text-[var(--muzean-text-muted)] mb-1">
                  {labels.sampleRate}
                </label>
                <select
                  id="dac-sample-rate"
                  disabled={activeDac.outputMode === 'AUTOMATIC'}
                  value={activeDac.preferredSampleRateHz}
                  onChange={(e) =>
                    onUpdateDacOutput(
                      activeDac.dacProfileId,
                      activeDac.outputMode,
                      Number(e.target.value),
                      activeDac.preferredBitDepth
                    )
                  }
                  className="w-full min-h-[38px] px-3 glass-btn disabled:opacity-45"
                >
                  {[44100, 48000, 96000, 192000].map((rate) => (
                    <option key={rate} value={rate} className="bg-[var(--muzean-bg)]">
                      {rate / 1000} kHz
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="dac-bit-depth" className="block text-[11px] text-[var(--muzean-text-muted)] mb-1">
                  {labels.bitDepth}
                </label>
                <select
                  id="dac-bit-depth"
                  disabled={activeDac.outputMode === 'AUTOMATIC'}
                  value={activeDac.preferredBitDepth}
                  onChange={(e) =>
                    onUpdateDacOutput(
                      activeDac.dacProfileId,
                      activeDac.outputMode,
                      activeDac.preferredSampleRateHz,
                      Number(e.target.value)
                    )
                  }
                  className="w-full min-h-[38px] px-3 glass-btn disabled:opacity-45"
                >
                  {[16, 24, 32].map((depth) => (
                    <option key={depth} value={depth} className="bg-[var(--muzean-bg)]">
                      {depth}-bit
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {dacValidation?.fallbackUsed && (
              <div className="p-2.5 rounded-xl border border-amber-500/60 text-amber-400">
                {dacValidation.reason}
              </div>
            )}
          </div>
        )}
      </GlassPanel>

      {dacDeleteConfirmId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-modal max-w-sm w-full p-5 space-y-4">
            <p className="text-sm">{labels.confirmRemoveDac}</p>
            <div className="flex justify-end gap-2">
              <GlassButton
                type="button"
                onClick={() => setDacDeleteConfirmId(null)}
                className="min-h-[38px] px-3.5 py-1.5 text-xs"
              >
                {labels.cancel}
              </GlassButton>
              <GlassButton
                type="button"
                tone="danger"
                onClick={() => {
                  onDeleteDacProfile(dacDeleteConfirmId);
                  setDacDeleteConfirmId(null);
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
