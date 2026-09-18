import { SiteAudio } from '../../shared/audio/player';
import { chainOfFoolsAudioProfile } from './audio/profile';
import type { ChainWorld, GameEvent } from './types';
export { chainOfFoolsCatalog } from './audio/catalog';

const CUES: Record<GameEvent['type'], string | null> = {
  jump: 'move.jump',
  land: 'move.land',
  chain_taut: 'chain.yank',
  chain_yank: 'chain.yank',
  brace: 'event.ping',
  dangle: 'chain.dangle',
  haul_start: 'chain.haul',
  haul_done: 'chain.saved',
  limp: 'hazard.limp',
  revive: 'chain.saved',
  clip: 'chain.clip',
  unclip: 'chain.clip',
  checkpoint: 'event.checkpoint',
  wipe: 'event.wipe',
  pendulum_swing: 'hazard.wrecking',
  plank_tip: 'hazard.plank',
  win: 'event.win',
  timeout: 'event.fail',
};

type Tone = {
  wave: OscillatorType;
  from: number;
  to: number;
  length: number;
  level: number;
  delay?: number;
};

/**
 * Small synthesized stand-ins, so the site is never silent before anyone has
 * generated recordings in the workshop. Each is a handful of shaped tones.
 */
const SYNTH: Record<string, Tone[]> = {
  'move.jump': [
    { wave: 'triangle', from: 260, to: 520, length: 0.09, level: 0.18 },
  ],
  'move.land': [{ wave: 'sine', from: 150, to: 60, length: 0.1, level: 0.35 }],
  'chain.yank': [
    { wave: 'square', from: 900, to: 420, length: 0.05, level: 0.12 },
    {
      wave: 'square',
      from: 1300,
      to: 700,
      length: 0.05,
      level: 0.1,
      delay: 0.04,
    },
    { wave: 'triangle', from: 220, to: 110, length: 0.12, level: 0.25 },
  ],
  'chain.dangle': [
    { wave: 'sawtooth', from: 700, to: 180, length: 0.35, level: 0.14 },
    {
      wave: 'square',
      from: 1100,
      to: 600,
      length: 0.06,
      level: 0.12,
      delay: 0.34,
    },
    { wave: 'sine', from: 140, to: 70, length: 0.18, level: 0.4, delay: 0.34 },
  ],
  'chain.haul': [
    { wave: 'square', from: 800, to: 760, length: 0.04, level: 0.08 },
    {
      wave: 'square',
      from: 820,
      to: 780,
      length: 0.04,
      level: 0.08,
      delay: 0.14,
    },
    {
      wave: 'square',
      from: 840,
      to: 800,
      length: 0.04,
      level: 0.08,
      delay: 0.28,
    },
  ],
  'chain.saved': [
    { wave: 'triangle', from: 523, to: 523, length: 0.12, level: 0.22 },
    {
      wave: 'triangle',
      from: 784,
      to: 784,
      length: 0.2,
      level: 0.22,
      delay: 0.1,
    },
  ],
  'chain.clip': [
    { wave: 'square', from: 2200, to: 1600, length: 0.03, level: 0.12 },
    {
      wave: 'triangle',
      from: 1400,
      to: 900,
      length: 0.06,
      level: 0.12,
      delay: 0.03,
    },
  ],
  'hazard.limp': [
    { wave: 'sine', from: 180, to: 45, length: 0.3, level: 0.5 },
    {
      wave: 'triangle',
      from: 900,
      to: 300,
      length: 0.25,
      level: 0.1,
      delay: 0.05,
    },
  ],
  'hazard.wrecking': [
    { wave: 'sine', from: 110, to: 35, length: 0.45, level: 0.6 },
    { wave: 'sawtooth', from: 400, to: 90, length: 0.2, level: 0.12 },
  ],
  'hazard.plank': [
    { wave: 'sawtooth', from: 180, to: 260, length: 0.3, level: 0.1 },
    { wave: 'sine', from: 200, to: 90, length: 0.12, level: 0.3, delay: 0.28 },
  ],
  'event.checkpoint': [
    { wave: 'triangle', from: 880, to: 880, length: 0.15, level: 0.2 },
    {
      wave: 'triangle',
      from: 1320,
      to: 1320,
      length: 0.3,
      level: 0.18,
      delay: 0.12,
    },
  ],
  'event.wipe': [
    { wave: 'sawtooth', from: 600, to: 80, length: 0.9, level: 0.14 },
    { wave: 'sine', from: 90, to: 30, length: 0.5, level: 0.45, delay: 0.85 },
  ],
  'event.ping': [
    { wave: 'sine', from: 1800, to: 2400, length: 0.1, level: 0.14 },
    {
      wave: 'sine',
      from: 2000,
      to: 2600,
      length: 0.14,
      level: 0.14,
      delay: 0.14,
    },
  ],
  'event.start': [
    { wave: 'sine', from: 2100, to: 2100, length: 0.18, level: 0.14 },
    {
      wave: 'sine',
      from: 2500,
      to: 2500,
      length: 0.3,
      level: 0.14,
      delay: 0.2,
    },
  ],
  'event.win': [
    { wave: 'triangle', from: 392, to: 392, length: 0.16, level: 0.22 },
    {
      wave: 'triangle',
      from: 523,
      to: 523,
      length: 0.16,
      level: 0.22,
      delay: 0.14,
    },
    {
      wave: 'triangle',
      from: 659,
      to: 659,
      length: 0.16,
      level: 0.22,
      delay: 0.28,
    },
    {
      wave: 'triangle',
      from: 784,
      to: 784,
      length: 0.5,
      level: 0.24,
      delay: 0.42,
    },
  ],
  'event.fail': [
    { wave: 'sawtooth', from: 220, to: 150, length: 1.2, level: 0.14 },
    { wave: 'sawtooth', from: 165, to: 110, length: 1.2, level: 0.1 },
  ],
};

