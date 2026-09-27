import assert from 'node:assert/strict';
import test from 'node:test';
import { BENCH_ROWS, benchLayout } from './environment-layout';

void test('both bench sides face inward and expose two seat anchors', () => {
  const left = benchLayout(-1, BENCH_ROWS[0]);
  const right = benchLayout(1, BENCH_ROWS[0]);
  const leftForwardX = Math.sin(left.facing);
  const rightForwardX = Math.sin(right.facing);
  assert.ok(leftForwardX > 0);
  assert.ok(rightForwardX < 0);
  assert.equal(left.seats.length, 2);
  assert.equal(right.seats.length, 2);
  assert.ok(left.seats.every((seat) => seat.x < 0));
  assert.ok(right.seats.every((seat) => seat.x > 0));
});
