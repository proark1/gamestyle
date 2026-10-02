import assert from 'node:assert/strict';
import { test } from 'node:test';
import { peerRequest } from './mesh';
import { PeerError } from './types';

void test('peer requests preserve structured server errors', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ error: 'Crew full.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
  );

  await assert.rejects(
    peerRequest({ game: 'reel-problems-4', op: 'create' }),
    (error: unknown) => {
      assert.ok(error instanceof PeerError);
      assert.equal(error.status, 409);
      assert.equal(error.message, 'Crew full.');
      return true;
    },
  );
});

void test('peer requests replace plain-text server failures with a useful error', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('Internal Server Error', { status: 500 }),
  );

  await assert.rejects(
    peerRequest({ game: 'reel-problems-4', op: 'create' }),
    (error: unknown) => {
      assert.ok(error instanceof PeerError);
      assert.equal(error.status, 500);
      assert.equal(error.message, 'The room could not connect. Try again.');
      return true;
    },
  );
});

void test('peer requests reject malformed successful responses', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('<html>not a room</html>', { status: 200 }),
  );

  await assert.rejects(
    peerRequest({ game: 'reel-problems-4', op: 'create' }),
    (error: unknown) => {
      assert.ok(error instanceof PeerError);
      assert.equal(error.status, 502);
      assert.equal(
        error.message,
        'The room returned an invalid response. Try again.',
      );
      return true;
    },
  );
});
