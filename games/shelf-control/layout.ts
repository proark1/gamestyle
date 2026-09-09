import type { Body, Point } from './types';
export const WIDTH = 14,
  DEPTH = 11,
  RADIUS = 0.36;
export const OFFICE = { x: 0, z: 9 };
export const DOOR = { x: 0, z: -10 };
export const SWITCH = { x: -12.1, z: -7.5 };
export const HATCH = { x: 12.1, z: 8.5 };
export const EQUIPMENT = [
  { id: 'key-lighting', kind: 'key' as const, x: -11, z: -3 },
  { id: 'key-living', kind: 'key' as const, x: 10.5, z: 1 },
  { id: 'ladder', kind: 'ladder' as const, x: -4, z: 7 },
];
export const OBSTACLES = [
  { x: -7, z: -2, w: 1.6, d: 11, name: 'Lighting' },
  { x: 7, z: 1, w: 1.6, d: 12, name: 'Living' },
  { x: 0, z: -5, w: 6, d: 1.3, name: 'Storage' },
  { x: -1, z: 2, w: 4.5, d: 1.8, name: 'Sofas' },
  { x: -10, z: 5, w: 4, d: 1.2, name: 'Bedroom' },
  { x: 10, z: -7, w: 4, d: 1.2, name: 'Kitchen' },
];
export const DISPLAYS: Point[] = [
  { x: -11, z: -8.8 },
  { x: -9.5, z: -4 },
  { x: -11, z: 1 },
  { x: -11, z: 8 },
  { x: -4.5, z: -8 },
  { x: -3, z: -1.5 },
  { x: -5, z: 5 },
  { x: -4, z: 8.5 },
  { x: 0, z: -8 },
  { x: 1, z: -1.8 },
  { x: 2, z: 5.5 },
  { x: 3, z: 8.5 },
  { x: 4.5, z: -7.5 },
  { x: 4.5, z: 0.5 },
  { x: 10, z: -9 },
  { x: 11, z: -3.5 },
  { x: 10, z: 2 },
  { x: 10.5, z: 6 },
];
export function blocked(p: Point, radius = RADIUS) {
  return (
    Math.abs(p.x) > WIDTH - radius ||
    Math.abs(p.z) > DEPTH - radius ||
    OBSTACLES.some(
      (b) =>
        Math.abs(p.x - b.x) < b.w / 2 + radius &&
        Math.abs(p.z - b.z) < b.d / 2 + radius,
    )
  );
}
/** Segment/AABB intersection is shared by server visibility and movement planning. */
export function clearSight(a: Point, b: Point, padding = 0) {
  return !OBSTACLES.some((box) => {
    let near = 0,
      far = 1;
    for (const axis of ['x', 'z'] as const) {
      const half = (axis === 'x' ? box.w : box.d) / 2 + padding;
      const delta = b[axis] - a[axis],
        min = box[axis] - half,
        max = box[axis] + half;
      if (Math.abs(delta) < 1e-8) {
        if (a[axis] < min || a[axis] > max) return false;
      } else {
        const t1 = (min - a[axis]) / delta,
          t2 = (max - a[axis]) / delta;
        near = Math.max(near, Math.min(t1, t2));
        far = Math.min(far, Math.max(t1, t2));
        if (near > far) return false;
      }
    }
    return far >= 0 && near <= 1;
  });
}
export function visible(observer: Body, target: Point, guard: boolean) {
  const dx = target.x - observer.x,
    dz = target.z - observer.z,
    metres = Math.hypot(dx, dz);
  if (metres > (guard ? 7.5 : 9.5) || !clearSight(observer, target))
    return false;
  return (
    !guard ||
    metres < 1.6 ||
    (Math.sin(observer.angle) * dx + Math.cos(observer.angle) * dz) /
      Math.max(0.01, metres) >=
      0.15
  );
}
export function move(body: Body, direction: Point, speed: number, dt: number) {
  const length = Math.hypot(direction.x, direction.z);
  if (length < 0.05) return false;
  const x = body.x,
    z = body.z,
    scale = (speed * dt) / Math.max(1, length);
  body.angle = Math.atan2(direction.x, direction.z);
  if (!blocked({ x: body.x + direction.x * scale, z: body.z }))
    body.x += direction.x * scale;
  if (!blocked({ x: body.x, z: body.z + direction.z * scale }))
    body.z += direction.z * scale;
  return Math.hypot(body.x - x, body.z - z) > 0.001;
}
