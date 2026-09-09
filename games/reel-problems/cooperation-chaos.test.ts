import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceReel,
  anglerPosition,
  cutLine,
  freshReel,
  hookedAnglers,
  newAngler,
  reelAction,
  removeAngler,
} from './simulation';
import { createEngine } from './peer';
import { BOAT_HALF, CATCHES, type ReelWorld } from './types';
import { advanceChaos } from './chaos';

function game(count = 2) {
  const w = freshReel(100_000);
  w.players = Array.from({ length: count }, (_, i) =>
    newAngler(String(i), `Angler ${i}`, i, w.clock),
  );
  reelAction(w, '0', { type: 'start' }, '0');
  return w;
}
function tick(w: ReelWorld, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++)
    advanceReel(w, w.clock + 1000 / 60);
}
function sharedFish(count = 2) {
  const w = game(count);
  w.weather.until = w.clock + 500_000;
  w.wildlife = [];
  const fish = w.fish.find((f) => f.kind === 'monster')!;
  w.fish = [fish];
  fish.x = 12;
  fish.z = 0;
  for (const p of w.players) {
    p.input.brace = true;
    reelAction(w, p.id, { type: 'cast', x: fish.x, z: fish.z }, '0');
  }
  tick(w, 0.6);
  assert.equal(hookedAnglers(w, fish.id).length, count);
  return { w, fish };
}

void test('Four anglers keep independent lines on one fish without stealing or tangling', () => {
  const { w, fish } = sharedFish(4);
  const lines = w.players.map((p) => p.line);
  tick(w, 3);
  for (const [i, p] of w.players.entries()) {
    assert.equal(p.line, lines[i]);
    assert.equal(p.line?.target, fish.id);
    assert.equal(p.line?.tangled, false);
  }
});

void test('A helper can join an existing moving fish and Space prefers helping a big catch', () => {
  const w = game();
  const fish = w.fish.find((f) => f.kind === 'monster')!;
  fish.x = 10;
  fish.z = 0;
  reelAction(w, '0', { type: 'cast', x: fish.x, z: fish.z }, '0');
  tick(w, 1);
  const first = w.players[0].line;
  assert.equal(first?.target, fish.id);
  reelAction(w, '1', { type: 'cast' }, '0');
  tick(w, 0.6);
  assert.equal(w.players[0].line, first);
  assert.equal(w.players[1].line?.target, fish.id);
});

void test('Two reeling lines tire and pull the monster faster than one', () => {
  const pair = sharedFish(),
    solo = sharedFish();
  cutLine(solo.w, solo.w.players[1]);
  for (const { w } of [pair, solo])
    for (const p of w.players) p.input.reel = true;
  tick(pair.w, 0.8);
  tick(solo.w, 0.8);
  assert.ok(pair.fish.stamina < solo.fish.stamina - 0.2);
  assert.ok(
    pair.fish.vx < solo.fish.vx,
    'the second line adds physical force toward the boat',
  );
});

void test('Cutting, snapping or disconnecting one angler preserves the other fish lines', () => {
  for (const reason of ['cut', 'snap', 'leave']) {
    const { w, fish } = sharedFish(3);
    const other = w.players[1],
      retained = other.line;
    if (reason === 'cut') cutLine(w, w.players[0]);
    if (reason === 'leave') removeAngler(w, '0');
    if (reason === 'snap') {
      w.players[0].line!.strain = 1.5;
      tick(w, 0.05);
    }
    assert.equal(hookedAnglers(w, fish.id).length, 2, reason);
    assert.equal(other.line, retained, reason);
    other.input.reel = true;
    const stamina = fish.stamina;
    tick(w, 0.2);
    assert.ok(fish.stamina < stamina, reason);
  }
});

