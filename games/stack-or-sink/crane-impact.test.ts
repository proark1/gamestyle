import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createPlayer, freshWorld, tick } from './simulation';
import { FLOOR } from './geometry';
import { simulationPhysics, topOf } from './physics';
import type { Piece, World } from './types';

const crate = (id: string, x: number, y: number, z = 4): Piece => ({
  id,
  kind: 'crate',
  x,
  y,
  z,
  rotation: 0,
  vy: 0,
  tilt: 0,
  unstable: 0,
});
function setup(height = 0.85, stack = 1) {
  const w = freshWorld(100000, 'practice');
  w.players = [createPlayer('a', 'Ada', 0, 0, w.clock)];
  w.bestHeight = 10;
  w.pieces = [
    crate('cargo', -3.4, height),
    ...Array.from({ length: stack }, (_, i) =>
      crate(`stack-${i}`, 0, FLOOR + 1.3 * i),
    ),
    crate('distant', 6, FLOOR, 6),
  ];
  act(w, 'a', { type: 'crane', target: 'cargo' }, 'a');
  advance(w, 3000);
  return w;
}
function advance(w: World, milliseconds: number) {
  for (let remaining = milliseconds; remaining > 0.001; remaining -= 1000 / 60)
    tick(w, w.clock + Math.min(remaining, 1000 / 60));
}
function sweep(w: World, serialize = false) {
  for (let i = 0; i < 12; i++) {
    act(w, 'a', { type: 'crane-move', x: 0.55, y: 0, z: 0 }, 'a');
    if (serialize) w = JSON.parse(JSON.stringify(w)) as World;
    advance(w, 160);
  }
  advance(w, 3000);
  return w;
}

for (const serialize of [false, true]) {
  void test(`a crane impact wakes and tips a sleeping ground crate${serialize ? ' across serialized room updates' : ''}`, () => {
    let w = setup();
    assert.equal(w.pieces[1].sleeping, true);
    w = sweep(w, serialize);
    const struck = w.pieces[1];
    assert.ok(
      struck.x > 1,
      'normal contact transfers movement into the struck crate',
    );
    assert.ok(
      Math.abs(struck.quaternion?.z || 0) > 0.5,
      'off-center contact tips the crate onto a different face',
    );
    assert.ok(topOf(struck) < 2, 'the tipped crate returns to the yard floor');
    assert.equal(
      w.pieces[2].sleeping,
      true,
      'moving the hoist does not wake unrelated boxes',
    );
    assert.ok(Math.abs(w.pieces[2].x - 6) < 0.001);
  });
}

void test('the upper crates of a settled tower fall when struck by a suspended load', () => {
  const w = setup(1.8, 3);
  const before = topOf(w.pieces[3]);
  assert.ok(w.pieces.slice(1).every((p) => p.sleeping));
  sweep(w);
  assert.ok(topOf(w.pieces[3]) < before - 1, 'top crate falls off the stack');
  assert.ok(w.pieces[2].x > 1 && w.pieces[3].x > 2);
  assert.ok(
    Math.abs(w.pieces[2].quaternion?.z || 0) > 0.3,
    'contact generates angular momentum',
  );
});

void test('a hoist that misses a sleeping box leaves it untouched', () => {
  const w = setup();
  // Reposition the prepared load before taking it into a new physics world.
  w.pieces[0].z = 6;
  w.crane.z = 6;
  w.pieces = w.pieces.map((p) => ({ ...p }));
  const before = { ...w.pieces[1] };
  sweep(w);
  const untouched = w.pieces[1];
  assert.equal(untouched.sleeping, true);
  for (const axis of ['x', 'y', 'z'] as const)
    assert.ok(Math.abs(untouched[axis] - before[axis]) < 0.001);
});

void test('queued crane commands move the load over time, keep the solver, and preserve momentum on release', () => {
  const w = setup(2);
  w.pieces = [w.pieces[0]];
  const load = w.pieces[0];
  const physics = simulationPhysics(w);
  for (let i = 0; i < 20; i++)
    act(w, 'a', { type: 'crane-move', x: 1, y: 0, z: 0 }, 'a');
  assert.equal(w.crane.x, 8);
  assert.ok(Math.abs(load.x + 3.4) < 0.001, 'commands never teleport the load');
  assert.equal(
    simulationPhysics(w),
    physics,
    'target updates retain contact state',
  );
  for (let i = 0; i < 30; i++) {
    const before = load.x;
    tick(w, w.clock + 1000 / 60);
    assert.ok(
      load.x - before < 0.065,
      'movement is small enough to resolve contacts every step',
    );
  }
  assert.ok((load.vx || 0) > 2 && load.x < 0);
  const speed = load.vx;
  act(w, 'a', { type: 'crane-drop' }, 'a');
  assert.equal(load.heldBy, undefined);
  assert.equal(
    load.vx,
    speed,
    'releasing the cable keeps the actual load momentum',
  );
});

void test('a force-limited crane stalls against cargo pinned to the shed instead of crushing it through the wall', () => {
  const w = setup(FLOOR);
  w.pieces = [crate('cargo', -2, FLOOR, -7), crate('pinned', -4.1, FLOOR, -7)];
  w.crane = { owner: 'a', piece: 'cargo', x: -2, y: FLOOR, z: -7 };
  w.pieces[0].heldBy = 'crane';
  advance(w, 3000);
  for (let i = 0; i < 12; i++) {
    act(w, 'a', { type: 'crane-move', x: -0.12, y: 0, z: 0 }, 'a');
    advance(w, 160);
  }
  advance(w, 3000);
  assert.ok(
    w.crane.x < -3.4 && w.pieces[0].x > -2.9,
    'load stalls before reaching its target',
  );
  assert.ok(w.pieces[1].x > -4.3, 'crate stays outside the shed wall');
  for (const p of w.pieces) {
    assert.ok(p.y > FLOOR - 0.04);
    assert.ok(
      Math.hypot(p.vx || 0, p.vy || 0, p.vz || 0) < 1,
      'no explosive correction',
    );
  }
});
