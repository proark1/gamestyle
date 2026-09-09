import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, freshWorld, type Piece, type Player } from './model';
import { placementError, snapPlacement } from './placement';
import { craneDuration, tickCrane } from './crane';

const part = (
  id: string,
  kind: Piece['kind'],
  x: number,
  z: number,
  level = 0,
  rotation = 0,
): Piece => ({ id, kind, x, z, level, rotation, placed: true });
const player: Player = {
  id: 'builder',
  name: 'Builder',
  x: 0,
  z: 4,
  y: 0.43,
  angle: 0,
  color: 0,
  seen: 1000,
};
function house() {
  const world = freshWorld('sandbox', 1000);
  world.pieces = [0, 1, 2].flatMap((level) => [
    part(`wall-${level}`, 'wall', 0, -1, level),
    part(`floor-${level}`, 'floor', 0, 0, level),
  ]);
  world.pieces.push({
    ...part('stock', 'roof', 3, -5),
    placed: false,
    supply: true,
  });
  return world;
}
function lift(world: ReturnType<typeof house>) {
  applyAction(
    world,
    { type: 'crane-pick', id: 'stock' },
    player,
    [player],
    player.id,
    1000,
  );
  const now = 1000 + craneDuration(world.crane!);
  tickCrane(world, [player], now);
  return now;
}

void test('three-storey roofs can only be lowered onto an exposed storey, never through upper floors', () => {
  const world = house();
  for (const rotation of [0, 1, 2, 3]) {
    for (const level of [0, 1]) {
      const target = snapPlacement(
        world,
        'roof',
        { x: 0.12, z: 0.1, level },
        rotation,
      );
      assert.equal(
        target.level ?? 0,
        level,
        'The selected storey must not change silently',
      );
      assert.match(
        placementError(world, 'roof', target, undefined, rotation)!,
        /Blocked from above/,
      );
    }
    assert.equal(
      placementError(
        world,
        'roof',
        { x: 0, z: 0, level: 2 },
        undefined,
        rotation,
      ),
      null,
    );
  }
  // Even with an empty middle storey, the third storey blocks access from the sky.
  world.pieces = world.pieces.filter((p) => p.level !== 1);
  assert.match(placementError(world, 'roof', { x: 0, z: 0 })!, /Floor 3/);
});

void test('setback upper storeys leave lower wings available, but partial overhang blocks the entire roof', () => {
  const world = house();
  for (const level of [0, 1]) {
    world.pieces.push(part(`wing-${level}`, 'wall', 2, -1, level));
    assert.equal(placementError(world, 'roof', { x: 2, z: 0, level }), null);
    assert.match(
      placementError(world, 'roof', { x: 1, z: 0, level })!,
      /Blocked from above/,
    );
  }
  // A tile just touching the footprint edge is allowed; one overlapping the corner is not.
  world.pieces = [
    part('support', 'wall', 0, -1),
    part('overhang', 'floor', 1.8, 1.8, 2),
  ];
  assert.match(
    placementError(world, 'roof', { x: 0, z: 0 })!,
    /Blocked from above/,
  );
  world.pieces[1].x = 2;
  assert.equal(placementError(world, 'roof', { x: 0, z: 0 }), null);
});

void test('upper walls, stairs, roofs and furnishings block lowering regardless of rotation', () => {
  const world = house();
  for (const kind of [
    'wall',
    'window',
    'door',
    'stairs',
    'roof',
    'sofa',
  ] as const)
    for (const rotation of [0, 1, 2, 3]) {
      world.pieces = [
        part('support', 'wall', 0, -1),
        part('obstacle', kind, 0, 0, 2, rotation),
      ];
      assert.match(
        placementError(world, 'roof', { x: 0, z: 0 })!,
        /Blocked from above/,
      );
    }
});

