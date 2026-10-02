import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve('docs/brand/identity/four-player/compare.html')).href);
await page.screenshot({ path: 'docs/brand/identity/four-player/compare.png', fullPage: true });
await browser.close();
