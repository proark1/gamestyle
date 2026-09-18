import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { renderQuality } from '../browser/device';
import { rendererSettings } from './create-renderer';

const sources = readdirSync('games', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) =>
    readdirSync(`games/${entry.name}`, { recursive: true })
      .map(
        (file) => `games/${entry.name}/${String(file).split('\\').join('/')}`,
      )
      .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.')),
  )
  .map((file) => [file, readFileSync(file, 'utf8')] as const);

void test('no game builds its own renderer', () => {
  // Nineteen scenes used to, and had drifted to twelve different pixel-ratio
  // caps with only five reducing anything on a phone.
  for (const [file, source] of sources)
    assert.ok(
      !/new (T|THREE)\.WebGLRenderer\b/.test(source),
      `${file} builds a renderer directly instead of calling createRenderer`,
    );
});

void test('no game sets its own pixel-ratio ceiling', () => {
  for (const [file, source] of sources)
    assert.ok(
      !/setPixelRatio\(\s*Math\.min\(/.test(source),
      `${file} caps the pixel ratio itself; the tier in shared/browser/device.ts decides`,
    );
});

void test('no game spells out a device media query', () => {
  // Six different spellings of "is this a touch device" used to coexist.
  for (const [file, source] of sources) {
    assert.ok(
      !/pointer:\s*coarse/.test(source),
      `${file} writes its own touch query; import TOUCH_QUERY instead`,
    );
    assert.ok(
      !/prefers-reduced-motion/.test(source),
      `${file} writes its own reduced-motion query; import REDUCED_MOTION_QUERY instead`,
    );
  }
});

void test('the options map to the settings the renderer is given', () => {
  const quality = renderQuality('standard', false, 2);
  assert.deepEqual(rendererSettings({ quality }), {
    antialias: true,
    pixelRatio: quality.pixelRatio,
    shadows: true,
    exposure: undefined,
    focusable: true,
  });
  assert.deepEqual(
    rendererSettings({ quality, shadows: 'off', exposure: 1.3 }),
    {
      antialias: true,
      pixelRatio: quality.pixelRatio,
      shadows: false,
      exposure: 1.3,
      focusable: true,
    },
  );
  assert.equal(
    rendererSettings({ quality, shadows: 'hard' }).shadows,
    true,
    'hard shadows are still shadows',
  );
  assert.equal(
    rendererSettings({ quality, focusable: false }).focusable,
    false,
    'a scene that reads keys elsewhere keeps the canvas out of the tab order',
  );
});

void test('a touch device drops antialiasing without being asked', () => {
  const touch = rendererSettings({
    quality: renderQuality('standard', true, 3),
  });
  const desktop = rendererSettings({
    quality: renderQuality('standard', false, 3),
  });
  assert.equal(touch.antialias, false);
  assert.equal(desktop.antialias, true);
  assert.ok(touch.pixelRatio < desktop.pixelRatio);
});
