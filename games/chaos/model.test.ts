import {
  craneDuration,
  cranePose,
  parkedCranePose,
  craneReach,
  craneBase,
} from './crane';
import { mapBounds, mapConfig } from './maps';
import { surfaceHeight, findPath } from './colliders';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  freshWorld,
  jobProgress,
  placementError,
  tickWorld,
  type Player,
  type World,
} from './model';

const now = 100000;
const host: Player = {
  id: 'host',
  name: 'Meister',
  color: 0,
  x: 0,
  z: 2,
  angle: Math.PI / 2,
  seen: now,
};
const guest: Player = {
  id: 'guest',
  name: 'Azubi',
  color: 1,
  x: 4,
  z: 0,
  angle: 0,
  seen: now,
};
function empty(): World {
  const w = freshWorld('sandbox', now);
  w.pieces = [];
  return w;
}
void test('a placed wall increments count; an overlapping rotated wall is rejected', () => {
  const w = empty();
  applyAction(
    w,
    { type: 'build', kind: 'wall', x: 0, z: 0, rotation: 0 },
    host,
    [host],
    'host',
    now,
  );
  assert.equal(w.builds, 1);
  assert.equal(jobProgress(w).counts.wall, 1);
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'wall', x: 0, z: 0, rotation: 2 },
        host,
        [host],
        'host',
        now,
      ),
    /room|space/,
  );
});
void test('floors, furniture and a roof occupy distinct vertical layers', () => {
  const w = empty();
  for (const kind of ['floor', 'wall'] as const)
    applyAction(
      w,
      { type: 'build', kind, x: 0, z: 0, rotation: 0 },
      host,
      [host],
      'host',
      now,
    );
  assert.equal(placementError(w, 'roof', { x: 0, z: 0 }), null);
  w.pieces.push({
    id: 'roof-layer',
    kind: 'roof',
    x: 0,
    z: 0,
    rotation: 0,
    placed: true,
  });
  applyAction(
    w,
    { type: 'build', kind: 'chair', x: 2, z: 1, rotation: 0 },
    host,
    [host],
    'host',
    now,
  );
  assert.match(placementError(w, 'chair', { x: 0, z: 0 })!, /overlap/);
  assert.equal(w.pieces.length, 4);
});
void test('roof needs support and placement stays within board', () => {
  const w = empty();
  assert.match(placementError(w, 'roof', { x: 0, z: 0 })!, /wall/);
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'chair', x: 30, z: 0, rotation: 0 },
        host,
        [host],
        'host',
        now,
      ),
    /within/,
  );
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'chair', x: NaN, z: 0, rotation: 0 },
        host,
        [host],
        'host',
        now,
      ),
    /building plan/,
  );
});
void test('world object count is capped', () => {
  const w = empty();
  w.pieces = Array.from({ length: 160 }, (_, i) => ({
    id: String(i),
    kind: 'chair',
    x: 0,
    z: 0,
    rotation: 0,
    placed: false,
  }));
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'wall', x: 1, z: 1, rotation: 0 },
        host,
        [host],
        'host',
        now,
      ),
    /full/,
  );
});
void test('only one player can grab a piece and distant grabs fail', () => {
  const w = empty();
  w.pieces.push({
    id: 'sofa',
    kind: 'sofa',
    x: 0,
    z: 0,
    rotation: 0,
    placed: false,
  });
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'grab', id: 'sofa' },
        guest,
        [host, guest],
        'host',
        now,
      ),
    /closer/,
  );
  applyAction(
    w,
    { type: 'grab', id: 'sofa' },
    host,
    [host, guest],
    'host',
    now,
  );
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'grab', id: 'sofa' },
        { ...guest, x: 0 },
        [host, guest],
        'host',
        now,
      ),
    /closer/,
  );
});
void test('invalid drop preserves ownership and location', () => {
  const w = empty();
  w.pieces.push(
    {
      id: 'held',
      kind: 'sofa',
      x: 0,
      z: 0,
      rotation: 0,
      placed: false,
      heldBy: 'host',
    },
    { id: 'other', kind: 'sofa', x: 2, z: 0, rotation: 0, placed: true },
  );
  assert.throws(
    () =>
      applyAction(w, { type: 'drop' }, { ...host, z: 0 }, [host], 'host', now),
    /room|space/,
  );
  assert.equal(w.pieces[0].heldBy, 'host');
  assert.equal(w.pieces[0].x, 0);
});
void test('throw releases a rigid body and prevents pickup while it is moving fast', () => {
  const w = empty();
  w.pieces.push({
    id: 'held',
    kind: 'sofa',
    x: 0,
    z: 0,
    rotation: 0,
    placed: false,
    heldBy: 'host',
  });
  applyAction(w, { type: 'throw' }, host, [host, guest], 'host', now);
  assert.equal(w.throws, 1);
  assert.equal(w.bonks, 0);
  assert.ok(w.pieces[0].physics);
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'grab', id: 'held' },
        { ...guest, x: 1, z: 2 },
        [host, guest],
        'host',
        now + 1,
      ),
    /flying/,
  );
  w.pieces[0].physics!.v = [0, 0, 0];
  applyAction(
    w,
    { type: 'grab', id: 'held' },
    { ...guest, x: 1, z: 2 },
    [host, guest],
    'host',
    now + 851,
  );
  assert.equal(w.pieces[0].heldBy, 'guest');
});
void test('only host can reset and rounds rotate', () => {
  const w = empty();
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'reset', mode: 'job' },
        guest,
        [host, guest],
        'host',
        now,
      ),
    /site manager/,
  );
  const next = applyAction(
    w,
    { type: 'reset', mode: 'job' },
    host,
    [host, guest],
    'host',
    now,
  );
  assert.equal(next.round, 1);
  assert.equal(next.mode, 'job');
});
void test('expired jobs reject building', () => {
  const w = freshWorld('job', now);
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'chair', x: 0, z: 0, rotation: 0 },
        host,
        [host],
        'host',
        now + 240000,
      ),
    /clock off/,
  );
});
void test('scoring follows foundation bounds and ignores loose pieces', () => {
  const w = empty();
  w.pieces = [
    { id: 'a', kind: 'chair', x: 0, z: -5, rotation: 0, placed: true },
    { id: 'b', kind: 'chair', x: 0, z: 5, rotation: 0, placed: true },
    { id: 'c', kind: 'chair', x: 1, z: 0, rotation: 0, placed: false },
  ];
  assert.equal(jobProgress(w).counts.chair, 1);
});
void test('wind moves loose items once and leaves built or carried items safe', () => {
  const w = empty();
  w.pieces = [
    { id: 'a', kind: 'chair', x: 0, z: 0, rotation: 0, placed: false },
    { id: 'b', kind: 'chair', x: 2, z: 0, rotation: 0, placed: true },
  ];
  tickWorld(w, [host], now + 55001);
  assert.ok(w.pieces[0].physics!.v[0] > 3);
  assert.equal(w.pieces[1].x, 2);
  assert.equal(w.events.length, 1);
  tickWorld(w, [host], now + 55002);
  assert.equal(w.events.length, 1);
});
void test('disconnected held objects are released at the last known carrying position', () => {
  const w = empty();
  w.pieces = [
    {
      id: 'a',
      kind: 'chair',
      x: 7,
      z: 7,
      rotation: 0,
      placed: false,
      heldBy: 'host',
    },
  ];
  tickWorld(w, [host], now);
  assert.equal(w.pieces[0].x, 0);
  tickWorld(w, [], now + 1);
  assert.equal(w.pieces[0].heldBy, undefined);
  assert.equal(w.pieces[0].x, 0);
});

