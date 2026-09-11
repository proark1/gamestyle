import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, RaycastResult, Vec3 } from 'cannon-es';
import {
  advanceDelivery,
  deliveryAction,
  deliveryPlayer,
  freshDelivery,
  sofaInside,
} from './simulation';
import { deliveryPhysics, gripPosition } from './physics';
import {
  COTTAGE_WALLS,
  COTTAGES,
  FOUNDATIONS,
  GATE,
  LEVEL,
  PINES,
  ROUTE,
} from './level';
import {
  SOFA_CENTER,
  type DeliverySession,
  type DeliverySnapshot,
  type DeliveryWorld,
} from './types';
import { handleDeliveryRoom } from './rooms';
import type { RoomStore, Row } from '../../shared/rooms/types';
import { authorizeVoice } from '../../shared/voice/membership';

const NOW = 100000;
function round(count = 1) {
  const w = freshDelivery(NOW);
  w.players = Array.from({ length: count }, (_, i) =>
    deliveryPlayer(`p${i}`, `Mover ${i}`, i, NOW),
  );
  deliveryAction(w, 'p0', { type: 'start' }, 'p0');
  return w;
}
function advance(
  w: DeliveryWorld,
  seconds: number,
  input?: { x: number; z: number },
) {
  for (let i = 0; i < seconds * 60; i++) {
    for (const p of w.players) {
      p.seen = w.clock;
      if (input) p.input = { ...input, jump: false, seq: p.input.seq + 1 };
    }
    advanceDelivery(w, w.clock + 1000 / 60);
  }
}
function sofaAt(w: DeliveryWorld, x: number, y: number, z: number, yaw = 0) {
  const q = new Quaternion().setFromAxisAngle(new Vec3(0, 1, 0), yaw);
  w.sofa = {
    ...w.sofa,
    x,
    y: y + SOFA_CENTER,
    z,
    quaternion: { x: q.x, y: q.y, z: q.z, w: q.w },
    velocity: { x: 0, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: 0 },
  };
}
function memory() {
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
  return { rows, store };
}
type Reply = { session?: DeliverySession; snapshot?: DeliverySnapshot };
void test('sofa and workers settle onto the depot without sinking or drifting away', () => {
  const w = round();
  advance(w, 3);
  assert.ok(w.sofa.y > 0.7 && w.sofa.y < 1.4, `height ${w.sofa.y}`);
  assert.ok(w.players[0].grounded);
  assert.ok(Math.abs(w.players[0].y) < 0.2);
  assert.ok(w.sofa.velocity.y > -0.2);
  assert.equal(w.phase, 'playing');
});
void test('four distinct physical corners can be grabbed; the gate needs a free hand', () => {
  const w = round(4);
  for (let i = 0; i < 4; i++) {
    const g = gripPosition(w, i);
    Object.assign(w.players[i], {
      x: g.x,
      y: g.y - 1.2,
      z: g.z + (i < 2 ? 0.65 : -0.65),
    });
    deliveryAction(w, `p${i}`, { type: 'grab' }, 'p0');
  }
  assert.equal(new Set(w.players.map((p) => p.grip)).size, 4);
  Object.assign(w.players[0], { x: GATE.x, y: GATE.y, z: GATE.z });
  assert.throws(
    () => deliveryAction(w, 'p0', { type: 'interact' }, 'p0'),
    /free hand/,
  );
  deliveryAction(w, 'p0', { type: 'release' }, 'p0');
  deliveryAction(w, 'p0', { type: 'interact' }, 'p0');
  assert.ok(w.gateTarget > 1.5);
  assert.equal(w.players.filter((p) => p.grip !== null).length, 3);
});
function jumpHeight(w: DeliveryWorld) {
  const p = w.players[0],
    start = p.y;
  p.seen = w.clock;
  p.input = { x: 0, z: 0, jump: true, seq: p.input.seq + 1 };
  advanceDelivery(w, w.clock + 1000 / 60);
  let peak = 0;
  for (let i = 0; i < 60; i++) {
    advance(w, 1 / 60);
    peak = Math.max(peak, p.y - start);
  }
  return peak;
}
void test('workers jump from beside the gate and never hang from its top edge', () => {
  for (const side of [-1, 1]) {
    const w = round(),
      p = w.players[0];
    Object.assign(p, { x: GATE.x + side * 2.5, y: GATE.y + 0.8, z: GATE.z });
    advance(w, 1.5, { x: -side, z: 0 });
    assert.ok(Math.abs(p.x - GATE.x) < 0.5, `worker stopped at ${p.x}`);
    advance(w, 0.5, { x: 0, z: 0 });
    const height = jumpHeight(w);
    assert.ok(height > 1.4, `jumped ${height} beside the gate`);
  }
  for (const side of [-1, 1]) {
    const w = round(),
      p = w.players[0];
    Object.assign(p, { x: GATE.x + side * 0.45, y: GATE.y + 1.81, z: GATE.z });
    advance(w, 1);
    assert.ok(p.grounded, `worker hangs from the gate at ${p.x}, ${p.y}`);
    const height = jumpHeight(w);
    assert.ok(height > 1.4, `jumped ${height} after slipping off the gate`);
  }
});
void test('a solo worker can pull the actual sofa uphill and release without teleporting it', () => {
  const w = round();
  Object.assign(w.players[0], { x: -8.5, y: 0.15, z: 13.8 });
  deliveryAction(w, 'p0', { type: 'grab' }, 'p0');
  advance(w, 5, { x: 1, z: 0 });
  assert.ok(
    w.sofa.x > -7,
    `sofa x ${w.sofa.x}, player ${w.players[0].x}, grip ${w.players[0].grip}`,
  );
  const before = structuredClone(w.sofa);
  deliveryAction(w, 'p0', { type: 'release' }, 'p0');
  assert.deepEqual(w.sofa, before);
  advance(w, 1);
  assert.equal(w.players[0].grip, null);
  assert.ok(w.sofa.y > 0.4);
});
void test('a dropped sofa falls to the lowest ground, keeps its position across persistence, and never checkpoints', () => {
  let w = round();
  sofaAt(w, 19, 24, 4);
  w.bestHeight = 22;
  advance(w, 4);
  const height = w.sofa.y;
  assert.ok(height < 1, `height ${height}`);
  assert.ok(w.sofa.x > 15);
  w = JSON.parse(JSON.stringify(w));
  advance(w, 2);
  assert.ok(w.sofa.y < 1);
  assert.ok(w.sofa.x > 15);
  assert.ok(w.bestHeight > 23.9);
  assert.equal(w.phase, 'playing');
});
void test('cushions physically catch a falling worker and launch a bounce', () => {
  const w = round();
  sofaAt(w, -13, 0.02, 13);
  Object.assign(w.players[0], { x: -13, y: 4, z: 13.3 });
  let bounced = false;
  for (let i = 0; i < 150; i++) {
    advance(w, 1 / 60);
    if (w.players[0].velocity.y > 7) bounced = true;
  }
  assert.ok(
    bounced,
    `player y ${w.players[0].y}, events ${JSON.stringify(w.events)}`,
  );
});
void test('the sofa spans the broken path and supports a worker standing above the gap', () => {
  const w = round();
  sofaAt(w, 0, 13.7, -8);
  Object.assign(w.players[0], { x: 0, y: 14.9, z: -7.65 });
  advance(w, 1);
  assert.ok(w.sofa.y > 13.5, `sofa fell: ${w.sofa.y}`);
  assert.ok(w.players[0].y > 14, `worker fell: ${w.players[0].y}`);
  assert.ok(LEVEL.some((b) => b.ice));
  assert.equal(LEVEL.filter((b) => b.bridge).length, 25);
});
void test('opening the outward door imparts real velocity to a sofa on the porch', () => {
  const w = round();
  sofaAt(w, -1.9, 22.05, -23, Math.PI / 2);
  Object.assign(w.players[0], { x: -1, y: 22, z: -25.3 });
  deliveryAction(w, 'p0', { type: 'interact' }, 'p0');
  let maxSpeed = 0;
  for (let i = 0; i < 60; i++) {
    advance(w, 1 / 60);
    maxSpeed = Math.max(
      maxSpeed,
      Math.hypot(w.sofa.velocity.x, w.sofa.velocity.z),
    );
  }
  assert.ok(w.door > 1.5);
  assert.ok(maxSpeed > 1.5, `door caused ${maxSpeed} m/s`);
  assert.ok(w.sofa.x > -1.5);
  assert.equal(w.phase, 'playing');
});
void test('summit alone does not win; the entire released sofa must settle inside', () => {
  const w = round();
  sofaAt(w, 0, 22, -23);
  advance(w, 2);
  assert.equal(w.phase, 'playing');
  sofaAt(w, -6, 22.01, -23);
  w.door = w.doorTarget = Math.PI / 2;
  advance(w, 3);
  assert.ok(sofaInside(w));
  assert.equal(w.phase, 'delivered');
  assert.throws(() => deliveryAction(w, 'p0', { type: 'grab' }, 'p0'), /Start/);
});
void test('ice preserves more cargo momentum than the stone road', () => {
  const rough = round(),
    icy = round();
  sofaAt(rough, -13, 0.05, 13);
  // Mid-ramp: the landings at either end also touch the stone road.
  sofaAt(icy, 2, 18.45, -15);
  advance(rough, 1);
  advance(icy, 1);
  const a = deliveryPhysics(rough).sofa,
    b = deliveryPhysics(icy).sofa;
  a.velocity.z = b.velocity.z = 1.8;
  advance(rough, 0.5);
  advance(icy, 0.5);
  assert.ok(
    Math.abs(icy.sofa.velocity.z) > Math.abs(rough.sofa.velocity.z) + 0.3,
    `ice ${icy.sofa.velocity.z}, road ${rough.sofa.velocity.z}`,
  );
});
void test('all unbroken road sections, bridge landings and the icy ramp can be walked uphill', () => {
  for (const index of [0, 1, 2, 3, 4, 5, 7, 8, 9, 10]) {
    const w = round(),
      a = ROUTE[index],
      b = ROUTE[index + 1],
      p = w.players[0];
    w.gate = w.gateTarget = Math.PI / 2;
    Object.assign(p, { x: a.x, y: a.y + 0.6, z: a.z });
    for (let i = 0; i < 900 && Math.hypot(b.x - p.x, b.z - p.z) > 0.8; i++) {
      const distance = Math.hypot(b.x - p.x, b.z - p.z);
      advance(w, 1 / 60, {
        x: (b.x - p.x) / distance,
        z: (b.z - p.z) / distance,
      });
    }
    assert.ok(
      Math.hypot(b.x - p.x, b.z - p.z) < 0.8 && p.y > b.y - 0.4,
      `section ${index} stops at ${p.x}, ${p.y}, ${p.z}`,
    );
  }
});
void test('the ice is one smooth ramp with no stair riser along its length', () => {
  const physics = deliveryPhysics(round()),
    a = ROUTE[8],
    b = ROUTE[9];
  let previous = a.y;
  for (let x = a.x; x <= b.x; x += 0.05) {
    const hit = new RaycastResult();
    physics.engine.raycastClosest(
      new Vec3(x, 30, a.z),
      new Vec3(x, 10, a.z),
      { skipBackfaces: true },
      hit,
    );
    const y = hit.hitPointWorld.y;
    // Road pieces meet with lips of about 2 cm; a stair riser is ten times that.
    assert.ok(
      hit.hasHit && Math.abs(y - previous) < 0.03,
      `the surface jumps from ${previous} to ${y} at x ${x}`,
    );
    previous = y;
  }
  assert.ok(Math.abs(previous - b.y) < 0.05, `the ice tops out at ${previous}`);
});
void test('cargo released on the icy ramp slides back down it', () => {
  const w = round();
  sofaAt(w, 0, 18.1, -15);
  advance(w, 0.5);
  const start = w.sofa.x;
  advance(w, 1.5);
  assert.ok(w.sofaSurface?.startsWith('ice-'), `on ${w.sofaSurface}`);
  assert.ok(w.sofa.x < start - 1, `sofa held at ${w.sofa.x} from ${start}`);
});
void test('every house stands on a foundation from the mountain bottom, clear of the pines', () => {
  const bottom = LEVEL.find((b) => b.id === 'bottom')!,
    ground = bottom.position.y + bottom.size[1] / 2;
  const houses = [
    ...COTTAGES.map((c) => ({
      x: c.x,
      z: c.z,
      base: c.y,
      width: COTTAGE_WALLS[0],
      depth: COTTAGE_WALLS[2],
    })),
    ...LEVEL.filter((b) => b.id === 'customer-floor' || b.id === 'porch').map(
      (floor) => ({
        x: floor.position.x,
        z: floor.position.z,
        base: floor.position.y - floor.size[1] / 2,
        width: floor.size[0],
        depth: floor.size[2],
      }),
    ),
  ];
  assert.equal(houses.length, 6);
  for (const house of houses)
    assert.ok(
      FOUNDATIONS.some(
        ({ position: p, size }) =>
          Math.abs(p.y + size[1] / 2 - house.base) < 1e-6 &&
          p.y - size[1] / 2 < ground &&
          Math.abs(p.x - house.x) + house.width / 2 <= size[0] / 2 + 1e-6 &&
          Math.abs(p.z - house.z) + house.depth / 2 <= size[2] / 2 + 1e-6,
      ),
      `the house at ${house.x}, ${house.base}, ${house.z} stands on air`,
    );
  for (const pine of PINES)
    for (const { id, position: p, size } of FOUNDATIONS)
      assert.ok(
        // 1.15 × size is the widest cone of a pine.
        Math.hypot(
          Math.max(0, Math.abs(pine.x - p.x) - size[0] / 2),
          Math.max(0, Math.abs(pine.z - p.z) - size[2] / 2),
        ) >=
          1.15 * pine.size,
        `the pine at ${pine.x}, ${pine.z} grows into ${id}`,
      );
});
void test('solo assistance carries the sofa uphill through turns, bridge, alley and ice without resetting cargo', () => {
  for (const index of [1, 2, 3, 4, 5, 7, 8, 9, 10]) {
    const w = round(),
      a = ROUTE[index],
      b = ROUTE[index + 1],
      p = w.players[0];
    const length = Math.hypot(b.x - a.x, b.z - a.z),
      dx = (b.x - a.x) / length,
      dz = (b.z - a.z) / length;
    sofaAt(w, a.x, a.y + 0.1, a.z, Math.atan2(-dz, dx));
    w.gate = w.gateTarget = Math.PI / 2;
    Object.assign(p, {
      x: a.x + dx * 2.5 + dz * 0.7,
      y: a.y + 0.7,
      z: a.z + dz * 2.5 - dx * 0.7,
    });
    deliveryAction(w, p.id, { type: 'grab' }, p.id);
    const progress = () => (w.sofa.x - a.x) * dx + (w.sofa.z - a.z) * dz;
    for (let i = 0; i < 900 && progress() < length - 3; i++)
      advance(w, 1 / 60, { x: dx, z: dz });
    assert.ok(progress() >= length - 3, `cargo stuck on section ${index}`);
    assert.notEqual(p.grip, null, `lost grip on section ${index}`);
    assert.ok(
      w.sofa.y - SOFA_CENTER > b.y - 1.1,
      `cargo fell on section ${index}`,
    );
  }
});
void test('rooms enforce capacity, private membership, host control, input ordering, idempotency and voice isolation', async () => {
  const { store, rows } = memory();
  const first = (await handleDeliveryRoom(
    store,
    { op: 'create', name: 'Host' },
    NOW,
  )) as Reply;
  const s = first.session!,
    sessions = [s];
  const joined = await Promise.all(
    [1, 2, 3].map(
      (i) =>
        handleDeliveryRoom(
          store,
          { op: 'join', code: s.code, name: `Mover ${i}` },
          NOW + 1,
        ) as Promise<Reply>,
    ),
  );
  sessions.push(...joined.map((r) => r.session!));
  await assert.rejects(
    handleDeliveryRoom(store, { op: 'join', code: s.code }, NOW + 2),
    /full/,
  );
  assert.equal(
    (await authorizeVoice(store, { ...s, game: 'uphill-delivery' }, NOW + 2))
      .player.name,
    'Host',
  );
  await assert.rejects(
    authorizeVoice(store, { ...s, game: 'stack-or-sink' }, NOW + 2),
  );
  await assert.rejects(
    handleDeliveryRoom(store, { op: 'sync', ...s, token: 'forged' }, NOW + 2),
    /expired/,
  );
  await assert.rejects(
    handleDeliveryRoom(
      store,
      {
        op: 'action',
        ...sessions[1],
        requestId: 'start',
        action: { type: 'start' },
      },
      NOW + 3,
    ),
    /leader/,
  );
  const action = {
    op: 'action',
    ...s,
    requestId: 'start',
    action: { type: 'start' },
  };
  await handleDeliveryRoom(store, action, NOW + 4);
  await handleDeliveryRoom(store, action, NOW + 4);
  const r = (await handleDeliveryRoom(
    store,
    { op: 'sync', ...s, input: { x: 1, z: 0, jump: false, seq: 12 } },
    NOW + 5,
  )) as Reply;
  assert.equal(r.snapshot!.world.events.length, 1);
  assert.equal(r.snapshot!.world.players.length, 4);
  const older = (await handleDeliveryRoom(
    store,
    { op: 'sync', ...s, input: { x: -1, z: 0, jump: false, seq: 11 } },
    NOW + 6,
  )) as Reply;
  assert.equal(older.snapshot!.world.players[0].input.x, 1);
  assert.ok(!JSON.stringify(r.snapshot).includes(s.token));
  assert.ok(!JSON.stringify([...rows.values()]).includes(s.token));
  await handleDeliveryRoom(store, { op: 'leave', ...s }, NOW + 7);
  const next = (await handleDeliveryRoom(
    store,
    { op: 'sync', ...sessions[1] },
    NOW + 8,
  )) as Reply;
  assert.equal(next.snapshot!.host, sessions[1].id);
  assert.equal(next.snapshot!.world.players.length, 3);
});
void test('a disconnected worker releases their corner without resetting cargo', async () => {
  const { store, rows } = memory();
  const first = (await handleDeliveryRoom(
    store,
    { op: 'create' },
    NOW,
  )) as Reply;
  const s = first.session!,
    second = (await handleDeliveryRoom(
      store,
      { op: 'join', code: s.code },
      NOW,
    )) as Reply;
  const row = rows.get(`delivery:${s.code}`)!,
    room = JSON.parse(row.state);
  room.world.players[0].grip = 0;
  room.world.sofa.x = 5;
  rows.set(row.code, { ...row, state: JSON.stringify(room) });
  const result = (await handleDeliveryRoom(
    store,
    { op: 'sync', ...second.session },
    NOW + 31000,
  )) as Reply;
  assert.equal(result.snapshot!.world.players.length, 1);
  assert.equal(result.snapshot!.host, second.session!.id);
  assert.equal(result.snapshot!.world.sofa.x, 5);
});
