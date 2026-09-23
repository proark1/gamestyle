import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { junk } from './objects';
import { RESCUE_SUPPORT_OFFSET, SCENERY } from './geometry';
import { GOAL, ITEMS } from './types';

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

void test('rescue deck has two opposing fixed supports and no second crane silhouette', () => {
  const supports = SCENERY.filter((shape) => shape.id === 'rescue-support');
  assert.equal(supports.length, 2);
  assert.deepEqual(
    supports
      .map((shape) => [shape.pos[0], shape.pos[2]])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    [
      [-RESCUE_SUPPORT_OFFSET, RESCUE_SUPPORT_OFFSET],
      [RESCUE_SUPPORT_OFFSET, -RESCUE_SUPPORT_OFFSET],
    ].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  );
  for (const support of supports)
    assert.equal(support.pos[1] + support.size[1] / 2, GOAL);
  assert.equal(
    SCENERY.filter((shape) => shape.id?.startsWith('crane-')).length,
    0,
  );
});
