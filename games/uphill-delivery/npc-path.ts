import {
  distanceXZ,
  walkableLayers,
  steerDeliveryNpc,
  deliverySolid,
  npcObstacle,
} from './navigation';
import type { DeliveryBrain } from './npc-types';
import type { DeliveryPlayer, DeliveryWorld, Vec } from './types';

type Node = Vec & { edges: { to: number; jump: boolean; cost: number }[] };
export type NpcWaypoint = Vec & { jump?: boolean };
let graph: Node[] | undefined;
/** Build once when the crew is assembled, outside the first active game frame. */
export function prepareDeliveryNavigation() {
  nodes();
}
function nodes() {
  if (graph) return graph;
  const result: Node[] = [],
    cells = new Map<string, number[]>();
  for (let x = -21; x <= 21; x++)
    for (let z = -33; z <= 25; z++) {
      const ids: number[] = [];
      for (const y of walkableLayers(x, z)) {
        ids.push(result.length);
        result.push({ x, y, z, edges: [] });
      }
      cells.set(`${x},${z}`, ids);
    }
  for (const node of result) {
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        if (!dx && !dz) continue;
        if (
          Math.max(Math.abs(dx), Math.abs(dz)) === 2 &&
          Math.abs(dx) + Math.abs(dz) !== 2
        )
          continue;
        for (const to of cells.get(`${node.x + dx},${node.z + dz}`) ?? []) {
          const next = result[to],
            rise = next.y - node.y;
          if (Math.abs(rise) > 0.7) continue;
          const middle = walkableLayers(
            node.x + dx / 2,
            node.z + dz / 2,
            false,
          );
          if (!middle.some((y) => Math.abs(y - (node.y + next.y) / 2) < 0.5))
            continue;
          let previousHeight = node.y;
          let jump = false;
          for (let sample = 1; sample <= 4 && rise > 0.28; sample++) {
            const heights = walkableLayers(
              node.x + (dx * sample) / 4,
              node.z + (dz * sample) / 4,
              false,
            );
            const expected = node.y + (rise * sample) / 4;
            const height = heights.sort(
              (a, b) => Math.abs(a - expected) - Math.abs(b - expected),
            )[0];
            if (height !== undefined) {
              jump ||= height - previousHeight > 0.28;
              previousHeight = height;
            }
          }
          node.edges.push({
            to,
            jump,
            cost: Math.hypot(dx, dz) + Math.abs(rise),
          });
        }
      }
    // Deliberate gaps need a reachable landing; never connect separate height layers.
    if (node.y < 10 || node.y > 16) continue;
    for (const dx of [-4, 4])
      for (const to of cells.get(`${node.x + dx},${node.z}`) ?? []) {
        const next = result[to];
        if (Math.abs(next.y - node.y) > 0.9) continue;
        const middle = walkableLayers(node.x + dx / 2, node.z);
        if (middle.some((y) => Math.abs(y - node.y) < 1)) continue;
        if (deliverySolid(node.x + dx / 2, node.z, node.y)) continue;
        node.edges.push({ to, jump: true, cost: 6 });
      }
  }
  graph = result;
  return result;
}

export function deliveryPath(
  from: Vec,
  goal: Vec,
  world?: DeliveryWorld,
): NpcWaypoint[] {
  const network = nodes();
  const blocked = world
    ? network.map((n) => npcObstacle(world, n.x, n.z, n.y))
    : [];
  const closest = (p: Vec) => {
    let best = 0,
      score = Infinity;
    for (let i = 0; i < network.length; i++) {
      if (blocked[i]) continue;
      const n = network[i],
        d = distanceXZ(n, p) ** 2 + (n.y - p.y) ** 2 * 12;
      if (d < score) {
        best = i;
        score = d;
      }
    }
    return best;
  };
  const start = closest(from),
    end = closest(goal);
  const open = new Set([start]),
    costs = new Map([[start, 0]]);
  const previous = new Map<number, { from: number; jump: boolean }>();
  let nearest = start,
    remaining = Infinity;
  const trace = (end: number, complete = false) => {
    const path: NpcWaypoint[] = [];
    for (let id = end; id !== start;) {
      const link = previous.get(id)!;
      const n = network[id];
      path.push({ x: n.x, y: n.y, z: n.z, jump: link.jump });
      id = link.from;
    }
    const n = network[start];
    path.push({ x: n.x, y: n.y, z: n.z });
    path.reverse();
    if (complete && Math.abs(network[end].y - goal.y) < 1.3)
      path.push({ ...goal });
    return path;
  };
  for (let visited = 0; open.size && visited < network.length; visited++) {
    let current = start,
      best = Infinity;
    for (const id of open) {
      const cost = costs.get(id)! + distanceXZ(network[id], network[end]);
      if (cost < best) {
        current = id;
        best = cost;
      }
    }
    const toGoal =
      distanceXZ(network[current], goal) +
      Math.abs(network[current].y - goal.y) * 4;
    if (toGoal < remaining) {
      remaining = toGoal;
      nearest = current;
    }
    if (current === end) {
      return trace(end, true);
    }
    open.delete(current);
    for (const edge of network[current].edges) {
      if (blocked[edge.to]) continue;
      const cost = costs.get(current)! + edge.cost;
      if (cost >= (costs.get(edge.to) ?? Infinity)) continue;
      previous.set(edge.to, { from: current, jump: edge.jump });
      costs.set(edge.to, cost);
      open.add(edge.to);
    }
  }
  // A temporary cargo blockage must not turn an uphill return into a straight
  // walk into the underside of a road. Approach the nearest reachable side.
  return trace(nearest);
}

export function followDeliveryPath(
  w: DeliveryWorld,
  p: DeliveryPlayer,
  b: DeliveryBrain,
  goal: Vec,
  speed = 0.85,
) {
  if (
    w.clock >= b.thinkAt &&
    (p.grounded || Math.abs(p.velocity.y) < 0.3 || !b.path?.length)
  ) {
    if (
      !b.path?.length ||
      !b.goal ||
      distanceXZ(b.goal, goal) > 1 ||
      w.clock - b.movedAt > 1800
    ) {
      b.path = deliveryPath(p, goal, w);
      b.goal = { ...goal };
    }
    b.thinkAt = w.clock + 650 + p.color * 45;
  }
  while (
    (b.path?.length ?? 0) > 1 &&
    distanceXZ(p, b.path![0]) < 0.5 &&
    (Math.abs(p.y - b.path![0].y) < 0.75 || (!p.grounded && p.y > b.path![0].y))
  )
    b.path!.shift();
  const target: NpcWaypoint = b.path?.[0] ?? goal;
  const dx = target.x - p.x,
    dz = target.z - p.z,
    distance = Math.hypot(dx, dz);
  if (
    (target.jump || (!p.grounded && Math.abs(p.velocity.y) > 0.3)) &&
    distance > 0.2
  ) {
    return {
      x: dx / distance,
      z: dz / distance,
      jump: p.grounded && target.jump === true,
    };
  }
  return steerDeliveryNpc(w, p, target, speed);
}
