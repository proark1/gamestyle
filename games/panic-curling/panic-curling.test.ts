import { reconcileCurlingBots, updateCurlingBots } from './bots';
import { createCurlingRinkMesh, createGadgetMesh } from './models';
import * as T from 'three';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeEndScore, stepCurlingPhysics } from './physics';
import {
  panicCurlingAction,
  PARTY_AIM_PATIENCE_S,
  advancePanicCurling,
  freshCurlingWorld,
  launchDelivery,
  newCurlingPlayer,
} from './simulation';
import { createEngine } from './peer';
import {
  STONE_CONFIGS,
  TEE_Z,
  type BananaHazard,
  type CurlingPlayer,
  type GameEvent,
  type IceTile,
  type Stone,
} from './types';

void test('in a party round, a deliverer who never throws has the stone thrown for them', () => {
  const idle = (patience?: number) => {
    const world = freshCurlingWorld(1000);
    world.aimPatience = patience;
    world.players.push(
      newCurlingPlayer('human', 'You', 0, world.turnTeam, 'deliverer', false),
    );
    let now = 1000;
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.1)
        advancePanicCurling(world, (now += 100));
    };
    return { world, run };
  };

  const party = idle(PARTY_AIM_PATIENCE_S);
  party.run(2);
  assert.equal(party.world.phase, 'aiming');
  party.run(PARTY_AIM_PATIENCE_S - 2);
  assert.equal(party.world.phase, 'aiming', 'the deliverer gets time to aim');
  party.run(2);
  assert.equal(party.world.phase, 'sliding', 'the stone went on its own');
  assert.equal(party.world.stones.length, 1);

  // Normal play waits for the player however long they take.
  const normal = idle();
  normal.run(PARTY_AIM_PATIENCE_S + 10);
  assert.equal(normal.world.phase, 'aiming');
});

void test('stone launches and decelerates over ice with rotational curl', () => {
  const world = freshCurlingWorld(1000);
  // CW spin (+1)
  const stone = launchDelivery(world, 0.5, 0, 1, 'granite');
  assert.ok(stone.vz > 0, 'Stone moves forward');
  assert.equal(stone.x, 0);

  const events: GameEvent[] = [];
  const players: CurlingPlayer[] = [];
  const tiles: IceTile[] = [];
  const hazards: BananaHazard[] = [];

  // Step physics for 2 seconds
  for (let i = 0; i < 120; i++) {
    stepCurlingPhysics([stone], players, tiles, hazards, 1 / 60, events);
  }

  assert.ok(stone.z > 0, 'Stone moved forward down ice');
  assert.ok(stone.x > 0, 'CW spin curled stone to the right (+X)');
  assert.ok(
    stone.vz < 6.0,
    'Friction caused forward velocity to decrease over time',
  );
});

void test('sweeping ahead of the stone cuts friction and increases slide distance', () => {
  const dt = 1 / 60;
  const cfg = STONE_CONFIGS.granite;

  // Stone A: unswept
  const stoneA: Stone = {
    id: 'stone-a',
    kind: 'granite',
    team: 'red',
    x: 0,
    y: cfg.height / 2,
    z: 0,
    vx: 0,
    vz: 4.5,
    spin: 0,
    rotation: 0,
    active: true,
    stopped: false,
    inPlay: true,
    outOfBounds: false,
    distanceToTee: 31,
  };

  // Stone B: swept continuously by a teammate
  const stoneB: Stone = {
    id: 'stone-b',
    kind: 'granite',
    team: 'red',
    x: 0,
    y: cfg.height / 2,
    z: 0,
    vx: 0,
    vz: 4.5,
    spin: 0,
    rotation: 0,
    active: true,
    stopped: false,
    inPlay: true,
    outOfBounds: false,
    distanceToTee: 31,
  };

  const sweeper = newCurlingPlayer(
    'sweeper-1',
    'Sweeper',
    0,
    'red',
    'sweeper',
    false,
  );
  sweeper.status = 'sweeping';
  sweeper.sweepIntensity = 1.0;
  sweeper.gadget = 'blowtorch'; // Extreme friction reduction

  const events: GameEvent[] = [];

  for (let i = 0; i < 200; i++) {
    // Keep sweeper directly ahead of stone B
    sweeper.x = stoneB.x;
    sweeper.z = stoneB.z + 1.2;

    stepCurlingPhysics([stoneA], [], [], [], dt, events);
    stepCurlingPhysics([stoneB], [sweeper], [], [], dt, events);
  }

  assert.ok(
    stoneB.z > stoneA.z,
    `Swept stone traveled farther (${stoneB.z.toFixed(2)}m) than unswept stone (${stoneA.z.toFixed(2)}m)`,
  );
});