void test('A shared landing scores once, credits all anglers and releases every hook', () => {
  const { w, fish } = sharedFish(4);
  for (let i = 0; i < 3600 && !w.haul.monster; i++) {
    for (const p of w.players)
      p.input.reel = !fish.surge && (p.line?.tension ?? 0) < 0.92;
    advanceReel(w, w.clock + 1000 / 60);
  }
  assert.equal(w.haul.monster, 1);
  assert.equal(w.score, CATCHES.monster.value);
  assert.ok(w.players.every((p) => p.catches === 1 && !p.line));
  assert.ok(fish.respawnAt > w.clock);
  tick(w, 1);
  assert.equal(w.score, CATCHES.monster.value);
});

void test('Sustained roll and pitch can slide idle players over every edge', () => {
  for (const axis of ['x', 'z'] as const)
    for (const sign of [-1, 1]) {
      const w = game(1),
        p = w.players[0];
      w.fish = [];
      w.wildlife = [];
      p.recoveredAt = w.clock - 3000;
      p[axis] = sign * (BOAT_HALF[axis] - 0.1);
      for (let i = 0; i < 120 && !p.swimming; i++) {
        w.boat[axis === 'x' ? 'roll' : 'pitch'] =
          sign * (axis === 'x' ? -0.72 : 0.72);
        advanceReel(w, w.clock + 1000 / 60);
      }
      assert.equal(p.swimming, true, `${axis} ${sign}`);
      assert.equal(p.splashes, 1);
      assert.ok(w.events.some((e) => e.kind === 'splash'));
    }
});

void test('Bracing resists moderate tilt but extreme tilt can still throw you out', () => {
  const w = game(1),
    p = w.players[0];
  w.fish = [];
  w.wildlife = [];
  p.recoveredAt = w.clock - 3000;
  p.x = BOAT_HALF.x;
  p.input.brace = true;
  for (let i = 0; i < 150; i++) {
    w.boat.roll = -0.65;
    advanceReel(w, w.clock + 1000 / 60);
  }
  assert.equal(p.swimming, false);
  for (let i = 0; i < 300 && !p.swimming; i++) {
    w.boat.roll = -1.05;
    advanceReel(w, w.clock + 1000 / 60);
  }
  assert.equal(p.swimming, true);
});

void test('Level rails are safe, rain increases sliding, and rescue grants recovery grace', () => {
  const w = game(1),
    p = w.players[0];
  w.fish = [];
  w.wildlife = [];
  p.input.x = 1;
  tick(w, 6);
  assert.equal(p.swimming, false);
  const dry = game(1),
    wet = game(1);
  for (const world of [dry, wet]) {
    world.fish = [];
    world.wildlife = [];
    world.players[0].x = 0;
    world.players[0].recoveredAt = world.clock - 3000;
  }
  wet.weather.kind = 'rain';
  wet.weather.rain = 0.7;
  for (let i = 0; i < 60; i++)
    for (const world of [dry, wet]) {
      world.boat.roll = -0.55;
      advanceReel(world, world.clock + 1000 / 60);
    }
  assert.ok(wet.players[0].x > dry.players[0].x + 0.08);
  p.swimming = true;
  p.overboardAt = w.clock;
  p.x = w.boat.x + 3;
  p.z = w.boat.z;
  p.slipX = 3;
  reelAction(w, p.id, { type: 'rescue' }, p.id);
  assert.equal(p.slipX, 0);
  p.input.x = 1;
  p.x = BOAT_HALF.x;
  for (let i = 0; i < 60; i++) {
    w.boat.roll = -1;
    advanceReel(w, w.clock + 1000 / 60);
  }
  assert.equal(p.swimming, false);
});

void test('Falling detaches only the swimmer and converts deck coordinates into lake coordinates', () => {
  const { w, fish } = sharedFish();
  const p = w.players[0],
    other = w.players[1];
  w.boat.x = 14;
  w.boat.z = 8;
  w.boat.yaw = Math.PI / 2;
  p.input.brace = false;
  p.recoveredAt = w.clock - 3000;
  p.x = BOAT_HALF.x + 0.25;
  w.boat.roll = -0.7;
  const position = anglerPosition(w, p);
  tick(w, 0.02);
  assert.equal(p.swimming, true);
  assert.ok(Math.hypot(p.x - position.x, p.z - position.z) < 0.1);
  assert.equal(p.line, null);
  assert.equal(other.line?.target, fish.id);
});