void test('roof modules are lifted, shared exclusively, snapped and installed without ground reach', () => {
  const w = freshWorld('sandbox', now);
  const source = w.pieces.find((p) => p.supply)!;
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'roof', x: -3, z: -3, rotation: 0 },
        host,
        [host],
        'host',
        now,
      ),
    /crane/,
  );
  applyAction(
    w,
    { type: 'crane-pick', id: source.id },
    host,
    [host, guest],
    'host',
    now,
  );
  const cargoId = w.crane!.pieceId;
  assert.notEqual(cargoId, source.id);
  assert.ok(w.pieces.find((p) => p.id === cargoId)?.hoisted);
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'crane-pick', id: source.id },
        guest,
        [host, guest],
        'host',
        now,
      ),
    /in use/,
  );
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'crane-place', x: -3, z: -3, rotation: 0 },
        host,
        [host],
        'host',
        now,
      ),
    /Wait/,
  );
  tickWorld(w, [host, guest], now + 10000);
  applyAction(
    w,
    { type: 'crane-place', x: -3, z: -3, rotation: 1 },
    host,
    [host, guest],
    'host',
    now + 10000,
  );
  assert.equal(w.crane!.phase, 'placing');
  assert.equal(jobProgress(w).counts.roof, undefined);
  tickWorld(w, [host, guest], now + 20000);
  assert.equal(w.crane, undefined);
  assert.equal(jobProgress(w).counts.roof, 1);
  const cargo = w.pieces.find((p) => p.id === cargoId)!;
  assert.deepEqual(
    [cargo.x, cargo.z, cargo.rotation, cargo.placed, cargo.hoisted],
    [-3, -3, 1, true, undefined],
  );
  assert.equal(w.pieces.filter((p) => p.supply).length, 2);
});

