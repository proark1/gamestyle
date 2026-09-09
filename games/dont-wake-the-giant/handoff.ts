import { platforms, type Platform } from './level';
import type { GiantPlayer, GiantWorld, Vec } from './types';

/** Segment versus solid furniture. Hands must reach around the ledge, not through it. */
function blocked(a: Vec, b: Vec, box: Platform) {
  let near = 0,
    far = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const lo =
      axis === 'y'
        ? box.y - box.h
        : box[axis] - (axis === 'x' ? box.w : box.d) / 2;
    const hi =
      axis === 'y' ? box.y : box[axis] + (axis === 'x' ? box.w : box.d) / 2;
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 0.0001) {
      if (a[axis] <= lo + 0.04 || a[axis] >= hi - 0.04) return false;
    } else {
      const t1 = (lo + 0.04 - a[axis]) / delta,
        t2 = (hi - 0.04 - a[axis]) / delta;
      near = Math.max(near, Math.min(t1, t2));
      far = Math.min(far, Math.max(t1, t2));
      if (near >= far) return false;
    }
  }
  return near < far;
}

export function handoffTarget(w: GiantWorld, giver: GiantPlayer) {
  const steady = (p: GiantPlayer) =>
    p.grounded &&
    !p.escaped &&
    !p.caught &&
    p.downUntil <= w.clock &&
    w.clock - p.seen < 1200;
  if (!steady(giver) || !w.items.some((i) => i.heldBy === giver.id))
    return undefined;
  const surfaces = platforms(w).filter(
    (p) => p.id !== 'floor' && !p.passFromBelow,
  );
  return w.players
    .filter((p) => {
      if (
        p.id === giver.id ||
        !steady(p) ||
        w.items.some((i) => i.heldBy === p.id)
      )
        return false;
      const height = giver.y - p.y;
      if (
        height < -0.65 ||
        height > 2.7 ||
        Math.hypot(p.x - giver.x, p.z - giver.z) > 1.8
      )
        return false;
      const from = { ...giver, y: giver.y + 0.7 },
        to = { ...p, y: p.y + 0.95 };
      return !surfaces.some((surface) => blocked(from, to, surface));
    })
    .sort(
      (a, b) =>
        Number(b.y < giver.y - 0.4) - Number(a.y < giver.y - 0.4) ||
        Math.hypot(a.x - giver.x, a.z - giver.z) -
          Math.hypot(b.x - giver.x, b.z - giver.z) ||
        a.id.localeCompare(b.id),
    )[0];
}
