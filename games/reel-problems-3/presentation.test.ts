import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureMissionFish } from './fishing';
import { generateMissions } from './missions';
import { nextStepFor } from './presentation';
import { freshWorld, newPlayer } from './simulation';
import type { AdventureWorld, ItemStateRecord } from './types';

function fishingWorld() {
  const world = freshWorld(7);
  const player = newPlayer(0);
  world.players = [player];
  world.phase = world.round.phase = 'fishing';
  world.missions = generateMissions(9).missions;
  const mission = world.missions[0];
  world.boat.x = mission.zoneX;
  world.boat.z = mission.zoneZ;
  ensureMissionFish(world);
  return { world, player };
}

function holdRod(world: AdventureWorld, playerId: string) {
  const player = world.players.find((candidate) => candidate.id === playerId)!;
  const rod = world.items.find((item) => item.kind === 'rod')!;
  rod.state = 'held';
  rod.holder = player.id;
  player.held = [rod.id];
  return rod;
}

void test('the guide leads a player from rod pickup to casting', () => {
  const { world, player } = fishingWorld();
  assert.equal(nextStepFor(world, player, null).id, 'get-rod');
  const rod = world.items.find((item) => item.kind === 'rod')!;
  assert.equal(nextStepFor(world, player, rod.id).tone, 'ready');
  holdRod(world, player.id);
  const step = nextStepFor(world, player, null);
  assert.equal(step.id, 'cast-line');
  assert.equal(step.control, 'F');
  assert.match(step.title, /cast/i);
});

void test('the guide explains every active fishing-line state', () => {
  const { world, player } = fishingWorld();
  holdRod(world, player.id);
  player.line = {
    state: 'waiting',
    x: world.boat.x + 8,
    z: world.boat.z,
    length: 8,
    tension: 0,
    strain: 0,
  };
  assert.equal(nextStepFor(world, player, null).id, 'wait-bite');
  player.line.state = 'biting';
  assert.deepEqual(
    [
      nextStepFor(world, player, null).id,
      nextStepFor(world, player, null).control,
    ],
    ['hook-now', 'F'],
  );
  player.line.state = 'tangled';
  assert.equal(nextStepFor(world, player, null).id, 'untangle-line');
  const fish = world.fish[0];
  fish.state = 'hooked';
  player.line.state = 'hooked';
  player.line.fishId = fish.id;
  player.line.tension = 0.4;
  assert.equal(nextStepFor(world, player, null).id, 'reel-fish');
  player.line.tension = 1.2;
  const danger = nextStepFor(world, player, null);
  assert.equal(danger.id, 'ease-line');
  assert.equal(danger.tone, 'danger');
  assert.match(danger.control!, /RELEASE/);
});

void test('a landed fish takes priority until it is secured', () => {
  const { world, player } = fishingWorld();
  holdRod(world, player.id);
  const catchItem: ItemStateRecord = {
    ...world.items[0],
    id: 'catch-test',
    kind: 'fish',
    state: 'loose',
    space: 'boat',
    x: player.x + 0.5,
    z: player.z,
    fishSpecies: 'silver-sprat',
    fishWeight: 1.2,
  };
  world.items.push(catchItem);
  assert.equal(nextStepFor(world, player, null).id, 'pick-up-catch');
  player.held = [catchItem.id];
  catchItem.state = 'held';
  catchItem.holder = player.id;
  const store = nextStepFor(world, player, 'station:ice-hold');
  assert.equal(store.id, 'store-catch');
  assert.equal(store.tone, 'ready');
});

void test('touch and German guidance use the matching action language', () => {
  const { world, player } = fishingWorld();
  holdRod(world, player.id);
  const step = nextStepFor(world, player, null, {
    touch: true,
    german: true,
  });
  assert.equal(step.control, 'ANGELN');
  assert.equal(step.eyebrow, 'NÄCHSTER SCHRITT');
  assert.match(step.title, /auswerfen/i);
});

void test('the guide safely handles a missing local player', () => {
  const { world } = fishingWorld();
  assert.equal(nextStepFor(world, undefined, null).id, 'find-crew');
});