class SiteSynth {
  private context: AudioContext | null = null;
  muted = false;

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.context) {
      const Context =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Context) this.context = new Context();
    }
    if (this.context?.state === 'suspended') void this.context.resume();
  }

  play(id: string, strength = 1) {
    const tones = SYNTH[id];
    const context = this.context;
    if (!tones || !context || this.muted || context.state !== 'running') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const start = context.currentTime;
    for (const tone of tones) {
      const at = start + (tone.delay ?? 0);
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = tone.wave;
      osc.frequency.setValueAtTime(tone.from, at);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, tone.to),
        at + tone.length,
      );
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(tone.level * strength, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.length);
      osc.connect(gain).connect(context.destination);
      osc.start(at);
      osc.stop(at + tone.length + 0.02);
    }
  }

  dispose() {
    void this.context?.close();
    this.context = null;
  }
}

/** Events a player hears from anywhere; the rest fade with distance. */
const EVERYWHERE = new Set<GameEvent['type']>([
  'checkpoint',
  'wipe',
  'win',
  'timeout',
  'dangle',
]);

export class ChainOfFoolsSound extends SiteAudio {
  private lastEvent = 0;
  private lastPhase: ChainWorld['phase'] = 'lobby';
  private synth = new SiteSynth();
  private synthRecent = new Map<string, number>();

  constructor() {
    super('chain-of-fools', chainOfFoolsAudioProfile);
  }

  override unlock() {
    super.unlock();
    this.synth.unlock();
  }

  /** Mutes recordings and the synthesized stand-ins together. */
  setMuted(muted: boolean) {
    this.enabled = !muted;
    this.synth.muted = muted;
  }

  /** A workshop recording when there is one, otherwise the synthesized cue. */
  private cue(
    id: string,
    at?: { x: number; y: number; z: number },
    source?: string,
    strength = 1,
  ) {
    if (this.preferredCue(id, '')) {
      this.play(id, strength, at, source);
      return;
    }
    const now = performance.now();
    if (now - (this.synthRecent.get(id) ?? -1000) < 70) return;
    this.synthRecent.set(id, now);
    this.synth.play(id, strength);
  }

  update(world: ChainWorld | null, localId?: string) {
    const me = world?.players.find((p) => p.id === localId);
    this.listen(me ? { x: me.x, y: me.y, z: me.z } : { x: 0, y: 0, z: 0 }, 0);
    this.setLoop(
      'site',
      world?.phase === 'playing' && this.preferredCue('ambience.site', '')
        ? 'ambience.site'
        : null,
      0.4,
    );
    if (!world) return;

    for (const event of world.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const id = CUES[event.type];
      if (!id) continue;
      // Only the local worker's own footsteps; four sets of them is noise.
      if (
        (event.type === 'jump' || event.type === 'land') &&
        event.playerId !== localId
      )
        continue;

      const player = world.players.find((p) => p.id === event.playerId);
      const at = EVERYWHERE.has(event.type)
        ? undefined
        : event.pos
          ? { x: event.pos[0], y: event.pos[1], z: event.pos[2] }
          : player
            ? { x: player.x, y: player.y, z: player.z }
            : undefined;
      if (at && me && Math.hypot(at.x - me.x, at.z - me.z) > 40) continue;
      this.cue(id, at, String(event.id));
    }

    if (world.phase !== this.lastPhase) {
      if (world.phase === 'playing') this.cue('event.start');
      this.lastPhase = world.phase;
    }
  }

  override reset() {
    super.reset();
    this.lastEvent = 0;
    this.lastPhase = 'lobby';
  }

  override dispose() {
    super.dispose();
    this.synth.dispose();
  }
}
