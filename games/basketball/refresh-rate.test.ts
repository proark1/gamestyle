import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshBall } from './simulation';
import { stepBallPhysics, AIR_DRAG } from './physics';
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
