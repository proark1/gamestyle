import { chromium, expect as baseExpect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { openSqlite, migrateSqlite } from '../db/sqlite.mjs';
import { sqliteAdapter } from '../db/node.ts';
import { createAccount } from '../shared/accounts/server/store.ts';
import { startSession } from '../shared/accounts/server/session.ts';

const expect = baseExpect.configure({ timeout: 45000 });
const origin = process.env.CHALLENGE_TEST_ORIGIN || 'http://127.0.0.1:5200';
if (
  !process.env.CHALLENGE_TEST_DATABASE ||
  !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)
)
  throw new Error('Use an isolated local challenge test database and server.');
const native = openSqlite(process.env.CHALLENGE_TEST_DATABASE);
migrateSqlite(native);
const db = sqliteAdapter(native),
  identities = [],
  pages = [],
  errors = [],
  now = Date.now();
let browser;
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const name of ['Mika', 'Jules']) {
    const id = await createAccount(
      db,
      [
        {
          provider: 'email',
          subject: `challenge-qa-${name}-${now}`,
          hint: 'test-only',
        },
      ],
      now,
    );
    identities.push(id);
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
    const context = await browser.newContext({
      viewport: { width: 1365, height: 1000 },
    });
    await context.addCookies(cookies);
    const page = await context.newPage();
    pages.push(page);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(
      (name) =>
        localStorage.setItem(
          'stack-or-sink-prefs-v1',
          JSON.stringify({ name, color: name === 'Mika' ? 0 : 1, muted: true }),
        ),
      name,
    );
  }
  const [host, guest] = pages;
  await host.goto(`${origin}/stack-or-sink?challenge=verified`);
  const created = host.waitForResponse(
    (response) =>
      response.url().endsWith('/api/challenges/stack-or-sink') &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON().op === 'create',
  );
  await host
    .getByRole('button', { name: 'Create verified crew · earn coins' })
    .click();
  const reply = await (await created).json();
  assert.equal(reply.session.verified, true);
  const code = reply.session.code;
  await expect(host.locator('.mission-eyebrow')).toHaveText(
    'VERIFIED CHALLENGE',
  );
  await guest.goto(`${origin}/stack-or-sink?room=${code}&challenge=verified`);
  await expect(
    guest.getByRole('checkbox', { name: /Verified challenge room/ }),
  ).toBeChecked();
  await guest
    .getByRole('button', { name: 'Join the crew', exact: true })
    .click();
  await expect(guest.locator('.mission-eyebrow')).toHaveText(
    'VERIFIED CHALLENGE',
  );
  await expect(host.locator('.crew-member')).toHaveCount(2);
  await guest.reload();
  await expect(guest.locator('.mission-eyebrow')).toHaveText(
    'VERIFIED CHALLENGE',
  );
  await host.getByRole('button', { name: 'Start the flood' }).click();
  await expect(host.locator('.water-caption')).toContainText('RISING IN');
  await expect(guest.locator('.water-caption')).toContainText('RISING IN');
  await host.reload();
  await expect(host.locator('.mission-eyebrow')).toHaveText(
    'VERIFIED CHALLENGE',
  );
  // Isolated server-state fixture tests the real settlement route and result UI.
  // This deliberately does not pretend a browser score is verification evidence.
  const key = `verified-stack:${code}`;
  const row = native.prepare('SELECT state FROM rooms WHERE code = ?').get(key);
  const room = JSON.parse(row.state);
  room.world.phase = 'won';
  room.world.bestHeight = 6;
  room.challengeHeight = 6;
  native
    .prepare('UPDATE rooms SET state = ?, version = version + 1 WHERE code = ?')
    .run(JSON.stringify(room), key);
  for (const page of pages) {
    const result = page.getByRole('dialog');
    await expect(result).toContainText('Weekly reward earned');
    await expect(result.locator('.stack-challenge li strong')).toHaveText([
      'Earned',
      'Earned',
      'Earned',
    ]);
  }
  for (const id of identities)
    assert.equal(
      native
        .prepare('SELECT coins FROM commerce_profiles WHERE account_id = ?')
        .get(id).coins,
      950,
    );
  mkdirSync('docs/challenge-qa', { recursive: true });
  await host
    .getByRole('dialog')
    .screenshot({ path: 'docs/challenge-qa/result-desktop.png' });
  await guest.setViewportSize({ width: 390, height: 844 });
  await guest
    .getByRole('dialog')
    .screenshot({ path: 'docs/challenge-qa/result-mobile.png' });
  assert.equal(
    await guest.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await host.getByRole('button', { name: 'Back to challenge lobby' }).click();
  await expect(
    host.getByRole('button', { name: 'Create verified crew · earn coins' }),
  ).toBeVisible();
  await host.reload();
  await host.locator('.challenge-details summary').click();
  await expect(host.locator('.stack-challenge')).toContainText(
    'Weekly reward earned',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: two-account verified create/join/start, invite reload, host reconnect, server-fixture settlement, wallet rewards, persisted mastery and desktop/mobile result UI.',
  );
} catch (error) {
  mkdirSync('docs/challenge-qa', { recursive: true });
  for (const [i, page] of pages.entries())
    await page
      .screenshot({ path: `docs/challenge-qa/failure-${i}.png` })
      .catch(() => {});
  console.log('Browser errors:', errors);
  throw error;
} finally {
  await browser?.close();
  for (const id of identities)
    native.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  native.close();
}
