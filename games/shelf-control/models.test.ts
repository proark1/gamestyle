import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { worker } from '../../shared/rendering/worker';
import { mannequin } from './models';

const meshes = (root: THREE.Object3D) => {
  const result: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) result.push(object);
  });
  return result;
};
void test('Shelf mannequins use the exact shared worker geometry, proportions and limb pivots', () => {
  const reference = worker(0),
    doll = mannequin(),
    expected = meshes(reference),
    actual = meshes(doll.group);
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    assert.deepEqual(
      actual[i].geometry.attributes.position.array,
      expected[i].geometry.attributes.position.array,
    );
    assert.deepEqual(
      actual[i].position.toArray(),
      expected[i].position.toArray(),
    );
    assert.deepEqual(actual[i].scale.toArray(), expected[i].scale.toArray());
  }
  assert.deepEqual(
    new THREE.Box3().setFromObject(doll.group),
    new THREE.Box3().setFromObject(reference),
  );
  for (const name of ['armL', 'armR', 'legL', 'legR']) {
    assert.deepEqual(
      doll.group.userData[name].position.toArray(),
      reference.userData[name].position.toArray(),
    );
  }
});
void test('Wooden disguises own their materials without recoloring the shared worker or other games', () => {
  const reference = worker(0),
    before = meshes(reference).map((m) =>
      (m.material as THREE.MeshStandardMaterial).color.getHex(),
    );
  const first = mannequin(),
    second = mannequin(),
    guard = mannequin(true);
  assert.deepEqual(
    meshes(reference).map((m) =>
      (m.material as THREE.MeshStandardMaterial).color.getHex(),
    ),
    before,
  );
  assert.notEqual(
    meshes(first.group)[0].material,
    meshes(second.group)[0].material,
  );
  assert.notEqual(
    meshes(guard.group)[0].material,
    meshes(reference)[0].material,
  );
  assert.deepEqual(
    meshes(first.group).map((m) =>
      (m.material as THREE.MeshStandardMaterial).color.getHex(),
    ),
    meshes(second.group).map((m) =>
      (m.material as THREE.MeshStandardMaterial).color.getHex(),
    ),
  );
});
