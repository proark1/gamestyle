import { type GiantItem, type GiantWorld, type Vec } from './types';
import { bodyPoint, footPoint, giantJoints, wakePose } from './giant-motion';
export { bodyPoint, SIT_PIVOT, wakePose } from './giant-motion';
export type Platform = Vec & {
  id: string;
  w: number;
  d: number;
  h: number;
  color: string;
  soft?: boolean;
  moving?: boolean;
  passFromBelow?: boolean;
};
export const EXIT: Vec = { x: -11.7, y: 0, z: 8.5 };
export const FOOT: Vec = { x: 2, y: 4.2, z: 5.8 };
// Above the giant's entire sit-to-stand sweep at this horizontal position.
export const CHANDELIER: Vec = { x: 2, y: 17, z: -0.8 };
export const GIANT_PARTS = [
  'feet',
  'feet-right',
  'knees',
  'thigh-right',
  'shin-left',
  'shin-right',
  'belly',
  'chest',
  'head',
  'arm',
];
export const UPPER_BODY = ['belly', 'chest', 'head', 'arm'];
export const SLIPPER = { x: -8.8, z: 2.8, w: 3, d: 2.2 };
export const STATIC: Platform[] = [
  { id: 'floor', x: 0, y: 0, z: 0, w: 28, d: 24, h: 0.7, color: '#b49368' },
  {
    id: 'book-one',
    x: -7.2,
    y: 0.65,
    z: 6,
    w: 2.8,
    d: 2.5,
    h: 0.65,
    color: '#668b80',
  },
  {
    id: 'book-two',
    x: -5.3,
    y: 1.3,
    z: 4.8,
    w: 2.5,
    d: 2.5,
    h: 1.3,
    color: '#be885b',
  },
  {
    id: 'stool',
    x: -3.5,
    y: 2.05,
    z: 3.4,
    w: 2.6,
    d: 2.6,
    h: 0.25,
    color: '#c5a576',
  },
  {
    id: 'bed',
    x: 2,
    y: 2.6,
    z: -0.8,
    w: 9.6,
    d: 16.8,
    h: 0.85,
    color: '#e1d9b4',
    soft: true,
  },
  {
    id: 'nightstand',
    x: -6.4,
    y: 3.3,
    z: -2.5,
    w: 3.2,
    d: 3,
    h: 0.3,
    color: '#987852',
  },
  {
    id: 'drawer',
    x: -6.2,
    y: 1.85,
    z: -0.5,
    w: 2.8,
    d: 1.3,
    h: 0.3,
    color: '#b8976b',
  },
  {
    id: 'low-drawer',
    x: -6.2,
    y: 0.9,
    z: 0.5,
    w: 2.8,
    d: 1.4,
    h: 0.3,
    color: '#b8976b',
  },
  {
    id: 'chandelier',
    ...CHANDELIER,
    w: 4,
    d: 2.5,
    h: 0.22,
    color: '#bd9147',
    passFromBelow: true,
  },
];
const ease = (t: number) => {
  const n = Math.max(0, Math.min(1, t));
  return n * n * (3 - 2 * n);
};
export function armPosition(w: GiantWorld, clock = w.clock) {
  return w.armFrom + (w.armTo - w.armFrom) * ease((clock - w.armAt) / 1800);
}
/** The model's resting proportions, also used to derive its collision bounds. */
export function restingGiantParts(w: GiantWorld, clock = w.clock): Platform[] {
  const breathe =
    w.phase === 'escape' || w.phase === 'ended'
      ? 0
      : Math.sin((clock - w.started) / 900) * 0.27;
  return [
    {
      id: 'feet',
      x: 2,
      y: 3.3,
      z: 5.8,
      w: 4.7,
      d: 2.6,
      h: 0.8,
      color: '#dba27b',
      soft: true,
    },
    {
      id: 'knees',
      x: 2,
      y: 3.85 + breathe * 0.3,
      z: 3.2,
      w: 5,
      d: 3.5,
      h: 1.35,
      color: '#68897d',
      soft: true,
      moving: true,
    },
    {
      id: 'belly',
      x: 2,
      y: 4.95 + breathe,
      z: 0,
      w: 5.8,
      d: 4.9,
      h: 2.3 + breathe,
      color: '#789889',
      soft: true,
      moving: true,
    },
    {
      id: 'chest',
      x: 2,
      // The chest details and loot sit on the same continuous shirt as the belly.
      y: 4.95 + breathe,
      z: -3.15,
      w: 5.4,
      d: 3,
      h: 2.3 + breathe,
      color: '#68897d',
      soft: true,
      moving: true,
    },
    {
      id: 'head',
      x: 2,
      y: 5.2,
      z: -6.1,
      w: 4.1,
      d: 3.7,
      h: 2.35,
      color: '#dda982',
      soft: true,
    },
    {
      id: 'arm',
      x: -2.85,
      y: 3.7 + breathe * 0.35,
      z: armPosition(w, clock),
      w: 5,
      d: 1.65,
      h: 1,
      color: '#dba27b',
      soft: true,
      moving: true,
    },
  ];
}
/** Both stages of standing use the same transforms as the visible body. */
export function platforms(w: GiantWorld, clock = w.clock): Platform[] {
  const wake = wakePose(w, clock);
  const joints = giantJoints(w, armPosition(w, clock), clock);
  const bounds = (p: Platform, points: Vec[], radius: number): Platform => {
    const minX = Math.min(...points.map((v) => v.x)) - radius;
    const maxX = Math.max(...points.map((v) => v.x)) + radius;
    const minY = Math.min(...points.map((v) => v.y)) - radius;
    const maxY = Math.max(...points.map((v) => v.y)) + radius;
    const minZ = Math.min(...points.map((v) => v.z)) - radius;
    const maxZ = Math.max(...points.map((v) => v.z)) + radius;
    return {
      ...p,
      x: (minX + maxX) / 2,
      y: maxY,
      z: (minZ + maxZ) / 2,
      w: maxX - minX,
      h: maxY - minY,
      d: maxZ - minZ,
      moving: true,
    };
  };
  const list: Platform[] = [
    ...STATIC,
    ...restingGiantParts(w, clock).flatMap((p) => {
      if (p.id === 'feet') {
        return joints.legs.map((leg, i) =>
          bounds(
            { ...p, id: i ? 'feet-right' : 'feet' },
            [-0.8, 0.8].flatMap((x) =>
              [-0.38, 0.43].flatMap((y) =>
                [-0.64, 1.55].map((z) => footPoint({ x, y, z }, leg)),
              ),
            ),
            0,
          ),
        );
      }
      if (wake.elapsed > 0 && p.id === 'knees')
        return joints.legs.flatMap((leg, i) => [
          bounds(
            { ...p, id: i ? 'thigh-right' : 'knees' },
            [leg.hip, leg.knee],
            0.65,
          ),
          bounds(
            { ...p, id: i ? 'shin-right' : 'shin-left' },
            [leg.knee, leg.ankle],
            0.48,
          ),
        ]);
      if (wake.elapsed > 0 && p.id === 'arm')
        // Once awake, both gesturing arms cease being climbing platforms. A broad
        // box around a bent elbow would otherwise catch and lift fleeing thieves.
        return [];
      const angle = wake.angle;
      if (!angle) return p;
      const center = bodyPoint(
        { x: p.x, y: p.y - p.h / 2, z: p.z },
        angle,
        wake.lift,
        wake.shift,
      );
      const h = p.h * Math.cos(angle) + p.d * Math.sin(angle);
      return {
        ...p,
        ...center,
        y: center.y + h / 2,
        h,
        d: p.d * Math.cos(angle) + p.h * Math.sin(angle),
        moving: true,
      };
    }),
  ];
  for (const item of w.items)
    if (
      !item.heldBy &&
      !item.banked &&
      item.support &&
      (item.kind === 'pillow' || item.kind === 'spoon')
    ) {
      const sideways = item.rotation % 2 === 0;
      list.push({
        id: `item:${item.id}`,
        x: item.x,
        y: item.y + (item.kind === 'pillow' ? 0.28 : 0.08),
        z: item.z,
        w: item.kind === 'pillow' ? 1.7 : sideways ? 4.8 : 0.85,
        d: item.kind === 'pillow' ? 1.4 : sideways ? 0.85 : 4.8,
        h: item.kind === 'pillow' ? 0.35 : 0.16,
        color: item.kind === 'pillow' ? '#f3cf7e' : '#b6c3ba',
        soft: item.kind === 'pillow',
      });
    }
  return list;
}
export const onTop = (p: Vec, b: Platform, radius = 0) =>
  Math.abs(p.x - b.x) <= b.w / 2 + radius &&
  Math.abs(p.z - b.z) <= b.d / 2 + radius;

