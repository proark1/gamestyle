import { SiteAudio } from '../../shared/audio/player';
import type { ButtonWorld } from './types';
import { ButtonAudioDirector } from './audio/director';
import { buttonAudioProfile } from './audio/profile';
export { buttonCatalog } from './audio/catalog';
export class ButtonSound extends SiteAudio {
  private director = new ButtonAudioDirector();
  constructor() {
    super('one-more-button', buttonAudioProfile);
    this.update(null);
  }
  update(world: ButtonWorld | null, localId?: string) {
    const plan = this.director.update(world, localId);
    const me = world?.players.find((p) => p.id === localId);
    this.listen(me ?? { x: 0, y: 1, z: 0 }, 0);
    this.setLoop('music', plan.music, plan.musicLevel);
    this.setLoop(
      'conveyor',
      plan.conveyor ? 'ambience.conveyor' : null,
      plan.conveyor,
    );
    this.setLoop(
      'spinner',
      plan.spinner ? 'ambience.spinner' : null,
      plan.spinner,
    );
    this.setLoop('soap', plan.soap ? 'ambience.soap' : null, plan.soap);
    for (const hit of plan.hits)
      this.play(hit.cue, hit.strength, hit.position, hit.source);
  }
  override reset() {
    super.reset();
    this.director.reset();
  }
}
