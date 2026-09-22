import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, BoxGeometry, Mesh, MeshStandardMaterial, Box3 } from 'three';
import { batchScenery } from './batch-scenery';
import { disposeObject } from './dispose-object';

void test('static batches preserve transforms and animated subtrees while releasing owned buffers', () => {
  const root = new Group();
  root.position.set(4, 2, 7);
  root.rotation.y = 0.4;
  const material = new MeshStandardMaterial({ color: 'red' });
  let released = 0;
  for (let i = 0; i < 8; i++) {
    const geometry = new BoxGeometry();
    geometry.addEventListener('dispose', () => released++);
    const mesh = new Mesh(geometry, material.clone());
    mesh.position.set(i * 2, 0, 0);
    root.add(mesh);
  }
  const moving = new Group(),
    arm = new Mesh(new BoxGeometry(), material);
  arm.position.y = 5;
  moving.add(arm);
  root.add(moving);
  const before = new Box3().setFromObject(root);
  batchScenery(root, [moving], true);
  const after = new Box3().setFromObject(root);
  assert.ok(
    before.min.distanceTo(after.min) < 1e-5 &&
      before.max.distanceTo(after.max) < 1e-5,
  );
  assert.equal(root.children.length, 2);
  assert.equal(moving.children[0], arm);
  assert.equal(released, 8);
  moving.position.y = 3;
  assert.ok(new Box3().setFromObject(root).max.y > after.max.y);
  disposeObject(root);
});
