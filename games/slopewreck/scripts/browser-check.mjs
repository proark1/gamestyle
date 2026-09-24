import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const origin = process.env.SLOPEWRECK_TEST_URL ?? 'http://localhost:4191';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Use a local preview.');
mkdirSync('.tmp/slopewreck', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      hasTouch: mobile,
      isMobile: mobile,
      locale: 'en-US',
    });
    const page = await context.newPage();
    const errors = [],
      failed = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && new URL(r.url()).origin === origin)
        failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    await page.goto(`${origin}/slopewreck`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    const start = page.getByRole('button', { name: /start the race/i });
    await start.waitFor({ timeout: 60_000 });
    assert.ok(await page.locator('.slopewreck-canvas canvas').isVisible());
    await start.click();
    await page.getByText('LAND A TRICK. CHANGE THE COURSE.').waitFor();
    if (mobile) {
      await page.getByRole('button', { name: /jump/i }).click();
      await page.getByRole('button', { name: 'RAMP', exact: true }).click();
    } else {
      await page.locator('.slopewreck-canvas canvas').focus();
      await page.keyboard.down('KeyW');
      await page.keyboard.press('Space');
      await page.waitForTimeout(130);
      await page.keyboard.press('KeyQ');
      await page.waitForTimeout(1000);
      await page.keyboard.up('KeyW');
    }
    await page.waitForTimeout(1000);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      'No horizontal overflow',
    );
    const path = `.tmp/slopewreck/${mobile ? 'mobile' : 'desktop'}.png`;
    await page.screenshot({ path });
    assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
    assert.deepEqual(failed, [], `Failed requests: ${failed.join('; ')}`);
    console.log(`${mobile ? 'Mobile' : 'Desktop'} race passed: ${path}`);
    await context.close();
  }
} finally {
  await browser.close();
}
