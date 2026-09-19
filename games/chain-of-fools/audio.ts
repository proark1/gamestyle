import { SiteAudio } from '../../shared/audio/player';
import { audioPreferencesSnapshot } from '../../shared/audio/preferences';
import { SITE_RANGE, chainOfFoolsAudioProfile } from './audio/profile';
import {
  admitLine,
  chainAmbience,
  chainAudioStep,
  chainMusic,
  type ChainAudioFrame,
  type ChainCue,
} from './audio-events';
import type { ChainWorld } from './types';
export { chainOfFoolsCatalog } from './audio/catalog';

/**
 * Stereo heading for the default crew camera, which looks down the course
 * (+x) with +z on the right of the screen. The scene passes its live camera.
 */
export const COURSE_YAW = -Math.PI / 2;

const LOOP_CHANNELS = ['music', 'site', 'wind', 'crane', 'chain', 'strain'];

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
  'chain.unclip': [
    { wave: 'triangle', from: 900, to: 1400, length: 0.06, level: 0.12 },
    {
      wave: 'square',
      from: 1600,
      to: 2200,
      length: 0.03,
      level: 0.1,
      delay: 0.06,
    },
  ],
  'chain.taut': [
    { wave: 'square', from: 1100, to: 650, length: 0.04, level: 0.08 },
    { wave: 'triangle', from: 200, to: 120, length: 0.08, level: 0.16 },
  ],
  'event.tick': [
    { wave: 'square', from: 1500, to: 1400, length: 0.03, level: 0.08 },
  ],
  'event.clockin': [
    { wave: 'triangle', from: 660, to: 660, length: 0.12, level: 0.18 },
    {
      wave: 'triangle',
      from: 990,
      to: 990,
      length: 0.25,
      level: 0.16,
      delay: 0.1,
    },
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
    // The site-wide volume the recordings follow applies to the stand-ins too.
    const level = strength * audioPreferencesSnapshot().volume;
    if (level <= 0.001) return;
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
      gain.gain.exponentialRampToValueAtTime(tone.level * level, at + 0.01);
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

type Point = { x: number; y: number; z: number };

/**
 * Chain of Fools on the collection's audio runtime: workshop recordings, the
 * owner's mix, speech ducking, pausing on a hidden tab. `audio-events.ts`
 * decides what sounds; this class only plays it, falling back to the
 * synthesized stand-ins for anything nobody has recorded yet.
 */
export class ChainOfFoolsSound extends SiteAudio {
  private frame: ChainAudioFrame | null = null;
  private synth = new SiteSynth();
  private synthRecent = new Map<string, number>();
  private ear: Point = { x: 0, y: 0, z: 0 };
  /** World clock of the last line the commentator was allowed to say. */
  private lastLine = -Infinity;
  /** World clock each line was last said, so the same joke is not repeated. */
  private said = new Map<string, number>();

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

  /**
   * One tick of the shift. `yaw` is the camera's stereo heading, so a sound on
   * the right of the screen comes out of the right speaker.
   */
  update(world: ChainWorld | null, localId = '', yaw = COURSE_YAW) {
    if (!world) {
      this.frame = null;
      for (const channel of LOOP_CHANNELS) this.setLoop(channel, null);
      return;
    }
    const previous = this.frame;
    // A late packet from the same shift never rewinds the comparison.
    if (
      previous &&
      previous.started === world.started &&
      world.clock < previous.clock
    )
      return;
    const step = chainAudioStep(previous, world, localId);
    if (step.fresh) this.reset();
    else if (
      world.phase === 'playing' &&
      world.startedAt !== previous?.startedAt
    )
      this.forgetLines();
    this.frame = step.frame;

    const me = world.players.find((p) => p.id === localId) ?? world.players[0];
    if (me) {
      this.ear = { x: me.x, y: me.y, z: me.z };
      this.listen(this.ear, yaw);
    }
    for (const cue of step.cues) this.emit(cue, world.clock);

    // A missing tension track keeps the gameplay score going; a missing
    // result sting lets the score stop rather than play on under the result.
    const wanted = chainMusic(world);
    const music = this.preferredCue(
      wanted,
      wanted === 'music.tension' ? this.preferredCue('music.play', '') : '',
    );
    this.setLoop('music', music || null);
    for (const layer of chainAmbience(world, localId))
      this.setLoop(layer.channel, layer.id, layer.level);
  }

  private emit(cue: ChainCue, now: number) {
    const strength = cue.strength ?? 1;
    if (cue.id.startsWith('speech.')) {
      const admitted = admitLine(
        cue.id,
        now,
        this.lastLine,
        this.said.get(cue.id),
      );
      if (!admitted || !this.preferredCue(cue.id, '')) return;
      if (admitted === 'urgent') this.interruptSpeech();
      this.lastLine = now;
      this.said.set(cue.id, now);
      this.play(cue.id, strength);
      return;
    }
    if (this.recorded(cue)) {
      if (cue.variant) this.variant(cue.id, strength, cue.position, cue.source);
      else this.play(cue.id, strength, cue.position, cue.source);
      return;
    }
    this.fallback(cue.id, strength, cue.position);
  }

  /** Whether the workshop has this cue, or any take of it. */
  private recorded(cue: ChainCue) {
    const takes = cue.variant
      ? [cue.id, `${cue.id}.1`, `${cue.id}.2`, `${cue.id}.3`]
      : [cue.id];
    return takes.some((id) => this.preferredCue(id, '') !== '');
  }

  /** The synthesized stand-in, fading with distance like a recording would. */
  private fallback(id: string, strength: number, at?: Point) {
    if (!SYNTH[id]) return;
    const distance = at
      ? Math.hypot(at.x - this.ear.x, at.y - this.ear.y, at.z - this.ear.z)
      : 0;
    if (distance >= SITE_RANGE) return;
    const now = performance.now();
    if (now - (this.synthRecent.get(id) ?? -1000) < 70) return;
    this.synthRecent.set(id, now);
    this.synth.play(id, strength * (at ? Math.max(0.2, 1 - distance / 40) : 1));
  }

  /** Forget the shift: the next world is heard as a fresh start. */
  override reset() {
    super.reset();
    this.frame = null;
    this.forgetLines();
  }

  /** A new shift gets the whole script again. */
  private forgetLines() {
    this.lastLine = -Infinity;
    this.said.clear();
  }

  override dispose() {
    super.dispose();
    this.synth.dispose();
  }
}
