import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, freshWorld, type Piece, type Player } from './model';
import { actorLevel, pieceBase, stairHeight, woodenSurface } from './levels';
import { structureError, removalSupportError } from './structure';
import { buildReach, findPath, inReach } from './colliders';
import { placementError } from './placement';
import { SitePhysics } from './physics';
import { buildSnapshot, restoreBuild } from './build-snapshot';
import { craneAction, craneDuration, tickCrane } from './crane';
const part = (
  id: string,
  kind: Piece['kind'],
  x: number,
  z: number,
  level = 0,
  rotation = 0,
): Piece => ({ id, kind, x, z, level, rotation, placed: true });
const player = (x = -2, z = 3, y = 0.43): Player => ({
  id: 'p',
  name: 'Builder',
  color: 0,
  x,
  z,
  y,
  angle: Math.PI,
  seen: 1000,
});
function house() {
  const w = freshWorld('sandbox', 1000);
  w.pieces = [
    part('stairs1', 'stairs', -2, 0),
    ...[-2, 0, 2].map((x) => part(`landing${x}`, 'floor', x, -3, 1)),
    part('hall1', 'floor', 2, -1, 1),
    part('hall2', 'floor', 2, 1, 1),
    part('hall3', 'floor', 2, 3, 1),
    ...[-1, 1, 3].map((z) => part(`corridor${z}`, 'floor', 0, z, 1)),
    part('stairs2', 'stairs', 2, 0, 1),
    part('top', 'floor', 2, -3, 2),
  ];
  return w;
}
void test('three floors require support, preserve stairwells, and reject a fourth floor', () => {
  const w = house();
  for (const p of w.pieces)
    assert.equal(structureError(w, p.kind, p, p.rotation, p.id), null, p.id);
  assert.match(
    placementError(w, 'floor', { x: -2, z: 0, level: 1 }, undefined, 0)!,
    /stairwell/,
  );
  assert.match(
    placementError(w, 'wall', { x: 0, z: 0, level: 2 }, undefined, 0)!,
    /floor tiles/,
  );
  assert.match(
    placementError(w, 'floor', { x: 0, z: 0, level: 3 }, undefined, 0)!,
    /Floor 1, 2 or 3/,
  );
  assert.match(
    placementError(w, 'stairs', { x: 2, z: 0, level: 2 }, undefined, 0)!,
    /top floor/,
  );
  assert.equal(
    placementError(w, 'chair', { x: 2, z: -3, level: 2 }, undefined, 0),
    null,
  );
});
void test('removing or grabbing a support is rejected and players cannot lose the tile underfoot', () => {
  const w = house(),
    p = player();
  assert.match(removalSupportError(w, w.pieces[0])!, /supports/);
  assert.throws(
    () => applyAction(w, { type: 'grab', id: 'stairs1' }, p, [p], p.id, 1100),
    /supports/,
  );
  assert.match(
    removalSupportError(w, w.pieces.at(-1)!, [player(2, -3, 6.43)])!,
    /standing/,
  );
});
void test('floor slabs can be fitted from below; upper furniture cannot be built or grabbed from ground', () => {
  const w = house(),
    p = player(-2, -3);
  assert.equal(buildReach(w, p, { x: -2, z: -3, level: 1 }, 'floor'), true);
  assert.equal(inReach(w, p, { x: -2, z: -3, level: 1 }), false);
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'chair', x: 2, z: -3, level: 2, rotation: 0 },
        player(2, -3),
        [],
        p.id,
      ),
    /within reach/,
  );
  applyAction(
    w,
    { type: 'build', kind: 'chair', x: 2, z: -3, level: 2, rotation: 0 },
    player(2, -1.5, 6.43),
    [],
    p.id,
  );
  assert.equal(w.pieces.at(-1)!.level, 2);
});
void test('overhead floor reach includes intermediate stair heights and keeps distance and obstacle limits', () => {
  const w = freshWorld('sandbox', 1000);
  w.pieces = [part('support', 'wall', 2, -1)];
  const target = { x: 2, z: 0, level: 1 };
  for (const y of [0.43, 0.93, 1.43, 1.93, 2.43, 2.93, 3.43]) {
    const p = player(0, 0, y);
    assert.equal(buildReach(w, p, target, 'floor'), true, `height ${y}`);
  }
  assert.equal(buildReach(w, player(-1, 0), target, 'floor'), false);
  assert.equal(
    buildReach(w, player(2, 0), { ...target, level: 2 }, 'floor'),
    false,
  );
  assert.equal(buildReach(w, player(2, 0), target, 'chair'), false);
  assert.equal(inReach(w, player(2, 0), target), false);
  w.pieces.push(part('obstacle', 'wall', 1, 0, 0, 1));
  assert.equal(buildReach(w, player(0, 0), target, 'floor'), false);
});
void test('the build action accepts an overhead slab from halfway up the stairs', () => {
  const w = freshWorld('sandbox', 1000),
    p = player(0, 0, 1.93);
  w.pieces = [part('stairs', 'stairs', 0, 0), part('support', 'wall', 2, -1)];
  applyAction(
    w,
    { type: 'build', kind: 'floor', x: 2, z: 0, level: 1, rotation: 0 },
    p,
    [p],
    p.id,
    1100,
  );
  assert.equal(w.pieces.at(-1)!.kind, 'floor');
  assert.equal(w.pieces.at(-1)!.level, 1);
});
void test('pathfinding follows both staircases to Floor 3 without walking through the stair bodies', () => {
  const w = house(),
    path = findPath(w, player(), { x: 2, z: -3, level: 2 }, 0.55);
  assert.ok(path, 'route to third floor');
  assert.ok(path.some((p) => (p.y ?? 0) > 6));
  assert.ok(path.some((p) => (p.y ?? 0) > 1 && (p.y ?? 0) < 3));
  for (let i = 1; i < path.length; i++)
    assert.ok(Math.abs(path[i].y! - path[i - 1].y!) <= 0.55);
});
void test('physics climbs stairs onto an upper slab and descends without jumping', () => {
  const w = house(),
    p = player();
  const physics = new SitePhysics();
  physics.sync(w.pieces, [p], p.id);
  for (let i = 0; i < 40; i++) physics.step(1 / 60);
  let peak = 0;
  for (let i = 0; i < 150; i++) {
    physics.move(p.id, 0, -2.5);
    physics.step(1 / 60);
    peak = Math.max(peak, physics.playerPosition(p.id)!.y);
  }
  const top = physics.playerPosition(p.id)!;
  assert.ok(peak > 3.3, JSON.stringify(top));
  assert.ok(top.z < -2, JSON.stringify(top));
  for (let i = 0; i < 150; i++) {
    physics.move(p.id, 0, 2.5);
    physics.step(1 / 60);
  }
  const bottom = physics.playerPosition(p.id)!;
  assert.ok(bottom.y < 0.8, JSON.stringify(bottom));
});
void test('upper slabs hold actors, and an upper wall does not block ground-level walking', () => {
  const w = house(),
    p = player(2, -3, 6.43);
  w.pieces.push(part('upperWall', 'wall', 2, -3, 2));
  assert.ok(findPath(w, player(2, -2), { x: 2, z: -4 }, 0.5));
  w.pieces.pop();
  const physics = new SitePhysics();
  physics.sync(w.pieces, [p], p.id);
  for (let i = 0; i < 180; i++) physics.step(1 / 60);
  assert.ok(Math.abs(physics.playerPosition(p.id)!.y - 6.43) < 0.08);
  assert.equal(actorLevel(physics.playerPosition(p.id)!), 2);
  assert.ok(Math.abs(pieceBase(w.pieces.at(-1)!) - 6.155) < 1e-8);
  assert.equal(woodenSurface(w, physics.playerPosition(p.id)!), true);
});
void test('saved builds and remixes preserve every floor and staircase', () => {
  const w = house(),
    saved = buildSnapshot(w),
    copy = freshWorld('sandbox');
  restoreBuild(copy, saved, 'house', 'remix');
  assert.deepEqual(
    copy.pieces.filter((p) => !p.supply).map((p) => p.level ?? 0),
    w.pieces.map((p) => p.level ?? 0),
  );
  assert.equal(copy.pieces.filter((p) => p.kind === 'stairs').length, 2);
});
void test('crane can fit a roof above the third floor at the correct height', () => {
  const w = house(),
    p = player();
  w.pieces.push(part('topWall', 'wall', 2, -3, 2), {
    ...part('stock', 'roof', 3, -5),
    placed: false,
    supply: true,
  });
  craneAction(w, { type: 'crane-pick', id: 'stock' }, p, 1000);
  let now = 1000 + craneDuration(w.crane!);
  tickCrane(w, [p], now);
  craneAction(
    w,
    { type: 'crane-place', x: 2, z: -3, level: 2, rotation: 0 },
    p,
    now,
  );
  now += craneDuration(w.crane!);
  tickCrane(w, [p], now);
  const roof = w.pieces.find((p) => p.kind === 'roof' && !p.supply)!;
  assert.equal(roof.level, 2);
  assert.equal(pieceBase(roof), 6.43);
});
void test('all stair orientations have a lower entrance and an upper exit', () => {
  for (let r = 0; r < 4; r++) {
    const p = part('s', 'stairs', 0, 0, 0, r),
      a = (r * Math.PI) / 2;
    assert.ok(
      stairHeight(p, { x: 1.9 * Math.sin(a), z: 1.9 * Math.cos(a) })! < 0.8,
    );
    assert.ok(
      stairHeight(p, { x: -1.9 * Math.sin(a), z: -1.9 * Math.cos(a) })! > 3.3,
    );
  }
});
void test('the real physics controller follows a route up both staircases and back down', () => {
  const w = house(),
    p = player(),
    physics = new SitePhysics();
  physics.sync(w.pieces, [p], p.id);
  for (let i = 0; i < 30; i++) physics.step(1 / 60);
  for (const target of [
    { x: 2, z: -3, level: 2 },
    { x: -2, z: 3, level: 0 },
  ]) {
    const route = findPath(w, physics.playerPosition(p.id)!, target, 0.3)!;
    assert.ok(route);
    for (let i = 0; i < 1800 && route.length; i++) {
      const pos = physics.playerPosition(p.id)!;
      while (
        route[0] &&
        Math.hypot(route[0].x - pos.x, route[0].z - pos.z) < 0.2 &&
        Math.abs(route[0].y! - pos.y) < 0.55
      )
        route.shift();
      if (!route[0]) break;
      const dx = route[0].x - pos.x,
        dz = route[0].z - pos.z,
        length = Math.hypot(dx, dz);
      physics.move(p.id, (dx / length) * 3, (dz / length) * 3);
      physics.step(1 / 60);
    }
    const reached = physics.playerPosition(p.id)!;
    assert.equal(
      route.length,
      0,
      JSON.stringify({ target, reached, next: route[0] }),
    );
    assert.equal(actorLevel(reached), target.level);
  }
});
