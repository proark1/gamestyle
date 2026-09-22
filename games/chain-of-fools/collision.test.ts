import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHECKPOINTS,
  FINISH_X,
  SOLIDS,
  courseSolids,
  type Box,
  plankSurfaceY,
} from './course';
import { reconcileChainBots, stepChainBot } from './bots';
import { createEngine } from './peer';
import { moveWithCollisions, stepChain, stepPlayer } from './physics';
import {
  advanceChainOfFools,
  chainOfFoolsAction,
  crewScore,
  freshChainWorld,
  newPlayer,
  placeAtCheckpoint,
} from './simulation';
import {
  CHAIN_MAX,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  timeLeft,
  type Player,
} from './types';

function playing(count = 1) {
  const world = freshChainWorld(1_000_000);
  for (let i = 0; i < count; i++)
    world.players.push(newPlayer(`p${i}`, `Worker ${i}`, i, i, false));
  chainOfFoolsAction(world, 'p0', { type: 'start' });
  return world;
}

function assertOutside(player: Player, solids: readonly Box[] = SOLIDS) {
  for (const b of solids) {
    if (
      player.y >= b.maxY - 0.002 ||
      player.y + PLAYER_HEIGHT <= b.minY + 0.002
    )
      continue;
    const dx = player.x - Math.max(b.minX, Math.min(b.maxX, player.x));
    const dz = player.z - Math.max(b.minZ, Math.min(b.maxZ, player.z));
    assert.ok(
      dx * dx + dz * dz >= PLAYER_RADIUS ** 2 - 0.002,
      `${player.id} intersects ${b.id} at ${player.x}, ${player.y}, ${player.z}`,
    );
  }
}

void test('the head and torso collide even when boots are below a deck', () => {
  const p = newPlayer('p', 'P', 0, 0, false);
  Object.assign(p, { x: 100, y: 6.5, z: 2.5, grounded: false });
  moveWithCollisions(p, 0, 0, -4, 0);
  assert.ok(p.z >= 1.4 + PLAYER_RADIUS - 0.002);
  assertOutside(p);
});

void test('a fast forced move cannot tunnel through a thin duct wall', () => {
  const p = newPlayer('p', 'P', 0, 0, false);
  Object.assign(p, { x: 100, y: 8, z: 0, vz: 150 });
  moveWithCollisions(p, 0, 0, 20, 0);
  assert.ok(p.z <= 1 - PLAYER_RADIUS + 0.002);
  assert.ok(p.vz <= 0.001);
  assertOutside(p);
});

void test('forced vertical movement cannot pass through the underside of a floor', () => {
  const p = newPlayer('p', 'P', 0, 0, false);
  Object.assign(p, { x: 100, y: 4, z: 0, grounded: false });
  moveWithCollisions(p, 0, 12, 0, 0);
  assert.ok(p.y + PLAYER_HEIGHT <= 7.501);
  assertOutside(p);
});

void test('rope corrections respect walls and preserve their length limit', () => {
  const world = playing(2);
  const [a, b] = world.players;
  Object.assign(a, { x: 100, y: 8, z: 0, anchorId: 'test-anchor' });
  Object.assign(b, { x: 100, y: 8, z: 12, grounded: false });
  for (let i = 0; i < 30; i++) stepChain(world, 1 / 60, [], { current: 0 });
  assertOutside(a);
  assertOutside(b);
  assert.ok(b.z >= 1.4 + PLAYER_RADIUS - 0.002);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) <= CHAIN_MAX + 0.02);
});

void test('clipping prevents gravity and jump input from moving the anchor', () => {
  const p = newPlayer('p', 'P', 0, 0, false);
  Object.assign(p, { x: 23.4, y: 0, z: 0, anchorId: 'ring-gap-1' });
  p.input.jump = true;
  p.input.x = 1;
  for (let i = 0; i < 120; i++) stepPlayer(p, 1 / 60, 0);
  assert.equal(p.x, 23.4);
  assert.equal(p.y, 0);
});

void test('jumping off the net actually releases the worker', () => {
  const world = playing();
  const p = world.players[0];
  Object.assign(p, { x: 118.5, y: 6, z: 0, grounded: false });
  p.input.jump = true;
  advanceChainOfFools(world, world.clock + 16, 1 / 60);
  p.input.jump = false;
  for (let i = 0; i < 10; i++)
    advanceChainOfFools(world, world.clock + 16, 1 / 60);
  assert.ok(p.x > 118.7);
  assert.ok(p.y > 6.2, `released upwards: ${p.y}`);
});

void test('diagonal movement has the same speed as straight movement', () => {
  const straight = newPlayer('a', 'A', 0, 0, false);
  const diagonal = newPlayer('b', 'B', 0, 0, false);
  for (const p of [straight, diagonal]) Object.assign(p, { x: 0, y: 0, z: 0 });
  straight.input.x = diagonal.input.x = 1;
  diagonal.input.z = 1;
  for (let i = 0; i < 30; i++) {
    stepPlayer(straight, 1 / 60, 0);
    stepPlayer(diagonal, 1 / 60, 0);
  }
  assert.ok(Math.abs(straight.x - Math.hypot(diagonal.x, diagonal.z)) < 0.001);
});

