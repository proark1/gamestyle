import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { slopeCameraFrame, smoothCameraSteer } from './camera';
import { coursePoint } from './course';

function projection(speed: number, point: T.Vector3, aspect = 16 / 9, z = 100) {
  const frame = slopeCameraFrame({ x: 0, z, height: 0, speed, steer: 0 });
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
  assert.ok(slow.fov < fast.fov);
  assert.ok(Math.abs(slow.roll) <= 0.052);
  assert.ok(Math.abs(fast.roll) <= 0.052);
});

void test('the rider stays low while 80–120 metres of course remain visible', () => {
  for (const aspect of [16 / 9, 390 / 844]) {
    for (const speed of [5, 12, 19]) {
      const riderPoint = coursePoint(0, 100, 1);
      const rider = projection(
        speed,
        new T.Vector3(riderPoint.x, riderPoint.y, riderPoint.z),
        aspect,
      );

      assert.ok(
        rider.y < -0.2 && rider.y > -0.94,
        `${aspect}/${speed}: rider ${rider.y}`,
      );
      for (const distance of [80, 100, 120]) {
        const course = coursePoint(0, 100 + distance, 0.5);
        const point = projection(
          speed,
          new T.Vector3(course.x, course.y, course.z),
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
    const course = coursePoint(x, 200, 0.5);
    const point = projection(
      19,
      new T.Vector3(course.x, course.y, course.z),
      390 / 844,
    );
    assert.ok(point.x > -0.92 && point.x < 0.92, `${x}: ${point.x}`);
  }
});

void test('camera looks through both left and right bends', () => {
  for (const z of [120, 210, 360, 440]) {
    const ahead = coursePoint(0, z + 80, 0.5);
    const projected = projection(
      15,
      new T.Vector3(ahead.x, ahead.y, ahead.z),
      16 / 9,
      z,
    );
    assert.ok(Math.abs(projected.x) < 0.82, `${z}: ${projected.x}`);
  }
});

void test('camera steering crosses an abrupt direction change smoothly', () => {
  let steer = 1;
  const samples: number[] = [];

  for (let frame = 0; frame < 30; frame++) {
    steer = smoothCameraSteer(steer, -1, 1 / 60);
    samples.push(steer);
  }

  assert.ok(samples[0] > 0.7, `first frame should not snap: ${samples[0]}`);
  assert.ok(samples.at(-1)! < 0, 'camera should eventually follow the turn');
  for (let index = 1; index < samples.length; index++) {
    assert.ok(samples[index] < samples[index - 1]);
    assert.ok(
      samples[index - 1] - samples[index] < 0.18,
      `frame ${index} moved too far`,
    );
  }
});
