import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstSweepHit, sweepCollider, type Collider } from './collision';

void test('a fast rider cannot tunnel through a narrow pole', () => {
  const pole: Collider = {
    id: 'pole',
    shape: 'circle',
    x: 0,
    z: 10,
    radius: 0.22,
    height: 2,
    source: 'gate',
  };
  const hit = sweepCollider({ x: 0, z: 0 }, { x: 0, z: 22 }, pole);
  assert.ok(hit);
  assert.ok(hit.time > 0 && hit.time < 1);
  assert.ok(hit.directness > 0.95);
});

void test('side contact reads as a glancing collision', () => {
  const snowball: Collider = {
    id: 'snowball',
    shape: 'circle',
    x: 0,
    z: 10,
    radius: 1.1,
    height: 2.2,
    source: 'snowball',
  };
  const hit = sweepCollider({ x: -3, z: 8.5 }, { x: 3, z: 8.5 }, snowball);
  assert.ok(hit);
  assert.ok(hit.directness < 0.72);
});

void test('boxes stop movement and airborne riders can clear low objects', () => {
  const bank: Collider = {
    id: 'bank',
    shape: 'box',
    x: 0,
    z: 8,
    halfX: 3,
    halfZ: 0.6,
    height: 0.9,
    source: 'snowbank',
  };
  assert.ok(firstSweepHit({ x: 0, z: 0 }, { x: 0, z: 15 }, [bank], 0));
  assert.equal(
    firstSweepHit({ x: 0, z: 0 }, { x: 0, z: 15 }, [bank], 1.2),
    null,
  );
});

void test('an overlap correction returns the nearest valid separation point', () => {
  const box: Collider = {
    id: 'box',
    shape: 'box',
    x: 0,
    z: 5,
    halfX: 2,
    halfZ: 1,
    height: 2,
    source: 'scenery',
  };
  const hit = sweepCollider({ x: 1.9, z: 5 }, { x: 2.2, z: 5.2 }, box);
  assert.ok(hit);
  assert.equal(hit.time, 0);
  assert.ok(hit.x > 2.4);
});
