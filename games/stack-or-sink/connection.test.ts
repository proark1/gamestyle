import { waitFor } from '../../shared/rooms/wait-for';
import type { Input } from './types';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Connection } from './connection';

void test('input changes transmit immediately and an in-flight request sends the latest stop next', async () => {
  const original = globalThis.fetch,
    requests: {
      body: { input: Input & { order: number } };
      resolve: (response: Response) => void;
    }[] = [];
  globalThis.fetch = (_url, init) =>
    new Promise((resolve) =>
      requests.push({
        body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}'),
        resolve,
      }),
    );
  const connection = new Connection(
    { code: 'ABC234', id: 'a', token: 'test' },
    () => {},
    () => {},
  );
  try {
    connection.start();
    assert.equal(requests.length, 1);
    assert.ok(
      Number.isSafeInteger(requests[0].body.input.order),
      'reconnect starts with an ordered stop',
    );
    connection.setInput({ x: 1, z: 0, jump: false, seq: 0 });
    connection.setInput({ x: 0, z: 0, jump: false, seq: 0 });
    assert.equal(requests.length, 1, 'only one poll can be in flight');
    requests[0].resolve(Response.json({ ok: true }));
    assert.ok(
      await waitFor(() => requests.length === 2),
      'the queued input follows once the floor elapses',
    );
    assert.equal(requests[1].body.input.x, 0);
    assert.ok(requests[1].body.input.order > requests[0].body.input.order);
  } finally {
    connection.stop();
    requests.at(-1)?.resolve(Response.json({ ok: true }));
    globalThis.fetch = original;
  }
});
