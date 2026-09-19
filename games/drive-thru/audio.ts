import { SiteAudio } from '../../shared/audio/player';
import { driveThruAudioProfile } from './audio/profile';
import {
  audioCopy,
  driveThruAmbience,
  driveThruAudioDiscontinuity,
  driveThruAudioEvents,
  driveThruDanger,
  driveThruListener,
  driveThruMusic,
  driveThruResultCues,
  isEndedPhase,
  TENSION_HOLD_MS,
  type AmbienceChannel,
  type DriveThruCue,
} from './audio-events';
import type { DriveThruWorld } from './types';

export { driveThruCatalog } from './audio/catalog';
export { driveThruAudioProfile } from './audio/profile';

/** Incidental narration waits this long after the previous line. */
export const SPEECH_GAP_MS = 6000;
/** The same incidental line does not come back within this window. */
export const LINE_REPEAT_MS = 20000;
/** Round-start cues held for the first tap still fit this far into a round. */
const INTRO_WINDOW_MS = 20000;
/** Audio needs a moment to resume after the first tap before it is heard. */
const UNLOCK_SETTLE_MS = 300;

/**
 * Synthesized stand-ins for a few key moments, heard only while the workshop
 * has no recording of that cue yet. Once a recording is published the synth
 * stays silent for it, so the game is never double-voiced.
 */
class DriveThruSynth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  unlock() {
    try {
      if (!this.context) {
        const Context =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = 0.2;
        this.master.connect(this.context.destination);
        const size = this.context.sampleRate;
        this.noise = this.context.createBuffer(1, size, size);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      // Browser audio is optional.
    }
  }

  private tone(
    wave: OscillatorType,
    from: number,
    to: number,
    at: number,
    length: number,
    level: number,
    ramp: 'exponential' | 'wobble' = 'exponential',
  ) {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, at);
    if (ramp === 'wobble') {
      osc.frequency.linearRampToValueAtTime(to, at + length / 3);
      osc.frequency.linearRampToValueAtTime(from, at + (length * 2) / 3);
    } else osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.8);
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(at);
    osc.stop(at + length + 0.03);
  }

  play(id: string, strength = 1) {
    const ctx = this.context;
    if (
      !ctx ||
      !this.master ||
      this.muted ||
      ctx.state !== 'running' ||
      (typeof document !== 'undefined' && document.hidden)
    )
      return;
    const t = ctx.currentTime;
    const s = Math.max(0, Math.min(1, strength));
    switch (id) {
      case 'event.car-horn':
        // Dual-tone car horn.
        this.tone('sawtooth', 392, 392, t, 0.35, 0.18 * s);
        this.tone('sawtooth', 440, 440, t, 0.35, 0.18 * s);
        break;
      case 'event.patty-flip':
        // Wet spatula slap.
        this.tone('triangle', 220, 45, t, 0.15, 0.3 * s);
        break;
      case 'event.shake-vent': {
        // Pressurised hiss.
        if (!this.noise) return;
        const noise = ctx.createBufferSource();
        noise.buffer = this.noise;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2800;
        filter.Q.value = 4;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25 * s, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        noise.start(t);
        noise.stop(t + 0.38);
        break;
      }
      case 'event.pole-crash':
        // Heavy metal crunch.
        this.tone('sawtooth', 140, 30, t, 0.5, 0.4 * s);
        break;
      case 'event.order-served':
        // Cheerful register bell.
        this.tone('sine', 523, 523, t, 0.45, 0.3 * s);
        this.tone('sine', 659, 659, t + 0.12, 0.45, 0.3 * s);
        break;
      case 'event.grease-fire':
      case 'event.curb-plop':
        // Panic siren.
        this.tone('sawtooth', 700, 950, t, 0.7, 0.35 * s, 'wobble');
        break;
    }
  }

  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
    this.master = null;
  }
}

/**
 * Drive-Thru Static's sound: the Admin recordings, the owner's mixer, speech
 * ducking and lifecycle from SiteAudio, driven by the pure rules in
 * `audio-events.ts`.
 */
export class DriveThruSound extends SiteAudio {
  private previous: DriveThruWorld | null = null;
  private synth = new DriveThruSynth();
  private cueAt = new Map<string, number>();
  private lineAt = new Map<string, number>();
  private lastLineAt = -Infinity;
  private dangerAt = -Infinity;
  private endedAt: number | null = null;
  private endedFor = -1;
  private unlockRequested = false;
  private readyAt: number | null = null;
  private intro: { started: number; cues: DriveThruCue[] } | null = null;

