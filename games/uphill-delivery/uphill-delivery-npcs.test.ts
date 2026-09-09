import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleDeliveryRoom } from './rooms';
import { createEngine } from './peer';
import { handlePeerRoom } from '../../shared/peer/coordinator';
import { sealCheckpoint } from '../../shared/peer/crypto';
import type { RoomStore, Row } from '../../shared/rooms/types';
import type { DeliverySession, DeliverySnapshot, DeliveryWorld } from './types';
import { deliveryPath } from './npc-path';
import { ROUTE } from './level';

const NOW = 100000;
class Memory implements RoomStore {
  rows = new Map<string, Row>();
  async get(code: string) {
    return this.rows.get(code) ?? null;
  }
  async insert(row: Row) {
    if (this.rows.has(row.code)) return false;
    this.rows.set(row.code, row);
    return true;
  }
  async compareAndSwap(row: Row, version: number) {
    if (this.rows.get(row.code)?.version !== version) return false;
    this.rows.set(row.code, row);
    return true;
  }
}
type Reply = { session: DeliverySession; snapshot: DeliverySnapshot };
void test('HTTP NPC seats enforce host authority, exact slots, replay, human capacity and human succession', async () => {
  const store = new Memory();
  const host = (await handleDeliveryRoom(
    store,
    { op: 'create' },
    NOW,
  )) as Reply;
  const guest = (await handleDeliveryRoom(
    store,
    { op: 'join', code: host.session.code },
    NOW,
  )) as Reply;
  const action = (
    session: DeliverySession,
    value: unknown,
    requestId: string,
    now = NOW,
  ) =>
    handleDeliveryRoom(
      store,
      { ...session, op: 'action', action: value, requestId },
      now,
    ) as Promise<Reply>;
  await assert.rejects(
    action(guest.session, { type: 'fill-npcs' }, 'forbidden'),
    /leader/,
  );
  await assert.rejects(
    action(host.session, { type: 'add-npc', slot: 0 }, 'occupied'),
    /empty/,
  );
  await assert.rejects(
    action(host.session, { type: 'add-npc', slot: 4 }, 'invalid'),
    /empty/,
  );
  const added = await action(host.session, { type: 'add-npc', slot: 3 }, 'add');
  const npc = added.snapshot.world.players.find((p) => p.bot)!;
  assert.equal(npc.color, 3);
  const replay = await action(
    host.session,
    { type: 'add-npc', slot: 3 },
    'add',
  );
  assert.deepEqual(replay.snapshot.world.players, added.snapshot.world.players);
  const filled = await action(host.session, { type: 'fill-npcs' }, 'fill');
  assert.equal(filled.snapshot.world.players.length, 4);
  await assert.rejects(
    handleDeliveryRoom(store, { op: 'join', code: host.session.code }, NOW),
    /full/,
  );
  await action(host.session, { type: 'start' }, 'start');
  await assert.rejects(
    action(host.session, { type: 'remove-npc', target: npc.id }, 'during'),
    /Finish/,
  );
  await handleDeliveryRoom(store, { ...host.session, op: 'leave' }, NOW);
  const resumed = (await handleDeliveryRoom(
    store,
    { ...guest.session, op: 'sync' },
    NOW + 31000,
  )) as Reply;
  assert.equal(resumed.snapshot.host, guest.session.id);
  assert.equal(resumed.snapshot.world.players.filter((p) => p.bot).length, 2);
  assert.equal(resumed.snapshot.world.npcBrains, undefined);
  await assert.rejects(
    handleDeliveryRoom(
      store,
      { ...guest.session, id: npc.id, op: 'sync' },
      NOW + 31000,
    ),
    /expired/,
  );
});

