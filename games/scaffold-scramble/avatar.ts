import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import type { PlayerState } from './types';

export function poseScaffoldWorker(
  model: T.Object3D,
  time: number,
  pose: {
    state: PlayerState;
    moving: boolean;
    color: number;
    facing: number;
  },
) {
  const rig = model.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;
  if (!rig?.body) return;

  // Reset default torso rotation
  rig.body.rotation.set(0, 0, 0);

  switch (pose.state) {
    case 'dangling': {
      // Worker is dangling below the cradle by their harness tether!
      // Legs flailing/kicking frantically in empty air, arms reaching upward
      const pedal = time * 9 + pose.color;
      rig.body.rotation.z = Math.sin(time * 3 + pose.color) * 0.15;
      rig.body.rotation.x = 0.2 + Math.sin(time * 4) * 0.1;

      rig.legL.rotation.x = Math.sin(pedal) * 0.6 + 0.3;
      rig.legR.rotation.x = -Math.sin(pedal) * 0.6 + 0.3;
      rig.armL.rotation.x = -2.6 + Math.sin(time * 6) * 0.2;
      rig.armR.rotation.x = -2.6 - Math.sin(time * 6) * 0.2;
      break;
    }

    case 'climbing': {
      // Pulling up on safety rope
      const climb = time * 7;
      rig.legL.rotation.x = 0.4 + Math.sin(climb) * 0.2;
      rig.legR.rotation.x = 0.4 - Math.sin(climb) * 0.2;
      rig.armL.rotation.x = -1.8 + Math.sin(climb) * 0.6;
      rig.armR.rotation.x = -1.8 - Math.sin(climb) * 0.6;
      break;
    }

    case 'sliding': {
      // Slipping on tilted deck! Torso leans back, arms flail outward
      rig.body.rotation.z = -0.3 * pose.facing;
      rig.body.rotation.x = -0.25;
      rig.legL.rotation.x = -0.4;
      rig.legR.rotation.x = 0.2;
      rig.armL.rotation.x = -1.5 + Math.sin(time * 12) * 0.4;
      rig.armL.rotation.z = -0.8;
      rig.armR.rotation.x = -1.5 - Math.sin(time * 12) * 0.4;
      rig.armR.rotation.z = 0.8;
      break;
    }

    case 'cranking': {
      // Vigorous two-handed circular ratchet cranking
      const crankAngle = time * 10;
      rig.body.rotation.x = 0.18;
      rig.armL.rotation.x = -1.3 + Math.sin(crankAngle) * 0.45;
      rig.armL.rotation.y = 0.2 + Math.cos(crankAngle) * 0.3;
      rig.armR.rotation.x = -1.3 - Math.sin(crankAngle) * 0.45;
      rig.armR.rotation.y = -0.2 - Math.cos(crankAngle) * 0.3;
      rig.legL.rotation.x = 0.15;
      rig.legR.rotation.x = -0.15;
      break;
    }

    case 'cleaning': {
      // Squeegee wipe / foam slap across window
      const wipe = Math.sin(time * 8) * 0.7;
      rig.body.rotation.y = 0.2 * pose.facing;
      rig.armR.rotation.x = -1.2 + wipe;
      rig.armR.rotation.z = -0.4;
      rig.armL.rotation.x = -0.5;
      rig.legL.rotation.x = 0;
      rig.legR.rotation.x = 0;
      break;
    }

    case 'shooing': {
      // Shooing pigeon: arms waving wildly high in the air
      const flap = Math.sin(time * 14) * 0.5;
      rig.armL.rotation.x = -2.5 + flap;
      rig.armR.rotation.x = -2.5 - flap;
      rig.armL.rotation.z = -0.6;
      rig.armR.rotation.z = 0.6;
      break;
    }

    case 'standing':
    default: {
      if (pose.moving) {
        // Natural walking stride
        const stride = time * 8;
        const swing = Math.sin(stride) * 0.55;
        rig.legL.rotation.x = swing;
        rig.legR.rotation.x = -swing;
        rig.armL.rotation.x = -swing * 0.6;
        rig.armR.rotation.x = swing * 0.6;
        rig.body.position.y = Math.abs(Math.sin(stride)) * 0.04;
      } else {
        // Idle breathing
        rig.legL.rotation.set(0, 0, 0);
        rig.legR.rotation.set(0, 0, 0);
        rig.armL.rotation.set(0, 0, 0.08);
        rig.armR.rotation.set(0, 0, -0.08);
        rig.body.position.y = Math.sin(time * 2) * 0.012;
      }
      break;
    }
  }
}

export const scaffoldAvatars: readonly AvatarLook[] = [
  {
    key: 'scaffold-cleaner',
    label: 'High-Rise Cleaner',
    dressable: true,
    create(look) {
      const root = dressedWorker(0, {}, look).model;
      return {
        root,
        pose: (time, walking) =>
          poseScaffoldWorker(root, time, {
            state: 'standing',
            moving: walking,
            color: 0,
            facing: 1,
          }),
      };
    },
  },
];
