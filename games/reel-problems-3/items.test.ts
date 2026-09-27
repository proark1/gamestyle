import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFishItem,
  dropItem,
  pickUpItem,
  placeItem,
  spawnLoadout,
  stepItems,
} from './items';
import { STATION_POSITIONS } from './stations';
import { freshWorld, newPlayer } from './simulation';

void test('items can be carried, placed, thrown, and recovered', () => {
  const world = freshWorld(0);
  world.phase = world.round.phase = 'preparing';
  world.items = spawnLoadout();
  const player = newPlayer(0);
  world.players.push(player);
  const rope = world.items.find((item) => item.kind === 'rope')!;
  player.x = rope.x;
  player.z = rope.z;
  pickUpItem(world, player, rope.id);
  assert.deepEqual(player.held, [rope.id]);
  player.x = 2.65;
  player.z = 0.75;
  placeItem(world, player, 'rescue-line');
  assert.equal(rope.station, 'rescue-line');
  pickUpItem(world, player, rope.id, true);
  player.x = 3.3;
  player.yaw = Math.PI / 2;
  dropItem(world, player, rope.id, 8);
  stepItems(world, 0.5);
  world.phase = world.round.phase = 'outbound';
  stepItems(world, 0.5);
  assert.equal(rope.space, 'world');
  world.clock = rope.recoverAt!;
  stepItems(world, 0.1);
  assert.equal(rope.station, 'rescue-line');
});

void test('a landed fish bounces before explicit ice-hold storage scores it', () => {
  const world = freshWorld(0);
  world.phase = world.round.phase = 'fishing';
  const player = world.players[0];
  const fish = createFishItem(
    world,
    'silver-sprat',
    1.2,
    { x: 1.5, z: 0.1 },
    { y: 1.1, vy: -2.2, vx: 0.2, vz: 0.1 },
  );
  assert.equal(player.stats.catches, 0);
  for (let index = 0; index < 40 && fish.state !== 'loose'; index++) {
    world.clock += 50;
    stepItems(world, 0.05);
  }
  assert.equal(fish.state, 'loose');
  assert.ok(fish.landedAt);
  player.x = fish.x;
  player.z = fish.z;
  pickUpItem(world, player, fish.id);
  player.x = STATION_POSITIONS['ice-hold'].x;
  player.z = STATION_POSITIONS['ice-hold'].z;
  placeItem(world, player, 'ice-hold', fish.id);
  assert.equal(fish.state, 'secured');
  assert.equal(player.stats.catches, 1);
  assert.equal(
    world.events.filter((event) => event.kind === 'fish-secured').length,
    1,
  );
  assert.throws(() => placeItem(world, player, 'ice-hold', fish.id));
  assert.equal(player.stats.catches, 1);
});
