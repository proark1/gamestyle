import { SiteAudio } from '../../shared/audio/player';
import { Footsteps, type AudioEvent } from '../../shared/audio/world';
import {
  CarryOnCueGate,
  ROUND_START,
  carryOnAmbience,
  carryOnAudioDiscontinuity,
  carryOnAudioEvents,
  carryOnMovement,
  carryOnMusic,
} from './audio-events';
import { carryOnAudioProfile } from './audio/profile';
import type { CarryOnWorld } from './types';

export { carryOnCarnageCatalog } from './audio/catalog';

type Tone = {
  wave: OscillatorType;
  from: number;
  to: number;
  length: number;
  level: number;
  delay?: number;
};

const THUMP: Tone[] = [
  { wave: 'triangle', from: 140, to: 45, length: 0.18, level: 0.35 },
];
const ZIP: Tone[] = [
  { wave: 'sawtooth', from: 420, to: 860, length: 0.22, level: 0.2 },
];
const CHIME: Tone[] = [
  { wave: 'sine', from: 587.33, to: 587.33, length: 0.6, level: 0.3 },
  { wave: 'sine', from: 440, to: 440, length: 0.85, level: 0.3, delay: 0.35 },
];

/**
 * The game's original synthesized effects, kept only as stand-ins: each plays
 * for its cue until the workshop has a recording of it, then never again.
 */
const SYNTH: Record<string, Tone[]> = {
  'item.clothes.pack': THUMP,
  'item.flamingo.pack': THUMP,
  'item.racket.pack': THUMP,
  'item.shoes.pack': THUMP,
  'item.lobster.pack': THUMP,
  'item.shampoo.pack': THUMP,
  'item.snowglobe.pack': THUMP,
  'gate.sizer_insert': THUMP,
  'item.duck.pack': [
    { wave: 'sine', from: 1400, to: 850, length: 0.16, level: 0.35 },
  ],
  'carryon.compress_groan': [
    { wave: 'sine', from: 90, to: 160, length: 0.12, level: 0.4 },
    { wave: 'sine', from: 160, to: 75, length: 0.18, level: 0.4, delay: 0.12 },
  ],
  'carryon.zipper_pull': ZIP,
  'luggage.zip_closed': ZIP,
  'luggage.zip_jam': ZIP,
  'carryon.burst_pinata': [
    { wave: 'sine', from: 280, to: 30, length: 0.4, level: 0.65 },
    {
      wave: 'triangle',
      from: 520,
      to: 1200,
      length: 0.25,
      level: 0.3,
      delay: 0.05,
    },
  ],
  'carryon.tsa_alarm': [0, 1, 2, 3].map((beep) => ({
    wave: 'square',
    from: 1320,
    to: 1320,
    length: 0.12,
    level: 0.25,
    delay: beep * 0.18,
  })),
  'security.whistle': [
    { wave: 'sawtooth', from: 180, to: 180, length: 0.5, level: 0.4 },
  ],
  'carryon.sizer_pass': [523.25, 659.25, 783.99, 1046.5].map((note, index) => ({
    wave: 'sine',
    from: note,
    to: note,
    length: 0.7,
    level: 0.25,
    delay: index * 0.08,
  })),
  'carryon.sizer_reject': [110, 116].map((note) => ({
    wave: 'sawtooth',
    from: note,
    to: note,
    length: 0.6,
    level: 0.35,
  })),
  'carryon.airport_chime': CHIME,
  'terminal.takeoff': CHIME,
};

/** Cue ids that have a synthesized stand-in. */
export const CARRY_ON_SYNTH_CUES = Object.keys(SYNTH);

class CarryOnSynth {
  private context: AudioContext | null = null;
  muted = false;

