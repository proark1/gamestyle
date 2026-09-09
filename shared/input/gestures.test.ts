import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JoystickGesture, joystickVector, YardGesture } from './gestures';

void test('joystick has a dead zone, analog movement and bounded diagonals', () => {
  assert.deepEqual(joystickVector(2, 3), { x: 0, z: 0 });
  assert.equal(joystickVector(20, 0).x, 0.5);
  assert.equal(joystickVector(0, -70).z, -1);
  assert.ok(
    Math.abs(Math.hypot(...Object.values(joystickVector(300, 300))) - 1) <
      1e-10,
  );
});

void test('touching away from the circle center starts neutral and anchors the drag to that thumb', () => {
  const stick = new JoystickGesture();
  assert.equal(stick.down(1, 73, 521), true);
  assert.deepEqual(stick.vector, { x: 0, z: 0 });
  assert.deepEqual(stick.move(1, 73, 521), { x: 0, z: 0 });
  assert.deepEqual(stick.move(1, 73, 486), { x: 0, z: -1 });
  assert.deepEqual(stick.move(1, 73, 556), { x: 0, z: 1 });
  assert.deepEqual(stick.move(1, 73, 521), { x: 0, z: 0 });
});

void test('movement grows smoothly out of the dead zone rather than jumping to a minimum speed', () => {
  assert.deepEqual(joystickVector(0, 5), { x: 0, z: 0 });
  const justMoving = joystickVector(0, 5.03).z;
  assert.ok(justMoving > 0 && justMoving < 0.002);
  assert.ok(joystickVector(0, 10).z < joystickVector(0, 20).z);
});

void test('another thumb can jump and release without stealing or stopping movement', () => {
  const stick = new JoystickGesture();
  stick.down(7, 100, 100);
  stick.move(7, 135, 100);
  assert.equal(stick.down(8, 400, 100), false);
  assert.equal(stick.move(8, 440, 100), null);
  assert.equal(stick.up(8), false);
  assert.deepEqual(stick.vector, { x: 1, z: 0 });
  assert.equal(stick.up(7), true);
  assert.deepEqual(stick.vector, { x: 0, z: 0 });
});

void test('dragging beyond the pad stays bounded; release and late events cannot leave movement stuck', () => {
  const stick = new JoystickGesture();
  stick.down(1, 10, 10, 30);
  const far = stick.move(1, -500, 700)!;
  assert.ok(Math.abs(Math.hypot(far.x, far.z) - 1) < 1e-10);
  assert.equal(stick.up(1), true);
  assert.equal(stick.move(1, 300, 400), null);
  assert.deepEqual(stick.vector, { x: 0, z: 0 });
});

void test('interrupting a drag clears its owner and the next touch gets a fresh origin', () => {
  const stick = new JoystickGesture();
  stick.down(1, 20, 20);
  stick.move(1, 20, 100);
  stick.clear();
  assert.equal(stick.owner, null);
  assert.deepEqual(stick.vector, { x: 0, z: 0 });
  assert.equal(stick.up(1), false);
  assert.equal(stick.down(2, 500, 600), true);
  assert.deepEqual(stick.move(2, 500, 600), { x: 0, z: 0 });
});
void test('finger jitter is a tap but an orbit is not', () => {
  const g = new YardGesture();
  g.down(1, 50, 50);
  assert.deepEqual(g.move(1, 53, 52), { orbit: 0, zoom: 1 });
  assert.equal(g.up(1), true);
  g.down(2, 50, 50);
  assert.equal(g.move(2, 80, 50).orbit, 30);
  assert.equal(g.up(2), false);
});
void test('pinching zooms without orbiting or tapping after either finger lifts', () => {
  const g = new YardGesture();
  g.down(1, 0, 0);
  g.down(2, 100, 0);
  assert.deepEqual(g.move(2, 200, 0), { orbit: 0, zoom: 0.5 });
  assert.equal(g.up(1), false);
  assert.equal(g.up(2), false);
});
void test('cancelled, stray, third finger and interrupted gestures cannot tap', () => {
  const g = new YardGesture();
  g.down(1, 0, 0);
  assert.equal(g.up(2), false);
  assert.equal(g.up(1, true), false);
  g.down(1, 0, 0);
  g.down(2, 10, 10);
  g.down(3, 20, 20);
  assert.deepEqual(g.move(3, 30, 30), { orbit: 0, zoom: 1 });
  assert.equal(g.up(3), false);
  assert.equal(g.up(2), false);
  assert.equal(g.up(1), false);
  g.down(1, 50, 50);
  g.clear();
  assert.equal(g.up(1), false);
});
