import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CAMERA_MODE,
  firstPersonPose,
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

void test('first-person eye follows a tilted rendered transform', () => {
  const half = Math.sin(Math.PI / 4);
  const pose = firstPersonPose(
    { x: -2, y: 0.5, z: 7 },
    { x: 0, y: 0, z: half, w: half },
  );
  close(pose.eye.x, -3.52);
  close(pose.eye.y, 0.5);
  close(pose.eye.z, 7);
  close(pose.look.x, -3.52);
  close(pose.look.y, 0.5);
  close(pose.look.z, 13);
});
