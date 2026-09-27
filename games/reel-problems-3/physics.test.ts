import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adventureColliders,
  positionIsBlocked,
  safeSpawn,
} from './physics-layout';
import { adventurePhysics, resetAdventurePhysics } from './physics';
import { freshWorld } from './simulation';
import { createPlayer } from './players';

void test('the boat, dock, machinery, and physical loadout produce colliders', () => {
  const world = freshWorld(0);
  world.phase = world.round.phase = 'preparing';
  const ids = new Set(adventureColliders(world).map((collider) => collider.id));
  assert.equal(ids.has('rail-port'), true);
  assert.equal(ids.has('wheel-house'), true);
  assert.equal(ids.has('item-ice-box-0'), true);
  assert.equal(positionIsBlocked(world, 1.85, 1.9), true);
});

void test('cannon keeps a first-person player inside the rail', () => {
  const world = freshWorld(0);
  world.players = [createPlayer(0, 0, false, 'p1')];
  world.phase = world.round.phase = 'outbound';
  const player = world.players[0];
  Object.assign(player, safeSpawn(world.phase, 0));
  player.input = {
    x: -1,
    z: 0,
    yaw: 0,
    sprint: true,
    reel: false,
    brace: false,
    throttle: 0,
    steer: 0,
  };
  const physics = adventurePhysics(world);
  for (let index = 0; index < 200; index++) physics.step(1 / 60);
  assert.ok(player.x > -3.35);
  resetAdventurePhysics(world);
});
