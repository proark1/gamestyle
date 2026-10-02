import { SiteAudio } from '../../shared/audio/player';
import { SLOPE_DEFAULT_AUDIO } from './catalog';
import type { World } from './types';

export class SlopeAudio extends SiteAudio {
  private last = 0;
  private baseline = false;
  constructor() {
    super('slopewreck', {
      effectLimit: 16,
      range: () => 45,
      prepareManifest: (manifest) => ({
        ...manifest,
        cues: { ...SLOPE_DEFAULT_AUDIO, ...manifest.cues },
      }),
    });
  }
  resetEvents() {
    this.last = 0;
    this.baseline = false;
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
      this.play(`slopewreck.${e.kind}`, 0.7, { x: e.x, z: e.z });
    }
  }
}
