import * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { CLOTH } from '../../shared/rendering/palette';
import { box, taper } from '../../shared/rendering/primitives';
import { WORKER_HEAD_TOP } from '../../shared/rendering/worker';
import type { Look } from '../../shared/wardrobe/look';
import type { PlayerState } from './types';

/** Where the safety line clips onto the harness, in the worker's own frame. */
export const D_RING = new T.Vector3(0, 1.05, -0.27);

const HARNESS = CLOTH.hivis;
const HARD_HAT = CLOTH.gold;

type Rig = Record<'body' | 'legL' | 'legR' | 'armL' | 'armR', T.Group>;

/**
 * A demolition worker on the shared rig: hi-vis harness with a back D-ring for
 * the line, and a hard hat unless the player's own look already has a hat.
 */
export function chainWorker(color: number, look?: Look) {
  const { model, worn } = dressedWorker(
    color,
    { overalls: CLOTH.slate, boots: CLOTH.charcoal, cap: false },
    look,
  );
  const body = model.userData.body as T.Group;

  if (!worn.hat) {
    box(body, [0.62, 0.2, 0.6], [0, WORKER_HEAD_TOP + 0.08, 0], HARD_HAT, true);
    box(body, [0.72, 0.05, 0.72], [0, WORKER_HEAD_TOP - 0.02, 0.03], HARD_HAT);
    box(body, [0.1, 0.1, 0.62], [0, WORKER_HEAD_TOP + 0.2, 0], CLOTH.sand);
  }

  // Harness webbing, front and back, and the steel ring the line clips to.
  box(body, [0.08, 0.5, 0.05], [-0.17, 1.02, 0.235], HARNESS);
  box(body, [0.08, 0.5, 0.05], [0.17, 1.02, 0.235], HARNESS);
  box(body, [0.5, 0.07, 0.05], [0, 0.82, 0.24], HARNESS);
  box(body, [0.08, 0.5, 0.05], [-0.17, 1.02, -0.235], HARNESS);
  box(body, [0.08, 0.5, 0.05], [0.17, 1.02, -0.235], HARNESS);
  box(body, [0.46, 0.07, 0.05], [0, D_RING.y, -0.24], HARNESS);
  const ring = taper(
    body,
    0.09,
    0.09,
    0.04,
    [0, D_RING.y, -0.28],
    CLOTH.silver,
    10,
  );
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;

  // Hi-vis stripes on the sleeves. They are clothing, so they sit in their own
  // group and leave the arm's body parts exactly as the shared worker has them.
  for (const arm of [model.userData.armL, model.userData.armR] as T.Group[]) {
    const sleeve = new T.Group();
    sleeve.name = 'chain-sleeve';
    arm.add(sleeve);
    box(sleeve, [0.23, 0.06, 0.29], [0, -0.2, 0], CLOTH.cream).castShadow =
      false;
  }

  return model;
}

export type ChainPose = {
  state: PlayerState;
  moving: boolean;
  braced: boolean;
  helping: boolean;
  climbing: boolean;
  seed: number;
};

