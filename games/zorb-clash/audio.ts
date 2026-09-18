/**
 * Procedural Web Audio synthesizer for Zorb Clash.
 * Provides hyper-bouncy bumper bonks, spring cushions, dash whooshes,
 * and goal fanfare without requiring external asset downloads.
 */

export { zorbClashCatalog } from './audio/catalog';

const MASTER_LEVEL = 0.35;

export class ZorbClashAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private unlocked = false;
  private muted = false;

  /** The toolbar's sound switch: silences everything through the master bus. */
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : MASTER_LEVEL;
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : MASTER_LEVEL;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Audio not supported or blocked
    }
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.unlocked = true;
  }

  bonk(intensity = 0.5) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0.2, Math.min(1.0, intensity));

    // Low punchy sine sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = 180 + clamped * 120;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

    gain.gain.setValueAtTime(0.7 * clamped, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.22);

    // Comic rubber boing overtone
    const boing = this.ctx.createOscillator();
    const boingGain = this.ctx.createGain();
    boing.type = 'triangle';
    boing.frequency.setValueAtTime(320, t);
    boing.frequency.linearRampToValueAtTime(140, t + 0.15);

    boingGain.gain.setValueAtTime(0.4 * clamped, t);
    boingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    boing.connect(boingGain);
    boingGain.connect(this.masterGain);

    boing.start(t);
    boing.stop(t + 0.16);
  }

  springCushion() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  setDashCharge(charge: number) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    if (charge <= 0.05) {
      if (this.chargeGain) {
        this.chargeGain.gain.setValueAtTime(0, t);
      }
      return;
    }

    if (!this.chargeOsc) {
      this.chargeOsc = this.ctx.createOscillator();
      this.chargeGain = this.ctx.createGain();
      this.chargeOsc.type = 'sine';
      this.chargeGain.gain.value = 0;
      this.chargeOsc.connect(this.chargeGain);
      this.chargeGain.connect(this.masterGain);
      this.chargeOsc.start();
    }

    const targetFreq = 160 + charge * 440;
    this.chargeOsc.frequency.setValueAtTime(targetFreq, t);
    this.chargeGain?.gain.setValueAtTime(Math.min(0.3, charge * 0.3), t);
  }

  dashRelease() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    if (this.chargeGain) {
      this.chargeGain.gain.setValueAtTime(0, t);
    }

    // Whoosh noise / explosive boost
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(150, t + 0.25);
    filter.Q.value = 2.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
  }

  brace() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  turtle() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Comic downward slide whistle
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(550, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.4);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  goal(isTurtle: boolean) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Stadium Airhorn
    const freqs = [311.13, 370.0, 466.16]; // Eb Minor triad horn
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.setValueAtTime(0.2, t + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.9);
    }

    if (isTurtle) {
      // Extra celebratory high trill for style points
      const trill = this.ctx.createOscillator();
      const trillGain = this.ctx.createGain();
      trill.type = 'triangle';
      trill.frequency.setValueAtTime(880, t + 0.2);
      trill.frequency.exponentialRampToValueAtTime(1320, t + 0.7);

      trillGain.gain.setValueAtTime(0.25, t + 0.2);
      trillGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      trill.connect(trillGain);
      trillGain.connect(this.masterGain);

      trill.start(t + 0.2);
      trill.stop(t + 0.7);
    }
  }

  whistle() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.setValueAtTime(2600, t + 0.08);
    osc.frequency.setValueAtTime(2400, t + 0.16);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.setValueAtTime(0.3, t + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  destroy() {
    try {
      this.chargeOsc?.stop();
      this.chargeOsc?.disconnect();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}
