import { SiteAudio } from '../../shared/audio/player';
import { CageAudioDirector } from './audio/director';
import { cageAudioProfile } from './audio/profile';
import type { World } from './types';
export { cageCatalog } from './audio/catalog';

export class CageAudio extends SiteAudio {
  private director = new CageAudioDirector();
  constructor() {
    super('cage-clash', cageAudioProfile);
    this.listen({ x: 0, z: 4 }, 0);
  }
  override reset() {
    super.reset();
    this.director.reset();
  }
  resetEvents() {
    this.reset();
  }
  update(w: World, localId?: string) {
    const plan = this.director.update(w, localId);
    if (
      plan.hits.some((hit) =>
        ['speech.ko', 'speech.submission', 'speech.decision'].includes(hit.cue),
      )
    )
      this.interruptSpeech();
    this.setLoop('crowd', 'ambience.crowd', plan.crowd);
    this.setLoop('music', 'music.arena', plan.music);
    this.setLoop(
      'grapple',
      plan.grapple ? 'ambience.grapple' : null,
      plan.grapple,
    );
    this.setLoop(
      'tension',
      plan.tension ? 'ambience.tension' : null,
      plan.tension,
    );
    for (const hit of plan.hits)
      this.play(
        hit.cue === 'cage.opening-bell'
          ? this.preferredCue('cage.opening-bell', 'cage.bell')
          : hit.cue,
        hit.strength,
        hit.position,
        hit.source,
      );
  }
  setMuted(muted: boolean) {
    this.enabled = !muted;
  }
}
