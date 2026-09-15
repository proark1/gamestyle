import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
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
    // Forehand / overhead smash swing
    rig.body.rotation.y = -0.5;
    rig.armR.rotation.set(-2.2, -0.6, -0.3); // High follow-through
    rig.armL.rotation.set(-0.4, 0.3, 0.5);
    rig.legL.rotation.set(-0.3, 0, 0.1);
    rig.legR.rotation.set(0.4, 0, -0.1);
  } else if (pose.specialState === 'celebrating') {
    // Victorious racket pump
    rig.body.position.y = Math.abs(Math.sin(time * 8)) * 0.12;
    rig.armR.rotation.set(-2.7, 0, -0.2);
    rig.armL.rotation.set(-2.2, 0, 0.4);
    rig.legL.rotation.set(0.1, 0, 0.1);
    rig.legR.rotation.set(-0.1, 0, -0.1);
  } else if (pose.walking) {
    // Athletic court split-step running
    const stride = time * 9;
    const swing = Math.sin(stride) * 0.65;
    rig.legL.rotation.set(swing, 0, 0);
    rig.legR.rotation.set(-swing, 0, 0);
    rig.armL.rotation.set(-swing * 0.5, 0, 0.15);
    rig.armR.rotation.set(swing * 0.4 - 0.5, 0, -0.25); // Carrying racket forward
    rig.body.position.y = Math.abs(Math.sin(stride)) * 0.05;
    rig.body.rotation.set(0.08, Math.sin(stride) * 0.03, 0);
  } else {
    // Ready athletic stance
    rig.body.position.y = -0.06;
    rig.body.rotation.set(0.12, 0, 0); // Slight crouch
    rig.legL.rotation.set(0.1, 0, 0.12);
    rig.legR.rotation.set(0.1, 0, -0.12);
    rig.armL.rotation.set(-0.6, 0.3, 0.4);
    rig.armR.rotation.set(-0.8, -0.2, -0.3);
  }

  // Update racket position to track right hand
  if (rig.racket) {
    const hand = rig.armR.getObjectByName('worker-hand');
    if (hand) {
      rig.racket.position.set(0.42, 0.65, 0.2);
      rig.racket.rotation.set(rig.armR.rotation.x + 0.3, 0, 0);
    }
  }
}

export const bungeeDoublesAvatars: readonly AvatarLook[] = [
  {
    key: 'tennis-duo',
    label: 'Tennis Duo',
    dressable: true,
    create(look) {
      const root = tennisPlayer('#f5f5f7', 'orange', look);
      return {
        root,
        pose: (time, walking) => poseTennisWorker(root, time, { walking }),
      };
    },
  },
];
