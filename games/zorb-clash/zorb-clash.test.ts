import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceZorbClash, freshZorbWorld, newZorbPlayer } from './simulation';
import { ZorbClashPhysics } from './physics';
import { botInput } from './bots';
import { createEngine } from './peer';
import { BALL_RADIUS, PITCH_LENGTH } from './types';

void test('world initializes with bouncy ball, cushions, and ramps', () => {
  const w = freshZorbWorld(1000);
  assert.equal(w.status, 'playing');
  assert.equal(w.score.red, 0);
  assert.equal(w.score.blue, 0);
  assert.ok(w.cushions.length >= 6, 'Perimeter cushions around the arena');
  assert.ok(w.ramps.length >= 2, 'Flank ramps on pitch');
  assert.equal(w.ball.x, 0);
  assert.ok(w.ball.y > BALL_RADIUS, 'Ball spawned above ground');
});

void test('physics moves player with directional inputs', () => {
  const w = freshZorbWorld(1000);
  const p = newZorbPlayer('p1', 'Player 1', 0, 'red', false);
  w.players.push(p);

  const physics = new ZorbClashPhysics(w);

  // Apply forward input (positive Z)
  p.input.z = 1.0;
  for (let i = 0; i < 30; i++) {
    physics.step(1 / 60);
  }

  assert.ok(p.vz > 0.5, 'Player gained forward velocity from roll input');
  assert.ok(p.z > -12, 'Player moved forward along pitch');
});

void test('bumper dash charges and releases explosive impulse', () => {
  const w = freshZorbWorld(1000);
  const p = newZorbPlayer('p1', 'Player 1', 0, 'red', false);
  w.players.push(p);

  const physics = new ZorbClashPhysics(w);

  // Hold dash for 1 second to charge
  p.input.dash = true;
  p.input.z = 1;
  for (let i = 0; i < 60; i++) {
    physics.step(1 / 60);
  }

  assert.ok(p.dashCharge > 0.8, `Dash charged up: ${p.dashCharge}`);

  // Release dash!
  p.input.dash = false;
  physics.step(1 / 60);

  assert.ok(p.dashing > 0, 'Bumper dash is now active');
  assert.ok(p.vz > 5.0, `Player gained explosive forward velocity: ${p.vz}`);
});

void test('brace anchor stance increases damping and stability', () => {
  const w = freshZorbWorld(1000);
  const p = newZorbPlayer('p1', 'Player 1', 0, 'red', false);
  w.players.push(p);

  const physics = new ZorbClashPhysics(w);

  p.input.brace = true;
  physics.step(1 / 60);

  assert.equal(p.braced, true, 'Player is in braced state');
  const body = physics.playerBodies.get(p.id)!;
  assert.ok(
    body.mass > 200,
    'Mass increased to anchor against incoming impacts',
  );
  assert.ok(
    body.linearDamping > 0.8,
    'High linear damping prevents getting launched',
  );
});

void test('turtle state flails and wiggling speeds up recovery', () => {
  const w = freshZorbWorld(1000);
  const p = newZorbPlayer('p1', 'Player 1', 0, 'red', false);
  w.players.push(p);

  const physics = new ZorbClashPhysics(w);
  const body = physics.playerBodies.get(p.id)!;

  // Invert player to simulate flip
  body.quaternion.set(1, 0, 0, 0);
  // Manually trigger turtle
  p.turtle = true;
  p.turtleTimer = 3.5;
  p.wiggleProgress = 0;

  // Wiggle input
  p.input.wiggle = true;
  for (let i = 0; i < 40; i++) {
    physics.step(1 / 60);
  }

  assert.ok(p.wiggleProgress > 0.4, 'Wiggling increases recovery progress');
});

void test('scoring a goal updates score and triggers celebration phase', () => {
  const w = freshZorbWorld(1000);
  const physics = new ZorbClashPhysics(w);

  // Position ball inside the Blue goal (North: +Z)
  physics.ballBody.position.set(0, 1.0, PITCH_LENGTH / 2 + 1.5);

  advanceZorbClash(w, physics, 1 / 60);

  assert.equal(w.score.red, 1, 'Red team scored a goal!');
  assert.equal(w.status, 'goal_scored', 'World entered goal celebration phase');
  assert.ok(w.celebrationTimer > 0, 'Celebration timer running');
});

void test('turtle goal gives style points when a turtle is punted into net', () => {
  const w = freshZorbWorld(1000);
  const p = newZorbPlayer('p1', 'Victim', 0, 'blue', false);
  p.turtle = true;
  p.turtleTimer = 3.5;
  w.players.push(p);

  const physics = new ZorbClashPhysics(w);
  const b = physics.playerBodies.get(p.id)!;
  // Punt turtle player into Red goal (-Z)
  b.position.set(0, 1.0, -(PITCH_LENGTH / 2 + 1.5));

  advanceZorbClash(w, physics, 1 / 60);

  assert.equal(w.score.blue, 1, 'Blue team scored!');
  assert.equal(
    w.lastGoal?.isTurtleGoal,
    true,
    'Scored as a hilarious TURTLE GOAL',
  );
});

void test('bot AI wiggles when turtle and chases ball when upright', () => {
  const w = freshZorbWorld(1000);
  const bot = newZorbPlayer('bot-1', 'Bot', 1, 'red', true);
  w.players.push(bot);

  // When turtle'd
  bot.turtle = true;
  const turtleInp = botInput(bot, w, 10);
  assert.equal(turtleInp.wiggle, true, 'Bot wiggles when stuck upside down');

  // When upright
  bot.turtle = false;
  w.ball.x = 8;
  w.ball.z = 2;
  const playInp = botInput(bot, w, 10);
  assert.ok(playInp.x > 0, 'Bot steers towards ball X');
});

void test('peer engine creates zorb-clash room and manages players', () => {
  const engine = createEngine(1000);
  assert.equal(engine.checkpoint().game, 'zorb-clash');

  // Reconcile human member
  engine.reconcile([
    {
      id: 'user-1',
      name: 'Alice',
      color: 0,
      order: 0,
      instance: 'inst-1',
      seen: 1000,
    },
  ]);

  const snap = engine.snapshot('ROOM1', 'user-1', 'user-1', 1);
  assert.ok(snap.world.players.some((p: { id: string }) => p.id === 'user-1'));
});
