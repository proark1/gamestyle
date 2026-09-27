import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adventureAction,
  advanceWorld,
  freshWorld,
  newPlayer,
  setInput,
} from './simulation';

function playable() {
  const world = freshWorld(1_000);
  const player = newPlayer(0);
  Object.assign(player, { id: 'p1', name: 'Pip', bot: false });
  world.players.push(player);
  adventureAction(world, 'p1', { type: 'start' }, true);
  return world;
}

void test('one crew member can complete the whole voyage', () => {
  const world = playable();
  for (const supply of ['rope', 'lanterns', 'timber', 'chart'])
    adventureAction(
      world,
      'p1',
      { type: 'interact', target: `supply-${supply}` },
      true,
    );
  assert.equal(world.phase, 'search');
  for (let island = 0; island < 3; island++) {
    for (let turn = 0; turn < world.beacons[island].required; turn++)
      adventureAction(
        world,
        'p1',
        { type: 'interact', target: 'beacon-crank' },
        true,
      );
    adventureAction(
      world,
      'p1',
      { type: 'interact', target: 'beacon-bell' },
      true,
    );
    for (let leg = 0; leg < 3; leg++)
      adventureAction(world, 'p1', { type: 'interact', target: 'helm' }, true);
  }
  assert.equal(world.phase, 'storm');
  while (world.phase === 'storm') {
    if (world.hull < 40 || world.water > 70)
      adventureAction(
        world,
        'p1',
        { type: 'interact', target: 'repair' },
        true,
      );
    adventureAction(world, 'p1', { type: 'interact', target: 'helm' }, true);
  }
  assert.equal(world.phase, 'sanctuary');
  for (const socket of ['port', 'bow', 'starboard'])
    adventureAction(
      world,
      'p1',
      { type: 'interact', target: `lantern-${socket}` },
      true,
    );
  for (let tone = 0; tone < 3; tone++)
    adventureAction(
      world,
      'p1',
      { type: 'interact', target: `tone-${tone}` },
      true,
    );
  assert.equal(world.phase, 'homecoming');
  advanceWorld(world, world.clock + 8_100);
  assert.equal(world.phase, 'finished');
  assert.equal(world.fishTrust, 100);
});

void test('storm blocks progress until damage and overboard crew are recovered', () => {
  const world = playable();
  world.phase = 'storm';
  const friend = newPlayer(1);
  Object.assign(friend, { id: 'p2', name: 'Lola', bot: false });
  world.players.push(friend);
  for (let i = 0; i < 5; i++) {
    if (world.hull < 40)
      adventureAction(
        world,
        'p1',
        { type: 'interact', target: 'repair' },
        true,
      );
    adventureAction(world, 'p1', { type: 'interact', target: 'helm' }, true);
  }
  assert.equal(friend.overboard, true);
  assert.throws(
    () =>
      adventureAction(world, 'p1', { type: 'interact', target: 'helm' }, true),
    /overboard/,
  );
  adventureAction(
    world,
    'p1',
    { type: 'interact', target: 'rescue-rope' },
    true,
  );
  assert.equal(friend.overboard, false);
  assert.equal(world.players[0].stats.rescues, 1);
});

void test('movement is first-person relative and bounded', () => {
  const world = playable();
  const player = world.players[0];
  setInput(world, player.id, { x: 0, z: 1, yaw: Math.PI / 2, sprint: true });
  advanceWorld(world, world.clock + 100);
  assert.ok(player.x < -1.5);
  for (let i = 0; i < 1_000; i++) advanceWorld(world, world.clock + 100);
  assert.ok(player.x <= 17);
});

void test('only the host can start or restart the voyage', () => {
  const world = freshWorld(0);
  const player = newPlayer(0);
  Object.assign(player, { id: 'p1', bot: false });
  world.players.push(player);
  assert.throws(
    () => adventureAction(world, 'p1', { type: 'start' }, false),
    /crew leader/,
  );
});
