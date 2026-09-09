import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceFarm,
  farmAction,
  farmMove,
  farmPlayer,
  farmSnapshot,
  freshFarm,
} from './simulation';
import {
  farmMode,
  type FarmMode,
  type FarmSession,
  type FarmSnapshot,
} from './types';
import {
  coverBlocks,
  farmerSees,
  FARM_COVER,
  visionBoundary,
} from './visibility';
import { farmEvents } from './audio-events';
import { handleFarmRoom } from './rooms';
import type { RoomStore, Row } from '../../shared/rooms/types';
import { getCatalog } from '../../platform/audio/catalog';

const NOW = 100_000;
function round(mode: FarmMode = 'human', count = 4) {
  const world = freshFarm(NOW, 821);
  world.mode = mode;
  world.players = Array.from({ length: count }, (_, i) =>
    farmPlayer(`p${i}`, `Player ${i}`, NOW),
  );
  farmAction(world, 'p0', { type: 'start' }, 'p0');
  return world;
}
const cowFor = (w: ReturnType<typeof round>, id = 'p1') =>
  w.cows.find((c) => c.id === w.players.find((p) => p.id === id)!.cowId)!;
const view = (w: ReturnType<typeof round>, id = 'p0') =>
  farmSnapshot(w, 'FARMAB', 'p0', id, 1);

void test('computer rooms give all one to four players cows and run the computer patrol', () => {
  for (const count of [1, 2, 3, 4]) {
    const w = round('computer', count);
    assert.equal(w.practice, false);
    assert.equal(w.farmerId, 'computer-farmer');
    assert.equal(new Set(w.players.map((p) => p.cowId)).size, count);
    for (const p of w.players) assert.equal(view(w, p.id).you.role, 'cow');
    const before = { ...w.farmer };
    advanceFarm(w, w.clock + 100);
    assert.notDeepEqual(w.farmer, before);
    w.phase = 'farmer-win';
    farmAction(w, 'p0', { type: 'restart' }, 'p0');
    assert.equal(w.farmerId, 'computer-farmer');
    assert.ok(w.players.every((p) => p.cowId));
  }
});

void test('cooperative computer notices visible stolen equipment without assigning a human hunter', () => {
  const w = round('computer');
  const cow = cowFor(w);
  Object.assign(cow, { x: 0, z: 0, carrying: 'barn-key' });
  w.items[0].holder = cow.id;
  for (let i = 0; i < 80 && !cow.captured; i++) {
    Object.assign(w.farmer, { x: 0, z: -2.5, angle: 0 });
    for (const player of w.players) player.seen = w.clock + 50;
    advanceFarm(w, w.clock + 50);
  }
  assert.equal(cow.captured, true);
  assert.equal(w.farmerId, 'computer-farmer');
});

void test('human roles rotate, require a friend, and mode changes are host-only between rounds', () => {
  assert.throws(() => round('human', 1), /Invite/);
  const w = round();
  assert.equal(w.farmerId, 'p0');
  assert.equal(w.players.filter((p) => p.cowId).length, 3);
  assert.throws(
    () => farmAction(w, 'p0', { type: 'mode', mode: 'computer' }, 'p0'),
    /Finish/,
  );
  w.phase = 'farmer-win';
  farmAction(w, 'p0', { type: 'restart' }, 'p0');
  assert.equal(w.farmerId, 'p1');
  w.phase = 'farmer-win';
  assert.throws(
    () => farmAction(w, 'p1', { type: 'mode', mode: 'computer' }, 'p0'),
    /host/,
  );
  farmAction(w, 'p0', { type: 'mode', mode: 'computer' }, 'p0');
  assert.equal(w.phase, 'lobby');
  assert.ok(w.players.every((p) => !p.cowId));
  farmAction(w, 'p0', { type: 'start' }, 'p0');
  assert.ok(w.players.every((p) => p.cowId));
  assert.deepEqual(w.clues, []);
});

