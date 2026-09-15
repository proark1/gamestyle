import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceBungee,
  freshBall,
  freshBungeeWorld,
  newPlayer,
  scorePoint,
} from './simulation';
import { reconcileBungeeBots } from './bots';
import {
  calculateRacketShot,
  getNetHeightAt,
  isInsideCourt,
  stepBallPhysics,
  stepBungeeTether,
} from './physics';
import { BUNGEE, COURT, type GameEvent } from './types';
import { createEngine } from './peer';
import { bungeeDoublesAvatars } from './avatar';

void test('world initializes with tennis court, ball and 0-0 score', () => {
  const world = freshBungeeWorld();
  assert.equal(world.scores.orange, 0);
  assert.equal(world.scores.teal, 0);
  assert.equal(world.phase, 'serving');
  assert.equal(world.rallyCount, 0);
  assert.ok(world.ball);
  assert.equal(world.ball.state, 'serving');
});

void test('bot reconciliation maintains 4 players in 2v2 setup', () => {
  const world = freshBungeeWorld();
  reconcileBungeeBots(world);

  assert.equal(world.players.length, 4);
  const orange = world.players.filter((p) => p.team === 'orange');
  const teal = world.players.filter((p) => p.team === 'teal');
  assert.equal(orange.length, 2);
  assert.equal(teal.length, 2);
  assert.ok(orange.every((p) => p.bot));
});

void test('court boundary and net height checks work accurately', () => {
  assert.ok(isInsideCourt(0, 0));
  assert.ok(isInsideCourt(COURT.width / 2 - 0.1, COURT.length / 2 - 0.1));
  assert.ok(!isInsideCourt(COURT.width / 2 + 1, 0));
  assert.ok(!isInsideCourt(0, COURT.length / 2 + 1));

  // Net height is lower in the middle than at the posts
  const centerH = getNetHeightAt(0);
  const edgeH = getNetHeightAt(COURT.width / 2);
  assert.ok(edgeH > centerH);
});

void test('bungee tether calculates spring tension between teammates', () => {
  const p1 = newPlayer('p1', 'Player 1', 0, 'orange', false, 0);
  const p2 = newPlayer('p2', 'Player 2', 0, 'orange', false, 1);

  p1.x = -2.0;
  p1.z = -4.0;
  p2.x = 3.0;
  p2.z = -4.0; // Distance = 5.0m (greater than restLength 3.4m)

  const events: GameEvent[] = [];
  const eventIdRef = { current: 0 };
  const tether = stepBungeeTether(
    p1,
    p2,
    1 / 60,
    Date.now(),
    events,
    eventIdRef,
  );

  assert.ok(tether.distance > BUNGEE.restLength);
  assert.ok(tether.tension > 0);
  // Teammates are pulled toward each other
  assert.ok(p1.vx > 0);
  assert.ok(p2.vx < 0);
});

void test('partner head-on collision triggers bonk and stun', () => {
  const p1 = newPlayer('p1', 'Player 1', 0, 'orange', false, 0);
  const p2 = newPlayer('p2', 'Player 2', 0, 'orange', false, 1);

  p1.x = 0;
  p1.z = -5.0;
  p1.vx = 8.0;

  p2.x = 0.5;
  p2.z = -5.0;
  p2.vx = -8.0;

  const events: GameEvent[] = [];
  const eventIdRef = { current: 0 };
  const now = Date.now();
  stepBungeeTether(p1, p2, 1 / 60, now, events, eventIdRef);

  assert.ok(p1.stunnedUntil > now);
  assert.ok(p2.stunnedUntil > now);
  assert.equal(p1.specialState, 'stunned');
  assert.equal(p2.specialState, 'stunned');
  assert.ok(events.some((e) => e.type === 'partner_bonk'));
});

void test('ball physics bounces off court and rebounds from net', () => {
  const ball = freshBall();
  ball.state = 'in_play';
  ball.x = 0;
  ball.y = 2.0;
  ball.z = -2.0;
  ball.vy = -5.0;
  ball.vz = 8.0;

  const events: GameEvent[] = [];
  const eventIdRef = { current: 0 };

  // Step until bounce
  let bounced = false;
  for (let i = 0; i < 40; i++) {
    const res = stepBallPhysics(ball, 1 / 60, events, eventIdRef);
    if (res.bounced) bounced = true;
  }
  assert.ok(bounced);
  assert.ok(events.some((e) => e.type === 'ball_bounce'));
});

