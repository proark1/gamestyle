import * as T from 'three';
import { SLOTS, type Slot } from '../../wardrobe/catalog';
import type { Look } from '../../wardrobe/look';
import { COLORS } from '../palette';
import { ball, box, taper } from '../primitives';
import { WORKER_HEAD_TOP, worker, type WorkerOutfit } from '../worker';
import { ITEM_MODELS, PLAYER, type ItemModel, type Part } from './items';

/** Which slots a look filled, so a game can leave off its own hat or vest. */
export type Worn = Record<Slot, boolean>;

/** Item parts live in groups of this name, apart from the body's own meshes. */
export const LOOK_GROUP = 'worker-look';

/** The centre of the face on the worker's head. */
const FACE = [0, 1.43, 0.25];

/** The models a look really has, by slot. Unknown or misplaced ids are ignored. */
export function modelsOf(look?: Look) {
  const models: Partial<Record<Slot, ItemModel>> = {};
  const costume = look?.costume;
  if (costume && ITEM_MODELS[costume]?.slot === 'costume') {
    models.costume = ITEM_MODELS[costume];
    return models;
  }
  for (const slot of SLOTS) {
    const id = look?.[slot];
    if (!id || !Object.hasOwn(ITEM_MODELS, id)) continue;
    if (ITEM_MODELS[id].slot === slot) models[slot] = ITEM_MODELS[id];
  }
  return models;
}

/** The group a body part's items go in, made on first use. */
export function lookGroup(parent: T.Object3D) {
  let group = parent.children.find((child) => child.name === LOOK_GROUP);
  if (!group) {
    group = new T.Group();
    group.name = LOOK_GROUP;
    parent.add(group);
  }
  return group;
}

/** The highest point of a head part, measured from the top of the head. */
export function partTop(part: Part) {
  if (part.shape === 'box') return part.at[1] + part.size[1] / 2;
  if (part.shape === 'ball') return part.at[1] + part.size[1];
  return part.at[1] + part.height / 2;
}

/** Builds one item part in `parent`, `origin` plus its offset, mirrored by `side`. */
export function addPart(
  parent: T.Object3D,
  part: Part,
  origin: readonly number[],
  side: number,
  player: string,
) {
  const colour = part.colour === PLAYER ? player : part.colour;
  const at = [
    origin[0] + part.at[0] * side,
    origin[1] + part.at[1],
    origin[2] + part.at[2],
  ];
  const mesh =
    part.shape === 'box'
      ? box(parent, part.size, at, colour, part.rounded)
      : part.shape === 'ball'
        ? ball(parent, part.size, at, colour)
        : taper(
            parent,
            part.top,
            part.bottom,
            part.height,
            at,
            colour,
            part.sides,
          );
  if (part.turn)
    mesh.rotation.set(part.turn[0], part.turn[1] * side, part.turn[2] * side);
  const extent =
    part.shape === 'box'
      ? Math.max(...part.size)
      : part.shape === 'ball'
        ? 2 * Math.max(...part.size)
        : Math.max(2 * Math.max(part.top, part.bottom), part.height);
  // Small details add a shadow pass and nothing anyone would see.
  if (extent < 0.15) mesh.castShadow = false;
  return mesh;
}

/** Puts a look's items on a built worker, and says which slots it filled. */
export function dressWorker(
  model: T.Object3D,
  player: string,
  look?: Look,
): Worn {
  const models = modelsOf(look);
  const rig = model.userData as Record<string, T.Object3D>;
  let hatTop = 0;
  for (const item of Object.values(models))
    for (const part of item.parts) {
      if (part.on === 'legs' || part.on === 'arms') {
        const [left, right] =
          part.on === 'legs' ? [rig.legL, rig.legR] : [rig.armL, rig.armR];
        addPart(lookGroup(left), part, [0, 0, 0], -1, player);
        addPart(lookGroup(right), part, [0, 0, 0], 1, player);
        continue;
      }
      const origin =
        part.on === 'head'
          ? [0, WORKER_HEAD_TOP, 0]
          : part.on === 'face'
            ? FACE
            : [0, 0, 0];
      addPart(lookGroup(rig.body), part, origin, 1, player);
      if (part.on === 'head') hatTop = Math.max(hatTop, partTop(part));
    }
  if (models.hat || models.costume)
    model.userData.hatTop = WORKER_HEAD_TOP + hatTop;
  return Object.fromEntries(
    SLOTS.map((slot) => [
      slot,
      !!models[slot] || (!!models.costume && slot !== 'beard'),
    ]),
  ) as Worn;
}

/**
 * Puts a look's hat on a head other than the worker's. Its parts go in
 * `parent` as if its origin were the top of the worker's head; the caller
 * places and scales `parent` to fit its own head. False when there is no hat.
 */
export function wearHat(parent: T.Object3D, player: string, look?: Look) {
  const hat = modelsOf(look).hat;
  if (!hat) return false;
  for (const part of hat.parts)
    if (part.on === 'head')
      addPart(lookGroup(parent), part, [0, 0, 0], 1, player);
  return true;
}

/**
 * The shared worker in a game's outfit, wearing a player's look over it. The
 * player's items win: a hat takes the cap off, and legs and shoes recolour the
 * trousers and boots. The shirt always keeps the player colour.
 */
export function dressedWorker(
  color: number,
  outfit: WorkerOutfit = {},
  look?: Look,
) {
  const models = modelsOf(look);
  const model = worker(color, {
    ...outfit,
    shirt: models.costume?.shirt ?? outfit.shirt,
    overalls:
      models.costume?.overalls ?? models.legs?.overalls ?? outfit.overalls,
    boots: models.costume?.boots ?? models.shoes?.boots ?? outfit.boots,
    cap: models.hat || models.costume ? false : outfit.cap,
  });
  const worn = dressWorker(model, outfit.shirt ?? COLORS[color % 4], look);
  return { model, worn };
}
