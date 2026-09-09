import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceFarm,
  farmAction,
  farmPlayer,
  farmSnapshot,
  freshFarm,
  removeFarmPlayer,
} from './simulation';
import { farmClearPath, farmPath, farmRisk } from './navigation';
import { coverBlocks } from './visibility';
import { freshBotBrain, thinkFarmBot } from './bots';
import { handleFarmRoom } from './rooms';
import type { FarmAction, FarmSession, FarmSnapshot } from './types';
import type { RoomStore, Row } from '../../shared/rooms/types';

function lobby(seed = 9717) {
  const w = freshFarm(100_000, seed);
  w.players = [farmPlayer('human', 'Farmer', w.clock)];
  return w;
}
const act = (w: ReturnType<typeof lobby>, action: FarmAction) =>
  farmAction(w, 'human', action, 'human');
const bots = (w: ReturnType<typeof lobby>) => w.players.filter((p) => p.bot);

void test('NPC slots are host-only, bounded, removable, and available only between human-farmer rounds', () => {
  const w = lobby();
  w.players.push(farmPlayer('guest', 'Guest', w.clock));
  assert.throws(
    () => farmAction(w, 'guest', { type: 'add-bot' }, 'human'),
    /host/,
  );
  act(w, { type: 'add-bot' });
  assert.equal(bots(w).length, 1);
  act(w, { type: 'fill-bots' });
  assert.equal(w.players.length, 4);
  assert.throws(() => act(w, { type: 'add-bot' }), /filled/);
  assert.throws(() => act(w, { type: 'remove-bot', target: 'guest' }), /NPC/);
  act(w, { type: 'remove-bot', target: bots(w)[0].id });
  assert.equal(bots(w).length, 1);
  act(w, { type: 'start' });
  assert.throws(
    () => act(w, { type: 'remove-bot', target: bots(w)[0].id }),
    /Finish/,
  );
  w.phase = 'farmer-win';
  act(w, { type: 'mode', mode: 'computer' });
  assert.equal(bots(w).length, 0);
  assert.throws(() => act(w, { type: 'add-bot' }), /Player farmer/);
});

void test('solo humans remain farmer and mixed rooms rotate only human players', () => {
  const w = lobby();
  act(w, { type: 'fill-bots' });
  for (let i = 0; i < 4; i++) {
    act(w, { type: i ? 'restart' : 'start' });
    assert.equal(w.farmerId, 'human');
    assert.equal(new Set(bots(w).map((p) => p.cowId)).size, 3);
    w.phase = 'farmer-win';
  }
  act(w, { type: 'remove-bot', target: bots(w)[0].id });
  w.players.push(farmPlayer('guest', 'Guest', w.clock));
  const roles = [];
  for (let i = 0; i < 4; i++) {
    act(w, { type: 'restart' });
    roles.push(w.farmerId);
    w.phase = 'farmer-win';
  }
  assert.deepEqual(roles, ['human', 'guest', 'human', 'guest']);
});

void test('navigation routes around hay, escapes collision boundaries, and gives sight a real cost', () => {
  const start = { x: -6, z: -1 },
    goal = { x: -6, z: -6 };
  assert.equal(farmClearPath(start, goal), false);
  const path = farmPath(start, goal);
  assert.ok(path.length > 1);
  let previous = start;
  for (const p of path) {
    assert.ok(farmClearPath(previous, p, 0.45));
    previous = p;
  }
  assert.ok(
    farmPath({ x: 2.9493007808, z: 2.8795657359 }, { x: 8.1, z: 5 }).length,
    'recover when sliding along a hay corner',
  );
  const danger = { x: 0, z: 0, angle: 0 };
  const from = { x: -4, z: 2 },
    to = { x: 4, z: 2 };
  const risk = (points: typeof path) =>
    points.reduce((sum, p) => sum + farmRisk(p, danger), 0);
  assert.ok(farmPath(from, to, danger).length > 1);
  assert.ok(risk(farmPath(from, to, danger)) < risk([{ x: 0, z: 2 }]));
});

void test('24 deterministic complete rounds escape without clipping, fence shocks or stuck NPCs', () => {
  for (let seed = 1; seed <= 24; seed++) {
    const w = lobby(seed * 9717);
    act(w, { type: seed <= 6 ? 'add-bot' : 'fill-bots' });
    act(w, { type: 'start' });
    const modes = new Set<string>();
    for (let tick = 0; tick < 1200 && w.phase === 'playing'; tick++) {
      w.players[0].seen = w.clock + 100;
      advanceFarm(w, w.clock + 100);
      for (const p of bots(w)) {
        const c = w.cows.find((c) => c.id === p.cowId)!;
        assert.equal(coverBlocks(c), false, `seed ${seed} clips hay`);
        assert.ok(!c.shockedAt, `seed ${seed} touches live fence`);
        assert.ok(Math.hypot(p.input.x, p.input.z) <= 1.001);
        modes.add(w.botBrains![p.id].mode);
      }
    }
    assert.equal(w.phase, 'cows-win', `seed ${seed} failed to escape`);
    assert.ok(
      bots(w).every((p) => w.cows.find((c) => c.id === p.cowId)?.escaped),
      `seed ${seed} left an NPC stuck`,
    );
    assert.ok(modes.has('blend') && modes.has('travel') && modes.has('escape'));
  }
});

