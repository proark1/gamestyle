import { clamp } from '../../shared/math/clamp';
import { FINISH_Z, HALF_WIDTH } from './types';

type Knot = { z: number; x: number; width?: number };

const KNOTS: readonly Knot[] = [
  { z: -40, x: 0 },
  { z: 0, x: 0 },
  { z: 62, x: -7 },
  { z: 138, x: 13 },
  { z: 214, x: -15, width: 9.4 },
  { z: 292, x: 11 },
  { z: 366, x: -9, width: 9.2 },
  { z: 444, x: 14 },
  { z: 520, x: 1 },
  { z: FINISH_Z, x: 0 },
  { z: FINISH_Z + 48, x: 0 },
] as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function knotIndex(z: number) {
  for (let i = 1; i < KNOTS.length - 2; i++) if (z <= KNOTS[i + 1].z) return i;
  return KNOTS.length - 3;
}

function hermite(
  from: number,
  to: number,
  tangentFrom: number,
  tangentTo: number,
  length: number,
  t: number,
) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * from +
    (t3 - 2 * t2 + t) * tangentFrom * length +
    (-2 * t3 + 3 * t2) * to +
    (t3 - t2) * tangentTo * length
  );
}

function tangentAt(index: number) {
  const before = KNOTS[Math.max(0, index - 1)];
  const after = KNOTS[Math.min(KNOTS.length - 1, index + 1)];
  return (after.x - before.x) / Math.max(1, after.z - before.z);
}

export function courseCenter(z: number) {
  const sample = clamp(z, KNOTS[1].z, KNOTS[KNOTS.length - 2].z);
  const i = knotIndex(sample);
  const from = KNOTS[i];
  const to = KNOTS[i + 1];
  const length = to.z - from.z;
  const t = clamp((sample - from.z) / length, 0, 1);
  return hermite(from.x, to.x, tangentAt(i), tangentAt(i + 1), length, t);
}

export function courseWidth(z: number) {
  const sample = clamp(z, 0, FINISH_Z);
  const i = knotIndex(sample);
  const from = KNOTS[i];
  const to = KNOTS[i + 1];
  const t = clamp((sample - from.z) / Math.max(1, to.z - from.z), 0, 1);
  return lerp(from.width ?? HALF_WIDTH, to.width ?? HALF_WIDTH, t);
}

export const courseY = (z: number) => 22 - z * 0.085;

export type CourseFrame = {
  centerX: number;
  centerZ: number;
  tangentX: number;
  tangentZ: number;
  sideX: number;
  sideZ: number;
  heading: number;
  bank: number;
  pitch: number;
  width: number;
};

export function courseFrame(z: number): CourseFrame {
  const before = courseCenter(z - 0.5);
  const after = courseCenter(z + 0.5);
  const derivative = after - before;
  const length = Math.hypot(derivative, 1);
  const tangentX = derivative / length;
  const tangentZ = 1 / length;
  const heading = Math.atan2(tangentX, tangentZ);
  const headingBefore = Math.atan2(courseCenter(z) - courseCenter(z - 2), 2);
  const headingAfter = Math.atan2(courseCenter(z + 2) - courseCenter(z), 2);
  const curvature = (headingAfter - headingBefore) / 4;

  return {
    centerX: courseCenter(z),
    centerZ: z,
    tangentX,
    tangentZ,
    sideX: tangentZ,
    sideZ: -tangentX,
    heading,
    bank: clamp(-curvature * 18, -0.16, 0.16),
    pitch: Math.atan(0.085),
    width: courseWidth(z),
  };
}

export type CoursePoint = { x: number; y: number; z: number };

export function coursePoint(
  lateral: number,
  distance: number,
  height = 0,
): CoursePoint {
  const frame = courseFrame(distance);
  return {
    x: frame.centerX + frame.sideX * lateral,
    y: courseY(distance) + Math.sin(frame.bank) * lateral + height,
    z: frame.centerZ + frame.sideZ * lateral,
  };
}

export function clampToCourse(lateral: number, distance: number) {
  return clamp(lateral, -courseWidth(distance), courseWidth(distance));
}
