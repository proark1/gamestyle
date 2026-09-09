import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceShop,
  freshShop,
  shelfAction,
  shelfPlayer,
  shelfSnapshot,
} from './simulation';
import { newBotBrain, thinkGuard, thinkMannequin } from './bots';
import {
  blocked,
  clearSight,
  DISPLAYS,
  DOOR,
  EQUIPMENT,
  HATCH,
  RADIUS,
  SWITCH,
} from './layout';
import { shopPath } from './navigation';
import { handleShelfRoom } from './rooms';
import { distance, type Snapshot, type Session, type World } from './types';
import type { RoomStore, Row } from '../../shared/rooms/types';

const NOW = 100_000;
function filled(seed = 1) {
  const w = freshShop(NOW, seed);
  w.players = [shelfPlayer('human', 'Human', NOW)];
  shelfAction(w, 'human', { type: 'fill-start' }, 'human');
  return w;
}
function botGuard(seed = 1) {
  const w = filled(seed);
  w.phase = 'guard-win';
  shelfAction(w, 'human', { type: 'restart' }, 'human');
  return w;
}
function tick(w: World, ms = 100) {
  w.players.filter((p) => !p.bot).forEach((p) => (p.seen = w.clock));
  advanceShop(w, w.clock + ms);
}
const view = (w: World, id = w.guardId) =>
  shelfSnapshot(w, 'TEST23', 'human', id, 1);

