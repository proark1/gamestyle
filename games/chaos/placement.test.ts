import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, freshWorld, type Piece, type Player } from './model';
import {
  footprint,
  joinsAt,
  placementError,
  playerBlocksPlacement,
  snapPlacement,
} from './placement';

const wall = (rotation = 0): Piece => ({
  id: 'anchor',
  kind: 'wall',
  x: 0,
  z: 0,
  rotation,
  placed: true,
});
const world = (pieces: Piece[]) => ({ ...freshWorld('sandbox', 1000), pieces });

void test('wall modules snap end-to-end in every orientation and preserve exact endpoint joins', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const w = world([wall(rotation)]),
      odd = rotation % 2;
    const target = snapPlacement(
      w,
      'window',
      odd ? { x: 0.18, z: 2.2 } : { x: 2.2, z: 0.18 },
      rotation,
    );
    assert.deepEqual(
      { x: target.x, z: target.z },
      odd ? { x: 0, z: 2 } : { x: 2, z: 0 },
    );
    assert.equal(target.join, 'edge');
    assert.equal(
      placementError(w, 'window', target, undefined, rotation),
      null,
    );
    assert.equal(joinsAt(w, 'window', target).length, 1);
  }
});

void test('right-angle corners join while crosses, duplicate walls and overlapping parallel walls are rejected', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const w = world([wall(rotation)]),
      turn = (rotation + 1) % 4;
    const target = snapPlacement(w, 'door', { x: 1.15, z: 1.1 }, turn);
    assert.equal(target.x, 1);
    assert.equal(target.z, 1);
    assert.equal(target.join, 'corner');
    assert.equal(placementError(w, 'door', target, undefined, turn), null);
    assert.ok(placementError(w, 'wall', { x: 0, z: 0 }, undefined, turn));
    assert.ok(placementError(w, 'wall', { x: 0, z: 0 }, undefined, rotation));
    assert.ok(
      placementError(
        w,
        'wall',
        rotation % 2 ? { x: 0, z: 1 } : { x: 1, z: 0 },
        undefined,
        rotation,
      ),
    );
  }
});

void test('floor and roof modules meet on a two-unit spacing and keep support validation', () => {
  for (const kind of ['floor', 'roof'] as const) {
    const anchor: Piece = {
      id: 'tile',
      kind,
      x: 0,
      z: 0,
      rotation: 0,
      placed: true,
    };
    for (const [x, z] of [
      [2, 0],
      [0, 2],
      [-2, 0],
      [0, -2],
    ]) {
      const w = world([anchor, { ...wall(), x, z: z - 1 }]);
      const target = snapPlacement(w, kind, { x: x + 0.1, z: z + 0.1 });
      assert.equal(target.x, x);
      assert.equal(target.z, z);
      assert.equal(target.snapped, true);
      assert.equal(placementError(w, kind, target), null);
    }
  }
  assert.match(placementError(world([]), 'roof', { x: 0, z: 0 })!, /wall/);
});

void test('furniture clearance and worker clearance use the rotated footprint', () => {
  const w = world([
    { id: 'bench', kind: 'workbench', x: 0, z: 0, rotation: 0, placed: true },
  ]);
  assert.equal(
    placementError(w, 'table', { x: 0, z: 1.7 }, undefined, 0),
    null,
  );
  assert.ok(placementError(w, 'workbench', { x: 0, z: 1.7 }, undefined, 1));
  assert.equal(
    playerBlocksPlacement('wall', { x: 0, z: 0 }, 0, { x: 0, z: 1 }),
    false,
  );
  assert.equal(
    playerBlocksPlacement('wall', { x: 0, z: 0 }, 1, { x: 0, z: 1 }),
    true,
  );
  assert.equal(
    playerBlocksPlacement('floor', { x: 0, z: 0 }, 0, { x: 0, z: 0 }),
    false,
  );
  const roof = footprint('roof', { x: 0, z: 0 }, 0);
  assert.equal(roof.maxX - roof.minX, 2);
});

void test('the server places the exact preview position and still requires a nearby worker', () => {
  const w = world([wall()]),
    target = snapPlacement(w, 'window', { x: 2.19, z: 0.15 }, 0);
  const p: Player = {
    id: 'p',
    name: 'Meister',
    x: 2,
    z: 2,
    y: 0.43,
    angle: Math.PI,
    color: 0,
    seen: 1000,
  };
  applyAction(
    w,
    { type: 'build', kind: 'window', ...target },
    p,
    [p],
    p.id,
    1000,
  );
  assert.equal(w.pieces.at(-1)!.x, target.x);
  assert.equal(w.pieces.at(-1)!.z, target.z);
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'wall', x: 4, z: 0, rotation: 0 },
        { ...p, x: -7, z: 6 },
        [p],
        p.id,
        1000,
      ),
    /reach/,
  );
});

void test('joins cannot silently step down at the foundation edge', () => {
  const w = world([{ ...wall(), x: 4 }]);
  assert.match(placementError(w, 'wall', { x: 6, z: 0 })!, /heights/);
  const target = snapPlacement(w, 'wall', { x: 6.1, z: 0.1 });
  assert.equal(target.snapped, false);
});
