import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceFarm,
  farmAction,
  farmMove,
  farmPlayer,
  farmSnapshot,
  freshFarm,
  removeFarmPlayer,
} from './simulation';
import { handleFarmRoom } from './rooms';
import {
  GATE,
  PANEL,
  LADDER_EXIT,
  ROUND_MS,
  type FarmSession,
  type FarmSnapshot,
  type FarmWorld,
} from './types';
import { handleRoom } from '../stack-or-sink/rooms';
import { type RoomStore, type Row } from '../../shared/rooms/types';
const NOW = 100000;
function round(count = 4) {
  const w = freshFarm(NOW, 819);
  w.players = Array.from({ length: count }, (_, i) =>
    farmPlayer(`p${i}`, `Player ${i}`, NOW),
  );
  farmAction(w, 'p0', { type: 'start' }, 'p0');
  return w;
}
const fake = (w: FarmWorld, id = 'p1') =>
  w.cows.find((c) => c.id === w.players.find((p) => p.id === id)!.cowId)!;
void test('roles rotate, cow assignments are unique, and fresh rounds reset objectives', () => {
  const w = round();
  assert.equal(w.farmerId, 'p0');
  assert.equal(
    new Set(w.players.filter((p) => p.cowId).map((p) => p.cowId)).size,
    3,
  );
  w.phase = 'farmer-win';
  w.powerOff = true;
  w.keysDelivered = 2;
  farmAction(w, 'p0', { type: 'restart' }, 'p0');
  assert.equal(w.farmerId, 'p1');
  assert.equal(w.powerOff, false);
  assert.equal(w.keysDelivered, 0);
  assert.equal(w.inspections, 5);
});
void test('farmer snapshots reveal no cow ownership, random seed, inputs or computer suspicion', () => {
  const w = round();
  const view = farmSnapshot(w, 'ABCDEF', 'p0', 'p0', 0);
  assert.equal(view.you.cowId, null);
  for (const p of view.world.players) assert.equal('cowId' in p, false);
  for (const field of [
    'seed',
    'aiSuspicion',
    'cowRoutines',
    'farmerId',
    'lastInspection',
  ])
    assert.equal(field in view.world, false);
  assert.ok(!JSON.stringify(view).includes('input'));
  const cowView = farmSnapshot(w, 'ABCDEF', 'p0', 'p1', 0);
  assert.equal(cowView.you.cowId, fake(w).id);
});
void test('inspection requires proximity and farmer role, spends one charge and captures only fake cows', () => {
  const w = round();
  const cow = fake(w);
  Object.assign(w.farmer, { x: -9, z: -9 });
  Object.assign(cow, { x: 9, z: 9 });
  assert.throws(
    () => farmAction(w, 'p0', { type: 'inspect', target: cow.id }, 'p0'),
    /closer/,
  );
  assert.equal(w.inspections, 5);
  assert.throws(
    () => farmAction(w, 'p1', { type: 'inspect', target: cow.id }, 'p0'),
    /Only the farmer/,
  );
  Object.assign(w.farmer, { x: cow.x, z: cow.z });
  farmAction(w, 'p0', { type: 'inspect', target: cow.id }, 'p0');
  assert.ok(cow.captured);
  assert.equal(w.inspections, 4);
  const ordinary = w.cows.find(
    (c) => !w.players.some((p) => p.cowId === c.id),
  )!;
  w.clock += 2000;
  Object.assign(w.farmer, { x: ordinary.x, z: ordinary.z });
  farmAction(w, 'p0', { type: 'inspect', target: ordinary.id }, 'p0');
  assert.equal(ordinary.captured, false);
  assert.equal(w.inspections, 3);
});
void test('five ordinary inspections exhaust the farmer; random checking cannot clear the herd', () => {
  const w = round();
  for (const c of w.cows
    .filter((c) => !w.players.some((p) => p.cowId === c.id))
    .slice(0, 5)) {
    w.clock += 2000;
    Object.assign(w.farmer, { x: c.x, z: c.z });
    farmAction(w, 'p0', { type: 'inspect', target: c.id }, 'p0');
  }
  assert.equal(w.inspections, 0);
  assert.throws(
    () => farmAction(w, 'p0', { type: 'inspect', target: fake(w).id }, 'p0'),
    /No inspections/,
  );
  assert.equal(w.phase, 'playing');
});
void test('keys must be picked up and delivered; electricity blocks escape', () => {
  const w = round(2),
    c = fake(w);
  Object.assign(c, GATE);
  assert.throws(
    () => farmAction(w, 'p1', { type: 'interact' }, 'p0'),
    /still live/,
  );
  for (const item of w.items.filter((i) => i.kind === 'key')) {
    Object.assign(c, { x: item.x, z: item.z });
    farmAction(w, 'p1', { type: 'interact' }, 'p0');
    assert.equal(c.carrying, item.id);
    Object.assign(c, GATE);
    farmAction(w, 'p1', { type: 'interact' }, 'p0');
  }
  assert.equal(w.keysDelivered, 2);
  assert.throws(
    () => farmAction(w, 'p1', { type: 'interact' }, 'p0'),
    /still live/,
  );
  w.powerOff = true;
  farmAction(w, 'p1', { type: 'interact' }, 'p0');
  assert.equal(c.escaped, true);
  assert.equal(w.phase, 'cows-win');
});
void test('sabotage takes four stationary seconds and movement cancels it', () => {
  const w = round(),
    c = fake(w),
    p = w.players[1];
  Object.assign(c, PANEL);
  farmAction(w, 'p1', { type: 'interact' }, 'p0');
  for (let i = 1; i <= 20; i++) {
    p.seen = NOW + i * 100;
    advanceFarm(w, NOW + i * 100);
  }
  assert.ok(c.task > 0.4 && c.task < 0.6);
  p.input.x = 1;
  p.seen = w.clock + 100;
  advanceFarm(w, w.clock + 100);
  assert.equal(c.task, 0);
  assert.equal(w.powerOff, false);
  p.input.x = 0;
  Object.assign(c, PANEL);
  farmAction(w, 'p1', { type: 'interact' }, 'p0');
  for (let i = 0; i < 41; i++) {
    p.seen = w.clock + 100;
    advanceFarm(w, w.clock + 100);
  }
  assert.equal(w.powerOff, true);
});
void test('ladder is a visible, slower alternative exit that still needs power off', () => {
  const w = round(2),
    c = fake(w),
    ladder = w.items.find((i) => i.kind === 'ladder')!;
  Object.assign(c, { x: ladder.x, z: ladder.z });
  farmAction(w, 'p1', { type: 'interact' }, 'p0');
  assert.equal(c.carrying, 'ladder');
  Object.assign(c, LADDER_EXIT);
  farmAction(w, 'p1', { type: 'interact' }, 'p0');
  assert.equal(w.ladderPlaced, true);
  assert.throws(
    () => farmAction(w, 'p1', { type: 'interact' }, 'p0'),
    /still live/,
  );
  w.powerOff = true;
  farmAction(w, 'p1', { type: 'interact' }, 'p0');
  assert.equal(w.phase, 'cows-win');
  assert.equal(w.keysDelivered, 0);
});
void test('timeout honors wall time, and an escaped teammate secures the cow victory', () => {
  const w = round();
  advanceFarm(w, NOW + ROUND_MS);
  assert.equal(w.phase, 'farmer-win');
  const escaped = round();
  fake(escaped).escaped = true;
  advanceFarm(escaped, NOW + ROUND_MS);
  assert.equal(escaped.phase, 'cows-win');
});
void test('disconnect drops stolen items and a departing farmer returns the room to lobby', () => {
  const w = round(),
    c = fake(w),
    item = w.items[0];
  Object.assign(c, { x: item.x, z: item.z });
  farmAction(w, 'p1', { type: 'interact' }, 'p0');
  removeFarmPlayer(w, 'p1');
  assert.equal(item.holder, null);
  assert.equal(c.carrying, null);
  removeFarmPlayer(w, 'p0');
  assert.equal(w.phase, 'lobby');
});
void test('movement cannot cross fences or accelerate diagonally', () => {
  const a = { x: 0, z: 0, angle: 0 },
    b = { ...a };
  farmMove(a, { x: 1, z: 1 }, 2.6, 1);
  farmMove(b, { x: 1, z: 0 }, 2.6, 1);
  assert.ok(Math.abs(Math.hypot(a.x, a.z) - b.x) < 0.0001);
  farmMove(a, { x: 1, z: 1 }, 100, 5);
  assert.ok(a.x < 10 && a.z < 10);
});
void test('grazing and walking stay mixed in different directions throughout full rounds', () => {
  for (const seed of [12, 819, 5021, 19429]) {
    const w = freshFarm(NOW, seed);
    w.players = [farmPlayer('p0', 'Farmer', NOW), farmPlayer('p1', 'Cow', NOW)];
    farmAction(w, 'p0', { type: 'start' }, 'p0');
    let mixed = 0,
      diverging = 0,
      samples = 0;
    for (let elapsed = 100; elapsed < ROUND_MS; elapsed += 100) {
      advanceFarm(w, NOW + elapsed);
      const ordinary = w.cows.filter(
        (c) => !w.players.some((p) => p.cowId === c.id),
      );
      assert.ok(
        ordinary.every((c) => Math.abs(c.x) <= 9.4 && Math.abs(c.z) <= 9.4),
      );
      if (elapsed % 2000 !== 0) continue;
      samples++;
      const walkers = ordinary.filter((c) => c.moving);
      if (walkers.length >= 2 && ordinary.filter((c) => c.grazing).length >= 2)
        mixed++;
      if (
        walkers.some((a) =>
          walkers.some((b) => Math.cos(a.angle - b.angle) < 0.2),
        )
      )
        diverging++;
    }
    assert.ok(
      mixed / samples > 0.85,
      `seed ${seed}: ${mixed}/${samples} mixed samples`,
    );
    assert.ok(
      diverging / samples > 0.8,
      `seed ${seed}: ${diverging}/${samples} different-direction samples`,
    );
  }
});
void test('cow activity changes individually instead of following the old shared countdown', () => {
  const w = round();
  const ordinary = () =>
    w.cows.filter((c) => !w.players.some((p) => p.cowId === c.id));
  advanceFarm(w, NOW + 100);
  let previous = ordinary().map((c) => `${c.grazing}:${c.moving}`);
  let largestChange = 0,
    transitions = 0;
  for (let elapsed = 200; elapsed < 30000; elapsed += 100) {
    advanceFarm(w, NOW + elapsed);
    const next = ordinary().map((c) => `${c.grazing}:${c.moving}`);
    const changed = next.filter((state, i) => state !== previous[i]).length;
    largestChange = Math.max(largestChange, changed);
    transitions += changed;
    previous = next;
  }
  assert.ok(transitions > 30, 'cows continue changing their own activities');
  assert.ok(
    largestChange < ordinary().length / 2,
    'no simultaneous herd-wide switch',
  );
});
void test('private cow routines survive serialization and initialize for older saved rooms', () => {
  const w = round();
  advanceFarm(w, NOW + 300);
  const restored = JSON.parse(JSON.stringify(w)) as FarmWorld;
  for (let elapsed = 400; elapsed <= 12000; elapsed += 100) {
    advanceFarm(w, NOW + elapsed);
    advanceFarm(restored, NOW + elapsed);
  }
  assert.deepEqual(restored, w);
  delete restored.cowRoutines;
  advanceFarm(restored, restored.clock + 100);
  const routines = restored.cowRoutines;
  assert.ok(routines && Object.keys(routines).length === 15);
  assert.ok(
    restored.cows.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z)),
  );
  assert.equal(
    'cowRoutines' in farmSnapshot(restored, 'ABCDEF', 'p0', 'p0', 1).world,
    false,
  );
});
void test('ordinary grazing, idle pauses and varied walking do not expose the solo player', () => {
  const w = freshFarm(NOW, 345, true);
  w.players = [farmPlayer('solo', 'Solo', NOW)];
  farmAction(w, 'solo', { type: 'start' }, 'solo');
  const c = w.cows.find((c) => c.id === w.players[0].cowId)!;
  for (let i = 1; i <= 120; i++) {
    const time = NOW + i * 100;
    Object.assign(c, { x: 0, z: 0 });
    Object.assign(w.farmer, { x: 0, z: -2.5, angle: 0 });
    for (const other of w.cows.filter((other) => other !== c)) {
      Object.assign(other, { x: 1, z: 1 });
      w.cowRoutines![other.id] = {
        activity: 'graze',
        until: NOW + ROUND_MS,
        target: { x: 1, z: 1 },
        speed: 2.6,
      };
    }
    w.players[0].input =
      i < 40
        ? { x: 0, z: 0, graze: true }
        : i < 80
          ? { x: 1, z: 0, graze: false }
          : { x: 0, z: 0, graze: false };
    advanceFarm(w, time);
  }
  assert.equal(c.captured, false);
  assert.equal(w.aiSuspicion[c.id], 0);
  assert.equal(w.inspections, 5);
  c.carrying = 'barn-key';
  w.items[0].holder = c.id;
  for (let i = 0; i < 80 && !c.captured; i++) {
    Object.assign(w.farmer, { x: c.x, z: c.z - 2.5, angle: 0 });
    advanceFarm(w, w.clock + 50);
  }
  assert.equal(
    c.captured,
    true,
    'visible stolen items still give the farmer a reason to inspect',
  );
});
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
    if (this.conflicts) {
      this.conflicts--;
      return false;
    }
    if (this.rows.get(row.code)?.version !== version) return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
}
type Reply = { session: FarmSession; snapshot: FarmSnapshot };
const create = async (store: MemoryStore) =>
  (await handleFarmRoom(store, { op: 'create', name: 'Ada' }, NOW)) as Reply;
