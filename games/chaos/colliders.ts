import { mapBounds, mapConfig, type MapId } from './maps';
import {
  localPoint,
  pieceBase,
  STOREY_HEIGHT,
  surfaceHeight,
  walkSurfaces,
} from './levels';
export { surfaceHeight } from './levels';
import type { ItemKind, Piece, Vec, World } from './model';

export const REACH = 2.8;
export const WALK_BOUNDS = { x: 11.1, back: -8.35, front: 8.65 };
export type Solid = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  angle?: number;
  name?: string;
};
const cube = (
  w: number,
  h: number,
  d: number,
  x = 0,
  y = h / 2,
  z = 0,
): Solid => ({ w, h, d, x, y, z });
export const SCENERY_SOLIDS: Solid[] = [
  { ...cube(29, 0.2, 24), y: -0.02, name: 'Plot' },
  { ...cube(18.5, 0.18, 15.5), y: 0.09, name: 'Building site' },
  { ...cube(9.4, 0.25, 9.4), y: 0.305, z: -0.5, name: 'Foundation' },
  { ...cube(3.3, 2.2, 2.3), x: -7.7, y: 1.43, z: -6.6, name: 'Site cabin' },
  { ...cube(3.5, 0.22, 2.5), x: -7.7, y: 2.66, z: -6.6 },
  { ...cube(1.5, 0.22, 0.6), x: -7.05, y: 0.3, z: -5.15 },
  { ...cube(2.2, 0.25, 2.1), x: 7, y: 0.36, z: -6, name: 'Crane base' },
  { ...cube(0.9, 12, 0.9), x: 7, y: 6.2, z: -6, name: 'Crane' },
  { ...cube(8.9, 0.85, 0.8), x: 4.6, y: 12.25, z: -6 },
  { ...cube(0.5, 0.7, 0.5), x: 1.3, y: 3.7, z: -6, name: 'Crane hook' },
  { ...cube(3.9, 2.1, 2.1), x: -7.7, y: 1.2, z: 8.4, name: 'Delivery van' },
  ...[-11, -10, -13, 11, 13, -12, 8].map((x, i) => ({
    ...cube(0.5, 3, 0.5),
    x,
    y: 1.5,
    z: [-7, -10, -2, -8, 4, 7, -11][i],
    name: 'Tree',
  })),
  ...[-12, 12].map((x) => ({
    ...cube(0.2, 1.2, 16),
    x,
    y: 0.6,
    name: 'Fence',
  })),
  { ...cube(27, 1.3, 0.2), y: 0.65, z: -9, name: 'Fence' },
  ...[-4.7, 4.7].flatMap((x) =>
    [-5.2, 4.2].map((z) => ({ ...cube(0.18, 0.72, 0.18), x, y: 0.52, z })),
  ),
];

/** Ground and fences expand; buildings and props keep their original size. */
export function scenerySolids(map?: MapId): Solid[] {
  const { scale } = mapConfig(map);
  if (scale === 1) return SCENERY_SOLIDS;
  return SCENERY_SOLIDS.map((solid, index) => {
    const anchor =
      index >= 3 && index <= 5
        ? { x: -7.7, z: -6.6 }
        : { x: solid.x, z: solid.z };
    const ground = index < 3;
    return {
      ...solid,
      x: solid.x + anchor.x * (scale - 1),
      z: solid.z + anchor.z * (scale - 1),
      w:
        solid.w *
        (ground || (solid.name === 'Fence' && solid.w > 1) ? scale : 1),
      d:
        solid.d *
        (ground || (solid.name === 'Fence' && solid.d > 1) ? scale : 1),
    };
  });
}

