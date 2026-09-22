import { chromium, expect as baseExpect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const expect = baseExpect.configure({ timeout: 60000 });

// Runs against an existing local development server; each run creates its own party.
const origin = process.env.PLAZA_TEST_ORIGIN || 'http://127.0.0.1:5183';
let accountCookies = [];
if (process.env.PLAZA_TEST_DATABASE) {
  const { openSqlite, migrateSqlite } = await import('../db/sqlite.mjs');
  const { sqliteAdapter } = await import('../db/node.ts');
  const { createAccount } = await import('../shared/accounts/server/store.ts');
  const { startSession } = await import('../shared/accounts/server/session.ts');
  const native = openSqlite(process.env.PLAZA_TEST_DATABASE);
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native),
      now = Date.now();
    const accountId = await createAccount(
      db,
      [{ provider: 'email', subject: `plaza-qa-${now}`, hint: 'plaza-qa' }],
      now,
    );
    accountCookies = (
      await startSession(new Request(origin), accountId, {
        db,
        config: { publicOrigin: origin },
        now,
      })
    ).map((cookie) => {
      const [name, value] = cookie.split(';')[0].split('=');
      return { name, value, url: origin };
    });
  } finally {
    native.close();
  }
}
const api = async (body) => {
  const response = await fetch(`${origin}/api/party`, {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
};
const host = await api({ op: 'create', hostName: 'Mika', color: 0 });
const code = host.state.code;
const guest = await api({ op: 'join', code, name: 'Jules', color: 1 });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
try {
  async function open(seat) {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1100 },
    });
    const page = await context.newPage();
    if (seat === host && accountCookies.length)
      await context.addCookies(accountCookies);
    page.setDefaultTimeout(60000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(
      (identity) => {
        sessionStorage.setItem(
          'jumbleyard-party-session-v1',
          JSON.stringify(identity),
        );
        localStorage.setItem('jy_language', 'en');
      },
      { code, playerId: seat.playerId, token: seat.token },
    );
    await page.goto(`${origin}/party`);
    try {
      await page.locator('.plaza-canvas canvas').waitFor();
    } catch (error) {
      mkdirSync('docs/plaza-qa', { recursive: true });
      await page.screenshot({ path: 'docs/plaza-qa/failure.png' });
      console.log(await page.locator('body').innerText(), errors);
      throw error;
    }
    await expect(page.locator('.plaza-loading')).toHaveCount(0);
    return page;
  }
  const page = await open(host);
  const friend = await open(guest);
  mkdirSync('docs/plaza-qa', { recursive: true });
  await page
    .locator('.party-plaza')
    .screenshot({ path: 'docs/plaza-qa/plaza-desktop.png' });
  const room = async () => (await api({ op: 'get', code })).state;
  await expect
    .poll(async () => (await room()).players.every((p) => !!p.lobbyPose))
    .toBe(true);
  const before = (await room()).players.find((p) => p.id === host.playerId)
    .lobbyPose.x;
  const walk = page.getByRole('button', { name: 'Walk right', exact: true });
  await walk.focus();
  await page.keyboard.down('Space');
  await expect
    .poll(
      async () =>
        (await room()).players.find((p) => p.id === host.playerId).lobbyPose.x,
    )
    .toBeGreaterThan(before + 0.4);
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Hat stand', exact: true }).click();
  await expect(page.locator('.wardrobe-dialog')).toBeVisible();
  await expect
    .poll(
      async () =>
        (await room()).players.find((p) => p.id === host.playerId).browsing,
    )
    .toBe(true);
  const card = page.locator('.wardrobe-item-card').filter({
    has: page.getByRole('button', {
      name: 'Inspect Frog Bucket Hat',
      exact: true,
    }),
  });
  await expect(card).toHaveAttribute('data-fitted', 'true');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jy_wardrobe_v1') || '{}').look?.hat,
    ),
  ).toBeUndefined();
  await card.getByRole('button', { name: /^Buy/ }).click();
  await card.getByRole('button', { name: 'Equip', exact: true }).click();
  await expect(card).toHaveAttribute('data-equipped', 'true');
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  mkdirSync('docs/plaza-qa', { recursive: true });
  await page.screenshot({ path: 'docs/plaza-qa/fitting-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.wardrobe-dialog')).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await room()).players.find((p) => p.id === host.playerId).look?.hat,
    )
    .toBe('frog-bucket-hat');
  await page
    .locator('.party-plaza')
    .screenshot({ path: 'docs/plaza-qa/plaza-desktop.png' });
  await friend
    .locator('.party-plaza')
    .screenshot({ path: 'docs/plaza-qa/friend-view.png' });
  await page.reload();
  await page.locator('.plaza-canvas canvas').waitFor();
  const saved = accountCookies.length
    ? await page.evaluate(
        async () =>
          (await (await fetch('/api/account/inventory')).json()).inventory,
      )
    : await page.evaluate(() =>
        JSON.parse(localStorage.getItem('jy_wardrobe_v1')),
      );
  expect(saved.look.hat).toBe('frog-bucket-hat');
  expect(saved.coins).toBe(320);
  if (accountCookies.length) {
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('jy_wardrobe_v1') || '{}').look?.hat,
      ),
    ).toBeUndefined();
    const authoritative = await page.evaluate(
      async ({ code, playerId, token }) => {
        const response = await fetch('/api/party', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'lobby_presence',
            code,
            playerId,
            token,
            pose: { x: 0, z: 1.4, angle: 0 },
            browsing: false,
            look: { hat: 'crown-of-greed' },
            fullGame: true,
          }),
        });
        return (await response.json()).state;
      },
      { code, playerId: host.playerId, token: host.token },
    );
    expect(
      authoritative.players.find((p) => p.id === host.playerId).look.hat,
    ).toBe('frog-bucket-hat');
    expect(
      authoritative.players.find((p) => p.id === host.playerId).fullGame,
    ).toBe(false);
    expect(authoritative.accounts).toBeUndefined();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('.party-plaza')
    .screenshot({ path: 'docs/plaza-qa/plaza-mobile.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Outfit workshop', exact: true })
    .click();
  await expect(page.locator('.wardrobe-dialog')).toBeVisible();
  await page.screenshot({ path: 'docs/plaza-qa/fitting-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.wardrobe-dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'PASS: two-player presence, movement, try-on, coin purchase, equip, reload, desktop and mobile layouts.',
  );
} finally {
  await browser.close();
  await api({
    op: 'leave',
    code,
    playerId: guest.playerId,
    token: guest.token,
  }).catch(() => {});
  await api({
    op: 'leave',
    code,
    playerId: host.playerId,
    token: host.token,
  }).catch(() => {});
}
