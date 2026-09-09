import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {
  IslandSea,
  islandCoast,
  shorelineRadius,
  disposeCoastalMaterials,
} from './coast';
import { FLOOR } from './geometry';

void test('the visible island supports the complete playable floor at the physics height', () => {
  const coast = islandCoast();
  coast.updateMatrixWorld(true);
  const ground = coast.children[0];
  const ray = new T.Raycaster();
  for (let x = -10; x <= 10; x += 0.5)
    for (let z = -10; z <= 10; z += 0.5) {
      ray.set(new T.Vector3(x, 2, z), new T.Vector3(0, -1, 0));
      const hit = ray.intersectObject(ground)[0];
      assert.ok(hit, `missing terrain at ${x}, ${z}`);
      assert.ok(
        Math.abs(hit.point.y - FLOOR) < 0.00001,
        `terrain differs from footing at ${x}, ${z}`,
      );
      assert.ok(hit.face!.normal.y > 0.99);
    }
  disposeCoastalMaterials(coast);
});

void test('the flood shoreline moves inward and stays on the beach until the island is covered', () => {
  for (let i = 0; i < 96; i++) {
    const angle = (i / 96) * Math.PI * 2;
    let previous = Infinity;
    for (const height of [-2, -0.75, -0.4, -0.12, 0, FLOOR]) {
      const radius = shorelineRadius(angle, height);
      assert.ok(radius <= previous);
      assert.ok(Number.isFinite(radius) && radius > 10);
      previous = radius;
    }
  }
  const sea = new IslandSea();
  for (const level of [-0.4, 0, 0.5, 6, 15]) {
    sea.update(level, 120, false);
    assert.equal(sea.surface.position.y, level);
    assert.equal(sea.foam.visible, level < FLOOR);
    assert.ok([...sea.positions].every(Number.isFinite));
  }
  disposeCoastalMaterials(sea);
});

void test('reduced motion freezes sea animation while retaining the actual flood height', () => {
  const sea = new IslandSea();
  sea.update(-0.2, 10, true);
  const still = Array.from(sea.positions);
  sea.update(-0.2, 100, true);
  assert.deepEqual(Array.from(sea.positions), still);
  assert.equal(sea.surface.material.uniforms.time.value, 0);
  sea.update(0.8, 150, true);
  assert.equal(sea.surface.position.y, 0.8);
  assert.equal(sea.foam.visible, false);
  disposeCoastalMaterials(sea);
});
