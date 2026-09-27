import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundedEffectQueue, CameraImpulseController } from './effects';

void test('effect queue deduplicates replayed events and stays bounded', () => {
  const queue = new BoundedEffectQueue(2);
  assert.equal(queue.ingest({ id: 1, tier: 'minor', at: 0, x: 0, z: 0 }), true);
  assert.equal(
    queue.ingest({ id: 1, tier: 'minor', at: 0, x: 0, z: 0 }),
    false,
  );
  queue.ingest({ id: 2, tier: 'course', at: 1, x: 0, z: 0 });
  assert.equal(queue.ingest({ id: 3, tier: 'major', at: 2, x: 0, z: 0 }), true);
  assert.equal(queue.active(2).length, 2);
  assert.ok(queue.active(2).every((entry) => entry.id !== 1));
});

void test('camera impulse is clamped and settles back to rest', () => {
  const camera = new CameraImpulseController();
  camera.kick(50, 3);
  for (let index = 0; index < 10; index++) camera.update(1 / 60);
  assert.ok(Math.abs(camera.x) <= 0.34);
  assert.ok(Math.abs(camera.y) <= 0.22);
  assert.ok(camera.zoom <= 0.5);
  for (let index = 0; index < 360; index++) camera.update(1 / 60);
  assert.ok(Math.abs(camera.x) < 0.001);
  assert.ok(Math.abs(camera.y) < 0.001);
  assert.ok(camera.zoom < 0.001);
});
