import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.env.SMOKE_URL ?? 'http://127.0.0.1:4175';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw Error('Use an isolated local server.');
const engine = process.env.SMOKE_ENGINE ?? 'chromium';
if (!['chromium', 'webkit'].includes(engine))
  throw Error('SMOKE_ENGINE must be chromium or webkit.');
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true,
  ...(engine === 'chromium'
    ? {
        channel: process.env.SMOKE_BROWSER ?? 'chrome',
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      }
    : {}),
});
const artifactDir = `.tmp/mobile-audit/${engine}`;
mkdirSync(artifactDir, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 320, height: 568 },
  hasTouch: true,
  isMobile: true,
});
await context.route('**/*', (r) => {
  const u = new URL(r.request().url());
  if (u.pathname === '/api/account/session')
    return r.fulfill({
      json: { account: null, methods: { google: true, email: true } },
    });
  return u.origin === origin ? r.continue() : r.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function inBounds(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const v = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(v.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(v.height + 1);
}
async function waitForDraw() {
  const renderedFrames = () =>
    page.locator('canvas[data-performance]').evaluateAll((canvases) =>
      canvases.reduce((total, canvas) => {
        const stats = JSON.parse(canvas.dataset.performance);
        return total + (stats.triangles > 0 ? stats.frames : 0);
      }, 0),
    );
  const before = await renderedFrames();
  // A resize clears WebGL until the next draw; require fresh scene frames.
  await expect.poll(renderedFrames, { timeout: 15000 }).toBeGreaterThan(before);
  // Draw counts alone can pass for a blank scene. Sample the actual framebuffer
  // within an animation frame, before a non-preserved WebGL buffer is cleared.
  await expect
    .poll(
      () =>
        page
          .locator('canvas[data-performance]')
          .first()
          .evaluate(
            (canvas) =>
              new Promise((resolve) => {
                requestAnimationFrame(() => {
                  const gl = canvas.getContext('webgl2');
                  if (!gl || gl.isContextLost()) return resolve(0);
                  const colors = new Set();
                  const pixel = new Uint8Array(4);
                  for (let x = 1; x < 8; x++)
                    for (let y = 1; y < 8; y++) {
                      gl.readPixels(
                        Math.floor((canvas.width * x) / 8),
                        Math.floor((canvas.height * y) / 8),
                        1,
                        1,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        pixel,
                      );
                      if (pixel[3]) colors.add(pixel.join(','));
                    }
                  resolve(colors.size);
                });
              }),
          ),
      { timeout: 15000 },
    )
    .toBeGreaterThan(1);
}
try {
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 90000 });
  for (const width of [320, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await inBounds(page.locator('.collection-header-actions'));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('.account-header-button').tap();
  await inBounds(page.getByRole('dialog'));
  await page
    .getByLabel('Email address', { exact: true })
    .fill('mobile@example.test');
  await page.locator('.account-close').tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.wardrobe-header-button').tap();
  await inBounds(page.locator('.wardrobe-dialog'));
  await inBounds(page.locator('.wardrobe-close'));
  await page
    .locator('.wardrobe-body')
    .evaluate((e) => (e.scrollTop = e.scrollHeight));
  expect(
    await page.locator('.wardrobe-body').evaluate((e) => e.scrollTop),
  ).toBeGreaterThan(0);
  await page.screenshot({
    path: `${artifactDir}/wardrobe-verified.png`,
    timeout: 60000,
  });
  await page.locator('.wardrobe-close').tap();
  await page.locator('.language-header-button').tap();
  await page.getByRole('menuitemradio', { name: /Deutsch/ }).tap();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.locator('.language-header-button').tap();
  await page.getByRole('menuitemradio', { name: /English/ }).tap();
  await page.goto(origin + '/party', {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.screenshot({
    path: `${artifactDir}/party-verified.png`,
    timeout: 60000,
  });
  await page.goto(origin + '/basketball', {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await page.getByRole('button', { name: /Start Match/ }).tap();
  const more = page.getByRole('button', { name: 'More settings', exact: true });
  await inBounds(more);
  await more.tap();
  await inBounds(page.locator('.toolbar-options-panel'));
  await page.locator('.game-graphics-controls summary').tap();
  await page
    .getByRole('combobox', { name: 'Quality', exact: true })
    .selectOption('low');
  await expect(
    page.getByRole('combobox', { name: 'Quality', exact: true }),
  ).toHaveValue('low');
  await inBounds(
    page.getByRole('combobox', { name: 'Frame limit', exact: true }),
  );
  await more.tap();
  await expect(
    page.getByRole('combobox', { name: 'Quality', exact: true }),
  ).toBeHidden();
  await more.tap();
  await page.getByRole('button', { name: 'Your look', exact: true }).tap();
  await inBounds(page.locator('.wardrobe-dialog'));
  await page.locator('.wardrobe-close').tap();
  await more.tap();
  await page.keyboard.press('Escape');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await waitForDraw();
  await page.screenshot({
    path: `${artifactDir}/basketball-verified.png`,
    timeout: 60000,
  });
  await page.goto(origin + '/crane-clash', {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await page.getByRole('button', { name: 'Start Match', exact: true }).tap();
  const stick = page.locator('.cc-touch-ui .joystick');
  await inBounds(stick);
  if (engine === 'chromium') {
    const b = await stick.boundingBox();
    const cdp = await context.newCDPSession(page);
    const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [p],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: p.x + 35, y: p.y }],
    });
    await expect(stick).toHaveAttribute('data-engaged', 'true');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } else {
    // WebKit has no CDP touch-drag API. Verify a native touch press/release;
    // Chromium above separately covers continuous dragging.
    await stick.evaluate((element) => {
      window.addEventListener(
        'pointerup',
        () => {
          element.dataset.testPressed = element.dataset.engaged;
        },
        // Inspect before the component's release handler clears the gesture.
        { once: true, capture: true },
      );
    });
    await stick.tap();
    await expect(stick).toHaveAttribute('data-test-pressed', 'true');
    await stick.evaluate((element) => delete element.dataset.testPressed);
  }
  await expect(stick).toHaveAttribute('data-engaged', 'false');
  await page.getByRole('button', { name: 'Control crane', exact: true }).tap();
  await expect(page.locator('.cc-touch-ui .joystick small')).toHaveText(
    'CRANE',
  );
  await page.setViewportSize({ width: 844, height: 390 });
  for (const el of await page.locator('.cc-touch-ui button').all())
    await inBounds(el);
  await waitForDraw();
  await page.screenshot({
    path: `${artifactDir}/crane-verified.png`,
    timeout: 60000,
  });
  expect(errors).toEqual([]);
  console.log(
    'PASS: home at 320/390/430/768px, sign-in form, wardrobe scroll/close, English/German, party layout, toolbar/settings, graphics preferences, escape dismissal, joystick touch/release, crane mode, landscape controls.',
  );
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await desktop.route('**/*', (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  const desk = await desktop.newPage();
  await desk.goto(origin + '/basketball', {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await expect(
    desk.getByRole('button', { name: 'More settings', exact: true }),
  ).toBeHidden();
  await expect(
    desk.getByRole('button', { name: 'Your look', exact: true }),
  ).toBeVisible();
  await desk.screenshot({
    path: `${artifactDir}/desktop-verified.png`,
    timeout: 60000,
  });
  console.log('PASS: desktop toolbar remains directly accessible.');
  await desktop.close();
} catch (error) {
  console.error({
    url: page.url(),
    errors,
    body: (await page.locator('body').innerText()).slice(0, 1400),
  });
  await page.screenshot({
    path: `${artifactDir}/shared-failure.png`,
    timeout: 60000,
  });
  throw error;
} finally {
  await browser.close();
}