export function pieceShape(kind: ItemKind): {
  center: number;
  mass: number;
  boxes: Solid[];
} {
  if (kind === 'bookshelf')
    return { center: 1.08, mass: 30, boxes: [cube(1.56, 2.16, 0.65)] };
  if (kind === 'wardrobe')
    return { center: 1.1, mass: 48, boxes: [cube(1.55, 2.2, 0.9)] };
  if (kind === 'counter' || kind === 'sink' || kind === 'stove')
    return {
      center: 0.62,
      mass: kind === 'stove' ? 42 : 28,
      boxes: [cube(1.4, 1.2, 1.08)],
    };
  if (kind === 'bathtub')
    return { center: 0.5, mass: 55, boxes: [cube(1.5, 1, 2)] };
  if (kind === 'tv')
    return {
      center: 0.8,
      mass: 21,
      boxes: [cube(1.55, 0.62, 0.62), cube(1.5, 0.9, 0.2, 0, 1.23)],
    };
  if (kind === 'piano')
    return { center: 0.85, mass: 70, boxes: [cube(1.8, 1.72, 1)] };
  if (kind === 'bench')
    return {
      center: 0.65,
      mass: 18,
      boxes: [cube(1.85, 0.8, 0.75), cube(1.85, 0.5, 0.12, 0, 1.1, -0.32)],
    };
  if (kind === 'aquarium')
    return { center: 0.85, mass: 38, boxes: [cube(1.45, 1.72, 0.8)] };
  if (kind === 'easel')
    return { center: 1.05, mass: 6, boxes: [cube(1.12, 2.1, 0.9)] };
  if (kind === 'doghouse')
    return { center: 0.6, mass: 17, boxes: [cube(1.45, 1.3, 1.13)] };
  if (kind === 'fridge')
    return { center: 0.95, mass: 46, boxes: [cube(1.05, 1.9, 1)] };
  if (kind === 'washer')
    return { center: 0.58, mass: 52, boxes: [cube(1.15, 1.15, 1.1)] };
  if (kind === 'clock')
    return { center: 1.12, mass: 23, boxes: [cube(0.78, 2.24, 0.55)] };
  if (kind === 'duck')
    return { center: 0.24, mass: 0.8, boxes: [cube(0.55, 0.48, 0.66)] };
  if (kind === 'wall' || kind === 'window')
    return { center: 1.38, mass: 28, boxes: [cube(2, 2.76, 0.34)] };
  if (kind === 'door')
    return {
      center: 1.38,
      mass: 22,
      boxes: [
        cube(0.22, 2.76, 0.35, -0.88),
        cube(0.22, 2.76, 0.35, 0.88),
        cube(2, 0.22, 0.35, 0, 2.64),
      ],
    };
  if (kind === 'roof')
    return { center: 3.06, mass: 25, boxes: [cube(2, 0.9, 2, 0, 3.05)] };
  if (kind === 'stairs')
    return {
      center: 1.5,
      mass: 65,
      boxes: Array.from({ length: 12 }, (_, i) =>
        cube(
          1.98,
          (i + 1) * 0.25,
          1 / 3,
          0,
          (i + 1) * 0.125,
          2 - (i + 0.5) / 3,
        ),
      ),
    };
  if (kind === 'floor')
    return { center: 0.15, mass: 14, boxes: [cube(1.98, 0.25, 1.98, 0, 0.15)] };
  if (kind === 'table' || kind === 'workbench') {
    const heavy = kind === 'workbench',
      x = heavy ? 0.85 : 0.65,
      y = heavy ? 1.14 : 1.05;
    return {
      center: 0.62,
      mass: heavy ? 65 : 18,
      boxes: [
        cube(heavy ? 2.3 : 1.7, 0.18, heavy ? 1.3 : 1.2, 0, y),
        ...[-x, x].flatMap((x) =>
          [-0.4, 0.4].map((z) => cube(0.18, y, 0.18, x, y / 2, z)),
        ),
      ],
    };
  }
  if (kind === 'sofa')
    return {
      center: 0.62,
      mass: 42,
      boxes: [
        cube(2.18, 0.8, 1.03, 0, 0.55),
        cube(1.9, 0.77, 0.25, 0, 0.83, -0.44),
      ],
    };
  if (kind === 'bed')
    return { center: 0.55, mass: 48, boxes: [cube(1.65, 0.8, 2.3, 0, 0.48)] };
  if (kind === 'chair')
    return {
      center: 0.66,
      mass: 9,
      boxes: [
        cube(0.83, 0.76, 0.83, 0, 0.42),
        cube(0.82, 0.8, 0.16, 0, 1, -0.35),
      ],
    };
  if (kind === 'plant')
    return { center: 0.54, mass: 8, boxes: [cube(0.7, 0.8, 0.7, 0, 0.42)] };
  if (kind === 'lamp')
    return {
      center: 1.14,
      mass: 7,
      boxes: [
        cube(0.64, 0.16, 0.64, 0, 0.1),
        cube(0.14, 2.05, 0.14, 0, 1.13),
        cube(1.05, 0.58, 1.05, 0, 1.97),
      ],
    };
  if (kind === 'toilet')
    return {
      center: 0.58,
      mass: 30,
      boxes: [
        cube(0.85, 0.86, 1.02, 0, 0.43),
        cube(0.75, 1.15, 0.36, 0, 0.57, -0.35),
      ],
    };
  if (kind === 'cone')
    return {
      center: 0.35,
      mass: 2,
      boxes: [cube(0.55, 0.12, 0.55, 0, 0.08), cube(0.32, 0.62, 0.32, 0, 0.4)],
    };
  if (kind === 'pallet')
    return { center: 0.16, mass: 15, boxes: [cube(2.2, 0.3, 1.45, 0, 0.17)] };
  if (kind === 'bricks')
    return { center: 0.35, mass: 38, boxes: [cube(1.8, 0.7, 0.4, 0, 0.35)] };
  if (kind === 'barrow')
    return {
      center: 0.64,
      mass: 22,
      boxes: [
        cube(1.05, 0.8, 1.25, 0, 0.55),
        cube(0.9, 0.16, 1.3, 0, 0.78, 0.7),
      ],
    };
  return { center: 0.16, mass: 1.5, boxes: [cube(0.95, 0.26, 0.33, 0, 0.16)] }; // bone
}

