import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryLook, DELIVERY_CAMERAS } from './camera';

void test('first-person walking tracks the horizontal gaze without adding lift or diagonal speed from pitch', () => {
  const look = new DeliveryLook();
  for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI, 1.3]) {
    look.yaw = yaw;
    for (const pitch of [-1.25, 0, 1.25]) {
      look.pitch = pitch;
      const walk = look.walk(0, -1),
        gaze = look.direction();
      assert.ok(Math.abs(Math.hypot(walk.x, walk.z) - 1) < 1e-10);
      assert.ok(Math.abs(walk.x - gaze.x / Math.cos(pitch)) < 1e-10);
      assert.ok(Math.abs(walk.z - gaze.z / Math.cos(pitch)) < 1e-10);
      const right = look.walk(1, 0);
      assert.ok(Math.abs(right.x * walk.x + right.z * walk.z) < 1e-10);
    }
  }
});

void test('mouse and touch look turn naturally, clamp pitch and wrap endless rotation', () => {
  const look = new DeliveryLook();
  look.yaw = 0;
  look.pitch = 0;
  look.turn(100, -100);
  assert.ok(look.direction().x > 0, 'dragging right looks right');
  assert.ok(look.direction().y > 0, 'dragging up looks up');
  look.turn(1_000_000, 1_000_000);
  assert.equal(look.pitch, -1.25);
  assert.ok(Math.abs(look.yaw) <= Math.PI);
  look.turn(-1_000_000, -1_000_000);
  assert.equal(look.pitch, 1.25);
});

void test('a delivery starts outside, following you, and V still reaches first person', () => {
  assert.equal(DELIVERY_CAMERAS[0], 'follow');
  assert.deepEqual([...DELIVERY_CAMERAS].sort(), [
    'first-person',
    'follow',
    'overview',
    'sofa',
  ]);
});