void test('NPCs complete the two-key route when a human teammate holds the ladder', () => {
  const w = lobby(48489);
  w.players.push(farmPlayer('teammate', 'Cow friend', w.clock));
  act(w, { type: 'fill-bots' });
  act(w, { type: 'start' });
  const teammate = w.cows.find((c) => c.id === w.players[1].cowId)!;
  const ladder = w.items.find((i) => i.kind === 'ladder')!;
  teammate.carrying = ladder.id;
  ladder.holder = teammate.id;
  for (
    let i = 0;
    i < 1400 &&
    !bots(w).every((p) => w.cows.find((c) => c.id === p.cowId)?.escaped);
    i++
  ) {
    for (const p of w.players) if (!p.bot) p.seen = w.clock + 100;
    advanceFarm(w, w.clock + 100);
  }
  assert.equal(w.keysDelivered, 2);
  assert.equal(w.powerOff, true);
  assert.equal(w.ladderPlaced, false);
  assert.ok(
    bots(w).every((p) => w.cows.find((c) => c.id === p.cowId)?.escaped),
  );
});

void test('brains survive serialization and never appear in player snapshots', () => {
  const w = lobby();
  act(w, { type: 'fill-bots' });
  act(w, { type: 'start' });
  for (let i = 0; i < 30; i++) advanceFarm(w, w.clock + 100);
  const resumed = JSON.parse(JSON.stringify(w));
  for (let i = 0; i < 100; i++) {
    advanceFarm(w, w.clock + 100);
    advanceFarm(resumed, resumed.clock + 100);
  }
  assert.deepEqual(resumed, w);
  const snapshot = farmSnapshot(w, 'FARMAB', 'human', 'human', 1);
  assert.equal('botBrains' in snapshot.world, false);
  assert.ok(
    snapshot.world.players.every((p) => !('cowId' in p) && !('input' in p)),
  );
  assert.equal(snapshot.world.players.filter((p) => p.bot).length, 3);
});

void test('exposed cows flee after recovering; unseen farmer changes do not produce omniscient reactions', () => {
  const w = lobby();
  act(w, { type: 'add-bot' });
  act(w, { type: 'start' });
  const bot = bots(w)[0],
    cow = w.cows.find((c) => c.id === bot.cowId)!;
  Object.assign(cow, { x: 0, z: 0, shockedAt: w.clock - 1000 });
  const view = farmSnapshot(w, '', 'human', bot.id, 0),
    brain = freshBotBrain(1, cow, w.clock);
  thinkFarmBot(view, brain, new Set());
  assert.equal(brain.mode, 'flee');
  cow.shockedAt = 0;
  cow.x = -8;
  cow.z = -8;
  const a = farmSnapshot(w, '', 'human', bot.id, 0),
    b = structuredClone(a);
  a.world.farmer = { x: 8, z: 8, angle: 0 };
  b.world.farmer = { x: 8, z: 0, angle: 2 };
  const first = freshBotBrain(9, cow, w.clock),
    second = structuredClone(first);
  thinkFarmBot(a, first, new Set());
  thinkFarmBot(b, second, new Set());
  assert.deepEqual(first, second);
});

class MemoryStore implements RoomStore {
  rows = new Map<string, Row>();
  async get(code: string) {
    return this.rows.get(code) ?? null;
  }
  async insert(row: Row) {
    if (this.rows.has(row.code)) return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
  async compareAndSwap(row: Row, version: number) {
    if (this.rows.get(row.code)?.version !== version) return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
}
type Reply = { session: FarmSession; snapshot: FarmSnapshot };
void test('room NPC management is atomic, authenticated, replay-safe, and permits human replacement', async () => {
  const store = new MemoryStore();
  const host = (await handleFarmRoom(
    store,
    { op: 'create', mode: 'human', name: 'Farmer' },
    100_000,
  )) as Reply;
  const action = (type: string, requestId = crypto.randomUUID()) =>
    handleFarmRoom(
      store,
      { op: 'action', ...host.session, requestId, action: { type } },
      100_001,
    );
  const attempts = await Promise.allSettled(
    Array.from({ length: 6 }, () => action('add-bot')),
  );
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 3);
  const saved = JSON.parse(store.rows.values().next().value!.state);
  assert.equal(saved.world.players.length, 4);
  assert.equal(Object.keys(saved.members).length, 1);
  await assert.rejects(
    handleFarmRoom(
      store,
      {
        op: 'sync',
        code: host.session.code,
        id: 'farm-bot-1',
        token: 'forged',
      },
      100_002,
    ),
    /expired/,
  );
  const guest = (await handleFarmRoom(
    store,
    { op: 'join', code: host.session.code, name: 'Friend' },
    100_003,
  )) as Reply;
  assert.equal(guest.snapshot.world.players.length, 4);
  assert.equal(guest.snapshot.world.players.filter((p) => p.bot).length, 2);
  const req = {
    op: 'action',
    ...host.session,
    requestId: 'same-request',
    action: {
      type: 'remove-bot',
      target: guest.snapshot.world.players.find((p) => p.bot)!.id,
    },
  };
  await handleFarmRoom(store, req, 100_004);
  await handleFarmRoom(store, req, 100_005);
  const alive = (await handleFarmRoom(
    store,
    { op: 'sync', ...host.session },
    131_000,
  )) as Reply;
  assert.equal(
    alive.snapshot.world.players.filter((p) => p.bot).length,
    1,
    'NPC survives member expiry',
  );
  await handleFarmRoom(store, { op: 'leave', ...host.session }, 131_001);
  const empty = JSON.parse(store.rows.values().next().value!.state);
  assert.equal(empty.world.players.length, 0);
  assert.equal(empty.host, '');
});

void test('a leaving farmer never hands the farm to an NPC', () => {
  const w = lobby();
  act(w, { type: 'fill-bots' });
  act(w, { type: 'start' });
  removeFarmPlayer(w, 'human');
  assert.equal(w.phase, 'lobby');
  assert.deepEqual(w.players, []);
  assert.deepEqual(w.botBrains, {});
});
