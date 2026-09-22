import type { Point } from './strike-motion';

/** Model faces +Z. Apply pitch before yaw so the upper fighter faces the head. */
export function groundPose(top: boolean, mount: boolean) {
  return {
    position: (top ? [0, 0.02, mount ? 0.3 : 0.62] : [0, 0.34, 0]) as Point,
    rotation: (top ? [0.62, Math.PI, 0] : [-Math.PI / 2, 0, 0]) as Point,
    knee: (side: number): Point =>
      top
        ? [side * 0.43, 0.16, mount ? 0.08 : 0.4]
        : mount
          ? [side * 0.24, 0.19, -0.12]
          : [side * 0.43, 0.68, -0.2],
    ankle: (side: number): Point =>
      top
        ? [side * 0.43, 0.13, mount ? 0.52 : 0.82]
        : mount
          ? [side * 0.25, 0.13, 0.3]
          : [side * 0.32, 0.52, -0.65],
  };
}
