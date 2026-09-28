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
    const nextStep = page.locator('.rp3-next-step');
    await nextStep.waitFor();
    assert.match(
      await nextStep.innerText(),
      /next step[\s\S]*pick up equipment from the dock[\s\S]*E|USE/i,
      `${label}: the deck order gives one clear actionable next step`,
    );
    assert.equal(
      await page.locator('.rp3-prompt, .rp3-hands').count(),
      0,
      `${label}: legacy competing prompts are removed`,
    );
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
    if (!mobile) {
      const canvas = page.locator('.rp3-stage canvas');
      const canvasBounds = await canvas.boundingBox();
      assert.ok(canvasBounds, `${label}: canvas has interactive bounds`);
      await page.mouse.move(
        canvasBounds.x + canvasBounds.width * 0.5,
        canvasBounds.y + canvasBounds.height * 0.62,
      );
      await page.mouse.down();
      await page.mouse.move(
        canvasBounds.x + canvasBounds.width * 0.56,
        canvasBounds.y + canvasBounds.height * 0.58,
      );
      assert.equal(
        await page
          .locator('.rp3-stage')
          .evaluate((stage) => stage.classList.contains('is-looking')),
        true,
        `${label}: mouse drag activates camera look`,
      );
      await page.mouse.up();
      await page.evaluate(() => document.exitPointerLock?.());
    }
    assert.equal(
      await page.locator('.rp3-crew > div').count(),
      4,
      `${label}: one human and three bots are visible`,
    );
    if (mobile) {
      const guideBounds = await nextStep.boundingBox();
      const actionsBounds = await page
        .locator('.rp3-touch-actions')
        .boundingBox();
      const objectiveBounds = await page
        .locator('.rp3-objective')
        .boundingBox();
      const contractBounds = await page
        .locator('.rp3-contracts article:visible')
        .boundingBox();
      assert.ok(
        guideBounds &&
          actionsBounds &&
          guideBounds.y + guideBounds.height <= actionsBounds.y,
        `${label}: the next-step card stays above touch controls`,
      );
      assert.equal(
        await page.locator('.rp3-contracts article:visible').count(),
        1,
        `${label}: only the active contract uses limited HUD space`,
      );
      assert.ok(
        objectiveBounds &&
          contractBounds &&
          objectiveBounds.y + objectiveBounds.height <= contractBounds.y,
        `${label}: objective and active contract do not overlap`,
      );
      for (const name of ['Jump', 'Brace']) {
        const button = page.getByRole('button', { name });
        assert.equal(
          await button.isVisible(),
          true,
          `${label}: ${name} is visible`,
        );
        const bounds = await button.boundingBox();
        assert.ok(
          bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390,
          `${label}: ${name} stays inside the viewport`,
        );
      }
    }
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
