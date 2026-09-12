import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { worker, WORKER_HEAD_TOP } from './worker';

function meshes(root: T.Object3D) {
  const found: T.Mesh[] = [];
  root.traverse((object) => {
    if ((object as T.Mesh).isMesh) found.push(object as T.Mesh);
  });
  return found;
}

const colour = (object: T.Object3D) =>
  `#${((object as T.Mesh).material as T.MeshStandardMaterial).color.getHexString()}`;

void test('an outfit changes the clothes and hat but never the body or its joints', () => {
  const plain = worker(2);
  const dressed = worker(2, {
    shirt: '#123456',
    overalls: '#654321',
    boots: '#222222',
    cap: false,
  });
  assert.equal(
    meshes(dressed).length,
    meshes(plain).length - 2,
    'only the cap comes off',
  );
  for (const key of ['legL', 'legR', 'armL', 'armR'])
    assert.deepEqual(
      dressed.userData[key].position.toArray(),
      plain.userData[key].position.toArray(),
      `${key} keeps its joint`,
    );
  assert.ok(dressed.userData.legs[1] === dressed.userData.legR);
  assert.ok(dressed.userData.arms[0] === dressed.userData.armL);
  const head = dressed.getObjectByName('worker-head')!;
  assert.deepEqual(
    head.position.toArray(),
    plain.getObjectByName('worker-head')!.position.toArray(),
  );
  const top = new T.Box3().setFromObject(head).max.y;
  assert.ok(Math.abs(top - WORKER_HEAD_TOP) < 1e-6, 'hats sit on the head top');
  assert.equal(colour(dressed.userData.armR.children[0]), '#123456');
  assert.equal(colour(dressed.userData.legL.children[0]), '#654321');
  assert.equal(colour(dressed.userData.legL.children[1]), '#222222');
  assert.equal(colour(plain.userData.armR.children[0]), '#d97863');
});
