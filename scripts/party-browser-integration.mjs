import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import * as party from '../platform/party/coordinator.ts';
import { partyGameSession } from '../platform/party/game-session.ts';
import { handlePeerRoom } from '../shared/peer/coordinator.ts';
import { handleVoicePeer } from '../shared/voice/peer-coordinator.ts';
import { openCheckpoint } from '../shared/peer/crypto.ts';

const game = process.argv[2] ?? 'crane-clash';
const mobile = process.env.SMOKE_MOBILE === '1';
const rows = new Map(),
  errors = [];
let checkpointConflicts = 0;
const store = {
  get: async (c) => rows.get(c) ?? null,
  insert: async (r) => {
    if (rows.has(r.code)) return false;
    rows.set(r.code, r);
    return true;
  },
  compareAndSwap: async (r, v) => {
    if (rows.get(r.code)?.version !== v) return false;
    rows.set(r.code, r);
    return true;
  },
};
const host = await party.createPartyRoom(store, 'Host', 0),
  code = host.state.code;
const guest = await party.joinPartyRoom(store, code, 'Guest', 1);
const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      if (!['/api/peer', '/api/voice/peer', '/api/party'].includes(req.url)) {
        res.statusCode = 404;
        res.end('{}');
        return;
      }
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const b = JSON.parse(raw);
      let result;
      if (req.url === '/api/peer') {
        result = await handlePeerRoom(store, b);
        result.view.iceServers = [];
      } else if (req.url === '/api/voice/peer') {
        result = await handleVoicePeer(store, store, b);
        result.view.iceServers = [];
      } else if (req.url === '/api/party') {
        if (b.op === 'get')
          result = { state: await party.getPartyRoom(store, b.code) };
        else if (b.op === 'game_session')
          result = {
            session: await partyGameSession(
              store,
              b.code,
              b.playerId,
              b.token,
              b.round,
            ),
          };
        else if (b.op === 'report_result')
          result = {
            state: await party.reportRoundResult(
              store,
              b.code,
              b.round,
              { id: b.playerId, token: b.token },
              b.result,
            ),
          };
        else throw Error('Unexpected party operation ' + b.op);
      } else {
        res.statusCode = 404;
        res.end('{}');
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    }
    const root = resolve('dist/native'),
      path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root)) throw Error('Bad path');
    const file =
      existsSync(path) && extname(path) ? path : resolve(root, 'index.html');
    res.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.woff2': 'font/woff2',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      }[extname(file)] ?? 'application/octet-stream',
    );
    res.end(readFileSync(file));
  } catch (error) {
    res.statusCode = error.status ?? 500;
    res.end(JSON.stringify({ error: error.message }));
    // A roster revision can change while an encrypted checkpoint is in flight
    // during reload/handover. The client must reconcile and save again.
    if (
      error.status === 409 &&
      error.message === 'The crew changed. Synchronize before saving.'
    )
      checkpointConflicts++;
    else errors.push(error.message);
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  channel: process.env.SMOKE_BROWSER ?? 'chrome',
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
  ],
});
try {
  const pages = [];
  for (const [i, p] of [host, guest].entries()) {
    const context = await browser.newContext({
      permissions: ['microphone'],
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1000, height: 750 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    await context.addInitScript(
      ({ code, p, i }) =>
        sessionStorage.setItem(
          'jumbleyard-party-session-v1',
          JSON.stringify({
            code,
            playerId: p.playerId,
            token: p.token,
            name: i ? 'Guest' : 'Host',
            color: i,
          }),
        ),
      { code, p, i },
    );
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    await page.goto(origin + '/party?room=' + code);
    await page.getByRole('button', { name: 'Voice chat', exact: true }).click();
    await page.getByRole('button', { name: 'Join with push to talk' }).click();
    await page.getByRole('button', { name: 'Disable push to talk' }).waitFor();
    await page.keyboard.press('Escape');
    pages.push(page);
  }
  const voiceBefore = JSON.parse(
    rows.get('voice-peer:party:' + code).state,
  ).members.map((m) => [m.id, m.instance]);
  await party.startPartyTournament(store, code, {
    id: host.playerId,
    token: host.token,
  });
  const row = rows.get('party:' + code),
    state = JSON.parse(row.state);
  state.playlist[0] = game;
  row.state = JSON.stringify(state);
  for (const page of pages)
    await page.locator('iframe.party-game-frame').waitFor({ timeout: 30000 });
  const deadline = Date.now() + 40000;
  let checkpoint;
  while (Date.now() < deadline) {
    const gameRow = [...rows.values()].find((r) =>
      r.code.startsWith('peer:' + game + ':'),
    );
    if (gameRow) {
      const room = JSON.parse(gameRow.state);
      if (room.checkpoint) {
        checkpoint = await openCheckpoint(
          room.checkpoint,
          room.checkpoint.key,
          game + ':' + gameRow.code.split(':').at(-1),
        );
        const joined = new Set(
          checkpoint.world.players.filter((p) => !p.bot).map((p) => p.id),
        );
        if (
          checkpoint.world.partyRoundStarted &&
          [host.playerId, guest.playerId].every((id) => joined.has(id))
        )
          break;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(
    checkpoint?.world.partyRoundStarted,
    'shared game automatically starts',
  );
  if (checkpoint.world.players.filter((p) => !p.bot).length !== 2) {
    console.error('Party join diagnostics', {
      errors,
      rooms: [...rows.values()]
        .filter((r) => r.code.startsWith('peer:' + game + ':'))
        .map((r) => {
          const room = JSON.parse(r.state);
          return {
            code: r.code,
            members: room.members.map(({ id, name, suspended }) => ({
              id,
              name,
              suspended,
            })),
          };
        }),
      pages: await Promise.all(
        pages.map(async (page) => ({
          body: (await page.locator('body').innerText()).slice(-800),
          frames: await Promise.all(
            page
              .frames()
              .slice(1)
              .map(async (f) => ({
                body: (await f.locator('body').innerText()).slice(-800),
              })),
          ),
        })),
      ),
    });
  }
  assert.deepEqual(
    checkpoint.world.players
      .filter((p) => !p.bot)
      .map((p) => p.id)
      .sort(),
    [host.playerId, guest.playerId].sort(),
  );
  for (const page of pages) {
    await page.locator('.voice-trigger[data-connected="true"]').waitFor();
    const frame = page.frames().find((f) => f.url().includes('/' + game));
    await frame.waitForFunction(
      () => !document.querySelector('.party-intro-overlay'),
    );
    await frame
      .locator('canvas')
      .first()
      .click({ position: { x: 200, y: 200 }, force: true });
    await page.keyboard.down('t');
    await page
      .locator('.voice-trigger[data-live="true"]')
      .waitFor({ timeout: 5000 });
    await page.keyboard.up('t');
    await page.locator('.voice-trigger[data-live="false"]').waitFor();
  }
  mkdirSync('.tmp/improvements', { recursive: true });
  await pages[0].screenshot({
    path: `.tmp/improvements/party-${game}${mobile ? '-mobile' : ''}.png`,
  });
  const hostFrame = pages[0].frames().find((f) => f.url().includes('/' + game));
  await hostFrame.evaluate(() => location.reload());
  await pages[0]
    .frameLocator('iframe')
    .locator('canvas')
    .first()
    .waitFor({ timeout: 30000 });
  await pages[0].locator('.voice-trigger[data-connected="true"]').waitFor();
  for (const page of pages)
    await page
      .getByRole('button', { name: 'Give up round · Back to party' })
      .click();
  for (const page of pages) {
    await page.locator('iframe').waitFor({ state: 'detached' });
    await page.locator('.voice-trigger[data-connected="true"]').waitFor();
  }
  const voiceAfter = JSON.parse(
    rows.get('voice-peer:party:' + code).state,
  ).members.map((m) => [m.id, m.instance]);
  assert.deepEqual(
    voiceAfter,
    voiceBefore,
    'voice browser sessions persist through the round',
  );
  assert.equal((await party.getPartyRoom(store, code)).status, 'intermission');
  assert.deepEqual(errors, []);
  console.log(
    game +
      `: PASS: two real browsers share a party round, bridge push-to-talk and preserve voice into intermission (${checkpointConflicts} recoverable checkpoint conflicts).`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
