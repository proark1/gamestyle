import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cameraShakeScale,
  dampingAlpha,
  DEFAULT_CAMERA_MODE,
  firstPersonEyeHeight,
  firstPersonPose,
  horizontalForward,
  nextCameraMode,
  parseCameraMode,
} from './camera';

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

void test('camera preferences accept known modes and safely fall back', () => {
  assert.equal(parseCameraMode('isometric'), 'isometric');
  assert.equal(parseCameraMode('first-person'), 'first-person');
  assert.equal(parseCameraMode('wide'), DEFAULT_CAMERA_MODE);
  assert.equal(parseCameraMode(null), DEFAULT_CAMERA_MODE);
});

void test('camera mode toggles between isometric and first person', () => {
  assert.equal(nextCameraMode('isometric'), 'first-person');
  assert.equal(nextCameraMode('first-person'), 'isometric');
});

void test('first-person pose uses eye height and forward direction', () => {
  const pose = firstPersonPose(
    { x: 4, y: 2, z: -3 },
    { x: 0, y: 0, z: 0, w: 1 },
  );
  assert.deepEqual(pose.eye, { x: 4, y: 3.52, z: -3 });
  assert.deepEqual(pose.look, { x: 4, y: 3.52, z: 3 });
});

void test('first-person pose rotates with an angler on a yawed boat', () => {
  const half = Math.sin(Math.PI / 4);
  const pose = firstPersonPose(
    { x: 10, y: 1, z: 20 },
    { x: 0, y: half, z: 0, w: half },
  );
  close(pose.eye.x, 10);
  close(pose.eye.y, 2.52);
  close(pose.eye.z, 20);
  close(pose.look.x, 16);
  close(pose.look.y, 2.52);
  close(pose.look.z, 20);
});

void test('first-person keeps its eye vertical through a tilted transform', () => {
  const half = Math.sin(Math.PI / 4);
  const pose = firstPersonPose(
    { x: -2, y: 0.5, z: 7 },
    { x: 0, y: 0, z: half, w: half },
  );
  close(pose.eye.x, -2);
  close(pose.eye.y, 2.02);
  close(pose.eye.z, 7);
  close(pose.look.x, -2);
  close(pose.look.y, 2.02);
  close(pose.look.z, 13);
});

void test('movement heading stays horizontal when the angler is pitched', () => {
  const halfPitch = Math.PI / 6;
  const forward = horizontalForward({
    x: Math.sin(halfPitch),
    y: 0,
    z: 0,
    w: Math.cos(halfPitch),
  });
  close(forward.x, 0);
  close(forward.y, 0);
  close(forward.z, 1);
});

void test('camera damping is frame-rate independent', () => {
  const simulate = (frames: number, dt: number) => {
    let value = 0;
    for (let i = 0; i < frames; i++) {
      value += (1 - value) * dampingAlpha(8, dt);
    }
    return value;
  };
  close(simulate(60, 1 / 60), simulate(30, 1 / 30));
  assert.equal(dampingAlpha(8, Number.NaN), 0);
  assert.equal(dampingAlpha(0, 1 / 60), 0);
});

void test('swimming and recovery use safe first-person eye heights', () => {
  assert.equal(firstPersonEyeHeight({ swimming: false }), 1.52);
  assert.equal(firstPersonEyeHeight({ swimming: true }), 0.82);
  assert.equal(firstPersonEyeHeight({ swimming: true, clinging: true }), 1.08);
  assert.equal(firstPersonEyeHeight({ swimming: true, downed: true }), 0.7);
});

void test('first-person shake is gentle and camera poses reject non-finite input', () => {
  assert.equal(cameraShakeScale('isometric'), 1);
  assert.ok(cameraShakeScale('first-person') > 0);
  assert.ok(cameraShakeScale('first-person') < 0.25);
  const pose = firstPersonPose(
    { x: Number.NaN, y: Number.POSITIVE_INFINITY, z: 4 },
    { x: Number.NaN, y: 0, z: 0, w: 1 },
  );
  assert.ok(Object.values(pose.eye).every(Number.isFinite));
  assert.ok(Object.values(pose.look).every(Number.isFinite));
});
