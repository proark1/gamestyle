import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const origin = process.env.FLIP_TEST_URL ?? 'http://127.0.0.1:4183';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Use an isolated local preview.');
mkdirSync('.tmp/flip', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
async function pageFor(mobile = false, german = false) {
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
    hasTouch: mobile,
    isMobile: mobile,
    locale: german ? 'de-DE' : 'en-US',
  });
  if (german)
    await context.addInitScript(() =>
      localStorage.setItem('jumbleyard-language-v1', 'de'),
    );
  const page = await context.newPage(),
    errors = [],
    failed = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === origin)
      failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  await page.goto(`${origin}/flip-happens`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await expect(
    page.getByRole('button', {
      name: german ? 'Loswerfen' : 'Start flipping',
      exact: true,
    }),
  ).toBeEnabled({ timeout: 30000 });
  return { page, context, errors, failed };
}
async function hold(page, threshold) {
  const button = page.locator('.flip-throw');
  await expect(button).toBeEnabled();
  const r = await button.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.waitForFunction(
    (t) => Number(document.querySelector('meter')?.value) >= t,
    threshold,
    { timeout: 5000 },
  );
  await page.mouse.up();
}
async function finishCheck(data, label) {
  assert.equal(
    await data.page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    'No horizontal overflow',
  );
  assert.deepEqual(data.errors, [], `${label} browser errors`);
  assert.deepEqual(data.failed, [], `${label} failed requests`);
  results.push({ label, errors: data.errors, failed: data.failed });
  await data.context.close();
}
try {
  const desktop = await pageFor();
  const p = desktop.page;
  await p.screenshot({ path: '.tmp/flip/desktop-lobby.png' });
  await p.getByRole('button', { name: 'Daily flip', exact: true }).click();
  await p.getByRole('button', { name: 'Start flipping', exact: true }).click();
  await hold(p, 54);
  await expect(p.locator('.flip-risk > strong')).toHaveText('+10', {
    timeout: 5000,
  });
  await p.locator('.flip-bank').click();
  await expect(p.locator('.flip-score.is-you b')).toHaveText('10');
  await expect(p.locator('.flip-charge-title strong')).toHaveText('Top hat');
  await p.locator('.flip-canvas canvas').focus();
  await p.keyboard.down('KeyD');
  await p.waitForTimeout(200);
  await p.keyboard.up('KeyD');
  await p.keyboard.down('Space');
  await p.waitForTimeout(1600);
  await p.keyboard.up('Space');
  await expect(p.locator('.flip-callout')).toContainText('COMBO GONE', {
    timeout: 5000,
  });
  await expect(p.locator('.flip-score.is-you b')).toHaveText('10');
  await p.screenshot({ path: '.tmp/flip/desktop-play.png' });
  await p.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(p.getByRole('dialog')).toBeVisible();
  await p.keyboard.press('Escape');
  console.log(
    'Desktop: timed landing, banking, keyboard throw, daily object sequence and help passed.',
  );
  // Keep the daily round active while the separate mobile context is checked.
  const mobile = await pageFor(true, true);
  const m = mobile.page;
  await m.screenshot({ path: '.tmp/flip/mobile-lobby.png' });
  await m.getByRole('button', { name: 'Loswerfen', exact: true }).click();
  await m
    .getByRole('button', { name: 'Waschmaschine · 80 Punkte', exact: true })
    .tap();
  await expect(
    m.getByRole('button', { name: 'Waschmaschine · 80 Punkte', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const canvas = await m.locator('.flip-canvas canvas').boundingBox();
  await m.touchscreen.tap(
    canvas.x + canvas.width * 0.5,
    canvas.y + canvas.height * 0.55,
  );
  // Dispatch genuine touch down/up through CDP for the hold button.
  const touch = await mobile.context.newCDPSession(m),
    b = await m.locator('.flip-throw').boundingBox();
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  await m.waitForFunction(() => document.querySelector('meter')?.value >= 69);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await m.waitForTimeout(1500);
  assert.ok(await m.locator('.flip-callout').isVisible());
  await m.screenshot({ path: '.tmp/flip/mobile-play.png' });
  await finishCheck(mobile, 'German mobile touch');
  console.log(
    'Mobile: German UI, touch aim, object selection and hold/release passed.',
  );
  if (process.env.FLIP_CAPTURE_CARD === '1') {
    const card = await pageFor();
    const c = card.page;
    await c.setViewportSize({ width: 1000, height: 980 });
    await c
      .getByRole('button', { name: 'Start flipping', exact: true })
      .click();
    await c
      .getByRole('button', { name: 'Washing machine · 80 points', exact: true })
      .click();
    await hold(c, 69);
    await c.waitForTimeout(1350);
    await c.addStyleTag({
      content:
        '.flip-game > :not(.flip-canvas) { visibility: hidden !important; }',
    });
    const capture = await c.locator('.flip-canvas').screenshot();
    await sharp(capture)
      .resize(960, 640, { fit: 'cover' })
      .webp({ quality: 88 })
      .toFile('public/images/party-gameplay/flip-happens.webp');
    await finishCheck(card, 'Gameplay card');
  }
  await expect(p.locator('.flip-lobby')).toBeVisible({ timeout: 75000 });
  await expect(p.locator('.flip-lobby h1')).toHaveText('10 points.');
  await expect(p.locator('.flip-daily-note strong')).toContainText('10');
  await p.screenshot({ path: '.tmp/flip/daily-end.png' });
  await p.getByRole('button', { name: 'Flip again', exact: true }).click();
  await expect(p.locator('.flip-score.is-you b')).toHaveText('0');
  await p.reload({ waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Daily flip', exact: true }).click();
  await expect(p.locator('.flip-daily-note strong')).toContainText('10');
  await finishCheck(desktop, 'Desktop daily completion and persisted best');
  writeFileSync(
    '.tmp/flip/browser-results.json',
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
