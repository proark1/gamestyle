import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomHandler, readJsonObject } from './room-handler';
import { RoomError } from '../rooms/types';

const request = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/test', {
    method: 'POST',
    body,
    headers: { origin: 'http://localhost:3000', ...headers },
  });

void test('room requests accept an object and reject invalid JSON, arrays, and scalars', async () => {
  assert.deepEqual(await readJsonObject(request('{"op":"create"}')), {
    op: 'create',
  });
  for (const body of ['{', 'null', '[]', 'true', '42', '"create"'])
    await assert.rejects(
      readJsonObject(request(body)),
      (error: unknown) => error instanceof RoomError && error.status === 400,
    );
});

void test('room request limits count UTF-8 bytes without relying on Content-Length', async () => {
  const ascii = JSON.stringify({ name: 'a'.repeat(20) });
  assert.deepEqual(
    await readJsonObject(request(ascii), ascii.length),
    JSON.parse(ascii),
  );
  await assert.rejects(
    readJsonObject(
      request(JSON.stringify({ name: 'é'.repeat(20) })),
      ascii.length,
    ),
    (error: unknown) => error instanceof RoomError && error.status === 413,
  );
  await assert.rejects(
    readJsonObject(request('{}', { 'content-length': '4097' })),
    (error: unknown) => error instanceof RoomError && error.status === 413,
  );
});

void test('origin and payload failures never open a room store', async () => {
  let opened = 0;
  const handler = createRoomHandler({
    store: () => {
      opened++;
      throw new Error('Store should not open');
    },
    handle: async () => ({}),
    originError: 'Open the game.',
    unavailableError: 'Unavailable.',
    logLabel: 'Test',
  });
  assert.equal(
    (await handler(request('{}', { origin: 'https://untrusted.example' })))
      .status,
    403,
  );
  assert.equal((await handler(request('[]'))).status, 400);
  assert.equal((await handler(request('x'.repeat(4097)))).status, 413);
  assert.equal(opened, 0);
});

void test('room handlers preserve game errors and disable response caching', async () => {
  const handler = createRoomHandler({
    store: () => ({
      get: async () => null,
      insert: async () => false,
      compareAndSwap: async () => false,
    }),
    handle: async () => {
      throw new RoomError('Crew full.', 409);
    },
    originError: 'Open the game.',
    unavailableError: 'Unavailable.',
    logLabel: 'Test',
  });
  const response = await handler(request('{"op":"join"}'));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Crew full.' });
});

void test('stalled uploads time out and cancel even when cancellation never resolves', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
      return new Promise(() => {});
    },
  });
  const incoming = new Request('http://localhost/api/test', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(
    readJsonObject(incoming, 1000, 20),
    (error: unknown) => error instanceof RoomError && error.status === 408,
  );
  assert.equal(cancelled, true);
  assert.equal(incoming.body?.locked, false);
});

void test('oversized chunked bodies are stopped before reading the remaining upload', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(1001));
    },
    cancel() {
      cancelled = true;
    },
  });
  const incoming = new Request('http://localhost/api/test', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(
    readJsonObject(incoming, 1000),
    (error: unknown) => error instanceof RoomError && error.status === 413,
  );
  assert.equal(cancelled, true);
});
