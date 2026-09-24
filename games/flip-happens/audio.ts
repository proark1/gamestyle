import { SiteAudio } from '../../shared/audio/player';
import { FLIP_DEFAULT_AUDIO } from './catalog';
import type { World } from './types';
export class FlipAudio extends SiteAudio {
  private last = 0;
  private baseline = false;
  constructor() {
    super('flip-happens', {
      effectLimit: 12,
      range: () => 25,
      prepareManifest: (m) => ({
        ...m,
        cues: { ...FLIP_DEFAULT_AUDIO, ...m.cues },
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
    for (const e of w.events)
      if (e.id > this.last) {
        this.last = e.id;
        this.play(`flip.${e.kind}`, e.strength, { x: e.x, z: e.z });
      }
  }
}
