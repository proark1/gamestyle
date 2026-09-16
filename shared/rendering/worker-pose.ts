import type * as T from 'three';

export type WorkerPose = 'still' | 'walk' | 'wave' | 'hero';

/**
 * Poses the shared worker in different movement modes and character positions.
 * Manipulates the rigged limbs and torso (userData.body, legL, legR, armL, armR)
 * while preserving joint anchors and cosmetic parentage.
 */
export function poseWorker(
  model: T.Object3D,
  time: number,
  pose: WorkerPose = 'still',
) {
  const rig = model.userData as {
    body?: T.Group;
    legL?: T.Group;
    legR?: T.Group;
    armL?: T.Group;
    armR?: T.Group;
  };
  if (!rig.body || !rig.legL || !rig.legR || !rig.armL || !rig.armR) return;

  switch (pose) {
    case 'walk': {
      // Natural walking stride loop with alternating limbs and torso bounce
      const stride = time * 7.5;
      const swing = Math.sin(stride) * 0.55;
      rig.legL.rotation.set(swing, 0, 0);
      rig.legR.rotation.set(-swing, 0, 0);
      rig.armL.rotation.set(-swing * 0.6, 0, 0.08);
      rig.armR.rotation.set(swing * 0.6, 0, -0.08);
      rig.body.position.y = Math.abs(Math.sin(stride)) * 0.035;
      rig.body.rotation.set(
        0,
        Math.sin(stride) * 0.025,
        Math.sin(stride) * 0.02,
      );
      break;
    }
    case 'wave': {
      // Cheerful greeting wave: left arm resting, right arm waving up high
      rig.legL.rotation.set(0, 0, 0.05);
      rig.legR.rotation.set(0, 0, -0.05);
      rig.armL.rotation.set(0, 0, 0.12);
      const wave = Math.sin(time * 9) * 0.28;
      rig.armR.rotation.set(-2.45, 0, -0.4 + wave);
      rig.body.position.y = Math.sin(time * 2) * 0.01;
      rig.body.rotation.set(0, 0, -0.04);
      break;
    }
    case 'hero': {
      // Confident hero pose: hands on hips, wide stance, proud chest
      rig.legL.rotation.set(0, 0, 0.08);
      rig.legR.rotation.set(0, 0, -0.08);
      rig.armL.rotation.set(0.18, 0.22, 0.55);
      rig.armR.rotation.set(0.18, -0.22, -0.55);
      rig.body.position.y = 0.02 + Math.sin(time * 2) * 0.008;
      rig.body.rotation.set(-0.04, 0, 0);
      break;
    }
    case 'still':
    default: {
      // Standing upright with calm, natural breathing/idle sway
      rig.legL.rotation.set(0, 0, 0);
      rig.legR.rotation.set(0, 0, 0);
      rig.armL.rotation.set(0, 0, 0.08);
      rig.armR.rotation.set(0, 0, -0.08);
      rig.body.position.y = Math.sin(time * 2) * 0.012;
      rig.body.rotation.set(0, 0, Math.sin(time * 1.5) * 0.008);
      break;
    }
  }
}
