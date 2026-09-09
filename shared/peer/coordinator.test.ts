import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlePeerRoom, peerStorageCode } from './coordinator';
import {
  HOST_LEASE_MS,
  PeerError,
  type PeerSession,
  type PeerView,
} from './types';
import { openCheckpoint, sealCheckpoint } from './crypto';
import type { GameId } from '../audio/types';
import type { RoomStore, Row } from '../rooms/types';

export class PeerMemoryStore implements RoomStore {
  rows = new Map<string, Row>();
  conflicts = 0;
  async get(code: string) {
    const row = this.rows.get(code);
    return row ? { ...row } : null;
  }
  async insert(row: Row) {
    if (this.rows.has(row.code)) return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
  async compareAndSwap(row: Row, version: number) {
    if (this.conflicts > 0) {
      this.conflicts--;
      return false;
    }
    if (this.rows.get(row.code)?.version !== version) return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
}
const NOW = 1_000_000;

void test('peer signals strip unrecognized fields and bound the total persisted queue', async () => {
  const { store, sessions, call } = await crew('stack-or-sink');
  const signal = (id: string) => ({
    id,
    to: sessions[1].id,
    instance: 'browser-1',
    link: 'link',
    candidate: { candidate: 'candidate:1', unused: 'x'.repeat(200_000) },
  });
  await call(0, 'signal', NOW + 1, { signals: [signal('first')] });
  const stored = store.rows.get(
    peerStorageCode('stack-or-sink', sessions[0].code),
  )!;
  assert.ok(stored.state.length < 5000);
  const delivered = await call(1, 'poll', NOW + 2);
  assert.equal(delivered.view.signals[0].candidate?.candidate, 'candidate:1');
  assert.equal('unused' in delivered.view.signals[0].candidate!, false);
  await assert.rejects(
    call(0, 'signal', NOW + 3, {
      signals: Array.from({ length: 16 }, (_, i) => ({
        ...signal(`offer-${i}`),
        description: { type: 'offer', sdp: 'a'.repeat(16_000) },
      })),
    }),
    (e: unknown) => e instanceof PeerError && e.status === 429,
  );
  assert.equal(
    (await call(1, 'poll', NOW + 4)).view.signals.length,
    1,
    'Rejected payloads never replace the stored queue',
  );
});
async function crew(game: GameId) {
  const store = new PeerMemoryStore(),
    sessions: PeerSession[] = [],
    views: PeerView[] = [];
  for (let i = 0; i < 4; i++) {
    const reply = await handlePeerRoom(
      store,
      {
        game,
        op: i ? 'join' : 'create',
        code: sessions[0]?.code,
        name: `Player ${i}`,
      },
      NOW,
    );
    assert.ok(reply.session);
    sessions.push(reply.session);
    views.push(
      (
        await handlePeerRoom(
          store,
          { ...reply.session, op: 'hello', instance: `browser-${i}` },
          NOW,
        )
      ).view,
    );
  }
  const call = (i: number, op: string, now: number, extra: object = {}) =>
    handlePeerRoom(
      store,
      { ...sessions[i], op, instance: `browser-${i}`, epoch: 1, ...extra },
      now,
    );
  return { store, sessions, views, call };
}
for (const game of [
  'stack-or-sink',
  'act-natural',
  'uphill-delivery',
  'dont-wake-the-giant',
] as const) {
  void test(`${game}: peer coordinator recovers an encrypted checkpoint with exactly one successor and fences the old host`, async () => {
    const { store, sessions, views, call } = await crew(game);
    const scope = `${game}:${sessions[0].code}`,
      value = { progress: 42, hiddenRoles: ['cow-1'] };
    const checkpoint = await sealCheckpoint(value, views[0].key!, scope, 1, 20);
    await call(0, 'checkpoint', NOW + 50, { checkpoint, open: false });
    for (let i = 1; i < 4; i++) await call(i, 'poll', NOW + 4000);
    store.conflicts = 3;
    const replies = await Promise.all(
      [3, 2, 1].map((i) => call(i, 'poll', NOW + HOST_LEASE_MS + 100)),
    );
    for (let i = 0; i < replies.length; i++) {
      assert.equal(replies[i].view.host, sessions[1].id);
      assert.equal(replies[i].view.epoch, 2);
      assert.equal(replies[i].view.members.length, 3);
      if (i < 2) {
        assert.equal(replies[i].view.key, undefined);
        assert.equal(replies[i].view.checkpoint, undefined);
      }
    }
    const recovery = replies[2].view;
    assert.notEqual(
      recovery.key,
      views[0].key,
      'Each host generation gets a fresh encryption key',
    );
    assert.ok(recovery.checkpoint);
    assert.deepEqual(
      await openCheckpoint(recovery.checkpoint, recovery.checkpoint.key, scope),
      value,
    );
    await assert.rejects(
      openCheckpoint(recovery.checkpoint, recovery.key!, scope),
    );
    await assert.rejects(
      call(0, 'checkpoint', NOW + 8200, { checkpoint }),
      (e: unknown) => e instanceof PeerError && e.status === 401,
    );
    await assert.rejects(
      call(1, 'checkpoint', NOW + 8200, { checkpoint, epoch: 1 }),
      (e: unknown) => e instanceof PeerError && e.status === 409,
    );
    const newCheckpoint = await sealCheckpoint(
      { progress: 43 },
      recovery.key!,
      scope,
      2,
      30,
    );
    await call(1, 'checkpoint', NOW + 8300, {
      checkpoint: newCheckpoint,
      epoch: 2,
      open: false,
    });
    await call(2, 'poll', NOW + 12000, { epoch: 2 });
    await call(3, 'poll', NOW + 12000, { epoch: 2 });
    const next = (await call(2, 'poll', NOW + 16500, { epoch: 2 })).view;
    assert.equal(next.host, sessions[2].id);
    assert.equal(next.epoch, 3);
    assert.deepEqual(
      await openCheckpoint(next.checkpoint!, next.checkpoint!.key, scope),
      { progress: 43 },
    );
  });
  void test(`${game}: graceful peer handover preserves join order and does not disclose recovery keys`, async () => {
    const { sessions, call } = await crew(game);
    await call(0, 'leave', NOW + 100);
    const observer = (await call(3, 'poll', NOW + 110)).view;
    assert.equal(observer.host, sessions[1].id);
    assert.equal(observer.key, undefined);
    await call(1, 'leave', NOW + 120, { epoch: 2 });
    assert.equal(
      (await call(3, 'poll', NOW + 130, { epoch: 2 })).view.host,
      sessions[2].id,
    );
  });
}
void test('expired authority cannot be revived by a late heartbeat from the former host', async () => {
  const { sessions, call } = await crew('stack-or-sink');
  await call(1, 'poll', NOW + 4000);
  await assert.rejects(call(0, 'poll', NOW + HOST_LEASE_MS + 1), /expired/);
  assert.equal(
    (await call(1, 'poll', NOW + HOST_LEASE_MS + 2)).view.host,
    sessions[1].id,
  );
});
void test('succession skips stale players and players who never established a browser connection', async () => {
  const { store, sessions, call } = await crew('stack-or-sink');
  await call(0, 'poll', NOW + 7000);
  await call(2, 'poll', NOW + 7000);
  await call(3, 'leave', NOW + 7000);
  await handlePeerRoom(
    store,
    {
      game: 'stack-or-sink',
      code: sessions[0].code,
      op: 'join',
      name: 'Unconnected',
    },
    NOW + 7100,
  );
  const next = (await call(0, 'leave', NOW + 8100)).view;
  assert.equal(next.host, sessions[2].id, 'The stale second player is skipped');
  const ended = (await call(2, 'leave', NOW + 8200, { epoch: next.epoch }))
    .view;
  assert.equal(ended.host, '', 'An unfinished join cannot become host');
});
void test('peer signalling authenticates sender and recipient, rejects other games, and deduplicates retries', async () => {
  const { store, sessions, call } = await crew('act-natural');
  const signal = {
    id: 'signal-1',
    to: sessions[1].id,
    instance: 'browser-1',
    link: 'link-1',
    description: { type: 'offer', sdp: 'test-sdp' },
    from: sessions[2].id,
  };
  await call(0, 'signal', NOW + 100, { signals: [signal] });
  await call(0, 'signal', NOW + 110, { signals: [signal] });
  const recipient = (await call(1, 'poll', NOW + 120)).view;
  assert.equal(recipient.signals.length, 1);
  assert.equal(recipient.signals[0].from, sessions[0].id);
  assert.equal((await call(2, 'poll', NOW + 120)).view.signals.length, 0);
  assert.equal(
    (await call(1, 'poll', NOW + 130, { cursor: recipient.cursor })).view
      .signals.length,
    0,
  );
  await assert.rejects(
    call(0, 'signal', NOW + 140, { token: 'forged', signals: [signal] }),
    /expired/,
  );
  await assert.rejects(
    handlePeerRoom(
      store,
      {
        ...sessions[0],
        game: 'dont-wake-the-giant',
        op: 'hello',
        instance: 'browser-0',
      },
      NOW + 140,
    ),
    /not found/,
  );
  assert.ok(
    !store.rows
      .get(peerStorageCode('act-natural', sessions[0].code))!
      .state.includes(sessions[0].token),
  );
});
void test('a reloaded host changes generation, and the previous browser instance loses access', async () => {
  const { call } = await crew('uphill-delivery');
  const reloaded = (
    await call(0, 'hello', NOW + 100, { instance: 'replacement' })
  ).view;
  assert.equal(reloaded.epoch, 2);
  await assert.rejects(call(0, 'poll', NOW + 120), /another tab/);
});
void test('admission locks before start; only the host can publish checkpoints or lock admission', async () => {
  const { store, sessions, views, call } = await crew('dont-wake-the-giant');
  await call(3, 'leave', NOW + 100);
  await assert.rejects(call(1, 'lock', NOW + 110), /new host/);
  await call(0, 'lock', NOW + 120);
  await assert.rejects(
    handlePeerRoom(
      store,
      {
        game: 'dont-wake-the-giant',
        code: sessions[0].code,
        op: 'join',
        name: 'Late',
      },
      NOW + 130,
    ),
    /in progress/,
  );
  const cp = await sealCheckpoint(
    { test: true },
    views[0].key!,
    `dont-wake-the-giant:${sessions[0].code}`,
    1,
    10,
  );
  await assert.rejects(
    call(1, 'checkpoint', NOW + 140, { checkpoint: cp }),
    /new host/,
  );
  await call(0, 'checkpoint', NOW + 150, { checkpoint: cp, open: true });
  const fresh = await handlePeerRoom(
    store,
    {
      game: 'dont-wake-the-giant',
      code: sessions[0].code,
      op: 'join',
      name: 'Late',
    },
    NOW + 160,
  );
  assert.equal(fresh.view.members.at(-1)?.order, 4);
});
void test('checkpoint encryption binds room and generation and detects tampering', async () => {
  const { views } = await crew('act-natural');
  const cp = await sealCheckpoint(
    { hidden: 'cow-7' },
    views[0].key!,
    'act-natural:ABCDEF',
    1,
    10,
  );
  await assert.rejects(openCheckpoint(cp, views[0].key!, 'act-natural:OTHER2'));
  await assert.rejects(
    openCheckpoint({ ...cp, epoch: 2 }, views[0].key!, 'act-natural:ABCDEF'),
  );
  await assert.rejects(
    openCheckpoint(
      { ...cp, data: 'AAAA' + cp.data.slice(4) },
      views[0].key!,
      'act-natural:ABCDEF',
    ),
  );
});
