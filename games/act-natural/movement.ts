import { FENCE_CONTACT } from './fence';
import { coverBlocks } from './visibility';
import type { CowInput, Point } from './types';

export const FARMER_SPEED = 3.5;

/** Normalize before sending: per-axis server clamps must not skew camera-relative diagonals. */
export function farmCameraInput(
  x: number,
  z: number,
  yaw: number,
  graze: boolean,
): CowInput {
  const length = Math.max(1, Math.hypot(x, z));
  return {
    x: (x * Math.cos(yaw) + z * Math.sin(yaw)) / length,
    z: (-x * Math.sin(yaw) + z * Math.cos(yaw)) / length,
    graze,
  };
}

/** Shared by the authoritative simulation and local movement prediction. */
export function farmMove(
  body: Point & { angle: number },
  input: Point,
  speed: number,
  dt: number,
  solidCover = false,
) {
  const length = Math.hypot(input.x, input.z);
  if (length < 0.05) return false;
  const factor = (speed * dt) / Math.max(1, length);
  const nextX = Math.max(
    -FENCE_CONTACT,
    Math.min(FENCE_CONTACT, body.x + input.x * factor),
  );
  const nextZ = Math.max(
    -FENCE_CONTACT,
    Math.min(FENCE_CONTACT, body.z + input.z * factor),
  );
  const oldX = body.x,
    oldZ = body.z;
  if (!solidCover || !coverBlocks({ x: nextX, z: body.z })) body.x = nextX;
  if (!solidCover || !coverBlocks({ x: body.x, z: nextZ })) body.z = nextZ;
  body.angle = Math.atan2(input.x, input.z);
  return body.x !== oldX || body.z !== oldZ;
}
