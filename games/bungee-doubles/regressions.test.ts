import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  advanceBungee,
  bungeeAction,
  bungeeSnapshot,
  EVENT_LIMIT,
  freshBall,
  freshBungeeWorld,
  HIT_COOLDOWN_MS,
  newPlayer,
  POINT_PAUSE_MS,
  prepareServe,
  reconcileBungeeBots,
  scorePoint,
} from './simulation';
import { stepBungeeBot } from './bots';
import { stepBallPhysics } from './physics';
import { createBungeeRunner } from './runner';
import { courtCameraDistance, courtViewport, movementAxes } from './controls';
import { createEngine } from './peer';

function solo() {
  const w = freshBungeeWorld(0);
  w.players.push(newPlayer('you', 'You', 0, 'red'));
  reconcileBungeeBots(w);
  prepareServe(w, 'red');
  return w;
}

void test('a complete solo match ends once and stays ended', (t) => {
  let seed = 345;
  t.mock.method(Math, 'random', () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  const w = solo();
  const run = createBungeeRunner(5000);
  for (let step = 0; step < 180 * 120 && w.phase !== 'ended'; step++)
    run(w, 1 / 120);
  assert.equal(w.phase, 'ended');
  assert.equal(Math.max(w.scores.red, w.scores.blue), 7);
  assert.equal(w.events.filter((e) => e.type === 'game_won').length, 1);
  assert.ok(w.events.length <= EVENT_LIMIT);
  const scores = { ...w.scores };
  for (let step = 0; step < 600; step++) run(w, 1 / 60);
  assert.deepEqual(w.scores, scores);
  assert.equal(w.phase, 'ended');
});

void test('NPC contact generates one hit, not six hits in 100 ms', () => {
  const w = freshBungeeWorld(0);
  const bot = newPlayer('bot-blue-1', 'NPC', 1, 'blue', true);
  Object.assign(bot, { x: 0, z: 5 });
  w.players = [bot];
  w.phase = 'rally';
  Object.assign(w.ball, {
    state: 'in_play',
    x: 0,
    y: 1,
    z: 4.5,
    vx: 0,
    vy: 0,
    vz: 8,
    lastHitTeam: 'red',
  });
  for (let i = 0; i < 6; i++) {
    stepBungeeBot(bot, w, 1 / 60, 1000 + (i * 1000) / 60);
    advanceBungee(w, 1 / 60, 1000 + (i * 1000) / 60);
  }
  assert.equal(w.events.filter((e) => e.type === 'racket_hit').length, 1);
  assert.equal(w.rallyCount, 1);
  assert.equal(bot.swingCooldown, 1000 + HIT_COOLDOWN_MS);
});

void test('teammates cannot re-hit an outgoing shot, but the opponent can return', () => {
  const w = solo();
  bungeeAction(w, 'you', { type: 'swing' }, 1000);
  const partner = w.players.find((p) => p.bot && p.team === 'red')!;
  Object.assign(partner, { x: w.ball.x, z: w.ball.z });
  bungeeAction(w, partner.id, { type: 'swing' }, 1400);
  assert.equal(partner.hits, 0);
  const receiver = w.players.find((p) => p.team === 'blue')!;
  Object.assign(w.ball, { x: receiver.x, y: 1, z: receiver.z });
  bungeeAction(w, receiver.id, { type: 'swing' }, 1500);
  assert.equal(receiver.hits, 1);
});

void test('initial players occupy distinct slots and ball follows named server', () => {
  const w = solo();
  assert.equal(new Set(w.players.map((p) => `${p.x}:${p.z}`)).size, 4);
  assert.equal(w.servingPlayerId, 'you');
  assert.equal(w.ball.x, w.players[0].x);
  assert.equal(w.ball.z, w.players[0].z + 0.9);
  bungeeAction(w, w.players[1].id, { type: 'swing' }, 0);
  assert.equal(w.phase, 'serving');
});

void test('repeated team switches preserve 2v2, unique IDs, valid serve and tether', () => {
  const w = solo();
  for (let i = 0; i < 20; i++) {
    bungeeAction(w, 'you', { type: 'switchTeam' }, i * 1000);
    advanceBungee(w, 1 / 120, i * 1000);
    for (const team of ['red', 'blue'] as const)
      assert.equal(w.players.filter((p) => p.team === team).length, 2);
    assert.equal(new Set(w.players.map((p) => p.id)).size, 4);
    const server = w.players.find((p) => p.id === w.servingPlayerId)!;
    assert.equal(server.team, w.serverTeam);
    const local = w.players.find((p) => p.id === 'you')!;
    const tether = w.tethers[local.team]!;
    assert.ok([tether.playerA, tether.playerB].includes('you'));
  }
});

void test('scoring has unique IDs and a simulation-owned pause, even if UI consumes the banner', () => {
  const w = solo();
  w.phase = 'rally';
  Object.assign(w.ball, {
    state: 'in_play',
    x: 0,
    y: 2,
    z: 10.7,
    vz: 14,
    currentSide: 'blue',
    lastHitTeam: 'red',
  });
  advanceBungee(w, 1 / 60, 1000);
  assert.equal(w.phase, 'scored');
  assert.equal(w.eventId, w.events.at(-1)!.id);
  const ball = { ...w.ball };
  scorePoint(w, 'blue', 'duplicate', 1001);
  bungeeAction(w, 'you', { type: 'swing' }, 1001);
  w.scoreBanner = null;
  advanceBungee(w, 1 / 60, 1000 + POINT_PAUSE_MS - 1);
  assert.equal(w.phase, 'scored');
  assert.deepEqual(w.ball, ball);
  assert.equal(w.scores.blue, 1);
  advanceBungee(w, 1 / 60, 1000 + POINT_PAUSE_MS);
  assert.equal(w.phase, 'serving');
  bungeeAction(w, w.servingPlayerId!, { type: 'swing' }, 3000);
  assert.equal(new Set(w.events.map((e) => e.id)).size, w.events.length);
});

void test('floor before glass in one step stays live; glass before floor faults once', () => {
  for (const floorFirst of [true, false]) {
    const w = freshBungeeWorld(0);
    w.phase = 'rally';
    Object.assign(w.ball, {
      state: 'in_play',
      x: 0,
      y: floorFirst ? 0.23 : 0.3,
      z: 10.7,
      vy: -2,
      vz: 12,
      currentSide: 'blue',
      lastHitTeam: 'red',
    });
    advanceBungee(w, 1 / 60, 1000);
    assert.equal(w.phase, floorFirst ? 'rally' : 'scored');
    assert.equal(w.scores.blue, floorFirst ? 0 : 1);
    assert.equal(new Set(w.events.map((e) => e.id)).size, w.events.length);
  }
});

void test('a ball that lands on the hitters own side loses the point', () => {
  const w = solo();
  w.phase = 'rally';
  Object.assign(w.ball, {
    state: 'in_play',
    x: 0,
    y: 0.23,
    z: -3,
    vy: -2,
    lastHitTeam: 'red',
  });
  advanceBungee(w, 1 / 60, 1000);
  assert.equal(w.scores.blue, 1);
});

void test('match end freezes gameplay; restart resets state without reusing IDs', () => {
  const w = solo();
  w.scores.red = 6;
  scorePoint(w, 'red', 'winner', 1000);
  const ball = { ...w.ball };
  const id = w.eventId;
  bungeeAction(w, 'you', { type: 'swing' }, 2000);
  bungeeAction(w, 'you', { type: 'jump' }, 2000);
  advanceBungee(w, 1 / 60, 2000);
  assert.deepEqual(w.ball, ball);
  assert.equal(w.eventId, id);
  bungeeAction(w, 'you', { type: 'restart' }, 3000);
  assert.equal(w.phase, 'serving');
  assert.deepEqual(w.scores, { red: 0, blue: 0 });
  assert.equal(w.winner, null);
  assert.equal(w.scoreBanner, null);
  bungeeAction(w, 'you', { type: 'swing' }, 3001);
  assert.ok(w.eventId > id);
});

void test('event retention stays bounded and snapshots remain detached', () => {
  const w = solo();
  for (let i = 0; i < 300; i++) {
    w.events.push({ id: ++w.eventId, type: 'racket_hit', text: 'hit' });
    advanceBungee(w, 1 / 120, i);
  }
  assert.equal(w.events.length, EVENT_LIMIT);
  const snap = bungeeSnapshot(w, 'SOLO', 'you', 'you');
  w.players[0].x = 100;
  w.ball.x = 100;
  w.scores.red = 5;
  assert.notEqual(snap.world.players[0].x, 100);
  assert.notEqual(snap.world.ball.x, 100);
  assert.equal(snap.world.scores.red, 0);
});

void test('fixed stepping produces identical motion at 30, 60, 120 and 144 Hz', () => {
  const runs = [30, 60, 120, 144].map((fps) => {
    const w = solo();
    w.players = [];
    w.phase = 'rally';
    Object.assign(w.ball, {
      state: 'in_play',
      y: 100,
      z: 0,
      x: 0,
      vx: 10,
      vz: 0,
    });
    const run = createBungeeRunner();
    for (let i = 0; i < fps; i++) run(w, 1 / fps);
    return w.ball;
  });
  for (const ball of runs) assert.deepEqual(ball, runs[0]);
  const speeds = [30, 60, 144].map((fps) => {
    const ball = freshBall();
    Object.assign(ball, { state: 'in_play', y: 100, x: 0, vx: 10 });
    for (let i = 0; i < fps; i++)
      stepBallPhysics(ball, 1 / fps, [], { current: 0 });
    return ball.vx;
  });
  assert.ok(Math.max(...speeds) - Math.min(...speeds) < 1e-10);
});

void test('peer match advances past a scored point without a UI clearing banners', () => {
  const engine = createEngine(0);
  engine.reconcile([
    { id: 'you', name: 'You', color: 0, order: 0, instance: 'a', seen: 0 },
  ]);
  scorePoint(engine.world, 'red', 'point', 0);
  for (let i = 0; i < 19; i++) engine.advance(100);
  assert.notEqual(engine.world.phase, 'scored');
});

void test('touch directions preserve magnitude and camera framing contains court corners', () => {
  assert.deepEqual(movementAxes(new Set(), { x: 0, z: -0.5 }), {
    x: 0,
    z: 0.5,
    magnitude: 0.5,
  });
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [1440, 900],
    [360, 640],
  ]) {
    const area = courtViewport(width, height);
    assert.ok(area.height > 0 && area.height + area.bottom < height);
    for (const yaw of [-2.16, 0, Math.PI / 2, Math.PI]) {
      const pitch = 0.67;
      const aspect = width / area.height;
      const distance = courtCameraDistance(yaw, pitch, aspect);
      const camera = new PerspectiveCamera(46, aspect, 0.1, 150);
      camera.position.set(
        distance * Math.cos(pitch) * Math.sin(yaw),
        1 + distance * Math.sin(pitch),
        distance * Math.cos(pitch) * Math.cos(yaw),
      );
      camera.lookAt(0, 1, 0);
      camera.updateMatrixWorld();
      for (const x of [-7, 7])
        for (const z of [-11.5, 11.5])
          for (const y of [0, 4]) {
            const point = new Vector3(x, y, z).project(camera);
            assert.ok(
              Math.abs(point.x) < 1 && Math.abs(point.y) < 1,
              `${width}x${height} yaw ${yaw}`,
            );
          }
    }
  }
});