void test('human vision enforces facing, distance, near awareness and solid hay occlusion', () => {
  const w = round();
  Object.assign(w.farmer, { x: 0, z: 0, angle: 0 });
  assert.ok(farmerSees(w, { x: 0, z: 6.9 }));
  assert.ok(!farmerSees(w, { x: 0, z: 7.2 }));
  assert.ok(!farmerSees(w, { x: 0, z: -2 }));
  assert.ok(farmerSees(w, { x: 0, z: -1 }));
  Object.assign(w.farmer, { x: -6, z: -1, angle: Math.PI });
  assert.ok(!farmerSees(w, { x: -6, z: -6 }));
  assert.ok(farmerSees(w, { x: -3, z: -5 }));
  for (const point of visionBoundary(w))
    assert.ok(
      farmerSees(w, point),
      'painted vision agrees with server visibility',
    );
});

void test('farmer and host receive no hidden positions, inventory ownership or sabotage progress', () => {
  const w = round();
  const cow = cowFor(w);
  Object.assign(w.farmer, { x: -6, z: -1, angle: Math.PI });
  Object.assign(cow, { x: -6, z: -6, carrying: 'barn-key', task: 0.55 });
  w.items[0].holder = cow.id;
  const farmer = view(w);
  assert.ok(!farmer.world.cows.some((c) => c.id === cow.id));
  assert.ok(!farmer.world.items.some((item) => item.holder === cow.id));
  assert.ok(!JSON.stringify(farmer).includes('cowRoutines'));
  const own = view(w, 'p1');
  assert.equal(
    own.world.cows.find((c) => c.id === cow.id)?.carrying,
    'barn-key',
  );
  assert.equal(own.world.cows.find((c) => c.id === cow.id)?.task, 0.55);
  const friend = view(w, 'p2').world.cows.find((c) => c.id === cow.id)!;
  assert.equal(friend.carrying, null);
  assert.equal(friend.task, 0);
  Object.assign(w.farmer, { x: -6, z: -8, angle: 0 });
  const visible = view(w).world.cows.find((c) => c.id === cow.id)!;
  assert.equal(visible.carrying, null);
  assert.equal(visible.task, 0);
  assert.equal(visible.interacting, true);
});

void test('a nearby pickup makes a short anonymous clue, not a visible carried key or a distant notification', () => {
  const w = round();
  const cow = cowFor(w);
  Object.assign(cow, { x: -7, z: -6 });
  Object.assign(w.farmer, { x: -7, z: -8, angle: 0 });
  const before = view(w).world;
  farmAction(w, 'p1', { type: 'interact' }, 'p0');
  const after = view(w).world;
  assert.equal(after.cows.find((c) => c.id === cow.id)?.carrying, null);
  assert.equal(after.cows.find((c) => c.id === cow.id)?.interacting, true);
  assert.ok(!after.items.some((item) => item.id === 'barn-key'));
  const sounds = farmEvents(before, after);
  assert.equal(
    sounds.filter((sound) => sound.id === 'item.key.grab').length,
    1,
  );
  assert.ok(sounds.every((sound) => !sound.sourceId));
  assert.deepEqual(farmEvents(after, after), []);
  assert.ok(getCatalog('act-natural').some((cue) => cue.id === sounds[0].id));
  Object.assign(w.farmer, { x: 0, z: 5 });
  assert.deepEqual(view(w).world.clues, []);
  w.clock += 2100;
  Object.assign(w.farmer, { x: -7, z: -8, angle: 0 });
  assert.deepEqual(view(w).world.clues, []);
  assert.equal(
    view(w).world.cows.find((c) => c.id === cow.id)?.interacting,
    false,
  );
});

void test('losing sight removes cows and items; fence shock temporarily reveals a hidden cow and plays once', () => {
  const w = round();
  const cow = cowFor(w);
  Object.assign(cow, { x: 9, z: 0 });
  Object.assign(w.farmer, { x: 0, z: 0, angle: 0 });
  const before = view(w).world;
  assert.ok(!before.cows.some((c) => c.id === cow.id));
  w.clock += 50;
  cow.shockedAt = w.clock;
  const after = view(w).world;
  assert.ok(after.cows.some((c) => c.id === cow.id));
  assert.equal(
    farmEvents(before, after).filter((e) => e.id === 'event.fence-shock')
      .length,
    1,
  );
  assert.deepEqual(farmEvents(after, after), []);
  w.clock += 5000;
  assert.ok(!view(w).world.cows.some((c) => c.id === cow.id));
});

