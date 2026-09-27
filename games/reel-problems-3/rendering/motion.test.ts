import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolateAngle, sampleMotion } from './motion';

void test('actual displacement activates motion without input', () => {
  const still = sampleMotion(undefined, 0, 0, 0);
  const moving = sampleMotion(still, 0.2, 0, 50);
  assert.ok(moving.speed > 0.5);
  assert.ok(moving.phase > still.phase);
});

void test('motion settles after repeated stationary samples', () => {
  let motion = sampleMotion(undefined, 0, 0, 0);
  motion = sampleMotion(motion, 1, 0, 100);
  for (let at = 200; at <= 1200; at += 100)
    motion = sampleMotion(motion, 1, 0, at);
  assert.equal(motion.speed, 0);
});

void test('angle interpolation uses the short wrapped path', () => {
  const value = interpolateAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
  assert.ok(Math.abs(Math.abs(value) - Math.PI) < 0.05);
});
