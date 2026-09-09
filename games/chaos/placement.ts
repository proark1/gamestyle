import { mapBounds } from './maps';
import { actorLevel, levelOf } from './levels';
import { structureError } from './structure';
import { pieceShape, scenerySolids, surfaceHeight } from './colliders';
import type { ItemKind, Vec, World } from './model';

export const isWall = (kind: ItemKind) =>
  ['wall', 'window', 'door'].includes(kind);
const layer = (kind: ItemKind) =>
  isWall(kind)
    ? 'wall'
    : kind === 'roof' || kind === 'floor'
      ? kind
      : 'furniture';
export type BuildTarget = Vec & {
  rotation: number;
  snapped: boolean;
  join?: 'edge' | 'corner';
};
type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export function footprint(kind: ItemKind, pos: Vec, rotation = 0): Bounds {
  const shape = pieceShape(kind);
  const a = (rotation * Math.PI) / 2,
    c = Math.round(Math.cos(a)),
    s = Math.round(Math.sin(a));
  const points = shape.boxes.flatMap((b) =>
    [-1, 1].flatMap((x) =>
      [-1, 1].map((z) => ({
        x: pos.x + (b.x + (x * b.w) / 2) * c + (b.z + (z * b.d) / 2) * s,
        z: pos.z - (b.x + (x * b.w) / 2) * s + (b.z + (z * b.d) / 2) * c,
      })),
    ),
  );
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}
const overlap = (a: Bounds, b: Bounds, tolerance = 0.035) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > tolerance &&
  Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > tolerance;

/** A crane needs a clear vertical route for the whole roof, including partial overhangs. */
export function roofAccessError(
  world: World,
  pos: Vec,
  rotation = 0,
  ignoreId?: string,
): string | null {
  const bounds = footprint('roof', pos, rotation);
  const reserved = world.crane?.origin;
  const obstacles = reserved?.placed
    ? [...world.pieces, reserved]
    : world.pieces;
  const above = obstacles.find(
    (p) =>
      p.id !== ignoreId &&
      p.placed &&
      !p.heldBy &&
      !p.hoisted &&
      !p.supply &&
      levelOf(p) > levelOf(pos) &&
      overlap(bounds, footprint(p.kind, p, p.rotation)),
  );
  return above
    ? `Blocked from above by Floor ${levelOf(above) + 1}. Choose an exposed roof position.`
    : null;
}
const endpoints = (p: Vec, rotation: number) =>
  rotation % 2
    ? [
        { x: p.x, z: p.z - 1 },
        { x: p.x, z: p.z + 1 },
      ]
    : [
        { x: p.x - 1, z: p.z },
        { x: p.x + 1, z: p.z },
      ];
const samePoint = (a: Vec, b: Vec, tolerance = 0.05) =>
  Math.hypot(a.x - b.x, a.z - b.z) < tolerance;
const wallJoint = (a: Vec, ar: number, b: Vec, br: number) =>
  !samePoint(a, b) &&
  endpoints(a, ar).some((e) => endpoints(b, br).some((f) => samePoint(e, f)));

export function placementError(
  world: World,
  kind: ItemKind,
  pos: Vec,
  ignoreId?: string,
  rotation = 0,
): string | null {
  const support = structureError(world, kind, pos, rotation, ignoreId);
  if (support) return support;
  if (kind === 'roof') {
    const access = roofAccessError(world, pos, rotation, ignoreId);
    if (access) return access;
  }
  const map = mapBounds(world.map);
  if (
    !Number.isFinite(pos.x) ||
    !Number.isFinite(pos.z) ||
    Math.abs(pos.x) > map.buildX ||
    Math.abs(pos.z) > map.buildZ
  )
    return 'Build within the site.';
  const bounds = footprint(kind, pos, rotation),
    targetLayer = layer(kind);
  for (const s of scenerySolids(world.map)) {
    if (
      levelOf(pos) > 0 ||
      !s.name ||
      ['Plot', 'Building site', 'Foundation', 'Fence', 'Tree'].includes(
        s.name,
      ) ||
      s.y >= 4
    )
      continue;
    if (
      overlap(bounds, {
        minX: s.x - s.w / 2,
        maxX: s.x + s.w / 2,
        minZ: s.z - s.d / 2,
        maxZ: s.z + s.d / 2,
      })
    )
      return `Blocked by the ${s.name}. Choose a clear space.`;
  }
  const reserved = world.crane?.origin;
  const obstacles = reserved?.placed
    ? [...world.pieces, reserved]
    : world.pieces;
  for (const p of obstacles) {
    if (
      p.id === ignoreId ||
      p.heldBy ||
      p.hoisted ||
      !p.placed ||
      levelOf(p) !== levelOf(pos)
    )
      continue;
    const otherLayer = layer(p.kind);
    const joined =
      targetLayer === 'wall' &&
      otherLayer === 'wall' &&
      wallJoint(pos, rotation, p, p.rotation);
    const tiled =
      targetLayer === otherLayer &&
      ['floor', 'roof'].includes(targetLayer) &&
      ((Math.abs(pos.x - p.x) < 0.05 &&
        Math.abs(Math.abs(pos.z - p.z) - 2) < 0.05) ||
        (Math.abs(pos.z - p.z) < 0.05 &&
          Math.abs(Math.abs(pos.x - p.x) - 2) < 0.05));
    if (
      (joined || tiled) &&
      Math.abs(surfaceHeight(p, world.map) - surfaceHeight(pos, world.map)) >
        0.05
    )
      return 'These edges are at different heights. Build on the same surface.';
    if (
      targetLayer !== otherLayer &&
      !(targetLayer === 'wall' && otherLayer === 'furniture') &&
      !(targetLayer === 'furniture' && otherLayer === 'wall')
    )
      continue;
    if (!overlap(bounds, footprint(p.kind, p, p.rotation))) continue;
    if (joined) continue;
    if (targetLayer !== otherLayer)
      return 'No room here: furniture and walls cannot overlap.';
    return 'Not enough room. The parts overlap.';
  }
  if (
    kind === 'roof' &&
    !world.pieces.some(
      (p) =>
        p.placed &&
        isWall(p.kind) &&
        levelOf(p) === levelOf(pos) &&
        !p.heldBy &&
        Math.abs(surfaceHeight(p, world.map) - surfaceHeight(pos, world.map)) <
          0.05 &&
        overlap(bounds, footprint(p.kind, p, p.rotation), -0.02),
    )
  )
    return 'A roof needs a nearby wall.';
  return null;
}

