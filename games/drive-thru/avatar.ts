import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { createDriveThruWorker } from './models';

export function poseDriver(
  model: T.Object3D,
  time: number,
  walking: boolean,
): void {
  if (walking) {
    poseWorker(model, time, 'walk');
  } else {
    poseWorker(model, time, 'still');
    const rig = model.userData as {
      armL?: T.Group;
      armR?: T.Group;
    };
    if (rig.armL && rig.armR) {
      // Hands grasping the steering wheel
      const sway = Math.sin(time * 3) * 0.05;
      rig.armL.rotation.set(-0.8 + sway, 0.2, 0.3);
      rig.armR.rotation.set(-0.8 - sway, -0.2, -0.3);
    }
  }
}

export function poseCook(
  model: T.Object3D,
  time: number,
  walking: boolean,
): void {
  if (walking) {
    poseWorker(model, time, 'walk');
  } else {
    poseWorker(model, time, 'still');
    const rig = model.userData as {
      armL?: T.Group;
      armR?: T.Group;
    };
    if (rig.armR) {
      // Flipping spatula rhythm
      const flip = Math.sin(time * 5) * 0.15;
      rig.armR.rotation.set(-0.9 + flip, 0, 0);
    }
  }
}

export const driveThruAvatars: readonly AvatarLook[] = [
  {
    key: 'driver',
    label: 'Drive-Thru Driver',
    dressable: true,
    create(look) {
      const root = createDriveThruWorker('driver', 0, look);
      return {
        root,
        pose: (time, walking) => poseDriver(root, time, walking),
      };
    },
  },
  {
    key: 'cook',
    label: 'Kitchen Grill Cook',
    dressable: true,
    create(look) {
      const root = createDriveThruWorker('grill', 1, look);
      return {
        root,
        pose: (time, walking) => poseCook(root, time, walking),
      };
    },
  },
];
