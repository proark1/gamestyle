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
  const behind = mix(15, 18, pace);
  const height = mix(12.5, 14, pace);
  const lookAhead = mix(70, 88, pace);

  return {
    fov: mix(60, 65, pace),
    position: {
      x: rider.x * 0.58,
      y: slopeY(rider.z) + height + rider.height * 0.2,
      z: rider.z - behind,
    },
    target: {
      x: rider.x * 0.26,
      y: slopeY(rider.z + lookAhead) - 7 + rider.height * 0.06,
      z: rider.z + lookAhead,
    },
  };
}
