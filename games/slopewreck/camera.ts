import { clamp } from '../../shared/math/clamp';
import { courseFrame, coursePoint } from './course';

export type CameraRider = {
  x: number;
  z: number;
  height: number;
  speed: number;
  steer?: number;
};

export type CameraFrame = {
  fov: number;
  roll: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

export function smoothCameraSteer(
  current: number,
  target: number,
  dt: number,
) {
  const from = clamp(Number.isFinite(current) ? current : 0, -1, 1);
  const to = clamp(Number.isFinite(target) ? target : 0, -1, 1);
  const elapsed = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  return mix(from, to, 1 - Math.exp(-elapsed * 5));
}

export function slopeCameraFrame(rider: CameraRider): CameraFrame {
  const pace = clamp((rider.speed - 5) / 14, 0, 1);
  const behind = mix(15, 18, pace);
  const height = mix(12.5, 14, pace);
  const lookAhead = mix(70, 88, pace);
  const position = coursePoint(rider.x * 0.58, rider.z - behind);
  const riderGround = coursePoint(rider.x, rider.z);
  const target = coursePoint(
    rider.x * 0.26 + clamp(rider.steer ?? 0, -1, 1) * 2.4,
    rider.z + lookAhead,
    -7 + rider.height * 0.06,
  );
  position.y = riderGround.y + height + rider.height * 0.2;

  return {
    fov: mix(60, 65, pace),
    roll: courseFrame(rider.z + lookAhead * 0.3).bank * 0.32,
    position,
    target,
  };
}
