import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
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
const upstream = process.env.SMOKE_URL ?? 'http://127.0.0.1:5188';
if (!['127.0.0.1', 'localhost'].includes(new URL(upstream).hostname))
  throw new Error('Browser smoke tests require a local build.');
// Other local tasks may rebuild dist during the audit. Freeze this build's
// entry point and chunks together so imports cannot reference removed hashes.
const build = new URL('../dist/native/', import.meta.url);
const assets = new Map([
  ['/index.html', readFileSync(new URL('index.html', build))],
  ...readdirSync(new URL('assets/', build)).map((file) => [
    `/assets/${file}`,
    readFileSync(new URL(`assets/${file}`, build)),
  ]),
]);
// A real HTTP endpoint is necessary for keep-alive requests during navigation.
// Browser request interception can cancel them when their page is destroyed.
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/api/peer') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const reply = await handlePeerRoom(store, JSON.parse(body));
      if (reply.view) reply.view.iceServers = [];
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(reply));
    } else if (!request.url.startsWith('/api/')) {
      const path = new URL(request.url, upstream).pathname;
      const key = assets.has(path)
        ? path
        : !path.split('/').at(-1).includes('.')
          ? '/index.html'
          : null;
      if (key) {
        const mime = key.endsWith('.js')
          ? 'text/javascript'
          : key.endsWith('.css')
            ? 'text/css'
            : key.endsWith('.html')
              ? 'text/html'
              : 'application/octet-stream';
        response.setHeader('Content-Type', mime);
        response.end(assets.get(key));
        return;
      }
      const result = await fetch(new URL(request.url, upstream));
      response.statusCode = result.status;
      response.setHeader(
        'Content-Type',
        result.headers.get('content-type') ?? 'application/octet-stream',
      );
      response.end(Buffer.from(await result.arrayBuffer()));
    } else {
      response.statusCode = 404;
      response.end('{}');
    }
  } catch (error) {
    response.statusCode = error.status ?? 500;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: error.message }));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
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
      : { width: 900, height: 650 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      'jumbleyard:graphics',
      JSON.stringify({ quality: 'low', fps: 30 }),
    );
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  pages.push(page);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) =>
    console.log('Failed request:', request.url(), request.failure()?.errorText),
  );
  return page;
}
const games = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'basketball',
      'carry-on-carnage',
      'chain-of-fools',
      'crane-clash',
      'drive-thru',
      'panic-curling',
      'sample-stampede',
      'scaffold-scramble',
      'zorb-clash',
    ];
try {
  for (const game of games) {
    pages.length = 0;
    const host = await player();
    await host.goto(`${origin}/${game}`);
    await host
      .getByRole('button', { name: 'Multiplayer', exact: true })
      .last()
      .click();
    await host.getByLabel('Your name').fill('Host');
    await host
      .getByRole('button', { name: 'Create room', exact: true })
      .click();
    await host.waitForURL(/room=/);
    const code = new URL(host.url()).searchParams.get('room');

    assert.match(code, /^[A-Z0-9]{6}$/);
    console.log(`${game}: created`);
    const guest = await player(true);
    await guest.goto(`${origin}/${game}?room=${code}`);
    await guest.getByLabel('Your name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();

    await guest
      .getByRole('button', { name: `${code} · 2/4`, exact: true })
      .waitFor();
    await host
      .getByRole('button', { name: `${code} · 2/4`, exact: true })
      .waitFor();
    await guest
      .getByText('Reconnecting…', { exact: true })
      .waitFor({ state: 'hidden' });
    console.log(`${game}: joined`);
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
      .last()
      .waitFor();
    assert.equal(new URL(guest.url()).searchParams.has('room'), false);
    await host
      .getByRole('button', { name: `${code} · 1/4`, exact: true })
      .waitFor();
    await guest
      .getByRole('button', { name: 'Multiplayer', exact: true })
      .last()
      .click();
    await guest.getByLabel('Room code', { exact: true }).fill('ZZZZZZ');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await guest
      .getByRole('dialog')
      .getByText('Room not found. Check the code or create a new room.', {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await guest
        .getByRole('button', { name: 'Join room', exact: true })
        .isEnabled(),
      true,
    );
    assert.deepEqual(errors, []);
    await host.context().close();
    await guest.context().close();
    console.log(
      `${game}: desktop/mobile create, join, real snapshots, reload, leave and invalid-code recovery passed.`,
    );
  }
  console.log(
    'Desktop/mobile: create, invite join, two-player roster, reload reconnect, leave to solo, NPC refill and invalid-room recovery passed.',
  );
} catch (error) {
  console.log(error);
  console.log('Browser errors:', errors);
  for (const page of pages) {
    console.log((await page.locator('body').innerText()).slice(-3500));
    console.log(
      await page.locator('input').evaluateAll((nodes) =>
        nodes.map((n) => ({
          html: n.outerHTML,
          parent: n.parentElement.outerHTML,
          hidden: n
            .closest('[inert], [aria-hidden="true"]')
            ?.outerHTML.slice(0, 300),
        })),
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
