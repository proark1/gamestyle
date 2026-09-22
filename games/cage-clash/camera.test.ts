import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { FightCamera, fightCameraFrame } from './camera';
import { freshWorld } from './simulation';

function grapple() {
  const w = freshWorld(1);
  w.phase = 'playing';
  w.players[0].x = w.players[1].x = 0;
  w.players[0].z = -0.34;
  w.players[1].z = 0.34;
  w.grapple = {
    mode: 'guard',
    top: w.players[0].id,
    age: 1,
    progress: 0,
    submissionBy: null,
    submission: 0,
    cooldown: 0,
    still: 0,
  };
  return w;
}

void test('close framing keeps both fighters clear of screen edges and HUD on phones and desktops', () => {
  for (const aspect of [390 / 844, 320 / 740, 16 / 9, 844 / 390]) {
    for (const mode of ['clinch', 'guard', 'mount'] as const) {
      for (const [x, z] of [
        [0, 0],
        [4, 1.5],
        [-3, -3],
      ]) {
        const w = grapple();
        w.grapple!.mode = mode;
        for (const p of w.players) {
          p.x += x;
          p.z += z;
        }
        const camera = new PerspectiveCamera(40, aspect, 0.1, 120);
        new FightCamera().update(camera, w, 1 / 60, false);
        camera.updateMatrixWorld();
        const frame = fightCameraFrame(w, aspect);
        const halfZ = 0.34 + (mode === 'clinch' ? 0.8 : 0.88);
        const halfX = mode === 'clinch' ? 0.8 : 0.62;
        for (const dx of [-halfX, halfX])
          for (const dy of [-0.78, mode === 'clinch' ? 1.05 : 0.8])
            for (const dz of [-halfZ, halfZ]) {
              const projected = frame.target
                .clone()
                .add(new Vector3(dx, dy, dz))
                .project(camera);
              assert.ok(
                Math.abs(projected.x) <= 0.841,
                `horizontal framing ${aspect}`,
              );
              assert.ok(
                projected.y >= -0.301 && projected.y <= 0.561,
                `HUD clearance ${projected.y}`,
              );
              assert.ok(
                projected.z > -1 && projected.z < 1,
                'near/far clipping',
              );
            }
        assert.ok(
          frame.position.distanceTo(frame.target) <
            fightCameraFrame(null, aspect).position.length(),
        );
      }
    }
  }
});

void test('reversals preserve the camera angle; escape and round breaks restore the arena', () => {
  const w = grapple();
  const initial = fightCameraFrame(w, 16 / 9);
  w.grapple!.top = w.players[1].id;
  assert.deepEqual(fightCameraFrame(w, 16 / 9), initial);
  const controller = new FightCamera();
  const camera = new PerspectiveCamera(40, 16 / 9, 0.1, 120);
  controller.update(camera, w, 1 / 60, false);
  w.grapple = null;
  const wide = fightCameraFrame(w, camera.aspect);
  const before = camera.position.clone();
  controller.update(camera, w, 1 / 60, false);
  assert.ok(camera.position.distanceTo(before) > 0);
  assert.ok(camera.position.distanceTo(wide.position) > 1, 'return is eased');
  for (let i = 0; i < 180; i++) controller.update(camera, w, 1 / 60, false);
  assert.ok(camera.position.distanceTo(wide.position) < 0.001);
  const next = grapple();
  next.phase = 'break';
  assert.equal(fightCameraFrame(next, camera.aspect).close, false);
});

void test('reduced motion switches immediately and resize remains finite', () => {
  const w = grapple();
  const controller = new FightCamera();
  const camera = new PerspectiveCamera(40, 16 / 9, 0.1, 120);
  controller.update(camera, null, 0, false);
  controller.update(camera, w, 0, true);
  assert.ok(
    camera.position.distanceTo(fightCameraFrame(w, camera.aspect).position) <
      1e-10,
  );
  camera.aspect = 390 / 844;
  controller.update(camera, w, 0, true);
  assert.ok(
    camera.position.distanceTo(fightCameraFrame(w, camera.aspect).position) <
      1e-10,
  );
  w.grapple = null;
  controller.update(camera, w, 0, true);
  assert.ok(
    camera.position.distanceTo(fightCameraFrame(null, camera.aspect).position) <
      1e-10,
  );
});
