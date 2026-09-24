import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { newRider } from './simulation';
import { poseRider, riderModel } from './models';

const near = (actual: number, expected: number, tolerance = 0.08) =>
  Math.abs(actual - expected) <= tolerance;

void test('Park Pro keeps Nico and seats both boots over named bindings', () => {
  const { root, body } = riderModel(0);
  root.updateMatrixWorld(true);

  assert.equal(body.userData.kid, 'nico');
  assert.ok(near(Math.abs(body.rotation.y), Math.PI / 2, 1e-6));
  assert.ok(root.getObjectByName('snowboard'));

  const bindings = root.getObjectsByProperty('name', 'snowboard-binding');
  const soles = body.getObjectsByProperty('name', 'snowboard-boot-anchor');
  assert.equal(bindings.length, 2);
  assert.equal(soles.length, 2);

  const bindingPositions = bindings.map((binding) =>
    binding.getWorldPosition(new T.Vector3()),
  );
  for (const sole of soles) {
    const boot = sole.getWorldPosition(new T.Vector3());
    assert.ok(
      bindingPositions.some(
        (binding) => Math.hypot(binding.x - boot.x, binding.z - boot.z) < 0.16,
      ),
      `boot ${boot.x.toFixed(3)},${boot.y.toFixed(3)},${boot.z.toFixed(3)} does not meet a binding`,
    );
    assert.ok(boot.y > 0.1 && boot.y < 0.28, `boot deck height ${boot.y}`);
  }
});

void test('Park Pro adds winter gear without replacing a worn face item', () => {
  const plain = riderModel(0);
  const dressed = riderModel(0, { face: 'welding-goggles' });

  assert.ok(plain.root.getObjectByName('park-pro-goggles'));
  assert.equal(dressed.root.getObjectByName('park-pro-goggles'), undefined);
  assert.equal(dressed.body.userData.kid, 'nico');
  assert.equal(
    dressed.root.getObjectsByProperty('name', 'snowboard-mitten').length,
    2,
  );
});

void test('snowboard poses stay bounded across ground, tuck, air and carve', () => {
  const { body } = riderModel(0);
  const rider = newRider(0);
  rider.id = 'human';
  rider.bot = false;

  const poses = [
    () => poseRider(body, rider, 1),
    () => {
      rider.input.tuck = true;
      poseRider(body, rider, 1.1);
    },
    () => {
      rider.input.tuck = false;
      rider.input.steer = 1;
      poseRider(body, rider, 1.2);
    },
    () => {
      rider.grounded = false;
      rider.height = 1;
      poseRider(body, rider, 1.3);
    },
  ];

  for (const apply of poses) {
    apply();
    for (const key of ['body', 'legL', 'legR', 'armL', 'armR'] as const) {
      const part = body.userData[key] as T.Object3D;
      for (const value of [part.rotation.x, part.rotation.y, part.rotation.z])
        assert.ok(Number.isFinite(value) && Math.abs(value) <= Math.PI);
    }
  }
});
