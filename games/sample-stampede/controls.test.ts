import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cameraTarget,
  displayedSpeed,
  neutralInput,
  StampedeControls,
} from './controls';
import {
  freshSampleStampedeWorld,
  advanceSampleStampedeWorld,
} from './simulation';
import { SampleStampedePhysics } from './physics';

void test('releasing a keyboard key preserves the other thumb controls', () => {
  const input = new StampedeControls();
  input.enabled = true;
  input.touch.throttle = 0.7;
  input.touch.drift = true;
  input.keys.add('KeyA');
  assert.equal(input.read().steer, 1);
  input.keys.delete('KeyA');
  assert.equal(input.read().throttle, 0.7);
  assert.equal(input.read().drift, true);
});

void test('pause and lost-focus reset cannot resurrect held movement or drift', () => {
  const input = new StampedeControls();
  input.enabled = true;
  input.keys.add('KeyW');
  input.touch.drift = true;
  input.touch.grabberAction = true;
  input.enabled = false;
  input.reset();
  assert.deepEqual(input.read(), neutralInput());
  input.enabled = true;
  assert.deepEqual(input.read(), neutralInput());
});

void test('speed converts metres per second to the displayed unit', () => {
  assert.equal(displayedSpeed(6, 8, 'de'), 36);
  assert.equal(displayedSpeed(6, 8, 'en'), 22);
  assert.equal(displayedSpeed(0, 0, 'de'), 0);
});

void test('portrait and landscape follow cameras stay inside all warehouse walls', () => {
  for (const aspect of [320 / 568, 390 / 844, 844 / 390, 1280 / 720]) {
    for (const x of [-26, 0, 26])
      for (const z of [-34, 0, 34]) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const camera = cameraTarget(x, z, angle, aspect);
          assert.ok(camera.x > -26 && camera.x < 26);
          assert.ok(camera.z > -34 && camera.z < 34);
          assert.ok(camera.y > 4.8);
        }
      }
  }
});

void test('equal scores end in a draw; a sole leader still wins', () => {
  for (const [red, blue, winner] of [
    [0, 0, null],
    [600, 600, null],
    [600, 0, 'red'],
    [0, 600, 'blue'],
  ] as const) {
    const world = freshSampleStampedeWorld(1000);
    world.timeRemaining = 0.001;
    world.teamScores.red = red;
    world.teamScores.blue = blue;
    const physics = new SampleStampedePhysics(world);
    try {
      advanceSampleStampedeWorld(world, physics, 1 / 60, []);
      assert.equal(world.status, 'finished');
      assert.equal(world.winnerTeam, winner);
    } finally {
      physics.destroy();
    }
  }
});
