import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { craneRig, junk } from './objects';
import { CRANE, SCENERY } from './geometry';
import { ITEMS } from './types';

void test('crate wrapping bands are visibly raised above wood on all wrapped faces, including tilted crates', () => {
  const crate = junk('crate');
  const { h, d } = ITEMS.crate;
  for (const rotation of [new T.Euler(), new T.Euler(0.3, 1.1, -0.4)]) {
    crate.rotation.copy(rotation);
    crate.updateMatrixWorld(true);
    for (const x of [-0.55, 0.55]) {
      for (const [point, normal] of [
        [new T.Vector3(x, h, 0), new T.Vector3(0, 1, 0)],
        [new T.Vector3(x, 0, 0), new T.Vector3(0, -1, 0)],
        [new T.Vector3(x, h / 2, d / 2), new T.Vector3(0, 0, 1)],
        [new T.Vector3(x, h / 2, -d / 2), new T.Vector3(0, 0, -1)],
      ]) {
        const origin = crate.localToWorld(point.clone().add(normal));
        const direction = normal
          .clone()
          .negate()
          .transformDirection(crate.matrixWorld);
        const hits = new T.Raycaster(origin, direction).intersectObject(crate);
        const band = hits[0].object as T.Mesh<
          T.BufferGeometry,
          T.MeshStandardMaterial
        >;
        assert.equal(band.material.color.getHexString(), 'd3b07b');
        const wood = hits.find((hit) => hit.object.userData.surface);
        assert.ok(wood);
        assert.ok(
          wood.distance - hits[0].distance > 0.015,
          'bands must not share the wood depth',
        );
      }
    }
  }
  crate.traverse((object) => {
    if (object instanceof T.Mesh) object.geometry.dispose();
  });
});

void test('every rescue cable ends on a real attachment from the crane boom to the deck', () => {
  const rig = craneRig();
  for (const s of SCENERY) {
    const mesh = new T.Mesh(new T.BoxGeometry(...s.size));
    mesh.position.set(...s.pos);
    mesh.rotation.y = s.rotationY || 0;
    mesh.name = s.id || '';
    rig.add(mesh);
  }
  rig.updateMatrixWorld(true);
  const meshes = rig.children as T.Mesh<T.BoxGeometry>[];
  const cables = meshes.filter((mesh) => mesh.name === 'rescue-cable');
  assert.equal(cables.length, 9);
  const contains = (mesh: T.Mesh, point: T.Vector3) => {
    mesh.geometry.computeBoundingBox();
    return mesh.geometry
      .boundingBox!.clone()
      .expandByScalar(0.005)
      .containsPoint(mesh.worldToLocal(point.clone()));
  };
  for (const cable of cables) {
    for (const end of [-1, 1]) {
      const point = cable.localToWorld(
        new T.Vector3(0, (end * cable.geometry.parameters.height) / 2, 0),
      );
      assert.ok(
        meshes.some((other) => other !== cable && contains(other, point)),
        `free cable end at ${point.toArray().join(', ')}`,
      );
    }
  }
  const boom = meshes.find((mesh) => mesh.name === 'crane-beam')!;
  assert.ok(
    contains(boom, new T.Vector3(0, CRANE.boomY, 0)),
    'boom directly above the hoist',
  );
  assert.ok(
    contains(boom, new T.Vector3(CRANE.mastX, CRANE.boomY, CRANE.mastZ)),
    'boom meets the mast turntable',
  );
  for (const mesh of meshes) mesh.geometry.dispose();
});
