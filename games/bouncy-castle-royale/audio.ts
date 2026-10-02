import { SiteAudio } from '../../shared/audio/player';
import { CASTLE_DEFAULT_AUDIO } from './catalog';
import type { World } from './types';

export class CastleAudio extends SiteAudio {
  private last = 0;
  private baseline = false;
  constructor() {
    super('bouncy-castle-royale', {
      effectLimit: 16,
      range: () => 35,
      prepareManifest: (manifest) => ({
        ...manifest,
        cues: { ...CASTLE_DEFAULT_AUDIO, ...manifest.cues },
      }),
    });
  }
  resetEvents() {
    this.baseline = false;
    this.last = 0;
  }
  update(w: World, self: string) {
    const me = w.players.find((p) => p.id === self);
    if (me) this.listen(me, 0);
    if (!this.baseline) {
      this.last = w.nextEvent;
      this.baseline = true;
      return;
    }
    for (const e of w.events) {
      if (e.id <= this.last) continue;
      this.last = e.id;
      this.play(`castle.${e.kind}`, e.strength, { x: e.x, z: e.z });
    }
  }
}