void test('peer NPC fill and human join serialize through the same four-seat capacity', async () => {
  const store = new Memory();
  const created = await handlePeerRoom(
    store,
    { game: 'uphill-delivery', op: 'create' },
    NOW,
  );
  const session = created.session!;
  const call = (op: string, extra: object = {}) =>
    handlePeerRoom(
      store,
      { ...session, instance: 'browser', epoch: 1, op, ...extra },
      NOW,
    );
  await call('hello');
  const results = await Promise.allSettled([
    call('npc', { action: { type: 'fill-npcs' }, requestId: 'fill' }),
    handlePeerRoom(
      store,
      { game: 'uphill-delivery', op: 'join', code: session.code },
      NOW,
    ),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  const { view } = await call('poll');
  const occupants = [...view.members, ...view.npcs!.slots];
  assert.equal(occupants.length, 4);
  assert.equal(new Set(occupants.map((p) => p.color)).size, 4);
  const replay = await call('npc', {
    action: { type: 'fill-npcs' },
    requestId: 'fill',
  });
  assert.deepEqual(replay.view.npcs, view.npcs);
  assert.equal(
    view.members.some((p) => p.id.startsWith('npc-')),
    false,
  );
  const slot = view.npcs!.slots[0];
  await call('npc', {
    action: { type: 'remove-npc', target: slot.id },
    requestId: 'remove',
  });
  await assert.rejects(
    call('npc', {
      action: { type: 'remove-npc', target: slot.id },
      requestId: 'stale-remove',
    }),
    /already left/,
  );
  const beforeLock = (await call('poll')).view;
  const checkpoint = await sealCheckpoint(
    {},
    beforeLock.key!,
    `uphill-delivery:${session.code}`,
    1,
    50,
  );
  const locked = (await call('lock')).view;
  await assert.rejects(
    call('checkpoint', {
      checkpoint,
      open: true,
      rosterRevision: beforeLock.npcs!.revision,
    }),
    /crew changed/,
  );
  await assert.rejects(
    call('npc', { action: { type: 'fill-npcs' }, requestId: 'late-fill' }),
    /Finish/,
  );
  assert.equal((await call('poll')).view.open, false);
  assert.ok(locked.npcs!.revision > beforeLock.npcs!.revision);
});

void test('NPC brains survive peer checkpoints; network inputs cannot impersonate autonomous workers', () => {
  const human = {
    id: 'human',
    name: 'Host',
    color: 0,
    order: 0,
    instance: 'tab',
    seen: NOW,
  };
  const slots = [1, 2, 3].map((color) => ({
    id: `npc-${color}`,
    name: `NPC ${color}`,
    color,
  }));
  const engine = createEngine(NOW);
  engine.reconcile([human], { revision: 2, slots });
  assert.deepEqual(
    engine.execute(human.id, 'start', { type: 'start' }, human.id),
    {},
  );
  for (let i = 0; i < 60; i++) {
    engine.reconcile([human], { revision: 2, slots });
    engine.advance(50);
  }
  const world = engine.world as DeliveryWorld;
  assert.equal(world.players.length, 4);
  assert.equal(world.players.filter((p) => p.bot && p.grip !== null).length, 3);
  assert.ok(
    world.sofa.x > -10,
    'NPCs must move the physical sofa from the depot',
  );
  const npc = world.players.find((p) => p.bot)!;
  const input = structuredClone(npc.input);
  engine.input(npc.id, { x: -1, z: 1 }, 999);
  assert.deepEqual(npc.input, input);
  assert.ok(
    engine.execute(npc.id, 'forged', { type: 'release' }, human.id).error,
  );
  const checkpoint = engine.checkpoint();
  const restored = createEngine(NOW + 90000, checkpoint);
  restored.reconcile([human], { revision: 2, slots });
  assert.deepEqual(
    (restored.world as DeliveryWorld).npcBrains,
    world.npcBrains,
  );
  assert.deepEqual((restored.world as DeliveryWorld).sofa, world.sofa);
  restored.reconcile([human], { revision: 1, slots: [] });
  assert.equal(restored.world.players.length, 4);
  restored.execute(human.id, 'restart', { type: 'restart' }, human.id);
  assert.equal((restored.world as DeliveryWorld).npcBrains, undefined);
  assert.equal((restored.world as DeliveryWorld).npcTeam, undefined);
  assert.equal(
    (restored.world as DeliveryWorld).players.filter((p) => p.bot).length,
    3,
  );
});

void test('height-aware paths reconnect the catchment and every route landing without crossing floors', () => {
  for (const goal of ROUTE) {
    const path = deliveryPath({ x: 12, y: -0.6, z: 1 }, goal);
    assert.ok(path.length, `No path to ${JSON.stringify(goal)}`);
    assert.deepEqual(
      path.at(-1),
      goal,
      `Only a partial path reaches ${JSON.stringify(goal)}`,
    );
    for (let i = 1; i < path.length; i++) {
      assert.ok(Math.abs(path[i].y - path[i - 1].y) < 1.31);
      assert.ok(
        Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z) <= 4.1,
      );
    }
  }
});
