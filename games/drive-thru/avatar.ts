import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { box } from '../../shared/rendering/primitives';
import { WORKER_HEAD_TOP } from '../../shared/rendering/worker';

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
      const root = dressedWorker(
        0,
        {
          shirt: '#b91c1c', // Diner red shirt
          overalls: '#1f2937', // Dark slacks
          boots: '#111827', // Sneaker soles
          cap: true,
        },
        look,
      ).model;
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
      const { model: root, worn } = dressedWorker(
        1,
        {
          shirt: '#ffffff', // Crisp white cook shirt
          overalls: '#f59e0b', // Fast-food mustard yellow apron
          boots: '#4b5563', // Non-slip kitchen clogs
          cap: false,
        },
        look,
      );
      if (!worn.hat) {
        const body = root.userData.body as T.Group;
        if (body) {
          box(
            body,
            [0.55, 0.22, 0.32],
            [0, WORKER_HEAD_TOP + 0.11, 0],
            '#ffffff',
          );
          box(
            body,
            [0.56, 0.05, 0.33],
            [0, WORKER_HEAD_TOP + 0.02, 0],
            '#b91c1c',
          );
        }
      }
      return {
        root,
        pose: (time, walking) => poseCook(root, time, walking),
      };
    },
  },
];