export function siteProps(map?: MapId): Piece[] {
  return [
    { id: 'site-workbench', kind: 'workbench', x: -7, z: 0.1 },
    { id: 'site-pallet', kind: 'pallet', x: 5.9, z: -1.1 },
    { id: 'site-bricks', kind: 'bricks', x: -6.1, z: 5.7 },
    { id: 'site-barrow', kind: 'barrow', x: 8, z: 3.8 },
    { id: 'site-bone', kind: 'bone', x: -2, z: 5.2 },
    ...[-1, 0, 1].map((i) => ({
      id: `site-cone-${i}`,
      kind: 'cone',
      x: 6 + i * 1.1,
      z: 6.3,
    })),
    { id: 'site-cone-west', kind: 'cone', x: -4.8, z: 5.7 },
  ].map((p) => ({
    ...p,
    kind: p.kind as ItemKind,
    x: p.x * mapConfig(map).scale,
    z: p.z * mapConfig(map).scale,
    rotation: 0,
    placed: false,
  }));
}

function pointIn(s: Solid, pos: Vec, radius: number) {
  const a = s.angle || 0,
    dx = pos.x - s.x,
    dz = pos.z - s.z;
  const x = dx * Math.cos(a) - dz * Math.sin(a),
    z = dx * Math.sin(a) + dz * Math.cos(a);
  return (
    Math.hypot(
      Math.max(0, Math.abs(x) - s.w / 2),
      Math.max(0, Math.abs(z) - s.d / 2),
    ) < radius
  );
}
export function horizontalSolids(
  world: World,
  ignoreId?: string,
  height = 0.43,
) {
  return [
    ...scenerySolids(world.map).filter(
      (s) => s.y + s.h / 2 > height + 0.12 && s.y - s.h / 2 < height + 1.47,
    ),
    ...world.pieces.flatMap((p) => {
      if (
        p.id === ignoreId ||
        p.heldBy ||
        p.kind === 'floor' ||
        p.kind === 'roof' ||
        p.kind === 'stairs'
      )
        return [];
      if (p.physics && !p.placed) {
        const [qx, qy, qz, qw] = p.physics.q;
        return pieceShape(p.kind).boxes.flatMap((s) => {
          const corners = [];
          for (const ix of [-1, 1])
            for (const iy of [-1, 1])
              for (const iz of [-1, 1]) {
                const x = s.x + (ix * s.w) / 2,
                  y = s.y + (iy * s.h) / 2,
                  z = s.z + (iz * s.d) / 2;
                const tx = 2 * (qy * z - qz * y),
                  ty = 2 * (qz * x - qx * z),
                  tz = 2 * (qx * y - qy * x);
                corners.push({
                  x: p.x + x + qw * tx + qy * tz - qz * ty,
                  y: p.physics!.y + y + qw * ty + qz * tx - qx * tz,
                  z: p.z + z + qw * tz + qx * ty - qy * tx,
                });
              }
          const min = {
            x: Math.min(...corners.map((v) => v.x)),
            y: Math.min(...corners.map((v) => v.y)),
            z: Math.min(...corners.map((v) => v.z)),
          };
          const max = {
            x: Math.max(...corners.map((v) => v.x)),
            y: Math.max(...corners.map((v) => v.y)),
            z: Math.max(...corners.map((v) => v.z)),
          };
          if (max.y < height + 0.12 || min.y > height + 1.67) return [];
          return [
            {
              x: (min.x + max.x) / 2,
              y: (min.y + max.y) / 2,
              z: (min.z + max.z) / 2,
              w: max.x - min.x,
              h: max.y - min.y,
              d: max.z - min.z,
            },
          ];
        });
      }
      return pieceShape(p.kind)
        .boxes.filter(
          (s) =>
            s.y + pieceBase(p, world.map) + s.h / 2 > height + 0.12 &&
            s.y + pieceBase(p, world.map) - s.h / 2 < height + 1.42,
        )
        .map((s) => {
          const a = (p.rotation * Math.PI) / 2;
          return {
            ...s,
            x: p.x + s.x * Math.cos(a) + s.z * Math.sin(a),
            z: p.z - s.x * Math.sin(a) + s.z * Math.cos(a),
            angle: a,
          };
        });
    }),
  ];
}
export function clearLine(world: World, from: Vec, to: Vec, ignoreId?: string) {
  const solids = horizontalSolids(
    world,
    ignoreId,
    from.y ?? surfaceHeight(from, world.map),
  ).filter((s) => !pointIn(s, to, 0.08));
  const n = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.18),
  );
  for (let i = 1; i < n; i++)
    if (
      solids.some((s) =>
        pointIn(
          s,
          {
            x: from.x + ((to.x - from.x) * i) / n,
            z: from.z + ((to.z - from.z) * i) / n,
          },
          0.06,
        ),
      )
    )
      return false;
  return true;
}
export function inReach(world: World, from: Vec, to: Vec, ignoreId?: string) {
  return (
    Math.abs(
      (from.y ?? surfaceHeight(from, world.map)) -
        (to.y ?? surfaceHeight(to, world.map)),
    ) <= 1.1 &&
    Math.hypot(from.x - to.x, from.z - to.z) <= REACH &&
    clearLine(world, from, to, ignoreId)
  );
}

