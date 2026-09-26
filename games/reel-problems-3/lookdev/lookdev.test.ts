import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ISLAND_BOUNDS,
  movePose,
  START_POSE,
  summarizeFrames,
} from './controller';
import { LOOK_STYLES, LOOK_STYLE_IDS, styleFromShortcut } from './styles';
import { fishGlowFromDepth, waterDensity, waterMotion } from './water';

void test('all look presets define complete, distinct rendering treatments', () => {
  assert.deepEqual(LOOK_STYLE_IDS, ['storybook', 'stormlight', 'graphic']);
  for (const id of LOOK_STYLE_IDS) {
    const style = LOOK_STYLES[id];
    assert.equal(style.id, id);
    assert.ok(style.label.length > 5);
    assert.ok(style.palette.sea !== style.palette.rock);
    assert.ok(style.sunIntensity > 0);
    assert.ok(style.waterSpeed > 0);
  }
  assert.notEqual(
    LOOK_STYLES.storybook.fogDensity,
    LOOK_STYLES.stormlight.fogDensity,
  );
  assert.notEqual(LOOK_STYLES.stormlight.rain, LOOK_STYLES.graphic.rain);
  assert.notEqual(
    LOOK_STYLES.graphic.edgeStrength,
    LOOK_STYLES.storybook.edgeStrength,
  );
});

void test('number shortcuts select styles without ambiguous fallthrough', () => {
  assert.equal(styleFromShortcut('Digit1'), 'storybook');
  assert.equal(styleFromShortcut('Numpad2'), 'stormlight');
  assert.equal(styleFromShortcut('Digit3'), 'graphic');
  assert.equal(styleFromShortcut('KeyA'), null);
});

void test('first-person movement is heading-relative and remains bounded', () => {
  const forward = movePose(
    START_POSE,
    { forward: 1, strafe: 0, sprint: false },
    1,
  );
  assert.ok(forward.z < START_POSE.z);
  let pose = START_POSE;
  for (let i = 0; i < 2_000; i++)
    pose = movePose(pose, { forward: -1, strafe: 1, sprint: true }, 0.08);
  assert.equal(pose.x, ISLAND_BOUNDS.maxX);
  assert.equal(pose.z, ISLAND_BOUNDS.maxZ);
});

void test('performance summaries are stable and ignore negative samples', () => {
  assert.deepEqual(summarizeFrames([]), { fps: 0, frameMs: 0 });
  assert.deepEqual(summarizeFrames([16, 17, 17]), { fps: 60, frameMs: 16.7 });
  assert.deepEqual(summarizeFrames([-10, 20]), { fps: 100, frameMs: 10 });
});

void test('sculpted water scales density and reduced motion without losing depth', () => {
  const desktop = waterDensity(false);
  const touch = waterDensity(true);
  assert.ok(desktop.surfaceSegments > touch.surfaceSegments);
  assert.ok(desktop.shorelineSegments > touch.shorelineSegments);
  assert.ok(desktop.contactFoam > touch.contactFoam);

  for (const id of LOOK_STYLE_IDS) {
    const normal = waterMotion(id, false);
    const reduced = waterMotion(id, true);
    assert.ok(normal.amplitude > 0);
    assert.ok(normal.speed > 0);
    assert.ok(reduced.amplitude > 0);
    assert.ok(reduced.amplitude < normal.amplitude);
    assert.ok(reduced.speed < normal.speed);
  }
});

void test('fish glow is bounded and fades with depth', () => {
  assert.equal(fishGlowFromDepth(-2), 1);
  assert.ok(fishGlowFromDepth(1) > fishGlowFromDepth(3));
  assert.equal(fishGlowFromDepth(20), 0);
});
