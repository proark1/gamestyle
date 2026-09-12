import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  DEFAULT_CAMERA,
  EYE_HEIGHT,
  HotelLook,
  HotelCameraBoom,
} from './camera';

void test('hotel starts at guest eye level and pitch changes do not tilt walking into the floor', () => {
  assert.equal(DEFAULT_CAMERA, 'first-person');
  assert.ok(EYE_HEIGHT > 1.7 && EYE_HEIGHT < 2);
  const look = new HotelLook(),
    direction = new T.Vector3();
  for (const yaw of [0, 0.8, -Math.PI / 2, Math.PI]) {
    look.yaw = yaw;
    for (const pitch of [-1.25, 0, 1.25]) {
      look.pitch = pitch;
      look.direction(direction);
      const forward = look.walk(0, -1),
        right = look.walk(1, 0);
      assert.ok(Math.abs(Math.hypot(forward.x, forward.z) - 1) < 1e-10);
      assert.ok(Math.abs(forward.x - direction.x / Math.cos(pitch)) < 1e-10);
      assert.ok(Math.abs(forward.z - direction.z / Math.cos(pitch)) < 1e-10);
      assert.ok(Math.abs(forward.x * right.x + forward.z * right.z) < 1e-10);
    }
  }
});
void test('dragging looks in the expected direction, clamps vertical look and resets toward the exit', () => {
  const look = new HotelLook(),
    direction = new T.Vector3();
  look.turn(90, -100);
  look.direction(direction);
  assert.ok(direction.x > 0);
  assert.ok(direction.y > 0);
  look.turn(1e6, 1e6);
  assert.equal(look.pitch, -1.25);
  assert.ok(Math.abs(look.yaw) <= Math.PI);
  look.turn(-1e6, -1e6);
  assert.equal(look.pitch, 1.25);
  look.reset(true);
  assert.ok(look.walk(0, -1).z > 0.99);
  look.reset();
  assert.equal(look.yaw, 0);
  assert.equal(look.pitch, -0.08);
});
function wall(size: [number, number, number], at: [number, number, number]) {
  const mesh = new T.Mesh(
    new T.BoxGeometry(...size),
    new T.MeshBasicMaterial(),
  );
  mesh.position.set(...at);
  mesh.updateMatrixWorld(true);
  return mesh;
}
void test('follow camera stays in front of the elevator back wall instead of passing behind the building', () => {
  const boom = new HotelCameraBoom(),
    eye = new T.Vector3(0, EYE_HEIGHT, 3.2),
    target = new T.Vector3();
  const back = wall([3.8, 3.6, 0.2], [0, 1.8, 4.7]);
  boom.position(eye, 0, back, target);
  assert.ok(target.z > eye.z && target.z < 4.5);
  assert.ok(target.y > EYE_HEIGHT && target.y < 3.5);
  assert.deepEqual(eye.toArray(), [0, EYE_HEIGHT, 3.2]);
  back.geometry.dispose();
  back.material.dispose();
});
void test('follow camera stops at side walls in both directions and extends again in open space', () => {
  const boom = new HotelCameraBoom(),
    target = new T.Vector3();
  for (const side of [-1, 1]) {
    const panel = wall([0.25, 4.6, 26], [side * 5, 2.3, -12]);
    const eye = new T.Vector3(side * 4.1, EYE_HEIGHT, -10);
    boom.position(eye, (side * Math.PI) / 2, panel, target);
    assert.ok(Math.abs(target.x) < 4.8);
    assert.ok(Math.abs(target.x) > 4.1);
    boom.position(eye, (-side * Math.PI) / 2, panel, target);
    assert.ok(
      Math.abs(target.x) < 2,
      'looking away releases the camera from the previous collision',
    );
    panel.geometry.dispose();
    panel.material.dispose();
  }
});
void test('a shut elevator door and low ceiling also block the follow camera', () => {
  const boom = new HotelCameraBoom(),
    target = new T.Vector3(),
    environment = new T.Group();
  const door = wall([3.4, 3.4, 0.12], [0, 1.7, 1.02]);
  environment.add(door);
  environment.updateMatrixWorld(true);
  boom.position(new T.Vector3(0, EYE_HEIGHT, 0.4), 0, environment, target);
  assert.ok(target.z < 0.9);
  environment.remove(door);
  const ceiling = wall([10, 0.2, 10], [0, 2.2, 0]);
  environment.add(ceiling);
  environment.updateMatrixWorld(true);
  boom.position(new T.Vector3(0, EYE_HEIGHT, 0), 0, environment, target);
  assert.ok(target.y < 2.1);
  for (const mesh of [door, ceiling]) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});
void test('sign labels are sprites: they neither block nor break the follow camera', () => {
  const boom = new HotelCameraBoom(),
    target = new T.Vector3(),
    environment = new T.Group();
  const door = wall([3.4, 3.4, 0.12], [0, 1.7, 1.02]);
  const sign = new T.Sprite(new T.SpriteMaterial());
  sign.position.set(0, 2.1, 0.7);
  environment.add(door, sign);
  environment.updateMatrixWorld(true);
  assert.doesNotThrow(() =>
    boom.position(new T.Vector3(0, EYE_HEIGHT, 0.4), 0, environment, target),
  );
  assert.ok(target.z < 0.9, 'the door behind the sign still stops the camera');
  door.geometry.dispose();
  door.material.dispose();
  sign.material.dispose();
});