void test('ice sheet remains solid and sweeper escorts stone down the sheet', () => {
  const tile: IceTile = {
    id: 'test-tile-1',
    x: 0,
    z: 10,
    w: 2.0,
    d: 3.0,
    health: 1.0,
    stress: 0,
    cracked: false,
    broken: false,
  };

  const world = freshCurlingWorld(1000);
  const sweeper = newCurlingPlayer(
    'sw1',
    'Sweeper',
    0,
    'red',
    'sweeper',
    false,
  );
  world.players.push(sweeper);

  // Deliver stone
  const stone = launchDelivery(world, 0.6, 0, 1, 'granite');
  const events: GameEvent[] = [];

  // Step physics
  for (let i = 0; i < 60; i++) {
    stepCurlingPhysics([stone], [sweeper], [tile], [], 1 / 60, events);
  }

  // Ice remains solid
  assert.equal(tile.broken, false, 'Ice tile never breaks');
  assert.equal(tile.cracked, false, 'Ice tile never cracks');

  // Sweeper stays ahead of the stone ready to sweep
  assert.ok(
    sweeper.z >= stone.z,
    `Sweeper stayed ahead of stone (sweeper Z: ${sweeper.z.toFixed(2)}, stone Z: ${stone.z.toFixed(2)})`,
  );
  assert.ok(
    sweeper.vz > 0,
    'Sweeper matches forward velocity of the active stone',
  );
});

void test('banana peel hazard causes curler to slip', () => {
  const curler = newCurlingPlayer('c1', 'Curler', 0, 'red', 'sweeper', false);
  curler.x = 0;
  curler.z = 5;

  const hazard: BananaHazard = {
    id: 'banana-1',
    x: 0,
    z: 5.2,
    active: true,
    team: 'blue',
  };

  const events: GameEvent[] = [];
  stepCurlingPhysics([], [curler], [], [hazard], 1 / 60, events);

  assert.equal(
    hazard.active,
    false,
    'Banana peel was stepped on and deactivated',
  );
  assert.equal(curler.status, 'slipping', 'Curler entered slipping state');
  assert.ok(events.some((e) => e.type === 'banana_slip'));
});

void test('curling house score awards points to closest team stones', () => {
  const cfg = STONE_CONFIGS.granite;

  const stones: Stone[] = [
    // Red stone 1: right on the button (distance = 0.1m)
    {
      id: 'r1',
      kind: 'granite',
      team: 'red',
      x: 0.1,
      y: cfg.height / 2,
      z: TEE_Z,
      vx: 0,
      vz: 0,
      spin: 0,
      rotation: 0,
      active: false,
      stopped: true,
      inPlay: true,
      outOfBounds: false,
      distanceToTee: 0.1,
    },
    // Red stone 2: 4-foot ring (distance = 0.8m)
    {
      id: 'r2',
      kind: 'granite',
      team: 'red',
      x: 0.8,
      y: cfg.height / 2,
      z: TEE_Z,
      vx: 0,
      vz: 0,
      spin: 0,
      rotation: 0,
      active: false,
      stopped: true,
      inPlay: true,
      outOfBounds: false,
      distanceToTee: 0.8,
    },
    // Blue stone 1: 8-foot ring (distance = 1.6m)
    {
      id: 'b1',
      kind: 'granite',
      team: 'blue',
      x: 1.6,
      y: cfg.height / 2,
      z: TEE_Z,
      vx: 0,
      vz: 0,
      spin: 0,
      rotation: 0,
      active: false,
      stopped: true,
      inPlay: true,
      outOfBounds: false,
      distanceToTee: 1.6,
    },
  ];

  const score = computeEndScore(stones);
  assert.equal(score.closestTeam, 'red');
  assert.equal(
    score.red,
    2,
    'Red scores 2 points for having 2 stones closer than Blue best stone',
  );
  assert.equal(score.blue, 0);
});

void test('peer engine creates panic-curling world and serializes checkpoint', () => {
  const engine = createEngine(1000);
  const snap = engine.snapshot('TEST_CODE', 'host-1', 'player-1', 1);

  assert.equal(snap.code, 'TEST_CODE');
  assert.equal(snap.world.round, 1);
  assert.ok(snap.world.players.length > 0, 'World populated with players/bots');

  const cp = engine.checkpoint();
  assert.equal(cp.game, 'panic-curling');
});

