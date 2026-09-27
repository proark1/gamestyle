import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCameraView,
  cameraMode,
  courseCameraPose,
  cycleCameraPreset,
  defaultCameraView,
  orbitCameraView,
  zoomCameraView,
} from './camera-presentation';
import { freshWorld } from './simulation';

void test('aiming and reduced motion hold the stable camera', () => {
  const world = freshWorld(0);
  world.balls[0].moving = true;
  assert.equal(cameraMode(world, true, false), 'aim');
  assert.equal(cameraMode(world, false, true), 'aim');
  assert.deepEqual(
    courseCameraPose(world, false, true, false),
    courseCameraPose(world, false, false, true),
  );
});

void test('moving balls bias follow framing without leaving the course', () => {
  const world = freshWorld(0);
  world.phase = 'playing';
  world.balls[0].moving = true;
  world.balls[0].x = 99;
  world.balls[0].z = world.course.length + 20;
  const pose = courseCameraPose(world, false);
  assert.equal(pose.mode, 'follow');
  assert.ok(Math.abs(pose.look.x) <= 2.2 * 0.28);
  assert.ok(pose.look.z < world.course.length);
});

void test('recent cup events create a bounded celebration view', () => {
  const world = freshWorld(0);
  world.clock = 2_000;
  world.events.push({ id: 1, kind: 'cup', at: 1_000, x: 0, z: 13 });
  const pose = courseCameraPose(world, false);
  assert.equal(pose.mode, 'celebrate');
  assert.ok(pose.look.z <= world.course.length - 1.2);
  world.clock = 4_000;
  assert.equal(courseCameraPose(world, false).mode, 'aim');
});

void test('portrait framing is higher and farther back', () => {
  const world = freshWorld(0);
  const desktop = courseCameraPose(world, false);
  const portrait = courseCameraPose(world, true);
  assert.ok(portrait.position.y > desktop.position.y);
  assert.ok(portrait.position.z < desktop.position.z);
});

void test('camera presets cycle and establish distinct baselines', () => {
  const broadcast = defaultCameraView('broadcast');
  const low = cycleCameraPreset(broadcast);
  const overview = cycleCameraPreset(low);
  assert.equal(low.preset, 'low');
  assert.equal(overview.preset, 'overview');
  assert.equal(cycleCameraPreset(overview).preset, 'broadcast');
  assert.ok(low.pitch < broadcast.pitch);
  assert.ok(overview.pitch > broadcast.pitch);
});

void test('manual camera controls clamp pitch and zoom', () => {
  const view = defaultCameraView();
  const orbited = orbitCameraView(view, Math.PI * 9, 5);
  const zoomedOut = zoomCameraView(orbited, 9);
  assert.ok(orbited.pitch <= 0.48);
  assert.ok(orbited.yaw <= Math.PI && orbited.yaw >= -Math.PI);
  assert.equal(zoomedOut.zoom, 0.65);
});

void test('manual camera offsets survive automatic base-pose changes', () => {
  const world = freshWorld(0);
  const view = orbitCameraView(defaultCameraView(), 0.32, -0.08);
  const aim = applyCameraView(courseCameraPose(world, false), view);
  world.balls[0].moving = true;
  const follow = applyCameraView(courseCameraPose(world, false), view);
  assert.equal(view.yaw, 0.32);
  assert.notDeepEqual(aim.look, follow.look);
  assert.equal(aim.mode, 'aim');
  assert.equal(follow.mode, 'follow');
});
