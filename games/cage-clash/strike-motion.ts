import { MOVES } from './combat';
import type { Move } from './types';
export type Point = [number, number, number];
export const guardFist = (side: number): Point => [side * 0.055, 0.17, 0.3];
const smooth = (n: number) => n * n * (3 - 2 * n);
const mix = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Shoulder-local paths peak exactly on the authoritative contact frame. */
export function strikeMotion(move: Move, elapsed: number, side: number) {
  const profile = MOVES[move],
    guard = guardFist(side);
  const load: Point =
    move === 'hook' ? [side * 0.2, 0.13, 0.2] : [side * 0.08, 0.15, 0.24];
  const contact: Point =
    move === 'hook'
      ? [-side * 0.12, 0.2, 0.63]
      : [-side * 0.08, 0.23, move === 'cross' ? 1.04 : 0.8];
  const progress = clamp(elapsed / profile.windup);
  let fist: Point, drive: number;
  if (elapsed <= profile.windup) {
    drive = smooth(clamp((progress - 0.18) / 0.82));
    fist =
      progress < 0.18
        ? mix(guard, load, smooth(progress / 0.18))
        : mix(load, contact, drive);
    if (move === 'hook') fist[0] += side * Math.sin(drive * Math.PI) * 0.28;
  } else {
    const recovery = smooth(
      clamp((elapsed - profile.windup) / (profile.duration - profile.windup)),
    );
    fist = mix(contact, guard, recovery);
    drive = 1 - recovery;
  }
  const elbow: Point =
    move === 'hook'
      ? [
          side * (0.16 + drive * 0.14),
          -0.08 + drive * 0.26,
          0.13 + drive * 0.28,
        ]
      : [
          side * (0.1 - drive * 0.04) + fist[0] * 0.2,
          -0.15 + drive * 0.12,
          0.08 + drive * (move === 'cross' ? 0.28 : 0.23),
        ];
  return { fist, elbow, drive };
}

/** An articulated right roundhouse: chamber the knee, turn the hip, then whip the shin. */
export function kickMotion(elapsed: number) {
  const profile = MOVES.kick;
  const restKnee: Point = [0, -0.25, 0];
  const restAnkle: Point = [0, -0.48, 0.04];
  const chamberKnee: Point = [0.12, -0.09, 0.31];
  const chamberAnkle: Point = [0.12, -0.31, 0.37];
  const contactKnee: Point = [0.24, -0.03, 0.47];
  const contactAnkle: Point = [-0.13, 0.02, 0.83];
  const progress = clamp(elapsed / profile.windup);
  let knee: Point, ankle: Point, drive: number;
  if (elapsed <= profile.windup) {
    if (progress < 0.38) {
      const chamber = smooth(progress / 0.38);
      knee = mix(restKnee, chamberKnee, chamber);
      ankle = mix(restAnkle, chamberAnkle, chamber);
      drive = chamber * 0.35;
    } else {
      const extension = smooth((progress - 0.38) / 0.62);
      knee = mix(chamberKnee, contactKnee, extension);
      ankle = mix(chamberAnkle, contactAnkle, extension);
      drive = 0.35 + extension * 0.65;
    }
  } else {
    const recovery = smooth(
      clamp((elapsed - profile.windup) / (profile.duration - profile.windup)),
    );
    knee = mix(contactKnee, restKnee, recovery);
    ankle = mix(contactAnkle, restAnkle, recovery);
    drive = 1 - recovery;
  }
  return { knee, ankle, drive };
}