void test('invalid crane destinations preserve the load; cancellation and disconnect return it', () => {
  const w = freshWorld('sandbox', now),
    source = w.pieces.find((p) => p.supply)!;
  const count = w.pieces.length;
  applyAction(
    w,
    { type: 'crane-pick', id: source.id },
    host,
    [host],
    'host',
    now,
  );
  tickWorld(w, [host], now + 10000);
  for (const pos of [
    { x: NaN, z: 0 },
    { x: 100, z: 0 },
    { x: 4, z: 4 },
  ])
    assert.throws(() =>
      applyAction(
        w,
        { type: 'crane-place', ...pos, rotation: 0 },
        host,
        [host],
        'host',
        now + 10000,
      ),
    );
  assert.equal(w.crane!.phase, 'ready');
  applyAction(w, { type: 'crane-cancel' }, host, [host], 'host', now + 10001);
  assert.equal(w.pieces.length, count);
  const roof = {
    id: 'installed-roof',
    kind: 'roof' as const,
    x: -3,
    z: -3,
    rotation: 1,
    placed: true,
  };
  w.pieces.push(roof);
  const original = structuredClone(roof);
  applyAction(
    w,
    { type: 'crane-pick', id: roof.id },
    host,
    [host],
    'host',
    now + 11000,
  );
  assert.match(placementError(w, 'roof', original)!, /overlap/); // The old socket stays reserved until completion.
  tickWorld(w, [], now + 12000);
  assert.equal(w.crane, undefined);
  assert.deepEqual(
    w.pieces.find((p) => p.id === roof.id),
    original,
  );
});

void test('a second builder cannot steal a suspended roof, and changed supports prevent final installation', () => {
  const w = freshWorld('sandbox', now),
    source = w.pieces.find((p) => p.supply)!;
  applyAction(
    w,
    { type: 'crane-pick', id: source.id },
    host,
    [host, guest],
    'host',
    now,
  );
  const id = w.crane!.pieceId;
  assert.throws(
    () =>
      applyAction(w, { type: 'grab', id }, guest, [host, guest], 'host', now),
    /crane/,
  );
  assert.throws(
    () =>
      applyAction(w, { type: 'remove', id }, guest, [host, guest], 'host', now),
    /cannot be removed/,
  );
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'crane-cancel' },
        guest,
        [host, guest],
        'host',
        now,
      ),
    /in use/,
  );
  tickWorld(w, [host], now + 10000);
  applyAction(
    w,
    { type: 'crane-place', x: -3, z: -3, rotation: 0 },
    host,
    [host],
    'host',
    now + 10000,
  );
  w.pieces = w.pieces.filter(
    (p) => !['wall', 'window', 'door'].includes(p.kind),
  );
  tickWorld(w, [host], now + 20000);
  assert.equal(w.crane!.phase, 'pickup');
  assert.match(w.crane!.error!, /wall/);
  assert.equal(w.pieces.find((p) => p.id === id)!.placed, false);
});

