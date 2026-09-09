import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_POLL_MS, quantizeAxis } from './input-rate';

void test('quantised axes collapse sub-perceptual joystick jitter', () => {
  // A thumb resting on a joystick produces a slightly different float every
  // frame. Those must land on the same value or every frame triggers a poll.
  const jitter = [0.6123, 0.6131, 0.6098, 0.61, 0.6144];
  const seen = new Set(jitter.map(quantizeAxis));
  assert.equal(seen.size, 1, 'jitter within one step must not look like input');
  assert.equal([...seen][0], 0.61);
});

void test('quantising preserves the range and the values that matter', () => {
  assert.equal(quantizeAxis(0), 0);
  assert.equal(quantizeAxis(1), 1);
  assert.equal(quantizeAxis(-1), -1);
  assert.equal(quantizeAxis(0.5), 0.5);
  // Deliberate movement still reads as movement.
  assert.notEqual(quantizeAxis(0.61), quantizeAxis(0.62));
  // Never widens the range the simulation clamps to.
  for (const v of [-1, -0.333, 0.333, 1])
    assert.ok(Math.abs(quantizeAxis(v)) <= 1);
});

void test('non-finite input cannot reach the wire', () => {
  assert.equal(quantizeAxis(NaN), 0);
  assert.equal(quantizeAxis(Infinity), 0);
  assert.equal(quantizeAxis(-Infinity), 0);
});

void test('a change can shorten the poll wait but never remove it', () => {
  // Zero here is what let one moving client poll as fast as the network
  // allowed, with every request running a full server tick.
  assert.ok(MIN_POLL_MS > 0);
  assert.ok(MIN_POLL_MS <= 60, 'must still be faster than the idle cadence');
  assert.ok(1000 / MIN_POLL_MS <= 40, 'caps one client at 40 requests/second');
});