/** Fit overhead slabs from the storey below, including intermediate stair heights. */
export function buildReach(world: World, from: Vec, to: Vec, kind: ItemKind) {
  const height =
    surfaceHeight(to, world.map) - (from.y ?? surfaceHeight(from, world.map));
  if (
    kind === 'floor' &&
    (to.level ?? 0) > 0 &&
    height > 0 &&
    height < STOREY_HEIGHT + 0.6
  )
    return (
      Math.hypot(from.x - to.x, from.z - to.z) <= REACH &&
      clearLine(world, from, to)
    );
  return inReach(world, from, to);
}

/** Grid A* runs only when a destination is selected, never in the frame loop. */
export function findPath(
  world: World,
  start: Vec,
  target: Vec,
  reach = 0.45,
  ignoreId?: string,
  canWorkAt?: (position: Vec) => boolean,
): Vec[] | null {
  const multi = world.pieces.some(
    (p) => p.placed && ((p.level ?? 0) > 0 || p.kind === 'stairs'),
  );
  const bounds = mapBounds(world.map),
    solidCache = new Map<number, Solid[]>();
  const solidsAt = (y: number) => {
    const key = Math.round(y * 20) / 20;
    let solids = solidCache.get(key);
    if (!solids) {
      solids = horizontalSolids(world, ignoreId, key);
      solidCache.set(key, solids);
    }
    return solids;
  };
  const stairSides = (p: Vec) =>
    world.pieces.some((s) => {
      if (s.kind !== 'stairs' || !s.placed || s.heldBy) return false;
      const local = localPoint(s, p),
        base = surfaceHeight(s, world.map);
      return (
        Math.abs(local.x) > 0.6 &&
        Math.abs(local.x) < 1.4 &&
        Math.abs(local.z) < 2.15 &&
        (p.y ?? 0.43) >= base - 0.1 &&
        (p.y ?? 0.43) < base + 2.9
      );
    });
  const free = (p: Vec) =>
    !stairSides(p) &&
    Math.abs(p.x) <= bounds.x - 0.2 &&
    p.z > bounds.back + 0.25 &&
    p.z < bounds.front - 0.2 &&
    !solidsAt(p.y ?? 0.43).some((s) => pointIn(s, p, 0.44)) &&
    (!multi ||
      (p.y ?? 0.43) < 0.9 ||
      [
        [0.32, 0],
        [-0.32, 0],
        [0, 0.32],
        [0, -0.32],
      ].every(([x, z]) =>
        walkSurfaces(world, { x: p.x + x, z: p.z + z }).some(
          (y) => Math.abs(y - (p.y ?? 0.43)) <= 0.51,
        ),
      ));
  const key = (p: Vec) => `${p.x},${p.z},${Math.round((p.y ?? 0.43) * 20)}`;
  const first = {
    x: Math.round(start.x * 2) / 2,
    z: Math.round(start.z * 2) / 2,
    y: multi ? (start.y ?? surfaceHeight(start, world.map)) : 0.43,
  };
  const targetY = target.y ?? surfaceHeight(target, world.map);
  type Node = Vec & { cost: number; score: number; parent?: Node };
  const open: Node[] = [{ ...first, cost: 0, score: 0 }],
    visited = new Set<string>();
  const dirs = [
    [0.5, 0],
    [-0.5, 0],
    [0, 0.5],
    [0, -0.5],
    [0.5, 0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [-0.5, -0.5],
  ];
  for (let limit = 0; open.length && limit < 14000; limit++) {
    open.sort((a, b) => a.score - b.score);
    const node = open.shift()!;
    if (visited.has(key(node))) continue;
    visited.add(key(node));
    if (
      free(node) &&
      Math.hypot(node.x - target.x, node.z - target.z) <= reach &&
      (canWorkAt
        ? canWorkAt(node)
        : (!multi || Math.abs((node.y ?? 0.43) - targetY) < 0.65) &&
          clearLine(world, node, target, ignoreId))
    ) {
      const path: Vec[] = [];
      let cursor: Node | undefined = node;
      while (cursor) {
        path.unshift({
          x: cursor.x,
          z: cursor.z,
          ...(multi ? { y: cursor.y } : {}),
        });
        cursor = cursor.parent;
      }
      return path;
    }
    for (const [dx, dz] of dirs) {
      const flat = { x: node.x + dx, z: node.z + dz };
      const heights = multi
        ? walkSurfaces(world, flat).filter(
            (y) => y - (node.y ?? 0.43) <= 0.51 && (node.y ?? 0.43) - y <= 0.55,
          )
        : [0.43];
      for (const y of heights) {
        const p = { ...flat, y };
        if (
          !free(p) ||
          visited.has(key(p)) ||
          (dx &&
            dz &&
            (!free({ x: p.x, z: node.z, y }) ||
              !free({ x: node.x, z: p.z, y })))
        )
          continue;
        const cost = node.cost + Math.hypot(dx, dz, y - (node.y ?? 0.43));
        open.push({
          ...p,
          cost,
          score: cost + Math.hypot(p.x - target.x, p.z - target.z, y - targetY),
          parent: node,
        });
      }
    }
  }
  return null;
}
