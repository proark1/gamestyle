import { SiteAudio } from '../../shared/audio/player';
import { COURSE_DEFAULT_AUDIO } from './catalog';
import type { CourseWorld } from './types';
import { feedbackTier } from './presentation';

export class CourseCorrectionAudio extends SiteAudio {
  private last = 0;
  private baseline = false;

  constructor() {
    super('course-correction', {
      effectLimit: 18,
      range: () => 36,
      prepareManifest: (manifest) => ({
        ...manifest,
        cues: { ...COURSE_DEFAULT_AUDIO, ...manifest.cues },
      }),
    });
  }

  resetEvents() {
    this.last = 0;
    this.baseline = false;
  }

  update(world: CourseWorld, self: string) {
    const ball = world.balls.find((candidate) => candidate.owner === self);
    if (ball) this.listen(ball, 0);
    if (!this.baseline) {
      this.last = world.nextEvent;
      this.baseline = true;
      return;
    }
    for (const event of world.events) {
      if (event.id <= this.last) continue;
      this.last = event.id;
      const tier = feedbackTier(event);
      const volume =
        tier === 'celebration'
          ? 1
          : tier === 'major'
            ? 0.84
            : tier === 'course'
              ? 0.74
              : 0.58;
      this.play(`course.${event.kind}`, volume, event);
    }
  }
}
