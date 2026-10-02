import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVoicePeer } from './peer-coordinator';
import { hashToken } from '../rooms/identity';
import { storageCode } from './membership';
import type { RoomStore, Row } from '../rooms/types';
import type { Game } from '../games/identity';

void test('server-game voice uses authenticated, isolated peer signaling with rejoin and departure cleanup', async () => {
  const rows = new Map<string, Row>();
  const store: RoomStore = {
    get: async (code) => rows.get(code) ?? null,
    insert: async (row) => {
      if (rows.has(row.code)) return false;
      rows.set(row.code, row);
      return true;
    },
    compareAndSwap: async (row, version) => {
      if (rows.get(row.code)?.version !== version) return false;
      rows.set(row.code, row);
      return true;
    },
  };
  const now = Date.now();
  const members = {
    alice: await hashToken('alice-pass'),
    bob: await hashToken('bob-pass'),
  };
  const sources = new Map<string, Row>();
  for (const game of ['chaos', 'first-person', 'shelf-control'] as const)
    sources.set(game, {
      code: 'ABCDEF',
      updated: now,
      version: 0,
      state: JSON.stringify({
        members,
        world: {
          players: [
            { id: 'alice', name: 'Alice', seen: now },
            { id: 'bob', name: 'Bob', seen: now },
          ],
        },
      }),
    });
  const call = (
    game: Game,
    id: string,
    extra: Record<string, unknown> = {},
    at = now,
  ) =>
    handleVoicePeer(
      store,
      {
        get: async (code) =>
          code === storageCode(game, 'ABCDEF')
            ? (sources.get(game) ?? null)
            : null,
      },
      {
        game,
        code: 'ABCDEF',
        id,
        token: `${id}-pass`,
        instance: `${id}-browser`,
        op: 'hello',
        ...extra,
      },
      at,
    );
  await Promise.all([call('chaos', 'alice'), call('chaos', 'bob')]);
  assert.equal(
    (await call('chaos', 'alice', { op: 'poll' })).view.members.length,
    2,
  );
  await assert.rejects(call('chaos', 'alice', { token: 'forged' }), /expired/);
  await assert.rejects(call('chaos', 'alice', { op: 'create' }), /Unknown/);
  await assert.rejects(
    call('chaos', 'alice', { op: 'poll', instance: 'stolen-browser' }),
    /expired/,
  );
  const signal = {
    id: 'signal1',
    to: 'bob',
    instance: 'bob-browser',
    link: 'link1',
    description: { type: 'offer', sdp: 'test' },
  };
  await call('chaos', 'alice', { op: 'signal', signals: [signal, signal] });
  const reply = await call('chaos', 'bob', { op: 'poll' });
  assert.equal(reply.view.signals.length, 1);
  assert.equal(reply.view.signals[0].from, 'alice');
  for (const game of ['first-person', 'shelf-control'] as const) {
    const isolated = await call(game, 'bob');
    assert.equal(isolated.view.members.length, 1);
    assert.equal(isolated.view.signals.length, 0);
  }
  await call('chaos', 'bob', { instance: 'bob-new' });
  assert.equal(
    (await call('chaos', 'bob', { instance: 'bob-new', op: 'poll' })).view
      .signals.length,
    0,
  );
  await call('chaos', 'bob', { instance: 'bob-new', op: 'leave' });
  assert.equal(
    (await call('chaos', 'alice', { op: 'poll' })).view.members.length,
    1,
  );
  await call('chaos', 'bob');
  const row = sources.get('chaos')!;
  const state = JSON.parse(row.state);
  delete state.members.bob;
  sources.set('chaos', { ...row, state: JSON.stringify(state) });
  assert.equal(
    (await call('chaos', 'alice', { op: 'poll' })).view.members.length,
    1,
  );
  await assert.rejects(call('chaos', 'bob'), /expired/);
  await assert.rejects(call('chaos', 'alice', {}, now + 31000), /expired/);
  await assert.rejects(
    call('first-person', 'bob', {
      op: 'signal',
      signals: [
        {
          ...signal,
          to: 'alice',
          description: { type: 'offer', sdp: 'x'.repeat(130000) },
        },
      ],
    }),
    /Invalid/,
  );
});
