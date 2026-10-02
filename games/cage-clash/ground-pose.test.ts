import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';
import { groundPose } from './ground-pose';

void test('the lower fighter lies face up and the upper fighter faces toward their head', () => {
  for (const mount of [false, true]) {
    const below = groundPose(false, mount),
      above = groundPose(true, mount);
    const lowerRotation = new Euler(...below.rotation, 'YXZ');
    const upperRotation = new Euler(...above.rotation, 'YXZ');
    const faceUp = new Vector3(0, 0, 1).applyEuler(lowerRotation);
    const lowerHeadDirection = new Vector3(0, 1, 0).applyEuler(lowerRotation);
    const upperFace = new Vector3(0, 0, 1).applyEuler(upperRotation);
    assert.ok(faceUp.y > 0.99, 'face must point away from the mat');
    assert.ok(lowerHeadDirection.z < -0.99);
    assert.ok(upperFace.z < -0.8, 'upper fighter looks toward the lower head');
    assert.ok(
      upperFace.y < -0.5,
      'upper fighter leans down toward the opponent',
    );
    assert.ok(
      above.knee(-1)[0] < -0.4 && above.knee(1)[0] > 0.4,
      'knees straddle the body',
    );
    assert.ok(
      above.ankle(1)[2] > above.knee(1)[2],
      'feet fold behind the knees',
    );
    for (const pose of [above, below])
      for (const side of [-1, 1]) {
        assert.ok(pose.knee(side)[1] >= 0.13);
        assert.ok(pose.ankle(side)[1] >= 0.13);
      }
  }
});

void test('guard wraps the raised legs around the upper fighter; mount releases them to the mat', () => {
  const guard = groundPose(false, false),
    mount = groundPose(false, true);
  assert.ok(guard.knee(1)[1] > mount.knee(1)[1] + 0.4);
  assert.ok(guard.ankle(1)[2] < guard.knee(1)[2]);
  assert.ok(mount.ankle(1)[2] > mount.knee(1)[2]);
});
