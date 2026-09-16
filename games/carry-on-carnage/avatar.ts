import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { poseWorker } from '../../shared/rendering/worker-pose';

export function poseTraveler(
  model: T.Object3D,
  time: number,
  walking: boolean,
) {
  if (walking) {
    poseWorker(model, time, 'walk');
  } else {
    // Scurrying anxious traveler idle: slight foot-tapping fidget
    poseWorker(model, time, 'still');
    const rig = model.userData as {
      armL?: T.Group;
      armR?: T.Group;
    };
    if (rig.armL && rig.armR) {
      const fidget = Math.sin(time * 6) * 0.08;
      rig.armL.rotation.set(-0.3 + fidget, 0, 0.15);
      rig.armR.rotation.set(-0.3 - fidget, 0, -0.15);
    }
  }
}

export const carryOnCarnageAvatars: readonly AvatarLook[] = [
  {
    key: 'traveler',
    label: 'Desperate Traveler',
    dressable: true,
    create(look) {
      const root = dressedWorker(
        0,
        {
          shirt: '#ea580c', // Vibrant tourist shirt
          overalls: '#1e3a8a', // Denim trousers
          boots: '#78350f', // Travel boots
        },
        look,
      ).model;
      return {
        root,
        pose: (time, walking) => poseTraveler(root, time, walking),
      };
    },
  },
];
