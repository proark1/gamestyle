import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.REEL3_LOOKDEV_URL ?? 'http://127.0.0.1:4182';
const output = path.resolve('.tmp/reel-problems-3-lookdev');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function stubPlatform(context) {
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
}

async function checkDesktop() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await stubPlatform(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${base}/reel-problems-3/lookdev`, {
    waitUntil: 'networkidle',
  });
  await page.locator('[data-lookdev-canvas="true"]').waitFor();
  await page.getByText('Handmade storybook', { exact: true }).first().waitFor();
  await page.waitForTimeout(1_000);
  await page.screenshot({
    path: path.join(output, 'a-storybook.png'),
    fullPage: true,
  });

  await page.keyboard.press('KeyE');
  await page.getByText('BEACON AWAKE').waitFor();
  await page.screenshot({
    path: path.join(output, 'a-storybook-lit.png'),
    fullPage: true,
  });

  const canvas = page.locator('[data-lookdev-canvas="true"]');
  await canvas.click({ position: { x: 900, y: 650 } });
  await page.mouse.move(720, 450);
  await page.mouse.move(1_110, 610, { steps: 12 });
  await page.mouse.move(1_300, 790, { steps: 8 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(output, 'a-storybook-water.png'),
    fullPage: true,
  });
  await page.waitForTimeout(650);
  await page.screenshot({
    path: path.join(output, 'a-storybook-water-later.png'),
    fullPage: true,
  });
  await page.evaluate(() => document.exitPointerLock?.());
  await page.waitForTimeout(100);

  await page.keyboard.press('Digit2');
  await page.locator('main[data-look="stormlight"]').waitFor();
  await page.getByText('BEACON AWAKE').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(output, 'b-stormlight.png'),
    fullPage: true,
  });

  await page.keyboard.press('Digit3');
  await page.locator('main[data-look="graphic"]').waitFor();
  await page.getByText('BEACON AWAKE').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(output, 'c-graphic.png'),
    fullPage: true,
  });

  await page.keyboard.press('Digit4');
  await page.locator('main[data-look="comic-adventure"]').waitFor();
  await page.getByText('BEACON AWAKE').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(output, 'd-comic-adventure.png'),
    fullPage: true,
  });

  await page.keyboard.press('Digit5');
  await page.locator('main[data-look="comic-noir"]').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(output, 'e-comic-noir.png'),
    fullPage: true,
  });

  await page.keyboard.press('Digit6');
  await page.locator('main[data-look="comic-sketch"]').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(output, 'f-comic-sketch.png'),
    fullPage: true,
  });

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => document.exitPointerLock?.());
  await page.getByRole('button', { name: /Review/ }).click();
  await page.getByText('Materials', { exact: true }).waitFor();
  const overflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) >
      innerWidth + 1,
  );
  if (overflow) errors.push('desktop horizontal overflow');
  if (errors.length) throw new Error(errors.join('\n'));
  await context.close();
}

async function checkMobile() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await stubPlatform(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${base}/reel-problems-3/lookdev`, {
    waitUntil: 'networkidle',
  });
  await page.locator('[data-lookdev-canvas="true"]').waitFor();
  await page.waitForTimeout(700);
  await page
    .getByRole('button', { name: 'Move forward' })
    .dispatchEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
    });
  await page.waitForTimeout(200);
  await page
    .getByRole('button', { name: 'Move forward' })
    .dispatchEvent('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
    });
  await page.getByRole('button', { name: /USE/ }).click();
  await page.getByText('BEACON AWAKE').waitFor();
  await page.getByRole('button', { name: /2/ }).click();
  await page.locator('main[data-look="stormlight"]').waitFor();
  await page.locator('.rp3-lookdev-tabs button').nth(3).click();
  await page.locator('main[data-look="comic-adventure"]').waitFor();
  await page.screenshot({
    path: path.join(output, 'mobile-comic-adventure.png'),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) >
      innerWidth + 1,
  );
  if (overflow) errors.push('mobile horizontal overflow');
  if (errors.length) throw new Error(errors.join('\n'));
  await context.close();
}

try {
  await checkDesktop();
  console.log('desktop lookdev passed');
  await checkMobile();
  console.log('mobile lookdev passed');
} finally {
  await browser.close();
}
