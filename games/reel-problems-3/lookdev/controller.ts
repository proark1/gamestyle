import type { LookdevInput, LookdevStats, PlayerPose } from './types';

export const START_POSE: PlayerPose = {
  x: 0,
  z: 13.5,
  yaw: 0,
  pitch: -0.04,
};

export type MovementBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const ISLAND_BOUNDS: MovementBounds = {
  minX: -12.5,
  maxX: 12.5,
  minZ: -12.5,
  maxZ: 16,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function movePose(
  pose: PlayerPose,
  input: LookdevInput,
  deltaSeconds: number,
  bounds: MovementBounds = ISLAND_BOUNDS,
): PlayerPose {
  const length = Math.hypot(input.strafe, input.forward) || 1;
  const strafe = input.strafe / length;
  const forward = input.forward / length;
  const speed = input.sprint ? 5.8 : 3.7;
  const distance = Math.min(0.08, Math.max(0, deltaSeconds)) * speed;
  const dx =
    (Math.cos(pose.yaw) * strafe - Math.sin(pose.yaw) * forward) * distance;
  const dz =
    (-Math.sin(pose.yaw) * strafe - Math.cos(pose.yaw) * forward) * distance;
  return {
    ...pose,
    x: clamp(pose.x + dx, bounds.minX, bounds.maxX),
    z: clamp(pose.z + dz, bounds.minZ, bounds.maxZ),
  };
}

export function lookPose(
  pose: PlayerPose,
  deltaX: number,
  deltaY: number,
): PlayerPose {
  return {
    ...pose,
    yaw: pose.yaw - deltaX * 0.00225,
    pitch: clamp(pose.pitch - deltaY * 0.00225, -1.08, 1.18),
  };
}

export function summarizeFrames(frameTimes: readonly number[]): LookdevStats {
  if (!frameTimes.length) return { fps: 0, frameMs: 0 };
  let total = 0;
  for (const frame of frameTimes) total += Math.max(0, frame);
  const frameMs = total / frameTimes.length;
  return {
    fps: frameMs > 0 ? Math.round(1000 / frameMs) : 0,
    frameMs: Math.round(frameMs * 10) / 10,
  };
}
