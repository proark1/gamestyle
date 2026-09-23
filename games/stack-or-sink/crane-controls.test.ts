import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GameScene } from './scene';

void test('crane XY follows the screen axes regardless of the previous orbit', () => {
  const scene = Object.create(GameScene.prototype) as GameScene;
  scene.keys = new Set(['KeyW', 'KeyD']);
  scene.touch = { x: 0, z: 0 };
  scene.yaw = Math.PI / 2;
  scene.craneView = true;
  scene.paused = false;
  scene.jumpSeq = 0;
  scene.jumpHeld = false;

  const keyboard = scene.craneInput();
  assert.ok(keyboard.x > 0 && keyboard.z < 0);
  assert.ok(Math.abs(Math.hypot(keyboard.x, keyboard.z) - 1) < 1e-6);
  assert.deepEqual({ x: scene.input().x, z: scene.input().z }, keyboard);

  scene.keys.clear();
  scene.touch = { x: -1, z: 1 };
  const joystick = scene.craneInput();
  assert.ok(joystick.x < 0 && joystick.z > 0);
  assert.ok(Math.abs(Math.hypot(joystick.x, joystick.z) - 1) < 1e-6);
});

void test('oblique work and overview views preserve XY directions on desktop and mobile', () => {
  const scene = Object.create(GameScene.prototype) as GameScene;
  scene.host = { clientWidth: 1200, clientHeight: 800 } as HTMLElement;
  scene.renderer = { setSize() {} } as unknown as T.WebGLRenderer;
  scene.camera = new T.OrthographicCamera();
  scene.world = {
    world: { crane: { owner: 'me', x: 2, y: 5, z: -1 } },
  } as GameScene['world'];
  scene.localId = 'me';
  scene.predicted = { x: 0, y: 0, z: 0 } as GameScene['predicted'];
  scene.target = new T.Vector3();
  scene.menu = false;
  scene.overview = false;
  scene.yaw = 2.1;
  scene.zoom = 1;
  scene.craneView = false;
  scene.craneAngle = false;
  scene.projectionDirty = true;

  for (const [width, height] of [
    [1200, 800],
    [390, 844],
  ]) {
    Object.assign(scene.host, { clientWidth: width, clientHeight: height });
    scene.projectionDirty = true;
    for (const angle of [false, true]) {
      scene.updateCamera(1);
      scene.setCraneAngle(angle);
      scene.updateCamera(1);
      const right = new T.Vector3(1, 0, 0).project(scene.camera);
      const up = new T.Vector3(0, 0, -1).project(scene.camera);
      const center = new T.Vector3().project(scene.camera);
      assert.ok(right.x > center.x, 'world +X remains screen right');
      assert.ok(up.y > center.y, 'world -Z remains screen up');
      assert.ok(
        scene.camera.position.z > scene.target.z + 20,
        'view remains oblique',
      );
      assert.equal(scene.target.x, angle ? 0 : 2);
    }
  }
});
