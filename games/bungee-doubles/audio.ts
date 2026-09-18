import { SiteAudio } from '../../shared/audio/player';
import { bungeeDoublesAudioProfile } from './audio/profile';
import type { BungeeWorld, GameEvent } from './types';
export { bungeeDoublesCatalog } from './audio/catalog';

const CUES: Record<GameEvent['type'], string | null> = {
  racket_hit: 'event.racket_hit',
  smash_hit: 'event.smash_hit',
  ball_bounce: 'event.ball_bounce',
  net_hit: 'event.net_hit',
  bungee_stretch: 'event.bungee_stretch',
  bungee_snap: 'event.bungee_snap',
  partner_bonk: 'event.partner_bonk',
  point_scored: 'event.point_scored',
  game_won: 'event.game_won',
  dive: 'event.dive',
  whistle: 'event.point_scored',
  cheer: 'event.point_scored',
  slingshot: 'event.bungee_snap',
  wall_rebound: 'event.ball_bounce',
};

class ProceduralBungeeAudio {
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
      if (type === 'racket_hit') {
        // Crisp racket thwack: sine click + resonant mid
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(460, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
        gain.gain.setValueAtTime(0.7 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
      } else if (type === 'smash_hit') {
        // Heavy explosive smash: low thud + bright snap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
        gain.gain.setValueAtTime(0.9 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'ball_bounce') {
        // Hollow court bounce
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.08);
        gain.gain.setValueAtTime(0.5 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'wall_rebound') {
        // Glass / mesh rebound thud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(130, now + 0.11);
        gain.gain.setValueAtTime(0.65 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'net_hit') {
        // Metallic / tape buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
        gain.gain.setValueAtTime(0.4 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'bungee_snap' || type === 'slingshot') {
        // Cartoon spring boing / twang
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.3);
        gain.gain.setValueAtTime(0.65 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.31);
      } else if (type === 'partner_bonk') {
        // Comical wooden bonk
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.14);
        gain.gain.setValueAtTime(0.85 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'point_scored' || type === 'whistle') {
        // Referee whistle
        for (const freq of [2100, 2450]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.25 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.29);
        }
      } else if (type === 'game_won') {
        // Victorious 4-note chord (C, E, G, High C)
        const notes = [261.6, 329.6, 392.0, 523.2];
        notes.forEach((freq, idx) => {
          const noteTime = now + idx * 0.12;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteTime);
          gain.gain.setValueAtTime(0.35 * volume, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(noteTime);
          osc.stop(noteTime + 0.62);
        });
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  }
}

export class BungeeDoublesSound extends SiteAudio {
  private lastProcessedEvent = 0;
  private procedural = new ProceduralBungeeAudio();

  constructor() {
    super('bungee-doubles', bungeeDoublesAudioProfile);
  }

  override unlock(): void {
    super.unlock();
    this.procedural.unlock();
  }

  update(world: BungeeWorld, _localId: string): void {
    for (const evt of world.events) {
      if (evt.id <= this.lastProcessedEvent) continue;
      this.lastProcessedEvent = evt.id;

      const cueId = CUES[evt.type];
      // The procedural sound bypasses SiteAudio's master gain, so the game's
      // mute has to stop it here.
      if (cueId && this.enabled) {
        // Fallback procedural sound plays immediately
        this.procedural.play(evt.type);
      }
    }
  }
}
