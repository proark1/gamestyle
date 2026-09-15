import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { basketballPlayer } from './models';

export function poseBasketballWorker(
  model: T.Object3D,
  time: number,
  pose: {
    moving: boolean;
    shooting: boolean;
    dunking: boolean;
    dribbling: boolean;
    color: number;
    still: boolean;
  },
) {
  const rig = model.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;
  if (!rig?.body) return;

  if (pose.dunking) {
    // Airborne slam dunk: right arm held high over head, left arm out for balance, legs bent back
    rig.body.rotation.z = 0;
    rig.body.rotation.x = 0.2;
    rig.legL.rotation.x = 0.5;
    rig.legR.rotation.x = 0.7;
    rig.armL.rotation.x = -1.1;
    rig.armR.rotation.x = -2.85;
  } else if (pose.shooting) {
    // Jump shot release: both arms raised high above head
    rig.body.rotation.z = 0;
    rig.body.rotation.x = 0;
    rig.legL.rotation.x = 0.15;
    rig.legR.rotation.x = -0.15;
    rig.armL.rotation.x = -2.7;
    rig.armR.rotation.x = -2.75;
  } else if (pose.dribbling) {
    // Dribble movement: right arm bouncing ball, legs walking
    rig.body.rotation.z = pose.still
      ? 0
      : Math.sin(time * 2 + pose.color) * 0.02;
    const legSwing = pose.moving ? Math.sin(time * 12) * 0.6 : 0;
    rig.legL.rotation.x = legSwing;
    rig.legR.rotation.x = -legSwing;
    rig.armL.rotation.x = -legSwing * 0.5 - 0.2;
    // Dribbling arm pumping up and down
    rig.armR.rotation.x = -0.55 + Math.sin(time * 10) * 0.45;
  } else {
    // Normal standing / walking
    rig.body.rotation.z = pose.still
      ? 0
      : Math.sin(time * 2 + pose.color) * 0.02;
    rig.body.rotation.x = 0;
    const swing = pose.moving ? Math.sin(time * 12) * 0.6 : 0;
    rig.legL.rotation.x = swing;
    rig.legR.rotation.x = -swing;
    rig.armL.rotation.x = -swing * 0.65;
    rig.armR.rotation.x = swing * 0.65;
  }
}

export const basketballAvatars: readonly AvatarLook[] = [
  {
    key: 'baller',
    label: 'Street Baller',
    dressable: true,
    create(look) {
      const root = basketballPlayer('#e58e38', 'orange', look);
      return {
        root,
        pose: (time, walking) =>
          poseBasketballWorker(root, time, {
            moving: walking,
            shooting: false,
            dunking: false,
            dribbling: false,
            color: 0,
            still: false,
          }),
      };
    },
  },
];
