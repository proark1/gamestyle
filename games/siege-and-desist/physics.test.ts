import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'cannon-es';
import { solverFor } from './physics';
import {
  advanceSiege,
  freshSiege,
  hydrateSiege,
  newCrew,
  siegeAction,
  siegeSnapshot,
} from './simulation';
import type { SiegeWorld, TeamId } from './types';

function clash() {
  const world = freshSiege(1000, 'clash2v2');
  for (let i = 0; i < 4; i++) {
    world.players.push(
      newCrew(String(i), `Crew ${i}`, i, world.clock, i < 2 ? 'red' : 'blue'),
    );
  }
  siegeAction(world, '0', { type: 'start' }, '0');
  return world;
}

function tick(world: SiegeWorld, ms: number) {
  const end = world.clock + ms;
  while (world.clock < end)
    advanceSiege(world, Math.min(end, world.clock + 50));
}

function burnSupports(world: SiegeWorld, team: TeamId, tower: number) {
  for (const block of world.blocks) {
    if (
      block.team === team &&
      block.towerIndex === tower &&
      !block.mascotKind
    ) {
      block.burning = world.clock + 1;
    }
  }
}

void test('all clash objectives are seated on their tower supports', () => {
  const world = clash();
  for (const item of world.blocks.filter((b) => b.mascotKind)) {
    const supports = world.blocks.filter(
      (b) =>
        b.team === item.team &&
        b.towerIndex === item.towerIndex &&
        !b.mascotKind,
    );
    const bottom = item.y - item.h / 2;
    assert.ok(
      supports.some((b) => Math.abs(bottom - (b.y + b.h / 2)) < 0.03),
      `${item.team} ${item.mascotKind} has a stone immediately beneath it`,
    );
  }
});

void test('undisturbed castles keep all six objectives standing and asleep', () => {
  const world = clash();
  tick(world, 8000);
  assert.equal(world.phase, 'playing');
  assert.deepEqual(world.towers, {
    red: [true, true, true],
    blue: [true, true, true],
  });
  for (const block of world.blocks) {
    assert.equal(block.sleeping, true);
    assert.equal(block.y, block.homeY);
  }
});

void test('a low impact wakes the sleeping masonry and item above it', () => {
  const world = clash();
  const solver = solverFor(world);
  const base = world.blocks.find(
    (b) => b.team === 'blue' && b.towerIndex === 0 && b.homeY < 1,
  )!;
  const item = world.blocks.find(
    (b) => b.team === 'blue' && b.mascotKind === 'rooster',
  )!;
  solver.impact(base.x, base.y, base.z, { x: 1, y: 0, z: 0 }, 800, 0.8);
  tick(world, 50);
  assert.equal(item.sleeping, false, 'the item wakes beyond the impact radius');
  assert.ok(
    world.blocks.filter((b) => b.team === 'red').every((b) => b.sleeping),
    'the other castle remains asleep',
  );
});

void test('an item falls with the upper courses when its sleeping foundation burns away', () => {
  const world = clash();
  solverFor(world);
  const item = world.blocks.find(
    (b) => b.team === 'blue' && b.mascotKind === 'rooster',
  )!;
  for (const block of world.blocks) {
    if (block.team === 'blue' && block.towerIndex === 0 && block.homeY < 1) {
      block.burning = world.clock + 1;
    }
  }
  tick(world, 3000);
  assert.ok(
    item.y < item.homeY - 0.75,
    'the whole stack follows the lost foundation',
  );
  assert.equal(world.phase, 'playing');
});

for (const team of ['red', 'blue'] as const) {
  void test(`${team} loses only after all three supported items fall, then debris keeps settling`, () => {
    const world = clash();
    solverFor(world);
    for (const tower of [0, 2, 1]) {
      burnSupports(world, team, tower);
      tick(world, 2500);
      assert.equal(
        world.towers![team][tower],
        false,
        `tower ${tower} counted as down`,
      );
      assert.equal(world.phase, tower === 1 ? 'won' : 'playing');
    }
    assert.equal(world.winner, team === 'red' ? 'blue' : 'red');
    assert.deepEqual(world.towers![team], [false, false, false]);
    const flag = world.blocks.find(
      (b) => b.team === team && b.mascotKind === 'banner',
    )!;
    assert.ok(
      flag.y < 2,
      'the banner keeps falling after the result is declared',
    );
    assert.equal(world.events.filter((e) => e.kind === 'finish').length, 1);

    const guest = hydrateSiege(
      siegeSnapshot(world, 'ABC234', '0', '1', 1).world,
    );
    assert.deepEqual(guest.towers, world.towers);
    assert.equal(guest.phase, 'won');
    for (const item of world.blocks.filter((b) => b.mascotKind)) {
      assert.equal(guest.blocks.find((b) => b.id === item.id)!.y, item.y);
    }
  });
}

