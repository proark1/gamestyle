import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRoom } from '../../games/stack-or-sink/rooms';
import { type RoomStore, type Row } from './types';
import { handleFarmRoom } from '../../games/act-natural/rooms';
import { handleDeliveryRoom } from '../../games/uphill-delivery/rooms';
import { handleGiantRoom } from '../../games/dont-wake-the-giant/rooms';
import type { Session } from './session';

type Reply = {
  ok?: boolean;
  session?: Session;
  snapshot?: {
    code: string;
    host: string;
    world: { started: number; players: { id: string }[] };
  };
};
type Handler = (
  store: RoomStore,
  body: Record<string, unknown>,
  now: number,
) => Promise<Reply>;
const games: Record<string, { handle: Handler; prefix: string }> = {
  'stack-or-sink': { handle: handleRoom, prefix: '' },
  'act-natural': { handle: handleFarmRoom, prefix: 'act:' },
  'uphill-delivery': { handle: handleDeliveryRoom, prefix: 'delivery:' },
  'dont-wake-the-giant': { handle: handleGiantRoom, prefix: 'giant:' },
};
const NOW = 1_000_000;

class MemoryStore implements RoomStore {
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

async function fourPlayers(handle: Handler) {
  const store = new MemoryStore();
  const sessions: Session[] = [];
  for (let i = 0; i < 4; i++) {
    const reply = await handle(
      store,
      i === 0
        ? { op: 'create', name: 'Player 1' }
        : { op: 'join', code: sessions[0].code, name: `Player ${i + 1}` },
      NOW + i * 10,
    );
    assert.ok(reply.session);
    sessions.push(reply.session);
  }
  return { store, sessions };
}

for (const [game, { handle, prefix }] of Object.entries(games)) {
  void test(`${game}: leaving hands host to the next player in join order, through the entire crew`, async () => {
    const { store, sessions } = await fourPlayers(handle);
    for (let i = 0; i < 3; i++) {
      await handle(store, { op: 'leave', ...sessions[i] }, NOW + 100 + i * 10);
      // The newest player asking first must not become the host ahead of earlier members.
      const reply = await handle(
        store,
        { op: 'sync', ...sessions[3] },
        NOW + 101 + i * 10,
      );
      assert.equal(reply.snapshot?.host, sessions[i + 1].id);
      assert.equal(reply.snapshot?.code, sessions[0].code);
      assert.deepEqual(
        reply.snapshot?.world.players.map((p) => p.id),
        sessions.slice(i + 1).map((s) => s.id),
      );
      await assert.rejects(
        handle(store, { op: 'sync', ...sessions[i] }, NOW + 102 + i * 10),
        /expired/i,
      );
    }
    await handle(store, { op: 'leave', ...sessions[3] }, NOW + 200);
    const room = JSON.parse(
      store.rows.get(prefix + sessions[0].code)!.state,
    ) as { host: string };
    assert.equal(room.host, '', 'An empty room has no host');
  });

  void test(`${game}: an abrupt host timeout elects the earliest remaining joiner under concurrent requests`, async () => {
    const { store, sessions } = await fourPlayers(handle);
    for (const session of sessions.slice(1))
      await handle(store, { op: 'sync', ...session }, NOW + 20_000);
    store.conflicts = 2;
    const replies = await Promise.all(
      [sessions[3], sessions[2], sessions[1]].map((session) =>
        handle(store, { op: 'sync', ...session }, NOW + 30_100),
      ),
    );
    for (const reply of replies) {
      assert.equal(reply.snapshot?.host, sessions[1].id);
      assert.equal(reply.snapshot?.world.players.length, 3);
    }
    await assert.rejects(
      handle(store, { op: 'sync', ...sessions[0] }, NOW + 30_101),
      /expired/i,
    );
  });

  void test(`${game}: succession skips disconnected players ahead of the requester`, async () => {
    const { store, sessions } = await fourPlayers(handle);
    for (const session of sessions.slice(2))
      await handle(store, { op: 'sync', ...session }, NOW + 20_000);
    const reply = await handle(
      store,
      { op: 'sync', ...sessions[3] },
      NOW + 30_100,
    );
    assert.equal(reply.snapshot?.host, sessions[2].id);
    assert.deepEqual(
      reply.snapshot?.world.players.map((p) => p.id),
      [sessions[2].id, sessions[3].id],
    );
  });

  void test(`${game}: a returning former host rejoins at the back of the succession queue`, async () => {
    const { store, sessions } = await fourPlayers(handle);
    await handle(store, { op: 'leave', ...sessions[0] }, NOW + 100);
    const returned = await handle(
      store,
      { op: 'join', code: sessions[0].code, name: 'Player 1' },
      NOW + 110,
    );
    assert.ok(returned.session);
    assert.notEqual(returned.session.id, sessions[0].id);
    assert.equal(returned.snapshot?.host, sessions[1].id);
    for (let i = 1; i < 4; i++) {
      await handle(store, { op: 'leave', ...sessions[i] }, NOW + 120 + i * 10);
      const reply = await handle(
        store,
        { op: 'sync', ...returned.session },
        NOW + 121 + i * 10,
      );
      assert.equal(
        reply.snapshot?.host,
        i < 3 ? sessions[i + 1].id : returned.session.id,
      );
    }
  });

  void test(`${game}: brief connection loss keeps the host and does not reorder the crew`, async () => {
    const { store, sessions } = await fourPlayers(handle);
    const waiting = await handle(
      store,
      { op: 'sync', ...sessions[3] },
      NOW + 29_000,
    );
    assert.equal(waiting.snapshot?.host, sessions[0].id);
    const returned = await handle(
      store,
      { op: 'sync', ...sessions[0] },
      NOW + 29_100,
    );
    assert.equal(returned.snapshot?.host, sessions[0].id);
    assert.deepEqual(
      returned.snapshot?.world.players.map((p) => p.id),
      sessions.map((s) => s.id),
    );
  });

  void test(`${game}: only the successor gains host controls, without starting a new round`, async () => {
    const { store, sessions } = await fourPlayers(handle);
    await handle(
      store,
      {
        op: 'action',
        ...sessions[0],
        action: { type: 'start' },
        requestId: 'start-round',
      },
      NOW + 100,
    );
    const before = JSON.parse(
      store.rows.get(prefix + sessions[0].code)!.state,
    ) as { world: { started: number } };
    await handle(store, { op: 'leave', ...sessions[0] }, NOW + 250);
    const next = await handle(store, { op: 'sync', ...sessions[2] }, NOW + 260);
    assert.equal(next.snapshot?.host, sessions[1].id);
    assert.equal(
      next.snapshot?.world.started,
      before.world.started,
      'Host handover must not start a new round',
    );
    // Complete the round before exercising restart, as some games prohibit restarting mid-round.
    const row = store.rows.get(prefix + sessions[0].code)!;
    const finished = JSON.parse(row.state) as { world: { phase: string } };
    finished.world.phase =
      game === 'act-natural'
        ? 'cows-win'
        : game === 'dont-wake-the-giant'
          ? 'ended'
          : 'won';
    row.state = JSON.stringify(finished);
    await assert.rejects(
      handle(
        store,
        {
          op: 'action',
          ...sessions[2],
          action: { type: 'restart' },
          requestId: 'not-host',
        },
        NOW + 270,
      ),
      /host|captain|leader/i,
    );
    const restarted = await handle(
      store,
      {
        op: 'action',
        ...sessions[1],
        action: { type: 'restart' },
        requestId: 'new-host',
      },
      NOW + 280,
    );
    assert.equal(restarted.snapshot?.host, sessions[1].id);
    assert.equal(restarted.snapshot?.world.started, NOW + 280);
  });
}
