import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ITEMS, SLOTS, type Slot } from '../../wardrobe/catalog';
import type { Look } from '../../wardrobe/look';
import { COLORS } from '../palette';
import { WORKER_HEAD_TOP, worker } from '../worker';
import { LOOK_GROUP, dressedWorker } from './dress';
import { ITEM_MODELS, PLAYER, type Part } from './items';

function meshes(root: T.Object3D) {
  const found: T.Mesh[] = [];
  root.traverse((object) => {
    if ((object as T.Mesh).isMesh) found.push(object as T.Mesh);
  });
  return found;
}

function inLook(object: T.Object3D) {
  for (let node: T.Object3D | null = object; node; node = node.parent)
    if (node.name === LOOK_GROUP) return true;
  return false;
}

const colour = (mesh: T.Mesh) =>
  `#${(mesh.material as T.MeshStandardMaterial).color.getHexString()}`;

/** Where a body mesh sits and how big it is, in its part of the rig. */
function signature(model: T.Object3D, mesh: T.Mesh) {
  const rig = model.userData as Record<string, T.Object3D>;
  const part =
    ['body', 'legL', 'legR', 'armL', 'armR'].find(
      (key) => rig[key] === mesh.parent,
    ) ?? 'other';
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox!.getSize(new T.Vector3());
  const round = (values: number[]) => values.map((v) => v.toFixed(4)).join(',');
  return `${part}:${round(mesh.position.toArray())}:${round(size.toArray())}`;
}

const lookOf = (id: string): Look => ({ [ITEM_MODELS[id].slot]: id });

/** A full look with the first item of every slot. */
const fullLook = Object.fromEntries(
  SLOTS.map((slot) => [slot, ITEMS.find((item) => item.slot === slot)!.id]),
) as Look;

function lab(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const distance = (a: string, b: string) => {
  const [first, second] = [lab(a), lab(b)];
  return Math.hypot(...first.map((value, i) => value - second[i]));
};

void test('every catalog item has a model in its own slot, and every model is for sale', () => {
  assert.deepEqual(
    Object.keys(ITEM_MODELS).sort(),
    ITEMS.map((item) => item.id).sort(),
  );
  for (const item of ITEMS)
    assert.equal(ITEM_MODELS[item.id].slot, item.slot, item.id);
});

void test('items never move the body or its joints; their parts stay in look groups', () => {
  const plain = worker(0);
  const bodyMeshes = new Set(meshes(plain).map((m) => signature(plain, m)));
  for (const look of [...ITEMS.map((item) => lookOf(item.id)), fullLook]) {
    const { model } = dressedWorker(0, {}, look);
    const name = JSON.stringify(look);
    for (const mesh of meshes(model).filter((m) => !inLook(m)))
      assert.ok(
        bodyMeshes.has(signature(model, mesh)),
        `${name} keeps every body part where it was`,
      );
    for (const key of ['legL', 'legR', 'armL', 'armR'])
      assert.deepEqual(
        model.userData[key].position.toArray(),
        plain.userData[key].position.toArray(),
        `${name} keeps the ${key} joint`,
      );
    assert.ok(meshes(model).some(inLook), `${name} adds something to wear`);
  }
});

void test('a hat takes the cap off and stays within half a metre above the head', () => {
  const bare = meshes(worker(0, { cap: false })).length;
  for (const item of ITEMS.filter((entry) => entry.slot === 'hat')) {
    const { model, worn } = dressedWorker(0, {}, { hat: item.id });
    assert.ok(worn.hat, item.id);
    assert.equal(
      meshes(model).filter((m) => !inLook(m)).length,
      bare,
      `${item.id} removes the cap`,
    );
    model.updateMatrixWorld(true);
    let top = -Infinity;
    for (const mesh of meshes(model).filter(inLook))
      top = Math.max(top, new T.Box3().setFromObject(mesh).max.y);
    assert.ok(top <= WORKER_HEAD_TOP + 0.5 + 1e-6, `${item.id} reaches ${top}`);
    assert.ok(
      model.userData.hatTop >= top - 0.02 &&
        model.userData.hatTop <= WORKER_HEAD_TOP + 0.5,
      `${item.id} reports its height`,
    );
  }
});

void test('tops keep the shirt in the player colour and let it show', () => {
  const area = (part: Part) =>
    part.shape === 'box'
      ? part.size[0] * part.size[1]
      : part.shape === 'ball'
        ? 4 * part.size[0] * part.size[1]
        : 2 * Math.max(part.top, part.bottom) * part.height;
  const shirtFront = 0.67 * 0.66;
  for (const item of ITEMS.filter((entry) => entry.slot === 'top')) {
    const covered = ITEM_MODELS[item.id].parts
      .filter((part) => part.colour !== PLAYER && part.on !== 'arms')
      .reduce((sum, part) => sum + area(part), 0);
    assert.ok(covered < shirtFront / 2, `${item.id} covers ${covered}`);
    const { model } = dressedWorker(2, {}, { top: item.id });
    assert.equal(
      colour(model.userData.armR.children[0] as T.Mesh),
      COLORS[2],
      `${item.id} leaves the sleeves in the player colour`,
    );
  }
});

void test('legs, shoes and face items stay easy to tell from every player colour', () => {
  for (const item of ITEMS.filter((entry) =>
    (['legs', 'shoes', 'face'] as Slot[]).includes(entry.slot),
  )) {
    const model = ITEM_MODELS[item.id];
    const colours = [
      model.overalls,
      model.boots,
      ...model.parts.map((part) => part.colour),
    ].filter((value): value is string => !!value && value !== PLAYER);
    for (const itemColour of colours)
      for (const player of COLORS)
        assert.ok(
          distance(itemColour, player) >= 20,
          `${item.id} ${itemColour} is too close to ${player}`,
        );
  }
});

void test('legs and shoes recolour the trousers and boots, never the shirt', () => {
  const { model } = dressedWorker(
    1,
    {},
    {
      legs: 'denim-overalls',
      shoes: 'rain-boots',
    },
  );
  const leg = model.userData.legL.children as T.Mesh[];
  assert.equal(colour(leg[0]), ITEM_MODELS['denim-overalls'].overalls);
  assert.equal(colour(leg[1]), ITEM_MODELS['rain-boots'].boots);
  assert.equal(colour(model.userData.armL.children[0] as T.Mesh), COLORS[1]);
});

void test('an unknown or misplaced item builds the plain worker', () => {
  const plain = worker(3);
  const { model, worn } = dressedWorker(3, {}, {
    hat: 'retired-item',
    top: 'top-hat',
  } as Look);
  assert.deepEqual(Object.values(worn), [false, false, false, false, false]);
  assert.deepEqual(meshes(model).map(colour), meshes(plain).map(colour));
  assert.equal(meshes(model).filter(inLook).length, 0);
});

void test('item parts share cached geometry, and no item adds more than four meshes', () => {
  const bare = meshes(worker(0, { cap: false })).length;
  for (const item of ITEMS) {
    const { model } = dressedWorker(0, { cap: false }, lookOf(item.id));
    const added = meshes(model).filter(inLook);
    assert.ok(added.length <= 4, `${item.id} adds ${added.length} meshes`);
    for (const mesh of added)
      assert.ok(mesh.geometry.userData.shared, `${item.id} shares geometry`);
    assert.equal(meshes(model).length - added.length, bare, item.id);
  }
});
