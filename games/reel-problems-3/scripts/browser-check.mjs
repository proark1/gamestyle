import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const origin = process.env.REEL3_TEST_URL ?? 'http://localhost:4177';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Use a local Reel Problems 3 preview.');

mkdirSync('.tmp/reel-problems-3', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  for (const mobile of [false, true]) {
    const label = mobile ? 'mobile' : 'desktop';
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      hasTouch: mobile,
      isMobile: mobile,
      locale: 'en-US',
    });
    await context.route('**/api/analytics', (route) =>
      route.fulfill({ status: 204 }),
    );
    await context.route('**/api/account/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          account: null,
          methods: { google: false, email: false },
        }),
      }),
    );
    const page = await context.newPage();
    const errors = [];
    const failed = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && new URL(response.url()).origin === origin)
        failed.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    await page.goto(`${origin}/reel-problems-3`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await page
      .getByRole('heading', { name: /catch together.*score alone/i })
      .waitFor({ timeout: 60_000 });
    await page.screenshot({ path: `.tmp/reel-problems-3/${label}-menu.png` });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${label}: no horizontal overflow on menu`,
    );
    await page.getByRole('button', { name: /start with bots/i }).click();
    await page.getByText(/load rods, bait, safety gear/i).waitFor();
    await page.locator('.rp3-contracts').waitFor();
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: `.tmp/reel-problems-3/${label}-harbor.png` });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${label}: no horizontal overflow in play`,
    );
    assert.ok(
      await page.locator('.rp3-stage canvas').isVisible(),
      `${label}: WebGL canvas is visible`,
    );
    assert.equal(
      await page.locator('.rp3-crew > div').count(),
      4,
      `${label}: one human and three bots are visible`,
    );
    assert.deepEqual(
      errors,
      [],
      `${label}: browser errors: ${errors.join('; ')}`,
    );
    assert.deepEqual(
      failed,
      [],
      `${label}: failed requests: ${failed.join('; ')}`,
    );
    console.log(`${label} Reel Problems 3 passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
