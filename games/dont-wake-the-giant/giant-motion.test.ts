import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Box3 } from 'three';
import {
  giantJoints,
  THIGH,
  SHIN,
  UPPER_ARM,
  FOREARM,
  solveJoint,
} from './giant-motion';
import { GiantModel } from './giant-model';
import { freshGiant } from './simulation';
import { armPosition, platforms } from './level';
import { ESCAPE, type Vec } from './types';

const distance = (a: Vec, b: Vec) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const close = (actual: number, expected: number, message: string) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `${message}: ${actual} != ${expected}`,
  );
function waking() {
  const w = freshGiant(100000);
  w.phase = 'escape';
  w.escapeAt = 100000 + ESCAPE;
  return w;
}

void test('every waking frame preserves bone lengths and has continuous joints for either arm crossing', () => {
  for (const armZ of [-2.5, 0.7]) {
    const w = waking();
    let previous: Vec[] | undefined;
    for (let elapsed = 0; elapsed <= ESCAPE; elapsed += 20) {
      w.clock = 100000 + elapsed;
      const pose = giantJoints(w, armZ);
      for (const leg of pose.legs) {
        close(distance(leg.hip, leg.knee), THIGH, 'thigh');
        close(distance(leg.knee, leg.ankle), SHIN, 'shin');
        assert.ok(
          leg.ankle.y >= 2.98 - 1e-6,
          'ankles cannot sink into the bed',
        );
      }
      for (const arm of pose.arms) {
        close(distance(arm.shoulder, arm.elbow), UPPER_ARM, 'upper arm');
        close(distance(arm.elbow, arm.wrist), FOREARM, 'forearm');
      }
      const points = [
        ...pose.legs.flatMap((leg) => [leg.hip, leg.knee, leg.ankle]),
        ...pose.arms.flatMap((arm) => [arm.shoulder, arm.elbow, arm.wrist]),
      ];
      if (previous)
        points.forEach((point, i) =>
          assert.ok(
            distance(point, previous![i]) < 0.2,
            `joint ${i} snaps at ${elapsed} ms`,
          ),
        );
      previous = points;
    }
  }
});

void test('the staggered feet finish planting before the hip rises and remain locked throughout escape', () => {
  const w = waking();
  const model = new GiantModel(w);
  let planted: Vec[] | undefined;
  for (let elapsed = 2540; elapsed <= ESCAPE; elapsed += 80) {
    w.clock = 100000 + elapsed;
    const joints = giantJoints(w, armPosition(w));
    assert.ok(joints.legs.every((leg) => leg.planted));
    if (!planted) planted = joints.legs.map((leg) => leg.ankle);
    joints.legs.forEach((leg, i) =>
      close(distance(leg.ankle, planted![i]), 0, 'foot sliding'),
    );
    model.update(w, 1);
    model.legRigs.forEach((rig, i) => {
      const sole = new Box3().setFromObject(rig.foot);
      assert.ok(
        sole.min.y >= 2.6 - 0.001,
        'visible foot penetrates the mattress',
      );
      close(
        rig.foot
          .getWorldPosition(new Vector3())
          .distanceTo(new Vector3(planted![i].x, planted![i].y, planted![i].z)),
        0,
        'rendered ankle',
      );
    });
    const feet = platforms(w).filter((p) => p.id.startsWith('feet'));
    assert.equal(feet.length, 2);
    feet.forEach((foot) => close(foot.y - foot.h, 2.6, 'collision sole'));
    assert.ok(
      !platforms(w).some((p) => p.id === 'arm'),
      'waking arms cannot scoop fleeing players back up',
    );
  }
});

void test('reconnects reproduce the full rig and restarting immediately restores a sleeping pose', () => {
  const w = waking();
  w.clock += 3700;
  const reconstructed = JSON.parse(JSON.stringify(w));
  assert.deepEqual(
    giantJoints(reconstructed, armPosition(reconstructed)),
    giantJoints(w, armPosition(w)),
  );
  const model = new GiantModel(w);
  const sleeping = freshGiant(100000);
  model.update(sleeping, 0.1);
  const fresh = new GiantModel(sleeping);
  assert.equal(model.torso.rotation.x, 0);
  assert.deepEqual(model.torso.position, fresh.torso.position);
  model.legRigs.forEach((leg, i) =>
    assert.deepEqual(leg.foot.position, fresh.legRigs[i].foot.position),
  );
  assert.equal(model.parts.get('head')!.userData.leftEye.white.visible, false);
});

void test('unreachable and coincident IK targets remain finite without stretching or flipping', () => {
  for (const end of [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -100, z: 0 },
  ]) {
    const origin = { x: 0, y: 0, z: 0 };
    const solved = solveJoint(origin, end, THIGH, SHIN, { x: 0, y: -1, z: 0 });
    close(distance(origin, solved.joint), THIGH, 'bounded thigh');
    close(distance(solved.joint, solved.end), SHIN, 'bounded shin');
  }
});
