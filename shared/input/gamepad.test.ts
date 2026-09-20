import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadzone, gamepadKeys, DEFAULT_KEYS } from './gamepad';
void test('controller drift is ignored and held/released actions map without repetition', () => {
  assert.equal(deadzone(0.1), 0);
  assert.equal(deadzone(-1), -1);
  assert.deepEqual(
    [...gamepadKeys([0.1, -1], [{ pressed: true }], DEFAULT_KEYS)],
    ['KeyW', 'Space'],
  );
  assert.equal(gamepadKeys([0, 0], [], DEFAULT_KEYS).size, 0);
  assert.ok(gamepadKeys([1, 0], [{ pressed: true }], ['KeyE']).has('KeyE'));
});
