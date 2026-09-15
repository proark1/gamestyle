import { SiteAudio } from '../../shared/audio/player';
import { basketballAudioProfile } from './audio/profile';
import type { BasketballWorld, GameEvent } from './types';
export { basketballCatalog } from './audio/catalog';

const CUES: Record<GameEvent['type'], string | null> = {
  bounce: 'event.bounce',
  rim: 'event.rim',
  backboard: 'event.backboard',
  swish: 'event.swish',
  dunk: 'event.dunk',
  superdunk: 'event.superdunk',
  squeak: 'event.squeak',
  steal: 'event.steal',
  pass: 'event.pass',
  whistle: 'event.whistle',
  buzzer: 'event.buzzer',
};

class ProceduralBasketballAudio {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  unlock(): void {
    this.getContext();
  }

  play(type: GameEvent['type'], volume = 1): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    try {
      if (type === 'bounce') {
        // Low rubber thud + slight pitch drop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
        gain.gain.setValueAtTime(0.55 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (type === 'rim') {
        // Metallic dual tone with decay
        for (const freq of [520, 890]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.4 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.36);
        }
      } else if (type === 'backboard') {
        // Hollow wood/acrylic thud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(95, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
        gain.gain.setValueAtTime(0.6 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'swish') {
        // Filtered white noise burst for net rustle
        const bufferSize = ctx.sampleRate * 0.25;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] =
            (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.Q.setValueAtTime(3.5, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.7 * volume, now);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (type === 'dunk' || type === 'superdunk') {
        // Heavy bass boom + metallic rattle + whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(type === 'superdunk' ? 160 : 120, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);
        gain.gain.setValueAtTime(0.85 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.42);

        // Clatter
        for (const freq of [440, 780, 1150]) {
          const mOsc = ctx.createOscillator();
          const mGain = ctx.createGain();
          mOsc.type = 'triangle';
          mOsc.frequency.setValueAtTime(freq, now);
          mGain.gain.setValueAtTime(
            (type === 'superdunk' ? 0.45 : 0.3) * volume,
            now,
          );
          mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          mOsc.connect(mGain);
          mGain.connect(ctx.destination);
          mOsc.start(now);
          mOsc.stop(now + 0.32);
        }
      } else if (type === 'squeak') {
        // High pitched rubber chirp
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
        gain.gain.setValueAtTime(0.25 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'whistle') {
        // Dual tone high referee whistle
        for (const freq of [2200, 2480]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.3 * volume, now);
          gain.gain.setValueAtTime(0.3 * volume, now + 0.25);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.46);
        }
      } else if (type === 'buzzer') {
        // Stadium buzzer square wave
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        gain.gain.setValueAtTime(0.45 * volume, now);
        gain.gain.setValueAtTime(0.45 * volume, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.12);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  }
}

export class BasketballSound extends SiteAudio {
  private lastEvent = 0;
  private lastPhase: BasketballWorld['phase'] = 'lobby';
  private synth = new ProceduralBasketballAudio();

  constructor() {
    super('basketball', basketballAudioProfile);
    this.update(null);
  }

  override unlock(): void {
    super.unlock();
    this.synth.unlock();
  }

  update(world: BasketballWorld | null, localId?: string): void {
    const me = world?.players.find((p) => p.id === localId);
    this.listen(me ?? { x: 0, y: 1.6, z: 2 }, 0);

    const playing = world?.phase === 'playing';
    this.setLoop('court', playing ? 'ambience.court' : null, 0.25);

    if (!world) return;

    for (const event of world.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;

      // 1. Play synthetic immediate audio
      this.synth.play(event.type, 1.0);

      // 2. Play from SiteAudio if asset exists
      const cue = CUES[event.type];
      if (cue) {
        this.play(cue, 1, me ?? { x: 0, y: 1.6, z: 0 }, String(event.id));
      }
    }

    if (world.phase !== this.lastPhase) {
      if (world.phase === 'ended') {
        this.synth.play('buzzer', 1.0);
        this.play('event.win', 1);
      }
      this.lastPhase = world.phase;
    }
  }

  override reset(): void {
    super.reset();
    this.lastEvent = 0;
    this.lastPhase = 'lobby';
  }
}
