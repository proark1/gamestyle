import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleRodPose } from './rod-pose';

void test('charge and tension increase bend without exceeding its limit', () => {
  const idle = sampleRodPose({ timeSeconds: 0 });
  const charged = sampleRodPose({ charge: 1, timeSeconds: 0 });
  const loaded = sampleRodPose({
    state: 'hooked',
    tension: 2,
    reeling: true,
    timeSeconds: 1,
  });
  assert.ok(charged.bend > idle.bend);
  assert.ok(loaded.bend > charged.bend);
  assert.ok(loaded.bend <= 1.18);
  assert.ok(loaded.reel > 0);
});

void test('bite pose adds a visible but bounded tip response', () => {
  const pose = sampleRodPose({ state: 'biting', timeSeconds: 0.1 });
  assert.ok(pose.twitch > 0);
  assert.ok(pose.twitch <= 0.12);
});
