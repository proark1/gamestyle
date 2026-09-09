import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TouchGesture,
  joystickVector,
  touchSprint,
  HeldInputs,
  cameraMovement,
} from './touch';

void test('sprint uses an outer ring with hysteresis and stops for neutral or invalid input', () => {
  assert.equal(touchSprint(0.89, false), false);
  assert.equal(touchSprint(0.9, false), true);
  assert.equal(touchSprint(0.85, true), true);
  assert.equal(touchSprint(0.79, true), false);
  assert.equal(touchSprint(0, true), false);
  assert.equal(touchSprint(NaN, true), false);
});
void test('crew hold controls combine independently and release in either order', () => {
  for (const first of ['left', 'climb']) {
    const held = new HeldInputs();
    held.set('left', { turn: -1 });
    assert.deepEqual(held.set('climb', { work: true }), {
      x: 0,
      z: 0,
      turn: -1,
      work: true,
    });
    assert.deepEqual(held.set(first, {}), {
      x: 0,
      z: 0,
      turn: first === 'left' ? 0 : -1,
      work: first !== 'climb',
    });
    assert.deepEqual(held.clear(), { x: 0, z: 0, turn: 0, work: false });
    assert.equal(held.sources.size, 0);
  }
});
void test('crew touch movement follows the overview camera and preserves analog speed', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const result = cameraMovement(0, -0.6, yaw);
    assert.ok(Math.abs(result.x + 0.6 * Math.sin(yaw)) < 1e-9);
    assert.ok(Math.abs(result.z + 0.6 * Math.cos(yaw)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(result.x, result.z) - 0.6) < 1e-9);
  }
});

void test('a short tap is accepted only on release, while a drag or long press is not', () => {
  const g = new TouchGesture();
  g.down(1, 10, 10, 0);
  assert.equal(g.up(1, 13, 12, 100), true);
  g.down(1, 10, 10, 0);
  assert.ok(g.move(1, 30, 10)?.orbit);
  assert.equal(g.up(1, 10, 10, 100), false);
  g.down(1, 10, 10, 0);
  assert.equal(g.up(1, 10, 10, 700), false);
});
void test('pinching never becomes a build tap, regardless of finger release order', () => {
  for (const first of [1, 2]) {
    const g = new TouchGesture();
    g.down(1, 0, 0, 0);
    g.down(2, 100, 0, 0);
    assert.equal(g.move(2, 150, 0)?.zoom, 1.5);
    assert.equal(g.up(first, first === 1 ? 0 : 150, 0, 100), false);
    assert.equal(
      g.up(first === 1 ? 2 : 1, first === 1 ? 150 : 0, 0, 110),
      false,
    );
    g.down(3, 40, 40, 200);
    assert.equal(g.up(3, 40, 40, 250), true);
  }
});
void test('cancelled and unrelated contacts cannot trigger taps or camera movement', () => {
  const g = new TouchGesture();
  g.down(1, 0, 0, 0);
  assert.equal(g.move(2, 99, 99), null);
  assert.equal(g.up(1, 0, 0, 20, true), false);
  g.down(1, 0, 0, 0);
  g.clear();
  assert.equal(g.up(1, 0, 0, 20), false);
});
void test('joystick has a dead zone and clamps diagonal or captured off-pad movement', () => {
  assert.deepEqual(joystickVector(0.05, 0.02), { x: 0, z: 0 });
  assert.deepEqual(joystickVector(10, 0), { x: 1, z: 0 });
  const diagonal = joystickVector(8, 8);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-10);
  assert.deepEqual(joystickVector(NaN, 0), { x: 0, z: 0 });
});
