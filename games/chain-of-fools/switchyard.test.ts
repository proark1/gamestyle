import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SWITCHYARD,
  SWITCHYARD_CHECKPOINTS,
  checkpointAt,
  sectionAt,
} from './course';
import { reconcileChainBots, stepChainBot } from './bots';
import { supportUnder } from './physics';
import { createEngine } from './peer';
import {
  advanceChainOfFools,
  chainOfFoolsAction,
  freshChainWorld,
  newPlayer,
} from './simulation';
import type { ChainWorld } from './types';

function crew(): ChainWorld {
  const world = freshChainWorld(1_000_000);
  for (let i = 0; i < 4; i++)
    world.players.push(newPlayer(`p${i}`, `Worker ${i}`, i, i, false));
  chainOfFoolsAction(world, 'p0', { type: 'select_map', mapId: 'switchyard' });
  chainOfFoolsAction(world, 'p0', { type: 'start' });
  for (const player of world.players) player.respawnAt = 0;
  return world;
}

function run(world: ChainWorld, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    for (const player of world.players)
      if (player.bot) stepChainBot(player, world, 1 / 60);
    advanceChainOfFools(world, world.clock + 1000 / 60, 1 / 60);
  }
}

function placeOnBank(world: ChainWorld, x: number, lanes: number[]) {
  world.players.forEach((player, i) => {
    player.x = x;
    player.y = 0;
    player.z = lanes[i];
    player.vx = player.vy = player.vz = 0;
    player.grounded = true;
    player.state = 'standing';
  });
}

void test('Switchyard selection has grounded checkpoints and a separate route', () => {
  const world = crew();
  assert.equal(world.mapId, 'switchyard');
  assert.ok(world.players.every((p) => p.x >= SWITCHYARD.startX));
  assert.equal(checkpointAt(320, 'switchyard'), 2);
  assert.equal(sectionAt(335, 'switchyard'), 'switch-crew');
  for (const point of SWITCHYARD_CHECKPOINTS) {
    const [x, y, z] = point.spawn;
    const support = supportUnder(x, y + 0.3, z, 0);
    assert.ok(support !== null && Math.abs(support - y) < 0.35);
  }
});

void test('a peer room shares the selected map before starting', () => {
  const engine = createEngine(1_000_000);
  engine.reconcile([{ id: 'host', name: 'Host', color: 0 }] as never);
  engine.execute(
    'host',
    'map-choice',
    { type: 'select_map', mapId: 'switchyard' },
    'host',
  );
  const world = engine.world as ChainWorld;
  assert.equal(world.mapId, 'switchyard');
  assert.ok(world.players.every((player) => player.x >= SWITCHYARD.startX));
  engine.execute('host', 'begin', { type: 'start' }, 'host');
  assert.equal(world.phase, 'playing');
  assert.equal(world.mapId, 'switchyard');
});

void test('both gates require simultaneous separate workers and block passage until open', () => {
  const world = crew();
  const first = SWITCHYARD.gates[0];
  placeOnBank(world, first.plates[0].x, [-3, -1, 1, 2]);
  run(world, 1.5);
  assert.equal(
    world.gatesOpen[0],
    false,
    'one occupied pad cannot open the gate',
  );

  world.players[3].z = 3;
  run(world, 1.5);
  assert.equal(
    world.gatesOpen[0],
    true,
    'two different workers open the first gate',
  );

  const second = SWITCHYARD.gates[1];
  placeOnBank(world, second.plates[0].x, [-3, -1, 1, 2]);
  world.players[0].x = second.x + 2;
  run(world, 0.5);
  assert.ok(world.players[0].x < second.x, 'closed gate stops a worker');
  assert.equal(world.gatesOpen[1], false);

  placeOnBank(world, second.plates[0].x, [-3, -1, 1, 3]);
  run(world, 1.5);
  assert.equal(world.gatesOpen[1], true, 'every worker must hold a pad');

  chainOfFoolsAction(world, 'p0', { type: 'restart' });
  assert.deepEqual(world.gatesOpen, [false, false]);
  assert.equal(world.checkpoint, 0);
});

void test('a bot crew can open the switches, cross and finish together', () => {
  const world = freshChainWorld(1_000_000);
  reconcileChainBots(world);
  chainOfFoolsAction(world, world.players[0].id, {
    type: 'select_map',
    mapId: 'switchyard',
  });
  chainOfFoolsAction(world, world.players[0].id, { type: 'start' });
  for (let i = 0; i < 270 * 60 && world.phase === 'playing'; i++)
    run(world, 1 / 60);
  assert.equal(world.winner, 'crew');
  assert.deepEqual(world.gatesOpen, [true, true]);
  assert.ok(world.players.every((p) => p.state === 'finished'));
});

void test('three bots take the other pads when a human holds the crew gate', () => {
  const world = freshChainWorld(1_000_000);
  world.players.push(newPlayer('me', 'You', 0, 0, false));
  reconcileChainBots(world);
  chainOfFoolsAction(world, 'me', {
    type: 'select_map',
    mapId: 'switchyard',
  });
  chainOfFoolsAction(world, 'me', { type: 'start' });
  world.gatesOpen[0] = true;
  placeOnBank(world, 335, [3, 1, -1, -3]);
  for (const player of world.players) player.respawnAt = 0;
  run(world, 2);
  assert.equal(world.gatesOpen[1], true);
  assert.ok(
    world.events.some((event) => event.detail === 'The crew opened gate 2'),
  );
});
