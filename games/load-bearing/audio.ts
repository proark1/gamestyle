import { SiteAudio } from '../../shared/audio/player';
import { loadBearingAudioProfile } from './audio/profile';
import { LoadAudioDirector } from './audio/director';
import type { LoadWorld } from './types';
export { loadBearingCatalog } from './audio/catalog';
export class LoadBearingSound extends SiteAudio {
  private director = new LoadAudioDirector();
  constructor() {
    super('load-bearing', loadBearingAudioProfile);
  }
  update(world: LoadWorld | null, localId?: string) {
    this.listen(
      world?.players.find((p) => p.id === localId) ?? { x: 0, y: 1.6, z: 12 },
      0,
    );
    const plan = this.director.update(world),
      playing = world?.phase === 'playing';
    this.setLoop('yard', playing ? 'ambience.yard' : null, 0.65);
    this.setLoop('music', playing ? 'music.play' : null, 0.6);
    this.setLoop(
      'crane',
      playing && world?.crane.owner ? 'ambience.crane' : null,
      0.5,
    );
    this.setLoop(
      'debris',
      plan.debris > 0 ? 'ambience.debris' : null,
      plan.debris,
    );
    for (const hit of plan.hits)
      this.play(hit.cue, hit.strength, hit.position, hit.source);
  }
  override reset() {
    super.reset();
    this.director.reset();
  }
}
