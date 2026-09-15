import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { basketballPlayer } from './models';

export function poseBasketballWorker(
  model: T.Object3D,
  time: number,
  pose: {
    moving: boolean;
    shooting: boolean;
    dunking: 'tomahawk' | 'hang' | 'windmill' | boolean;
    hanging?: boolean;
    celebrating?: boolean;
    stumbled?: boolean;
    crossover?: boolean;
    spinning?: boolean;
    dribbling: boolean;
    defending?: boolean;
    tilt?: number;
    color: number;
    still: boolean;
  },
) {
  const rig = model.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;
  if (!rig?.body) return;

  // Reset standard body positioning
  rig.body.position.y = 0;
  rig.body.position.x = 0;
  rig.body.position.z = 0;
  rig.body.rotation.y = 0;

  // Apply banking tilt into turns
  const bankingTilt = pose.tilt ?? 0;

  if (pose.hanging) {
    // Two-handed rim hang: both arms straight up overhead gripping iron, legs dangling & swinging
    rig.body.rotation.x = Math.sin(time * 8) * 0.15;
    rig.body.rotation.z = 0;
    rig.armL.rotation.x = -3.0;
    rig.armR.rotation.x = -3.0;
    rig.armL.rotation.z = -0.15;
    rig.armR.rotation.z = 0.15;
    rig.legL.rotation.x = 0.6 + Math.sin(time * 8) * 0.2;
    rig.legR.rotation.x = 0.8 + Math.sin(time * 8) * 0.2;
  } else if (pose.celebrating) {
    // Post-dunk celebration: pumped double bicep flex with joyous hop
    rig.body.rotation.x = -0.12; // proud puff
    rig.body.rotation.z = Math.sin(time * 6) * 0.05;
    rig.body.position.y = Math.abs(Math.sin(time * 8)) * 0.15;
    rig.armL.rotation.x = -2.5;
    rig.armR.rotation.x = -2.5;
    rig.armL.rotation.z = -0.55;
    rig.armR.rotation.z = 0.55;
    rig.legL.rotation.x = 0.2;
    rig.legR.rotation.x = -0.2;
  } else if (pose.stumbled) {
    // Broken ankles stumble: unbalanced slouch, arms flailing for support
    rig.body.rotation.x = 0.55;
    rig.body.rotation.z = Math.sin(time * 10) * 0.35;
    rig.body.position.y = -0.2;
    rig.armL.rotation.x = -1.2 + Math.sin(time * 12) * 0.4;
    rig.armR.rotation.x = 0.8 + Math.cos(time * 12) * 0.4;
    rig.armL.rotation.z = -0.7;
    rig.armR.rotation.z = 0.7;
    rig.legL.rotation.x = -0.7;
    rig.legR.rotation.x = 0.8;
  } else if (pose.dunking) {
    const isWindmill = pose.dunking === 'windmill';
    const isHang = pose.dunking === 'hang';

    if (isWindmill) {
      // Windmill 360: arms windmill around full circle
      const windmillAngle = (time * 16) % (Math.PI * 2);
      rig.body.rotation.x = 0.25;
      rig.body.rotation.z = Math.sin(time * 14) * 0.2;
      rig.armR.rotation.x = -windmillAngle;
      rig.armL.rotation.x = -windmillAngle + Math.PI;
      rig.legL.rotation.x = 0.6;
      rig.legR.rotation.x = 0.8;
    } else if (isHang) {
      // Power two-hand jam: both arms driving down at rim
      rig.body.rotation.x = 0.3;
      rig.body.rotation.z = 0;
      rig.armL.rotation.x = -2.9;
      rig.armR.rotation.x = -2.9;
      rig.legL.rotation.x = 0.6;
      rig.legR.rotation.x = 0.6;
    } else {
      // Classic Tomahawk slam: right arm cocked high behind head, left arm balancing
      rig.body.rotation.z = 0;
      rig.body.rotation.x = 0.2;
      rig.legL.rotation.x = 0.5;
      rig.legR.rotation.x = 0.7;
      rig.armL.rotation.x = -1.1;
      rig.armR.rotation.x = -2.85;
    }
  } else if (pose.shooting) {
    // Jump shot release: both arms raised high above head
    rig.body.rotation.z = 0;
    rig.body.rotation.x = 0;
    rig.legL.rotation.x = 0.15;
    rig.legR.rotation.x = -0.15;
    rig.armL.rotation.x = -2.7;
    rig.armR.rotation.x = -2.75;
  } else if (pose.crossover) {
    // Low athletic crossover juke
    rig.body.rotation.x = 0.25;
    rig.body.rotation.z = Math.sin(time * 18) * 0.25 + bankingTilt;
    rig.legL.rotation.x = 0.4;
    rig.legR.rotation.x = -0.4;
    rig.armL.rotation.x = -0.8 + Math.sin(time * 18) * 0.5;
    rig.armR.rotation.x = -0.8 - Math.sin(time * 18) * 0.5;
  } else if (pose.dribbling) {
    // Dribble movement: right arm bouncing ball, legs walking
    rig.body.rotation.z =
      bankingTilt + (pose.still ? 0 : Math.sin(time * 2 + pose.color) * 0.02);
    rig.body.rotation.x = pose.moving ? 0.12 : 0;
    const legSwing = pose.moving ? Math.sin(time * 12) * 0.6 : 0;
    rig.legL.rotation.x = legSwing;
    rig.legR.rotation.x = -legSwing;
    rig.armL.rotation.x = -legSwing * 0.5 - 0.2;
    // Dribbling arm pumping up and down
    rig.armR.rotation.x = -0.55 + Math.sin(time * 10) * 0.45;
  } else if (pose.defending) {
    // Athletic defensive stance: crouched, knees bent, arms spread wide to contest
    rig.body.position.y = -0.08;
    rig.body.rotation.x = 0.18;
    rig.body.rotation.z = bankingTilt;
    rig.legL.rotation.x = 0.35;
    rig.legR.rotation.x = -0.2;
    rig.armL.rotation.x = -0.6;
    rig.armR.rotation.x = -0.6;
    rig.armL.rotation.z = -1.1 + Math.sin(time * 6) * 0.1;
    rig.armR.rotation.z = 1.1 - Math.sin(time * 6) * 0.1;
  } else {
    // Normal standing / walking
    rig.body.position.y = pose.still
      ? Math.sin(time * 3 + pose.color) * 0.02
      : 0;
    rig.body.rotation.z =
      bankingTilt + (pose.still ? 0 : Math.sin(time * 2 + pose.color) * 0.02);
    rig.body.rotation.x = pose.moving ? 0.1 : 0;
    const swing = pose.moving ? Math.sin(time * 12) * 0.6 : 0;
    rig.legL.rotation.x = swing;
    rig.legR.rotation.x = -swing;
    rig.armL.rotation.x = -swing * 0.65;
    rig.armR.rotation.x = swing * 0.65;
  }
}

/**
 * Animate seated / standing spectators on the bleachers.
 */
export function poseSpectatorWorker(
  model: T.Object3D,
  time: number,
  seed: number,
  cheering: boolean,
) {
  const rig = model.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;
  if (!rig?.body) return;

  if (cheering) {
    // Cheering: arms raised pumping in the air, head bobbing
    rig.body.rotation.x = -0.15;
    rig.body.rotation.z = Math.sin(time * 10 + seed) * 0.08;
    rig.armL.rotation.x = -2.6 + Math.sin(time * 12 + seed) * 0.3;
    rig.armR.rotation.x = -2.6 - Math.sin(time * 12 + seed) * 0.3;
    rig.armL.rotation.z = -0.4;
    rig.armR.rotation.z = 0.4;
  } else {
    // Subtle seated idle: slight head tracking and breathing
    rig.body.rotation.x = Math.sin(time * 2 + seed) * 0.04;
    rig.body.rotation.y = Math.sin(time * 1.5 + seed * 2) * 0.12;
    rig.armL.rotation.x = -0.4;
    rig.armR.rotation.x = -0.4;
    rig.armL.rotation.z = -0.1;
    rig.armR.rotation.z = 0.1;
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
