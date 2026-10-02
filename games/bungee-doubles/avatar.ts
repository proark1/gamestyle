import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { GAME_HAND_Y as WORKER_HAND_Y } from '../../shared/rendering/game-avatar';
import { tennisPlayer } from './models';
import type { SpecialState } from './types';

export function poseTennisWorker(
  model: T.Object3D,
  time: number,
  pose: {
    walking: boolean;
    specialState?: SpecialState;
  },
) {
  const rig = model.userData as {
    body?: T.Group;
    legL?: T.Group;
    legR?: T.Group;
    armL?: T.Group;
    armR?: T.Group;
    racket?: T.Group;
  };
  if (!rig.body || !rig.legL || !rig.legR || !rig.armL || !rig.armR) return;

  // Reset transforms
  rig.body.position.set(0, 0, 0);
  rig.body.rotation.set(0, 0, 0);

  if (pose.specialState === 'stunned') {
    // Comical dizzy stagger after team bonk
    rig.body.rotation.x = 0.45;
    rig.body.rotation.z = Math.sin(time * 10) * 0.3;
    rig.body.position.y = -0.15;
    rig.armL.rotation.set(-1.2 + Math.sin(time * 12) * 0.4, 0, 0.5);
    rig.armR.rotation.set(-1.2 - Math.sin(time * 12) * 0.4, 0, -0.5);
    rig.legL.rotation.set(0.3, 0, 0.2);
    rig.legR.rotation.set(-0.3, 0, -0.2);
  } else if (pose.specialState === 'diving') {
    // Horizontal dive save slide
    rig.body.position.y = -0.35;
    rig.body.rotation.x = 1.35; // nearly parallel to ground
    rig.armR.rotation.set(-2.8, 0, 0.2); // racket outstretched forward
    rig.armL.rotation.set(0.6, 0, -0.4);
    rig.legL.rotation.set(0.2, 0, 0.1);
    rig.legR.rotation.set(0.3, 0, -0.1);
  } else if (
    pose.specialState === 'smashing' ||
    pose.specialState === 'swinging'
  ) {
    // Forehand / overhead smash swing arc
    const isSmash = pose.specialState === 'smashing';
    rig.body.rotation.y = -0.4;
    rig.body.rotation.x = isSmash ? 0.25 : 0.05;
    rig.armR.rotation.set(isSmash ? -2.6 : -1.9, -0.45, -0.35); // Powerful stroke follow-through
    rig.armL.rotation.set(-0.4, 0.35, 0.6);
    rig.legL.rotation.set(-0.3, 0, 0.1);
    rig.legR.rotation.set(0.4, 0, -0.1);
  } else if (pose.specialState === 'celebrating') {
    // Victorious racket pump
    rig.body.position.y = Math.abs(Math.sin(time * 8)) * 0.14;
    rig.armR.rotation.set(-2.8, 0, -0.2);
    rig.armL.rotation.set(-2.2, 0, 0.4);
    rig.legL.rotation.set(0.1, 0, 0.1);
    rig.legR.rotation.set(-0.1, 0, -0.1);
  } else if (pose.walking) {
    // Athletic court split-step running
    const stride = time * 9.5;
    const swing = Math.sin(stride) * 0.7;
    rig.legL.rotation.set(swing, 0, 0.05);
    rig.legR.rotation.set(-swing, 0, -0.05);
    rig.armL.rotation.set(-swing * 0.6, 0, 0.2);
    rig.armR.rotation.set(swing * 0.35 - 0.7, -0.2, -0.25);
    rig.body.position.y = Math.abs(Math.sin(stride)) * 0.06;
    rig.body.rotation.set(
      0.12,
      Math.sin(stride) * 0.05,
      Math.sin(stride) * 0.03,
    );
  } else {
    // Ready athletic stance
    rig.body.position.y = -0.06;
    rig.body.rotation.set(0.14, 0, 0); // Active crouch
    rig.legL.rotation.set(0.12, 0, 0.12);
    rig.legR.rotation.set(0.12, 0, -0.12);
    rig.armL.rotation.set(-0.6, 0.3, 0.4);
    rig.armR.rotation.set(-0.85, -0.2, -0.3);
  }

  // Ensure padel bat is gripped in player's right hand
  const gripArm = model.userData.sleeveR as T.Group;
  if (rig.racket && rig.racket.parent !== gripArm) {
    gripArm.add(rig.racket);
    rig.racket.position.set(0, WORKER_HAND_Y + 0.01, 0.04);
    rig.racket.rotation.set(Math.PI / 2 + 0.15, 0, 0);
  }
}

export const bungeeDoublesAvatars: readonly AvatarLook[] = [
  {
    key: 'tennis-duo',
    label: 'Tennis Duo',
    dressable: true,
    // The game's own player, on the red team, so preview and court match.
    create(look) {
      const root = tennisPlayer('red', look);
      return {
        root,
        pose: (time, walking) => poseTennisWorker(root, time, { walking }),
      };
    },
  },
];
