import { clamp } from '../../shared/math/clamp';
import { FLOOR } from './geometry';
import { GOAL } from './types';

export type CranePoint = { x: number; z: number };
export const CRANE_MAP_EXTENT = 8;

export function mapToCranePoint(x: number, y: number): CranePoint {
  return {
    x: clamp(
      (x * 2 - 1) * CRANE_MAP_EXTENT,
      -CRANE_MAP_EXTENT,
      CRANE_MAP_EXTENT,
    ),
    z: clamp(
      (y * 2 - 1) * CRANE_MAP_EXTENT,
      -CRANE_MAP_EXTENT,
      CRANE_MAP_EXTENT,
    ),
  };
}

export function craneStep(current: CranePoint, destination: CranePoint) {
  const dx = destination.x - current.x;
  const dz = destination.z - current.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.12) return null;
  const scale = Math.min(0.55, distance) / distance;
  return { x: dx * scale, z: dz * scale };
}

export function craneTravelHeight(currentY: number, bestHeight: number) {
  return Math.max(
    currentY,
    Math.min(GOAL + 1, bestHeight + 2.2, bestHeight + FLOOR + 0.45),
  );
}

export function craneRoute(
  start: CranePoint,
  destination: CranePoint,
  clear: (point: CranePoint) => boolean,
): CranePoint[] | null {
  const lineClear = (a: CranePoint, b: CranePoint) => {
    const count = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 0.15);
    for (let i = 1; i <= count; i++)
      if (
        !clear({
          x: a.x + ((b.x - a.x) * i) / count,
          z: a.z + ((b.z - a.z) * i) / count,
        })
      )
        return false;
    return true;
  };
  if (!clear(destination)) return null;
  if (lineClear(start, destination)) return [destination];

  const width = CRANE_MAP_EXTENT * 4 + 1;
  const key = (x: number, z: number) => z * width + x;
  const point = (x: number, z: number) => ({
    x: x / 2 - CRANE_MAP_EXTENT,
    z: z / 2 - CRANE_MAP_EXTENT,
  });
  const queue: number[] = [];
  const parent = new Map<number, number>();
  const open = new Map<number, boolean>();
  const isOpen = (x: number, z: number) => {
    const id = key(x, z);
    if (!open.has(id)) open.set(id, clear(point(x, z)));
    return open.get(id)!;
  };
  const sx = Math.round((start.x + CRANE_MAP_EXTENT) * 2);
  const sz = Math.round((start.z + CRANE_MAP_EXTENT) * 2);
  for (let z = Math.max(0, sz - 2); z <= Math.min(width - 1, sz + 2); z++)
    for (let x = Math.max(0, sx - 2); x <= Math.min(width - 1, sx + 2); x++) {
      const id = key(x, z);
      if (isOpen(x, z) && lineClear(start, point(x, z))) {
        parent.set(id, -1);
        queue.push(id);
      }
    }
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    const x = id % width;
    const z = Math.floor(id / width);
    const here = point(x, z);
    if (
      Math.hypot(here.x - destination.x, here.z - destination.z) < 0.8 &&
      lineClear(here, destination)
    ) {
      const route = [destination];
      let cursor = id;
      while (cursor !== -1) {
        route.push(point(cursor % width, Math.floor(cursor / width)));
        cursor = parent.get(cursor)!;
      }
      return route.reverse();
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= width || nz >= width) continue;
      const next = key(nx, nz);
      if (
        parent.has(next) ||
        !isOpen(nx, nz) ||
        !lineClear(here, point(nx, nz))
      )
        continue;
      parent.set(next, id);
      queue.push(next);
    }
  }
  return null;
}
