import * as T from 'three';
import type { Look } from '../wardrobe/look';
import { PLAYER_KID, playerKid } from './avatars/kid';
import { HEAD_Y, SKULL } from './avatars/hoop-kid';
import { nicoHatSeat } from './avatars/hat-fit';
import { COLORS } from './palette';
import type { WorkerOutfit } from './worker';

/** Native rig coordinates: props are attached before the game scales the root. */
export const GAME_HEAD_TOP = HEAD_Y + nicoHatSeat(true);
export const GAME_HAND_Y = -0.39;
export const GAME_BODY_HEIGHT = 1.68;
const NICO_BODY_HEIGHT = HEAD_Y + SKULL.centre[1] + SKULL.radii[1];

/**
 * Every human game character uses Nico. A separate outer root preserves game
 * scaling (tiny thieves, seated riders and Zorb interiors) and feet-at-zero
 * physics while the inner rig has a consistent bare-head height of 1.68.
 * Hair and wardrobe hats never alter the scale or the collision body.
 */
export function dressedGameAvatar(
  color: number,
  outfit: WorkerOutfit & { trousers?: boolean } = {},
  look?: Look,
) {
  const { model: kid, worn } = playerKid(
    PLAYER_KID,
    {
      jersey:
        outfit.shirt ??
        COLORS[((color % COLORS.length) + COLORS.length) % COLORS.length],
      shorts: outfit.overalls,
      shoes: outfit.boots,
      trousers: outfit.trousers ?? true,
      hat: outfit.cap === false,
    },
    look,
  );
  const model = new T.Group();
  kid.scale.setScalar(GAME_BODY_HEIGHT / NICO_BODY_HEIGHT);
  model.add(kid);
  Object.assign(model.userData, kid.userData);
  model.userData.avatarHeight = GAME_BODY_HEIGHT;
  model.userData.avatarRig = kid;
  if (typeof kid.userData.hatTop === 'number')
    model.userData.hatTop = kid.userData.hatTop * kid.scale.y;
  // Keep the established prop lookup, even after the kid's meshes are batched.
  for (const side of ['L', 'R']) {
    const grip = new T.Object3D();
    grip.name = 'worker-hand';
    grip.position.set(0, GAME_HAND_Y, 0.01);
    kid.userData[`sleeve${side}`].add(grip);
  }
  return { model, worn };
}

export function gameAvatar(color = 0, outfit: WorkerOutfit = {}) {
  return dressedGameAvatar(color, outfit).model;
}
