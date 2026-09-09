import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FarmMotion } from './motion';
import { farmMove, FARMER_SPEED, farmCameraInput } from './movement';
import { farmSnapshot, farmPlayer, freshFarm } from './simulation';
import { coverBlocks } from './visibility';
import { handleFarmRoom } from './rooms';
import type { FarmSnapshot, FarmSession } from './types';
import type { RoomStore, Row } from '../../shared/rooms/types';

function snapshot(clock = 100_000): FarmSnapshot {
  const w = freshFarm(clock);
  w.players = [farmPlayer('host', 'Farmer', clock)];
  w.farmerId = 'host';
  w.phase = 'playing';
  w.started = 100_000;
  w.round = 1;
  const s = farmSnapshot(w, 'FARMAB', 'host', 'host', clock);
  s.you.motion = { x: 0, z: 0, sequence: 0 };
  return s;
}

void test('camera-relative diagonals and combined touch/keyboard controls match server movement exactly', () => {
  for (const [x, z] of [
    [1, 1],
    [-1, 1],
    [2, -1],
    [0.3, 0.5],
  ]) {
    const input = farmCameraInput(x, z, 0.5, false);
    assert.ok(Math.hypot(input.x, input.z) <= 1.000001);
    const predicted = { x: 0, z: 0, angle: 0 },
      authoritative = { ...predicted };
    const clamped = {
      x: Math.max(-1, Math.min(1, input.x)),
      z: Math.max(-1, Math.min(1, input.z)),
    };
    for (let i = 0; i < 120; i++) {
      farmMove(predicted, input, FARMER_SPEED, 1 / 60, true);
      farmMove(authoritative, clamped, FARMER_SPEED, 1 / 60, true);
    }
    assert.deepEqual(predicted, authoritative);
  }
});

void test('farmer starts on the first render frame without a network round trip', () => {
  const motion = new FarmMotion();
  motion.push(snapshot(), 0);
  const point = motion.frame(1000 / 60, 1 / 60, { x: 1, z: 0 }, false);
  assert.ok(point.x > 0.05);
  assert.ok(
    point.angle > 0 && point.angle < Math.PI / 2,
    'facing turns continuously',
  );
});

void test('irregular snapshots sustain continuous walking and settle after release', () => {
  const motion = new FarmMotion();
  const initial = snapshot();
  motion.push(initial, 0);
  const server = { ...initial.world.farmer };
  const packets: { at: number; snapshot: FarmSnapshot }[] = [];
  const intervals = [100, 160, 80, 140, 90];
  let nextPacket = 100,
    index = 0,
    lastZ = server.z;
  const steps: number[] = [];
  let stoppedZ = 0;
  for (let frame = 1; frame <= 180; frame++) {
    const now = (frame * 1000) / 60;
    const held = now < 1600;
    const serverHeld = now >= 60 && now < 1660;
    farmMove(
      server,
      { x: 0, z: serverHeld ? 1 : 0 },
      FARMER_SPEED,
      1 / 60,
      true,
    );
    if (now >= nextPacket) {
      const s = snapshot(100_000 + now);
      s.world.farmer = { ...server };
      s.you.motion = {
        x: 0,
        z: serverHeld ? 1 : 0,
        sequence: serverHeld ? 1 : 2,
      };
      s.latencyMs = 60 + (index % 3) * 20;
      packets.push({ at: now + s.latencyMs, snapshot: s });
      nextPacket += intervals[index++ % intervals.length];
    }
    for (let i = packets.length - 1; i >= 0; i--) {
      if (packets[i].at > now) continue;
      motion.push(packets[i].snapshot, now);
      packets.splice(i, 1);
    }
    const point = motion.frame(now, 1 / 60, { x: 0, z: held ? 1 : 0 }, false);
    if (now > 400 && now < 1500) steps.push(point.z - lastZ);
    if (frame === 114) stoppedZ = point.z;
    lastZ = point.z;
  }
  assert.ok(
    Math.min(...steps) > 0.025,
    `movement pauses: ${Math.min(...steps)}`,
  );
  assert.ok(
    Math.max(...steps) < 0.085,
    `movement jumps: ${Math.max(...steps)}`,
  );
  assert.ok(
    Math.abs(motion.farmer.z - server.z) < 0.05,
    'settles at the authoritative stop',
  );
  assert.ok(
    Math.abs(motion.farmer.z - stoppedZ) < 0.15,
    'no prolonged walking after release',
  );
});

