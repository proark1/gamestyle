import { SiteAudio } from '../../shared/audio/player';
import type { AudioEvent } from '../../shared/audio/world';
import {
  BED_CUES,
  MUSIC_CUES,
  pickLine,
  spaceCues,
  stampedeAmbience,
  stampedeAudioDiscontinuity,
  stampedeAudioEvents,
  stampedeFootsteps,
  stampedeLocalCart,
  stampedeMusic,
  stampedeSameRound,
  type StrideMemory,
} from './audio-events';
import { sampleStampedeAudioProfile } from './audio/profile';
import { StampedeSynth } from './audio/synth';
import type { SampleStampedeSnapshot, StampedeEvent } from './types';

/** Opening cues held for the first tap still fit this far into a round. */
const OPENING_WINDOW_S = 20;

/**
 * Sample Stampede on the shared player: workshop recordings, the owner's mix,
 * speech ducking, hidden-tab pause and disposal. The original synthesized
 * sounds stand in only for cues that have no recording yet.
 */
export class SampleStampedeSound extends SiteAudio {
  private before: SampleStampedeSnapshot | null = null;
  private lastEventId = -Infinity;
  private strides: StrideMemory = new Map();
  private finishedAt: number | null = null;
  private lastLineAt = -Infinity;
  private spoken = new Map<string, number>();
  private spacing: ReadonlyMap<string, number> = new Map();
  private ear = { x: 0, z: 0 };
  private synth = new StampedeSynth();
  private unlockedAt = 0;
  /** A round's opening cues, held until the first tap lets audio play. */
  private opening: { started: number; cues: AudioEvent[] } | null = null;

  constructor() {
    super('sample-stampede', sampleStampedeAudioProfile);
  }

  override unlock() {
    super.unlock();
    this.synth.unlock();
    this.unlockedAt ||= performance.now();
  }

  /** Mutes recordings and the synthesized stand-ins together. */
  setMuted(muted: boolean) {
    this.enabled = !muted;
    this.synth.setMuted(muted);
  }

  override reset() {
    super.reset();
    this.before = null;
    this.strides = new Map();
    this.finishedAt = null;
    this.lastLineAt = -Infinity;
    this.spoken.clear();
    this.spacing = new Map();
  }

  /** A workshop recording of this cue, or of one of its takes, exists. */
  private recorded(id: string) {
    return [id, `${id}.1`, `${id}.2`, `${id}.3`].some(
      (take) => !!this.preferredCue(take, ''),
    );
  }

  private sound(cue: AudioEvent) {
    const strength = cue.strength ?? 1;
    if (this.recorded(cue.id)) {
      if (cue.variant)
        this.variant(cue.id, strength, cue.position, cue.sourceId);
      else this.play(cue.id, strength, cue.position, cue.sourceId);
      return;
    }
    const distance = cue.position
      ? Math.hypot(cue.position.x - this.ear.x, cue.position.z - this.ear.z)
      : 0;
    if (distance < 50)
      this.synth.play(cue.id, strength * Math.max(0.15, 1 - distance / 42));
  }

  /**
   * Call once per snapshot. `frameEvents` are the events the local simulation
   * produced this frame; a networked snapshot carries its own in `world.events`.
   */
  update(
    next: SampleStampedeSnapshot,
    frameEvents: readonly StampedeEvent[] = [],
    now = performance.now(),
  ) {
    const before = this.before;
    // A late packet from this round: keep comparing against the newer one.
    if (
      before &&
      stampedeSameRound(before, next) &&
      next.world.clock < before.world.clock
    )
      return;
    const incoming = [...next.world.events, ...frameEvents];
    const continuous = !!before && !stampedeAudioDiscontinuity(before, next);
    const dt =
      continuous && before ? (next.world.clock - before.world.clock) / 1000 : 0;
    if (!continuous) {
      this.reset();
      // Another round, room or host: only ids from here on count as new.
      this.lastEventId = -Infinity;
    }
    const fresh = continuous
      ? incoming.filter((event) => event.id > this.lastEventId)
      : [];
    for (const event of incoming)
      this.lastEventId = Math.max(this.lastEventId, event.id);
    this.before = next;

    const w = next.world;
    const me = stampedeLocalCart(next);
    if (me) {
      this.ear = { x: me.x, z: me.z };
      // The camera rides behind the cart, so the cart's right is the ear's right.
      this.listen({ x: me.x, y: 1, z: me.z }, me.rotY - Math.PI / 2);
    }
    if (w.status === 'finished') this.finishedAt ??= now;
    else this.finishedAt = null;

    const spaced = spaceCues(
      stampedeAudioEvents(continuous ? before : null, next, fresh),
      now,
      this.spacing,
    );
    let cues = spaced.cues;
    this.spacing = spaced.last;
    // The first round starts on page load, before the browser allows sound:
    // keep its opening for the first tap instead of losing it.
    if (!continuous && !this.unlockedAt && cues.length) {
      this.opening = { started: w.started, cues };
      cues = [];
    }
    if (this.opening && this.unlockedAt && now - this.unlockedAt > 250) {
      const opening = this.opening;
      this.opening = null;
      if (
        opening.started === w.started &&
        w.status === 'active' &&
        w.matchDuration - w.timeRemaining < OPENING_WINDOW_S
      )
        cues = [...opening.cues, ...cues];
    }
    const steps = stampedeFootsteps(this.strides, next);
    this.strides = steps.memory;
    // Only recorded lines compete, so a missing one never spends the turn.
    const line = pickLine(
      cues.filter(
        (cue) => !cue.id.startsWith('speech.') || this.recorded(cue.id),
      ),
      now,
      this.lastLineAt,
      this.spoken,
    );
    if (line) {
      if (line.urgent) this.interruptSpeech();
      this.lastLineAt = now;
      this.spoken.set(line.id, now);
    }
    for (const cue of [...cues, ...steps.cues]) {
      if (!cue.id.startsWith('speech.')) this.sound(cue);
      else if (cue.id === line?.id) this.play(cue.id);
    }

    // Score and beds. Procedural muzak only while no score is recorded.
    this.synth.setMuzak(!MUSIC_CUES.some((id) => this.recorded(id)));
    // A missing tension track keeps the play score; any other missing track
    // stops the score rather than leaving the previous one playing on.
    const wanted = stampedeMusic(
      next,
      this.finishedAt === null ? 0 : now - this.finishedAt,
    );
    const music =
      wanted === 'music.tension' && !this.recorded(wanted)
        ? 'stampede.store_muzak'
        : wanted;
    this.setLoop('music', this.recorded(music) ? music : null);
    const beds = stampedeAmbience(next);
    for (const [channel, id] of Object.entries(BED_CUES) as [
      keyof typeof BED_CUES,
      string,
    ][])
      this.setLoop(
        channel,
        w.status === 'active' || beds[channel] > 0 ? id : null,
        beds[channel],
      );
    if (
      me &&
      continuous &&
      w.status === 'active' &&
      !this.recorded(BED_CUES.squeak)
    )
      this.synth.updateSqueak(Math.hypot(me.vx, me.vz), me.wobbleIntensity, dt);
  }

  override dispose() {
    super.dispose();
    this.synth.destroy();
  }
}
