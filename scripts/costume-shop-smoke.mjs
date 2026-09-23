import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const server = await createServer({
  configFile: false,
  plugins: [react()],
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'],
  },
  server: { host: '127.0.0.1', port: 5198, strictPort: true, watch: null },
  appType: 'custom',
});
server.middlewares.use('/costume-shop', async (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(
    await server.transformIndexHtml(
      '/costume-shop',
      `<html><head><style>
  *{box-sizing:border-box}body{margin:0;background:#fff8e8;color:#294a43;font:16px system-ui}button{font:inherit;cursor:pointer}:root{--sat:0px;--sab:0px}
  </style></head><body><div id="root"></div><script type="module">
  import React from 'react';import{createRoot}from'react-dom/client';
  import WardrobeView from '/shared/wardrobe/WardrobeView.tsx';
  createRoot(document.getElementById('root')).render(React.createElement(WardrobeView,{embedded:true,initialSlot:'costume'}));
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
    viewport: { width: 1400, height: 930 },
  });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5198/costume-shop');
  await expect(page.locator('.wardrobe-item-card')).toHaveCount(10);
  await expect(page.locator('.wardrobe-costume-bundle')).toHaveCount(2);
  await expect(page.locator('.wardrobe-costume-bundle').first()).toContainText(
    'Original costumes · $4.99',
  );
  await expect(page.locator('.wardrobe-costume-bundle').last()).toContainText(
    'Full mascot suits · $4.99',
  );
  for (const name of [
    'Mossweaver',
    'Thunder Hen',
    'Kite Knight',
    'Comet Diver',
    'Puddle Dragon',
    'Cluck Cloud',
    'Patchwork Moo',
    'Wobble Cone',
    'Steam Bun',
    'Nimbus Nib',
  ]) {
    const card = page.locator('.wardrobe-item-card').filter({
      has: page.getByRole('button', { name: 'Inspect ' + name, exact: true }),
    });
    await expect(card.locator('img')).toHaveAttribute('src', /^data:image/);
    await expect(card).toContainText('Exclusive · soon');
    await card.getByRole('button', { name: 'Try on', exact: true }).click();
    await expect(card).toHaveAttribute('data-fitted', 'true');
    await card
      .getByRole('button', { name: 'Undo try-on', exact: true })
      .click();
  }
  await page
    .getByRole('button', { name: 'Try on', exact: true })
    .first()
    .click();
  mkdirSync('docs/costume-qa', { recursive: true });
  await page.screenshot({ path: 'docs/costume-qa/shop.png' });
  const mascot = page.locator('.wardrobe-item-card').filter({
    has: page.getByRole('button', { name: 'Inspect Cluck Cloud', exact: true }),
  });
  await mascot.getByRole('button', { name: 'Try on', exact: true }).click();
  mkdirSync('docs/mascot-qa', { recursive: true });
  await page.screenshot({ path: 'docs/mascot-qa/shop.png' });
  for (const pose of ['Walk', 'Wave', 'Hero']) {
    const button = page.getByRole('button', { name: pose, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await page.screenshot({ path: 'docs/mascot-qa/hero.png' });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  mobile.setDefaultTimeout(60000);
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto('http://127.0.0.1:5198/costume-shop');
  await expect(mobile.locator('.wardrobe-item-card')).toHaveCount(10);
  const mobileMascot = mobile.locator('.wardrobe-item-card').filter({
    has: mobile.getByRole('button', {
      name: 'Inspect Cluck Cloud',
      exact: true,
    }),
  });
  await mobileMascot
    .getByRole('button', { name: 'Try on', exact: true })
    .click();
  await expect(mobileMascot).toHaveAttribute('data-fitted', 'true');
  await mobile.screenshot({ path: 'docs/mascot-qa/mobile.png' });
  expect(errors).toEqual([]);
  console.log('Ten premium costume cards, thumbnails and try-ons verified.');
} finally {
  await browser?.close();
  await server.close();
}