void test('same-storey floors and furniture, loose stock and carried loads do not become upper-storey blockers', () => {
  const world = house();
  for (const state of [
    { placed: false },
    { heldBy: player.id },
    { hoisted: true },
    { supply: true },
  ]) {
    world.pieces = [
      part('support', 'wall', 0, -1),
      part('floor', 'floor', 0, 0),
      part('table', 'table', 0, 0),
      { ...part('not-installed', 'floor', 0, 0, 2), ...state },
    ];
    assert.equal(placementError(world, 'roof', { x: 0, z: 0 }), null);
  }
});

void test('server rejects covered roof targets without losing the load, then installs on the selected top storey', () => {
  const world = house();
  let now = lift(world);
  const cargoId = world.crane!.pieceId;
  for (const level of [0, 1]) {
    assert.throws(
      () =>
        applyAction(
          world,
          { type: 'crane-place', x: 0, z: 0, level, rotation: 0 },
          player,
          [player],
          player.id,
          now,
        ),
      /Blocked from above/,
    );
    assert.equal(world.crane!.phase, 'ready');
    assert.equal(world.crane!.to, undefined);
    assert.equal(world.pieces.find((p) => p.id === cargoId)!.hoisted, true);
  }
  applyAction(
    world,
    { type: 'crane-place', x: 0, z: 0, level: 2, rotation: 0 },
    player,
    [player],
    player.id,
    now,
  );
  now += craneDuration(world.crane!);
  tickCrane(world, [player], now);
  assert.equal(world.crane, undefined);
  const roof = world.pieces.find((p) => p.id === cargoId)!;
  assert.equal(roof.level, 2);
  assert.equal(roof.placed, true);
});

void test('crane rechecks overhead access when another builder adds a floor while the roof is travelling', () => {
  const world = house();
  world.pieces = world.pieces.filter((p) => (p.level ?? 0) === 0);
  let now = lift(world);
  const cargoId = world.crane!.pieceId;
  applyAction(
    world,
    { type: 'crane-place', x: 0, z: 0, rotation: 0 },
    player,
    [player],
    player.id,
    now,
  );
  world.pieces.push(part('new-floor', 'floor', 0, 0, 1));
  now += craneDuration(world.crane!);
  tickCrane(world, [player], now);
  assert.match(world.crane!.error!, /Blocked from above/);
  assert.equal(world.crane!.phase, 'pickup');
  assert.equal(world.pieces.find((p) => p.id === cargoId)!.placed, false);
  assert.equal(world.pieces.find((p) => p.id === cargoId)!.hoisted, true);
  applyAction(
    world,
    { type: 'crane-cancel' },
    player,
    [player],
    player.id,
    now,
  );
  assert.equal(world.crane, undefined);
  assert.equal(
    world.pieces.some((p) => p.id === cargoId),
    false,
  );
});

void test('crane cannot reach an installed roof through upper construction to pick it up', () => {
  const world = house();
  world.pieces.push(part('covered-roof', 'roof', 0, 0));
  const before = structuredClone(world.pieces);
  assert.throws(
    () =>
      applyAction(
        world,
        { type: 'crane-pick', id: 'covered-roof' },
        player,
        [player],
        player.id,
        1000,
      ),
    /Blocked from above/,
  );
  assert.equal(world.crane, undefined);
  assert.deepEqual(world.pieces, before);
  world.pieces = world.pieces.filter((p) => (p.level ?? 0) === 0);
  applyAction(
    world,
    { type: 'crane-pick', id: 'covered-roof' },
    player,
    [player],
    player.id,
    1000,
  );
  assert.equal(world.crane!.phase, 'pickup');
});

void test('the reserved origin of a suspended upper roof still blocks lower placement until it is moved', () => {
  const world = house();
  world.pieces = [
    part('support', 'wall', 0, -1),
    part('upper-roof', 'roof', 0, 0, 2),
  ];
  applyAction(
    world,
    { type: 'crane-pick', id: 'upper-roof' },
    player,
    [player],
    player.id,
    1000,
  );
  assert.match(
    placementError(world, 'roof', { x: 0, z: 0 })!,
    /Blocked from above/,
  );
  assert.equal(
    placementError(world, 'roof', { x: 0, z: 0 }, 'upper-roof'),
    null,
  );
});