void test('ball rebounds off padel back glass after floor bounce and remains live', () => {
  const world = freshBungeeWorld();
  world.phase = 'rally';
  world.ball.state = 'in_play';
  world.ball.x = 0;
  world.ball.y = 1.0;
  world.ball.z = 9.8;
  world.ball.vz = 12.0; // Heading towards Teal back wall (z = 11)
  world.ball.lastHitTeam = 'orange';
  world.ball.currentSide = 'teal';
  world.ball.bouncesOnCurrentSide = 1; // Already bounced once on Teal court floor!

  advanceBungee(world, 1 / 10);

  assert.ok(world.ball.vz < 0); // Rebounded off glass back towards net
  assert.equal(world.phase, 'rally'); // Ball remains live
  assert.ok(world.events.some((e) => e.type === 'wall_rebound'));
});

void test('ball hitting wall directly on the fly triggers fault and awards point to opponent', () => {
  const world = freshBungeeWorld();
  world.phase = 'rally';
  world.ball.state = 'in_play';
  world.ball.x = 0;
  world.ball.y = 2.0;
  world.ball.z = 9.8;
  world.ball.vz = 14.0;
  world.ball.lastHitTeam = 'orange';
  world.ball.currentSide = 'teal';
  world.ball.bouncesOnCurrentSide = 0; // Did not bounce on court floor!

  const now = Date.now();
  advanceBungee(world, 1 / 10, now);

  assert.equal(world.phase, 'scored');
  assert.equal(world.scores.teal, 1);
  assert.equal(world.scores.orange, 0);
  assert.ok(world.events.some((e) => e.type === 'point_scored'));
});

void test('ball rebounds off side wall and reverses horizontal velocity', () => {
  const ball = freshBall();
  ball.state = 'in_play';
  ball.x = 5.8;
  ball.y = 1.5;
  ball.z = 3.0;
  ball.vx = 8.0; // Moving towards side wall at x = 6.5
  ball.vy = 0;
  ball.vz = 0;

  const events: GameEvent[] = [];
  const eventIdRef = { current: 0 };
  const res = stepBallPhysics(ball, 1 / 10, events, eventIdRef);

  assert.equal(res.hitWall, 'side');
  assert.ok(ball.vx < 0);
});

void test('calculateRacketShot produces trajectory clearing the net', () => {
  const shot = calculateRacketShot(0, 1.2, -6.0, 'orange', false, false, 0);
  assert.ok(shot.vz > 0); // Aiming towards positive Z (Teal side)
  assert.ok(shot.vy > 0); // Upward launch arc
});

void test('scoring advances points and triggers match end', () => {
  const world = freshBungeeWorld();
  world.scores.orange = 6;
  const now = Date.now();

  scorePoint(world, 'orange', 'Smash winner!', now);

  assert.equal(world.scores.orange, 7);
  assert.equal(world.phase, 'ended');
  assert.equal(world.winner, 'orange');
  assert.ok(world.events.some((e) => e.type === 'game_won'));
});

void test('peer engine creates, steps, and generates snapshots', () => {
  const engine = createEngine(Date.now());
  assert.equal(engine.checkpoint().game, 'bungee-doubles');

  engine.reconcile([
    {
      id: 'p-test',
      name: 'Tester',
      color: 0,
      order: 0,
      instance: 'a',
      seen: 1000,
    },
  ]);
  assert.equal(engine.world.players.length, 4);

  engine.execute('p-test', 'req-1', { type: 'swing' }, 'p-test');
  engine.advance(1 / 60);

  const snap = engine.snapshot('ROOM', 'p-test', 'p-test', Date.now());
  assert.ok(snap);
});

void test('bungeeDoublesAvatars exports valid dressable worker avatar', () => {
  assert.ok(bungeeDoublesAvatars.length > 0);
  const look = bungeeDoublesAvatars[0];
  assert.equal(look.key, 'tennis-duo');
  assert.equal(look.dressable, true);

  const preview = look.create();
  assert.ok(preview.root);
  assert.ok(typeof preview.pose === 'function');
});
