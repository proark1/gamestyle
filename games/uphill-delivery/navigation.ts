import { Quaternion, Vec3 } from 'cannon-es';
import { LEVEL, ROUTE, GATE, DOOR, bridgePose } from './level';
import type { DeliveryPlayer, DeliveryWorld, Vec } from './types';

export const distanceXZ = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const clamp = (v: number, low: number, high: number) =>
  Math.max(low, Math.min(high, v));
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
const surfaces = LEVEL.filter(
  (b) => !/customer-(back|side)|alley/.test(b.id),
).map((box) => {
  const q = new Quaternion(
    box.quaternion.x,
    box.quaternion.y,
    box.quaternion.z,
    box.quaternion.w,
  );
  return { box, q, inverse: q.conjugate(), up: q.vmult(new Vec3(0, 1, 0)) };
});

/** Top surfaces from the same oriented boxes as collision, retaining height layers. */
export function deliveryFloor(
  x: number,
  z: number,
  near: number,
  elapsed = 0,
): number | null {
  let chosen: number | null = null;
  for (const { box, inverse, up } of surfaces) {
    const centerY = box.bridge ? bridgePose(box, elapsed).y : box.position.y;
    const top =
      centerY +
      box.size[1] / (2 * up.y) -
      (up.x * (x - box.position.x) + up.z * (z - box.position.z)) / up.y;
    if (top > near + 0.7 || top < near - 1.4) continue;
    const local = inverse.vmult(
      new Vec3(x - box.position.x, top - centerY, z - box.position.z),
    );
    if (
      Math.abs(local.x) > box.size[0] / 2 + 0.1 ||
      Math.abs(local.z) > box.size[2] / 2 + 0.1
    )
      continue;
    if (chosen === null || top > chosen) chosen = top;
  }
  return chosen;
}

export function routeProjection(p: Vec) {
  let best = { stage: 0, t: 0, point: ROUTE[0], score: Infinity };
  for (let stage = 0; stage < ROUTE.length - 1; stage++) {
    const a = ROUTE[stage],
      b = ROUTE[stage + 1];
    const length2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
    const t = clamp(
      ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / length2,
      0,
      1,
    );
    const point = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
    const score = distanceXZ(point, p) ** 2 + (point.y - p.y) ** 2 * 9;
    if (score < best.score) best = { stage, t, point, score };
  }
  return best;
}

export function deliverySolid(x: number, z: number, y: number) {
  return LEVEL.some(
    (b) =>
      /customer-(back|side)|alley/.test(b.id) &&
      y < b.position.y + b.size[1] / 2 &&
      y + 1.8 > b.position.y - b.size[1] / 2 &&
      Math.abs(x - b.position.x) < b.size[0] / 2 + 0.38 &&
      Math.abs(z - b.position.z) < b.size[2] / 2 + 0.38,
  );
}
export function npcObstacle(
  w: DeliveryWorld,
  x: number,
  z: number,
  y: number,
  sofa = true,
) {
  for (const panel of [
    {
      x: GATE.x,
      y: GATE.y,
      z: GATE.z - 2.3,
      yaw: w.gate,
      width: 4.6,
      height: 1.8,
    },
    { ...DOOR, yaw: w.door, width: 3.7, height: 3 },
  ]) {
    const dx = x - panel.x,
      dz = z - panel.z;
    const lx = dx * Math.cos(panel.yaw) - dz * Math.sin(panel.yaw),
      lz = dx * Math.sin(panel.yaw) + dz * Math.cos(panel.yaw);
    if (
      y < panel.y + panel.height &&
      y + 1.9 > panel.y &&
      Math.abs(lx) < 0.46 &&
      lz > -0.34 &&
      lz < panel.width + 0.34
    )
      return true;
  }
  if (!sofa || Math.abs(y + 0.9 - w.sofa.y) > 1.7) return false;
  const q = w.sofa.quaternion;
  const yaw = Math.atan2(
    2 * (q.w * q.y + q.x * q.z),
    1 - 2 * (q.y * q.y + q.z * q.z),
  );
  const dx = x - w.sofa.x,
    dz = z - w.sofa.z;
  return (
    Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)) < 2.48 &&
    Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)) < 1.3
  );
}

