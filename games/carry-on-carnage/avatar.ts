import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { CLOTH } from '../../shared/rendering/palette';
import { poseWorker } from '../../shared/rendering/worker-pose';
import type { Look } from '../../shared/wardrobe/look';

/**
 * A traveller: the worker in the player's shirt, jeans and walking boots. Tin
 * foil turns the shirt silver.
 */
export function traveler(color: number, look?: Look, tinFoil = false) {
  return dressedWorker(
    color,
    {
      shirt: tinFoil ? CLOTH.silver : undefined,
      overalls: CLOTH.denim,
      boots: CLOTH.brown,
    },
    look,
  ).model;
}

export function poseTraveler(
  model: T.Object3D,
  time: number,
  walking: boolean,
) {
  if (walking) {
    poseWorker(model, time, 'walk');
  } else {
    // Scurrying anxious traveler idle: slight foot-tapping fidget
    poseWorker(model, time, 'still');
    const rig = model.userData as {
      armL?: T.Group;
      armR?: T.Group;
    };
    if (rig.armL && rig.armR) {
      const fidget = Math.sin(time * 6) * 0.08;
      rig.armL.rotation.set(-0.3 + fidget, 0, 0.15);
      rig.armR.rotation.set(-0.3 - fidget, 0, -0.15);
    }
  }
}

export const carryOnCarnageAvatars: readonly AvatarLook[] = [
  {
    key: 'traveler',
    label: 'Desperate Traveler',
    dressable: true,
    create(look) {
      const root = traveler(0, look);
      return {
        root,
        pose: (time, walking) => poseTraveler(root, time, walking),
      };
    },
  },
];