void test('the host can add, remove and fill NPC seats; the guard rotates through humans and NPCs', () => {
  const w = freshShop(NOW);
  w.players = [shelfPlayer('human', 'Human', NOW)];
  shelfAction(w, 'human', { type: 'add-bot' }, 'human');
  assert.equal(w.players.length, 2);
  assert.equal(w.players[1].bot, true);
  const oldId = w.players[1].id;
  shelfAction(w, 'human', { type: 'remove-bot', target: oldId }, 'human');
  assert.equal(w.players.length, 1);
  assert.throws(
    () =>
      shelfAction(w, 'human', { type: 'remove-bot', target: 'human' }, 'human'),
    /NPC/,
  );
  shelfAction(w, 'human', { type: 'fill-start' }, 'human');
  assert.equal(w.players.length, 4);
  assert.equal(w.players.filter((p) => p.bot).length, 3);
  assert.equal(w.phase, 'hiding');
  assert.ok(!w.players.some((p) => p.id === oldId));
  for (let i = 0; i < 4; i++) {
    assert.equal(w.guardId, w.players[i].id);
    if (i === 3) break;
    w.phase = 'guard-win';
    shelfAction(w, 'human', { type: 'restart' }, 'human');
  }
});
void test('active rounds reject NPC changes and bot metadata never marks showroom figures', () => {
  const w = filled();
  assert.throws(
    () => shelfAction(w, 'human', { type: 'add-bot' }, 'human'),
    /between shifts/,
  );
  assert.throws(
    () =>
      shelfAction(
        w,
        'human',
        { type: 'remove-bot', target: w.players[1].id },
        'human',
      ),
    /between shifts/,
  );
  tick(w);
  const s = view(w);
  assert.equal(s.players.filter((p) => p.bot).length, 3);
  assert.equal(s.figures.length, 0);
  assert.ok(!('botBrains' in s));
  assert.ok(!JSON.stringify(s).includes('suspects'));
  assert.ok(!JSON.stringify(s).includes('routeGoal'));
  const hider = view(w, w.players[1].id);
  for (const f of hider.figures) {
    assert.ok(!('bot' in f));
    assert.ok(!('playerId' in f));
    assert.ok(!('name' in f));
  }
});
void test('bot plans reset between roles, and the bot guard stays blind and still during hiding', () => {
  const w = filled();
  tick(w);
  assert.ok(Object.keys(w.botBrains!).length);
  w.phase = 'guard-win';
  shelfAction(w, 'human', { type: 'restart' }, 'human');
  assert.deepEqual(w.botBrains, {});
  const before = { ...w.guard };
  for (let i = 0; i < 140; i++) tick(w);
  assert.deepEqual(w.guard, before);
  assert.deepEqual(view(w).figures, []);
  assert.equal(
    w.items.some((i) => i.holder && i.kind !== 'prop'),
    false,
  );
  for (let i = 0; i < 35; i++) tick(w);
  assert.ok(distance(w.guard, before) > 0.5);
});
void test('navigation reaches objectives around shelves without cutting through collision rectangles', () => {
  for (const from of DISPLAYS)
    for (const to of [DOOR, HATCH, SWITCH, ...EQUIPMENT]) {
      const route = shopPath(from, to);
      assert.ok(
        route.length,
        `${JSON.stringify(from)} -> ${JSON.stringify(to)}`,
      );
      let previous = from;
      for (const p of route) {
        assert.equal(blocked(p), false);
        assert.equal(clearSight(previous, p, RADIUS), true);
        previous = p;
      }
      assert.ok(distance(previous, to) < 0.01);
    }
});
void test('NPC crews complete both escape routes and do not stay frozen indefinitely', () => {
  let keysRoute = 0,
    ladderRoute = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const w = filled(seed);
    for (
      let i = 0;
      i < 1950 && (w.phase === 'hiding' || w.phase === 'playing');
      i++
    ) {
      tick(w);
      if (i % 25 === 0)
        for (const p of w.players.filter((p) => p.bot)) {
          const f = w.figures.find((f) => f.id === p.figureId)!;
          assert.equal(blocked(f), false, `seed ${seed}`);
        }
    }
    assert.equal(w.phase, 'mannequins-win', `seed ${seed}`);
    assert.equal(w.powerOff, true, `seed ${seed}`);
    assert.equal(
      w.figures.filter((f) => f.status === 'escaped').length,
      3,
      `seed ${seed}`,
    );
    if (w.keys === 2) keysRoute++;
    if (w.ladder) ladderRoute++;
  }
  assert.ok(keysRoute > 0);
  assert.ok(ladderRoute > 0);
});
void test('NPCs reassign security after its worker is caught', () => {
  const w = filled(3);
  w.phase = 'playing';
  w.clock = w.huntAt;
  tick(w);
  const worker = w.players.find(
    (p) => w.botBrains?.[p.id]?.job === 'security',
  )!;
  assert.ok(worker);
  w.figures.find((f) => f.id === worker.figureId)!.status = 'caught';
  for (let i = 0; i < 1500 && !w.powerOff; i++) tick(w);
  assert.equal(w.powerOff, true);
  assert.equal(
    w.figures.find((f) => f.id === worker.figureId)!.status,
    'caught',
  );
});
void test('guard decisions are identical when only hidden identities, positions and objectives change', () => {
  const a = botGuard(2);
  a.phase = 'playing';
  a.clock = a.huntAt;
  a.figures.forEach((f, i) => Object.assign(f, { x: i % 2 ? -11 : 11, z: -8 }));
  a.items.forEach((item) => Object.assign(item, { x: 11, z: -8 }));
  const b = structuredClone(a);
  b.players[0].figureId = b.figures[0].id;
  b.players[2].figureId = b.figures[1].id;
  b.figures.forEach((f, i) => Object.assign(f, { x: i % 2 ? -10 : 10, z: -9 }));
  b.keys = 2;
  b.powerOff = true;
  b.ladder = true;
  const sa = view(a),
    sb = view(b);
  assert.deepEqual(sa, sb);
  const ba = newBotBrain(44, sa.you.body!),
    bb = structuredClone(ba);
  assert.deepEqual(thinkGuard(sa, ba), thinkGuard(sb, bb));
  assert.deepEqual(ba, bb);
});
void test('guard reacts to witnessed theft after a delay and remembers only the last seen position', () => {
  const w = botGuard();
  w.phase = 'playing';
  w.clock = w.huntAt;
  Object.assign(w.guard, { x: 0, z: -8, angle: Math.PI / 2 });
  w.figures.forEach((f) => Object.assign(f, { x: -11, z: 8 }));
  const thief = w.figures.find((f) => f.id === w.players[0].figureId)!;
  Object.assign(thief, { x: 4, z: -8, carrying: 'key-living' });
  w.items[1].holder = thief.id;
  const brain = newBotBrain(100, w.guard);
  thinkGuard(view(w), brain);
  assert.notEqual(brain.mode, 'chase');
  w.clock += 1500;
  thinkGuard(view(w), brain);
  assert.equal(brain.mode, 'chase');
  assert.deepEqual(brain.goal, { x: 4, z: -8 });
  Object.assign(thief, { x: -11, z: 8 });
  w.clock += 300;
  thinkGuard(view(w), brain);
  assert.deepEqual(brain.goal, { x: 4, z: -8 });
  Object.assign(w.guard, { x: 3.8, z: -8 });
  w.clock += 300;
  thinkGuard(view(w), brain);
  assert.equal(brain.mode, 'search');
  assert.equal(brain.goal, null);
});
void test('the bot guard captures a visible equipment carrier using ordinary inspection rules', () => {
  const w = botGuard(6);
  w.phase = 'playing';
  w.clock = w.huntAt;
  Object.assign(w.guard, { x: 0, z: 7, angle: 0 });
  const thief = w.figures.find((f) => f.id === w.players[0].figureId)!;
  Object.assign(thief, { x: 0, z: 8.2, carrying: 'ladder' });
  w.items.find((i) => i.id === 'ladder')!.holder = thief.id;
  for (let i = 0; i < 45 && thief.status === 'active'; i++) tick(w);
  assert.equal(thief.status, 'caught');
  assert.equal(w.mistakes, 5);
});
void test('a guard does not learn about missing equipment behind a shelf', () => {
  const w = botGuard();
  w.phase = 'playing';
  w.clock = w.huntAt;
  Object.assign(w.guard, { x: -5.5, z: -3, angle: -Math.PI / 2 });
  const brain = newBotBrain(2, w.guard);
  w.items[0].delivered = true;
  thinkGuard(view(w), brain);
  assert.notEqual(brain.job, 'check-door');
  Object.assign(w.guard, { x: -10, z: -3, angle: -Math.PI / 2 });
  w.clock += 500;
  thinkGuard(view(w), brain);
  assert.equal(brain.job, 'check-door');
});
void test('mannequin memory cannot follow equipment secretly moved outside its view', () => {
  const w = filled(4);
  w.phase = 'playing';
  w.clock = w.huntAt;
  const id = w.players[1].id;
  const f = w.figures.find((f) => f.id === w.players[1].figureId)!;
  Object.assign(f, { x: 10, z: 8 });
  const brain = newBotBrain(5, f);
  const s = view(w, id);
  thinkMannequin(s, brain, new Set(['security']));
  const old = { ...brain.items['key-lighting'] };
  Object.assign(w.items[0], { x: -10, z: -8 });
  thinkMannequin(view(w, id), brain, new Set(['security']));
  assert.deepEqual(brain.items['key-lighting'], old);
});

