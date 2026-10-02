import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { handlePeerRoom } from '../shared/peer/coordinator.ts';

// Exercise the actual game UI and WebRTC transport with an isolated coordinator.
const rows = new Map();
const store = {
  get: async (code) => (rows.has(code) ? { ...rows.get(code) } : null),
  insert: async (row) => {
    if (rows.has(row.code)) return false;
    rows.set(row.code, { ...row });
    return true;
  },
  compareAndSwap: async (row, version) => {
    if (rows.get(row.code)?.version !== version) return false;
    rows.set(row.code, { ...row });
    return true;
  },
};
const origin = process.env.SMOKE_URL ?? 'http://127.0.0.1:5187';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Browser smoke tests require a local build.');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-features=WebRtcHideLocalIpsWithMdns',
  ],
});
const errors = [];
const pages = [];
async function player(mobile = false) {
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname === '/api/peer') {
      try {
        const reply = await handlePeerRoom(store, request.postDataJSON());
        if (reply.view) reply.view.iceServers = [];
        await route.fulfill({ json: reply });
      } catch (error) {
        console.log('Coordinator:', request.postDataJSON().op, error.message);
        await route.fulfill({
          status: error.status ?? 500,
          json: { error: error.message },
        });
      }
    } else if (new URL(request.url()).origin === origin) await route.continue();
    else await route.abort();
  });
  const page = await context.newPage();
  pages.push(page);
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}
try {
  const host = await player();
  await host.goto(`${origin}/bungee-doubles`);
  await host.getByRole('button', { name: 'Multiplayer', exact: true }).click();
  await host.getByLabel('Your name').fill('Host');
  await host.getByRole('button', { name: 'Create room', exact: true }).click();
  await host.waitForURL(/room=/);
  const code = new URL(host.url()).searchParams.get('room');
  console.log('Created room');
  assert.match(code, /^[A-Z0-9]{6}$/);
  const guest = await player(true);
  await guest.goto(`${origin}/bungee-doubles?room=${code}`);
  await guest.getByLabel('Your name').fill('Guest');
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  console.log('Submitted guest join');
  await guest
    .getByRole('button', { name: `${code} · 2/4`, exact: true })
    .waitFor();
  await host
    .getByRole('button', { name: `${code} · 2/4`, exact: true })
    .waitFor();
  await guest.reload();
  await guest
    .getByRole('button', { name: `${code} · 2/4`, exact: true })
    .waitFor();
  await guest
    .getByRole('button', { name: `${code} · 2/4`, exact: true })
    .click();
  await guest
    .getByRole('button', { name: 'Leave room · Play solo', exact: true })
    .click();
  await guest
    .getByRole('button', { name: 'Multiplayer', exact: true })
    .waitFor();
  assert.equal(new URL(guest.url()).searchParams.has('room'), false);
  await host
    .getByRole('button', { name: `${code} · 1/4`, exact: true })
    .waitFor();
  await guest.getByRole('button', { name: 'Multiplayer', exact: true }).click();
  await guest.getByLabel('Room code', { exact: true }).fill('ZZZZZZ');
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await guest.getByRole('dialog').locator('output').waitFor();
  assert.equal(
    await guest
      .getByRole('button', { name: 'Join room', exact: true })
      .isEnabled(),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    'Desktop/mobile: create, invite join, two-player roster, reload reconnect, leave to solo, NPC refill and invalid-room recovery passed.',
  );
} catch (error) {
  console.log('Browser errors:', errors);
  for (const page of pages)
    console.log((await page.locator('body').innerText()).slice(-3500));
  throw error;
} finally {
  await browser.close();
}
