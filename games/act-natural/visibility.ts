import { cowExposed, shockAge, SHOCK_STUN_MS } from './fence';
import { farmMode, type Cow, type FarmWorld, type Point } from './types';

// These footprints also build the visible hay stacks and stop movement.
export const FARM_COVER = [
  { x: -6, z: -3.8, width: 3, depth: 1.4 },
  { x: 6, z: -3.8, width: 3, depth: 1.4 },
  { x: -6.6, z: 2.6, width: 1.4, depth: 3 },
  { x: 4.1, z: 4.8, width: 1.4, depth: 3 },
] as const;
export const SIGHT_RANGE = 7;
export const SIGHT_HALF_ANGLE = 1.1;
export const NEAR_SIGHT = 1.2;
type SightWorld = Pick<FarmWorld, 'farmer' | 'mode' | 'practice'>;

function rayBox(
  from: Point,
  direction: Point,
  cover: (typeof FARM_COVER)[number],
) {
  let near = 0,
    far = Infinity;
  for (const axis of ['x', 'z'] as const) {
    const size = axis === 'x' ? cover.width : cover.depth;
    const low = cover[axis] - size / 2,
      high = cover[axis] + size / 2;
    if (Math.abs(direction[axis]) < 1e-8) {
      if (from[axis] < low || from[axis] > high) return Infinity;
    } else {
      const a = (low - from[axis]) / direction[axis];
      const b = (high - from[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return Infinity;
    }
  }
  return near;
}
export function sightDistance(world: SightWorld, angle: number) {
  const relative = Math.atan2(
    Math.sin(angle - world.farmer.angle),
    Math.cos(angle - world.farmer.angle),
  );
  // The rendered boundary is Float32; tolerate sub-pixel rounding at its cone edge.
  let range =
    Math.abs(relative) <= SIGHT_HALF_ANGLE + 0.000001
      ? SIGHT_RANGE
      : NEAR_SIGHT;
  if (farmMode(world) === 'human') {
    const direction = { x: Math.sin(angle), z: Math.cos(angle) };
    for (const cover of FARM_COVER)
      range = Math.min(range, rayBox(world.farmer, direction, cover));
  }
  return range;
}
export function farmerSees(world: SightWorld, point: Point) {
  const dx = point.x - world.farmer.x,
    dz = point.z - world.farmer.z;
  return Math.hypot(dx, dz) <= sightDistance(world, Math.atan2(dx, dz)) + 0.001;
}
export function revealedToFarmer(
  world: SightWorld & Pick<FarmWorld, 'clock'>,
  cow: Cow,
) {
  return (
    cowExposed(cow, world.clock) ||
    shockAge(cow, world.clock) < SHOCK_STUN_MS ||
    farmerSees(world, cow)
  );
}
export function coverBlocks(point: Point, radius = 0.45) {
  return FARM_COVER.some(
    (c) =>
      Math.abs(point.x - c.x) < c.width / 2 + radius &&
      Math.abs(point.z - c.z) < c.depth / 2 + radius,
  );
}
export function clearCoverPosition(point: Point) {
  for (const cover of FARM_COVER) {
    if (
      Math.abs(point.x - cover.x) >= cover.width / 2 + 0.5 ||
      Math.abs(point.z - cover.z) >= cover.depth / 2 + 0.5
    )
      continue;
    const dx = cover.width / 2 + 0.5 - Math.abs(point.x - cover.x);
    const dz = cover.depth / 2 + 0.5 - Math.abs(point.z - cover.z);
    if (dx < dz)
      point.x =
        cover.x + (point.x < cover.x ? -1 : 1) * (cover.width / 2 + 0.5);
    else
      point.z =
        cover.z + (point.z < cover.z ? -1 : 1) * (cover.depth / 2 + 0.5);
  }
}
export function visionBoundary(world: SightWorld) {
  const angles = Array.from(
    { length: 129 },
    (_, i) => -Math.PI + (i * Math.PI * 2) / 128,
  );
  angles.push(
    -SIGHT_HALF_ANGLE - 0.001,
    -SIGHT_HALF_ANGLE,
    SIGHT_HALF_ANGLE,
    SIGHT_HALF_ANGLE + 0.001,
  );
  for (const cover of FARM_COVER)
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const angle =
          Math.atan2(
            cover.x + (x * cover.width) / 2 - world.farmer.x,
            cover.z + (z * cover.depth) / 2 - world.farmer.z,
          ) - world.farmer.angle;
        const relative = Math.atan2(Math.sin(angle), Math.cos(angle));
        // Trace either side of corners; an exact tangent is ambiguous after Float32 upload.
        angles.push(relative - 0.0001, relative + 0.0001);
      }
  return angles
    .sort((a, b) => a - b)
    .map((relative) => {
      const angle = relative + world.farmer.angle,
        range = sightDistance(world, angle);
      return {
        x: world.farmer.x + Math.sin(angle) * range,
        z: world.farmer.z + Math.cos(angle) * range,
      };
    });
}