void test('falling past the office or bypassing it sideways cannot finish', () => {
  for (const [y, z] of [
    [-5, 0],
    [0, 12],
    [4, 0],
  ]) {
    const world = playing();
    Object.assign(world.players[0], {
      x: FINISH_X + 0.2,
      y,
      z,
      grounded: false,
    });
    advanceChainOfFools(world, world.clock + 16, 1 / 60);
    assert.notEqual(world.players[0].state, 'finished');
    assert.equal(world.winner, null);
  }
});

void test('the final score and time remaining stay fixed after a win', () => {
  const world = playing();
  Object.assign(world.players[0], {
    x: FINISH_X + 0.2,
    y: 0,
    z: 0,
    grounded: true,
  });
  advanceChainOfFools(world, world.clock + 16, 1 / 60);
  assert.equal(world.winner, 'crew');
  const score = crewScore(world);
  const remaining = timeLeft(world);
  advanceChainOfFools(world, world.clock + 60_000, 0.1);
  assert.equal(crewScore(world), score);
  assert.equal(timeLeft(world), remaining);
});

void test('a replay clears clip, brace, checkpoint and jump state', () => {
  const world = playing();
  const p = world.players[0];
  Object.assign(p, {
    braced: true,
    anchorId: 'ring-net',
    checkpoint: 6,
    jumpGrace: 0.6,
  });
  world.pendulumAngle = 0;
  chainOfFoolsAction(world, p.id, { type: 'restart' });
  assert.equal(p.braced, false);
  assert.equal(p.anchorId, null);
  assert.equal(p.checkpoint, 0);
  assert.equal(p.jumpGrace, 0);
  assert.ok(world.pendulumAngle > 0);
});

void test('hauling lifts a worker around the edge without entering the deck', () => {
  const world = playing(2);
  const [helper, target] = world.players;
  Object.assign(helper, { x: 80, y: 8, z: 0, grounded: true });
  Object.assign(target, {
    x: 79.8,
    y: 5.5,
    z: 2.5,
    grounded: false,
    state: 'dangling',
    airTime: 1,
  });
  helper.input.haul = true;
  helper.input.brace = true;
  for (let i = 0; i < 240 && target.state !== 'standing'; i++) {
    advanceChainOfFools(world, world.clock + 1000 / 60, 1 / 60);
    assertOutside(target);
  }
  assert.equal(target.state, 'standing');
  assert.ok(target.grounded);
});

void test('tilted plank height matches the rendered rotated board', () => {
  const tilt = 0.4;
  const localX = 2;
  assert.ok(
    Math.abs(
      plankSurfaceY(73 + Math.cos(tilt) * localX, tilt) -
        (8 + Math.sin(tilt) * localX),
    ) < 1e-10,
  );
});

void test('a worker cannot enter the plank through its side or underside', () => {
  const p = newPlayer('p', 'P', 0, 0, false);
  Object.assign(p, { x: 73, y: 6.5, z: 3, grounded: false });
  moveWithCollisions(p, 0, 0, -3, 0);
  assert.ok(p.z >= 1.5 + PLAYER_RADIUS - 0.002);
  Object.assign(p, { x: 73, y: 4, z: 0 });
  moveWithCollisions(p, 0, 6, 0, 0);
  assert.ok(p.y + PLAYER_HEIGHT <= 7.841);
});

void test('joining and leaving mid-course replaces a crew slot in place', () => {
  const engine = createEngine(1_000_000);
  const a = { id: 'a', name: 'Ana', color: 0 };
  const b = { id: 'b', name: 'Bo', color: 1 };
  engine.reconcile([a] as never);
  engine.execute('a', 'start', { type: 'start' }, 'a');
  const world = engine.world as unknown as ReturnType<typeof freshChainWorld>;
  world.checkpoint = 6;
  placeAtCheckpoint(world, 6);
  engine.reconcile([a, b] as never);
  assert.ok(world.players.every((p) => p.x > 112));
  engine.reconcile([a] as never);
  assert.ok(world.players.every((p) => p.x > 112));
  assert.equal(new Set(world.players.map((p) => p.id)).size, 4);
});

void test('a bot crew completes every checkpoint with no solid penetrations', () => {
  for (const rate of [30, 60, 120]) {
    const world = freshChainWorld(1_000_000);
    reconcileChainBots(world);
    chainOfFoolsAction(world, 'bot-1', { type: 'start' });
    for (
      let frame = 0;
      frame < rate * 230 && world.phase === 'playing';
      frame++
    ) {
      for (const p of world.players) stepChainBot(p, world, 1 / rate);
      advanceChainOfFools(world, world.clock + 1000 / rate, 1 / rate);
      for (const p of world.players) assertOutside(p, courseSolids(world));
    }
    assert.equal(world.winner, 'crew', `${rate} Hz, best ${world.bestX}`);
    assert.equal(world.checkpoint, CHECKPOINTS.length - 1);
    placeAtCheckpoint(world, world.checkpoint);
    for (const p of world.players) assertOutside(p);
  }
});
