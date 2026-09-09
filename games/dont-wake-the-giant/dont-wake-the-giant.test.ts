import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceGiant,
  freshGiant,
  giantAction,
  giantPlayer,
  heldItem,
  makeNoise,
  warnGiant,
} from './simulation';
import {
  bodyPoint,
  CHANDELIER,
  EXIT,
  FOOT,
  onTop,
  platforms,
  wakePose,
} from './level';
import { GiantModel } from './giant-model';
import { Vector3 } from 'three';
import {
  ESCAPE,
  idleInput,
  NIGHT,
  type GiantPlayer,
  type GiantSnapshot,
  type GiantWorld,
} from './types';
import { handleGiantRoom } from './rooms';
import { type RoomStore, type Row } from '../../shared/rooms/types';
import { authorizeVoice } from '../../shared/voice/membership';
const NOW = 100000;
function run() {
  const w = freshGiant(NOW);
  w.players = [giantPlayer('a', 'Ada', 0, NOW), giantPlayer('b', 'Bo', 1, NOW)];
  giantAction(w, 'a', { type: 'start' }, 'a');
  return w;
}
function place(
  w: GiantWorld,
  p: GiantPlayer,
  id: string,
  x?: number,
  z?: number,
) {
  const b = platforms(w).find((b) => b.id === id)!;
  Object.assign(p, {
    x: x ?? b.x,
    z: z ?? b.z,
    y: b.y,
    velocity: { x: 0, y: 0, z: 0 },
    support: id,
    grounded: true,
    input: idleInput(),
  });
}
function advance(w: GiantWorld, ms: number) {
  for (let t = 0; t < ms; t += 20) {
    w.players.forEach((p) => {
      p.seen = w.clock;
    });
    advanceGiant(w, w.clock + Math.min(20, ms - t));
  }
}
void test('breathing carries thieves and treasure through serialized snapshots without drift', () => {
  let w = run();
  place(w, w.players[0], 'belly', 1, 0.5);
  for (let n = 0; n < 120; n++) {
    advance(w, 50);
    w = JSON.parse(JSON.stringify(w));
    const belly = platforms(w).find((b) => b.id === 'belly')!;
    assert.ok(Math.abs(w.players[0].y - belly.y) < 0.001);
    assert.ok(
      Math.abs(
        w.items.find((i) => i.id === 'pocket-coins')!.y - belly.y - 0.12,
      ) < 0.001,
    );
    assert.equal(w.players[0].grounded, true);
  }
});
void test('a pillow on the breathing belly carries its standing passenger too', () => {
  const w = run(),
    pillow = w.items.find((i) => i.id === 'pillow-1')!,
    belly = platforms(w).find((b) => b.id === 'belly')!;
  Object.assign(pillow, { x: 1, z: 0, y: belly.y + 0.12, support: 'belly' });
  place(w, w.players[0], `item:${pillow.id}`);
  advance(w, 3000);
  assert.ok(Math.abs(w.players[0].y - pillow.y - 0.28) < 0.001);
});
void test('arm shifts are warned first and move a standing thief with the crossing', () => {
  const w = run(),
    p = w.players[0];
  place(w, p, 'arm');
  const startZ = p.z;
  warnGiant(w, 'roll');
  advance(w, 2000);
  assert.equal(p.z, startZ);
  assert.equal(w.armTo, 0.7);
  advance(w, 2100);
  assert.ok(p.z < startZ - 3);
  assert.equal(p.support, 'arm');
  assert.equal(p.grounded, true);
});
void test('tickling from the foot warns a sneeze and launches a belly passenger toward the chandelier', () => {
  const w = run();
  place(w, w.players[0], 'feet', FOOT.x, FOOT.z);
  place(w, w.players[1], 'belly', 2, 0);
  giantAction(w, 'a', { type: 'tickle' }, 'a');
  assert.equal(w.pending?.kind, 'sneeze');
  advance(w, 2100);
  assert.equal(w.players[1].grounded, true);
  advance(w, 200);
  assert.equal(w.players[1].grounded, false);
  assert.ok(w.players[1].velocity.y > 8);
  advance(w, 2100);
  assert.equal(w.players[1].support, 'chandelier');
  assert.equal(w.players[1].y, CHANDELIER.y);
  assert.equal(w.players[1].downUntil, 0);
});
void test('distant tickling cannot trigger a reaction and repeated tickles cannot bypass cooldown', () => {
  const w = run();
  assert.throws(() => giantAction(w, 'a', { type: 'tickle' }, 'a'), /foot/);
  place(w, w.players[0], 'feet');
  giantAction(w, 'a', { type: 'tickle' }, 'a');
  assert.throws(() => giantAction(w, 'a', { type: 'tickle' }, 'a'), /settle/);
});
void test('a pillow cushions a dangerous fall and a nearby friend can revive a hard landing', () => {
  const hard = run(),
    soft = run();
  for (const w of [hard, soft])
    Object.assign(w.players[0], {
      x: -9.2,
      y: 6,
      z: 5.4,
      grounded: false,
      support: null,
    });
  hard.items = hard.items.filter((i) => i.id !== 'pillow-1');
  advance(hard, 850);
  advance(soft, 850);
  assert.ok(hard.wakefulness > soft.wakefulness * 3);
  assert.ok(hard.players[0].downUntil > hard.clock);
  assert.equal(soft.players[0].downUntil, 0);
  Object.assign(hard.players[1], { x: -9.2, y: 0, z: 5.9 });
  giantAction(hard, 'b', { type: 'help' }, 'a');
  assert.equal(hard.players[0].downUntil, 0);
});
void test('a placed teaspoon becomes a supporting bridge, rotates, and can be picked up again', () => {
  const w = run(),
    p = w.players[0],
    spoon = w.items.find((i) => i.kind === 'spoon')!;
  Object.assign(p, { x: spoon.x, y: 0, z: spoon.z });
  giantAction(w, 'a', { type: 'interact' }, 'a');
  giantAction(w, 'a', { type: 'rotate' }, 'a');
  assert.equal(spoon.rotation, 1);
  giantAction(w, 'a', { type: 'drop' }, 'a');
  advance(w, 400);
  assert.equal(platforms(w).find((b) => b.id === `item:${spoon.id}`)?.d, 4.8);
  place(w, p, `item:${spoon.id}`);
  advance(w, 300);
  assert.equal(p.support, `item:${spoon.id}`);
  giantAction(w, 'a', { type: 'interact' }, 'a');
  assert.equal(spoon.heldBy, 'a');
  advance(w, 300);
  assert.equal(p.support, 'floor');
});
void test('banking needs the exit, preserves carried value once, and empty-handed exit ends the heist', () => {
  const w = run(),
    p = w.players[0],
    coin = w.items[0];
  Object.assign(p, { x: coin.x, z: coin.z });
  giantAction(w, 'a', { type: 'interact' }, 'a');
  assert.equal(heldItem(w, 'a')?.id, coin.id);
  assert.equal(w.banked, 0);
  Object.assign(p, EXIT);
  giantAction(w, 'a', { type: 'interact' }, 'a');
  assert.equal(w.banked, 15);
  assert.equal(coin.banked, true);
  giantAction(w, 'a', { type: 'exit' }, 'a');
  assert.equal(w.banked, 15);
  assert.equal(p.escaped, true);
  Object.assign(w.players[1], EXIT);
  giantAction(w, 'b', { type: 'exit' }, 'a');
  assert.equal(w.phase, 'ended');
});
void test('wake warning lasts three seconds; escape uses a real deadline even after room inactivity', () => {
  const w = run();
  w.banked = 50;
  makeNoise(w, 100, FOOT, 'Crash');
  const warningAt = w.pending!.at;
  advance(w, 2900);
  assert.equal(w.phase, 'playing');
  advance(w, 200);
  assert.equal(w.phase, 'escape');
  assert.equal(w.escapeAt, warningAt + ESCAPE);
  advanceGiant(w, warningAt + ESCAPE + 1000);
  assert.equal(w.phase, 'ended');
  assert.ok(w.players.every((p) => p.caught));
  assert.equal(w.banked, 50);
});
void test('sunrise and escape elapse while the room is idle instead of granting a fresh countdown', () => {
  const w = run();
  advanceGiant(w, NOW + NIGHT + 3000 + ESCAPE + 1000);
  assert.equal(w.phase, 'ended');
  assert.ok(w.players.every((p) => p.caught));
});
void test('crouching footsteps are quieter and stale input stops a disconnected thief', () => {
  const quiet = run(),
    loud = run();
  for (const w of [quiet, loud]) {
    w.players[0].input.x = 1;
    w.players[0].input.crouch = w === quiet;
    advance(w, 1000);
  }
  assert.ok(loud.wakefulness > quiet.wakefulness);
  const w = run();
  w.players[0].input.z = -1;
  advanceGiant(w, NOW + 1900);
  const z = w.players[0].z;
  advanceGiant(w, NOW + 2200);
  assert.equal(w.players[0].z, z);
});
function walkTo(
  w: GiantWorld,
  x: number,
  z: number,
  jumping = true,
  limit = 4500,
) {
  const p = w.players[0];
  for (let time = 0; time < limit; time += 20) {
    const dx = x - p.x,
      dz = z - p.z,
      dist = Math.hypot(dx, dz);
    p.input = {
      x: dist > 0.1 ? dx / Math.max(0.65, dist) : 0,
      z: dist > 0.1 ? dz / Math.max(0.65, dist) : 0,
      crouch: false,
      jump: jumping && p.grounded && dist > 0.7,
      seq: time + 1,
    };
    advance(w, 20);
    if (dist < 0.18 && p.grounded) {
      p.input = idleInput();
      return;
    }
  }
  assert.ok(
    Math.hypot(p.x - x, p.z - z) < 0.25,
    `could not reach ${x},${z} from ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} on ${p.support}`,
  );
}
void test('the full necklace route can be climbed with ordinary movement and banked outside', () => {
  const w = run();
  for (const [x, z] of [
    [-7.2, 6],
    [-5.3, 4.8],
    [-3.5, 3.4],
    [-1.5, 3.4],
    [1.8, 3.1],
    [1.8, 0.6],
    [2, -2.9],
    [2, -3.65],
  ])
    walkTo(w, x, z);
  assert.ok(w.players[0].y > 4);
  giantAction(w, 'a', { type: 'interact' }, 'a');
  assert.equal(heldItem(w, 'a')?.kind, 'necklace');
  walkTo(w, 2, 0.8);
  for (const [x, z] of [
    [2, 3.3],
    [-1.5, 3.4],
    [-3.5, 3.4],
    [-5.3, 4.8],
    [-7.2, 6],
    [-10.4, 8.5],
    [-11.7, 8.5],
  ])
    walkTo(w, x, z, false);
  giantAction(w, 'a', { type: 'interact' }, 'a');
  assert.equal(w.banked, 80);
});
void test('the bedside cup route can be climbed with ordinary movement', () => {
  const w = run();
  for (const [x, z] of [
    [-10, 2.2],
    [-6.2, 1.8],
    [-6.2, 0.5],
    [-6.2, -0.5],
    [-6.6, -2.6],
  ])
    walkTo(w, x, z);
  giantAction(w, 'a', { type: 'interact' }, 'a');
  assert.equal(heldItem(w, 'a')?.kind, 'cup');
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
    if (this.conflicts-- > 0 || this.rows.get(row.code)?.version !== version)
      return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
}
type Reply = {
  session: { id: string; code: string; token: string };
  snapshot: GiantSnapshot;
};
const create = async (db: MemoryStore) =>
  (await handleGiantRoom(db, { op: 'create', name: 'Ada' }, NOW)) as Reply;
void test('four concurrent room members share the world, keep tokens private, and reject a fifth thief', async () => {
  const db = new MemoryStore(),
    a = await create(db);
  const joins = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) =>
      handleGiantRoom(
        db,
        { op: 'join', code: a.session.code, name: `Thief${i}` },
        NOW + 10,
      ),
    ),
  );
  assert.equal(joins.filter((r) => r.status === 'fulfilled').length, 3);
  const r = (await handleGiantRoom(
    db,
    { op: 'sync', ...a.session },
    NOW + 20,
  )) as Reply;
  assert.equal(r.snapshot.world.players.length, 4);
  assert.equal(new Set(r.snapshot.world.players.map((p) => p.color)).size, 4);
  assert.ok(!JSON.stringify(r.snapshot).includes(a.session.token));
  assert.ok(!JSON.stringify(r.snapshot).includes('members'));
  await assert.rejects(
    handleGiantRoom(db, { op: 'sync', ...a.session, token: 'fake' }, NOW + 30),
    /expired/,
  );
});
void test('host controls and repeated action identifiers survive retries without restarting twice', async () => {
  const db = new MemoryStore(),
    a = await create(db),
    b = (await handleGiantRoom(
      db,
      { op: 'join', code: a.session.code, name: 'Bo' },
      NOW + 10,
    )) as Reply;
  await assert.rejects(
    handleGiantRoom(
      db,
      {
        op: 'action',
        ...b.session,
        action: { type: 'start' },
        requestId: 'start',
      },
      NOW + 20,
    ),
    /host/,
  );
  db.conflicts = 3;
  const body = {
    op: 'action',
    ...a.session,
    action: { type: 'start' },
    requestId: 'start',
  };
  await handleGiantRoom(db, body, NOW + 20);
  const again = (await handleGiantRoom(db, body, NOW + 50)) as Reply;
  assert.equal(again.snapshot.world.started, NOW + 20);
  await assert.rejects(
    handleGiantRoom(
      db,
      { op: 'join', code: a.session.code, name: 'late' },
      NOW + 60,
    ),
    /progress/,
  );
});
void test('concurrent treasure grabs have one owner; leaving releases it and transfers the host', async () => {
  const db = new MemoryStore(),
    a = await create(db),
    b = (await handleGiantRoom(
      db,
      { op: 'join', code: a.session.code, name: 'Bo' },
      NOW,
    )) as Reply;
  await handleGiantRoom(
    db,
    {
      op: 'action',
      ...a.session,
      action: { type: 'start' },
      requestId: 'start',
    },
    NOW,
  );
  const row = db.rows.get(`giant:${a.session.code}`)!,
    room = JSON.parse(row.state);
  const coin = room.world.items[0];
  // Isolate the contested item; nearby new loot may legitimately have another owner.
  room.world.items = [coin];
  room.world.players.forEach((p: GiantPlayer) =>
    Object.assign(p, { x: coin.x, y: 0, z: coin.z }),
  );
  row.state = JSON.stringify(room);
  const replies = await Promise.allSettled(
    [a, b].map((r, i) =>
      handleGiantRoom(
        db,
        {
          op: 'action',
          ...r.session,
          action: { type: 'interact' },
          requestId: `grab${i}`,
        },
        NOW + 10,
      ),
    ),
  );
  assert.equal(replies.filter((r) => r.status === 'fulfilled').length, 1);
  const next = JSON.parse(db.rows.get(row.code)!.state);
  const owner = next.world.items[0].heldBy;
  const leaving = owner === a.session.id ? a : b;
  const staying = owner === a.session.id ? b : a;
  await handleGiantRoom(db, { op: 'leave', ...leaving.session }, NOW + 20);
  const state = (await handleGiantRoom(
    db,
    { op: 'sync', ...staying.session },
    NOW + 30,
  )) as Reply;
  assert.equal(state.snapshot.world.items[0].heldBy, null);
  assert.equal(state.snapshot.host, staying.session.id);
});
void test('multiplayer handoffs survive concurrent retries with exactly one owner and one event', async () => {
  const db = new MemoryStore(),
    a = await create(db);
  const b = (await handleGiantRoom(
    db,
    { op: 'join', code: a.session.code, name: 'Bo' },
    NOW,
  )) as Reply;
  await handleGiantRoom(
    db,
    {
      op: 'action',
      ...a.session,
      action: { type: 'start' },
      requestId: 'start',
    },
    NOW,
  );
  const row = db.rows.get(`giant:${a.session.code}`)!,
    room = JSON.parse(row.state);
  room.world.items = [
    room.world.items.find((i: { kind: string }) => i.kind === 'cup'),
  ];
  Object.assign(room.world.items[0], { heldBy: a.session.id, support: null });
  Object.assign(room.world.players[0], {
    x: -2.6,
    y: 2.6,
    z: -5,
    support: 'bed',
    grounded: true,
  });
  Object.assign(room.world.players[1], {
    x: -3.6,
    y: 0,
    z: -5,
    support: 'floor',
    grounded: true,
  });
  row.state = JSON.stringify(room);
  const body = {
    op: 'action',
    ...a.session,
    action: { type: 'pass' },
    requestId: 'pass-once',
  };
  await Promise.all([
    handleGiantRoom(db, body, NOW + 10),
    handleGiantRoom(db, body, NOW + 10),
  ]);
  const reply = (await handleGiantRoom(
    db,
    { op: 'sync', ...b.session },
    NOW + 20,
  )) as Reply;
  assert.equal(reply.snapshot.world.items[0].heldBy, b.session.id);
  assert.equal(reply.snapshot.world.wakefulness, 0);
  assert.equal(
    reply.snapshot.world.events.filter((e) => e.text.includes('quietly passed'))
      .length,
    1,
  );
  await assert.rejects(
    handleGiantRoom(db, { ...body, requestId: 'pass-again' }, NOW + 30),
    /steady footing/,
  );
});

