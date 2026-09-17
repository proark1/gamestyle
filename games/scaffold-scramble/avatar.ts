import * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { box } from '../../shared/rendering/primitives';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import type { PlayerState } from './types';

/**
 * Attaches high-visibility fall-arrest safety harness webbing and back D-ring
 * to the worker model if not already present.
 */
function ensureHarness(model: T.Object3D) {
  if (model.userData.hasHarness) return;
  model.userData.hasHarness = true;

  const rig = model.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;
  if (!rig?.body) return;

  const harnessColor = '#ea580c'; // International Safety Orange

  // Chest cross straps
  box(rig.body, [0.46, 0.07, 0.05], [0, 0.96, 0.24], harnessColor);
  // Shoulder webbing straps
  box(rig.body, [0.08, 0.46, 0.05], [-0.18, 1.05, 0.23], harnessColor);
  box(rig.body, [0.08, 0.46, 0.05], [0.18, 1.05, 0.23], harnessColor);

  // Back webbing & fall-arrest D-Ring
  box(rig.body, [0.08, 0.48, 0.05], [-0.18, 1.05, -0.23], harnessColor);
  box(rig.body, [0.08, 0.48, 0.05], [0.18, 1.05, -0.23], harnessColor);
  box(rig.body, [0.44, 0.07, 0.05], [0, 1.05, -0.24], harnessColor);

  // Steel D-ring on the upper back where lanyard connects
  const dRingGeo = new T.TorusGeometry(0.08, 0.02, 6, 16);
  const dRingMat = new T.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.9,
    roughness: 0.2,
  });
  const dRing = new T.Mesh(dRingGeo, dRingMat);
  dRing.position.set(0, 1.05, -0.26);
  rig.body.add(dRing);
}

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
  ensureHarness(model);

  const rig = model.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;
  if (!rig?.body) return;

  // Reset default torso rotation
  rig.body.rotation.set(0, 0, 0);

  switch (pose.state) {
    case 'dangling': {
      // Worker is dangling below the cradle by their harness lanyard!
      // Dramatic pendulum swing with wild leg kicks and reaching arms
      const swingFreq = time * 3.6 + pose.color * 1.2;
      const kickFreq = time * 11 + pose.color * 2.0;

      rig.body.rotation.z = Math.sin(swingFreq) * 0.32;
      rig.body.rotation.x = 0.28 + Math.sin(time * 4.5) * 0.12;

      // Frantic leg bicycling in empty air
      rig.legL.rotation.x = Math.sin(kickFreq) * 0.85 + 0.2;
      rig.legR.rotation.x = -Math.sin(kickFreq) * 0.85 + 0.2;

      // Both arms stretched upward reaching desperately for the cradle floor
      rig.armL.rotation.x = -2.75 + Math.sin(time * 7) * 0.22;
      rig.armL.rotation.z = -0.35;
      rig.armR.rotation.x = -2.75 - Math.sin(time * 7) * 0.22;
      rig.armR.rotation.z = 0.35;
      break;
    }

    case 'climbing': {
      // Hand-over-hand pulling up the safety lanyard
      const climb = time * 8;
      rig.body.rotation.x = 0.2;
      rig.legL.rotation.x = 0.45 + Math.sin(climb) * 0.25;
      rig.legR.rotation.x = 0.45 - Math.sin(climb) * 0.25;
      rig.armL.rotation.x = -2.1 + Math.sin(climb) * 0.65;
      rig.armR.rotation.x = -2.1 - Math.sin(climb) * 0.65;
      break;
    }

    case 'sliding': {
      // Slipping on tilted soapy deck! Torso leans back, arms windmill frantically
      rig.body.rotation.z = -0.45 * pose.facing;
      rig.body.rotation.x = -0.42;

      // Legs kick out forward
      rig.legL.rotation.x = -0.75;
      rig.legR.rotation.x = -0.35;

      // Arms windmilling in panic
      rig.armL.rotation.x = -time * 15;
      rig.armL.rotation.z = -0.6;
      rig.armR.rotation.x = -time * 15 + Math.PI;
      rig.armR.rotation.z = 0.6;
      break;
    }

    case 'cranking': {
      // Vigorous full-body circular ratchet cranking motion
      const crankAngle = time * 12;
      rig.body.rotation.x = 0.22 + Math.sin(crankAngle) * 0.08;
      rig.body.rotation.y = pose.facing * 0.24;

      rig.armL.rotation.x = -1.35 + Math.sin(crankAngle) * 0.5;
      rig.armL.rotation.y = 0.2 + Math.cos(crankAngle) * 0.32;
      rig.armR.rotation.x = -1.35 - Math.sin(crankAngle) * 0.5;
      rig.armR.rotation.y = -0.2 - Math.cos(crankAngle) * 0.32;

      rig.legL.rotation.x = 0.2;
      rig.legR.rotation.x = -0.2;
      break;
    }

    case 'cleaning': {
      // Wide curved wiping strokes across the window glass
      const wipe = Math.sin(time * 9) * 0.75;
      rig.body.rotation.y = 0.3 * pose.facing;
      rig.body.rotation.x = 0.12;

      rig.armR.rotation.x = -1.25 + wipe;
      rig.armR.rotation.z = -0.4 + Math.cos(time * 9) * 0.3;
      rig.armL.rotation.x = -0.55;
      rig.legL.rotation.x = 0;
      rig.legR.rotation.x = 0;
      break;
    }

    case 'shooing': {
      // Shooing pigeon: waving arms wildly overhead
      const flap = Math.sin(time * 16) * 0.6;
      rig.body.rotation.x = -0.15;
      rig.armL.rotation.x = -2.6 + flap;
      rig.armR.rotation.x = -2.6 - flap;
      rig.armL.rotation.z = -0.65;
      rig.armR.rotation.z = 0.65;
      break;
    }

    case 'standing':
    default: {
      if (pose.moving) {
        // Energetic walking stride
        const stride = time * 8.5;
        const swing = Math.sin(stride) * 0.58;
        rig.legL.rotation.x = swing;
        rig.legR.rotation.x = -swing;
        rig.armL.rotation.x = -swing * 0.65;
        rig.armR.rotation.x = swing * 0.65;
        rig.body.position.y = Math.abs(Math.sin(stride)) * 0.05;
      } else {
        // Idle breathing and balance
        rig.legL.rotation.set(0, 0, 0);
        rig.legR.rotation.set(0, 0, 0);
        rig.armL.rotation.set(0, 0, 0.08);
        rig.armR.rotation.set(0, 0, -0.08);
        rig.body.position.y = Math.sin(time * 2.2) * 0.015;
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
