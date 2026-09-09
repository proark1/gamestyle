import { waitFor } from '../../shared/rooms/wait-for';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryConnection } from './connection';
import type { DeliveryInput } from './types';

void test('movement transmits immediately, in-flight inputs coalesce, and a jump survives until sent', async () => {
  const original = globalThis.fetch;
  const requests: { input: DeliveryInput; resolve: (r: Response) => void }[] =
    [];
  globalThis.fetch = (_url, init) =>
    new Promise((resolve) =>
      requests.push({ input: JSON.parse(init?.body as string).input, resolve }),
    );
  const connection = new DeliveryConnection(
    { code: 'ABC234', id: 'a', token: 'test' },
    () => {},
    () => {},
  );
  try {
    connection.setInput({ x: 1, z: 0, jump: false, seq: 1 });
    assert.equal(requests.length, 1);
    connection.setInput({ x: 1, z: 0, jump: true, seq: 2 });
    connection.setInput({ x: 0, z: 0, jump: false, seq: 3 });
    assert.equal(requests.length, 1, 'one sync in flight');
    requests[0].resolve(Response.json({}));
    assert.ok(
      await waitFor(() => requests.length === 2),
      'the queued input follows once the floor elapses',
    );
    assert.deepEqual(requests[1].input, { x: 0, z: 0, jump: true, seq: 3 });
    assert.equal(connection.input.jump, false);
  } finally {
    connection.stop();
    requests.at(-1)?.resolve(Response.json({}));
    globalThis.fetch = original;
  }
});

void test('reconnect backoff survives held controls and stopping prevents pending responses from updating UI', async () => {
  const original = globalThis.fetch;
  let requests = 0,
    received = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({}, { status: 503 });
  };
  const connection = new DeliveryConnection(
    { code: 'ABC234', id: 'a', token: 'test' },
    () => received++,
    () => {},
  );
  try {
    await connection.poll();
    connection.setInput({ x: 1, z: 0, jump: false, seq: 1 });
    connection.setInput({ x: 0, z: 1, jump: false, seq: 2 });
    assert.equal(requests, 1);
    connection.stop();
    connection.accept({ version: 1 } as Parameters<
      DeliveryConnection['accept']
    >[0]);
    assert.equal(received, 0);
  } finally {
    connection.stop();
    globalThis.fetch = original;
  }
});