void test('old movement cannot overwrite a stop, and giant voice membership is isolated', async () => {
  const db = new MemoryStore(),
    a = await create(db);
  const send = (seq: number, x: number) =>
    handleGiantRoom(
      db,
      {
        op: 'sync',
        ...a.session,
        input: { x, z: 0, jump: false, crouch: false, seq },
      },
      NOW + seq * 10,
    );
  await send(1, 1);
  await send(3, 0);
  const r = (await send(2, 1)) as Reply;
  assert.equal(r.snapshot.world.players[0].input.x, 0);
  await assert.rejects(
    handleGiantRoom(
      db,
      {
        op: 'sync',
        ...a.session,
        input: { x: 1, z: 0, jump: false, crouch: 'no', seq: 4 },
      },
      NOW + 40,
    ),
    /Invalid/,
  );
  const voice = await authorizeVoice(
    db,
    { ...a.session, game: 'dont-wake-the-giant' },
    NOW + 50,
  );
  assert.ok(voice.name.startsWith('gamestyle-dont-wake-the-giant-'));
  await assert.rejects(
    authorizeVoice(db, { ...a.session, game: 'uphill-delivery' }, NOW + 50),
  );
});

void test('22 treasures span reachable surfaces, with the best loot above floor level', () => {
  const w = run(),
    treasure = w.items.filter((i) => i.value > 0);
  assert.equal(treasure.length, 22);
  assert.equal(new Set(w.items.map((i) => i.id)).size, w.items.length);
  assert.ok(
    treasure
      .filter((i) => i.support === 'floor')
      .reduce((n, i) => n + i.value, 0) < w.target,
  );
  assert.ok(treasure.reduce((n, i) => n + i.value, 0) > 700);
  for (const item of w.items) {
    const support = platforms(w).find((p) => p.id === item.support)!;
    assert.ok(
      support && onTop(item, support),
      `${item.id} must start on its visible support`,
    );
    assert.ok(
      Math.abs(item.y - support.y - 0.12) < 0.001,
      `${item.id} must not float`,
    );
  }
});

