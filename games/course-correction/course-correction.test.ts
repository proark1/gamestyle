import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from './peer';
import { cupPosition } from './courses';
import { launchBall, stepPhysics } from './physics';
import { advanceWorld, courseAction, freshWorld } from './simulation';

function advance(world: ReturnType<typeof freshWorld>, milliseconds: number) {
  const end = world.clock + milliseconds;
  while (world.clock < end)
    advanceWorld(world, Math.min(end, world.clock + 50));
}

void test('the opening volley waits for ready players and launches together', () => {
  const world = freshWorld(1_000);
  const human = world.players[0];
  human.bot = false;
  human.id = 'human';
  world.balls[0].owner = human.id;
  courseAction(world, human.id, { type: 'start' }, true);
  assert.equal(world.phase, 'opening');
  courseAction(world, human.id, { type: 'lock', angle: 0, power: 0.65 }, true);
  advance(world, 100);
  assert.equal(world.phase, 'playing');
  assert.ok(world.balls.every((ball) => ball.moving));
  assert.ok(world.players.every((player) => player.holeStrokes === 1));
});

void test('a stopped ball may take an independent follow-up shot', () => {
  const world = freshWorld(0);
  world.phase = 'playing';
  const player = world.players[0];
  const ball = world.balls[0];
  ball.restFor = 1;
  assert.equal(launchBall(world, player.id, 0.2, 0.5), true);
  assert.equal(player.holeStrokes, 1);
  assert.equal(launchBall(world, player.id, 0.2, 0.5), false);
});

void test('ball contact attributes a later cup assist to the hitter', () => {
  const world = freshWorld(0);
  world.phase = 'playing';
  const cup = cupPosition(world.course);
  const hitter = world.balls[0];
  const target = world.balls[1];
  hitter.x = cup.x;
  hitter.z = cup.z - 0.65;
  hitter.vz = 3;
  hitter.moving = true;
  target.x = cup.x;
  target.z = cup.z - 0.2;
  target.vx = target.vz = 0;
  stepPhysics(world, 1 / 60);
  for (let i = 0; i < 90 && !target.holed; i++) stepPhysics(world, 1 / 60);
  assert.equal(target.holed, true);
  assert.equal(world.players[0].assists, 1);
});

void test('hard shots rotate walls while damping keeps them constrained', () => {
  const world = freshWorld(0);
  world.phase = 'playing';
  const wall = world.course.walls[0];
  const original = wall.angle;
  const ball = world.balls[0];
  ball.x = wall.x + Math.cos(wall.angle) * 1.2;
  ball.z = wall.z + Math.sin(wall.angle) * 1.2 - 0.35;
  ball.vx = 0;
  ball.vz = 7;
  ball.moving = true;
  for (let i = 0; i < 50; i++) stepPhysics(world, 1 / 60);
  assert.notEqual(wall.angle, original);
  assert.ok(wall.angle >= wall.min && wall.angle <= wall.max);
});

void test('shared household props are physical obstacles, not decoration', () => {
  const world = freshWorld(0);
  world.phase = 'playing';
  const obstacle = world.course.obstacles[0];
  const ball = world.balls[0];
  ball.x = obstacle.x;
  ball.z = obstacle.z - obstacle.radius - ball.radius - 0.02;
  ball.vx = 0;
  ball.vz = 6;
  ball.moving = true;
  stepPhysics(world, 1 / 60);
  assert.ok(ball.vz < 0, 'the cone should rebound the incoming ball');
  assert.ok(world.events.some((entry) => entry.kind === 'impact'));
});

void test('out-of-bounds recovery restores the last safe lie with a penalty', () => {
  const world = freshWorld(0);
  world.phase = 'playing';
  const player = world.players[0];
  const ball = world.balls[0];
  ball.safe = { x: 1, z: 2 };
  ball.z = world.course.length + 2;
  ball.vz = 4;
  stepPhysics(world, 1 / 60);
  assert.deepEqual({ x: ball.x, z: ball.z }, ball.safe);
  assert.equal(player.holeStrokes, 1);
});

void test('peer checkpoints restore the complete moving course', () => {
  const engine = createEngine(4_000);
  engine.world.phase = 'playing';
  engine.world.holeEnds = engine.world.clock + 20_000;
  const ball = engine.world.balls[0];
  ball.vz = 6;
  ball.moving = true;
  engine.world.course.walls[0].velocity = 1.25;
  engine.advance(50);
  const checkpoint = JSON.parse(JSON.stringify(engine.checkpoint()));
  const recovered = createEngine(engine.world.clock, checkpoint);
  assert.deepEqual(recovered.world, engine.world);
  recovered.advance(50);
  assert.ok(recovered.world.clock > engine.world.clock);
});
