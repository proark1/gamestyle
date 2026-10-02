import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve('docs/brand/new-directions/compare.html')).href);
await page.screenshot({ path: 'docs/brand/new-directions/compare.png', fullPage: true });
await page.setViewportSize({ width: 1100, height: 830 });
await page.goto(pathToFileURL(resolve('docs/brand/new-directions/host-selected.html')).href);
await page.screenshot({ path: 'docs/brand/new-directions/host-selected.png', fullPage: true });
await browser.close();
