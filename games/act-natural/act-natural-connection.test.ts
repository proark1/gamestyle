import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestFarm, FarmConnection } from './connection';
import { farmPlayer, farmSnapshot, freshFarm } from './simulation';

void test('browser-created farms use private server rooms and sync and actions stay on that authority', async () => {
  const fetchBefore = globalThis.fetch;
  const windowBefore = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {},
  });
  const world = freshFarm(1000);
  world.mode = 'computer';
  world.players = [farmPlayer('host', 'Host', 1000)];
  const session = { code: 'FARMAB', id: 'host', token: 'secret' };
  const snapshot = farmSnapshot(world, session.code, session.id, session.id, 1);
  const operations: Record<string, unknown>[] = [];
  let connection: FarmConnection | undefined;
  globalThis.fetch = async (input, options) => {
    assert.equal(input, '/api/act-natural');
    assert.equal(typeof options?.body, 'string');
    const body = JSON.parse(options!.body as string);
    operations.push(body);
    return Response.json({
      session,
      snapshot: { ...snapshot, version: operations.length },
    });
  };
  try {
    const created = await requestFarm({
      op: 'create',
      mode: 'computer',
      name: 'Host',
    });
    assert.equal(created.session?.peer, undefined);
    let received = 0;
    connection = new FarmConnection(
      created.session!,
      () => received++,
      () => {},
    );
    await connection.poll();
    await connection.action({ type: 'mode', mode: 'human' });
    connection.stop();
    assert.equal(received, 2);
    assert.deepEqual(
      operations.map((body) => body.op),
      ['create', 'sync', 'action'],
    );
    assert.equal(operations[0].mode, 'computer');
    assert.deepEqual(operations[2].action, { type: 'mode', mode: 'human' });
    assert.equal(operations[2].token, session.token);
  } finally {
    connection?.stop();
    globalThis.fetch = fetchBefore;
    if (windowBefore) Object.defineProperty(globalThis, 'window', windowBefore);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

void test('movement sends ordered controls, prevents duplicate syncs and ignores older replies', async () => {
  const original = globalThis.fetch;
  const w = freshFarm(1000);
  w.players = [farmPlayer('host', 'Host', 1000)];
  const session = { code: 'FARMAB', id: 'host', token: 'secret' };
  const s = farmSnapshot(w, session.code, session.id, session.id, 1);
  const calls: {
    body: Record<string, unknown>;
    resolve: (reply: Response) => void;
  }[] = [];
  const received: number[] = [];
  globalThis.fetch = (_url, options) =>
    new Promise<Response>((resolve) => {
      calls.push({ body: JSON.parse(options!.body as string), resolve });
    });
  const connection = new FarmConnection(
    session,
    (value) => received.push(value.version),
    () => {},
  );
  try {
    connection.input = { x: 1, z: 0, graze: false };
    const sync = connection.poll();
    await connection.poll();
    assert.equal(calls.length, 1, 'only one sync in flight');
    connection.input = { x: 0, z: 0, graze: false };
    const action = connection.action({ type: 'inspect' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 2);
    assert.ok(
      Number(calls[1].body.inputSequence) > Number(calls[0].body.inputSequence),
    );
    assert.deepEqual(calls[1].body.input, { x: 0, z: 0, graze: false });
    calls[1].resolve(Response.json({ snapshot: { ...s, version: 2 } }));
    await action;
    calls[0].resolve(Response.json({ snapshot: s }));
    await sync;
    assert.deepEqual(
      received,
      [2],
      'late snapshots cannot move the actor backward',
    );
  } finally {
    connection.stop();
    globalThis.fetch = original;
  }
});