void test('prediction cannot cross hay or a fence and stops extending during a disconnect', () => {
  for (const [x, z, input] of [
    [-6, -2.5, { x: 0, z: -1 }],
    [9.2, 0, { x: 1, z: 0 }],
  ] as const) {
    const motion = new FarmMotion();
    const s = snapshot();
    Object.assign(s.world.farmer, { x, z });
    s.you.motion = { ...input, sequence: 1 };
    motion.push(s, 0);
    for (let frame = 1; frame < 90; frame++) {
      const point = motion.frame((frame * 1000) / 60, 1 / 60, input, false);
      assert.ok(!coverBlocks(point));
      assert.ok(Math.abs(point.x) <= 9.4 && Math.abs(point.z) <= 9.4);
    }
  }
  const motion = new FarmMotion();
  motion.push(snapshot(), 0);
  for (let frame = 1; frame <= 600; frame++)
    motion.frame((frame * 1000) / 60, 1 / 60, { x: 1, z: 0 }, false);
  assert.ok(
    Math.abs(motion.farmer.x) < 0.05,
    'stale movement does not continue across the farm',
  );
  const reconnect = snapshot(105_000);
  reconnect.world.farmer.x = 7;
  motion.push(reconnect, 10_100);
  assert.equal(motion.farmer.x, 7, 'reconnect initializes from authority');
});

void test('remote farmer interpolation follows the short turn across the angle wrap', () => {
  const motion = new FarmMotion();
  const a = snapshot(),
    b = snapshot(100_150);
  a.you.role = b.you.role = 'cow';
  a.world.farmer.angle = Math.PI - 0.05;
  b.world.farmer.angle = -Math.PI + 0.05;
  motion.push(a, 0);
  motion.push(b, 150);
  for (let frame = 0; frame < 20; frame++) {
    const point = motion.frame(150 + frame * 16, 0.016, { x: 0, z: 0 }, false);
    assert.ok(Math.abs(point.angle) > 3, 'never spins through zero');
  }
});

void test('out-of-order room requests cannot overwrite newer controls and acknowledge only the requester', async () => {
  const rows = new Map<string, Row>();
  const store: RoomStore = {
    get: async (code) => rows.get(code) ?? null,
    insert: async (row) => {
      rows.set(row.code, { ...row });
      return true;
    },
    compareAndSwap: async (row, version) => {
      if (rows.get(row.code)?.version !== version) return false;
      rows.set(row.code, { ...row });
      return true;
    },
  };
  type Reply = { session: FarmSession; snapshot: FarmSnapshot };
  const host = (await handleFarmRoom(
    store,
    { op: 'create', mode: 'human', name: 'Host' },
    100_000,
  )) as Reply;
  const sync = (sequence: number, x: number) =>
    handleFarmRoom(
      store,
      {
        op: 'sync',
        ...host.session,
        inputSequence: sequence,
        input: { x, z: 0, graze: false },
      },
      100_100,
    );
  await sync(10, 1);
  await sync(12, 0);
  const stale = (await sync(11, -1)) as Reply;
  assert.deepEqual(stale.snapshot.you.motion, { sequence: 12, x: 0, z: 0 });
  const guest = (await handleFarmRoom(
    store,
    { op: 'join', code: host.session.code, name: 'Guest' },
    100_200,
  )) as Reply;
  assert.equal(guest.snapshot.you.motion, undefined);
  assert.ok(
    guest.snapshot.world.players.every(
      (p) => !('inputSequence' in p) && !('input' in p),
    ),
  );
  await assert.rejects(sync(-1, 1), /sequence/);
});
