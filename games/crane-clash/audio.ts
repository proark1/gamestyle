import { SiteAudio } from '../../shared/audio/player';
import { craneClashAudioProfile } from './audio/profile';
import { CraneAudioDirector } from './audio/director';
import type { CraneClashWorld } from './types';
export { craneClashCatalog } from './audio/catalog';
export class CraneClashSound extends SiteAudio {
  private director = new CraneAudioDirector();
  constructor() {
    super('crane-clash', craneClashAudioProfile);
  }
  update(world: CraneClashWorld | null, localId?: string) {
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
      plan.motor > 0.03 ? 'ambience.crane' : null,
      plan.motor,
    );
    this.setLoop(
      'swing',
      plan.swing > 0.05 && playing ? 'ambience.swing' : null,
      plan.swing,
    );
    for (const hit of plan.hits)
      this.play(hit.cue, hit.strength, hit.position, hit.source);
  }
  override reset() {
    super.reset();
    this.director.reset();
  }
}
