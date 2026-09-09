import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { InstancedProxy } from './instanced-proxy';

// Pooling across copies depends on the copies sharing buffers, which is what
// the geometry and material caches in ./primitives already give every game.
const geometry = new T.BoxGeometry(1, 1, 1);
const material = new T.MeshBasicMaterial();

/** Two boxes sharing one geometry and material, plus a hideable extra. */
function model(x: number) {
  const group = new T.Group();
  group.add(new T.Mesh(geometry, material));
  const limb = new T.Group();
  limb.add(new T.Mesh(geometry, material));
  group.add(limb);
  const extra = new T.Group();
  extra.visible = false;
  extra.add(new T.Mesh(geometry, material));
  group.add(extra);
  group.userData.extra = extra;
  group.position.x = x;
  return group;
}

function drawCalls(root: T.Object3D) {
  let n = 0;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    for (let p: T.Object3D | null = o; p; p = p.parent) if (!p.visible) return;
    n += o instanceof T.InstancedMesh ? 1 : 1;
  });
  return n;
}

void test('a herd of identical models collapses to one draw call per bucket', () => {
  const scene = new T.Scene();
  const groups = Array.from({ length: 18 }, (_, i) => model(i));
  for (const g of groups) scene.add(g);
  // The third mesh of each model sits under a hidden group, so it never drew.
  assert.equal(drawCalls(scene), 18 * 2, '36 visible meshes before');
  new InstancedProxy(scene).adopt(groups);
  assert.equal(drawCalls(scene), 1, 'one geometry+material bucket after');
});

void test('each instance mirrors its source world matrix', () => {
  const scene = new T.Scene();
  const groups = [model(0), model(5)];
  for (const g of groups) scene.add(g);
  const proxy = new InstancedProxy(scene);
  proxy.adopt(groups);
  groups[1].position.x = 9;
  scene.updateMatrixWorld(true);
  proxy.update();
  const instance = scene.children.find(
    (c): c is T.InstancedMesh => c instanceof T.InstancedMesh,
  )!;
  const seen = new Set<number>();
  const m = new T.Matrix4();
  for (let i = 0; i < instance.count; i++) {
    instance.getMatrixAt(i, m);
    const scale = new T.Vector3().setFromMatrixScale(m);
    if (scale.x > 0) seen.add(Math.round(m.elements[12]));
  }
  assert.ok(seen.has(9), 'the moved model is drawn at its new position');
  assert.ok(seen.has(0), 'the other model is unmoved');
});

void test('a hidden group collapses its instances instead of drawing them', () => {
  const scene = new T.Scene();
  const group = model(0);
  scene.add(group);
  const proxy = new InstancedProxy(scene);
  proxy.adopt([group]);
  const instance = scene.children.find(
    (c): c is T.InstancedMesh => c instanceof T.InstancedMesh,
  )!;
  const zeroed = () => {
    let n = 0;
    const m = new T.Matrix4();
    for (let i = 0; i < instance.count; i++) {
      instance.getMatrixAt(i, m);
      if (new T.Vector3().setFromMatrixScale(m).x === 0) n++;
    }
    return n;
  };
  assert.equal(zeroed(), 1, 'the hidden extra starts collapsed');
  (group.userData.extra as T.Group).visible = true;
  scene.updateMatrixWorld(true);
  proxy.update();
  assert.equal(zeroed(), 0, 'revealing the group draws it again');
});

void test('picking still reaches the source model', () => {
  const scene = new T.Scene();
  const group = model(0);
  group.userData.id = 'cow-7';
  scene.add(group);
  new InstancedProxy(scene).adopt([group]);
  scene.updateMatrixWorld(true);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const ray = new T.Raycaster();
  ray.setFromCamera(new T.Vector2(0, 0), camera);
  const hits = ray.intersectObjects([group], true);
  assert.ok(hits.length > 0, 'the hidden source is still raycastable');
  let node: T.Object3D | null = hits[0].object;
  while (node && !node.userData.id) node = node.parent;
  assert.equal(node?.userData.id, 'cow-7');
});

void test('disposing hands rendering back to the source meshes', () => {
  const scene = new T.Scene();
  const group = model(0);
  scene.add(group);
  const proxy = new InstancedProxy(scene);
  proxy.adopt([group]);
  proxy.dispose();
  assert.equal(
    scene.children.filter((c) => c instanceof T.InstancedMesh).length,
    0,
  );
  assert.equal(drawCalls(scene), 2, 'the two visible meshes render again');
});