/** Neighbor sockets take priority near an edge; free placement keeps the existing one-unit grid. */
export function snapPlacement(
  world: World,
  kind: ItemKind,
  raw: Vec,
  rotation = 0,
): BuildTarget {
  const candidates: BuildTarget[] = [];
  const level = levelOf(raw);
  for (const p of world.pieces) {
    if (levelOf(p) !== level || !p.placed || p.heldBy) continue;
    const add = (x: number, z: number, join: BuildTarget['join']) => {
      if (
        Math.hypot(raw.x - x, raw.z - z) <= 0.8 &&
        Math.abs(
          surfaceHeight(p, world.map) -
            surfaceHeight({ x, z, level }, world.map),
        ) < 0.05
      )
        candidates.push({
          x,
          z,
          ...(level ? { level } : {}),
          rotation,
          snapped: true,
          join,
        });
    };
    if (isWall(kind) && isWall(p.kind)) {
      for (const end of endpoints(p, p.rotation)) {
        if (rotation % 2) {
          add(
            end.x,
            end.z - 1,
            rotation % 2 === p.rotation % 2 ? 'edge' : 'corner',
          );
          add(
            end.x,
            end.z + 1,
            rotation % 2 === p.rotation % 2 ? 'edge' : 'corner',
          );
        } else {
          add(
            end.x - 1,
            end.z,
            rotation % 2 === p.rotation % 2 ? 'edge' : 'corner',
          );
          add(
            end.x + 1,
            end.z,
            rotation % 2 === p.rotation % 2 ? 'edge' : 'corner',
          );
        }
      }
    } else if (isWall(kind) && p.kind === 'floor' && level > 0) {
      if (rotation % 2) {
        add(p.x - 1, p.z, 'edge');
        add(p.x + 1, p.z, 'edge');
      } else {
        add(p.x, p.z - 1, 'edge');
        add(p.x, p.z + 1, 'edge');
      }
    } else if ((kind === 'floor' || kind === 'roof') && p.kind === kind) {
      for (const [x, z] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ])
        add(p.x + x, p.z + z, 'edge');
    } else if ((kind === 'floor' || kind === 'roof') && isWall(p.kind)) {
      if (p.rotation % 2) {
        add(p.x - 1, p.z, 'edge');
        add(p.x + 1, p.z, 'edge');
      } else {
        add(p.x, p.z - 1, 'edge');
        add(p.x, p.z + 1, 'edge');
      }
    }
  }
  const valid = candidates.filter(
    (p) => !placementError(world, kind, p, undefined, rotation),
  );
  valid.sort(
    (a, b) =>
      Math.hypot(a.x - raw.x, a.z - raw.z) -
      Math.hypot(b.x - raw.x, b.z - raw.z),
  );
  return (
    valid[0] || {
      x: Math.round(raw.x),
      z: Math.round(raw.z),
      ...(level ? { level } : {}),
      rotation,
      snapped: false,
    }
  );
}

export function playerBlocksPlacement(
  kind: ItemKind,
  pos: Vec,
  rotation: number,
  player: Vec,
) {
  if (
    kind === 'floor' ||
    kind === 'roof' ||
    actorLevel(player) !== levelOf(pos)
  )
    return false;
  const b = footprint(kind, pos, rotation);
  return (
    player.x > b.minX - 0.4 &&
    player.x < b.maxX + 0.4 &&
    player.z > b.minZ - 0.4 &&
    player.z < b.maxZ + 0.4
  );
}

export function joinsAt(
  world: World,
  kind: ItemKind,
  target: BuildTarget,
): Vec[] {
  if (!isWall(kind)) return [];
  return endpoints(target, target.rotation).filter((end) =>
    world.pieces.some(
      (p) =>
        p.placed &&
        isWall(p.kind) &&
        endpoints(p, p.rotation).some((e) => samePoint(e, end)) &&
        Math.abs(
          surfaceHeight(p, world.map) - surfaceHeight(target, world.map),
        ) < 0.05,
    ),
  );
}
