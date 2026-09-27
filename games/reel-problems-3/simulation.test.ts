import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceWorld,
  adventureAction,
  freshWorld,
  setInput,
} from './simulation';
import { createPlayer } from './players';
import { reconcileBots } from './bots';
import { recordSecuredFish } from './missions';

function playable() {
  const world = freshWorld(1_000);
  world.players = world.players.filter((player) => player.seat !== 0);
  world.players.push(
    Object.assign(createPlayer(0, world.clock, false, 'p1'), { name: 'Pip' }),
  );
  reconcileBots(world);
  adventureAction(world, 'p1', { type: 'start' }, true);
  return world;
}

void test('empty seats are filled with bots and humans replace their seat', () => {
  const world = freshWorld(0);
  assert.equal(world.players.length, 4);
  assert.equal(
    world.players.every((player) => player.bot),
    true,
  );
  world.players = world.players.filter((player) => player.seat !== 2);
  world.players.push(createPlayer(2, world.clock, false, 'friend'));
  reconcileBots(world);
  assert.equal(world.players.length, 4);
  assert.equal(world.players.find((player) => player.seat === 2)?.id, 'friend');
});

void test('bots load the physical equipment and launch the shared boat', () => {
  const world = playable();
  for (let index = 0; index < 620; index++)
    advanceWorld(world, world.clock + 100);
  assert.notEqual(world.phase, 'preparing');
  assert.equal(world.boat.docked, false);
  assert.ok(world.items.filter((item) => item.station).length >= 10);
});

void test('an idle solo player can rely on three bots to finish a seeded round', () => {
  const world = playable();
  for (
    let index = 0;
    index < 4_800 && !['finished', 'failed'].includes(world.phase);
    index++
  )
    advanceWorld(world, world.clock + 100);
  assert.equal(world.phase, 'finished');
  assert.equal(world.activeMission, 3);
  assert.ok(
    world.items.filter(
      (item) => item.kind === 'fish' && item.state === 'secured',
    ).length >= 8,
  );
});

void test('completing three missions starts the safe-return leg and docking wins', () => {
  const world = playable();
  world.phase = world.round.phase = 'fishing';
  for (const mission of world.missions) {
    world.activeMission = world.missions.indexOf(mission);
    while (!mission.complete)
      recordSecuredFish(
        world,
        'p1',
        mission.species!,
        mission.kind === 'weight-quota' ? mission.goal : 20,
      );
  }
  assert.equal(world.phase, 'returning');
  world.boat.x = 2;
  world.boat.z = 2;
  world.boat.speed = 0;
  advanceWorld(world, world.clock + 100);
  assert.equal(world.phase, 'docking');
  adventureAction(world, 'p1', { type: 'dock' }, true);
  assert.equal(world.phase, 'finished');
  assert.equal(world.round.result, 'success');
});

void test('first-person input is sanitized and only the host starts the round', () => {
  const world = freshWorld(0);
  world.players = world.players.filter((player) => player.seat !== 0);
  world.players.push(createPlayer(0, 0, false, 'p1'));
  assert.throws(
    () => adventureAction(world, 'p1', { type: 'start' }, false),
    /crew leader/,
  );
  setInput(world, 'p1', {
    x: 90,
    z: -90,
    yaw: Number.NaN,
    throttle: 3,
    steer: -3,
  });
  const input = world.players.find((player) => player.id === 'p1')!.input;
  assert.equal(input.x, 1);
  assert.equal(input.z, -1);
  assert.equal(input.throttle, 1);
  assert.equal(input.steer, -1);
});

void test('the round fails cleanly when the clock expires', () => {
  const world = playable();
  world.round.roundEndsAt = world.clock + 50;
  advanceWorld(world, world.clock + 100);
  assert.equal(world.phase, 'failed');
  assert.equal(world.round.result, 'timeout');
});
