import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const folder = 'docs/brand/identity/four-player/stronger';
const silhouette = 'M487 201C589 199 682 250 731 337c39 69 64 147 86 212 53-32 84-106 103-203 12-60 46-91 94-91 54 0 99 43 99 97 0 87-54 155-132 215-55 42-117 81-153 125-31 38-39 100-72 170-71 149-189 245-333 245-142 0-245-85-245-184 0-100 86-201 178-207 65-4 118 42 118 98 0 46-33 77-82 85-26 5-33 26-26 49 8 25 39 36 66 30 45-9 104-62 153-145 51-87 76-166 76-262 0-104-45-166-133-214-52-28-100-40-117-77-21-47 14-84 76-84Z';

const palettes = [
  { file: '01-sunlit.svg', blue: '#2469C2', teal: '#079CA0', red: '#E54E43', yellow: '#F1B02A' },
  { file: '02-arcade.svg', blue: '#504CE0', teal: '#05A8BF', red: '#EF405A', yellow: '#F6C42A' },
  { file: '03-poster.svg', blue: '#145F9B', teal: '#07827E', red: '#D5413D', yellow: '#DFA01C' },
];

for (const p of palettes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="145 170 1000 970" role="img" aria-label="Four-color Jumbleyard gesture">
  <defs><clipPath id="mark"><path d="${silhouette}"/></clipPath></defs>
  <g clip-path="url(#mark)">
    <rect x="145" y="170" width="1000" height="970" fill="${p.blue}"/>
    <path d="M145 170H756C779 288 804 421 846 560L857 596H145Z" fill="${p.yellow}"/>
    <path d="M870 170H1145V690H876L812 550C844 452 863 307 870 170Z" fill="${p.red}"/>
    <path d="M145 688C310 684 455 725 565 807c82 62 141 167 183 333H145Z" fill="${p.teal}"/>
  </g>
</svg>`;
  await writeFile(`${folder}/${p.file}`, svg);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 830 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(`${folder}/compare.html`)).href);
await page.screenshot({ path: `${folder}/compare.png`, fullPage: true });
await page.setViewportSize({ width: 900, height: 900 });
await page.goto(pathToFileURL(resolve(`${folder}/01-sunlit.svg`)).href);
await page.screenshot({ path: `${folder}/mark-zoom.png` });
await browser.close();
