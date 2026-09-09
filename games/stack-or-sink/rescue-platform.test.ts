import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from 'cannon-es';
import { createPlayer, freshWorld, movePlayer, tick } from './simulation';
import { CRANE, FLOOR, PLAYER_HEIGHT, SCENERY } from './geometry';
import { simulationPhysics, supportSurface } from './physics';
import { GOAL, ITEMS, type Input } from './types';

const approaches = [
  { name: 'front', x: 0, z: 3.7, dx: 0, dz: -1 },
  { name: 'back', x: 0, z: -3.7, dx: 0, dz: 1 },
  { name: 'right', x: 3.7, z: 0, dx: -1, dz: 0 },
  { name: 'left', x: -3.7, z: 0, dx: 1, dz: 0 },
];

function setup(x = 0, y = FLOOR, z = 0) {
  const w = freshWorld(100000, 'practice');
  const p = createPlayer('a', 'Ada', 0, 0, w.clock);
  Object.assign(p, { x, y, z });
  w.players = [p];
  w.pieces = [];
  return { w, p };
}

for (const approach of approaches) {
  for (const authoritative of [false, true]) {
    void test(`${authoritative ? 'host simulation' : 'client prediction'} lands a nine-crate jump through the ${approach.name} entrance`, () => {
      const { x, z, dx, dz } = approach;
      const { w, p } = setup(x, FLOOR + 9 * ITEMS.crate.h, z);
      w.pieces = Array.from({ length: 9 }, (_, i) => ({
        id: `step-${i}`,
        kind: 'crate',
        x,
        y: FLOOR + i * ITEMS.crate.h,
        z,
        rotation: 0,
        vy: 0,
        tilt: 0,
        unstable: 0,
      }));
      w.phase = 'playing';
      w.started = w.clock;
      for (let i = 0; i < 120; i++) {
        const input: Input = {
          x: i < 43 ? dx : 0,
          z: i < 43 ? dz : 0,
          jump: i < 60,
          seq: 1,
        };
        if (authoritative) {
          p.input = input;
          p.seen = w.clock + 1000 / 60;
          tick(w, p.seen);
        } else movePlayer(w, p, 1 / 60, input);
      }
      assert.ok(Math.abs(p.y - GOAL) < 0.035, `feet at ${p.y}`);
      assert.ok(Math.abs(p.x) < 2 && Math.abs(p.z) < 2, 'inside the rails');
      assert.equal(p.grounded, true);
      if (authoritative) {
        assert.equal(w.phase, 'won');
        assert.equal(p.rescued, true);
      }
    });
  }
}

void test('rescue deck supports a falling player at its visible top', () => {
  const { w, p } = setup(0, GOAL + 2, 0);
  p.grounded = false;
  for (let i = 0; i < 120; i++)
    movePlayer(w, p, 1 / 60, { x: 0, z: 0, jump: false, seq: 0 });
  assert.ok(Math.abs(p.y - GOAL) < 0.025);
  assert.equal(p.grounded, true);
});

void test('the rotated crane boom has matching placement and rigid-body collision surfaces', () => {
  const { w } = setup();
  const physics = simulationPhysics(w);
  const expectedTop = CRANE.boomY + 0.19;
  for (const fraction of [0, 0.25, 0.5]) {
    const x = CRANE.mastX * fraction,
      z = CRANE.mastZ * fraction;
    assert.ok(
      Math.abs(supportSurface(w, x, z, 0.01, 0.01, 21) - expectedTop) < 0.001,
    );
    const hit = new C.RaycastResult();
    assert.ok(
      physics.engine.raycastClosest(
        new C.Vec3(x, 21, z),
        new C.Vec3(x, 17.5, z),
        {},
        hit,
      ),
    );
    assert.ok(Math.abs(hit.hitPointWorld.y - expectedTop) < 0.001);
  }
  assert.equal(
    supportSurface(w, -4, -6.5, 0.01, 0.01, 21),
    FLOOR,
    'no invisible collision at the old boom position',
  );
});

void test('jumping directly underneath rescue hits the underside instead of passing through', () => {
  const deck = SCENERY.find((shape) => shape.id === 'rescue-platform')!;
  const underside = deck.pos[1] - deck.size[1] / 2;
  const { w, p } = setup(0, underside - PLAYER_HEIGHT - 0.12, 0);
  let peak = p.y;
  for (let i = 0; i < 30; i++) {
    movePlayer(w, p, 1 / 60, { x: 0, z: 0, jump: true, seq: 1 });
    peak = Math.max(peak, p.y);
  }
  // Discrete 60 Hz contacts can overlap by one upward step before resolving.
  assert.ok(peak + PLAYER_HEIGHT < underside + 0.1);
  assert.ok(p.vy < 0, 'the head contact stops the upward jump');
});

void test('remaining rescue rails still block walking outside the entry gaps', () => {
  for (const { x, z, dx, dz } of approaches.slice(1)) {
    const { w, p } = setup(x ? Math.sign(x) : 1.5, GOAL, z ? -1 : 1.5);
    for (let i = 0; i < 90; i++)
      movePlayer(w, p, 1 / 60, { x: -dx, z: -dz, jump: false, seq: 0 });
    assert.ok(Math.abs(p.x) < 2.2 && Math.abs(p.z) < 2.2);
    assert.ok(Math.abs(p.y - GOAL) < 0.025);
  }
});
