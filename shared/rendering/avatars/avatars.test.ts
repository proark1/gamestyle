import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { worker } from '../worker';
import { bumble, walkBumble } from './bumble';
import { hollow, walkHollow } from './hollow';
import { mochi, walkMochi } from './mochi';

const AVATARS = [
  { name: 'Bumble', build: bumble, walk: walkBumble },
  { name: 'Mochi', build: mochi, walk: walkMochi },
  { name: 'Hollow', build: hollow, walk: walkHollow },
];

function lowestPoint(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const bounds = new T.Box3();
  const part = new T.Box3();
  root.traverseVisible((object) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    bounds.union(
      part.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld),
    );
  });
  return bounds.min.y;
}

function colours(root: T.Object3D) {
  const hexes: number[] = [];
  root.traverse((object) => {
    const mesh = object as T.Mesh;
    if (mesh.isMesh)
      hexes.push((mesh.material as T.MeshBasicMaterial).color.getHex());
  });
  return hexes;
}

void test('each potential avatar keeps the shared worker rig, stands on the floor and faces forward', () => {
  for (const { name, build } of AVATARS) {
    const model = build(0);
    const rig = model.userData as Record<string, T.Object3D>;
    for (const key of ['body', 'legL', 'legR', 'armL', 'armR'])
      assert.ok(rig[key] instanceof T.Object3D, `${name} has ${key}`);
    for (const key of ['legL', 'legR', 'armL', 'armR']) {
      let parent = rig[key].parent;
      while (parent && parent !== rig.body) parent = parent.parent;
      assert.equal(parent, rig.body, `${name}'s ${key} moves with its body`);
    }
    const { legs, arms } = model.userData as Record<string, T.Object3D[]>;
    assert.ok(legs[0] === rig.legL && legs[1] === rig.legR, `${name} legs`);
    assert.ok(arms[0] === rig.armL && arms[1] === rig.armR, `${name} arms`);
    assert.ok(
      rig.legL.position.x < 0 && rig.legR.position.x > 0,
      `${name} puts legL on the same side as the worker does`,
    );
    assert.ok(Math.abs(lowestPoint(model)) < 0.01, `${name} stands on 0`);
    for (const eye of model.userData.eyes as T.Object3D[])
      assert.ok(
        eye.getWorldPosition(new T.Vector3()).z > 0.1,
        `${name} looks towards +Z`,
      );
  }
});

void test('each potential avatar walks with its legs in turn and each arm against its leg', () => {
  for (const { name, build, walk } of AVATARS) {
    const model = build(0);
    const { legL, legR, armL } = model.userData as Record<string, T.Object3D>;
    walk(model, 0.3, true);
    assert.ok(legL.rotation.x * legR.rotation.x < 0, `${name} steps in turn`);
    assert.ok(legL.rotation.x * armL.rotation.x < 0, `${name} swings its arms`);
    walk(model, 0.3, false);
    assert.ok(
      legL.rotation.x === 0 && legR.rotation.x === 0,
      `${name} stands with straight legs`,
    );
    assert.ok(Math.abs(lowestPoint(model)) < 0.01, `${name} lands on 0`);
  }
});

void test('each potential avatar wears the player colour without repainting shared materials', () => {
  const workerColours = colours(worker(0));
  for (const { name, build } of AVATARS)
    assert.notDeepEqual(
      colours(build(0)),
      colours(build(1)),
      `${name} changes with the player colour`,
    );
  assert.deepEqual(colours(worker(0)), workerColours);
});
