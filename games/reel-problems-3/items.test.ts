import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dropItem,
  pickUpItem,
  placeItem,
  spawnLoadout,
  stepItems,
} from './items';
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
