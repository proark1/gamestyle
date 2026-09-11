import * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { createRobot, poseRobot } from './models';
import { freshBreakfast } from './simulation';

/** How often the preview robot plants a foot while it walks. */
const STEP_MS = 480;

export const breakfastAvatars: readonly AvatarLook[] = [
  {
    key: 'robot',
    label: 'Robot',
    create() {
      const robot = createRobot();
      const root = new T.Group();
      root.add(robot.body, ...robot.limbs.map((limb) => limb.group));
      const world = freshBreakfast(0);
      world.robot.x = 0;
      // Nothing has stepped or kicked yet, so every foot starts on the floor.
      for (const limb of world.limbs) limb.stepAt = limb.kickAt = -Infinity;
      return {
        root,
        pose: (time, walking) => {
          const now = time * 1000;
          world.clock = now;
          if (walking) {
            // The feet take turns, the way a team walks the robot.
            const step = Math.floor(now / STEP_MS);
            world.limbs[2 + (step % 2)].stepAt = step * STEP_MS;
          }
          poseRobot(robot, world, now, false);
        },
      };
    },
  },
];
