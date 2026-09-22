import { chromium, expect as baseExpect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openSqlite, migrateSqlite } from '../db/sqlite.mjs';
import { sqliteAdapter } from '../db/node.ts';
import { createAccount } from '../shared/accounts/server/store.ts';
import { startSession } from '../shared/accounts/server/session.ts';

const expect = baseExpect.configure({ timeout: 30000 });
const origin = process.env.CREW_TEST_ORIGIN || 'http://127.0.0.1:5198';
if (
  !process.env.CREW_TEST_DATABASE ||
  !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)
)
  throw new Error(
    'Use a local server with CREW_TEST_DATABASE pointing to its isolated test database.',
  );
const native = openSqlite(process.env.CREW_TEST_DATABASE);
migrateSqlite(native);
const db = sqliteAdapter(native),
  now = Date.now();
const identities = [];
for (const name of ['Mika', 'Jules']) {
  const id = await createAccount(
    db,
    [
      {
        provider: 'email',
        subject: `crew-qa-${name}-${now}`,
        hint: 'test-only',
      },
    ],
    now,
  );
  native
    .prepare('UPDATE accounts SET display_name = ? WHERE id = ?')
    .run(name, id);
  const cookies = (
    await startSession(new Request(origin), id, {
      db,
      config: { publicOrigin: origin },
      now,
    })
  ).map((cookie) => {
    const [name, value] = cookie.split(';')[0].split('=');
    return { name, value, url: origin };
  });
  identities.push({ name, id, cookies });
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
const errors = [],
  pages = [];
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
mkdirSync('docs/crew-qa', { recursive: true });
try {
  for (const [index, seat] of [host, guest].entries()) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    await context.addCookies(identities[index].cookies);
    const page = await context.newPage();
    pages.push(page);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') console.log('Browser:', message.text()); });
    await page.addInitScript(
      (identity) =>
        sessionStorage.setItem(
          'jumbleyard-party-session-v1',
          JSON.stringify(identity),
        ),
      { code, playerId: seat.playerId, token: seat.token },
    );
    await page.goto(`${origin}/party`);
    await expect(
      page.getByRole('button', { name: 'Create crew', exact: true }),
    ).toBeVisible();
  }
  const [mika, jules] = pages;
  await mika.getByLabel('Crew name', { exact: true }).fill('Wobbly Legends');
  await mika
    .getByRole('button', { name: 'rocket emblem', exact: true })
    .click();
  await mika.getByRole('button', { name: 'Create crew', exact: true }).click();
  await expect(mika.locator('#crew-heading')).toHaveText('Wobbly Legends');
  await mika
    .getByRole('button', { name: 'New crew invite', exact: true })
    .click();
  await expect(
    mika.getByLabel('Crew invite code', { exact: true }),
  ).toHaveValue(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const invite = await mika
    .getByLabel('Crew invite code', { exact: true })
    .inputValue();
  await jules.getByLabel('Crew invite code', { exact: true }).fill(invite);
  await jules.getByRole('button', { name: 'Join crew', exact: true }).click();
  await expect(jules.locator('#crew-heading')).toHaveText('Wobbly Legends');
  await expect(jules.locator('.crew-roster li')).toHaveCount(2);
  await mika.reload();
  await expect(mika.locator('.crew-roster li')).toHaveCount(2);
  await mika.getByRole('button', { name: 'Make leader', exact: true }).click();
  await mika
    .locator('.crew-confirm')
    .getByRole('button', { name: 'Confirm', exact: true })
    .click();
  await expect(
    mika.getByRole('button', { name: 'Edit crew', exact: true }),
  ).toHaveCount(0);
  await jules.reload();
  await jules.getByRole('button', { name: 'Edit crew', exact: true }).click();
  await jules.getByLabel('Crew name', { exact: true }).fill('Cozy Chaos');
  await jules.getByRole('button', { name: 'wave emblem', exact: true }).click();
  await jules.route('**/api/account/crew', async (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  await jules.getByRole('button', { name: 'Save crew', exact: true }).click();
  await expect(jules.locator('.crew-error')).toBeVisible();
  await expect(jules.locator('#crew-heading')).toHaveText('Wobbly Legends');
  await jules.unroute('**/api/account/crew');
  await jules.getByRole('button', { name: 'Save crew', exact: true }).click();
  await expect(jules.locator('#crew-heading')).toHaveText('Cozy Chaos');
  await jules
    .getByRole('button', { name: 'New crew invite', exact: true })
    .click();
  await expect(
    jules.getByLabel('Crew invite code', { exact: true }),
  ).toBeVisible();
  await jules
    .locator('.crew-panel')
    .screenshot({ path: 'docs/crew-qa/desktop.png' });
  await jules.setViewportSize({ width: 390, height: 844 });
  await jules
    .locator('.crew-panel')
    .screenshot({ path: 'docs/crew-qa/mobile.png' });
  expect(
    await jules.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect
    .poll(
      async () =>
        (await api({ op: 'get', code })).state.players.find(
          (p) => p.id === guest.playerId,
        )?.crew?.name,
    )
    .toBe('Cozy Chaos');
  await mika.getByRole('button', { name: 'Leave crew', exact: true }).click();
  await mika
    .locator('.crew-confirm')
    .getByRole('button', { name: 'Confirm', exact: true })
    .click();
  await expect(
    mika.getByRole('button', { name: 'Create crew', exact: true }),
  ).toBeVisible();
  await jules.reload();
  await expect(jules.locator('.crew-roster li')).toHaveCount(1);
  expect(errors).toEqual([]);
  console.log(
    'PASS: two-account crew creation, invite/join, reload, leadership transfer, offline retry, rename, badges, leaving, desktop and mobile.',
  );
} catch (error) {
  for (const [i, page] of pages.entries())
    await page
      .screenshot({ path: `docs/crew-qa/failure-${i}.png` })
      .catch(() => {});
  console.log(errors);
  throw error;
} finally {
  await browser.close();
  for (const seat of [guest, host])
    await api({
      op: 'leave',
      code,
      playerId: seat.playerId,
      token: seat.token,
    }).catch(() => {});
  for (const identity of identities)
    native.prepare('DELETE FROM accounts WHERE id = ?').run(identity.id);
  native.close();
}
