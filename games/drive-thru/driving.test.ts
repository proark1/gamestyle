import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { keyboardInput } from './controls';
import {
  CAR,
  CURB_X,
  carPoint,
  computeWindowReachGap,
  poleClearance,
  stepCarPhysics,
} from './physics';
import {
  freshDriveThruWorld,
  advanceDriveThruWorld,
  driveThruAction,
  newDriveThruPlayer,
} from './simulation';
import { createSedanModel } from './sedan';

void test('arrows and WASD accelerate and reverse identically without triggering cooking actions', () => {
  assert.deepEqual(
    keyboardInput(new Set(['ArrowUp', 'ArrowLeft']), 'driver'),
    keyboardInput(new Set(['KeyW', 'KeyA']), 'driver'),
  );
  assert.equal(keyboardInput(new Set(['ArrowDown']), 'driver').action2, true);
  assert.equal(keyboardInput(new Set(['KeyW']), 'grill').action1, false);
  assert.equal(keyboardInput(new Set(['Space']), 'grill').action1, true);
});

void test('right steering turns right going forward and left in reverse', () => {
  const forward = { ...freshDriveThruWorld().car, x: -2, z: 3, speed: 2 };
  const reverse = { ...forward, speed: -2 };
  stepCarPhysics(forward, true, false, 1, 0.5);
  stepCarPhysics(reverse, false, true, 1, 0.5);
  assert.ok(forward.yaw > 0);
  assert.ok(reverse.yaw < 0);
  const visualForward = new T.Vector3(0, 0, -1).applyAxisAngle(
    new T.Vector3(0, 1, 0),
    -forward.yaw,
  );
  assert.ok(visualForward.x > 0, 'rendered nose points toward the movement');
});

void test('opposite pedal brakes before entering reverse', () => {
  const car = { ...freshDriveThruWorld().car, speed: 5 };
  stepCarPhysics(car, false, true, 0, 0.2);
  assert.ok(car.speed > 0 && car.speed < 3);
  stepCarPhysics(car, false, true, 0, 0.5);
  assert.ok(car.speed < 0);
});

void test('rotated passenger window and occupants share the rendered car transform', () => {
  const car = { ...freshDriveThruWorld().car, x: -2, z: 1, yaw: 1.1 };
  const local = new T.Vector3(1.05, 0, -0.2).applyAxisAngle(
    new T.Vector3(0, 1, 0),
    -car.yaw,
  );
  const window = carPoint(car, 1.05, -0.2);
  assert.ok(Math.abs(window.x - car.x - local.x) < 1e-9);
  assert.ok(Math.abs(window.z - car.z - local.z) < 1e-9);
  assert.ok(
    Math.abs(
      computeWindowReachGap(car).gapDistance -
        Math.hypot(2.2 - window.x, window.z),
    ) < 1e-9,
  );
});

void test('body stays inside the lane in both axes at any orientation', () => {
  for (const yaw of [0, 0.6, Math.PI / 2, Math.PI]) {
    const car = { ...freshDriveThruWorld().car, x: 3, z: 30, yaw };
    stepCarPhysics(car, true, false, 0, 0.1);
    for (const x of [-CAR.halfWidth, CAR.halfWidth])
      for (const z of [-CAR.halfLength, CAR.halfLength]) {
        const corner = carPoint(car, x, z);
        assert.ok(corner.x <= CURB_X + 1e-8 && corner.x >= -8 - 1e-8);
        assert.ok(corner.z <= 24 + 1e-8 && corner.z >= -12 - 1e-8);
      }
  }
});

void test('bumper stops at pole before the centre reaches it, including large time steps', () => {
  const car = { ...freshDriveThruWorld().car, x: -3.8, z: 15, speed: 7 };
  stepCarPhysics(car, true, false, 0, 0.5);
  assert.ok(car.z > 13.3);
  assert.ok(poleClearance(car) >= 0);
  assert.ok(car.bumperDamage > 0);
});

void test('new sedan has circular wheels and a cabin that clears seated avatar heads', () => {
  const sedan = createSedanModel();
  for (let i = 0; i < 4; i++) {
    const pivot = sedan.getObjectByName(`wheel-${i}`)!;
    const roll = sedan.getObjectByName(`wheel-roll-${i}`)!;
    assert.ok(pivot && roll);
    assert.equal(
      (roll.children[0] as T.Mesh).geometry.type,
      'CylinderGeometry',
    );
  }
  const windshield = sedan.getObjectByName('windshield')!;
  assert.ok(windshield.position.y > 1.5);
  const roof = sedan
    .getObjectByName('car-body')!
    .children.find((child) => child.position.y === 2.03)!;
  assert.ok(roof.position.y - 0.075 > 0.23 + 1.68 * 0.9);
});

void test('a single passenger pickup click delivers the ready tray beside the window', () => {
  const world = freshDriveThruWorld();
  world.players = [newDriveThruPlayer('human', 'You', 0, 'passenger', false)];
  Object.assign(world.car, { x: 0.15, z: 0.5, speed: 0 });
  world.kitchen.trayAtWindow = true;
  driveThruAction(world, 'human', { type: 'reachTray' });
  advanceDriveThruWorld(world, 1 / 60, world.clock + 1000 / 60);
  assert.equal(world.phase, 'completed');
});

void test('barista pour button fills at most four cups', () => {
  const world = freshDriveThruWorld();
  world.players = [newDriveThruPlayer('human', 'You', 0, 'barista', false)];
  for (let i = 0; i < 6; i++)
    driveThruAction(world, 'human', { type: 'pourDrink' });
  assert.equal(world.kitchen.sodasPoured, 4);
});
