import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancelCast,
  castCharge,
  castLine,
  hookLine,
  releaseCast,
  stepFishing,
} from './fishing';
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

void test('charging preserves bait until release and produces bounded power', () => {
  const world = freshWorld(1_000);
  const player = newPlayer(0);
  world.players = [player];
  world.phase = world.round.phase = 'fishing';
  world.missions = generateMissions(11).missions;
  world.boat.x = world.missions[0].zoneX;
  world.boat.z = world.missions[0].zoneZ;
  const rod = world.items.find((item) => item.kind === 'rod')!;
  const bait = world.items.find((item) => item.kind === 'bait-bucket')!;
  rod.state = 'held';
  rod.holder = player.id;
  player.held = [rod.id];
  const before = bait.contents;

  castCharge(world, player);
  assert.equal(player.castStartedAt, 1_000);
  assert.equal(bait.contents, before);
  world.clock += 2_000;
  releaseCast(world, player);

  assert.equal(player.castStartedAt, undefined);
  assert.equal(bait.contents, (before ?? 0) - 1);
  assert.ok(player.line);
  assert.ok(player.line.length <= 21);
  assert.ok(player.line.length >= 8);
  assert.equal(player.line.state, 'casting');
});

void test('a cancelled charge consumes nothing and creates no line', () => {
  const world = freshWorld(2_000);
  const player = newPlayer(0);
  world.players = [player];
  world.phase = world.round.phase = 'fishing';
  world.missions = generateMissions(13).missions;
  world.boat.x = world.missions[0].zoneX;
  world.boat.z = world.missions[0].zoneZ;
  const rod = world.items.find((item) => item.kind === 'rod')!;
  const bait = world.items.find((item) => item.kind === 'bait-bucket')!;
  rod.state = 'held';
  rod.holder = player.id;
  player.held = [rod.id];
  const before = bait.contents;

  castCharge(world, player);
  cancelCast(player);

  assert.equal(player.castStartedAt, undefined);
  assert.equal(player.line, null);
  assert.equal(bait.contents, before);
});

void test('casting stays visible until its stored travel time completes', () => {
  const world = freshWorld(3_000);
  const player = newPlayer(0);
  world.players = [player];
  world.phase = world.round.phase = 'fishing';
  world.missions = generateMissions(17).missions;
  world.boat.x = world.missions[0].zoneX;
  world.boat.z = world.missions[0].zoneZ;
  const rod = world.items.find((item) => item.kind === 'rod')!;
  rod.state = 'held';
  rod.holder = player.id;
  player.held = [rod.id];

  castLine(world, player, 0.6);
  const line = player.line!;
  world.clock = line.castStartedAt! + line.castDuration! - 1;
  stepFishing(world, 0.1);
  assert.equal(line.state, 'casting');
  world.clock += 1;
  stepFishing(world, 0.1);
  assert.equal(line.state, 'waiting');
});
