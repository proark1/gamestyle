import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { slopeCameraFrame } from './camera';
import { slopeY } from './types';

function projection(speed: number, point: T.Vector3) {
  const frame = slopeCameraFrame({ x: 0, z: 100, height: 0, speed });
  const camera = new T.PerspectiveCamera(frame.fov, 16 / 9, 0.1, 300);
  camera.position.set(frame.position.x, frame.position.y, frame.position.z);
  camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
  camera.updateMatrixWorld();
  return point.project(camera);
}

void test('camera framing stays bounded as speed changes', () => {
  const slow = slopeCameraFrame({ x: 4, z: 100, height: 0, speed: 5 });
  const fast = slopeCameraFrame({ x: 4, z: 100, height: 0, speed: 19 });
  const extreme = slopeCameraFrame({ x: 4, z: 100, height: 0, speed: 100 });

  assert.equal(slow.fov, 59);
  assert.equal(fast.fov, 64);
  assert.deepEqual(extreme, fast);
  assert.equal(slow.position.z, 86);
  assert.equal(fast.position.z, 83);
  assert.equal(slow.target.z, 134);
  assert.equal(fast.target.z, 140);
});

void test('the rider stays low in frame while upcoming course remains visible', () => {
  for (const speed of [5, 12, 19]) {
    const rider = projection(speed, new T.Vector3(0, slopeY(100) + 1, 100));
    const nextFeature = projection(
      speed,
      new T.Vector3(0, slopeY(170) + 0.5, 170),
    );

    assert.ok(rider.y < -0.15 && rider.y > -0.72, `${speed}: rider ${rider.y}`);
    assert.ok(
      nextFeature.y < 0.9 && nextFeature.y > -0.9,
      `${speed}: feature ${nextFeature.y}`,
    );
    assert.ok(nextFeature.z > -1 && nextFeature.z < 1);
  }
});
