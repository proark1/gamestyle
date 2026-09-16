import { SiteAudio } from '../../shared/audio/player';
import { driveThruAudioProfile } from './audio/profile';
import type { DriveThruWorld } from './types';

export { driveThruCatalog } from './audio/catalog';
export { driveThruAudioProfile } from './audio/profile';

export class DriveThruAudio {
  private clips: SiteAudio;
  private available = new Set<string>();
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabledState = true;
  private lastProcessedEventId = 0;

  constructor() {
    this.clips = new SiteAudio('drive-thru', {
      ...driveThruAudioProfile,
      prepareManifest: (manifest) => {
        this.available = new Set(Object.keys(manifest.cues));
        return manifest;
      },
    });
  }

  get enabled(): boolean {
    return this.enabledState;
  }

  set enabled(v: boolean) {
    this.enabledState = v;
    this.clips.enabled = v;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(
        v ? 0.2 : 0,
        this.context.currentTime,
        0.03,
      );
    }
  }

  unlock(): void {
    this.clips.unlock();
    try {
      if (!this.context) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.context = new AudioCtx();
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.enabledState ? 0.2 : 0;
        this.masterGain.connect(this.context.destination);

        // Pre-create 1-second white noise buffer for crackles & sizzles
        const bufferSize = this.context.sampleRate;
        this.noiseBuffer = this.context.createBuffer(
          1,
          bufferSize,
          this.context.sampleRate,
        );
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
    } catch {
      // AudioContext unavailable
    }
  }

  update(world: DriveThruWorld | null): void {
    if (!world) return;

    // Check for newly fired events
    for (const event of world.events) {
      if (event.id > this.lastProcessedEventId) {
        this.lastProcessedEventId = event.id;
        this.triggerEventAudio(event.kind);
      }
    }
  }

  triggerEventAudio(kind: string): void {
    const cueId = `event.${kind.replace('_', '-')}`;
    if (this.available.has(cueId)) {
      this.clips.play(cueId);
    } else {
      this.playSynthesizedFallback(kind);
    }
  }

  playSynthesizedFallback(kind: string): void {
    if (!this.context || !this.masterGain || !this.enabledState) return;
    const ctx = this.context;
    const t = ctx.currentTime;

    switch (kind) {
      case 'horn_honked': {
        // Dual-tone car horn (392Hz + 440Hz)
        for (const freq of [392, 440]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + 0.38);
        }
        break;
      }

      case 'patty_flipped': {
        // Slapdown wet slap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      }

      case 'shake_vented': {
        // Pressurized steam hiss
        if (!this.noiseBuffer) return;
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2800, t);
        filter.Q.setValueAtTime(4.0, t);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.38);
        break;
      }

      case 'pole_crashed': {
        // Heavy metallic dent and crunch
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.55);
        break;
      }

      case 'order_delivered':
      case 'round_win': {
        // Cheerful register bell (523Hz -> 659Hz)
        [523, 659].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = t + idx * 0.12;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(start);
          osc.stop(start + 0.5);
        });
        break;
      }

      case 'meltdown':
      case 'grease_fire': {
        // High panic siren
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(700, t);
        osc.frequency.linearRampToValueAtTime(950, t + 0.25);
        osc.frequency.linearRampToValueAtTime(700, t + 0.5);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.75);
        break;
      }
    }
  }

  dispose(): void {
    this.clips.dispose();
    if (this.context) {
      void this.context.close().catch(() => {});
    }
  }
}
