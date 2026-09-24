import { clamp } from '../../shared/math/clamp';
import { slopeY } from './types';

export type CameraRider = {
  x: number;
  z: number;
  height: number;
  speed: number;
};

export type CameraFrame = {
  fov: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

export function slopeCameraFrame(rider: CameraRider): CameraFrame {
  const pace = clamp((rider.speed - 5) / 14, 0, 1);
  const behind = mix(14, 17, pace);
  const height = mix(12.5, 14.5, pace);
  const lookAhead = mix(34, 40, pace);

  return {
    fov: mix(59, 64, pace),
    position: {
      x: rider.x * 0.62,
      y: slopeY(rider.z) + height + rider.height * 0.24,
      z: rider.z - behind,
    },
    target: {
      x: rider.x * 0.34,
      y: slopeY(rider.z + lookAhead) - 0.65 + rider.height * 0.08,
      z: rider.z + lookAhead,
    },
  };
}
