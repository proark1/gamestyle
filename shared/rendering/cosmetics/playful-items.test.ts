import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ITEMS } from '../../wardrobe/catalog';
import { parseLook } from '../../wardrobe/look';
import { playerKid } from '../avatars/kid';
import { KIT } from '../palette';
import { LOOK_GROUP } from './dress';
import { PLAYFUL_KID_ITEMS } from './playful-items';
import { buildStandaloneItem } from './standalone-item';

const collection = ITEMS.filter((item) =>
  Object.hasOwn(PLAYFUL_KID_ITEMS, item.id),
);

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
