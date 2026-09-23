import test from 'node:test';
import assert from 'node:assert/strict';
import { openSqlite, migrateSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import { createAccount } from '../../accounts/server/store';
import { startSession } from '../../accounts/server/session';
import { FULL_GAME_ENTITLEMENT, type CommerceOffer } from '../catalog';
import {
  initializeInventory,
  readInventory,
  importLegacyInventory,
  buyCoinItem,
  saveInventoryLook,
} from './inventory';
import { verifyAndRecordPurchase, type VerifiedPurchase } from './purchases';
import { createCommerceRoutes } from './routes';
import {
  accountCanPlay,
  assertGameEntry,
  assertPartyGameAccess,
} from './access';

const NOW = 1_790_000_000_000;
async function setup(t: { after: (fn: () => void) => void }) {
  const native = openSqlite(':memory:');
  t.after(() => native.close());
  migrateSqlite(native);
  migrateSqlite(native);
  const db = sqliteAdapter(native);
  const a = await createAccount(
    db,
    [{ provider: 'email', subject: 'a', hint: 'a' }],
    NOW,
  );
  const b = await createAccount(
    db,
    [{ provider: 'email', subject: 'b', hint: 'b' }],
    NOW,
  );
  await initializeInventory(db, a, NOW);
  await initializeInventory(db, b, NOW);
  return { native, db, a, b };
}

const receipt = (
  accountId: string,
  extra: Partial<VerifiedPurchase> = {},
): VerifiedPurchase => ({
  provider: 'test-store',
  transactionId: 'transaction-1',
  accountId,
  offerId: 'full-game',
  environment: 'live',
  status: 'paid',
  ...extra,
});

void test('welcome balances and concurrent duplicate coin purchases are granted only once', async (t) => {
  const { db, a } = await setup(t);
  await Promise.all(
    Array.from({ length: 8 }, () => initializeInventory(db, a, NOW)),
  );
  assert.equal((await readInventory(db, a)).coins, 500);
  await Promise.all(
    Array.from({ length: 8 }, () => buyCoinItem(db, a, 'party-cone', NOW)),
  );
  const inventory = await readInventory(db, a);
  assert.equal(inventory.coins, 350);
  assert.equal(inventory.items.filter((id) => id === 'party-cone').length, 1);
});

void test('competing different purchases cannot overspend the same balance', async (t) => {
  const { db, a } = await setup(t);
  const results = await Promise.allSettled([
    buyCoinItem(db, a, 'viking-helmet', NOW),
    buyCoinItem(db, a, 'hero-cape', NOW),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  const inventory = await readInventory(db, a);
  assert.ok(inventory.coins === 150 || inventory.coins === 200);
  assert.equal(
    inventory.items.filter((id) => ['viking-helmet', 'hero-cape'].includes(id))
      .length,
    1,
  );
  await assert.rejects(
    buyCoinItem(db, a, 'rocket-boots', NOW),
    /cannot be bought/,
  );
});

void test('legacy import is one-time, preserves old cosmetics and never grants premium access', async (t) => {
  const { db, a } = await setup(t);
  await importLegacyInventory(
    db,
    a,
    ['party-cone', 'rocket-boots', FULL_GAME_ENTITLEMENT, 'future-premium'],
    { hat: 'party-cone', top: 'hero-cape' },
    NOW,
  );
  await importLegacyInventory(db, a, ['hero-cape'], { top: 'hero-cape' }, NOW);
  const inventory = await readInventory(db, a);
  assert.equal(inventory.coins, 500);
  assert.equal(inventory.fullGame, false);
  assert.equal(inventory.legacyImported, true);
  assert.ok(inventory.items.includes('rocket-boots'));
  assert.ok(!inventory.items.includes('hero-cape'));
  assert.deepEqual(inventory.look, { hat: 'party-cone' });
  await buyCoinItem(db, a, 'party-cone', NOW);
  assert.equal((await readInventory(db, a)).coins, 500);
});

void test('concurrent migrations do not combine multiple legacy imports', async (t) => {
  const { db, a } = await setup(t);
  await Promise.all([
    importLegacyInventory(db, a, ['party-cone'], {}, NOW),
    importLegacyInventory(db, a, ['hero-cape'], {}, NOW),
  ]);
  const inventory = await readInventory(db, a);
  assert.equal(
    inventory.items.filter((id) => ['party-cone', 'hero-cape'].includes(id))
      .length,
    1,
  );
});

void test('equipping requires ownership, validates slots and can clear the outfit', async (t) => {
  const { db, a } = await setup(t);
  await assert.rejects(
    saveInventoryLook(db, a, { hat: 'party-cone' }, 'live'),
    /Own an item/,
  );
  await assert.rejects(
    saveInventoryLook(db, a, { top: 'bobble-beanie' }, 'live'),
    /Invalid outfit/,
  );
  await assert.rejects(
    saveInventoryLook(db, a, { extra: 'bobble-beanie' }, 'live'),
    /Invalid outfit/,
  );
  await saveInventoryLook(db, a, { hat: 'bobble-beanie' }, 'live');
  assert.deepEqual((await readInventory(db, a)).look, { hat: 'bobble-beanie' });
  await saveInventoryLook(db, a, {}, 'live');
  assert.deepEqual((await readInventory(db, a)).look, {});
});

void test('purchase verification is required, account-bound and isolated from sandbox', async (t) => {
  const { db, a, b } = await setup(t);
  await assert.rejects(
    verifyAndRecordPurchase(db, a, 'proof', undefined, 'live', NOW),
    /not available/,
  );
  await assert.rejects(
    verifyAndRecordPurchase(
      db,
      a,
      'proof',
      async () => receipt(b),
      'live',
      NOW,
    ),
    /does not belong/,
  );
  await assert.rejects(
    verifyAndRecordPurchase(
      db,
      a,
      'proof',
      async () => receipt(a, { environment: 'sandbox' }),
      'live',
      NOW,
    ),
    /does not belong/,
  );
  await verifyAndRecordPurchase(
    db,
    a,
    'proof',
    async () => receipt(a, { environment: 'sandbox' }),
    'sandbox',
    NOW,
  );
  assert.equal((await readInventory(db, a)).fullGame, false);
  assert.equal((await readInventory(db, a, 'sandbox')).fullGame, true);
});

void test('duplicate receipts are idempotent and cannot be replayed across accounts', async (t) => {
  const { db, a, b, native } = await setup(t);
  await Promise.all(
    Array.from({ length: 6 }, () =>
      verifyAndRecordPurchase(
        db,
        a,
        'proof',
        async () => receipt(a),
        'live',
        NOW,
      ),
    ),
  );
  assert.equal((await readInventory(db, a)).fullGame, true);
  await assert.rejects(
    verifyAndRecordPurchase(
      db,
      b,
      'proof',
      async () => receipt(b),
      'live',
      NOW,
    ),
    /already been claimed/,
  );
  assert.equal((await readInventory(db, b)).fullGame, false);
  assert.equal(
    (
      native
        .prepare(
          "SELECT COUNT(*) AS n FROM commerce_grants WHERE source = 'purchase'",
        )
        .get() as { n: number }
    ).n,
    1,
  );
});

void test('refunds are terminal even when settlement arrives late; repurchase uses a new transaction', async (t) => {
  const { db, a } = await setup(t);
  const apply = (extra: Partial<VerifiedPurchase>) =>
    verifyAndRecordPurchase(
      db,
      a,
      'proof',
      async () => receipt(a, extra),
      'live',
      NOW,
    );
  await apply({ status: 'revoked' });
  await apply({ status: 'paid' });
  assert.equal((await readInventory(db, a)).fullGame, false);
  await apply({ transactionId: 'transaction-2' });
  assert.equal((await readInventory(db, a)).fullGame, true);
  await apply({ transactionId: 'transaction-2', status: 'revoked' });
  assert.equal((await readInventory(db, a)).fullGame, false);
});

void test('bundle grants are atomic and refunds preserve items owned through another source', async (t) => {
  const { db, a } = await setup(t);
  const offers: CommerceOffer[] = [
    {
      id: 'test-bundle',
      name: 'Test Bundle',
      grants: ['party-cone', 'hero-cape'],
      usdCents: 499,
    },
  ];
  await buyCoinItem(db, a, 'party-cone', NOW);
  const apply = (status: 'paid' | 'revoked') =>
    verifyAndRecordPurchase(
      db,
      a,
      'proof',
      async () => receipt(a, { offerId: 'test-bundle', status }),
      'live',
      NOW,
      offers,
    );
  await apply('paid');
  await saveInventoryLook(
    db,
    a,
    { hat: 'party-cone', top: 'hero-cape' },
    'live',
  );
  await apply('revoked');
  const inventory = await readInventory(db, a);
  assert.ok(inventory.items.includes('party-cone'));
  assert.ok(!inventory.items.includes('hero-cape'));
  assert.deepEqual(inventory.look, { hat: 'party-cone' });
  assert.equal(inventory.coins, 350);
});

void test('account deletion removes inventory but leaves anonymous consumed transaction tombstones', async (t) => {
  const { db, a, b, native } = await setup(t);
  await verifyAndRecordPurchase(
    db,
    a,
    'proof',
    async () => receipt(a),
    'live',
    NOW,
  );
  await db.prepare('DELETE FROM accounts WHERE id = ?').bind(a).run();
  assert.equal(
    (
      native.prepare('SELECT owner_id FROM commerce_transactions').get() as {
        owner_id: string | null;
      }
    ).owner_id,
    null,
  );
  assert.equal(
    native
      .prepare('SELECT * FROM commerce_profiles WHERE account_id = ?')
      .get(a),
    undefined,
  );
  await assert.rejects(
    verifyAndRecordPurchase(
      db,
      b,
      'proof',
      async () => receipt(b),
      'live',
      NOW,
    ),
    /already been claimed/,
  );
  assert.equal((await readInventory(db, b)).fullGame, false);
});

void test('restoring a purchase uses its original bundle contents after a catalog change', async (t) => {
  const { db, a } = await setup(t);
  const verify = async () => receipt(a, { offerId: 'bundle' });
  await verifyAndRecordPurchase(db, a, 'proof', verify, 'live', NOW, [
    { id: 'bundle', name: 'Bundle', grants: ['party-cone'], usdCents: 499 },
  ]);
  await verifyAndRecordPurchase(db, a, 'proof', verify, 'live', NOW, [
    { id: 'bundle', name: 'Bundle', grants: ['hero-cape'], usdCents: 499 },
  ]);
  const inventory = await readInventory(db, a);
  assert.ok(inventory.items.includes('party-cone'));
  assert.ok(!inventory.items.includes('hero-cape'));
});

void test('server access checks use each player grant and react to refunds', async (t) => {
  const { db, a, b } = await setup(t);
  await assertPartyGameAccess(db, 'crane-clash', [a, b, null]);
  await verifyAndRecordPurchase(
    db,
    a,
    'proof',
    async () => receipt(a),
    'live',
    NOW,
  );
  assert.ok(await accountCanPlay(db, 'wrong-floor', a));
  await assert.rejects(
    assertPartyGameAccess(db, 'wrong-floor', [a, b]),
    /Every player/,
  );
  await assertPartyGameAccess(db, 'wrong-floor', [a]);
  assert.ok(!(await accountCanPlay(db, 'invented-game', a)));
  await verifyAndRecordPurchase(
    db,
    a,
    'proof',
    async () => receipt(a, { status: 'revoked' }),
    'live',
    NOW,
  );
  assert.ok(!(await accountCanPlay(db, 'wrong-floor', a)));
});

void test('direct entry remains open until enabled, then checks the current grant', async (t) => {
  const { db, a } = await setup(t);
  await assertGameEntry(db, 'wrong-floor', null, false);
  await assertGameEntry(db, 'crane-clash', null, true);
  await assert.rejects(
    assertGameEntry(db, 'wrong-floor', null, true),
    /full game pass/,
  );
  await assert.rejects(
    assertGameEntry(db, 'wrong-floor', a, true),
    /full game pass/,
  );
  await verifyAndRecordPurchase(
    db,
    a,
    'proof',
    async () => receipt(a),
    'live',
    NOW,
  );
  await assertGameEntry(db, 'wrong-floor', a, true);
  await verifyAndRecordPurchase(
    db,
    a,
    'proof',
    async () => receipt(a, { status: 'revoked' }),
    'live',
    NOW,
  );
  await assert.rejects(
    assertGameEntry(db, 'wrong-floor', a, true),
    /full game pass/,
  );
});

void test('inventory API rejects anonymous/foreign-origin writes and ignores client prices or account IDs', async (t) => {
  const { db, a, b } = await setup(t);
  const config = { publicOrigin: 'http://localhost:3000' };
  const cookies = await startSession(new Request('http://localhost:3000'), a, {
    db,
    config,
    now: NOW,
  });
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const routes = createCommerceRoutes({
    db: () => db,
    config: () => config,
    now: () => NOW,
  });
  const request = (
    body: unknown,
    origin: string | null = config.publicOrigin,
  ) =>
    new Request('http://localhost:3000/api/account/inventory', {
      method: 'POST',
      headers: {
        cookie,
        'Content-Type': 'application/json',
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await routes.GET(
        new Request('http://localhost:3000/api/account/inventory'),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await routes.POST(
        request(
          { op: 'buy_coins', itemId: 'party-cone' },
          'https://evil.example',
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await routes.POST(
        request({ op: 'buy_coins', itemId: 'party-cone' }, null),
      )
    ).status,
    403,
  );
  const result = await routes.POST(
    request({
      op: 'buy_coins',
      itemId: 'party-cone',
      accountId: b,
      price: 0,
      coins: 999999,
    }),
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  const body = await result.json();
  assert.equal(body.inventory.coins, 350);
  assert.equal(body.purchasesAvailable, false);
  assert.equal((await readInventory(db, b)).coins, 500);
  assert.equal(
    (
      await routes.POST(
        request({
          op: 'buy_coins',
          itemId: 'hero-cape',
          ownerKey: 'another-account',
        }),
      )
    ).status,
    409,
  );
  assert.equal((await readInventory(db, a)).coins, 350);
  assert.equal(
    (
      await routes.POST(
        request({
          op: 'verify_purchase',
          proof: 'fake',
          status: 'paid',
          offerId: 'full-game',
        }),
      )
    ).status,
    503,
  );
  assert.equal((await readInventory(db, a)).fullGame, false);
  assert.equal(
    (await routes.POST(request({ op: 'grant', itemId: FULL_GAME_ENTITLEMENT })))
      .status,
    400,
  );
});
