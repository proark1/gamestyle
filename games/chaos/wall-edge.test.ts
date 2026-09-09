import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, freshWorld, type Piece, type Player } from './model';
import { placementError, snapPlacement } from './placement';
import { removalSupportError } from './structure';

const tile = (x: number, z: number, level: number, id = 'tile'): Piece => ({
  id,
  kind: 'floor',
  placed: true,
  rotation: 0,
  level,
  x,
  z,
});

void test('walls, windows and doors fit and snap to all four edges on upper storeys', () => {
  for (const level of [1, 2])
    for (const kind of ['wall', 'window', 'door'] as const) {
      for (const rotation of [0, 1, 2, 3])
        for (const side of [-1, 1]) {
          const world = freshWorld('sandbox', 1000);
          world.pieces = [tile(0, 0, level)];
          const target =
            rotation % 2 ? { x: side, z: 0, level } : { x: 0, z: side, level };
          assert.equal(
            placementError(world, kind, target, undefined, rotation),
            null,
            `${kind} ${level} ${rotation} ${side}`,
          );
          const raw = { ...target, x: target.x + 0.12, z: target.z + 0.15 };
          const snapped = snapPlacement(world, kind, raw, rotation);
          assert.equal(snapped.x, target.x);
          assert.equal(snapped.z, target.z);
          assert.equal(snapped.level, level);
          assert.equal(snapped.snapped, true);
        }
    }
});

void test('the full wall length needs support, including gaps between tiles', () => {
  const world = freshWorld('sandbox', 1000);
  world.pieces = [tile(0, 0, 1)];
  for (const target of [
    { x: 1, z: 1, level: 1 },
    { x: 0, z: 1.12, level: 1 },
  ]) {
    assert.match(
      placementError(world, 'wall', target, undefined, 0)!,
      /floor tiles/,
    );
  }
  world.pieces = [tile(-1, 0, 1, 'left'), tile(1, 0, 1, 'right')];
  assert.equal(
    placementError(world, 'wall', { x: 0, z: 1, level: 1 }, undefined, 0),
    null,
  );
  world.pieces[1].x = 1.25;
  assert.match(
    placementError(world, 'wall', { x: -0.5, z: 1, level: 1 }, undefined, 0)!,
    /full wall/,
  );
});

void test('wall edge allowance does not permit overhanging furniture or unavailable support', () => {
  const world = freshWorld('sandbox', 1000);
  world.pieces = [tile(0, 0, 1)];
  assert.match(
    placementError(world, 'table', { x: 0, z: 1, level: 1 }, undefined, 0)!,
    /whole part/,
  );
  for (const change of [
    { level: 0 },
    { placed: false },
    { heldBy: 'p' },
    { hoisted: true },
  ]) {
    world.pieces = [{ ...tile(0, 0, 1), ...change }];
    assert.match(
      placementError(world, 'wall', { x: 0, z: 1, level: 1 }, undefined, 0)!,
      /floor tiles/,
    );
  }
});

void test('the server builds an edge wall on the selected storey and protects its support', () => {
  const world = freshWorld('sandbox', 1000);
  world.pieces = [
    { id: 'support', kind: 'wall', placed: true, rotation: 0, x: 0, z: -1 },
    tile(0, 0, 1),
  ];
  const player: Player = {
    id: 'p',
    name: 'Builder',
    color: 0,
    x: 0,
    z: 0,
    y: 3.43,
    angle: 0,
    seen: 1000,
  };
  applyAction(
    world,
    { type: 'build', kind: 'window', x: 0, z: 1, level: 1, rotation: 0 },
    player,
    [player],
    player.id,
    1100,
  );
  const wall = world.pieces.at(-1)!;
  assert.equal(wall.kind, 'window');
  assert.equal(wall.level, 1);
  assert.equal(wall.z, 1);
  assert.match(removalSupportError(world, world.pieces[1])!, /supports/);
});
