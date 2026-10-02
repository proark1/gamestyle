import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CraneClashScene } from './scene';
import type { PlayerInput } from './types';

// Exercise the real scene input pipeline without creating a WebGL renderer.
function controls() {
  let input: PlayerInput | undefined;
  const scene = Object.create(CraneClashScene.prototype) as CraneClashScene;
  Object.assign(scene, {
    keys: new Set(),
    touchMove: { role: 'swinger', x: 0, z: 0 },
    touchHoist: 0,
    inputSeq: 0,
    lastInputSend: -Infinity,
    destroyed: false,
    isSoloTeam: true,
    swappedControls: false,
    orbit: { angle: Math.PI / 2 },
    cb: {
      input: (next: PlayerInput) => {
        input = next;
      },
    },
  });
  return {
    move: scene.setTouchMove.bind(scene),
    hoist: scene.setTouchHoist.bind(scene),
    read() {
      // Private is a TypeScript boundary only; this avoids a rendering-dependent test.
      Reflect.set(scene, 'lastInputSend', -Infinity);
      Reflect.get(scene, 'pollInput').call(scene);
      assert.ok(input);
      return input;
    },
  };
}
void test('touch swing follows camera direction and release stops movement', () => {
  const c = controls();
  c.move('swinger', { x: 1, z: 0 });
  assert.ok(Math.abs(c.read().x) < 1e-10);
  assert.equal(c.read().z, 1);
  c.move('swinger', { x: 0, z: 0 });
  assert.equal(c.read().x, 0);
  assert.equal(c.read().z, 0);
});
void test('touch crane steering and hoist combine, then release independently', () => {
  const c = controls();
  c.move('operator', { x: 0.7, z: -1 });
  c.hoist(1);
  const input = c.read();
  assert.equal(input.craneX, 0.7);
  assert.equal(input.craneZ, 1);
  assert.equal(input.craneY, 1);
  assert.equal(input.x, 0);
  c.hoist(0);
  assert.equal(c.read().craneY, 0);
  assert.equal(c.read().craneX, 0.7);
  c.move('operator', { x: 0, z: 0 });
  assert.equal(c.read().craneX, 0);
  assert.equal(c.read().craneZ, 0);
});
