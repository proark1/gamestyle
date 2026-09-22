import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courseSolids,
  machineryAt,
  PENDULUM,
  SOLIDS,
  type Box,
} from './course';
import {
  advanceChainOfFools,
  chainOfFoolsAction,
  freshChainWorld,
  newPlayer,
} from './simulation';
import {
  moveWithCollisions,
  stepMachinery,
  stepPlayer,
  supportUnder,
} from './physics';
import {
  idleInput,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  ROUND_TIME_MS,
  type Player,
} from './types';

function worldWith(count = 1) {
  const world = freshChainWorld(1_000_000);
  for (let i = 0; i < count; i++)
    world.players.push(newPlayer(`p${i}`, 'Worker', i, i, false));
  chainOfFoolsAction(world, 'p0', { type: 'start' });
  return world;
}

function outside(p: Player, boxes: readonly Box[]) {
  for (const b of boxes) {
    if (p.y >= b.maxY - 0.003 || p.y + PLAYER_HEIGHT <= b.minY + 0.003)
      continue;
    const dx = p.x - Math.max(b.minX, Math.min(b.maxX, p.x));
    const dz = p.z - Math.max(b.minZ, Math.min(b.maxZ, p.z));
    assert.ok(
      dx * dx + dz * dz >= PLAYER_RADIUS ** 2 - 0.003,
      `overlap ${b.id}`,
    );
  }
}

void test('a lost worker resets every crew member and hazard, not just the faller', () => {
  const w = worldWith(4);
  w.clock += 40_000;
  w.checkpoint = 8;
  w.bestX = 169;
  w.pendulumVel = 2;
  w.plankTilt = 0.4;
  w.pendulumRider = 'p1';
  for (const p of w.players)
    Object.assign(p, {
      x: 165,
      y: 0,
      checkpoint: 8,
      vx: 5,
      anchorId: 'ring-net',
      haulProgress: 0.7,
      jumpGrace: 0.8,
    });
  w.players[0].y = -45;
  w.players[3].state = 'finished';
  advanceChainOfFools(w, w.clock + 1000 / 60, 1 / 60);
  assert.equal(w.wipes, 1);
  assert.equal(w.checkpoint, 0);
  assert.equal(w.bestX, 169);
  assert.equal(w.pendulumRider, null);
  assert.equal(w.pendulumAngle, PENDULUM.amplitude);
  assert.equal(w.pendulumVel, 0);
  assert.equal(w.plankTilt, 0);
  assert.ok(Math.abs(w.endsAt - w.startedAt - ROUND_TIME_MS) < 0.001);
  for (const p of w.players) {
    assert.ok(p.x < 4 && p.x > 0);
    assert.equal(p.state, 'standing');
    assert.equal(p.anchorId, null);
    assert.equal(p.checkpoint, 0);
    assert.equal(p.haulProgress, 0);
    assert.equal(p.jumpGrace, 0);
    assert.equal(p.vx, 0);
    assert.ok(p.respawnAt > w.clock);
    assert.deepEqual(p.input, idleInput());
  }
});

void test('a recoverable hang held by a clipped worker does not restart the crew', () => {
  const w = worldWith(2);
  Object.assign(w.players[0], { x: 23.4, y: 0, z: 0, anchorId: 'ring-gap-1' });
  Object.assign(w.players[1], {
    x: 23.4,
    y: -2,
    z: 2,
    state: 'dangling',
    grounded: false,
  });
  for (let i = 0; i < 180; i++)
    advanceChainOfFools(w, w.clock + 1000 / 60, 1 / 60);
  assert.equal(w.wipes, 0);
  assert.equal(w.players[0].anchorId, 'ring-gap-1');
});

void test('cargo deck carries an idle or braced rider through a full cycle at 30/60/120 Hz', () => {
  for (const rate of [30, 60, 120])
    for (const brace of [false, true]) {
      const w = worldWith();
      const p = w.players[0];
      Object.assign(p, { x: 130, y: 0, z: 0, grounded: true, braced: brace });
      p.input.brace = brace;
      for (let i = 0; i < rate * 10; i++) {
        w.clock += 1000 / rate;
        stepMachinery(w, 1 / rate);
        stepPlayer(p, 1 / rate, 0, courseSolids(w));
        const deck = machineryAt((w.clock - w.startedAt) / 1000)[0];
        assert.ok(Math.abs(p.x - (deck.minX + deck.maxX) / 2) < 0.01);
        assert.ok(p.grounded);
        outside(p, courseSolids(w));
      }
    }
});

void test('fast rope-like pushes cannot cross a moving load or a cargo deck underside', () => {
  const w = worldWith();
  const p = w.players[0];
  const solids = courseSolids(w);
  Object.assign(p, { x: 156.7, y: 0, z: 3, grounded: true });
  moveWithCollisions(p, 0, 0, -6, 0, false, solids);
  assert.ok(p.z >= 0.7 + PLAYER_RADIUS - 0.002);
  outside(p, solids);
  Object.assign(p, { x: 130, y: -5, z: 0, grounded: false });
  moveWithCollisions(p, 0, 8, 0, 0, false, solids);
  assert.ok(p.y + PLAYER_HEIGHT <= -0.599);
});

void test('a sweeping load pushes a worker out of its actual volume', () => {
  for (const rate of [30, 60, 120]) {
    const w = worldWith();
    const p = w.players[0];
    Object.assign(p, { x: 156.7, y: 0, z: 2, grounded: true });
    for (let i = 0; i < rate * 2; i++) {
      w.clock += 1000 / rate;
      stepMachinery(w, 1 / rate);
      outside(p, courseSolids(w));
    }
    assert.ok(p.z > 4, 'the load displaced the worker');
  }
});

void test('separate worlds cannot overwrite each other’s collision geometry', () => {
  const a = worldWith();
  const b = worldWith();
  const first = courseSolids(a);
  b.clock += 2500;
  const second = courseSolids(b);
  assert.notDeepEqual(first, second);
  assert.deepEqual(first, courseSolids(a));
  assert.equal(supportUnder(130, 0, 0, 0, first), 0);
  assert.equal(supportUnder(130, 0, 0, 0, SOLIDS), null);
});

void test('machinery freezes with the finished round instead of moving through the podium crew', () => {
  const w = worldWith();
  w.clock += 17_000;
  w.endedAt = w.clock;
  w.phase = 'ended';
  const boxes = courseSolids(w);
  advanceChainOfFools(w, w.clock + 10_000, 1 / 60);
  assert.deepEqual(courseSolids(w), boxes);
});
