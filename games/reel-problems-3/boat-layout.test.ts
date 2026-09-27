import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOAT_LAYOUT } from './boat-layout';
import { PLAYER_RADIUS, positionIsBlocked } from './physics-layout';
import { freshWorld } from './simulation';

void test('the boarding gate leaves a real avatar-width opening', () => {
  assert.ok(BOAT_LAYOUT.gate.width > PLAYER_RADIUS * 2 + 0.5);
  const world = freshWorld(0);
  world.phase = world.round.phase = 'preparing';
  for (const x of [4.65, 4.15, 3.6, 3.15, 2.7, 2.35])
    assert.equal(positionIsBlocked(world, x, 0, PLAYER_RADIUS * 0.55), false);
});

void test('the hull remains solid immediately beside the gate', () => {
  const world = freshWorld(0);
  world.phase = world.round.phase = 'preparing';
  const beside = BOAT_LAYOUT.gate.width / 2 + PLAYER_RADIUS * 0.7;
  assert.equal(positionIsBlocked(world, BOAT_LAYOUT.starboardX, beside), true);
  assert.equal(positionIsBlocked(world, BOAT_LAYOUT.starboardX, -beside), true);
});

void test('crew spawns and idle points remain clear of fixed fixtures', () => {
  const world = freshWorld(0);
  world.phase = world.round.phase = 'outbound';
  for (const point of [...BOAT_LAYOUT.spawns, ...BOAT_LAYOUT.idle])
    assert.equal(positionIsBlocked(world, point.x, point.z), false);
});
