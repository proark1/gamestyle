import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { makePiece, disposePiece } from './objects';
import { fadeStorey, onOtherStorey, OTHER_STOREY_OPACITY } from './storey-view';
import type { Piece } from './model';

const part = (level: number, extra: Partial<Piece> = {}): Piece => ({
  id: `wall-${level}`,
  kind: 'wall',
  x: 0,
  z: 0,
  level,
  placed: true,
  rotation: 0,
  ...extra,
});
const materials = (group: T.Group) => {
  const result: T.Material[] = [];
  group.traverse((o) => {
    if (o instanceof T.Mesh)
      result.push(...(Array.isArray(o.material) ? o.material : [o.material]));
  });
  return result;
};

void test('selecting each of three storeys keeps every storey visible and only that storey opaque', () => {
  const groups = [0, 1, 2].map(() => makePiece('wall'));
  const untouched = makePiece('wall');
  try {
    for (const selected of [0, 1, 2, 1, 0, null]) {
      groups.forEach((group, level) => {
        const faded = onOtherStorey(part(level), selected);
        fadeStorey(group, faded);
        assert.equal(group.visible, true);
        for (const material of materials(group)) {
          assert.equal(material.opacity, faded ? OTHER_STOREY_OPACITY : 1);
          assert.equal(material.transparent, faded);
          assert.equal(material.depthWrite, !faded);
        }
      });
      assert.ok(
        materials(untouched).every((m) => m.opacity === 1 && !m.transparent),
      );
    }
  } finally {
    [...groups, untouched].forEach((group) => disposePiece(group));
  }
});

void test('fading restores glass, shadows and material arrays and reuses owned variants', () => {
  const group = new T.Group();
  const solid = new T.MeshStandardMaterial();
  const glass = new T.MeshStandardMaterial({
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const mesh = new T.Mesh(new T.BoxGeometry(), [solid, glass]);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  fadeStorey(group, true);
  const faded = mesh.material;
  assert.notEqual(faded[0], solid);
  assert.notEqual(faded[1], glass);
  assert.equal(faded[1].opacity, 0.55 * OTHER_STOREY_OPACITY);
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.receiveShadow, false);
  fadeStorey(group, true);
  assert.equal(mesh.material, faded);
  fadeStorey(group, false);
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, true);
  assert.equal(faded[1].opacity, 0.55);
  assert.equal(faded[1].transparent, true);
  assert.equal(faded[1].depthWrite, false);
  fadeStorey(group, true);
  assert.equal(mesh.material, faded);
  let disposed = 0;
  faded.forEach((m) => m.addEventListener('dispose', () => disposed++));
  disposePiece(group);
  assert.equal(disposed, 2);
  assert.equal(solid.opacity, 1);
  assert.equal(glass.opacity, 0.55);
  solid.dispose();
  glass.dispose();
});

void test('supplies, carried pieces, crane loads and loose objects stay usable', () => {
  for (const state of [
    { placed: false },
    { heldBy: 'p' },
    { hoisted: true },
    { supply: true },
  ]) {
    assert.equal(onOtherStorey(part(2, state), 0), false);
  }
  assert.equal(onOtherStorey(part(2), null), false);
  assert.equal(onOtherStorey(part(2), 0), true);
});
