import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampToCourse,
  courseCenter,
  courseFrame,
  coursePoint,
  courseWidth,
} from './course';
import { FINISH_Z } from './types';

void test('the course visibly bends while remaining continuous', () => {
  const centers = [0, 70, 140, 215, 290, 370, 445, 520, FINISH_Z].map(
    courseCenter,
  );
  assert.ok(Math.min(...centers) < -10);
  assert.ok(Math.max(...centers) > 10);
  for (let z = 0; z < FINISH_Z; z += 0.25)
    assert.ok(
      Math.abs(courseCenter(z + 0.01) - courseCenter(z)) < 0.02,
      `course discontinuity near ${z}`,
    );
});

void test('course frames stay normalized and banked within arcade bounds', () => {
  let banked = false;
  for (let z = 0; z <= FINISH_Z; z += 4) {
    const frame = courseFrame(z);
    assert.ok(Math.abs(Math.hypot(frame.tangentX, frame.tangentZ) - 1) < 1e-6);
    assert.ok(
      Math.abs(frame.tangentX * frame.sideX + frame.tangentZ * frame.sideZ) <
        1e-6,
    );
    assert.ok(Math.abs(frame.bank) <= 0.160001);
    if (Math.abs(frame.bank) > 0.04) banked = true;
  }
  assert.equal(banked, true);
});

void test('lateral course points follow the local side vector', () => {
  for (const z of [40, 160, 300, 470]) {
    const frame = courseFrame(z);
    const center = coursePoint(0, z);
    const right = coursePoint(3, z);
    assert.ok(Math.abs(right.x - center.x - frame.sideX * 3) < 1e-6);
    assert.ok(Math.abs(right.z - center.z - frame.sideZ * 3) < 1e-6);
  }
});

void test('course width narrows only in authored turns and clamps safely', () => {
  assert.equal(courseWidth(0), 10);
  assert.ok(courseWidth(214) < 10);
  assert.equal(clampToCourse(20, 214), courseWidth(214));
  assert.equal(clampToCourse(-20, 214), -courseWidth(214));
});
