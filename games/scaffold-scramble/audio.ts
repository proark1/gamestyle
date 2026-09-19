import { SiteAudio } from '../../shared/audio/player';
import type { AudioPreferences } from '../../shared/audio/preferences';
import { audioPreferencesSnapshot } from '../../shared/audio/preferences';
import type { Point } from '../../shared/audio/world';
import {
  playerPoint,
  scaffoldAudioEvents,
  scaffoldLoops,
  scaffoldMusic,
  type ScaffoldCue,
} from './audio-events';
import { scaffoldScrambleAudioProfile } from './audio/profile';
import { ScaffoldSynth } from './audio/synth';
import type { ScaffoldScrambleWorld } from './types';
export { scaffoldScrambleCatalog } from './audio/catalog';

/** At most one incidental narrator line this often. */
export const NARRATOR_GAP_MS = 7_000;
/** The same incidental line does not come back sooner than this. */
export const LINE_REPEAT_MS = 40_000;

/**
 * Plays the Admin recordings for Scaffold Scramble: one-shots from
 * `scaffoldAudioEvents`, the score from `scaffoldMusic` and the layered beds
 * from `scaffoldLoops`. A cue with no recording yet falls back to its
 * synthesized stand-in; once any take exists, only the recording plays.
 */
export class ScaffoldScrambleSound extends SiteAudio {
  private previous: ScaffoldScrambleWorld | null = null;
  private synth = new ScaffoldSynth();
  private here: Point = { x: 0, y: 0, z: 0 };
  private lastLine = -Infinity;
  private lines = new Map<string, number>();
  /** Stand-ins wait for the first manifest, so they never double a recording. */
  private manifestChecked = false;

  constructor() {
    super('scaffold-scramble', scaffoldScrambleAudioProfile);
    this.synth.level = audioPreferencesSnapshot().volume;
    this.update(null);
  }

  override async refresh() {
    await super.refresh();
    this.manifestChecked = true;
  }

  override applyPreferences(preferences: AudioPreferences) {
    super.applyPreferences(preferences);
    // The base constructor calls this before the synth exists.
    if (this.synth) this.synth.level = preferences.volume;
  }

  override unlock() {
    super.unlock();
    this.synth.unlock();
  }

  /** The game's own mute silences recordings and stand-ins together. */
  setMuted(muted: boolean) {
    this.enabled = !muted;
    this.synth.muted = muted;
  }

  update(world: ScaffoldScrambleWorld | null, localId?: string) {
    if (!world) {
      this.previous = null;
      this.mix(null);
      return;
    }
    const previous = this.previous;
    // A frame older than the last one is ignored instead of rewinding.
    if (
      previous &&
      previous.started === world.started &&
      world.clock < previous.clock
    )
      return;
    this.previous = world;
    const me = world.players.find((p) => p.id === localId);
    this.here = me
      ? playerPoint(world, me)
      : { x: 0, y: world.cradle.centerHeight, z: 1.2 };
    this.listen(this.here, 0);
    this.perform(scaffoldAudioEvents(previous, world, localId));
    this.mix(world);
  }

  private recorded(id: string) {
    return !!this.preferredCue(id, '');
  }

  private perform(cues: ScaffoldCue[]) {
    const now = performance.now();
    // One narrator line per frame: an urgent one first, else a quip if the
    // narrator has been quiet long enough and has not just said it.
    const line =
      cues.find((cue) => cue.urgent && this.recorded(cue.id)) ??
      cues.find(
        (cue) =>
          cue.id.startsWith('speech.') &&
          !cue.urgent &&
          this.recorded(cue.id) &&
          now - this.lastLine >= NARRATOR_GAP_MS &&
          now - (this.lines.get(cue.id) ?? -Infinity) >= LINE_REPEAT_MS,
      );
    if (line) {
      if (line.urgent) this.interruptSpeech();
      this.lastLine = now;
      this.lines.set(line.id, now);
      this.play(line.id);
    }
    for (const cue of cues) if (!cue.id.startsWith('speech.')) this.effect(cue);
  }

  private effect(cue: ScaffoldCue) {
    const strength = cue.strength ?? 1;
    const takes = cue.variant
      ? [cue.id, `${cue.id}.1`, `${cue.id}.2`, `${cue.id}.3`]
      : [cue.id];
    if (takes.some((id) => this.recorded(id))) {
      if (cue.variant)
        this.variant(cue.id, strength, cue.position, cue.sourceId);
      else this.play(cue.id, strength, cue.position, cue.sourceId);
    } else if (this.manifestChecked)
      this.synth.play(
        cue.id,
        strength,
        cue.position ? (cue.position.x - this.here.x) / 12 : 0,
      );
  }

  private mix(world: ScaffoldScrambleWorld | null) {
    // A missing tension track keeps the play score; any other missing track
    // stops the score rather than leaving the previous one playing on.
    const wanted = scaffoldMusic(world);
    const music =
      wanted === 'music.tension' && !this.recorded(wanted)
        ? 'music.play'
        : wanted;
    this.setLoop('music', this.recorded(music) ? music : null);
    for (const loop of scaffoldLoops(world))
      this.setLoop(loop.channel, loop.id, loop.level);
  }

  override reset() {
    super.reset();
    this.previous = null;
  }

  override dispose() {
    super.dispose();
    this.synth.dispose();
  }
}
