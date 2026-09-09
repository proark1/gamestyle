import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { LoadCrane } from './load-crane';
import { CRANE, FLOOR, LOAD_CRANE, SCENERY } from './geometry';
import { act, createPlayer, freshWorld, movePlayer, tick } from './simulation';
import { poseError } from './physics';
import { GOAL, ITEMS, type Piece } from './types';

const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-5, `${a} ≠ ${b}`);
function dispose(rig: T.Object3D) {
  rig.traverse((object) => {
    if (object instanceof T.Mesh) object.geometry.dispose();
  });
}
function checkAttachments(rig: LoadCrane, x: number, top: number, z: number) {
  rig.update({ x, top, z });
  rig.updateMatrixWorld(true);
  const upper = rig.rope.localToWorld(new T.Vector3(0, 0.5, 0));
  const lower = rig.rope.localToWorld(new T.Vector3(0, -0.5, 0));
  const trolley = new T.Box3().setFromObject(rig.trolley);
  assert.ok(
    trolley.containsPoint(upper),
    'rope starts inside the real moving trolley',
  );
  assert.ok(
    new T.Box3().setFromObject(rig.hook).containsPoint(lower),
    'rope ends inside the hook',
  );
  close(upper.x, x);
  close(upper.z, z);
  close(lower.x, x);
  close(lower.z, z);
  close(new T.Box3().setFromObject(rig.hook).min.y, top);
  assert.ok(upper.y > lower.y, 'positive cable length even at maximum lift');
  // Raycast actual batched jib geometry, not the computed trolley radius.
  const rail = new T.Raycaster(
    upper,
    new T.Vector3(0, 1, 0),
    0,
    0.2,
  ).intersectObjects(
    rig.jib.children.filter((object) => object !== rig.trolley),
  );
  assert.ok(rail.length > 0, 'trolley remains attached to the visible jib');
}
const crate = (id: string, x: number, y: number, z: number): Piece => ({
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

void test('cargo cable stays connected at every yard edge, lift height and interpolated position', () => {
  const rig = new LoadCrane();
  for (const x of [-8, -4.25, 0, 3.73, 8])
    for (const z of [-8, -3.7, 0, 4.25, 8])
      for (const top of [
        FLOOR + ITEMS.crate.h,
        8.47,
        GOAL + 1 + ITEMS.fridge.h,
      ])
        checkAttachments(rig, x, top, z);
  for (const piece of freshWorld(100000).pieces)
    checkAttachments(rig, piece.x, piece.y + ITEMS[piece.kind].h, piece.z);
  dispose(rig);
});

void test('an empty cargo crane retains a connected retracted hook after releasing or changing rooms', () => {
  const rig = new LoadCrane();
  checkAttachments(rig, 8, 6, -8);
  rig.update(null);
  rig.updateMatrixWorld(true);
  const upper = rig.rope.localToWorld(new T.Vector3(0, 0.5, 0));
  assert.ok(new T.Box3().setFromObject(rig.trolley).containsPoint(upper));
  close(rig.hook.position.x, 8);
  close(rig.hook.position.z, -8);
  assert.ok(rig.rope.scale.y > 0 && rig.rope.scale.y < 1);
  assert.ok(rig.hook.position.y > CRANE.boomY + 2);
  dispose(rig);
});

void test('the cargo jib clears the fixed rescue crane and remains joined to its own mast', () => {
  const rig = new LoadCrane();
  for (const z of [-8, 0, 8]) {
    rig.update({ x: 8, z, top: 4 });
    rig.updateMatrixWorld(true);
    assert.ok(
      new T.Box3().setFromObject(rig.jib).min.y > CRANE.boomY + 2,
      'both jibs can pass above one another',
    );
    const hits = new T.Raycaster(
      new T.Vector3(LOAD_CRANE.mastX, LOAD_CRANE.boomY + 0.4, LOAD_CRANE.mastZ),
      new T.Vector3(0, -1, 0),
      0,
      0.5,
    ).intersectObject(rig.jib);
    assert.ok(
      hits.length > 0,
      'rotating jib remains on the stationary turntable',
    );
  }
  const mast = SCENERY.filter((s) => s.id === 'load-crane-post');
  assert.equal(mast.length, 4);
  for (const post of mast)
    close(post.pos[1] + post.size[1] / 2, LOAD_CRANE.boomY);
  dispose(rig);
});

void test('the added mast blocks players and cargo without occupying the rescue approaches', () => {
  const world = freshWorld(100000, 'practice');
  const player = createPlayer('a', 'Ada', 0, 0, world.clock);
  Object.assign(player, { x: -7, z: 0.55 });
  world.players = [player];
  world.pieces = [];
  assert.ok(
    poseError(world, crate('load', LOAD_CRANE.mastX, 3, LOAD_CRANE.mastZ)),
  );
  for (let i = 0; i < 120; i++)
    movePlayer(world, player, 1 / 60, { x: -1, z: 0, jump: false, seq: 0 });
  assert.ok(player.x > -8.6 && player.x < -8, `stopped at mast: ${player.x}`);
});

void test('authoritative cargo controls raise, move, lower and release a crate onto another crate', () => {
  const world = freshWorld(100000, 'practice');
  world.players = [createPlayer('a', 'Ada', 0, 0, world.clock)];
  const load = crate('load', -4, FLOOR, 4),
    base = crate('base', 1, FLOOR, 4);
  world.pieces = [base, load];
  const rig = new LoadCrane();
  act(world, 'a', { type: 'crane', target: load.id }, 'a');
  for (let i = 0; i < 2; i++) {
    act(world, 'a', { type: 'crane-move', x: 0, y: 1, z: 0 }, 'a');
    tick(world, world.clock + 500);
  }
  for (let i = 0; i < 5; i++) {
    act(world, 'a', { type: 'crane-move', x: 1, y: 0, z: 0 }, 'a');
    tick(world, world.clock + 500);
    checkAttachments(rig, load.x, load.y + ITEMS.crate.h, load.z);
  }
  act(world, 'a', { type: 'crane-move', x: 0, y: -0.6, z: 0 }, 'a');
  tick(world, world.clock + 700);
  checkAttachments(rig, load.x, load.y + ITEMS.crate.h, load.z);
  act(world, 'a', { type: 'crane-drop' }, 'a');
  assert.equal(load.heldBy, undefined);
  assert.equal(world.crane.owner, null);
  tick(world, world.clock + 2000);
  assert.ok(Math.abs(load.y - (FLOOR + ITEMS.crate.h)) < 0.03);
  assert.ok(Math.abs(load.x - base.x) < 0.03);
  dispose(rig);
});
