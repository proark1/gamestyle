import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  createPlayer,
  freshWorld,
  movePlayer,
  placement,
  tick,
} from './simulation';
import { landingHeight, poseError, topOf } from './physics';
import { FLOOR, SCENERY } from './geometry';
import { ITEMS, type Kind, type Piece, type World } from './types';
const NOW = 100000;
const piece = (
  id: string,
  kind: Kind = 'crate',
  x = 0,
  y = FLOOR,
  z = 0,
): Piece => ({ id, kind, x, y, z, rotation: 0, vy: 0, tilt: 0, unstable: 0 });
function world() {
  const w = freshWorld(NOW, 'practice');
  w.pieces = [];
  w.players = [createPlayer('a', 'Ada', 0, 0, NOW)];
  return w;
}
function run(w: World, seconds: number) {
  for (let i = 0; i < seconds * 10; i++) tick(w, w.clock + 100);
}

void test('all initial salvage and players start clear of the real scenery', () => {
  for (const seed of [1, 2, 7]) {
    const w = freshWorld(NOW, 'practice', seed);
    for (const p of w.pieces) assert.equal(poseError(w, p), null, p.id);
    assert.equal(w.pieces.length, 28);
  }
});
void test('shed walls stop walking from all four sides and from a diagonal', () => {
  for (const [x, z, dx, dz] of [
    [-7, -3, 0, -1],
    [-7, -9.4, 0, 1],
    [-9.5, -7, 1, 0],
    [-3.5, -7, -1, 0],
    [-4, -4, -1, -1],
  ]) {
    const w = world(),
      p = w.players[0];
    Object.assign(p, { x, z });
    for (let i = 0; i < 180; i++)
      movePlayer(w, p, 1 / 60, { x: dx, z: dz, jump: false, seq: 0 });
    assert.ok(
      !(p.x > -9.25 && p.x < -4.75 && p.z > -8.7 && p.z < -5.3),
      JSON.stringify({ x: p.x, z: p.z }),
    );
  }
});
void test('the shed roof supports falling players and blocks their heads from below', () => {
  const w = world(),
    p = w.players[0];
  Object.assign(p, { x: -7, z: -7, y: 4, grounded: false });
  for (let i = 0; i < 120; i++)
    movePlayer(w, p, 1 / 60, { x: 0, z: 0, jump: false, seq: 0 });
  assert.ok(Math.abs(p.y - 2.83) < 0.025);
  const under = world(),
    q = under.players[0];
  Object.assign(q, { x: 0, z: 0 });
  under.pieces = [piece('ceiling', 'plank', 0, 2.25, 0)];
  let peak = 0;
  for (let i = 0; i < 80; i++) {
    movePlayer(under, q, 1 / 60, { x: 0, z: 0, jump: true, seq: 1 });
    peak = Math.max(peak, q.y);
  }
  assert.ok(peak < 0.4, 'head must collide with overhead plank');
});
void test('ghost pose is committed exactly, including selected piece and rotation', () => {
  const w = world(),
    p = w.players[0];
  Object.assign(p, { x: 0, z: 3 });
  const base = piece('base'),
    held = piece('held', 'plank', 0, 2.23, 3);
  held.heldBy = p.id;
  held.rotation = 1;
  held.revision = 4;
  w.pieces = [base, held];
  const spot = placement(w, p, held, 0, 0);
  assert.equal(spot.error, null);
  assert.ok(Math.abs(spot.y - 1.43) < 0.001);
  act(
    w,
    p.id,
    {
      type: 'place',
      target: held.id,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotation: 1,
      revision: 4,
    },
    p.id,
  );
  assert.deepEqual(
    { x: held.x, y: held.y, z: held.z },
    { x: spot.x, y: spot.y, z: spot.z },
  );
  assert.equal(held.rotation, 1);
  assert.equal(held.heldBy, undefined);
});
void test('a newly obstructed preview is rejected instead of moved on top of the obstruction', () => {
  const w = world(),
    p = w.players[0];
  Object.assign(p, { x: 0, z: 3 });
  const held = piece('held');
  held.heldBy = p.id;
  w.pieces = [held];
  const spot = placement(w, p, held, 0, 0);
  w.pieces.push(piece('new obstacle'));
  assert.throws(
    () => act(w, p.id, { type: 'place', target: held.id, ...spot }, p.id),
    /way/,
  );
  assert.equal(held.heldBy, p.id);
});
void test('a queued preview for another item or an old rotation cannot place the current load', () => {
  const w = world(),
    p = w.players[0];
  Object.assign(p, { x: 0, z: 3 });
  const held = piece('held', 'plank', 0, 2.23, 3);
  held.heldBy = p.id;
  held.revision = 3;
  w.pieces = [held];
  assert.throws(
    () =>
      act(
        w,
        p.id,
        { type: 'place', target: 'different', x: 0, y: FLOOR, z: 0 },
        p.id,
      ),
    /changed/,
  );
  assert.throws(
    () =>
      act(
        w,
        p.id,
        { type: 'place', target: held.id, x: 0, y: FLOOR, z: 0, revision: 2 },
        p.id,
      ),
    /changed/,
  );
  assert.throws(
    () =>
      act(
        w,
        p.id,
        { type: 'place', target: held.id, x: 0, y: FLOOR, z: 0, rotation: 1 },
        p.id,
      ),
    /rotated/,
  );
});
void test('every salvage kind can be placed on a crate and settles at its visible support', () => {
  for (const kind of Object.keys(ITEMS) as Kind[]) {
    const w = world();
    w.players = [];
    const base = piece('base'),
      load = piece('load', kind);
    w.pieces = [base];
    load.y = landingHeight(w, load, 0, 0, 3);
    const previewY = load.y;
    w.pieces.push(load);
    assert.equal(poseError(w, load), null, kind);
    run(w, 2);
    assert.ok(
      Math.abs(load.y - previewY) < 0.035,
      `${kind}: preview ${previewY}, settled ${load.y}`,
    );
    assert.ok(topOf(load) > 1.6, kind);
  }
});
void test('a long settled stack falls when its support disappears after serialization', () => {
  let w = world();
  w.players = [];
  w.pieces = [
    piece('base'),
    piece('middle', 'crate', 0, 1.43),
    piece('top', 'crate', 0, 2.73),
  ];
  run(w, 3);
  w = JSON.parse(JSON.stringify(w));
  w.pieces.shift();
  run(w, 2);
  assert.ok(w.pieces[0].y < 0.18);
  assert.ok(w.pieces[1].y < 1.48);
});
void test('falling salvage collides with the shed instead of entering it', () => {
  const w = world();
  w.players = [];
  const load = piece('roof load', 'crate', -7, 6, -7);
  w.pieces = [load];
  run(w, 3);
  assert.ok(Math.abs(load.y - 2.83) < 0.03);
});
void test('a falling load hits the player instead of passing through the body', () => {
  const w = world(),
    p = w.players[0];
  Object.assign(p, { x: 0, z: 0 });
  w.pieces = [piece('falling', 'crate', 0, 5, 0)];
  run(w, 1);
  assert.ok(w.pieces[0].y > 1.8);
  assert.ok(p.y > FLOOR - 0.1);
});
void test('crane sweeping cannot cut through the shed', () => {
  const w = world(),
    load = piece('load', 'plank', -3, 3, -7);
  w.pieces = [load];
  w.bestHeight = 5;
  act(w, 'a', { type: 'crane', target: load.id }, 'a');
  act(w, 'a', { type: 'crane-move', x: 0, y: -1, z: 0 }, 'a');
  const before = { ...w.crane };
  assert.throws(
    () => act(w, 'a', { type: 'crane-move', x: -1, y: 0, z: 0 }, 'a'),
    /blocked/,
  );
  assert.deepEqual(w.crane, before);
});
void test('rotating a carried plank cannot intersect another object', () => {
  const w = world(),
    p = w.players[0];
  Object.assign(p, { x: 0, z: 0 });
  const load = piece('load', 'plank', 0, 2.23, 0);
  load.heldBy = p.id;
  w.pieces = [load, piece('obstacle', 'crate', 0, 2.23, 1.9)];
  assert.throws(() => act(w, p.id, { type: 'rotate' }, p.id), /clear/);
  assert.equal(load.rotation, 0);
});
void test('fixed-step simulation is independent of how HTTP ticks are split', () => {
  const a = world();
  a.players = [];
  a.pieces = [piece('falling', 'crate', 0, 5, 0)];
  const b = structuredClone(a);
  tick(a, NOW + 1000);
  for (let i = 1; i <= 40; i++) tick(b, NOW + i * 25);
  for (const key of ['x', 'y', 'z', 'vy'] as const)
    assert.ok(Math.abs(a.pieces[0][key] - b.pieces[0][key]) < 0.005, key);
});
void test('scenery uses one exact shed and roof definition', () => {
  assert.equal(SCENERY.filter((s) => s.id === 'shed').length, 1);
  assert.deepEqual(SCENERY.find((s) => s.id === 'shed')?.size, [3.9, 2.6, 2.8]);
});
void test('an eight-crate balanced tower remains settled for a minute of room snapshots', () => {
  const w = world();
  w.players = [];
  w.pieces = Array.from({ length: 8 }, (_, i) =>
    piece(String(i), 'crate', 4, FLOOR + i * 1.3, 1),
  );
  run(w, 60);
  assert.ok(Math.abs(w.pieces[7].y - 9.23) < 0.04);
  assert.ok(
    Math.max(...w.pieces.map((p) => Math.hypot(p.x - 4, p.z - 1))) < 0.08,
  );
  assert.ok(w.pieces.every((p) => p.sleeping));
});