void test('saved sites gain roof stock once; stock and suspended loads survive wind without physics', () => {
  const w = freshWorld('sandbox', now);
  w.pieces = w.pieces.filter((p) => !p.supply);
  delete w.roofSupplyVersion;
  tickWorld(w, [host], now);
  tickWorld(w, [host], now + 1);
  assert.equal(w.pieces.filter((p) => p.supply).length, 2);
  applyAction(
    w,
    { type: 'crane-pick', id: w.pieces.find((p) => p.supply)!.id },
    host,
    [host],
    'host',
    now + 54000,
  );
  tickWorld(w, [host], now + 55001);
  for (const p of w.pieces.filter((p) => p.supply || p.hoisted))
    assert.equal(p.physics, undefined);
});

void test('Medium doubles area, preserves building dimensions and survives reset and old saves', () => {
  const small = mapBounds('small'),
    medium = mapBounds('medium');
  assert.ok(
    Math.abs(
      (medium.buildX * medium.buildZ) / (small.buildX * small.buildZ) - 2,
    ) < 1e-12,
  );
  const world = freshWorld('sandbox', now, 0, 'medium');
  world.pieces = [];
  assert.equal(placementError(world, 'wall', { x: 10, z: 0 }), null);
  assert.match(
    placementError({ ...world, map: 'small' }, 'wall', { x: 10, z: 0 })!,
    /within/,
  );
  assert.equal(surfaceHeight({ x: 6, z: 0 }, 'medium'), 0.43);
  assert.equal(surfaceHeight({ x: 6, z: 0 }, 'small'), 0.18);
  assert.ok(findPath(world, { x: 9, z: 0 }, { x: 13, z: 0 }));
  world.pieces.push({
    id: 'extension-wall',
    kind: 'wall',
    x: 6,
    z: 0,
    rotation: 0,
    placed: true,
  });
  assert.equal(jobProgress(world).counts.wall, 1);
  assert.equal(
    applyAction(
      world,
      { type: 'reset', mode: 'job' },
      host,
      [host],
      host.id,
      now,
    ).map,
    'medium',
  );
  assert.equal(mapConfig(undefined).id, 'small');
  delete world.map;
  assert.match(placementError(world, 'wall', { x: 10, z: 0 })!, /within/);
  for (const x of [-4.5, 4.5])
    for (const z of [-5, 4])
      assert.equal(
        craneReach({ x: x * Math.SQRT2, z: z * Math.SQRT2 }, 'medium'),
        true,
      );
});

void test('roof support must intersect the roof footprint on the same elevation', () => {
  const w = empty();
  w.pieces.push({
    id: 'wall',
    kind: 'wall',
    x: 0,
    z: 0,
    rotation: 0,
    placed: true,
  });
  assert.match(placementError(w, 'roof', { x: 0, z: 2 })!, /wall/);
  assert.equal(placementError(w, 'roof', { x: 0, z: 1 }), null);
  w.pieces[0].x = 4;
  assert.match(placementError(w, 'roof', { x: 5, z: 0 })!, /wall/);
});

