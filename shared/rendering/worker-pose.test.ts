import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { worker } from './worker';
import { poseWorker } from './worker-pose';

void test('worker poses update limbs and body without detaching joints', () => {
  const model = worker(0);
  const rig = model.userData as {
    body: T.Group;
    legL: T.Group;
    legR: T.Group;
    armL: T.Group;
    armR: T.Group;
  };

  // Test 'still' pose
  poseWorker(model, 1.0, 'still');
  assert.equal(rig.legL.rotation.x, 0);
  assert.equal(rig.legR.rotation.x, 0);
  assert.ok(Math.abs(rig.body.position.y) < 0.05);

  // Test 'walk' pose: alternating legs and opposing arms
  poseWorker(model, 0.25, 'walk');
  assert.ok(
    rig.legL.rotation.x * rig.legR.rotation.x < 0,
    'legs swing in opposite directions',
  );
  assert.ok(
    rig.legL.rotation.x * rig.armL.rotation.x < 0,
    'left arm swings opposite to left leg',
  );
  assert.ok(
    rig.body.position.y >= 0,
    'walking causes positive or zero vertical bob',
  );

  // Test 'wave' pose: right arm raised up
  poseWorker(model, 1.0, 'wave');
  assert.ok(rig.armR.rotation.x < -2.0, 'right arm is raised high for wave');
  assert.ok(rig.armL.rotation.x >= 0, 'left arm stays down');

  // Test 'hero' pose: hands on hips, wide stance
  poseWorker(model, 1.0, 'hero');
  assert.ok(rig.legL.rotation.z > 0 && rig.legR.rotation.z < 0, 'legs are apart');
  assert.ok(rig.armL.rotation.z > 0.4 && rig.armR.rotation.z < -0.4, 'hands are on hips');
});
