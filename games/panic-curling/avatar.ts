import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import type { PlayerStatus } from './types';

/**
 * Poses the shared worker for winter curling: delivery slide lunges,
 * rapid-fire sweeping, banana slips, and icy chattering shivering.
 */
export function poseCurler(
  model: T.Object3D,
  time: number,
  pose: {
    status: PlayerStatus;
    moving: boolean;
    sweepIntensity: number;
    color: number;
  },
) {
  const rig = model.userData as {
    body?: T.Group;
    legL?: T.Group;
    legR?: T.Group;
    armL?: T.Group;
    armR?: T.Group;
  };
  if (!rig.body || !rig.legL || !rig.legR || !rig.armL || !rig.armR) return;

  switch (pose.status) {
    case 'sliding': {
      // Classic curling delivery slide: one knee bent deep, other leg extended straight back
      rig.body.position.y = -0.32;
      rig.body.rotation.set(0.25, 0, 0);
      rig.legL.rotation.set(-1.15, 0, 0);
      rig.legR.rotation.set(1.4, 0, 0.1);
      rig.armL.rotation.set(-0.6, 0, 0.5); // stabilizer arm
      rig.armR.rotation.set(-1.5, 0, -0.15); // arm guiding stone
      break;
    }

    case 'sweeping': {
      // High-cadence scrubbing action
      const sweepRate = time * 24.0;
      const scrub = Math.sin(sweepRate) * 0.75;
      rig.body.position.y = -0.1 + Math.abs(Math.sin(sweepRate)) * 0.04;
      rig.body.rotation.set(0.35, scrub * 0.1, 0);
      // Legs crouched in low athletic stance
      rig.legL.rotation.set(-0.35, 0, 0.1);
      rig.legR.rotation.set(0.35, 0, -0.1);
      // Arms aggressively pumping broom handle
      rig.armL.rotation.set(-1.2 + scrub * 0.5, 0, 0.35);
      rig.armR.rotation.set(-1.2 - scrub * 0.5, 0, -0.35);
      break;
    }

    case 'slipping': {
      // Comical cartoon banana slip: legs high in the air, torso thrown back
      rig.body.position.y = 0.2 + Math.sin(time * 12) * 0.08;
      rig.body.rotation.set(-0.85, 0, Math.sin(time * 15) * 0.3);
      rig.legL.rotation.set(-1.7, 0, -0.2);
      rig.legR.rotation.set(-1.5, 0, 0.2);
      rig.armL.rotation.set(2.4, 0, 0.6);
      rig.armR.rotation.set(2.2, 0, -0.6);
      break;
    }

    case 'freezing': {
      // Plunged into ice hole: shivering teeth chatter
      const chattering = Math.sin(time * 36) * 0.06;
      rig.body.position.y = -0.65 + chattering;
      rig.body.rotation.set(0, 0, chattering);
      rig.legL.rotation.set(0, 0, 0);
      rig.legR.rotation.set(0, 0, 0);
      rig.armL.rotation.set(-1.8, 0, 0.5 + chattering);
      rig.armR.rotation.set(-1.8, 0, -0.5 - chattering);
      break;
    }

    case 'normal':
    default: {
      if (pose.moving) {
        // Skating / running on slick shoes
        const stride = time * 9.0;
        const swing = Math.sin(stride) * 0.65;
        rig.body.position.y = Math.abs(Math.sin(stride)) * 0.04;
        rig.body.rotation.set(0.12, 0, swing * 0.04);
        rig.legL.rotation.set(swing, 0, 0);
        rig.legR.rotation.set(-swing, 0, 0);
        rig.armL.rotation.set(-swing * 0.65, 0, 0.1);
        rig.armR.rotation.set(swing * 0.65, 0, -0.1);
      } else {
        // Ready idle stance
        rig.body.position.y = Math.sin(time * 2) * 0.015;
        rig.body.rotation.set(0.04, 0, 0);
        rig.legL.rotation.set(0, 0, 0.05);
        rig.legR.rotation.set(0, 0, -0.05);
        rig.armL.rotation.set(0, 0, 0.1);
        rig.armR.rotation.set(0, 0, -0.1);
      }
      break;
    }
  }
}

export const curlingAvatars: readonly AvatarLook[] = [
  {
    key: 'curler',
    label: 'Olympic Curler',
    dressable: true,
    create(look) {
      const root = dressedWorker(
        0,
        {
          shirt: '#d94b38',
          overalls: '#223242',
          boots: '#111822',
        },
        look,
      ).model;
      return {
        root,
        pose: (time, walking) =>
          poseCurler(root, time, {
            status: 'normal',
            moving: walking,
            sweepIntensity: 0,
            color: 0,
          }),
      };
    },
  },
];
