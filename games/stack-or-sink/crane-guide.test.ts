import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  craneRoute,
  craneStep,
  craneTravelHeight,
  mapToCranePoint,
} from './crane-guide';

void test('map corners and center correspond to screen-aligned yard coordinates', () => {
  assert.deepEqual(mapToCranePoint(0, 0), { x: -8, z: -8 });
  assert.deepEqual(mapToCranePoint(0.5, 0.5), { x: 0, z: 0 });
  assert.deepEqual(mapToCranePoint(1, 1), { x: 8, z: 8 });
  assert.deepEqual(mapToCranePoint(1.4, -0.4), { x: 8, z: -8 });
});

void test('map travel lifts above the existing stack and never lowers a raised load', () => {
  assert.ok(craneTravelHeight(0.13, 3.1) > 3.6);
  assert.equal(craneTravelHeight(5, 3.1), 5);
});

void test('map route bends around a fixed pillar without crossing it', () => {
  const clear = ({ x, z }: { x: number; z: number }) => Math.hypot(x, z) > 1;
  const start = { x: -3, z: 0 };
  const destination = { x: 3, z: 0 };
  const route = craneRoute(start, destination, clear);
  assert.ok(route && route.length > 2);
  let previous = start;
  for (const next of route) {
    const count = Math.ceil(
      Math.hypot(next.x - previous.x, next.z - previous.z) / 0.1,
    );
    for (let i = 1; i <= count; i++)
      assert.ok(
        clear({
          x: previous.x + ((next.x - previous.x) * i) / count,
          z: previous.z + ((next.z - previous.z) * i) / count,
        }),
      );
    previous = next;
  }
  assert.deepEqual(route.at(-1), destination);
  assert.equal(craneRoute(start, { x: 0, z: 0 }, clear), null);
});

void test('destination guide takes bounded steps and stops without overshoot', () => {
  const far = craneStep({ x: -4, z: 1 }, { x: 4, z: 5 });
  assert.ok(far);
  assert.ok(Math.abs(Math.hypot(far.x, far.z) - 0.55) < 1e-9);
  assert.ok(far.x > 0 && far.z > 0);
  assert.deepEqual(craneStep({ x: 1, z: 1 }, { x: 1.2, z: 1 }), {
    x: 0.19999999999999996,
    z: 0,
  });
  assert.equal(craneStep({ x: 1.15, z: 1 }, { x: 1.2, z: 1 }), null);
});
