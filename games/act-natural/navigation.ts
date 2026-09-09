import { coverBlocks, farmerSees } from './visibility';
import { distance, type Point } from './types';

export type FarmDanger = Point & { angle: number };
const STEP = 0.8,
  LIMIT = 8.8;
export function farmClearPath(from: Point, to: Point, radius = 0.53) {
  const steps = Math.max(1, Math.ceil(distance(from, to) / 0.18));
  for (let i = 0; i <= steps; i++) {
    const p = {
      x: from.x + ((to.x - from.x) * i) / steps,
      z: from.z + ((to.z - from.z) * i) / steps,
    };
    if (
      Math.abs(p.x) > LIMIT + 0.001 ||
      Math.abs(p.z) > LIMIT + 0.001 ||
      coverBlocks(p, radius)
    )
      return false;
  }
  return true;
}
export function farmRisk(p: Point, danger: FarmDanger | null) {
  if (!danger) return 0;
  return (
    Math.max(0, 4 - distance(p, danger)) * 2 +
    (farmerSees({ farmer: danger, mode: 'human', practice: false }, p)
      ? 2.5
      : 0)
  );
}
const nodes: Point[] = [],
  edges: number[][] = [];
const grid = new Map<string, number>();
for (let x = -11; x <= 11; x++)
  for (let z = -11; z <= 11; z++) {
    const p = { x: x * STEP, z: z * STEP };
    if (coverBlocks(p, 0.55)) continue;
    grid.set(`${x},${z}`, nodes.length);
    nodes.push(p);
  }
for (const p of nodes) {
  const near: number[] = [];
  const x = Math.round(p.x / STEP),
    z = Math.round(p.z / STEP);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const index = grid.get(`${x + dx},${z + dz}`);
      if (index !== undefined && farmClearPath(p, nodes[index]))
        near.push(index);
    }
  edges.push(near);
}
function closest(p: Point) {
  let best = -1,
    score = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = distance(p, nodes[i]);
    if (d < score && farmClearPath(p, nodes[i], 0.45)) {
      score = d;
      best = i;
    }
  }
  return best;
}
function routeRisk(a: Point, b: Point, danger: FarmDanger | null) {
  let risk = 0;
  const steps = Math.max(1, Math.ceil(distance(a, b) / 0.5));
  for (let i = 0; i <= steps; i++)
    risk = Math.max(
      risk,
      farmRisk(
        {
          x: a.x + ((b.x - a.x) * i) / steps,
          z: a.z + ((b.z - a.z) * i) / steps,
        },
        danger,
      ),
    );
  return risk;
}

/** A* over a static, cow-clearance graph; positive sight costs preserve an admissible distance heuristic. */
export function farmPath(
  from: Point,
  to: Point,
  danger: FarmDanger | null = null,
  caution = 1,
): Point[] {
  if (coverBlocks(to, 0.53) || Math.abs(to.x) > LIMIT || Math.abs(to.z) > LIMIT)
    return [];
  if (farmClearPath(from, to) && routeRisk(from, to, danger) < 0.1)
    return [{ ...to }];
  const start = closest(from),
    end = closest(to);
  if (start < 0 || end < 0) return [];
  const cost = new Float64Array(nodes.length).fill(Infinity),
    previous = new Int32Array(nodes.length).fill(-1);
  const closed = new Uint8Array(nodes.length),
    queued = new Uint8Array(nodes.length);
  const open = [start];
  cost[start] = 0;
  queued[start] = 1;
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (
        cost[open[i]] + distance(nodes[open[i]], to) <
        cost[open[best]] + distance(nodes[open[best]], to)
      )
        best = i;
    const current = open.splice(best, 1)[0];
    queued[current] = 0;
    if (current === end) break;
    closed[current] = 1;
    for (const next of edges[current]) {
      if (closed[next]) continue;
      const nextCost =
        cost[current] +
        distance(nodes[current], nodes[next]) *
          (1 + caution * farmRisk(nodes[next], danger));
      if (nextCost >= cost[next]) continue;
      cost[next] = nextCost;
      previous[next] = current;
      if (!queued[next]) {
        open.push(next);
        queued[next] = 1;
      }
    }
  }
  if (!Number.isFinite(cost[end])) return [];
  const path: Point[] = [{ ...to }];
  for (let i = end; i !== -1; i = previous[i]) {
    path.unshift({ ...nodes[i] });
    if (i === start) break;
  }
  const result: Point[] = [];
  let anchor = from;
  for (let i = 0; i < path.length;) {
    let next = i;
    for (let j = i + 1; j < path.length; j++) {
      if (
        !farmClearPath(anchor, path[j], 0.46) ||
        (danger && routeRisk(anchor, path[j], danger) > 0.2)
      )
        break;
      next = j;
    }
    result.push(path[next]);
    anchor = path[next];
    i = next + 1;
  }
  return result;
}
