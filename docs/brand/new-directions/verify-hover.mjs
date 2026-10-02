import { chromium } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] ?? 'http://localhost:5175/';
const label = url.includes('jumbleyard.com') ? 'production' : 'live';
const browser = await chromium.launch({ headless: true });
for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const face = page.locator('.collection-brand-face');
  await face.waitFor();
  await face.locator('img').first().evaluate((image) => image.decode());
  await page.screenshot({ path: resolve(output, `host-${label}-${name}.png`) });
  await face.hover();
  await page.waitForTimeout(220);
  const opacity = await page.locator('.collection-brand-face-wink').evaluate(
    (image) => Number(getComputedStyle(image).opacity),
  );
  if (opacity < 0.99) throw new Error(`${name}: wink did not become visible (${opacity})`);
  await page.screenshot({ path: resolve(output, `host-${label}-${name}-wink.png`) });
  console.log(`${name}: hover expression visible`);
  await page.close();
}
await browser.close();
