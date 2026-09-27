import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ISLAND_BOAT_Z,
  ISLAND_CENTER_Z,
  ISLAND_GANGWAY_LENGTH,
  ISLAND_GANGWAY_Z,
  ISLAND_LAND_RADIUS,
  adventureColliders,
  islandScenery,
  positionIsBlocked,
  safeSpawn,
} from './physics-layout';
import { advanceWorld, freshWorld, newPlayer, setInput } from './simulation';
import type { AdventurePhase, AdventureWorld } from './types';

function worldAt(phase: AdventurePhase) {
  const world = freshWorld(1_000);
  world.phase = phase;
  const player = newPlayer(0);
  Object.assign(player, {
    id: 'p1',
    name: 'Pip',
    bot: false,
    ...safeSpawn(phase, 0),
  });
  world.players.push(player);
  return world;
}

function walk(world: AdventureWorld, milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 100)
    advanceWorld(world, world.clock + 100);
}

void test('tower and boat rails resolve player movement instead of allowing penetration', () => {
  const island = worldAt('search');
  const walker = island.players[0];
  walker.x = 0;
  walker.z = 0;
  setInput(island, walker.id, { x: 0, z: 1, yaw: 0 });
  walk(island, 3_000);
  assert.ok(walker.z > -1.6, `tower penetration at z=${walker.z}`);
  assert.ok(walker.z < -1.2, `player never reached the tower at z=${walker.z}`);

  const storm = worldAt('storm');
  const sailor = storm.players[0];
  sailor.x = 0;
  sailor.z = 1.5;
  setInput(storm, sailor.id, { x: 1, z: 0, yaw: 0, sprint: true });
  walk(storm, 2_000);
  assert.ok(sailor.x < 2.86, `boat rail penetration at x=${sailor.x}`);
  assert.ok(
    sailor.x > 2.5,
    `player never reached the boat rail at x=${sailor.x}`,
  );
});

void test('supply crates and island trees are solid', () => {
  const harbor = worldAt('harbor');
  const loader = harbor.players[0];
  loader.x = -1.7;
  loader.z = 3;
  setInput(harbor, loader.id, { x: 0, z: 1, yaw: 0 });
  walk(harbor, 2_000);
  assert.ok(
    loader.z > 0.2,
    `walked through the lantern crate to z=${loader.z}`,
  );

  const island = worldAt('search');
  const explorer = island.players[0];
  const tree = islandScenery().find(
    (item) => item.tree && Math.abs(item.tree.x) > 3,
  )?.tree;
  assert.ok(tree);
  explorer.x = tree.x;
  explorer.z = tree.z + 2;
  setInput(island, explorer.id, { x: 0, z: 1, yaw: 0 });
  let nearest = Number.POSITIVE_INFINITY;
  for (let elapsed = 0; elapsed < 1_500; elapsed += 100) {
    advanceWorld(island, island.clock + 100);
    nearest = Math.min(
      nearest,
      Math.hypot(explorer.x - tree.x, explorer.z - tree.z),
    );
  }
  assert.ok(nearest > 0.6, `tree penetration reached ${nearest} metres`);
});

void test('diagonal movement slides along the tower', () => {
  const world = worldAt('search');
  const player = world.players[0];
  player.x = -1.5;
  player.z = 0;
  setInput(world, player.id, { x: 0.36, z: 1, yaw: 0 });
  walk(world, 2_000);
  assert.ok(player.x > -1.2, `expected lateral slide, got x=${player.x}`);
  assert.equal(positionIsBlocked(world, player.x, player.z), false);
});

void test('phase layouts include solid props, trees, rocks, buildings, and fixtures', () => {
  const harbor = worldAt('harbor');
  const harborIds = new Set(adventureColliders(harbor).map((item) => item.id));
  assert.ok(harborIds.has('supply-rope'));
  assert.ok(harborIds.has('harbor-house-2'));
  assert.ok(harborIds.has('boat-mast'));

  const island = worldAt('search');
  const islandIds = new Set(adventureColliders(island).map((item) => item.id));
  const tree = islandScenery().find((item) => item.tree);
  assert.ok(tree);
  assert.ok(islandIds.has(tree.id));
  assert.ok(islandIds.has(`${tree.id}-tree`));
  assert.ok(islandIds.has('beacon-tower'));
  assert.ok(islandIds.has('beacon-bell-frame'));
});

void test('the island boat is offshore and the gangway joins shore to deck', () => {
  const hullLandwardEdge = ISLAND_BOAT_Z - 7.4 / 2;
  const shoreEdge = ISLAND_CENTER_Z + ISLAND_LAND_RADIUS;
  const gangwayStart = ISLAND_GANGWAY_Z - ISLAND_GANGWAY_LENGTH / 2;
  const gangwayEnd = ISLAND_GANGWAY_Z + ISLAND_GANGWAY_LENGTH / 2;
  assert.ok(hullLandwardEdge > shoreEdge);
  assert.ok(gangwayStart < shoreEdge);
  assert.ok(gangwayEnd > hullLandwardEdge);

  const world = worldAt('search');
  const player = world.players[0];
  setInput(world, player.id, { x: 0, z: 1, yaw: Math.PI });
  walk(world, 1_600);
  assert.ok(
    player.z > hullLandwardEdge + 0.4,
    `did not reach the deck: z=${player.z}`,
  );
  assert.equal(positionIsBlocked(world, player.x, player.z), false);
});

void test('safe spawns and restored invalid positions recover outside colliders', () => {
  for (const phase of [
    'harbor',
    'search',
    'storm',
    'sanctuary',
    'homecoming',
  ] as const) {
    const world = worldAt(phase);
    const spawn = safeSpawn(phase, 0);
    assert.equal(positionIsBlocked(world, spawn.x, spawn.z), false, phase);
  }

  const world = worldAt('search');
  const player = world.players[0];
  player.x = Number.NaN;
  player.z = Number.POSITIVE_INFINITY;
  advanceWorld(world, world.clock + 100);
  assert.deepEqual(
    { x: player.x, z: player.z },
    safeSpawn('search', player.seat),
  );
});
