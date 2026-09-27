import assert from 'node:assert/strict';
import test from 'node:test';
import { castProgress, castRigPosition, fillFishingLine } from './fishing-line';

const start = { x: 0, y: 2, z: 0 };
const end = { x: 8, y: 0, z: 2 };

void test('line curves preserve their exact endpoints', () => {
  const points = fillFishingLine(
    new Float32Array(36),
    start,
    end,
    'waiting',
    0,
    0,
  );
  assert.deepEqual(points.slice(0, 3), new Float32Array([0, 2, 0]));
  assert.deepEqual(points.slice(-3), new Float32Array([8, 0, 2]));
  assert.ok([...points].every(Number.isFinite));
});

void test('casting lifts while waiting sags', () => {
  const cast = fillFishingLine(
    new Float32Array(33),
    start,
    end,
    'casting',
    0,
    0,
  );
  const waiting = fillFishingLine(
    new Float32Array(33),
    start,
    end,
    'waiting',
    0,
    0,
  );
  const middle = Math.floor(11 / 2) * 3 + 1;
  assert.ok(cast[middle] > waiting[middle]);
});

void test('tension straightens a hooked line and landing adds an arc', () => {
  const slack = fillFishingLine(
    new Float32Array(33),
    start,
    end,
    'hooked',
    0.1,
    0,
  );
  const tight = fillFishingLine(
    new Float32Array(33),
    start,
    end,
    'hooked',
    1,
    0,
  );
  const landing = fillFishingLine(
    new Float32Array(33),
    start,
    end,
    'hooked',
    1,
    0,
    0.5,
  );
  const middle = Math.floor(11 / 2) * 3 + 1;
  const straightMid = start.y + (end.y - start.y) * 0.5;
  assert.ok(
    Math.abs(tight[middle] - straightMid) <
      Math.abs(slack[middle] - straightMid),
  );
  assert.ok(landing[middle] > tight[middle]);
});

void test('cast progress and rig position stay bounded at exact endpoints', () => {
  assert.equal(castProgress(900, 1_000, 500), 0);
  assert.equal(castProgress(1_250, 1_000, 500), 0.5);
  assert.equal(castProgress(2_000, 1_000, 500), 1);
  const from = { x: 0, y: 2, z: 0 };
  const to = { x: 12, y: 0, z: 4 };
  assert.deepEqual(castRigPosition(from, to, 0), from);
  assert.deepEqual(castRigPosition(from, to, 1), to);
  const middle = castRigPosition(from, to, 0.5);
  assert.ok(middle.y > from.y);
  assert.ok(Number.isFinite(middle.x + middle.y + middle.z));
});

void test('waiting line sags while a tense hooked line straightens', () => {
  const waiting = fillFishingLine(
    new Float32Array(24),
    start,
    end,
    'waiting',
    0,
    0,
  );
  const tight = fillFishingLine(
    new Float32Array(24),
    start,
    end,
    'hooked',
    1,
    0,
  );
  const middle = Math.floor(waiting.length / 6) * 3 + 1;
  assert.ok(waiting[middle] < tight[middle]);
});
