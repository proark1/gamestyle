import test from 'node:test';
import assert from 'node:assert/strict';
import { Connection } from './connection';
import { freshWorld, type Action, type Snapshot } from './model';

void test('a queued throw preserves its activation position and aim while movement continues', async (t) => {
  const requests: {
    position: { x: number; angle: number };
    action: Action;
    actionId: string;
  }[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const snapshot: Snapshot = {
    world: freshWorld('sandbox', 10000),
    players: [],
    code: 'TEST',
    host: 'me',
    now: 10000,
    version: 1,
  };
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string));
      if (requests.length === 1) await gate;
      return Response.json({ snapshot });
    },
  );
  const connection = new Connection(
    { code: 'TEST', id: 'me', token: 'test-token' },
    () => {},
    () => {},
  );
  const first = connection.action({ type: 'emote' });
  connection.position = { x: 2, z: 3, angle: Math.PI / 2, jump: 0 };
  const throwAction = { type: 'throw' } as const;
  const second = connection.action(throwAction);
  connection.position.x = 7;
  connection.position.angle = -Math.PI;
  release();
  await Promise.all([first, second]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].position.x, 2);
  assert.equal(requests[1].position.angle, Math.PI / 2);
  assert.equal(requests[1].action.type, 'throw');
  assert.notEqual(requests[0].actionId, requests[1].actionId);
  connection.stop();
});
