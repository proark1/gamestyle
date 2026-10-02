import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1470, height: 850 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve('docs/brand/identity/color-study.html')).href);
await page.screenshot({ path: 'docs/brand/identity/color-study.png', fullPage: true });
await page.goto(pathToFileURL(resolve('docs/brand/identity/identity.html')).href);
await page.screenshot({ path: 'docs/brand/identity/identity.png', fullPage: true });
await browser.close();
