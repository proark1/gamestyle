import { SiteAudio } from '../../shared/audio/player';
import { loadBearingAudioProfile } from './audio/profile';
import type { LoadEvent, LoadWorld } from './types';
export { loadBearingCatalog } from './audio/catalog';

const CUES: Record<LoadEvent['kind'], string | null> = {
  start: 'event.start',
  hit: 'event.hammer',
  break: 'event.break',
  collapse: 'event.collapse',
  piano: 'event.piano',
  down: 'event.down',
  help: 'event.help',
  crane: null,
  mark: 'event.mark',
  finish: null,
};

export class LoadBearingSound extends SiteAudio {
  private lastEvent = 0;
  private lastPhase: LoadWorld['phase'] = 'lobby';

  constructor() {
    super('load-bearing', loadBearingAudioProfile);
    this.update(null);
  }

  update(world: LoadWorld | null, localId?: string) {
    const me = world?.players.find((p) => p.id === localId);
    this.listen(me ?? { x: 0, y: 1.6, z: 12 }, 0);
    const playing = world?.phase === 'playing';
    this.setLoop('yard', playing ? 'ambience.yard' : null, 0.35);
    this.setLoop(
      'crane',
      playing && world?.crane.owner ? 'ambience.crane' : null,
      0.45,
    );
    if (!world) return;
    for (const event of world.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const cue = CUES[event.kind];
      if (cue) this.play(cue, 1, me ?? { x: 0, y: 1.6, z: 0 }, String(event.id));
    }
    if (world.phase !== this.lastPhase) {
      if (world.phase === 'won') this.play('event.win', 1);
      if (world.phase === 'lost')
        this.play(
          world.piano.integrity <= 0 ? 'event.piano-lost' : 'event.lose',
          1,
        );
      this.lastPhase = world.phase;
    }
  }

  override reset() {
    super.reset();
    this.lastEvent = 0;
    this.lastPhase = 'lobby';
  }
}
