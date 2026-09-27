export const RIDER_RADIUS = 0.48;

export type CircleCollider = {
  id: string;
  shape: 'circle';
  x: number;
  z: number;
  radius: number;
  height: number;
  source: 'snowball' | 'gate' | 'feature' | 'scenery';
};

export type BoxCollider = {
  id: string;
  shape: 'box';
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  height: number;
  source: 'snowbank' | 'feature' | 'scenery';
};

export type Collider = CircleCollider | BoxCollider;
export type SweepPoint = { x: number; z: number };
export type SweepHit = {
  collider: Collider;
  time: number;
  x: number;
  z: number;
  normalX: number;
  normalZ: number;
  directness: number;
};

type RawHit = {
  time: number;
  normalX: number;
  normalZ: number;
  x?: number;
  z?: number;
};

function circleHit(
  start: SweepPoint,
  end: SweepPoint,
  collider: CircleCollider,
  padding: number,
): RawHit | null {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const ox = start.x - collider.x;
  const oz = start.z - collider.z;
  const radius = collider.radius + padding;
  const a = dx * dx + dz * dz;
  const c = ox * ox + oz * oz - radius * radius;

  if (c <= 0) {
    const length = Math.hypot(ox, oz);
    const normalX = length ? ox / length : dx ? -Math.sign(dx) : 1;
    const normalZ = length ? oz / length : dx ? 0 : -Math.sign(dz || 1);
    return {
      time: 0,
      normalX,
      normalZ,
      x: collider.x + normalX * radius,
      z: collider.z + normalZ * radius,
    };
  }
  if (a <= 1e-9) return null;
  const b = 2 * (ox * dx + oz * dz);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (time < 0 || time > 1) return null;
  const x = start.x + dx * time;
  const z = start.z + dz * time;
  const length = Math.hypot(x - collider.x, z - collider.z) || 1;
  return {
    time,
    normalX: (x - collider.x) / length,
    normalZ: (z - collider.z) / length,
  };
}

function boxHit(
  start: SweepPoint,
  end: SweepPoint,
  collider: BoxCollider,
  padding: number,
): RawHit | null {
  const halfX = collider.halfX + padding;
  const halfZ = collider.halfZ + padding;
  const minX = collider.x - halfX;
  const maxX = collider.x + halfX;
  const minZ = collider.z - halfZ;
  const maxZ = collider.z + halfZ;
  const dx = end.x - start.x;
  const dz = end.z - start.z;

  if (
    start.x >= minX &&
    start.x <= maxX &&
    start.z >= minZ &&
    start.z <= maxZ
  ) {
    const faces = [
      { distance: start.x - minX, normalX: -1, normalZ: 0 },
      { distance: maxX - start.x, normalX: 1, normalZ: 0 },
      { distance: start.z - minZ, normalX: 0, normalZ: -1 },
      { distance: maxZ - start.z, normalX: 0, normalZ: 1 },
    ];
    faces.sort((a, b) => a.distance - b.distance);
    const face = faces[0];
    return {
      time: 0,
      normalX: face.normalX,
      normalZ: face.normalZ,
      x: face.normalX < 0 ? minX : face.normalX > 0 ? maxX : start.x,
      z: face.normalZ < 0 ? minZ : face.normalZ > 0 ? maxZ : start.z,
    };
  }

  let near = 0;
  let far = 1;
  let normalX = 0;
  let normalZ = 0;
  for (const axis of [
    { start: start.x, delta: dx, min: minX, max: maxX, x: true },
    { start: start.z, delta: dz, min: minZ, max: maxZ, x: false },
  ]) {
    if (Math.abs(axis.delta) < 1e-9) {
      if (axis.start < axis.min || axis.start > axis.max) return null;
      continue;
    }
    const first = (axis.min - axis.start) / axis.delta;
    const second = (axis.max - axis.start) / axis.delta;
    const axisNear = Math.min(first, second);
    const axisFar = Math.max(first, second);
    if (axisNear > near) {
      near = axisNear;
      const normal = first < second ? -1 : 1;
      normalX = axis.x ? normal : 0;
      normalZ = axis.x ? 0 : normal;
    }
    far = Math.min(far, axisFar);
    if (near > far) return null;
  }
  return near >= 0 && near <= 1 ? { time: near, normalX, normalZ } : null;
}

export function sweepCollider(
  start: SweepPoint,
  end: SweepPoint,
  collider: Collider,
  padding = RIDER_RADIUS,
): SweepHit | null {
  const hit =
    collider.shape === 'circle'
      ? circleHit(start, end, collider, padding)
      : boxHit(start, end, collider, padding);
  if (!hit) return null;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz) || 1;
  return {
    collider,
    time: hit.time,
    x: hit.x ?? start.x + dx * hit.time,
    z: hit.z ?? start.z + dz * hit.time,
    normalX: hit.normalX,
    normalZ: hit.normalZ,
    directness: Math.max(0, -(dx * hit.normalX + dz * hit.normalZ) / length),
  };
}

export function firstSweepHit(
  start: SweepPoint,
  end: SweepPoint,
  colliders: readonly Collider[],
  height: number,
) {
  let earliest: SweepHit | null = null;
  for (const collider of colliders) {
    if (height > collider.height) continue;
    const hit = sweepCollider(start, end, collider);
    if (hit && (!earliest || hit.time < earliest.time)) earliest = hit;
  }
  return earliest;
}
