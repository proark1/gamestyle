import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BasketballScene } from './scene';
import { idleInput, type PlayerInput } from './types';

void test('touch movement and shooting share the input pipeline without releasing each other', () => {
  let input = idleInput();
  const scene = Object.create(BasketballScene.prototype) as BasketballScene;
  Object.assign(scene, {
    keys: new Set(),
    touchMove: { x: 0, z: 0 },
    touchShoot: false,
    isSpaceHeld: false,
    lastSpacePress: 0,
    currentInput: idleInput(),
    cb: {
      input: (next: PlayerInput) => {
        input = next;
      },
      action: () => {},
    },
  });
  scene.setTouchMove({ x: 0.75, z: -0.5 });
  assert.equal(input.x, 0.75);
  assert.equal(input.z, -0.5);
  scene.setTouchShoot(true);
  assert.equal(input.shoot, true);
  scene.setTouchMove({ x: 1, z: 0 });
  assert.equal(input.shoot, true);
  scene.setTouchShoot(false);
  assert.equal(input.shoot, false);
  assert.equal(input.x, 1);
  scene.setTouchMove({ x: 0, z: 0 });
  assert.equal(input.x, 0);
  assert.equal(input.z, 0);
});