void test('A complete tournament includes repeatable wind, rain, thunder and wildlife', () => {
  const a = game(1),
    b = game(1);
  const kinds = new Set<string>();
  for (let i = 0; i < 3000; i++) {
    advanceReel(a, a.clock + 100);
    advanceReel(b, b.clock + 100);
    kinds.add(a.weather.kind);
    for (const e of a.events) kinds.add(e.kind);
    for (const v of a.wildlife) if (v.activeUntil > a.clock) kinds.add(v.kind);
  }
  for (const kind of [
    'calm',
    'wind',
    'rain',
    'storm',
    'thunder',
    'shark',
    'jellyfish',
  ])
    assert.ok(kinds.has(kind), kind);
  assert.deepEqual(a, b);
  assert.equal(a.phase, 'lost');
});

void test('Gusts move and rock the boat; a shark bumps the hull and jellyfish snag hooks', () => {
  const w = game(1);
  w.players[0].x = 0;
  w.players[0].z = 0;
  w.players[0].input.brace = true;
  w.weather.kind = 'wind';
  w.weather.direction = Math.PI / 2;
  w.weather.since -= 3000;
  tick(w, 2);
  assert.ok(w.boat.x > 1);
  assert.ok(Math.abs(w.boat.roll) > 0.08);
  const shark = w.wildlife[0];
  shark.activeUntil = w.clock + 5000;
  shark.hitAt = 0;
  shark.x = w.boat.x + 5.4;
  shark.z = w.boat.z;
  const before = w.boat.vx;
  advanceChaos(w, 1 / 60, () => {});
  assert.ok(w.boat.vx < before - 1);
  assert.ok(shark.hitAt > w.clock);
  w.fish = [];
  reelAction(w, '0', { type: 'cast', x: w.boat.x + 10, z: w.boat.z }, '0');
  const jelly = w.wildlife[1];
  jelly.activeUntil = w.clock + 5000;
  jelly.hitAt = 0;
  jelly.x = w.players[0].line!.x;
  jelly.z = w.players[0].line!.z;
  w.players[0].line!.clearUntil = 0;
  advanceChaos(w, 1 / 60, () => {});
  assert.equal(w.players[0].line?.tangled, true);
  tick(w, 0.3);
  reelAction(w, '0', { type: 'untangle' }, '0');
  assert.equal(w.players[0].line?.tangled, false);
});

void test('Host recovery keeps shared hooks, slipping, storm timing and encounters', () => {
  const { w, fish } = sharedFish(3);
  w.weather.kind = 'storm';
  w.weather.nextThunderAt = w.clock + 4000;
  w.wildlife = freshReel(w.clock).wildlife;
  w.wildlife[0].activeUntil = w.clock + 5000;
  w.players[1].slipX = 0.4;
  const engine = createEngine(w.clock);
  engine.world = w;
  const checkpoint = engine.checkpoint();
  const restored = createEngine(900_000, checkpoint);
  assert.deepEqual(restored.world.weather, w.weather);
  assert.deepEqual(restored.world.wildlife, w.wildlife);
  assert.equal(restored.world.players[1].slipX, 0.4);
  removeAngler(restored.world, '0');
  assert.equal(hookedAnglers(restored.world, fish.id).length, 2);
  const legacy = JSON.parse(JSON.stringify(checkpoint));
  delete legacy.world.weather;
  delete legacy.world.wildlife;
  for (const p of legacy.world.players) {
    delete p.slipX;
    delete p.slipZ;
  }
  legacy.world.fish[0].hooked = '0';
  const migrated = createEngine(900_000, legacy);
  assert.equal(hookedAnglers(migrated.world, fish.id).length, 3);
  migrated.advance(50);
  assert.ok(Number.isFinite(migrated.world.players[0].slipX));
  assert.equal(migrated.world.weather.kind, 'calm');
});
