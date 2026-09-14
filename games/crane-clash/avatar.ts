import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';

export function poseCraneWorker(
  model: T.Object3D,
  time: number,
  pose: {
    moving: boolean;
    swinging: boolean;
    color: number;
    still: boolean;
  },
) {
  const rig = model.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;
  if (!rig?.body) return;

  if (pose.swinging) {
    // Dangling in harness: legs dangling, arms reaching down
    rig.body.rotation.z = Math.sin(time * 3 + pose.color) * 0.15;
    rig.body.rotation.x = Math.sin(time * 4) * 0.2;
    rig.legL.rotation.x = Math.sin(time * 6) * 0.35 + 0.2;
    rig.legR.rotation.x = -Math.sin(time * 6) * 0.35 + 0.2;
    rig.armL.rotation.x = -1.2 + Math.sin(time * 5) * 0.2;
    rig.armR.rotation.x = -1.2 - Math.sin(time * 5) * 0.2;
  } else {
    rig.body.rotation.z = pose.still
      ? 0
      : Math.sin(time * 2 + pose.color) * 0.02;
    const legSwing = pose.moving ? Math.sin(time * 12) * 0.55 : 0;
    rig.legL.rotation.x = legSwing;
    rig.legR.rotation.x = -legSwing;
    rig.armL.rotation.x = -legSwing * 0.6;
    rig.armR.rotation.x = legSwing * 0.6;
  }
}

export const craneClashAvatars: readonly AvatarLook[] = [
  {
    key: 'crane-crew',
    label: 'Crane Crew',
    dressable: true,
    create(look) {
      const root = dressedWorker(0, {}, look).model;
      return {
        root,
        pose: (time, walking) =>
          poseCraneWorker(root, time, {
            moving: walking,
            swinging: false,
            color: 0,
            still: false,
          }),
      };
    },
  },
];