void test('Large doubles Medium area and supports bigger houses, travel, crane reach and resets', () => {
  const medium = mapBounds('medium'),
    large = mapBounds('large');
  assert.ok(
    Math.abs(
      (large.buildX * large.buildZ) / (medium.buildX * medium.buildZ) - 2,
    ) < 1e-12,
  );
  assert.equal(mapConfig('large').name, 'Large');
  const world = freshWorld('sandbox', now, 0, 'large');
  world.pieces = [];
  assert.equal(placementError(world, 'wall', { x: 14, z: 0 }), null);
  assert.match(
    placementError({ ...world, map: 'medium' }, 'wall', { x: 14, z: 0 })!,
    /within/,
  );
  assert.equal(surfaceHeight({ x: 8, z: 0 }, 'large'), 0.43);
  assert.equal(surfaceHeight({ x: 8, z: 0 }, 'medium'), 0.18);
  assert.equal(placementError(world, 'stairs', { x: 8, z: 0 }), null);
  assert.match(
    placementError({ ...world, map: 'medium' }, 'stairs', { x: 8, z: 0 })!,
    /foundation/,
  );
  assert.ok(findPath(world, { x: 16, z: 0 }, { x: 20, z: 0 }));
  world.pieces.push({
    id: 'large-wall',
    kind: 'wall',
    x: 8,
    z: 0,
    rotation: 0,
    placed: true,
  });
  assert.equal(jobProgress(world).counts.wall, 1);
  for (const x of [-9, 9])
    for (const z of [-10, 8]) assert.equal(craneReach({ x, z }, 'large'), true);
  assert.equal(
    applyAction(
      world,
      { type: 'reset', mode: 'job' },
      host,
      [host],
      host.id,
      now,
    ).map,
    'large',
  );
});

void test('crane moves continuously with bounded speed, and parks at the completed roof', () => {
  const w = freshWorld('sandbox', now),
    source = w.pieces.find((p) => p.supply)!;
  applyAction(
    w,
    { type: 'crane-pick', id: source.id },
    host,
    [host],
    host.id,
    now,
  );
  const pickup = structuredClone(w.crane!),
    readyAt = now + craneDuration(pickup);
  const first = cranePose(pickup, now),
    parked = parkedCranePose(w, now);
  assert.deepEqual(
    [first.hookX, first.hookZ, first.hookY],
    [parked.x, parked.z, parked.hookY],
  );
  const sample = (crane: typeof pickup) => {
    let previous = cranePose(crane, crane.at);
    for (let t = crane.at + 10; t <= crane.at + craneDuration(crane); t += 10) {
      const next = cranePose(crane, t);
      assert.ok(
        Math.hypot(next.hookX - previous.hookX, next.hookZ - previous.hookZ) /
          0.01 <=
          4.01,
      );
      assert.ok(Math.abs(next.hookY - previous.hookY) / 0.01 <= 3.01);
      const base = craneBase(crane.map);
      const before = Math.atan2(
          previous.hookZ - base.z,
          previous.hookX - base.x,
        ),
        after = Math.atan2(next.hookZ - base.z, next.hookX - base.x);
      assert.ok(
        Math.abs(
          Math.atan2(Math.sin(after - before), Math.cos(after - before)),
        ) /
          0.01 <=
          0.651,
      );
      previous = next;
    }
  };
  sample(pickup);
  tickWorld(w, [host], readyAt);
  applyAction(
    w,
    { type: 'crane-place', x: -3, z: -3, rotation: 1 },
    host,
    [host],
    host.id,
    readyAt,
  );
  const placing = structuredClone(w.crane!),
    endAt = readyAt + craneDuration(placing);
  sample(placing);
  const start = cranePose(placing, readyAt),
    almost = cranePose(placing, readyAt + 10),
    end = cranePose(placing, endAt);
  assert.ok(Math.hypot(start.x - almost.x, start.z - almost.z) < 0.002);
  assert.equal(start.rotation, (source.rotation * Math.PI) / 2);
  assert.equal(end.rotation, Math.PI / 2);
  tickWorld(w, [host], endAt);
  const rest = parkedCranePose(w, endAt);
  assert.deepEqual(
    [rest.x, rest.z, rest.hookY],
    [end.hookX, end.hookZ, end.hookY],
  );
  const nextRest = parkedCranePose(w, endAt + 10);
  assert.ok(Math.abs(nextRest.hookY - rest.hookY) < 0.001);
});