/** Resting loot uses the rig's rendered clock, including the unsimulated lobby. */
export function restingItemPosition(
  w: GiantWorld,
  item: GiantItem,
  clock: number,
): Vec | null {
  if (item.banked || item.heldBy || !item.support || w.escapeAt) return null;
  let support = item.support;
  const visited = new Set<string>();
  while (support.startsWith('item:')) {
    if (visited.has(support)) return null;
    visited.add(support);
    const parent = w.items.find(
      (candidate) => `item:${candidate.id}` === support,
    );
    if (!parent?.support || parent.heldBy || parent.banked) return null;
    support = parent.support;
  }
  if (!GIANT_PARTS.includes(support)) return null;
  const baseClock = w.phase === 'lobby' ? w.started : w.clock;
  const before = platforms(w, baseClock).find((p) => p.id === support);
  const after = platforms(w, clock).find((p) => p.id === support);
  if (!before || !after) return null;
  return {
    x: item.x + after.x - before.x,
    y: item.support === support ? after.y + 0.12 : item.y + after.y - before.y,
    z: item.z + after.z - before.z,
  };
}
export const atDoor = (p: Vec) =>
  Math.hypot(p.x - EXIT.x, p.z - EXIT.z) < 2.2 && p.y < 1.5;
export const inSlipper = (p: Vec) =>
  Math.abs(p.x - SLIPPER.x) < SLIPPER.w / 2 &&
  Math.abs(p.z - SLIPPER.z) < SLIPPER.d / 2 &&
  p.y < 1;
