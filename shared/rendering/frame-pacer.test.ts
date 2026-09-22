import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FramePacer } from './frame-pacer';
void test('frame pacing retains fractional deadlines across supported display rates', () => {
  for (const hz of [30, 60, 90, 120, 144, 165])
    for (const fps of [30, 60, 120]) {
      const pacer = new FramePacer();
      let drawn = 0;
      for (let i = 1; i <= hz * 10; i++) {
        const stamp = (i * 1000) / hz;
        const due = pacer.due(stamp, fps);
        assert.equal(
          pacer.due(stamp, fps),
          due,
          'multipass uses the same decision',
        );
        if (due) drawn++;
      }
      assert.ok(
        Math.abs(drawn / 10 - Math.min(fps, hz)) < 0.2,
        `${hz}/${fps}: ${drawn}`,
      );
    }
});
void test('120 FPS preference on a 60 Hz display does not imply overload', () => {
  const pacer = new FramePacer();
  for (let i = 1; i < 600; i++) pacer.due((i * 1000) / 60, 120);
  assert.ok(pacer.qualityGap(1000 / 60, 120) < 18);
  assert.ok(pacer.qualityGap(50, 120) > 23, 'real stalls remain visible');
  pacer.reset();
  assert.equal(pacer.due(50000, 60), true);
});

void test('resuming after a scheduler stall admits one frame without a catch-up burst', () => {
  const pacer = new FramePacer();
  pacer.due(100, 60);
  assert.equal(pacer.due(5000, 60), true);
  assert.equal(pacer.due(5001, 60), false);
  assert.equal(pacer.due(5002, 60), false);
  assert.equal(pacer.due(5017, 60), true);
});
