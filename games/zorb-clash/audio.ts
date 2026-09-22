import { SiteAudio } from '../../shared/audio/player';
import { bundledProfile } from '../../shared/audio/bundled-profile';
import { zorbClashCatalog } from './audio/catalog';
import { ZorbAudioDirector } from './audio/director';
import type { ZorbClashWorld } from './types';
export { zorbClashCatalog } from './audio/catalog';
export class ZorbClashAudio extends SiteAudio {
  private director = new ZorbAudioDirector();
  constructor() {
    super('zorb-clash', bundledProfile('zorb-clash', zorbClashCatalog));
  }
  setMuted(muted: boolean) {
    this.enabled = !muted;
  }
  bonk(intensity = 0.5) {
    this.play('event.zorb_bonk', intensity);
  }
  springCushion() {
    this.play('event.spring_recoil', 0.7);
  }
  dashRelease() {
    this.play('event.dash_burst', 0.7);
  }
  brace() {
    this.play('event.brace_thud', 0.7);
  }
  turtle() {
    this.play('event.turtle_slide', 0.7);
  }
  goal() {
    this.play('event.goal_cheer', 1);
  }
  whistle() {
    this.play('event.referee_whistle', 0.7);
  }
  setDashCharge(charge: number) {
    this.setLoop(
      'charge',
      charge > 0.05 ? 'ambience.charge' : null,
      Math.min(0.7, charge),
    );
  }
  update(world: ZorbClashWorld | null, localId?: string) {
    const plan = this.director.update(world);
    this.listen(
      world?.players.find((p) => p.id === localId) ?? { x: 0, z: 0 },
      0,
    );
    this.setLoop(
      'crowd',
      world && world.status !== 'ended' ? 'ambience.crowd' : null,
      0.65,
    );
    this.setLoop('music', plan.playing ? 'music.play' : null, 0.6);
    this.setLoop('roll', plan.roll > 0.02 ? 'ambience.roll' : null, plan.roll);
    if (!plan.playing) this.setDashCharge(0);
    for (const hit of plan.hits)
      this.play(hit.cue, hit.strength, hit.position, hit.source);
  }
  override reset() {
    super.reset();
    this.director.reset();
  }
  destroy() {
    this.dispose();
  }
}
