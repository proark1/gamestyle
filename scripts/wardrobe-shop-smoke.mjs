import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const server = await createServer({
  configFile: false,
  plugins: [react()],
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'],
  },
  server: { host: '127.0.0.1', port: 5197, strictPort: true, watch: null },
  appType: 'custom',
});
server.middlewares.use('/shop-check', async (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(
    await server.transformIndexHtml(
      '/shop-check',
      `<html><head><style>
  *{box-sizing:border-box}body{margin:0;background:#fff8e8;color:#294a43;font:16px system-ui}button{font:inherit;cursor:pointer}:root{--sat:0px;--sab:0px}
  </style></head><body><div id="root"></div><script type="module">
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import WardrobeView from '/shared/wardrobe/WardrobeView.tsx';
  import {ITEMS} from '/shared/wardrobe/catalog.ts';
  import {PLAYFUL_KID_ITEMS} from '/shared/rendering/cosmetics/playful-items.ts';
  window.collection=ITEMS.filter(item=>Object.hasOwn(PLAYFUL_KID_ITEMS,item.id));
  createRoot(document.getElementById('root')).render(React.createElement(WardrobeView,{embedded:true}));
  </script></body></html>`,
    ),
  );
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
  });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  );
  await page.addInitScript(() => {
    if (!localStorage.getItem('jy_wardrobe_v1'))
      localStorage.setItem(
        'jy_wardrobe_v1',
        JSON.stringify({
          look: {},
          coins: 5000,
          unlockedItems: [],
          stats: { gamesPlayed: [], playTimeSeconds: 0 },
        }),
      );
  });
  await page.goto('http://127.0.0.1:5197/shop-check');
  await page.locator('.wardrobe-item-card').first().waitFor();
  const items = await page.evaluate(() => window.collection);
  const expectedLook = {};
  for (const item of items) {
    const card = page.locator('.wardrobe-item-card').filter({
      has: page.getByRole('button', {
        name: 'Inspect ' + item.name,
        exact: true,
      }),
    });
    await expect(card.locator('img')).toHaveAttribute('src', /^data:image/);
    await card.getByRole('button', { name: 'Try on', exact: true }).click();
    await expect(card).toHaveAttribute('data-fitted', 'true');
    await card.getByRole('button', { name: /^Buy/ }).click();
    await card.getByRole('button', { name: 'Equip', exact: true }).click();
    await expect(card).toHaveAttribute('data-equipped', 'true');
    expectedLook[item.slot] = item.id;
  }
  await page.reload();
  await page.locator('.wardrobe-item-card').first().waitFor();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jy_wardrobe_v1')),
  );
  expect(saved.look).toEqual(expectedLook);
  expect(saved.coins).toBe(
    5000 - items.reduce((sum, item) => sum + item.price, 0),
  );
  await page
    .getByRole('button', { name: 'Inspect Moon Glasses', exact: true })
    .click();
  await expect(page.locator('.wardrobe-inspect-name')).toHaveText(
    'Moon Glasses',
  );
  await page.getByRole('button', { name: 'On avatar', exact: true }).click();
  await page.getByRole('button', { name: 'Walk', exact: true }).click();
  await page
    .getByRole('button', { name: 'Turn right 45 degrees', exact: true })
    .click();
  mkdirSync('docs/wardrobe-collection-qa', { recursive: true });
  await page.screenshot({
    path: 'docs/wardrobe-collection-qa/shop-desktop.png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({
    path: 'docs/wardrobe-collection-qa/shop-mobile.png',
  });
  expect(errors).toEqual([]);
  const result = {
    items: items.length,
    purchase: true,
    equip: true,
    reload: true,
    itemPreview: true,
    avatarPreview: true,
    motion: true,
    mobile: true,
    errors,
  };
  writeFileSync(
    'docs/wardrobe-collection-qa/shop-results.json',
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await server.close();
}
