import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PIXEL_RATIO_CAP,
  REDUCED_MOTION_QUERY,
  TOUCH_QUERY,
  isTouchDevice,
  mediaMatches,
  prefersReducedMotion,
  renderQuality,
} from './device';

const withWindow = (
  matchMedia: ((query: string) => { matches: boolean }) | 'throws' | undefined,
  devicePixelRatio: number,
  body: () => void,
) => {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    devicePixelRatio,
    matchMedia:
      matchMedia === 'throws'
        ? () => {
            throw new Error('unsupported query');
          }
        : matchMedia,
  };
  try {
    body();
  } finally {
    (globalThis as { window?: unknown }).window = previous;
  }
};

void test('a missing window, or one that rejects the query, reports no match', () => {
  assert.equal(mediaMatches(TOUCH_QUERY), false);
  withWindow(undefined, 1, () => {
    assert.equal(mediaMatches(TOUCH_QUERY), false);
  });
  withWindow('throws', 1, () => {
    assert.equal(mediaMatches(TOUCH_QUERY), false);
    assert.equal(isTouchDevice(), false);
    assert.equal(prefersReducedMotion(), false);
  });
});

void test('the queries are read from the window', () => {
  const asked: string[] = [];
  withWindow(
    (query) => {
      asked.push(query);
      return { matches: query === TOUCH_QUERY };
    },
    2,
    () => {
      assert.equal(isTouchDevice(), true);
      assert.equal(prefersReducedMotion(), false);
    },
  );
  assert.deepEqual(asked, [TOUCH_QUERY, REDUCED_MOTION_QUERY]);
});

void test('a phone renders at the touch ceiling, not its own ratio', () => {
  // The whole point of the cap: a 3x handset would otherwise draw nine times
  // the pixels of a 1x display.
  const quality = renderQuality('standard', true, 3);
  assert.equal(quality.pixelRatio, PIXEL_RATIO_CAP.standard.touch);
  assert.equal(quality.touch, true);
  assert.equal(quality.antialias, false);
  assert.equal(quality.shadowMapSize, 1024);
});

void test('a desktop gets the desktop ceiling and the full treatment', () => {
  const quality = renderQuality('standard', false, 2);
  assert.equal(quality.pixelRatio, PIXEL_RATIO_CAP.standard.desktop);
  assert.equal(quality.touch, false);
  assert.equal(quality.antialias, true);
  assert.equal(quality.shadowMapSize, 2048);
});

void test('a heavy scene buys headroom by dropping resolution first', () => {
  for (const touch of [true, false]) {
    const standard = renderQuality('standard', touch, 4);
    const heavy = renderQuality('heavy', touch, 4);
    assert.ok(
      heavy.pixelRatio < standard.pixelRatio,
      `heavy should draw fewer pixels on ${touch ? 'touch' : 'desktop'}`,
    );
    // It gives up resolution, not shadows or antialiasing.
    assert.equal(heavy.antialias, standard.antialias);
    assert.equal(heavy.shadowMapSize, standard.shadowMapSize);
  }
});

void test('a device below 1x, or reporting nothing, still renders at 1x', () => {
  assert.equal(renderQuality('standard', false, 0.5).pixelRatio, 1);
  assert.equal(renderQuality('standard', false, 0).pixelRatio, 1);
  assert.equal(renderQuality('standard', false, Number.NaN).pixelRatio, 1);
});

void test('a ratio under the cap is used as it is', () => {
  assert.equal(renderQuality('standard', false, 1.25).pixelRatio, 1.25);
  assert.equal(renderQuality('standard', true, 1.1).pixelRatio, 1.1);
});

void test('touch never costs more than desktop', () => {
  for (const weight of ['standard', 'heavy'] as const)
    assert.ok(
      PIXEL_RATIO_CAP[weight].touch < PIXEL_RATIO_CAP[weight].desktop,
      weight,
    );
});

void test('the tier is read from the window when not given', () => {
  withWindow(
    (query) => ({ matches: query === TOUCH_QUERY }),
    3,
    () => {
      assert.equal(renderQuality().pixelRatio, PIXEL_RATIO_CAP.standard.touch);
    },
  );
  withWindow(
    () => ({ matches: false }),
    3,
    () => {
      assert.equal(
        renderQuality().pixelRatio,
        PIXEL_RATIO_CAP.standard.desktop,
      );
    },
  );
});