  constructor() {
    super('drive-thru', driveThruAudioProfile);
  }

  override unlock() {
    super.unlock();
    this.synth.unlock();
    this.unlockRequested = true;
  }

  /** The game's sound toggle mutes recordings and synthesized cues together. */
  setMuted(muted: boolean) {
    this.enabled = !muted;
    this.synth.muted = muted;
  }

  /** Call once per frame with the live world and the local player's id. */
  update(world: DriveThruWorld | null, localId: string) {
    if (!world) return;
    const previous = this.previous;
    // A stale frame of the same round never rewinds the comparison.
    if (previous?.started === world.started && world.clock < previous.clock)
      return;
    if (!previous || previous.started !== world.started) this.newRound();
    const cues = driveThruAudioEvents(previous, world, localId);
    this.previous = audioCopy(world);

    const listener = driveThruListener(world, localId);
    this.listen(listener.position, listener.yaw);

    // The first round starts before the browser lets audio play; keep its
    // opening cues for the first tap instead of losing them.
    const ready = this.ready(world.clock);
    const opening = !previous || driveThruAudioDiscontinuity(previous, world);
    if (opening && cues.length && !ready)
      this.intro = { started: world.started, cues };
    else this.perform(cues, world.clock);
    if (this.intro && ready) {
      const intro = this.intro;
      this.intro = null;
      if (
        intro.started === world.started &&
        world.clock - world.started < INTRO_WINDOW_MS
      )
        this.perform(intro.cues, world.clock);
    }

    const endedBefore = this.endedFor;
    if (isEndedPhase(world.phase)) this.endedAt ??= world.clock;
    else this.endedAt = null;
    this.endedFor = this.endedAt === null ? -1 : world.clock - this.endedAt;
    this.perform(
      driveThruResultCues(world, endedBefore, this.endedFor),
      world.clock,
    );

    if (driveThruDanger(world)) this.dangerAt = world.clock;
    // A missing tension track keeps the play score; any other missing track
    // stops the score rather than leaving the previous one playing on.
    const wanted = driveThruMusic(
      world,
      this.endedFor,
      world.clock - this.dangerAt < TENSION_HOLD_MS,
    );
    const music =
      wanted === 'music.tension' && !this.recorded(wanted)
        ? 'music.drive-thru-rush'
        : wanted;
    this.setLoop('music', this.recorded(music) ? music : null);
    const mix = driveThruAmbience(world, localId);
    for (const channel of Object.keys(mix) as AmbienceChannel[]) {
      const loop = mix[channel];
      this.setLoop(channel, loop?.id ?? null, loop?.level ?? 1);
    }
  }

  private newRound() {
    this.reset();
    this.cueAt.clear();
    this.lineAt.clear();
    this.lastLineAt = -Infinity;
    this.dangerAt = -Infinity;
    this.endedAt = null;
    this.endedFor = -1;
    this.intro = null;
  }

  private ready(clock: number) {
    if (!this.unlockRequested) return false;
    this.readyAt ??= clock + UNLOCK_SETTLE_MS;
    return clock >= this.readyAt;
  }

  /** Any published take of a cue: `id`, `id.1`, `id.2` or `id.3`. */
  private recorded(id: string) {
    return [id, `${id}.1`, `${id}.2`, `${id}.3`].some(
      (take) => this.preferredCue(take, '') !== '',
    );
  }

  private perform(cues: DriveThruCue[], clock: number) {
    // One line at a time: an urgent line cuts in, anything else waits its turn.
    const lines = cues.filter(
      (cue) => cue.id.startsWith('speech.') && this.recorded(cue.id),
    );
    const line =
      lines.find((cue) => cue.urgent) ??
      lines.find(
        (cue) =>
          clock - this.lastLineAt >= SPEECH_GAP_MS &&
          clock - (this.lineAt.get(cue.id) ?? -Infinity) >= LINE_REPEAT_MS,
      );
    if (line) {
      if (line.urgent) this.interruptSpeech();
      this.lastLineAt = clock;
      this.lineAt.set(line.id, clock);
      this.play(line.id);
    }
    for (const cue of cues) {
      if (cue.id.startsWith('speech.')) continue;
      if (cue.gap && clock - (this.cueAt.get(cue.id) ?? -Infinity) < cue.gap)
        continue;
      this.cueAt.set(cue.id, clock);
      if (this.recorded(cue.id))
        this.variant(cue.id, cue.strength ?? 1, cue.position);
      else this.synth.play(cue.id, cue.strength ?? 1);
    }
  }

  override dispose() {
    super.dispose();
    this.synth.dispose();
  }
}