void test('burned-away objectives count toward victory without manually changing tower flags', () => {
  const world = clash();
  solverFor(world);
  for (const item of world.blocks.filter(
    (b) => b.team === 'blue' && b.mascotKind,
  )) {
    item.burning = world.clock + 1;
  }
  tick(world, 50);
  assert.equal(world.phase, 'won');
  assert.equal(world.winner, 'red');
  assert.deepEqual(world.towers!.blue, [false, false, false]);
});

void test('both castles losing their last objectives in the same tick is a draw', () => {
  const world = clash();
  for (const item of world.blocks.filter((b) => b.mascotKind)) {
    item.burning = world.clock + 1;
  }
  tick(world, 50);
  assert.equal(world.phase, 'won');
  assert.equal(world.winner, 'draw');
});

void test('a rematch rebuilds the physics bodies and clears the previous winner', () => {
  const world = clash();
  for (const tower of [0, 1, 2]) burnSupports(world, 'blue', tower);
  tick(world, 3000);
  assert.equal(world.phase, 'won');
  siegeAction(world, '0', { type: 'restart' }, '0');
  tick(world, 1000);
  assert.equal(world.phase, 'playing');
  assert.equal(world.winner, undefined);
  assert.deepEqual(world.towers, {
    red: [true, true, true],
    blue: [true, true, true],
  });
  for (const item of world.blocks.filter((b) => b.mascotKind)) {
    assert.equal(item.y, item.homeY);
  }
  burnSupports(world, 'blue', 0);
  tick(world, 2500);
  assert.equal(
    world.towers!.blue[0],
    false,
    'the rebuilt tower can fall again',
  );
});

void test('burning away the classic banner also finishes the siege', () => {
  const world = freshSiege(1000);
  world.players.push(newCrew('0', 'Captain', 0, world.clock));
  siegeAction(world, '0', { type: 'start' }, '0');
  world.blocks.find((b) => b.part === 'banner')!.burning = world.clock + 1;
  tick(world, 50);
  assert.equal(world.phase, 'won');
  assert.equal(world.bannerDown, true);
});

void test('restoring a castle with missing supports resumes its collapse', () => {
  const world = clash();
  burnSupports(world, 'blue', 0);
  const gone = world.blocks.filter((b) => b.burning).map((b) => b.id);
  world.gone.push(...gone);
  world.blocks = world.blocks.filter((b) => !b.burning);
  const restored = hydrateSiege(
    siegeSnapshot(world, 'ABC234', '0', '1', 1).world,
  );
  tick(restored, 2500);
  assert.equal(restored.towers!.blue[0], false);
});

void test('a sleeping item follows a support that starts sliding after the stack has settled', () => {
  const world = clash();
  const item = world.blocks.find(
    (b) => b.team === 'blue' && b.mascotKind === 'rooster',
  )!;
  world.blocks = world.blocks.filter(
    (b) => b.team === 'blue' && b.towerIndex === 0,
  );
  const solver = solverFor(world);
  for (const body of solver.blocks.values()) body.wakeUp();
  for (let i = 0; i < 480; i++) solver.step(1 / 60);
  solver.read(world);
  assert.equal(item.sleeping, true, 'the item first comes to rest');
  const before = item.y;
  for (const block of world.blocks.filter((b) => b.homeY < 1)) {
    solver.blocks.get(block.id)!.applyImpulse(new Vec3(3000, 0, 0));
  }
  for (let i = 0; i < 180; i++) solver.step(1 / 60);
  solver.read(world);
  assert.ok(
    item.y < before - 0.6,
    'the settled item falls when its base slides away',
  );
});
