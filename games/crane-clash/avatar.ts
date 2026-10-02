import * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedGameAvatar as dressedWorker } from '../../shared/rendering/game-avatar';
import { beam, box } from '../../shared/rendering/primitives';
import type { Look } from '../../shared/wardrobe/look';
import { TEAM_COLORS, type Role, type TeamId } from './types';

/** A crane crew member: the worker in their team's shirt and cap. */
export function craneWorker(
  team: TeamId,
  color: number,
  look?: Look,
  role?: Role,
) {
  const model = dressedWorker(color, { shirt: TEAM_COLORS[team] }, look).model;
  if (role === 'swinger') {
    // The harness makes the overhead attachment legible while the avatar swings.
    const harness = new T.Group();
    for (const side of [-1, 1]) {
      beam(
        harness,
        [side * 0.2, 1.18, 0.23],
        [side * 0.13, 0.66, 0.26],
        0.09,
        '#f5bd39',
      );
      beam(
        harness,
        [side * 0.22, 1.2, 0],
        [side * 0.3, 1.87, 0],
        0.045,
        '#39454c',
      );
      beam(harness, [side * 0.3, 1.87, 0], [0, 2.0, 0], 0.045, '#39454c');
    }
    box(harness, [0.5, 0.1, 0.44], [0, 0.65, 0], '#3d4242');
    box(harness, [0.18, 0.14, 0.07], [0, 0.68, 0.28], '#f8d876');
    model.add(harness);
  }
  return model;
}

export function poseCraneWorker(
  model: T.Object3D,
  time: number,
  pose: {
    moving: boolean;
    swinging: boolean;
    operating?: boolean;
    steering?: number;
    lift?: number;
    velocityX?: number;
    velocityZ?: number;
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
    const speed = Math.hypot(pose.velocityX ?? 0, pose.velocityZ ?? 0);
    rig.body.rotation.z = Math.max(
      -0.18,
      Math.min(0.18, -(pose.velocityX ?? 0) * 0.035),
    );
    rig.body.rotation.x = Math.max(
      -0.18,
      Math.min(0.18, (pose.velocityZ ?? 0) * 0.035),
    );
    rig.legL.rotation.x =
      0.18 + Math.sin(time * 4 + pose.color) * Math.min(0.24, speed * 0.05);
    rig.legR.rotation.x =
      0.18 - Math.sin(time * 4 + pose.color) * Math.min(0.24, speed * 0.05);
    rig.armL.rotation.x = -0.45 + Math.sin(time * 2.4) * 0.08;
    rig.armR.rotation.x = -0.45 - Math.sin(time * 2.4) * 0.08;
  } else if (pose.operating) {
    // Bend the legs into the seat and let each hand work its lever.
    rig.body.rotation.z = (pose.steering ?? 0) * 0.07;
    rig.body.rotation.x = -0.06;
    rig.legL.rotation.x = -1.2;
    rig.legR.rotation.x = -1.2;
    rig.armL.rotation.x = -1.05 + (pose.steering ?? 0) * 0.22;
    rig.armR.rotation.x = -1.05 + (pose.lift ?? 0) * 0.28;
  } else {
    rig.body.rotation.z = pose.still
      ? 0
      : Math.sin(time * 2 + pose.color) * 0.02;
    const legSwing = pose.moving ? Math.sin(time * 12) * 0.55 : 0;
    rig.body.rotation.x = 0;
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
      const root = craneWorker('red', 0, look);
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
