import { audioProfile } from './audio-profile';
import { SiteAudio } from '../../shared/audio/player';
import { distance, type Snapshot, type Point } from './types';

/** Only the private snapshot can trigger a sound. Hidden actors never enter this mixer. */
export class ShelfAudio {
  private player = new SiteAudio('act-natural', audioProfile);
  private events = new Set<number>();
  private previous = new Map<string, Point>();
  private travelled = new Map<string, number>();
  private round = -1;
  constructor() {
    this.player.setLoop('music', 'music.showroom');
  }
  unlock() {
    this.player.unlock();
  }
  mute(muted: boolean) {
    this.player.enabled = !muted;
  }
  reset() {
    this.events.clear();
    this.previous.clear();
    this.travelled.clear();
    this.player.reset();
    this.player.setLoop('music', 'music.showroom');
  }
  update(s: Snapshot) {
    if (s.round !== this.round) {
      this.round = s.round;
      this.reset();
    }
    if (!s.you.body || (s.phase !== 'hiding' && s.phase !== 'playing')) {
      this.previous.clear();
      this.travelled.clear();
      this.player.trackSources(new Map());
      return;
    }
    this.player.listen(s.you.body, 0);
    const bodies = [
      ...s.figures,
      ...(s.guard ? [{ ...s.guard, id: 'guard' }] : []),
    ];
    const positions = new Map(bodies.map((b) => [b.id, { x: b.x, z: b.z }]));
    this.player.trackSources(positions);
    for (const b of bodies) {
      const before = this.previous.get(b.id),
        delta = before ? distance(before, b) : 0,
        travel =
          // Reappearing figures and reconnect jumps are not footsteps.
          delta > 1.5 ? 0 : (this.travelled.get(b.id) ?? 0) + delta;
      if (travel >= 1.1) {
        this.player.variant('step.floor', 0.2 + Math.random() * 0.04, b, b.id);
        this.travelled.set(b.id, travel % 1.1);
      } else this.travelled.set(b.id, travel);
    }
    this.previous = positions;
    for (const id of this.travelled.keys())
      if (!positions.has(id)) this.travelled.delete(id);
    for (const event of s.events) {
      if (this.events.has(event.id)) continue;
      this.events.add(event.id);
      const cue =
        event.kind === 'switch'
          ? 'event.power-off'
          : event.kind === 'lock'
            ? 'item.key.unlock'
            : event.kind === 'lift' || event.kind === 'drop'
              ? `item.${event.material === 'key' ? 'key' : 'ladder'}.${event.kind === 'lift' ? 'grab' : 'drop'}`
              : event.kind === 'escape'
                ? 'item.ladder.place'
                : event.kind === 'catch'
                  ? 'event.capture'
                  : 'event.inspect';
      this.player.play(cue, 0.65, event);
    }
    if (this.events.size > 200)
      this.events = new Set([...this.events].slice(-100));
  }
  dispose() {
    this.player.dispose();
  }
}