void test('all stone types reach the house at half power and allow a visible result', () => {
  for (const kind of ['granite', 'anvil', 'basket'] as const) {
    const world = freshCurlingWorld(1000);
    reconcileCurlingBots(world);
    const stone = launchDelivery(world, 0.5, 0, 1, kind);
    let sweeps = 0;
    let now = 1000;
    while (world.phase === 'sliding' && now < 32000) {
      updateCurlingBots(world, 1 / 60);
      advancePanicCurling(world, (now += 1000 / 60));
      if (
        world.players.some(
          (p) => p.team === stone.team && p.status === 'sweeping',
        )
      )
        sweeps++;
    }
    assert.equal(world.phase, 'shot_result');
    assert.equal(stone.outOfBounds, false, kind);
    assert.ok(stone.distanceToTee < 3.55, `${kind} ends in the house`);
    assert.ok(sweeps > 0, `${kind} receives visible bot assistance`);
    assert.equal(world.throwIndex, 0);
    advancePanicCurling(world, (now += 100));
    assert.equal(world.phase, 'shot_result');
    for (let i = 0; i < 17; i++) advancePanicCurling(world, (now += 100));
    assert.equal(world.phase, 'aiming');
    assert.equal(world.throwIndex, 1);
  }
});

void test('low, draw and takeout power produce distinct unswept distances', () => {
  for (const kind of ['granite', 'anvil', 'basket'] as const) {
    const distances = [0.3, 0.5, 0.8].map((power) => {
      const world = freshCurlingWorld(0);
      const stone = launchDelivery(world, power, 0, 1, kind);
      for (let i = 1; world.phase === 'sliding' && i < 1900; i++)
        advancePanicCurling(world, (i * 1000) / 60);
      return stone;
    });
    assert.ok(distances[0].z < 26, kind);
    assert.ok(distances[1].distanceToTee < 3.55, kind);
    assert.equal(distances[2].outOfBounds, true, kind);
  }
});

void test('an escort faces the stone and can slip on a banana', () => {
  const world = freshCurlingWorld(0);
  const sweeper = newCurlingPlayer('human', 'You', 0, 'red', 'sweeper', false);
  world.players.push(sweeper);
  const stone = launchDelivery(world, 0.5, 0, 1, 'granite');
  stepCurlingPhysics(world.stones, world.players, [], [], 1 / 60, []);
  assert.ok(Math.cos(sweeper.rotation) < -0.9);
  const hazard: BananaHazard = {
    id: 'peel',
    x: sweeper.x,
    z: sweeper.z,
    team: 'blue',
    active: true,
  };
  const events: GameEvent[] = [];
  stepCurlingPhysics([stone], [sweeper], [], [hazard], 1 / 60, events);
  assert.equal(sweeper.status, 'slipping');
  assert.equal(hazard.active, false);
  assert.ok(events.some((e) => e.type === 'banana_slip'));
});

void test('role changes cannot teleport players during a shot and humans replace role bots', () => {
  const world = freshCurlingWorld(0);
  const human = newCurlingPlayer('human', 'You', 0, 'red', 'deliverer', false);
  world.players.push(human);
  reconcileCurlingBots(world);
  launchDelivery(world, 0.5, 0, 1, 'granite');
  const positions = world.players.map((p) => [p.x, p.z]);
  panicCurlingAction(
    world,
    human.id,
    { type: 'switchRole', role: 'sweeper' },
    true,
  );
  panicCurlingAction(
    world,
    human.id,
    { type: 'switchTeam', team: 'blue' },
    true,
  );
  assert.equal(human.role, 'deliverer');
  assert.equal(human.team, 'red');
  assert.deepEqual(
    world.players.map((p) => [p.x, p.z]),
    positions,
  );
  world.phase = 'aiming';
  panicCurlingAction(
    world,
    human.id,
    { type: 'switchRole', role: 'sweeper' },
    true,
  );
  reconcileCurlingBots(world);
  assert.equal(
    world.players.filter((p) => p.team === 'red' && p.role === 'sweeper')
      .length,
    1,
  );
});

void test('the next end gives hammer to the non-scoring team and retains it for a blank', () => {
  for (const score of [
    { red: 1, blue: 0 },
    { red: 0, blue: 2 },
    { red: 0, blue: 0 },
  ]) {
    const world = freshCurlingWorld(0);
    world.phase = 'end_summary';
    world.phaseTimer = 4;
    world.endScores.push(score);
    advancePanicCurling(world, 50);
    assert.equal(world.hammerTeam, score.blue ? 'red' : 'blue');
    assert.notEqual(world.turnTeam, world.hammerTeam);
  }
});

void test('rink rings and painted lines sit above opaque ice and broom has an articulating shaft', () => {
  const rink = createCurlingRinkMesh();
  const rings = rink.children.filter(
    (mesh): mesh is T.Mesh =>
      mesh instanceof T.Mesh &&
      mesh.geometry instanceof T.CylinderGeometry &&
      mesh.position.z === TEE_Z,
  );
  assert.equal(rings.length, 4);
  for (const ring of rings)
    assert.ok(new T.Box3().setFromObject(ring).min.y > 0);
  const broom = createGadgetMesh('broom');
  assert.ok(broom.userData.shaft instanceof T.Mesh);
});
