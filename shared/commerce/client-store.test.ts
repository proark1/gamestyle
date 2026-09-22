import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryClient, type InventoryReply } from './client-store';

const legacy = { items: ['party-cone'], look: { hat: 'party-cone' } };
const reply = (coins = 500): InventoryReply => ({
  ownerKey: 'account-a',
  purchasesAvailable: false,
  inventory: {
    coins,
    items: [],
    look: {},
    fullGame: false,
    legacyImported: true,
    environment: 'live',
  },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

void test('sign-out discards an in-flight account inventory response', async () => {
  const request = deferred<InventoryReply>();
  const client = createInventoryClient(
    () => request.promise,
    () => {},
  );
  const connecting = client.connect(true, legacy);
  await client.connect(false, legacy);
  request.resolve(reply());
  await connecting;
  assert.equal(client.snapshot().mode, 'guest');
  assert.equal(client.snapshot().inventory, null);
});

void test('failed purchase preserves ownership and balance, while overlapping writes are rejected', async () => {
  let reject!: (reason: Error) => void;
  const client = createInventoryClient(
    (body) =>
      body
        ? new Promise((_resolve, fail) => {
            reject = fail;
          })
        : Promise.resolve(reply()),
    () => {},
  );
  await client.connect(true, legacy);
  const purchase = client.change({ op: 'buy_coins', itemId: 'party-cone' });
  assert.equal(
    await client.change({ op: 'buy_coins', itemId: 'party-cone' }),
    false,
  );
  reject(new Error('Connection lost'));
  assert.equal(await purchase, false);
  assert.equal(client.snapshot().inventory?.coins, 500);
  assert.deepEqual(client.snapshot().inventory?.items, []);
  assert.equal(client.snapshot().error, 'Connection lost');
});

void test('legacy import and mutations carry the account scope returned by the server', async () => {
  const calls: (object | undefined)[] = [];
  const client = createInventoryClient(
    async (body) => {
      calls.push(body);
      const value = reply();
      value.inventory.legacyImported = !!body;
      return value;
    },
    () => {},
  );
  await client.connect(true, legacy);
  await client.change({ op: 'equip', look: {} });
  assert.deepEqual(calls, [
    undefined,
    { op: 'import_legacy', ...legacy, ownerKey: 'account-a' },
    { op: 'equip', look: {}, ownerKey: 'account-a' },
  ]);
});

void test('a purchase response cannot overwrite a newly connected account', async () => {
  const purchase = deferred<InventoryReply>();
  let reads = 0;
  const client = createInventoryClient(
    (body) => (body ? purchase.promise : Promise.resolve(reply(++reads * 100))),
    () => {},
  );
  await client.connect(true, legacy);
  const saving = client.change({ op: 'equip', look: {} });
  await client.connect(true, legacy);
  purchase.resolve(reply(999));
  assert.equal(await saving, false);
  assert.equal(client.snapshot().inventory?.coins, 200);
});
