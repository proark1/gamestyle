import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveQuality } from './adaptive-quality';
void test('quality ignores isolated stalls and suspension, degrades sustained load and recovers slowly', () => {
  const quality = new AdaptiveQuality();
  quality.record(10000);
  for (let i = 0; i < 50; i++) quality.record(16.7);
  assert.equal(quality.level, 0);
  for (let i = 0; i < 100; i++) quality.record(34);
  assert.equal(quality.level, 1);
  for (let i = 0; i < 200; i++) quality.record(16.7);
  assert.equal(quality.level, 1);
  for (let i = 0; i < 1200; i++) quality.record(16.7);
  assert.equal(quality.level, 0);
});
