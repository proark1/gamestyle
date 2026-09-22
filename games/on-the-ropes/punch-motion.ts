import { PUNCHES } from './combat';

export type PunchKind = keyof typeof PUNCHES;
export type Point = [number, number, number];
export const guardFist = (side: number): Point => [side * 0.055, 0.17, 0.3];
const smooth = (n: number) => n * n * (3 - 2 * n);
const mix = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Shoulder-local glove paths. Every punch reaches contact on its simulation hit frame. */
export function punchMotion(kind: PunchKind, elapsed: number, side: number) {
  const profile = PUNCHES[kind];
  const guard = guardFist(side);
  const load: Point =
    kind === 'uppercut'
      ? [side * 0.06, -0.26, 0.22]
      : kind === 'hook'
        ? [side * 0.38, 0.12, 0.2]
        : [side * 0.07, 0.13, 0.19];
  const contact: Point =
    kind === 'uppercut'
      ? [-side * 0.16, 0.48, 0.65]
      : kind === 'hook'
        ? [-side * 0.22, 0.29, 0.86]
        : [-side * 0.13, 0.3, kind === 'cross' ? 1.03 : 0.94];
  const progress = Math.max(0, Math.min(1, elapsed / profile.windup));
  let fist: Point;
  let drive: number;
  if (elapsed <= profile.windup) {
    drive = smooth(Math.max(0, (progress - 0.3) / 0.7));
    fist =
      progress < 0.3
        ? mix(guard, load, smooth(progress / 0.3))
        : mix(load, contact, drive);
    // The hook sweeps around the guard; the uppercut scoops up from below it.
    if (kind === 'hook') fist[0] += side * Math.sin(drive * Math.PI) * 0.22;
    if (kind === 'uppercut') fist[2] += Math.sin(drive * Math.PI) * 0.17;
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
