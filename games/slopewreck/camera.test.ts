import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { slopeCameraFrame } from './camera';
import { slopeY } from './types';

function projection(speed: number, point: T.Vector3, aspect = 16 / 9) {
  const frame = slopeCameraFrame({ x: 0, z: 100, height: 0, speed });
  const camera = new T.PerspectiveCamera(frame.fov, aspect, 0.1, 420);
  camera.position.set(frame.position.x, frame.position.y, frame.position.z);
  camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
  camera.updateMatrixWorld();
  return point.project(camera);
}

void test('camera framing stays bounded as speed changes', () => {
  const slow = slopeCameraFrame({ x: 4, z: 100, height: 0, speed: 5 });
  const fast = slopeCameraFrame({ x: 4, z: 100, height: 0, speed: 19 });
  const extreme = slopeCameraFrame({ x: 4, z: 100, height: 0, speed: 100 });

  assert.equal(slow.fov, 60);
  assert.equal(fast.fov, 65);
  assert.deepEqual(extreme, fast);
  assert.equal(slow.position.z, 85);
  assert.equal(fast.position.z, 82);
  assert.equal(slow.target.z, 170);
  assert.equal(fast.target.z, 188);
});

void test('the rider stays low while 80–120 metres of course remain visible', () => {
  for (const aspect of [16 / 9, 390 / 844]) {
    for (const speed of [5, 12, 19]) {
      const rider = projection(
        speed,
        new T.Vector3(0, slopeY(100) + 1, 100),
        aspect,
      );

      assert.ok(
        rider.y < -0.2 && rider.y > -0.94,
        `${aspect}/${speed}: rider ${rider.y}`,
      );
      for (const distance of [80, 100, 120]) {
        const point = projection(
          speed,
          new T.Vector3(0, slopeY(100 + distance) + 0.5, 100 + distance),
          aspect,
        );
        assert.ok(
          point.y < 0.78 && point.y > -0.78,
          `${aspect}/${speed}/${distance}: course ${point.y}`,
        );
        assert.ok(point.z > -1 && point.z < 1);
      }
    }
  }
});

void test('the full course width is visible 100 metres ahead on mobile', () => {
  for (const x of [-10, 10]) {
    const point = projection(
      19,
      new T.Vector3(x, slopeY(200) + 0.5, 200),
      390 / 844,
    );
    assert.ok(point.x > -0.92 && point.x < 0.92, `${x}: ${point.x}`);
  }
});
