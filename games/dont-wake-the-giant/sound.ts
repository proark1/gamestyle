import { SiteAudio } from '../../shared/audio/player';
import { Footsteps } from '../../shared/audio/world';
import {
  giantAudioDiscontinuity,
  giantAudioEvents,
  giantSurface,
} from './audio-events';
import type { GiantSnapshot } from './types';
import { escapeWarning, untilGiantWakes } from './urgency';
import { giantAudioProfile } from './audio/profile';

/** Uses the same saved clips, mix, speech ducking and lifecycle as the other games. */
export class GiantSound extends SiteAudio {
  private previous: GiantSnapshot | null = null;
  private footsteps = new Footsteps();

  constructor() {
    super('dont-wake-the-giant', giantAudioProfile);
    this.menu();
  }

  menu() {
    this.reset();
    this.previous = null;
    this.footsteps.reset();
    this.setLoop('music', 'music.menu');
    this.setLoop('cottage', 'ambience.cottage');
    this.setLoop('breathing', 'ambience.breathing', 0.55);
  }

  update(next: GiantSnapshot, yaw = 0.65) {
    const previous = this.previous;
    // Discard stale network packets without rewinding the sound comparison.
    if (
      previous?.code === next.code &&
      previous.world.started === next.world.started &&
      next.world.clock < previous.world.clock
    )
      return;
    if (!previous || giantAudioDiscontinuity(previous, next)) {
      this.reset();
      this.footsteps.reset();
    }
    this.previous = next;
    const w = next.world;
    const listener = w.players.find((p) => p.id === next.you);
    if (listener) this.listen(listener, yaw);
    const events = giantAudioEvents(previous, next);
    if (
      events.some((event) =>
        ['speech.escape-warning', 'speech.giant-wake'].includes(event.id),
      )
    )
      this.interruptSpeech();
    for (const event of events)
      this.play(event.id, event.strength, event.position);
    const active = w.phase === 'playing' || w.phase === 'escape';
    if (active)
      for (const player of w.players) {
        if (player.escaped || player.caught || player.downUntil > w.clock)
          continue;
        for (const event of this.footsteps.update(
          player.id,
          player,
          player.grounded,
          giantSurface(player, w),
          w.clock,
        )) {
          const strength = player.input.crouch ? 0.3 : 0.7;
          if (event.id.startsWith('step.'))
            this.variant(event.id, strength, player);
          else this.play(event.id, strength, player);
        }
      }
    const music =
      w.phase === 'ended'
        ? w.banked >= w.target
          ? 'win'
          : 'fail'
        : w.phase === 'lobby'
          ? 'menu'
          : escapeWarning(w) || w.phase === 'escape'
            ? 'escape'
            : w.wakefulness >= 60 || w.deadline - w.clock < 60_000
              ? 'challenge'
              : 'build';
    this.setLoop('music', `music.${music}`);
    this.setLoop(
      'escape-warning',
      escapeWarning(w) ? 'ambience.escape-warning' : null,
      0.55 + 0.45 * Math.max(0, Math.min(1, 1 - untilGiantWakes(w) / 20_000)),
    );
    this.setLoop('cottage', 'ambience.cottage');
    const distance = listener
      ? Math.hypot(listener.x - 2, listener.y - 4.8, listener.z + 5.6)
      : 0;
    this.setLoop(
      'breathing',
      w.phase === 'playing' || w.phase === 'lobby'
        ? 'ambience.breathing'
        : null,
      Math.max(0.38, 1 - distance / 32) * 0.75,
    );
  }
}
