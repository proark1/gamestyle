import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const folder = 'docs/brand/identity/four-player/compact';
const source = await readFile('docs/brand/identity/four-player/stronger/02-arcade.svg', 'utf8');

function compactOriginal(viewBox, scaleX, scaleY) {
  return source
    .replace('viewBox="145 170 1000 970"', `viewBox="${viewBox}"`)
    .replace('<g clip-path="url(#mark)">', `<g transform="translate(645 650) scale(${scaleX} ${scaleY}) translate(-645 -650)"><g clip-path="url(#mark)">`)
    .replace('  </g>\n</svg>', '  </g></g>\n</svg>');
}

await writeFile(`${folder}/01-wide-flow.svg`, compactOriginal('95 265 1100 790', 1.08, 0.84));
await writeFile(`${folder}/02-tight-flow.svg`, compactOriginal('75 295 1140 730', 1.12, 0.75));
await writeFile(`${folder}/03-redrawn.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Compact four-color Jumbleyard gesture">
  <defs><mask id="mark" maskUnits="userSpaceOnUse">
    <rect width="100" height="100" fill="#000"/>
    <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
      <path d="M25 25C40 24 48 36 53 51" stroke-width="18"/>
      <path d="M79 25C76 39 64 48 53 51" stroke-width="18"/>
      <path d="M53 51C57 65 48 79 35 83C22 87 16 79 23 68" stroke-width="20"/>
    </g>
  </mask></defs>
  <g mask="url(#mark)">
    <rect width="100" height="100" fill="#504CE0"/>
    <path d="M0 0H56L59 61H0Z" fill="#F6C42A"/>
    <path d="M56 0H100V62H60L53 51Z" fill="#EF405A"/>
    <path d="M0 52H35C48 55 52 71 59 100H0Z" fill="#05A8BF"/>
  </g>
</svg>`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 850 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(`${folder}/compare.html`)).href);
await page.screenshot({ path: `${folder}/compare.png`, fullPage: true });
await page.setViewportSize({ width: 600, height: 600 });
await page.goto(pathToFileURL(resolve(`${folder}/03-redrawn.svg`)).href);
await page.screenshot({ path: `${folder}/redrawn-zoom.png` });
await browser.close();
