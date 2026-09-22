import { PerspectiveCamera, Vector3 } from 'three';
import type { World } from './types';

const direction = new Vector3(1.25, 0.85, 0.35).normalize();
const right = new Vector3(direction.z, 0, -direction.x).normalize();
const up = new Vector3().crossVectors(direction, right);
const tanHalfFov = Math.tan((40 * Math.PI) / 360);

/** Keep both bodies in the clear space between the score and action panels. */
export function fightCameraFrame(world: World | null, aspect: number) {
  const safeAspect = Math.max(0.25, aspect);
  const close = world?.phase === 'playing' && !!world.grapple;
  if (!close || !world || world.players.length !== 2) {
    const distance = Math.max(17, 13 / safeAspect);
    return {
      close: false,
      target: new Vector3(),
      position: new Vector3(0, distance * 0.85, distance * 0.78),
    };
  }
  const [a, b] = world.players;
  const ground = world.grapple!.mode !== 'clinch';
  const target = new Vector3(
    (a.x + b.x) / 2,
    ground ? 0.78 : 1,
    (a.z + b.z) / 2 - (ground ? 0.38 : 0),
  );
  const halfX = Math.abs(a.x - b.x) / 2 + (ground ? 0.62 : 0.8);
  const halfZ = Math.abs(a.z - b.z) / 2 + (ground ? 0.88 : 0.8);
  let distance = 5;
  // Fit the actual pair, including at the cage edge and in portrait orientation.
  for (const x of [-halfX, halfX])
    for (const y of [-0.78, ground ? 0.8 : 1.05])
      for (const z of [-halfZ, halfZ]) {
        const corner = new Vector3(x, y, z);
        const depth = corner.dot(direction);
        distance = Math.max(
          distance,
          depth +
            Math.abs(corner.dot(right)) / (tanHalfFov * safeAspect * 0.84),
          depth + Math.abs(corner.dot(up)) / (tanHalfFov * 0.43),
        );
      }
  return {
    close: true,
    target,
    position: target.clone().addScaledVector(direction, distance),
  };
}

export class FightCamera {
  private target = new Vector3();
  private focus = 0;
  private ready = false;

  update(
    camera: PerspectiveCamera,
    world: World | null,
    dt: number,
    reduced: boolean,
  ) {
    const frame = fightCameraFrame(world, camera.aspect);
    const blend =
      !this.ready || reduced ? 1 : 1 - Math.exp(-Math.max(0, dt) * 5);
    camera.position.lerp(frame.position, blend);
    this.target.lerp(frame.target, blend);
    this.focus += ((frame.close ? 1 : 0) - this.focus) * blend;
    // Lift the fighters above the taller ground-control panel, without orbiting.
    const width = 1000 * camera.aspect;
    camera.setViewOffset(width, 1000, 0, 65 * this.focus, width, 1000);
    camera.lookAt(this.target);
    this.ready = true;
    return this.focus;
  }
}
