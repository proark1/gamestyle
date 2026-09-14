import { SiteAudio } from '../../shared/audio/player';
import { craneClashAudioProfile } from './audio/profile';
import type { CraneClashWorld, GameEvent } from './types';
export { craneClashCatalog } from './audio/catalog';

const CUES: Record<GameEvent['type'], string | null> = {
  siren: 'event.start',
  grab: 'event.grab',
  place: 'event.place',
  bonk: 'event.bonk',
  topple: 'event.topple',
  height: 'event.height',
};

export class CraneClashSound extends SiteAudio {
  private lastEvent = 0;
  private lastPhase: CraneClashWorld['phase'] = 'lobby';

  constructor() {
    super('crane-clash', craneClashAudioProfile);
    this.update(null);
  }

  update(world: CraneClashWorld | null, localId?: string) {
    const me = world?.players.find((p) => p.id === localId);
    this.listen(me ?? { x: 0, y: 1.6, z: 12 }, 0);

    const playing = world?.phase === 'playing';
    this.setLoop('yard', playing ? 'ambience.yard' : null, 0.35);

    if (!world) return;

    for (const event of world.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const cue = CUES[event.type];
      if (cue) {
        this.play(cue, 1, me ?? { x: 0, y: 1.6, z: 0 }, String(event.id));
      }
    }

    if (world.phase !== this.lastPhase) {
      if (world.phase === 'ended') {
        this.play('event.win', 1);
      }
      this.lastPhase = world.phase;
    }
  }

  override reset() {
    super.reset();
    this.lastEvent = 0;
    this.lastPhase = 'lobby';
  }
}
