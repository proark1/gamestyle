import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const origin = process.env.CASTLE_TEST_URL ?? 'http://127.0.0.1:4173';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Use a local preview.');
mkdirSync('.tmp/castle', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      hasTouch: mobile,
      isMobile: mobile,
      locale: 'en-US',
    });
    const page = await context.newPage(),
      errors = [],
      failed = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && new URL(r.url()).origin === origin)
        failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    await page.goto(`${origin}/bouncy-castle-royale`, {
      waitUntil: 'networkidle',
      timeout: 120000,
    });
    await page
      .getByRole('button', { name: /let.s bounce/i })
      .waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: /let.s bounce/i }).click();
    await page.waitForTimeout(2400);
    await page.getByRole('button', { name: 'Walls ↑', exact: true }).click();
    await page.waitForTimeout(400);
    assert.equal(
      await page
        .getByRole('button', { name: 'Walls ↑', exact: true })
        .getAttribute('aria-pressed'),
      'true',
    );
    if (mobile) {
      const stick = page.getByRole('button', { name: /movement joystick/i });
      assert.ok(await stick.isVisible());
      await page.getByRole('button', { name: 'VOLLEY', exact: true }).click();
      const brace = page.getByRole('button', { name: 'BRACE', exact: true });
      const rect = await brace.boundingBox();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.up();
    } else {
      await page.locator('.castle-canvas canvas').focus();
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(300);
      await page.keyboard.up('KeyD');
      await page.keyboard.press('Space');
      await page.keyboard.press('KeyF');
    }
    await page
      .getByRole('button', { name: 'How to play', exact: true })
      .click();
    assert.ok(await page.getByRole('dialog').isVisible());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false, 'No horizontal overflow');
    const path = `.tmp/castle/${mobile ? 'mobile' : 'desktop'}.png`;
    await page.screenshot({ path });
    if (!mobile) {
      const hiddenChrome =
        process.env.CASTLE_CAPTURE_CARD === '1'
          ? await page.addStyleTag({
              content:
                '.castle-game > :not(.castle-canvas) { visibility: hidden !important; }',
            })
          : null;
      const court = await page
        .locator('.castle-canvas')
        .screenshot({ path: '.tmp/castle/court.png' });
      if (process.env.CASTLE_CAPTURE_CARD === '1')
        await sharp(court)
          .resize(960, 640, { fit: 'contain', background: '#d7dfc5' })
          .webp({ quality: 85 })
          .toFile('public/images/party-gameplay/bouncy-castle-royale.webp');
      await hiddenChrome?.evaluate((style) => style.remove());
    }
    const diagnostics = await page
      .locator('canvas[data-performance]')
      .evaluate((canvas) => JSON.parse(canvas.dataset.performance));
    results.push({ mobile, errors, failed, diagnostics, screenshot: path });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    '.tmp/castle/browser-results.json',
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
}