void test('the crown can be reached over the larger giant and carried back to the door', () => {
  const w = run();
  for (const [x, z] of [
    [-7.2, 6],
    [-5.3, 4.8],
    [-3.5, 3.4],
    [-1.5, 3.4],
    [1.8, 3.1],
    [1.8, 0.6],
    [2, -2.9],
    [2, -4.5],
    [2, -6.3],
  ])
    walkTo(w, x, z);
  giantAction(w, 'a', { type: 'interact' }, 'a');
  assert.equal(heldItem(w, 'a')?.kind, 'crown');
  walkTo(w, 2, -3);
  walkTo(w, 2, 0.8);
  for (const [x, z] of [
    [2, 3.3],
    [-1.5, 3.4],
    [-3.5, 3.4],
    [-5.3, 4.8],
    [-7.2, 6],
    [EXIT.x, EXIT.z],
  ])
    walkTo(w, x, z, false);
  giantAction(w, 'a', { type: 'exit' }, 'a');
  assert.equal(w.banked, 100);
  assert.equal(w.players[0].escaped, true);
});

void test('sitting up releases nested tool passengers and loose loot but preserves held treasure', () => {
  const w = run(),
    pillow = w.items.find((i) => i.id === 'pillow-1')!,
    coin = w.items.find((i) => i.id === 'pocket-coins')!;
  const belly = platforms(w).find((p) => p.id === 'belly')!;
  Object.assign(pillow, { x: 1, z: 0, y: belly.y + 0.12, support: 'belly' });
  place(w, w.players[0], `item:${pillow.id}`);
  Object.assign(coin, { heldBy: 'a', support: null });
  warnGiant(w, 'wake');
  advance(w, 2900);
  assert.equal(w.players[0].support, `item:${pillow.id}`);
  advance(w, 150);
  assert.equal(w.phase, 'escape');
  assert.equal(w.players[0].grounded, false);
  assert.equal(pillow.support, null);
  assert.notEqual(w.items.find((i) => i.id === 'crown')!.support, 'head');
  assert.equal(heldItem(w, 'a')?.id, coin.id);
  advance(w, 1700);
  assert.equal(heldItem(w, 'a')?.id, coin.id);
  walkTo(w, -2.55, 6.9, false, 14000);
  walkTo(w, -2.55, 8.3, false, 4500);
  walkTo(w, EXIT.x, EXIT.z, false, 9000);
  giantAction(w, 'a', { type: 'exit' }, 'a');
  assert.equal(w.banked, 30);
  assert.equal(w.players[0].escaped, true);
  assert.ok(w.clock < w.escapeAt);
});

