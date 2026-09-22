import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceBasketball,
  freshBasketballWorld,
  freshBall,
  newPlayer,
} from './simulation';
import { stepBallPhysics, AIR_DRAG } from './physics';
import { BALL_RADIUS, HOOP } from './types';
void test('air drag has identical elapsed-time strength at host, phone and high-refresh rates', () => {
  for (const hz of [20, 30, 60, 120, 144]) {
    const ball = freshBall();
    Object.assign(ball, {
      x: 0,
      y: 100,
      z: 0,
      vx: 1,
      vy: 0,
      vz: 0,
      heldBy: null,
    });
    for (let i = 0; i < hz; i++) stepBallPhysics(ball, 1 / hz, { current: 0 });
    assert.ok(
      Math.abs(ball.vx - AIR_DRAG ** 60) < 1e-10,
      `drag differs at ${hz} Hz`,
    );
  }
});

void test('ball trajectories stay within integration tolerance and preserve collision outcomes across refresh rates', () => {
  for (const hz of [20, 30, 60, 120, 144]) {
    const ball = freshBall();
    Object.assign(ball, { x: 0, y: 100, z: 0, vx: 1, vy: 0, vz: 0 });
    for (let i = 0; i < hz; i++) stepBallPhysics(ball, 1 / hz, { current: 0 });
    // Semi-implicit Euler has a bounded positional error of g * dt / 2.
    assert.ok(Math.abs(ball.y - 93.25) <= 0.34, `${hz} Hz ballistic height`);
    assert.ok(ball.x > 0.82 && ball.x < 0.85, `${hz} Hz lateral trajectory`);
    Object.assign(ball, { x: 0, y: BALL_RADIUS + 0.01, z: 0, vx: 0, vy: -3 });
    const impact = stepBallPhysics(ball, 1 / hz, { current: 0 });
    assert.equal(impact.events.filter((e) => e.type === 'bounce').length, 1);
    assert.equal(ball.y, BALL_RADIUS);
    assert.ok(ball.vy > 0);
    Object.assign(ball, {
      x: HOOP.x,
      z: HOOP.z,
      y: HOOP.y + 0.001,
      vy: -1,
      vz: 0,
    });
    assert.equal(stepBallPhysics(ball, 1 / hz, { current: 0 }).scored, true);
  }
});

void test('clock, held input and shot charging progress independently of visual cadence', () => {
  for (const hz of [20, 30, 60, 120, 144]) {
    const world = freshBasketballWorld(1000);
    const player = newPlayer('human', 'Human', 0, 'red');
    Object.assign(player, { x: 0, z: 0, hasBall: true });
    Object.assign(player.input, { x: 1, shoot: true });
    world.players = [player];
    world.phase = 'playing';
    world.ball.heldBy = player.id;
    const shotClock = world.shotClockRemaining;
    for (let i = 0; i < hz / 2; i++) advanceBasketball(world, 1 / hz);
    assert.ok(Math.abs(world.clock - 1500) < 1e-8);
    assert.ok(Math.abs(world.shotClockRemaining - (shotClock - 0.5)) < 1e-8);
    assert.ok(Math.abs(player.shotCharge - 0.75) < 1e-8);
    assert.ok(player.x > 2.2 && player.x < 2.5, `${hz} Hz held movement`);
  }
});
