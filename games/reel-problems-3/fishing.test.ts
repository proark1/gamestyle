import assert from 'node:assert/strict';
import test from 'node:test';
import { castLine, hookLine, stepFishing } from './fishing';
import { generateMissions } from './missions';
import { freshWorld, newPlayer } from './simulation';

void test('a baited cast can hook, tire, and land a mission fish', () => {
  const world = freshWorld(0);
  const player = newPlayer(0);
  world.players.push(player);
  world.phase = world.round.phase = 'fishing';
  world.missions = generateMissions(7).missions;
  const mission = world.missions[0];
  world.boat.x = mission.zoneX;
  world.boat.z = mission.zoneZ;
  const rod = world.items.find((item) => item.kind === 'rod')!;
  rod.state = 'held';
  rod.holder = player.id;
  player.held.push(rod.id);
  castLine(world, player, 0.5);
  stepFishing(world, 0.1);
  world.clock = player.line!.biteAt!;
  stepFishing(world, 0.1);
  assert.equal(player.line?.state, 'biting');
  hookLine(world, player);
  const fish = world.fish.find(
    (candidate) => candidate.id === player.line?.fishId,
  )!;
  fish.stamina = 0;
  fish.x = world.boat.x + 1;
  fish.z = world.boat.z + 1;
  player.input.reel = true;
  stepFishing(world, 0.1);
  assert.equal(fish.state, 'landing');
  assert.equal(
    world.items.some((item) => item.kind === 'fish'),
    false,
  );
  world.clock += fish.landing!.duration;
  stepFishing(world, 0.1);
  assert.ok(world.items.some((item) => item.kind === 'fish'));
  assert.equal(player.line, null);
});