class MemoryStore implements RoomStore {
  rows = new Map<string, Row>();
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
    if (this.rows.get(row.code)?.version !== version) return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
}
type Reply = { session: Session; snapshot: Snapshot };
const create = async (db: MemoryStore) =>
  (await handleShelfRoom(db, { op: 'create', name: 'Human' }, NOW)) as Reply;
const action = (
  db: MemoryStore,
  s: Session,
  type: string,
  requestId = type,
  target?: string,
  now = NOW,
) =>
  handleShelfRoom(
    db,
    { op: 'action', ...s, requestId, action: { type, target } },
    now,
  ) as Promise<Reply>;

void test('NPC seat operations are authenticated, host-only and idempotent', async () => {
  const db = new MemoryStore(),
    a = await create(db),
    b = (await handleShelfRoom(
      db,
      { op: 'join', code: a.session.code, name: 'Friend' },
      NOW,
    )) as Reply;
  await assert.rejects(action(db, b.session, 'add-bot'), /host/);
  await assert.rejects(
    action(db, { ...a.session, token: 'fake' }, 'add-bot'),
    /expired/,
  );
  const first = await action(db, a.session, 'add-bot', 'once'),
    second = await action(db, a.session, 'add-bot', 'once');
  assert.equal(second.snapshot.players.length, 3);
  assert.deepEqual(first.snapshot.players, second.snapshot.players);
  const bot = second.snapshot.players.find((p) => p.bot)!;
  await assert.rejects(
    handleShelfRoom(
      db,
      { op: 'sync', code: a.session.code, id: bot.id, token: a.session.token },
      NOW,
    ),
    /expired/,
  );
  await assert.rejects(
    action(db, a.session, 'remove-bot', 'bad-remove', b.session.id),
    /NPC/,
  );
  const started = await action(db, a.session, 'fill-start');
  assert.equal(started.snapshot.players.length, 4);
  assert.equal(started.snapshot.players.filter((p) => p.bot).length, 2);
  assert.equal(started.snapshot.phase, 'hiding');
});
void test('friends replace an NPC in a full waiting room, without replacing people', async () => {
  const db = new MemoryStore(),
    a = await create(db);
  for (let i = 0; i < 3; i++) await action(db, a.session, 'add-bot', String(i));
  const joined = (await handleShelfRoom(
    db,
    { op: 'join', code: a.session.code, name: 'Friend' },
    NOW,
  )) as Reply;
  assert.equal(joined.snapshot.players.length, 4);
  assert.equal(joined.snapshot.players.filter((p) => p.bot).length, 2);
  assert.ok(joined.snapshot.players.some((p) => p.id === a.session.id));
  assert.equal(joined.snapshot.host, a.session.id);
  await action(db, a.session, 'start');
  await assert.rejects(
    handleShelfRoom(
      db,
      { op: 'join', code: a.session.code, name: 'Late' },
      NOW,
    ),
    /progress/,
  );
});
void test('concurrent NPC fills and human joins never exceed four seats', async () => {
  const db = new MemoryStore(),
    a = await create(db);
  await Promise.allSettled([
    action(db, a.session, 'add-bot', 'a'),
    action(db, a.session, 'add-bot', 'b'),
    action(db, a.session, 'fill-start', 'fill'),
    handleShelfRoom(
      db,
      { op: 'join', code: a.session.code, name: 'Friend' },
      NOW,
    ),
  ]);
  const state = (await handleShelfRoom(
    db,
    { op: 'sync', ...a.session },
    NOW,
  )) as Reply;
  assert.equal(state.snapshot.players.length, 4);
  assert.equal(new Set(state.snapshot.players.map((p) => p.id)).size, 4);
  assert.equal(state.snapshot.phase, 'hiding');
});
void test('NPCs do not expire, cannot inherit hosting, and disappear when the last human leaves', async () => {
  const db = new MemoryStore(),
    a = await create(db);
  await action(db, a.session, 'fill-start');
  const active = (await handleShelfRoom(
    db,
    { op: 'sync', ...a.session },
    NOW + 31000,
  )) as Reply;
  assert.equal(active.snapshot.players.length, 4);
  assert.equal(active.snapshot.host, a.session.id);
  assert.equal(active.snapshot.phase, 'playing');
  await handleShelfRoom(db, { op: 'leave', ...a.session }, NOW + 31010);
  const room = JSON.parse(db.rows.get(`shelf:${a.session.code}`)!.state) as {
    world: World;
    host: string;
  };
  assert.equal(room.world.players.length, 0);
  assert.equal(room.host, '');
  const fresh = (await handleShelfRoom(
    db,
    { op: 'join', code: a.session.code, name: 'New human' },
    NOW + 31020,
  )) as Reply;
  assert.equal(fresh.snapshot.host, fresh.session.id);
  assert.equal(fresh.snapshot.players.length, 1);
});
void test('a human departure passes hosting to another human across NPC seats', async () => {
  const db = new MemoryStore(),
    a = await create(db);
  await action(db, a.session, 'add-bot');
  const b = (await handleShelfRoom(
    db,
    { op: 'join', code: a.session.code, name: 'Friend' },
    NOW,
  )) as Reply;
  await handleShelfRoom(db, { op: 'leave', ...a.session }, NOW);
  const s = (await handleShelfRoom(
    db,
    { op: 'sync', ...b.session },
    NOW,
  )) as Reply;
  assert.equal(s.snapshot.host, b.session.id);
  assert.equal(s.snapshot.players.filter((p) => p.bot).length, 1);
});
void test('older stored rooms acquire bot state without requiring a migration', async () => {
  const db = new MemoryStore(),
    a = await create(db),
    row = db.rows.get(`shelf:${a.session.code}`)!;
  const old = JSON.parse(row.state) as { world: World };
  delete old.world.botBrains;
  delete old.world.botCounter;
  row.state = JSON.stringify(old);
  const started = await action(db, a.session, 'fill-start');
  assert.equal(started.snapshot.players.length, 4);
  const next = (await handleShelfRoom(
    db,
    { op: 'sync', ...a.session },
    NOW + 200,
  )) as Reply;
  assert.equal(next.snapshot.phase, 'hiding');
  assert.equal(next.snapshot.figures.length, 0);
});