/** One pose per stance, driven by the same state the simulation uses. */
export function poseChainWorker(
  model: T.Object3D,
  time: number,
  pose: ChainPose,
) {
  const rig = model.userData as Rig;
  if (!rig?.body) return;
  const t = time + pose.seed * 1.7;

  rig.body.rotation.set(0, 0, 0);
  rig.body.position.set(0, 0, 0);
  for (const limb of [rig.legL, rig.legR, rig.armL, rig.armR])
    limb.rotation.set(0, 0, 0);

  if (pose.state === 'limp') {
    // Flat on their back, arms out: dead weight on the line.
    rig.body.rotation.x = -Math.PI / 2;
    rig.body.position.set(0, 0.3, -0.7);
    rig.armL.rotation.z = -1.1;
    rig.armR.rotation.z = 1.1;
    rig.legL.rotation.z = -0.2;
    rig.legR.rotation.z = 0.2;
    return;
  }

  if (pose.state === 'dangling') {
    // Hanging off the back D-ring: folded forward, legs cycling, arms reaching.
    const kick = Math.sin(t * 10);
    rig.body.rotation.x = 0.55 + Math.sin(t * 2.6) * 0.08;
    rig.body.rotation.z = Math.sin(t * 1.9) * 0.14;
    rig.legL.rotation.x = 0.35 + kick * 0.7;
    rig.legR.rotation.x = 0.35 - kick * 0.7;
    rig.armL.rotation.x = -2.6 + Math.sin(t * 7) * 0.25;
    rig.armR.rotation.x = -2.6 - Math.sin(t * 7) * 0.25;
    rig.armL.rotation.z = -0.3;
    rig.armR.rotation.z = 0.3;
    return;
  }

  if (pose.climbing) {
    const reach = Math.sin(t * 7);
    rig.body.rotation.x = 0.12;
    rig.armL.rotation.x = -2.3 + reach * 0.5;
    rig.armR.rotation.x = -2.3 - reach * 0.5;
    rig.legL.rotation.x = -0.5 + reach * 0.4;
    rig.legR.rotation.x = -0.5 - reach * 0.4;
    return;
  }

  if (pose.state === 'finished') {
    // Clocked in: both arms up.
    const wave = Math.sin(t * 8) * 0.3;
    rig.armL.rotation.x = -2.9 + wave;
    rig.armR.rotation.x = -2.9 - wave;
    rig.armL.rotation.z = -0.35;
    rig.armR.rotation.z = 0.35;
    rig.body.position.y = Math.abs(Math.sin(t * 4)) * 0.12;
    return;
  }

  if (pose.state === 'airborne') {
    rig.armL.rotation.x = -2.2;
    rig.armR.rotation.x = -1.6;
    rig.armL.rotation.z = -0.5;
    rig.armR.rotation.z = 0.5;
    rig.legL.rotation.x = -0.7;
    rig.legR.rotation.x = 0.35;
    return;
  }

  if (pose.helping) {
    // Hand over hand on the line, leaning back into it.
    const pull = Math.sin(t * 9);
    rig.body.rotation.x = -0.3;
    rig.body.position.y = -0.12;
    rig.armL.rotation.x = -1.3 + pull * 0.55;
    rig.armR.rotation.x = -1.3 - pull * 0.55;
    rig.legL.rotation.x = -0.55;
    rig.legR.rotation.x = 0.4;
    return;
  }

  if (pose.braced) {
    // Boots planted wide, crouched, both hands on the line.
    rig.body.rotation.x = -0.38;
    rig.body.position.y = -0.2 + Math.sin(t * 20) * 0.012;
    rig.armL.rotation.x = -1.15;
    rig.armR.rotation.x = -1.15;
    rig.legL.rotation.set(-0.7, 0, -0.28);
    rig.legR.rotation.set(0.45, 0, 0.28);
    return;
  }

  if (pose.moving) {
    const stride = t * 9;
    const swing = Math.sin(stride) * 0.6;
    rig.legL.rotation.x = swing;
    rig.legR.rotation.x = -swing;
    rig.armL.rotation.x = -swing * 0.7;
    rig.armR.rotation.x = swing * 0.7;
    rig.body.position.y = Math.abs(Math.sin(stride)) * 0.05;
    return;
  }

  rig.armL.rotation.z = 0.08;
  rig.armR.rotation.z = -0.08;
  rig.body.position.y = Math.sin(t * 2.2) * 0.015;
}

export const chainOfFoolsAvatars: readonly AvatarLook[] = [
  {
    key: 'chain-worker',
    label: 'Demolition worker',
    dressable: true,
    create(look) {
      const root = chainWorker(0, look);
      return {
        root,
        pose: (time, walking) =>
          poseChainWorker(root, time, {
            state: 'standing',
            moving: walking,
            braced: false,
            helping: false,
            climbing: false,
            seed: 0,
          }),
      };
    },
  },
];
