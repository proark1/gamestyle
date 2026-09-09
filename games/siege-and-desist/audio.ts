import { SiteAudio } from '../../shared/audio/player';
import { SiegeAudioDirector } from './audio/director';
import { siegeAudioProfile } from './audio/profile';
import type { SiegeWorld } from './types';
export { siegeCatalog } from './audio/catalog';

export class SiegeSound extends SiteAudio {
  private director = new SiegeAudioDirector();
  constructor() {
    super('siege-and-desist', siegeAudioProfile);
    this.update(null);
  }
  update(world: SiegeWorld | null, localId?: string) {
    const plan = this.director.update(world);
    const me = world?.players.find((p) => p.id === localId);
    this.listen(me ?? { x: 0, y: 1, z: 14 }, 0);
    this.setLoop('music', plan.music, plan.musicLevel);
    this.setLoop('camp', plan.camp ? 'ambience.camp' : null, plan.camp);
    this.setLoop('fire', plan.fire ? 'ambience.fire' : null, plan.fire);
    for (const hit of plan.hits)
      this.play(hit.cue, hit.strength, hit.position, hit.source);
  }
  override reset() {
    super.reset();
    this.director.reset();
  }
}