/** A nearby corner can still be on the other side of a wall or swinging panel. */
export function deliveryGripClear(w: DeliveryWorld, from: Vec, grip: Vec) {
  const steps = Math.max(1, Math.ceil(distanceXZ(from, grip) / 0.1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (grip.x - from.x) * t;
    const z = from.z + (grip.z - from.z) * t;
    const y = from.y + 1.2 + (grip.y - 1.2 - from.y) * t;
    for (const panel of [
      {
        x: GATE.x,
        y: GATE.y,
        z: GATE.z - 2.3,
        yaw: w.gate,
        width: 4.6,
        height: 1.8,
      },
      { ...DOOR, yaw: w.door, width: 3.7, height: 3 },
    ]) {
      const dx = x - panel.x,
        dz = z - panel.z;
      const lx = dx * Math.cos(panel.yaw) - dz * Math.sin(panel.yaw);
      const lz = dx * Math.sin(panel.yaw) + dz * Math.cos(panel.yaw);
      if (
        y > panel.y &&
        y < panel.y + panel.height &&
        Math.abs(lx) < 0.14 &&
        lz > -0.02 &&
        lz < panel.width + 0.02
      )
        return false;
    }
    if (
      LEVEL.some(
        (box) =>
          /customer-(back|side)|alley/.test(box.id) &&
          Math.abs(y - box.position.y) < box.size[1] / 2 &&
          Math.abs(x - box.position.x) < box.size[0] / 2 &&
          Math.abs(z - box.position.z) < box.size[2] / 2,
      )
    )
      return false;
  }
  return true;
}

/** Local avoidance over a height-aware route. Returns normal world-space stick input. */
export function steerDeliveryNpc(
  w: DeliveryWorld,
  p: DeliveryPlayer,
  goal: Vec,
  speed: number,
) {
  const target = goal;
  let dx = target.x - p.x,
    dz = target.z - p.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.12) return { x: 0, z: 0, jump: false };
  dx /= distance;
  dz /= distance;
  let best = { x: 0, z: 0, jump: false },
    bestScore = -Infinity;
  const q = new Quaternion(
    w.sofa.quaternion.x,
    w.sofa.quaternion.y,
    w.sofa.quaternion.z,
    w.sofa.quaternion.w,
  ).conjugate();
  for (const turn of [
    0,
    0.45,
    -0.45,
    0.9,
    -0.9,
    1.4,
    -1.4,
    Math.PI / 2,
    -Math.PI / 2,
    Math.PI,
  ]) {
    const x = dx * Math.cos(turn) - dz * Math.sin(turn),
      z = dx * Math.sin(turn) + dz * Math.cos(turn);
    const reach = Math.min(0.8, distance);
    const nx = p.x + x * reach + p.velocity.x * 0.12,
      nz = p.z + z * reach + p.velocity.z * 0.12;
    const floor = deliveryFloor(nx, nz, p.y, w.clock - w.started);
    const edge =
      floor !== null && !supportedFoot(nx, nz, floor, w.clock - w.started);
    if (deliverySolid(nx, nz, p.y)) continue;
    if (npcObstacle(w, nx, nz, p.y, false)) continue;
    const local = q.vmult(
      new Vec3(nx - w.sofa.x, p.y + 0.7 - w.sofa.y, nz - w.sofa.z),
    );
    const hitsSofa =
      p.grip === null &&
      Math.abs(local.x) < 2.48 &&
      Math.abs(local.z) < 1.28 &&
      Math.abs(local.y) < 1.2;
    if (hitsSofa && !npcObstacle(w, p.x, p.z, p.y)) continue;
    const gap =
      floor === null || floor < p.y - (p.support === 'sofa' ? 2 : 0.7);
    if ((gap && p.grip !== null) || edge) continue;
    const landing = gap
      ? deliveryFloor(p.x + x * 3, p.z + z * 3, p.y + 0.4, w.clock - w.started)
      : floor;
    if (gap && (landing === null || !p.grounded)) continue;
    let score = Math.cos(turn) * 3 - (gap ? 1 : 0);
    for (const other of w.players)
      if (other.id !== p.id && Math.abs(other.y - p.y) < 1.4)
        score -= Math.max(0, 0.85 - Math.hypot(nx - other.x, nz - other.z)) * 5;
    if (score > bestScore) {
      bestScore = score;
      const move = gap ? 1 : Math.min(speed, distance * 1.4);
      best = {
        x: x * move,
        z: z * move,
        jump:
          gap ||
          (p.grounded &&
            (deliveryFloor(
              p.x + x * 0.25,
              p.z + z * 0.25,
              p.y,
              w.clock - w.started,
            ) ?? p.y) >
              p.y + 0.28),
      };
    }
  }
  return best;
}

export function walkableLayers(
  x: number,
  z: number,
  clearance = true,
): number[] {
  const layers: { top: number; bottom: number }[] = [];
  for (const { box, inverse, up } of surfaces) {
    const top =
      box.position.y +
      box.size[1] / (2 * up.y) -
      (up.x * (x - box.position.x) + up.z * (z - box.position.z)) / up.y;
    const local = inverse.vmult(
      new Vec3(x - box.position.x, top - box.position.y, z - box.position.z),
    );
    if (
      Math.abs(local.x) <= box.size[0] / 2 + 0.1 &&
      Math.abs(local.z) <= box.size[2] / 2 + 0.1
    )
      layers.push({ top, bottom: top - box.size[1] / up.y });
  }
  return layers
    .filter(
      (layer) =>
        !deliverySolid(x, z, layer.top) &&
        !layers.some(
          (ceiling) =>
            ceiling.top > layer.top + 0.15 && ceiling.bottom < layer.top + 1.95,
        ),
    )
    .map((layer) => layer.top)
    .filter((y) => !clearance || supportedFoot(x, z, y, 0))
    .filter(
      (y, i, ys) => ys.findIndex((other) => Math.abs(y - other) < 0.05) === i,
    );
}

function supportedFoot(x: number, z: number, y: number, elapsed: number) {
  return [
    [0.3, 0],
    [-0.3, 0],
    [0, 0.3],
    [0, -0.3],
  ].every(([dx, dz]) => {
    const floor = deliveryFloor(x + dx, z + dz, y, elapsed);
    return floor !== null && floor >= y - 0.38 && floor <= y + 0.7;
  });
}
