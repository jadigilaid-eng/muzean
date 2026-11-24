import { EQ_FREQUENCIES_HZ } from '../domain/audioMath';
import type { EQConfig, SpatialPreset } from '../domain/types';

/**
 * Generates a real stereo WAV Blob for built-in synthwave/vaporwave seed tracks
 * so playback, progress seeking, 10-band EQ, spatial audio, and FFT visualizers
 * operate on genuine PCM audio without external network requests.
 */
function generateSynthVaporwaveWavUrl(presetIndex: number, durationMs: number): string {
  const sampleRate = 22050;
  const seconds = Math.max(8, Math.min(35, Math.round(durationMs / 1000) || 24));
  const totalSamples = sampleRate * seconds;
  const numChannels = 2;
  const byteRate = sampleRate * numChannels * 2;
  const dataSize = totalSamples * numChannels * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Chord progressions per preset
  const progressions = [
    [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 392.0], // G6
      [164.81, 196.0, 246.94, 293.66], // Em7
    ],
    [
      [196.0, 246.94, 293.66, 369.99], // Gmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
    ],
    [
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [196.0, 246.94, 293.66, 349.23], // G7
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 440.0], // Am
    ],
    [
      [233.08, 293.66, 349.23, 440.0], // Bbmaj7
      [196.0, 233.08, 293.66, 349.23], // Gm7
      [261.63, 311.13, 392.0, 466.16], // Cm7
      [174.61, 220.0, 261.63, 349.23], // F7
    ],
    [
      [246.94, 293.66, 369.99, 440.0], // Bm7
      [196.0, 246.94, 293.66, 369.99], // Gmaj7
      [146.83, 185.0, 220.0, 277.18], // Dmaj7
      [185.0, 220.0, 277.18, 329.63], // F#m7
    ],
    [
      [164.81, 207.65, 246.94, 311.13], // Emaj7
      [138.59, 164.81, 207.65, 246.94], // C#m7
      [220.0, 277.18, 329.63, 415.3], // Amaj7
      [246.94, 311.13, 369.99, 440.0], // B7
    ],
  ];

  const chords = progressions[presetIndex % progressions.length];
  const barSec = 2.0;

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.floor(t / barSec) % chords.length;
    const chord = chords[chordIdx];
    const barPos = (t % barSec) / barSec;

    // Warm detuned pad + bass + dreamy arp
    let padL = 0;
    let padR = 0;
    for (let n = 0; n < chord.length; n++) {
      const f = chord[n];
      const detune = 1 + (n % 2 === 0 ? 0.0025 : -0.0025);
      padL += Math.sin(2 * Math.PI * f * t) * 0.12;
      padR += Math.sin(2 * Math.PI * f * detune * t + 0.3) * 0.12;
    }

    const bassFreq = chord[0] * 0.5;
    const bassPulse = Math.exp(-3.5 * ((t * 2) % 1));
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.24 * (0.4 + 0.6 * bassPulse);

    const arpNote = chord[Math.floor(t * 4) % chord.length] * 2;
    const arpEnv = Math.exp(-8 * ((t * 4) % 1));
    const arp = Math.sin(2 * Math.PI * arpNote * t) * 0.11 * arpEnv;

    const fadeIn = Math.min(1, t / 0.4);
    const fadeOut = Math.min(1, (seconds - t) / 0.6);
    const lfo = 0.88 + 0.12 * Math.sin(2 * Math.PI * 0.25 * t);
    const env = fadeIn * fadeOut * lfo * (0.9 + 0.1 * Math.sin(Math.PI * barPos));

    const sampleL = Math.max(-0.95, Math.min(0.95, (padL + bass + arp * 0.8) * env));
    const sampleR = Math.max(-0.95, Math.min(0.95, (padR + bass + arp * 1.1) * env));

    view.setInt16(offset, Math.round(sampleL * 32767), true);
    view.setInt16(offset + 2, Math.round(sampleR * 32767), true);
    offset += 4;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export class MuzeanAudioEngine {
  private ctx: AudioContext | null = null;
  private audioEl: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private preampNode: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private spatialDelayL: DelayNode | null = null;
  private spatialDelayR: DelayNode | null = null;
  private spatialWetGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private synthUrlCache = new Map<string, string>();
  private eqState: EQConfig | null = null;

  constructor() {
    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';
    this.audioEl.crossOrigin = 'anonymous';
  }

  private ensureGraph(): void {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    this.sourceNode = ctx.createMediaElementSource(this.audioEl);
    this.preampNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.spatialWetGain = ctx.createGain();
    this.spatialDelayL = ctx.createDelay(0.05);
    this.spatialDelayR = ctx.createDelay(0.05);
    this.masterGain = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.78;

    this.eqFilters = EQ_FREQUENCIES_HZ.map((freq, idx) => {
      const filter = ctx.createBiquadFilter();
      filter.type = idx === 0 ? 'lowshelf' : idx === EQ_FREQUENCIES_HZ.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = 0;
      return filter;
    });

    // Connect source -> preamp -> 10-band EQ chain
    this.sourceNode.connect(this.preampNode);
    let prev: AudioNode = this.preampNode;
    for (const f of this.eqFilters) {
      prev.connect(f);
      prev = f;
    }

    // Dry + subtle Haas spatial width path
    prev.connect(this.dryGain);
    this.dryGain.connect(this.analyser);

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    prev.connect(splitter);
    splitter.connect(this.spatialDelayL, 1);
    splitter.connect(this.spatialDelayR, 0);
    this.spatialDelayL.connect(merger, 0, 0);
    this.spatialDelayR.connect(merger, 0, 1);
    merger.connect(this.spatialWetGain);
    this.spatialWetGain.connect(this.analyser);

    this.analyser.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    if (this.eqState) {
      this.applyEqConfig(this.eqState);
    }
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audioEl;
  }

  public async loadAndPlay(params: {
    trackKey: string;
    objectUrl?: string;
    synthPresetIndex?: number;
    durationMs: number;
    autoplay: boolean;
    crossfadeSec?: number;
  }): Promise<void> {
    this.ensureGraph();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }

    let url = params.objectUrl;
    if (!url) {
      const cacheKey = `${params.trackKey}_${params.synthPresetIndex ?? 0}`;
      url = this.synthUrlCache.get(cacheKey);
      if (!url) {
        url = generateSynthVaporwaveWavUrl(params.synthPresetIndex ?? 0, params.durationMs);
        this.synthUrlCache.set(cacheKey, url);
      }
    }

    if (this.audioEl.src !== url) {
      this.audioEl.src = url;
      this.audioEl.load();
    }

    if (params.autoplay) {
      if (this.masterGain && this.ctx && params.crossfadeSec && params.crossfadeSec > 0) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(0.05, now);
        this.masterGain.gain.linearRampToValueAtTime(1.0, now + Math.min(2.5, params.crossfadeSec * 0.4));
      }
      await this.audioEl.play().catch(() => {});
    }
  }

  public async play(): Promise<void> {
    this.ensureGraph();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
    await this.audioEl.play().catch(() => {});
  }

  public pause(): void {
    this.audioEl.pause();
  }

  public seekMs(ms: number): void {
    if (!Number.isFinite(ms)) return;
    this.audioEl.currentTime = Math.max(0, ms / 1000);
  }

  public applyEqConfig(eq: EQConfig): void {
    this.eqState = eq;
    if (!this.ctx || !this.preampNode || this.eqFilters.length === 0) return;

    const now = this.ctx.currentTime;
    const replayGainOffsetDb = eq.replayGainAlbumEnabled ? -2.5 : 0;
    const linearPreamp = Math.pow(10, (eq.preampDb + replayGainOffsetDb) / 20);
    this.preampNode.gain.setTargetAtTime(linearPreamp, now, 0.03);

    eq.bands.forEach((band, idx) => {
      const filter = this.eqFilters[idx];
      if (filter) {
        filter.gain.setTargetAtTime(band.gainDb, now, 0.03);
      }
    });

    this.applySpatial(eq.spatialPreset, eq.spatialIntensity);
  }

  private applySpatial(preset: SpatialPreset, intensity: number): void {
    if (!this.ctx || !this.spatialDelayL || !this.spatialDelayR || !this.spatialWetGain || !this.dryGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const norm = Math.max(0, Math.min(1, intensity / 100));
    const presetDelayMap: Record<SpatialPreset, number> = {
      NARROW: 0.002,
      NORMAL: 0.006,
      WIDE: 0.013,
      EXTRA_WIDE: 0.022,
    };
    const presetWetScale: Record<SpatialPreset, number> = {
      NARROW: 0.05,
      NORMAL: 0.16,
      WIDE: 0.28,
      EXTRA_WIDE: 0.42,
    };

    const delay = presetDelayMap[preset];
    this.spatialDelayL.delayTime.setTargetAtTime(delay, now, 0.04);
    this.spatialDelayR.delayTime.setTargetAtTime(delay * 1.15, now, 0.04);
    this.spatialWetGain.gain.setTargetAtTime(presetWetScale[preset] * norm, now, 0.04);
    this.dryGain.gain.setTargetAtTime(1 - presetWetScale[preset] * norm * 0.25, now, 0.04);
  }

  public getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false;
    this.analyser.getByteFrequencyData(target);
    return true;
  }

  public getTimeDomainData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false;
    this.analyser.getByteTimeDomainData(target);
    return true;
  }
}
