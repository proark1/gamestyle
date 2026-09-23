import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ITEMS } from '../../wardrobe/catalog';
import { parseLook } from '../../wardrobe/look';
import { playerKid } from '../avatars/kid';
import { KIT } from '../palette';
import { dressedWorker, LOOK_GROUP } from './dress';
import { PLAYFUL_KID_ITEMS } from './playful-items';
import { ITEM_MODELS } from './items';
import { buildStandaloneItem } from './standalone-item';

const collection = ITEMS.filter(
  (item) =>
    Object.hasOwn(PLAYFUL_KID_ITEMS, item.id) && item.price !== undefined,
);

void test('the ten new pieces have matching kid, worker, and inspection models', () => {
  const ids = [
    'ramen-nest',
    'mini-volcano',
    'sharkfin-zip-up',
    'arcade-bomber',
    'balloon-twist-pants',
    'lava-flow-joggers',
    'banana-peel-slides',
    'wind-up-stompers',
    'side-eye-specs',
    'bubble-beard',
  ];
  for (const id of ids) {
    const item = ITEMS.find((candidate) => candidate.id === id);
    assert.ok(item, `${id} is in the catalog`);
    assert.equal(ITEM_MODELS[id]?.slot, item.slot);
    assert.ok(PLAYFUL_KID_ITEMS[id], `${id} has a clay model`);
    const inspected = buildStandaloneItem(id);
    assert.ok(
      !new T.Box3().setFromObject(inspected).isEmpty(),
      `${id} can be inspected`,
    );
    const { model } = playerKid(
      'nico',
      { jersey: KIT.red },
      { [item.slot]: id },
    );
    assert.ok(
      !new T.Box3().setFromObject(model).isEmpty(),
      `${id} fits the kid`,
    );
    const worker = dressedWorker(0, {}, { [item.slot]: id }).model;
    assert.ok(
      !new T.Box3().setFromObject(worker).isEmpty(),
      `${id} fits the worker`,
    );
    let attached = false;
    worker.traverse((object) => {
      if (object.name === LOOK_GROUP && object.children.length) attached = true;
    });
    assert.ok(attached, `${id} attaches visible worker geometry`);
  }
});

void test('new items can be purchased, equipped and restored without changing other slots', async () => {
  const {
    adminResetWardrobe,
    adminAddCoins,
    wardrobeSnapshot,
    buyItem,
    equipItem,
    storedLook,
  } = await import('../../wardrobe/wardrobe-state');
  adminResetWardrobe();
  adminAddCoins(5000);
  let expected = wardrobeSnapshot().coins;
  for (const item of collection) {
    const before = { ...wardrobeSnapshot().look };
    equipItem(item.slot, item.id);
    assert.deepEqual(
      wardrobeSnapshot().look,
      before,
      'locked items cannot be equipped',
    );
    assert.equal(buyItem(item.id), true);
    expected -= item.price!;
    assert.equal(wardrobeSnapshot().coins, expected);
    assert.equal(buyItem(item.id), true);
    assert.equal(
      wardrobeSnapshot().coins,
      expected,
      'buying twice never charges twice',
    );
    equipItem(item.slot, item.id);
    assert.deepEqual(wardrobeSnapshot().look, {
      ...before,
      [item.slot]: item.id,
    });
    assert.deepEqual(
      storedLook(JSON.parse(JSON.stringify(wardrobeSnapshot().look))),
      wardrobeSnapshot().look,
    );
  }
  assert.deepEqual(parseLook(wardrobeSnapshot().look), wardrobeSnapshot().look);
  adminResetWardrobe();
});

void test('watermelon shorts leave the knees bare even over a long-trouser game kit', () => {
  const { model } = playerKid(
    'nico',
    { jersey: KIT.red, trousers: true },
    { legs: 'watermelon-shorts' },
  );
  model.updateMatrixWorld(true);
  for (const leg of [
    model.userData.legL,
    model.userData.legR,
  ] as T.Object3D[]) {
    const position = leg.getWorldPosition(new T.Vector3());
    const ray = new T.Raycaster(
      new T.Vector3(position.x, 0.29, 1),
      new T.Vector3(0, 0, -1),
    );
    const hit = ray.intersectObject(leg, true)[0];
    assert.ok(hit);
    assert.equal(
      (
        hit.object as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>
      ).material.color.getHexString(),
      'de9268',
      'skin is visible below shorts',
    );
  }
});

void test('native hats report their actual top and item-only models stay centered', () => {
  for (const item of collection) {
    const display = buildStandaloneItem(item.id);
    const bounds = new T.Box3().setFromObject(display);
    assert.ok(!bounds.isEmpty(), item.id);
    assert.ok(
      bounds.getCenter(new T.Vector3()).length() < 1e-6,
      `${item.id} is centered for inspection`,
    );
    if (item.slot !== 'hat') continue;
    const { model } = playerKid('nico', { jersey: KIT.red }, { hat: item.id });
    model.updateMatrixWorld(true);
    const head = model.userData.head as T.Object3D;
    const actual = new T.Box3().setFromObject(head.getObjectByName(LOOK_GROUP)!)
      .max.y;
    assert.ok(
      Math.abs(actual - model.userData.hatTop) < 0.001,
      `${item.id} has correct camera framing`,
    );
  }
});

void test('moon glasses retain transparent lenses after clay shading and batching', () => {
  const { model } = playerKid(
    'nico',
    { jersey: KIT.blue },
    {
      face: 'moon-glasses',
      hat: 'saturn-hat',
      top: 'cloud-jacket',
      shoes: 'comet-sneakers',
      legs: 'leaf-dungarees',
    },
  );
  const lenses: T.Mesh[] = [];
  let count = 0;
  model.traverse((object) => {
    const mesh = object as T.Mesh<T.BufferGeometry, T.Material>;
    if (!mesh.isMesh) return;
    count++;
    if (mesh.material.transparent) lenses.push(mesh);
  });
  assert.ok(lenses.length > 0, 'eyes remain visible behind the lenses');
  assert.ok(count <= 80, `combined outfit batches into ${count} meshes`);
});
