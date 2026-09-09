import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { PlayerCorrection, SnapshotMotion } from './motion';
import {
  act,
  createPlayer,
  emptyInput,
  freshWorld,
  movePlayer,
  tick,
} from './simulation';
import { simulationPhysics } from './physics';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import type { Piece, Snapshot } from './types';

const load = (y = 3): Piece => ({
  id: 'load',
  kind: 'crate',
  x: 0,
  y,
  z: 0,
  rotation: 0,
  vy: 0,
  tilt: 0,
  unstable: 0,
  revision: 0,
});
function yard() {
  const w = freshWorld(100000, 'practice');
  w.pieces = [];
  w.players = [createPlayer('a', 'Ada', 0, 0, w.clock)];
  return w;
}

void test('releasing movement stops horizontally on the ground and throughout a running jump', () => {
  for (const jump of [false, true]) {
    const w = yard(),
      p = w.players[0];
    p.x = 0;
    p.z = 5;
    for (let i = 0; i < 10; i++)
      movePlayer(w, p, 1 / 60, { x: 1, z: 0, jump: jump && i === 9, seq: 1 });
    const x = p.x,
      z = p.z,
      y = p.y;
    for (let i = 0; i < 120; i++) movePlayer(w, p, 1 / 60, emptyInput());
    assert.equal(p.x, x);
    assert.equal(p.z, z);
    assert.ok(Math.abs(p.y - 0.13) < 0.01);
    if (jump) assert.ok(y > 0.13, 'jump actually started before release');
  }
});
void test('standing still on tilted salvage has no contact-induced horizontal creep', () => {
  const w = yard(),
    p = w.players[0];
  p.x = 4;
  p.z = 3;
  p.y = 1.8;
  p.grounded = false;
  const plank = {
    ...load(0.5),
    kind: 'plank' as const,
    x: 4,
    z: 3,
    quaternion: { x: 0, y: 0, z: Math.sin(0.09), w: Math.cos(0.09) },
  };
  w.pieces = [plank];
  for (let i = 0; i < 180; i++) movePlayer(w, p, 1 / 60, emptyInput());
  assert.equal(p.x, 4);
  assert.equal(p.z, 3);
  assert.ok(p.y > 0.5, 'still supported by the plank');
});
void test('authoritative physics also stops a running jump with the first zero-input step', () => {
  const w = yard(),
    p = w.players[0];
  p.x = 4;
  p.z = 3;
  p.input = { x: 1, z: 0, jump: true, seq: 1 };
  tick(w, w.clock + 100);
  p.input = emptyInput();
  const x = p.x,
    z = p.z;
  for (let i = 0; i < 60; i++) {
    p.seen = w.clock;
    tick(w, w.clock + 17);
    assert.equal(p.x, x);
    assert.equal(p.z, z);
  }
});
void test('physics bodies persist between practice frames and rebuild after a support is removed', () => {
  const w = yard();
  w.players[0].x = 4;
  w.players[0].z = 3;
  w.pieces = [{ ...load(0.13), x: 4, z: 0 }];
  const first = simulationPhysics(w);
  for (let i = 0; i < 30; i++) tick(w, w.clock + 17);
  assert.equal(simulationPhysics(w), first);
  act(w, 'a', { type: 'grab', target: 'load' }, 'a');
  assert.notEqual(simulationPhysics(w), first);
});
void test('normal server corrections never move a stationary avatar and large corrections remain authoritative', () => {
  const p = yard().players[0],
    c = new PlayerCorrection(),
    x = p.x,
    z = p.z;
  for (let i = 0; i < 30; i++) {
    c.receive(p, { ...p, x: x + 0.6, z: z + 0.2 });
    c.apply(p, false, 1 / 60);
    assert.equal(p.x, x);
    assert.equal(p.z, z);
  }
  c.receive(p, { ...p, x: x + 3 });
  assert.equal(p.x, x + 3);
});
void test('buffered falling objects move continuously between irregular server snapshots', () => {
  const w = yard();
  w.players = [];
  w.pieces = [load(10)];
  const motion = new SnapshotMotion(),
    out = { x: 0, y: 0, z: 0, quaternion: new T.Quaternion() };
  const arrivals = [
    0, 120, 260, 370, 530, 650, 790, 900, 1030, 1190, 1300, 1460, 1600, 1730,
    1900, 2050,
  ];
  let index = 0,
    current = w.pieces[0],
    previous = 10,
    changes = 0;
  const deltas: number[] = [];
  for (let ms = 0; ms <= 2100; ms += 1000 / 60) {
    while (index < arrivals.length && arrivals[index] <= ms) {
      const t = arrivals[index++];
      current = { ...current, y: 10 - t * 0.002 };
      motion.push(
        {
          code: 'ABC234',
          host: 'a',
          version: index,
          world: { ...w, clock: 100000 + t, pieces: [current] },
        } as Snapshot,
        ms,
      );
    }
    motion.advance(ms);
    motion.piece(current, out);
    if (ms > 500) {
      const delta = previous - out.y;
      assert.ok(delta >= -1e-8, 'no backward flicker');
      assert.ok(delta < 0.06, `large step ${delta}`);
      if (delta > 0.0001) changes++;
      deltas.push(delta);
    }
    previous = out.y;
  }
  assert.ok(changes > 85, 'motion updates at render rate, not at packet rate');
});
void test('exact place and ownership changes bypass old buffered object poses', () => {
  const w = yard(),
    motion = new SnapshotMotion(),
    out = { x: 0, y: 0, z: 0, quaternion: new T.Quaternion() };
  motion.push(
    {
      code: 'ABC234',
      host: 'a',
      version: 1,
      world: { ...w, pieces: [load(4)] },
    },
    0,
  );
  motion.piece({ ...load(0.13), x: 3, revision: 1 }, out);
  assert.deepEqual([out.x, out.y, out.z], [3, 0.13, 0]);
});
void test('the first buffered frames after releasing the crane never rewind the falling load', () => {
  const w = yard(),
    motion = new SnapshotMotion(),
    out = { x: 0, y: 0, z: 0, quaternion: new T.Quaternion() };
  let current = { ...load(4), heldBy: 'crane' } as Piece,
    previousY = 4;
  for (let ms = 0; ms <= 1000; ms += 1000 / 60) {
    if (Math.round(ms) % 150 === 0) {
      const t = Math.round(ms);
      current =
        t < 150
          ? current
          : { ...load(4 - Math.max(0, t - 150) * 0.002), revision: 1 };
      motion.push(
        {
          code: 'ABC234',
          host: 'a',
          version: t,
          world: { ...w, clock: 100000 + t, pieces: [current] },
        },
        ms,
      );
    }
    motion.advance(ms);
    motion.piece(current, out);
    assert.ok(
      out.y <= previousY + 1e-8,
      `load rewound from ${previousY} to ${out.y}`,
    );
    previousY = out.y;
  }
  assert.ok(out.y < 3, 'the load fell');
});
void test('batching static scenery preserves triangles, transforms and surface raycasts', () => {
  const root = new T.Group(),
    material = new T.MeshBasicMaterial(),
    g = new T.Group();
  g.position.set(2, 0, 0);
  root.add(g);
  for (let i = 0; i < 10; i++) {
    const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), material);
    m.position.set(i * 2, 0, 0);
    m.userData.surface = true;
    g.add(m);
  }
  batchScenery(root);
  root.updateMatrixWorld(true);
  let meshes = 0,
    triangles = 0;
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      meshes++;
      triangles +=
        (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) /
        3;
    }
  });
  assert.equal(meshes, 1);
  assert.equal(triangles, 120);
  const hit = new T.Raycaster(
    new T.Vector3(2, 3, 0),
    new T.Vector3(0, -1, 0),
  ).intersectObject(root, true)[0];
  assert.equal(hit.point.y, 0.5);
  assert.equal(hit.object.userData.surface, true);
});
