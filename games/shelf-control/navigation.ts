import { blocked, clearSight, DEPTH, RADIUS, visible, WIDTH } from './layout';
import { distance, type Body, type Point } from './types';

const STEP = 0.75;
const nodes: Point[] = [],
  edges: number[][] = [];
const byGrid = new Map<string, number>();
for (let x = -WIDTH + STEP; x < WIDTH - RADIUS; x += STEP)
  for (let z = -DEPTH + STEP; z < DEPTH - RADIUS; z += STEP) {
    const p = { x, z };
    if (blocked(p, RADIUS + 0.04)) continue;
    byGrid.set(`${x},${z}`, nodes.length);
    nodes.push(p);
  }
for (const p of nodes) {
  const neighbours: number[] = [];
  for (const dx of [-STEP, 0, STEP])
    for (const dz of [-STEP, 0, STEP]) {
      if (!dx && !dz) continue;
      const next = byGrid.get(`${p.x + dx},${p.z + dz}`);
      if (next !== undefined && clearSight(p, nodes[next], RADIUS + 0.01))
        neighbours.push(next);
    }
  edges.push(neighbours);
}
function closest(point: Point) {
  let best = -1,
    score = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = distance(point, nodes[i]);
    if (d < score && clearSight(point, nodes[i], RADIUS)) {
      best = i;
      score = d;
    }
  }
  return best;
}
const dangerCost = (point: Point, danger?: Body | null) =>
  !danger
    ? 0
    : Math.max(0, 4 - distance(point, danger)) * 2.5 +
      (visible(danger, point, true) ? 2 : 0);

/** Static shelf graph; the optional danger is a recently observed guard, never hidden world data. */
export function shopPath(
  from: Point,
  to: Point,
  danger?: Body | null,
): Point[] {
  if (blocked(to)) return [];
  if (
    clearSight(from, to, RADIUS + 0.01) &&
    (!danger ||
      dangerCost({ x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }, danger) <
        0.01)
  )
    return [{ ...to }];
  const start = closest(from),
    end = closest(to);
  if (start < 0 || end < 0) return [];
  const cost = new Float64Array(nodes.length).fill(Infinity),
    previous = new Int32Array(nodes.length).fill(-1),
    closed = new Uint8Array(nodes.length);
  const open = [start];
  cost[start] = 0;
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (
        cost[open[i]] + distance(nodes[open[i]], to) <
        cost[open[best]] + distance(nodes[open[best]], to)
      )
        best = i;
    const current = open.splice(best, 1)[0];
    if (current === end) break;
    if (closed[current]) continue;
    closed[current] = 1;
    for (const next of edges[current]) {
      const nextCost =
        cost[current] +
        distance(nodes[current], nodes[next]) *
          (1 + dangerCost(nodes[next], danger));
      if (nextCost >= cost[next]) continue;
      cost[next] = nextCost;
      previous[next] = current;
      if (!closed[next]) open.push(next);
    }
  }
  if (!Number.isFinite(cost[end])) return [];
  const path: Point[] = [{ ...to }];
  let current = end;
  while (current !== -1) {
    path.unshift({ ...nodes[current] });
    if (current === start) break;
    current = previous[current];
  }
  // Smooth grid corners while preserving the same collision clearance and danger avoidance.
  const smooth: Point[] = [];
  let anchor = from;
  for (let i = 0; i < path.length;) {
    let next = i;
    for (let j = i + 1; j < path.length; j++) {
      if (!clearSight(anchor, path[j], RADIUS + 0.01)) break;
      if (
        danger &&
        dangerCost(
          { x: (anchor.x + path[j].x) / 2, z: (anchor.z + path[j].z) / 2 },
          danger,
        ) > 1
      )
        break;
      next = j;
    }
    smooth.push(path[next]);
    anchor = path[next];
    i = next + 1;
  }
  return smooth;
}