void test('inspection cannot target a cow through cover even when shock reveals it', () => {
  const w = round();
  const cow = cowFor(w);
  Object.assign(w.farmer, { x: -6, z: -2.4, angle: Math.PI });
  Object.assign(cow, { x: -6, z: -5.2, shockedAt: w.clock });
  assert.ok(view(w).world.cows.some((c) => c.id === cow.id));
  assert.throws(
    () => farmAction(w, 'p0', { type: 'inspect', target: cow.id }, 'p0'),
    /out of sight/,
  );
  assert.equal(w.inspections, 5);
  Object.assign(w.farmer, { x: -6, z: -7, angle: 0 });
  farmAction(w, 'p0', { type: 'inspect', target: cow.id }, 'p0');
  assert.ok(cow.captured);
});

void test('human hay stops and slides movement; spawns and ordinary cows stay outside cover', () => {
  const w = round();
  assert.ok(w.cows.every((c) => !coverBlocks(c)));
  const body = { x: -6, z: -1, angle: Math.PI };
  for (let i = 0; i < 40; i++) farmMove(body, { x: 0, z: -1 }, 3.5, 0.05, true);
  assert.ok(body.z > -3.1 && !coverBlocks(body));
  const oldX = body.x;
  for (let i = 0; i < 10; i++) farmMove(body, { x: 1, z: -1 }, 3.5, 0.05, true);
  assert.ok(body.x > oldX);
  for (let i = 0; i < 200; i++) {
    for (const player of w.players) player.seen = w.clock + 100;
    advanceFarm(w, w.clock + 100);
    assert.ok(w.cows.every((c) => !coverBlocks(c)));
  }
  const computerBody = { x: FARM_COVER[0].x, z: -1, angle: 0 };
  for (let i = 0; i < 20; i++)
    farmMove(computerBody, { x: 0, z: -1 }, 3.5, 0.05);
  assert.ok(computerBody.z < -4, 'computer mode keeps its open field');
});

void test('old room modes are inferred and human key carriers can graze without exposing inventory', () => {
  assert.equal(farmMode({ practice: true }), 'computer');
  assert.equal(farmMode({ practice: false }), 'human');
  const w = round();
  const cow = cowFor(w);
  cow.carrying = 'barn-key';
  w.players[1].input.graze = true;
  advanceFarm(w, w.clock + 100);
  assert.ok(cow.grazing);
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
void test('authenticated rooms support both modes, enforce mode authorization and send no peer checkpoint', async () => {
  for (const mode of ['computer', 'human'] as const) {
    const store = new MemoryStore();
    const host = (await handleFarmRoom(
      store,
      { op: 'create', mode, name: 'Host' },
      NOW,
    )) as Reply;
    const friend = (await handleFarmRoom(
      store,
      { op: 'join', code: host.session.code, name: 'Friend' },
      NOW + 1,
    )) as Reply;
    assert.equal(host.session.peer, undefined);
    assert.equal(host.snapshot.world.mode, mode);
    await assert.rejects(
      handleFarmRoom(
        store,
        {
          op: 'action',
          ...friend.session,
          requestId: 'mode',
          action: { type: 'mode', mode: 'computer' },
        },
        NOW + 2,
      ),
      /host/,
    );
    await assert.rejects(
      handleFarmRoom(
        store,
        {
          op: 'action',
          ...host.session,
          requestId: 'bad-mode',
          action: { type: 'mode', mode: 'invalid' },
        },
        NOW + 2,
      ),
      /valid/,
    );
    const started = (await handleFarmRoom(
      store,
      {
        op: 'action',
        ...host.session,
        requestId: 'start',
        action: { type: 'start' },
      },
      NOW + 3,
    )) as Reply;
    assert.equal(
      started.snapshot.you.role,
      mode === 'human' ? 'farmer' : 'cow',
    );
    assert.ok(!JSON.stringify(started.snapshot).includes('checkpoint'));
    assert.ok(started.snapshot.world.cows.length < 18 || mode === 'computer');
    await assert.rejects(
      handleFarmRoom(
        store,
        {
          op: 'action',
          ...host.session,
          requestId: 'during-play',
          action: { type: 'mode', mode: 'computer' },
        },
        NOW + 4,
      ),
      /Finish/,
    );
  }
});
