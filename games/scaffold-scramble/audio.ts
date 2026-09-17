import { SiteAudio } from '../../shared/audio/player';
import { scaffoldScrambleAudioProfile } from './audio/profile';
import type { GameEvent, ScaffoldScrambleWorld } from './types';
export { scaffoldScrambleCatalog } from './audio/catalog';

const CUES: Record<GameEvent['type'], string | null> = {
  crank: 'crank.ratchet',
  tilt_warning: 'hazard.tilt_warning',
  slip: 'hazard.slip',
  dangle: 'hazard.dangle',
  climb_up: 'crank.ratchet',
  bucket_slide: 'bucket.slide',
  bucket_spill: 'bucket.spill',
  soap_apply: 'soap.foam',
  window_clean: 'window.clean',
  pigeon_land: 'hazard.pigeon',
  pigeon_shoo: 'hazard.pigeon',
  wind_gust: 'hazard.wind',
  win: 'event.win',
  timeout: 'event.fail',
};

export class ScaffoldScrambleSound extends SiteAudio {
  private lastEvent = 0;
  private lastPhase: ScaffoldScrambleWorld['phase'] = 'lobby';

  constructor() {
    super('scaffold-scramble', scaffoldScrambleAudioProfile);
    this.update(null);
  }

  update(world: ScaffoldScrambleWorld | null, localId?: string) {
    const me = world?.players.find((p) => p.id === localId);
    const centerPos = {
      x: 0,
      y: world ? world.cradle.centerHeight : 50,
      z: 2.0,
    };
    this.listen(
      me
        ? {
            x: me.deckX,
            y: world ? world.cradle.centerHeight + me.deckY : 50,
            z: 2.0,
          }
        : centerPos,
      0,
    );

    const playing = world?.phase === 'playing';
    this.setLoop('sky', playing ? 'ambience.sky' : null, 0.4);

    // Helicopter sound gets louder as it approaches the roof
    if (playing && world) {
      const helicopterDist = Math.max(
        0,
        world.helicopter.y - world.cradle.centerHeight,
      );
      const chopperVol = Math.max(
        0.1,
        Math.min(0.65, 1.0 - helicopterDist / 70),
      );
      this.setLoop('helicopter', 'ambience.helicopter', chopperVol);
    } else {
      this.setLoop('helicopter', null, 0);
    }

    if (!world) return;

    for (const event of world.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const cue = CUES[event.type];
      if (cue) {
        this.play(cue, 1, centerPos, String(event.id));
      }
    }

    if (world.phase !== this.lastPhase) {
      if (world.phase === 'ended') {
        if (world.winner === 'crew') {
          this.play('event.win', 1);
        } else {
          this.play('event.fail', 1);
        }
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
