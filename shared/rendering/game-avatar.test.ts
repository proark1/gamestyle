import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { dressedGameAvatar, GAME_BODY_HEIGHT, gameAvatar } from './game-avatar';
import { SKULL } from './avatars/hoop-kid';
import { tennisPlayer } from '../../games/bungee-doubles/models';
import { poseTennisWorker } from '../../games/bungee-doubles/avatar';
import { thief } from '../../games/dont-wake-the-giant/objects';
import { chainWorker, D_RING } from '../../games/chain-of-fools/avatar';
import { deliveryWorker } from '../../games/uphill-delivery/objects';

function scalp(model: T.Object3D) {
  model.updateMatrixWorld(true);
  return model.userData.head.localToWorld(
    new T.Vector3(0, SKULL.centre[1] + SKULL.radii[1], 0),
  ).y as number;
}

void test('Nico has grounded feet and a stable body height regardless of hats', () => {
  for (const look of [undefined, { hat: 'top-hat' }, { hat: 'party-cone' }]) {
    const { model } = dressedGameAvatar(0, {}, look);
    assert.equal(model.userData.kid, 'nico');
    assert.ok(Math.abs(scalp(model) - GAME_BODY_HEIGHT) < 1e-6);
    assert.ok(Math.abs(new T.Box3().setFromObject(model).min.y) < 1e-6);
    model.scale.setScalar(0.72);
    assert.ok(Math.abs(scalp(model) - GAME_BODY_HEIGHT * 0.72) < 1e-6);
  }
  assert.ok(Math.abs(scalp(thief(0)) - GAME_BODY_HEIGHT * 0.52) < 1e-6);
});

void test('tennis racket stays at the actual hand through movement and recovery', () => {
  const model = tennisPlayer('red');
  for (const walking of [false, true, false]) {
    poseTennisWorker(model, 0.6, { walking });
    model.updateMatrixWorld(true);
    const grip = model.userData.armR.getObjectByName(
      'worker-hand',
    ) as T.Object3D;
    const racket = model.userData.racket as T.Object3D;
    assert.equal(racket.parent, grip.parent);
    assert.ok(
      grip
        .getWorldPosition(new T.Vector3())
        .distanceTo(racket.getWorldPosition(new T.Vector3())) < 0.05,
    );
  }
});

void test('harness attachment remains on the back and delivery retains an animated head', () => {
  const model = chainWorker(0);
  const ring = (model.userData.body as T.Group).children.find(
    (o) => o.position.distanceTo(D_RING) < 1e-6,
  );
  assert.ok(ring, 'rope and harness ring use the same local anchor');
  const mover = deliveryWorker(0);
  assert.ok(mover.userData.head.children.length > 0);
  const before = new T.Box3()
    .setFromObject(mover.userData.head)
    .getCenter(new T.Vector3());
  mover.userData.head.position.y += 0.2;
  const after = new T.Box3()
    .setFromObject(mover.userData.head)
    .getCenter(new T.Vector3());
  assert.ok(after.y - before.y > 0.19, 'head was not baked into the torso');
  assert.ok(gameAvatar(0).userData.armR.getObjectByName('worker-hand'));
});