void test('the giant stands fully, opens both eyes and stays awake across reconnects', () => {
  let w = run();
  const model = new GiantModel(w),
    head = model.parts.get('head')!;
  assert.equal(head.userData.leftEye.white.visible, false);
  const sleepingY = head.getWorldPosition(new Vector3()).y;
  warnGiant(w, 'wake');
  advance(w, 8500);
  w = JSON.parse(JSON.stringify(w));
  model.update(w, 1);
  model.updateMatrixWorld(true);
  const actual = head.getWorldPosition(new Vector3());
  const pose = wakePose(w);
  const expected = bodyPoint(
    { x: 2, y: 5.2, z: -6.1 },
    pose.angle,
    pose.lift,
    pose.shift,
  );
  assert.ok(actual.y > sleepingY + 6);
  assert.ok(
    actual.distanceTo(new Vector3(expected.x, expected.y, expected.z)) < 0.001,
  );
  assert.ok(platforms(w).find((p) => p.id === 'head')!.y > 12);
  assert.equal(pose.stand, 1);
  assert.ok(
    model.legRigs.every((leg) => Math.abs(leg.foot.rotation.x) < 0.001),
  );
  const feet = platforms(w).find((p) => p.id === 'feet')!;
  assert.ok(
    feet.y - feet.h >= 2.6,
    'standing feet must not sink through the mattress',
  );
  assert.equal(head.userData.leftEye.white.visible, true);
  assert.equal(head.userData.rightEye.lid.visible, false);
  advanceGiant(w, w.escapeAt + 100);
  model.update(w, 1);
  assert.ok(model.torso.rotation.x > 1.2);
  giantAction(w, 'a', { type: 'restart' }, 'a');
  model.update(w, 1);
  assert.equal(model.torso.rotation.x, 0);
  assert.equal(model.legs.rotation.x, 0);
  assert.equal(wakePose(w).lift, 0);
  assert.equal(head.userData.leftEye.white.visible, false);
});
