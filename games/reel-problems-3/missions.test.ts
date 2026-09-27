import assert from 'node:assert/strict';
import test from 'node:test';
import { generateMissions, recordSecuredFish } from './missions';
import { freshWorld, newPlayer } from './simulation';

void test('mission generation is deterministic and completing all missions starts return', () => {
  assert.deepEqual(generateMissions(123), generateMissions(123));
  const world = freshWorld(0);
  world.players.push(newPlayer(0));
  world.phase = world.round.phase = 'fishing';
  world.missions = generateMissions(123).missions;
  for (const mission of world.missions) {
    const species = mission.species ?? 'silver-sprat';
    while (!mission.complete)
      recordSecuredFish(world, world.players[0].id, species, 20);
  }
  assert.equal(world.phase, 'returning');
  assert.equal(world.activeMission, 3);
});
