import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceShop,
  freshShop,
  shelfAction,
  shelfPlayer,
  shelfSnapshot,
} from './simulation';
import {
  blocked,
  clearSight,
  DISPLAYS,
  DOOR,
  HATCH,
  move,
  SWITCH,
  visible,
} from './layout';
import { handleShelfRoom } from './rooms';
import {
  HIDE_MS,
  HUNT_MS,
  type Session,
  type Snapshot,
  type World,
} from './types';
import type { RoomStore, Row } from '../../shared/rooms/types';

const NOW = 100_000;
function round() {
  const w = freshShop(NOW);
  w.players = ['a', 'b', 'c', 'd'].map((id) => shelfPlayer(id, id, NOW));
  shelfAction(w, 'a', { type: 'start' }, 'a');
  return w;
}
const own = (w: World, id = 'b') =>
  w.figures.find((f) => f.id === w.players.find((p) => p.id === id)!.figureId)!;
function hunt(w: World) {
  w.phase = 'playing';
  w.clock = w.huntAt;
  w.players.forEach((p) => (p.seen = w.clock));
  return w;
}
void test('exactly four humans and the guard rotates every round', () => {
  const w = freshShop(NOW);
  w.players = ['a', 'b', 'c'].map((id) => shelfPlayer(id, id, NOW));
  assert.throws(
    () => shelfAction(w, 'a', { type: 'start' }, 'a'),
    /exactly four/,
  );
  w.players.push(shelfPlayer('d', 'd', NOW));
  for (const id of ['a', 'b', 'c', 'd', 'a']) {
    shelfAction(w, 'a', { type: 'start' }, 'a');
    assert.equal(w.guardId, id);
    assert.equal(w.players.filter((p) => p.figureId).length, 3);
    assert.equal(new Set(w.players.map((p) => p.figureId)).size, 4);
    w.phase = 'guard-win';
  }
});
void test('the host guard receives no showroom positions, items, events or objective progress during hiding', () => {
  const w = round();
  w.events.push({
    id: 123,
    at: NOW,
    kind: 'lift',
    material: 'key',
    x: 0,
    z: 9,
  });
  w.keys = 1;
  const s = shelfSnapshot(w, 'CODE23', 'a', 'a', 0);
  assert.deepEqual(s.figures, []);
  assert.deepEqual(s.items, []);
  assert.deepEqual(s.events, []);
  assert.equal(s.guard, null);
  assert.equal(s.objectives, null);
  assert.equal(s.you.figureId, null);
  assert.equal(s.remaining, HIDE_MS);
  assert.deepEqual(s.players, [
    { id: 'a', name: 'a' },
    { id: 'b', name: 'b' },
    { id: 'c', name: 'c' },
    { id: 'd', name: 'd' },
  ]);
  for (const field of ['seed', 'routines', 'guardId', 'members', 'input'])
    assert.ok(!(field in s));
  assert.throws(() => shelfAction(w, 'a', { type: 'inspect' }, 'a'), /office/);
});
void test('the hidden countdown allows posing and moving but prevents objective collection and guard movement', () => {
  const w = round(),
    f = own(w),
    p = w.players[1];
  Object.assign(f, { x: -11, z: -3 });
  p.input = { x: 0, z: 0.7, seq: 1 };
  w.players[0].input = { x: 1, z: 0, seq: 1 };
  assert.throws(
    () => shelfAction(w, 'b', { type: 'interact' }, 'a'),
    /hiding spot/,
  );
  const before = { ...f };
  advanceShop(w, NOW + 100);
  assert.ok(f.z > before.z);
  assert.equal(w.guard.x, 0);
  shelfAction(w, 'b', { type: 'pose' }, 'a');
  assert.equal(p.input.x, 0);
  assert.equal(p.input.z, 0);
  assert.equal(f.pose, (before.pose + 1) % 3);
  advanceShop(w, NOW + HIDE_MS);
  assert.equal(w.phase, 'playing');
});
void test('shelves, range and facing control the guard snapshot including carried objects and sounds', () => {
  const w = hunt(round()),
    f = own(w);
  Object.assign(w.guard, { x: -8.2, z: 0, angle: Math.PI / 2 });
  Object.assign(f, { x: -5.8, z: 0 });
  const key = w.items[0];
  key.holder = f.id;
  f.carrying = key.id;
  w.events = [
    { id: 1, at: w.clock, kind: 'lift', material: 'key', x: f.x, z: f.z },
  ];
  let s = shelfSnapshot(w, 'CODE23', 'a', 'a', 1);
  assert.ok(!s.figures.some((v) => v.id === f.id));
  assert.ok(!s.items.some((i) => i.id === key.id));
  assert.equal(s.events.length, 0);
  Object.assign(f, { x: -10, z: 0 });
  w.guard.angle = -Math.PI / 2;
  w.events[0].x = f.x;
  s = shelfSnapshot(w, 'CODE23', 'a', 'a', 2);
  assert.ok(s.figures.some((v) => v.id === f.id));
  assert.ok(s.items.some((i) => i.id === key.id && i.x === f.x));
  assert.equal(s.events.length, 1);
  w.guard.angle = Math.PI / 2;
  s = shelfSnapshot(w, 'CODE23', 'a', 'a', 3);
  assert.ok(!s.figures.some((v) => v.id === f.id));
  Object.assign(f, { x: -8.2, z: 8 });
  assert.ok(
    !shelfSnapshot(w, 'CODE23', 'a', 'a', 4).figures.some((v) => v.id === f.id),
  );
});
void test('remote and through-shelf inspection targets cannot be used to probe identities', () => {
  const w = hunt(round()),
    f = own(w);
  Object.assign(w.guard, { x: -8.2, z: 0, angle: Math.PI / 2 });
  Object.assign(f, { x: -5.8, z: 0 });
  assert.throws(
    () => shelfAction(w, 'a', { type: 'inspect', target: f.id }, 'a'),
    /clear view/,
  );
  assert.equal(w.mistakes, 5);
  assert.equal(w.inspectAt, 0);
  assert.equal(f.status, 'active');
  assert.throws(
    () => shelfAction(w, 'a', { type: 'inspect', target: 'invented-id' }, 'a'),
    /clear view/,
  );
});
void test('humans and NPCs use the same public representation without player ownership', () => {
  const w = hunt(round()),
    f = own(w),
    bot = w.figures.find((f) => !w.players.some((p) => p.figureId === f.id))!;
  Object.assign(w.guard, { x: 0, z: 7, angle: 0 });
  Object.assign(f, { x: -0.5, z: 8 });
  Object.assign(bot, { x: 0.5, z: 8 });
  const s = shelfSnapshot(w, 'CODE23', 'a', 'a', 1),
    human = s.figures.find((v) => v.id === f.id)!,
    npc = s.figures.find((v) => v.id === bot.id)!;
  assert.deepEqual(Object.keys(human).sort(), Object.keys(npc).sort());
  for (const v of [human, npc])
    for (const field of ['name', 'playerId', 'isPlayer', 'owner', 'input'])
      assert.ok(!(field in v));
});
void test('wrong inspections consume guesses and enforce cooldown; correct inspection captures only that player', () => {
  const w = hunt(round()),
    bot = w.figures.find((f) => !w.players.some((p) => p.figureId === f.id))!;
  Object.assign(w.guard, { x: 0, z: 7, angle: 0 });
  Object.assign(bot, { x: 0, z: 8 });
  shelfAction(w, 'a', { type: 'inspect', target: bot.id }, 'a');
  assert.equal(w.mistakes, 4);
  assert.throws(
    () => shelfAction(w, 'a', { type: 'inspect', target: bot.id }, 'a'),
    /moment/,
  );
  w.clock += 2000;
  const f = own(w);
  Object.assign(f, { x: 0, z: 8 });
  shelfAction(w, 'a', { type: 'inspect', target: f.id }, 'a');
  assert.equal(f.status, 'caught');
  assert.equal(w.mistakes, 4);
  assert.equal(shelfSnapshot(w, 'CODE23', 'a', 'b', 2).figures.length, 0);
  for (let i = 0; i < 4; i++) {
    w.clock += 2000;
    shelfAction(w, 'a', { type: 'inspect', target: bot.id }, 'a');
  }
  assert.equal(w.phase, 'mannequins-win');
});
void test('both escape routes require security off and their own delivered equipment', () => {
  for (const route of ['door', 'hatch']) {
    const w = hunt(round()),
      f = own(w);
    Object.assign(f, route === 'door' ? DOOR : HATCH);
    assert.throws(
      () => shelfAction(w, 'b', { type: 'interact' }, 'a'),
      /security/,
    );
    w.powerOff = true;
    assert.throws(() => shelfAction(w, 'b', { type: 'interact' }, 'a'), /keys/);
    for (const item of w.items.filter(
      (i) => i.kind === (route === 'door' ? 'key' : 'ladder'),
    )) {
      item.holder = f.id;
      f.carrying = item.id;
      shelfAction(w, 'b', { type: 'interact' }, 'a');
      assert.equal(item.delivered, true);
      assert.equal(f.carrying, null);
    }
    shelfAction(w, 'b', { type: 'interact' }, 'a');
    assert.equal(f.status, 'escaped');
    w.clock = w.huntAt + HUNT_MS;
    advanceShop(w, w.clock + 1);
    assert.equal(w.phase, 'mannequins-win');
  }
});
void test('security takes uninterrupted time and movement cancels the task', () => {
  const w = hunt(round()),
    f = own(w),
    p = w.players[1];
  Object.assign(f, SWITCH);
  shelfAction(w, 'b', { type: 'interact' }, 'a');
  for (let i = 0; i < 10; i++) {
    p.seen = w.clock;
    advanceShop(w, w.clock + 100);
  }
  assert.equal(w.powerOff, false);
  assert.ok(f.task > 0.2);
  p.input = { x: 1, z: 0, seq: 1 };
  p.seen = w.clock;
  advanceShop(w, w.clock + 100);
  assert.equal(f.task, 0);
  shelfAction(w, 'b', { type: 'interact' }, 'a');
  for (let i = 0; i < 36; i++) {
    p.seen = w.clock;
    advanceShop(w, w.clock + 100);
  }
  assert.equal(w.powerOff, true);
});
void test('the guard wins when time expires without an escape, even if hiders remain', () => {
  const w = hunt(round());
  advanceShop(w, w.huntAt + HUNT_MS + 1);
  assert.equal(w.phase, 'guard-win');
});
void test('map spawns and objectives are reachable, and walls stop displacement', () => {
  for (const p of [...DISPLAYS, DOOR, HATCH, SWITCH, ...round().items])
    assert.equal(blocked(p), false, JSON.stringify(p));
  assert.equal(clearSight({ x: -8, z: 0 }, { x: -6, z: 0 }), false);
  assert.equal(visible({ x: 0, z: 8, angle: 0 }, { x: 0, z: 10 }, true), true);
  const body = { x: -8.2, z: 0, angle: 0 };
  for (let i = 0; i < 100; i++) move(body, { x: 1, z: 0 }, 3.1, 0.03);
  assert.ok(body.x <= -8.15);
  const x = body.x;
  assert.equal(move(body, { x: 1, z: 0 }, 3.1, 0.03), false);
  assert.equal(body.x, x);
  // Flood-fill walkable space to catch an accidentally sealed-off exit or pickup.
  const seen = new Set<string>(),
    queue = [{ x: 0, z: 9 }],
    key = (p: { x: number; z: number }) => `${p.x},${p.z}`;
  seen.add(key(queue[0]));
  for (let i = 0; i < queue.length; i++)
    for (const d of [
      { x: 0.5, z: 0 },
      { x: -0.5, z: 0 },
      { x: 0, z: 0.5 },
      { x: 0, z: -0.5 },
    ]) {
      const next = { x: queue[i].x + d.x, z: queue[i].z + d.z };
      if (!seen.has(key(next)) && !blocked(next)) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  for (const p of [DOOR, HATCH, SWITCH, ...round().items])
    assert.ok(
      queue.some(
        (q) => Math.hypot(p.x - q.x, p.z - q.z) < 1.5 && clearSight(p, q),
      ),
      `inaccessible: ${JSON.stringify(p)}`,
    );
});

class MemoryStore implements RoomStore {
  rows = new Map<string, Row>();
  conflicts = 0;
  async get(code: string) {
    const r = this.rows.get(code);
    return r ? { ...r } : null;
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
type Reply = { session: Session; snapshot: Snapshot };
async function create(db: MemoryStore) {
  return (await handleShelfRoom(
    db,
    { op: 'create', name: 'Ada' },
    NOW,
  )) as Reply;
}
async function four(db: MemoryStore) {
  const a = await create(db),
    crew = [a];
  for (let i = 1; i < 4; i++)
    crew.push(
      (await handleShelfRoom(
        db,
        { op: 'join', code: a.session.code, name: `Player ${i}` },
        NOW,
      )) as Reply,
    );
  return crew;
}
void test('atomic joins enforce four players and keep tokens out of responses', async () => {
  const db = new MemoryStore(),
    a = await create(db);
  const result = await Promise.allSettled(
    Array.from({ length: 7 }, (_, i) =>
      handleShelfRoom(
        db,
        { op: 'join', code: a.session.code, name: `P${i}` },
        NOW + 10,
      ),
    ),
  );
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 3);
  const state = (
    (await handleShelfRoom(db, { op: 'sync', ...a.session }, NOW + 20)) as Reply
  ).snapshot;
  assert.equal(state.players.length, 4);
  assert.ok(!JSON.stringify(state).includes(a.session.token));
  assert.ok(!JSON.stringify(state).includes('members'));
  assert.ok(db.rows.has(`shelf:${a.session.code}`));
  assert.ok(!db.rows.has(a.session.code));
});
void test('authentication, host permissions and malformed movement are enforced', async () => {
  const db = new MemoryStore(),
    [a, b] = await four(db);
  await assert.rejects(
    handleShelfRoom(db, { op: 'sync', ...a.session, token: 'fake' }, NOW),
    /expired/,
  );
  await assert.rejects(
    handleShelfRoom(
      db,
      {
        op: 'action',
        ...b.session,
        action: { type: 'start' },
        requestId: 'start',
      },
      NOW,
    ),
    /host/,
  );
  for (const input of [
    { x: Infinity, z: 0, seq: 1 },
    { x: 0, z: 0, seq: -1 },
    { x: 0, z: 0, seq: 1.5 },
  ])
    await assert.rejects(
      handleShelfRoom(db, { op: 'sync', ...a.session, input }, NOW),
      /Invalid movement/,
    );
});
void test('replayed actions and contention cannot restart a round or duplicate a pose', async () => {
  const db = new MemoryStore(),
    [a, b] = await four(db);
  db.conflicts = 3;
  const start = {
    op: 'action',
    ...a.session,
    requestId: 'start',
    action: { type: 'start' },
  };
  await handleShelfRoom(db, start, NOW);
  const again = (await handleShelfRoom(db, start, NOW + 100)) as Reply;
  assert.equal(again.snapshot.round, 1);
  const pose = {
      op: 'action',
      ...b.session,
      requestId: 'pose',
      action: { type: 'pose' },
    },
    once = (await handleShelfRoom(db, pose, NOW + 200)) as Reply,
    twice = (await handleShelfRoom(db, pose, NOW + 200)) as Reply;
  assert.equal(once.snapshot.you.pose, twice.snapshot.you.pose);
});
void test('delayed packets cannot overwrite a newer stop and disconnected rounds return to the lobby', async () => {
  const db = new MemoryStore(),
    [a, b, c] = await four(db);
  await handleShelfRoom(
    db,
    {
      op: 'action',
      ...a.session,
      requestId: 'start',
      action: { type: 'start' },
    },
    NOW,
  );
  for (const input of [
    { x: 1, z: 0, seq: 1 },
    { x: 0, z: 0, seq: 3 },
    { x: 1, z: 0, seq: 2 },
  ])
    await handleShelfRoom(db, { op: 'sync', ...b.session, input }, NOW + 20);
  const row = db.rows.get(`shelf:${a.session.code}`)!,
    w = (JSON.parse(row.state) as { world: World }).world;
  assert.equal(w.players.find((p) => p.id === b.session.id)!.input.x, 0);
  await handleShelfRoom(db, { op: 'leave', ...a.session }, NOW + 100);
  const next = (await handleShelfRoom(
    db,
    { op: 'sync', ...c.session },
    NOW + 120,
  )) as Reply;
  assert.equal(next.snapshot.phase, 'lobby');
  assert.equal(next.snapshot.host, b.session.id);
  assert.equal(next.snapshot.players.length, 3);
});
void test('stale players expire and a returning player never inherits somebody else’s mannequin', async () => {
  const db = new MemoryStore(),
    [a, b] = await four(db);
  await handleShelfRoom(
    db,
    {
      op: 'action',
      ...a.session,
      requestId: 'start',
      action: { type: 'start' },
    },
    NOW,
  );
  const reply = (await handleShelfRoom(
    db,
    { op: 'sync', ...b.session },
    NOW + 31000,
  )) as Reply;
  assert.equal(reply.snapshot.phase, 'lobby');
  assert.equal(reply.snapshot.players.length, 1);
  assert.equal(reply.snapshot.you.figureId, null);
  await assert.rejects(
    handleShelfRoom(db, { op: 'sync', ...a.session }, NOW + 31001),
    /expired/,
  );
});
