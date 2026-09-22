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
/** Shoulder-local paths peak exactly on the authoritative contact frame. */
export function strikeMotion(move: Move, elapsed: number, side: number) {
  const profile = MOVES[move],
    guard = guardFist(side);
  const load: Point =
    move === 'hook' ? [side * 0.35, 0.08, 0.17] : [side * 0.07, 0.13, 0.19];
  const contact: Point =
    move === 'hook'
      ? [-side * 0.22, 0.26, 0.84]
      : [-side * 0.12, 0.28, move === 'cross' ? 1.02 : 0.92];
  const progress = Math.max(0, Math.min(1, elapsed / profile.windup));
  let fist: Point, drive: number;
  if (elapsed <= profile.windup) {
    drive = smooth(Math.max(0, (progress - 0.3) / 0.7));
    fist =
      progress < 0.3
        ? mix(guard, load, smooth(progress / 0.3))
        : mix(load, contact, drive);
    if (move === 'hook') fist[0] += side * Math.sin(drive * Math.PI) * 0.22;
  } else {
    const recovery = smooth(
      Math.min(
        1,
        (elapsed - profile.windup) / (profile.duration - profile.windup),
      ),
    );
    fist = mix(contact, guard, recovery);
    drive = 1 - recovery;
  }
  return { fist, drive };
}
