export type Solid = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  bottom?: number;
  rotation?: number;
};
export const TRUCK = {
  x: 7.5,
  z: -6,
  rotation: -0.3,
  w: 2.05,
  d: 3.85,
  h: 1.96,
};
export const BOARD = {
  x: -2.8,
  z: -5.7,
  w: 2.5,
  d: 0.12,
  h: 2.85,
  bottom: 1.35,
};
export const CONES = [
  [-4.5, 4.6],
  [4.2, 4.6],
  [6.4, -4.2],
];
export function insideSolid(s: Solid, x: number, z: number, radius = 0.2) {
  const a = s.rotation ?? 0,
    dx = x - s.x,
    dz = z - s.z;
  const localX = dx * Math.cos(a) - dz * Math.sin(a),
    localZ = dx * Math.sin(a) + dz * Math.cos(a);
  return (
    Math.abs(localX) < s.w / 2 + radius && Math.abs(localZ) < s.d / 2 + radius
  );
}
export function blocksWalker(s: Solid, x: number, z: number, feet: number) {
  return (
    s.h > feet + 0.31 && (s.bottom ?? 0) < feet + 1.55 && insideSolid(s, x, z)
  );
}
