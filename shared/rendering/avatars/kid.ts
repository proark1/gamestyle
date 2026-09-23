import * as T from 'three';
import type { Look } from '../../wardrobe/look';
import { batchScenery } from '../batch-scenery';
import { LOOK_GROUP, modelsOf } from '../cosmetics/dress';
import { dressKid } from '../cosmetics/fit-kid';
import { inClay, liveHoopKid } from './hoop-kid';
import { lola } from './lola';
import { nico } from './nico';

/**
 * What a game dresses a kid in: the jersey, and shorts and sneakers that match
 * it unless set. Team games use a `TEAM` colour, other games `seatKit`.
 */
export type Kit = {
  jersey: string;
  shorts?: string;
  shoes?: string;
  trousers?: boolean;
  /** Reserve space for a game-supplied hat when no wardrobe hat is worn. */
  hat?: boolean;
};

/** The clay kids from the owner's court picture. */
const KIDS = { lola, nico } as const;

export type KidId = keyof typeof KIDS;

/**
 * The kid every player is. Lola is built and dressable too, but she stays an
 * admin candidate until the owner asks for a choice of kid.
 */
export const PLAYER_KID: KidId = 'nico';

/**
 * Merges each group's own meshes that share a material into one, so a kid
 * draws in about half the calls. Moving parts keep their own groups; items
 * are flattened into their look group, since they never move on their own.
 */
function batchRig(model: T.Object3D) {
  const groups: T.Object3D[] = [];
  model.traverse((object) => {
    if ((object as T.Group).isGroup) groups.push(object);
  });
  for (const group of groups)
    batchScenery(
      group as T.Group,
      group.name === LOOK_GROUP
        ? []
        : group.children.filter((child) => !(child as T.Mesh).isMesh),
    );
}

/**
 * A player as a kid, in the game's `kit`, wearing their `look`. The kid wears
 * long trousers with a legs item and makes room under a hat; the jersey keeps
 * the kit colour, and legs and shoes items recolour the trousers and
 * sneakers. The rig is the worker's (`body`, `legL`, `legR`, `armL`, `armR`),
 * so a game's own poses work unchanged; call `liveKid` after them for the
 * blink and swinging hair.
 */
export function playerKid(kid: KidId, kit: Kit, look?: Look) {
  const models = modelsOf(look);
  const model = KIDS[kid](
    0,
    {
      shirt: models.costume?.shirt ?? kit.jersey,
      overalls: models.costume?.overalls ?? models.legs?.overalls ?? kit.shorts,
      boots: models.costume?.boots ?? models.shoes?.boots ?? kit.shoes,
    },
    {
      trousers: models.costume
        ? true
        : models.legs
          ? !models.legs.shorts
          : kit.trousers,
      hat: models.costume ? look?.costume : models.hat ? look?.hat : kit.hat,
    },
  );
  const worn = dressKid(model, kit.jersey, look);
  inClay(model);
  batchRig(model);
  model.userData.kid = kid;
  model.userData.kit = {
    jersey: kit.jersey,
    trousers:
      models.costume?.overalls ??
      models.legs?.overalls ??
      kit.shorts ??
      kit.jersey,
    shoes:
      models.costume?.boots ?? models.shoes?.boots ?? kit.shoes ?? kit.jersey,
  };
  return { model, worn };
}

/** The blink, glance and swinging hair of a kid a game poses itself. */
export const liveKid = liveHoopKid;