void test('concurrent farm joins enforce four-player capacity and never disclose credentials', async () => {
  const store = new MemoryStore(),
    a = await create(store);
  const replies = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) =>
      handleFarmRoom(
        store,
        { op: 'join', code: a.session.code, name: `Cow ${i}` },
        NOW + 1,
      ),
    ),
  );
  assert.equal(replies.filter((r) => r.status === 'fulfilled').length, 3);
  assert.ok(!JSON.stringify(a.snapshot).includes(a.session.token));
  assert.ok(!JSON.stringify(a.snapshot).includes('members'));
});
void test('farm authentication, host control and replay protection survive contention', async () => {
  const store = new MemoryStore(),
    a = await create(store),
    b = (await handleFarmRoom(
      store,
      { op: 'join', code: a.session.code, name: 'Bo' },
      NOW + 1,
    )) as Reply;
  await assert.rejects(
    handleFarmRoom(store, { op: 'sync', ...a.session, token: 'bad' }, NOW + 2),
    /expired/,
  );
  await assert.rejects(
    handleFarmRoom(
      store,
      {
        op: 'action',
        ...b.session,
        requestId: 'no',
        action: { type: 'start' },
      },
      NOW + 2,
    ),
    /host/,
  );
  store.conflicts = 3;
  const body = {
    op: 'action',
    ...a.session,
    requestId: 'start-once',
    action: { type: 'start' },
  };
  await handleFarmRoom(store, body, NOW + 3);
  const repeat = (await handleFarmRoom(store, body, NOW + 4)) as Reply;
  assert.equal(repeat.snapshot.world.round, 1);
  assert.equal(repeat.snapshot.world.started, NOW + 3);
  await assert.rejects(
    handleFarmRoom(store, { op: 'join', code: a.session.code }, NOW + 5),
    /in progress/,
  );
});
void test('Stack or Sink and Blend Business share storage without sharing room namespaces', async () => {
  const store = new MemoryStore(),
    farm = await create(store);
  await assert.rejects(
    handleRoom(store, { op: 'join', code: farm.session.code }, NOW + 1),
    /not found/,
  );
  const stack = (await handleRoom(
    store,
    { op: 'create', name: 'Worker' },
    NOW + 2,
  )) as { session: FarmSession };
  await assert.rejects(
    handleFarmRoom(store, { op: 'join', code: stack.session.code }, NOW + 3),
    /not found/,
  );
  assert.equal(store.rows.size, 2);
});
void test('solo practice uses a computer farmer and the same complete round rules', () => {
  const w = freshFarm(NOW, 123, true);
  w.players = [farmPlayer('solo', 'Solo', NOW)];
  farmAction(w, 'solo', { type: 'start' }, 'solo');
  assert.equal(w.farmerId, 'computer-farmer');
  assert.ok(w.players[0].cowId);
  const start = { ...w.farmer };
  advanceFarm(w, NOW + 500);
  assert.notEqual(w.farmer.x, start.x);
  advanceFarm(w, NOW + ROUND_MS);
  assert.equal(w.phase, 'farmer-win');
});