  unlock() {
    if (!this.context) {
      const Context =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Context) this.context = new Context();
    }
    if (this.context?.state === 'suspended')
      void this.context.resume().catch(() => {});
  }

  play(id: string, strength = 1) {
    const tones = SYNTH[id];
    const context = this.context;
    if (
      !tones ||
      !context ||
      this.muted ||
      context.state !== 'running' ||
      document.hidden
    )
      return;
    try {
      const start = context.currentTime;
      for (const tone of tones) {
        const at = start + (tone.delay ?? 0);
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = tone.wave;
        osc.frequency.setValueAtTime(tone.from, at);
        osc.frequency.exponentialRampToValueAtTime(tone.to, at + tone.length);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(
          Math.max(0.0002, tone.level * strength),
          at + 0.01,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.length);
        osc.connect(gain).connect(context.destination);
        osc.start(at);
        osc.stop(at + tone.length + 0.02);
      }
    } catch {
      // A locked or closing audio device simply stays quiet.
    }
  }

  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}

/**
 * Plays the Admin recordings (mixer, ducking, hidden-tab pause) for whatever
 * the planner in `audio-events.ts` hears in each world state.
 */
export class CarryOnSound extends SiteAudio {
  private previous: CarryOnWorld | null = null;
  private readonly footsteps = new Footsteps();
  private readonly gate = new CarryOnCueGate();
  private readonly synth = new CarryOnSynth();
  private unlockedAt = 0;
  /** The round whose boarding call is waiting for the first key press. */
  private boardingCall: number | null = null;

  constructor() {
    super('carry-on-carnage', carryOnAudioProfile);
  }

  override unlock() {
    super.unlock();
    this.synth.unlock();
    if (!this.unlockedAt) this.unlockedAt = performance.now();
  }

  /** Mutes the recordings and the synthesized stand-ins together. */
  setMuted(muted: boolean) {
    this.enabled = !muted;
    this.synth.muted = muted;
  }

  /** Call with a fresh copy of the world each frame, never the live object. */
  update(world: CarryOnWorld, localId: string) {
    const previous = this.previous;
    // A late packet from the same round must not rewind the comparison.
    if (
      previous &&
      previous.started === world.started &&
      world.clock < previous.clock
    )
      return;
    const fresh = !previous || carryOnAudioDiscontinuity(previous, world);
    if (previous && fresh) this.reset();
    if (fresh) {
      this.footsteps.reset();
      this.gate.reset();
      this.boardingCall = null;
    }
    this.previous = world;
    const me = world.players.find((player) => player.id === localId);
    if (me) this.listen({ x: me.x, y: me.y, z: me.z }, 0);

    let cues = carryOnAudioEvents(previous, world, localId);
    // Solo rounds start on page load, before the browser allows any sound.
    if (!this.unlockedAt && cues.some((cue) => cue.id === 'speech.start')) {
      this.boardingCall = world.started;
      cues = cues.filter((cue) => !ROUND_START.includes(cue));
    }
    if (
      this.boardingCall === world.started &&
      this.unlockedAt &&
      performance.now() - this.unlockedAt > 250
    ) {
      this.boardingCall = null;
      if (world.phase === 'packing' && world.clock - world.started < 20_000)
        cues = [...ROUND_START, ...cues];
    }
    for (const cue of cues) this.cue(cue, world.clock);
    for (const cue of carryOnMovement(this.footsteps, world, localId))
      this.cue(cue, world.clock);

    this.setLoop('music', carryOnMusic(world));
    for (const [channel, loop] of Object.entries(
      carryOnAmbience(world, localId),
    ))
      this.setLoop(channel, loop.id, loop.level);
  }

  private cue(event: AudioEvent, clock: number) {
    const verdict = this.gate.admit(event, clock);
    if (!verdict) return;
    if (verdict === 'interrupt') this.interruptSpeech();
    const strength = event.strength ?? 1;
    if (this.recorded(event.id))
      this.variant(event.id, strength, event.position, event.sourceId);
    else this.synth.play(event.id, strength);
  }

  /** Whether any take of this cue has been recorded in the workshop. */
  private recorded(id: string) {
    return [id, `${id}.2`, `${id}.3`].some(
      (take) => this.preferredCue(take, '') === take,
    );
  }

  override dispose() {
    super.dispose();
    this.synth.dispose();
  }
}
