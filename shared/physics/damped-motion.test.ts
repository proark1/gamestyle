import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boundedImpulse,
  dampedSpring,
  finite,
  stableRest,
} from './damped-motion';

void test('bounded motion helpers reject invalid values and cap impulses', () => {
  assert.equal(finite(Number.NaN, 4), 4);
  assert.equal(boundedImpulse(8, 9, 10), 10);
  assert.equal(boundedImpulse(-8, -9, 10), -10);
});

void test('damped spring remains finite and inside its travel', () => {
  let state = { value: 0, velocity: 9 };
  for (let i = 0; i < 600; i++)
    state = dampedSpring(state, 1 / 60, {
      target: 0,
      stiffness: 14,
      damping: 4,
      min: -0.4,
      max: 0.4,
      velocityLimit: 12,
    });
  assert.ok(Number.isFinite(state.value));
  assert.ok(Math.abs(state.value) < 0.01);
  assert.ok(Math.abs(state.velocity) < 0.02);
});

void test('stable rest requires finite linear and angular speeds', () => {
  assert.equal(stableRest(0.02, 0.03), true);
  assert.equal(stableRest(0.2, 0), false);
  assert.equal(stableRest(Number.NaN, 0), false);
});
