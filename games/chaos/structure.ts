import type { ItemKind, Piece, Player, Vec, World } from './model';
import { onFoundation } from './maps';
import { footprint, isWall } from './placement';
import {
  levelOf,
  MAX_LEVEL,
  stairLanding,
  surfaceHeight,
  validLevel,
} from './levels';

const touches = (
  a: ReturnType<typeof footprint>,
  b: ReturnType<typeof footprint>,
) =>
  Math.min(a.maxX, b.maxX) >= Math.max(a.minX, b.minX) - 0.03 &&
  Math.min(a.maxZ, b.maxZ) >= Math.max(a.minZ, b.minZ) - 0.03;
const solid = (p: Piece) => p.placed && !p.heldBy && !p.hoisted;

/** Walls may straddle a slab edge, but their entire centre line must bear on tiles. */
function wallSupported(floors: Piece[], pos: Vec, rotation: number) {
  const alongZ = rotation % 2 !== 0;
  const start = (alongZ ? pos.z : pos.x) - 1;
  const end = start + 2;
  const intervals = floors
    .filter(
      (floor) => Math.abs(alongZ ? floor.x - pos.x : floor.z - pos.z) <= 1.03,
    )
    .map((floor) => {
      const center = alongZ ? floor.z : floor.x;
      return [center - 1.03, center + 1.03];
    })
    .sort((a, b) => a[0] - b[0]);
  let covered = start;
  for (const [from, to] of intervals) {
    if (from > covered) return false;
    covered = Math.max(covered, to);
    if (covered >= end) return true;
  }
  return false;
}
export function supportedFloors(world: World, level: number) {
  const floors = world.pieces.filter(
    (p) => solid(p) && p.kind === 'floor' && levelOf(p) === level,
  );
  const supported = new Set<string>();
  for (const floor of floors) {
    const bounds = footprint('floor', floor, floor.rotation);
    if (
      world.pieces.some(
        (p) =>
          solid(p) &&
          levelOf(p) === level - 1 &&
          ((isWall(p.kind) &&
            touches(bounds, footprint(p.kind, p, p.rotation))) ||
            (p.kind === 'stairs' &&
              Math.hypot(
                floor.x - stairLanding(p).x,
                floor.z - stairLanding(p).z,
              ) < 0.1)),
      )
    )
      supported.add(floor.id);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const floor of floors)
      if (
        !supported.has(floor.id) &&
        floors.some(
          (p) =>
            supported.has(p.id) &&
            ((Math.abs(p.x - floor.x) < 0.02 &&
              Math.abs(Math.abs(p.z - floor.z) - 2) < 0.03) ||
              (Math.abs(p.z - floor.z) < 0.02 &&
                Math.abs(Math.abs(p.x - floor.x) - 2) < 0.03)),
        )
      ) {
        supported.add(floor.id);
        changed = true;
      }
  }
  return supported;
}
export function structureError(
  world: World,
  kind: ItemKind,
  pos: Vec,
  rotation: number,
  ignoreId?: string,
): string | null {
  const level = levelOf(pos);
  if (!validLevel(level)) return 'Choose Floor 1, 2 or 3.';
  if (kind === 'stairs' && level === MAX_LEVEL)
    return 'Floor 3 is the top floor. Add a roof here instead.';
  if (level > 0 || kind === 'stairs') {
    const b = footprint(kind, pos, rotation);
    if (
      !onFoundation({ x: b.minX, z: b.minZ }, world.map, 0.01) ||
      !onFoundation({ x: b.maxX, z: b.maxZ }, world.map, 0.01)
    )
      return 'Build upper floors and stairs above the foundation.';
  }
  if (kind === 'floor' && level > 0) {
    const b = footprint(kind, pos, rotation);
    if (
      world.pieces.some(
        (p) =>
          solid(p) &&
          p.kind === 'roof' &&
          levelOf(p) === level - 1 &&
          touches(b, footprint('roof', p, p.rotation)),
      )
    )
      return 'Move the roof before extending the house upward.';
    if (
      world.pieces.some(
        (p) =>
          solid(p) &&
          p.kind === 'stairs' &&
          levelOf(p) === level - 1 &&
          ((s) =>
            Math.min(b.maxX, s.maxX) - Math.max(b.minX, s.minX) > 0.05 &&
            Math.min(b.maxZ, s.maxZ) - Math.max(b.minZ, s.minZ) > 0.05)(
            footprint('stairs', p, p.rotation),
          ),
      )
    )
      return 'Leave the stairwell open. Put the landing beyond the top step.';
    const candidate: Piece = {
      id: ignoreId ?? 'preview-floor',
      kind,
      x: pos.x,
      z: pos.z,
      level,
      rotation,
      placed: true,
    };
    const next = {
      ...world,
      pieces: [...world.pieces.filter((p) => p.id !== ignoreId), candidate],
    };
    if (!supportedFloors(next, level).has(candidate.id))
      return 'Support this floor with walls below, a stair landing, or connected floor tiles.';
  } else if (level > 0 && kind !== 'roof') {
    const b = footprint(kind, pos, rotation),
      floors = world.pieces.filter(
        (p) => solid(p) && p.kind === 'floor' && levelOf(p) === level,
      );
    const points = [
      b.minX + 0.03,
      (b.minX + b.maxX) / 2,
      b.maxX - 0.03,
    ].flatMap((x) =>
      [b.minZ + 0.03, (b.minZ + b.maxZ) / 2, b.maxZ - 0.03].map((z) => ({
        x,
        z,
      })),
    );
    if (
      isWall(kind)
        ? !wallSupported(floors, pos, rotation)
        : points.some(
            (v) =>
              !floors.some(
                (f) =>
                  Math.abs(f.x - v.x) <= 1.03 && Math.abs(f.z - v.z) <= 1.03,
              ),
          )
    )
      return isWall(kind)
        ? 'Lay floor tiles along the full wall first. Walls can sit on the tile edge.'
        : 'Lay floor tiles under the whole part first.';
  }
  return null;
}
export function removalSupportError(
  world: World,
  piece: Piece,
  players: Player[] = [],
) {
  if (!piece.placed) return null;
  if (piece.kind === 'floor' || piece.kind === 'stairs') {
    const b = footprint(piece.kind, piece, piece.rotation),
      base = surfaceHeight(piece, world.map);
    if (
      players.some(
        (p) =>
          p.x >= b.minX - 0.3 &&
          p.x <= b.maxX + 0.3 &&
          p.z >= b.minZ - 0.3 &&
          p.z <= b.maxZ + 0.3 &&
          (p.y ?? 0.43) >= base - 0.35 &&
          (p.y ?? 0.43) <= base + (piece.kind === 'stairs' ? 3.3 : 0.6),
      )
    )
      return 'Someone is standing on this part. Ask them to move first.';
  }
  const next = {
    ...world,
    pieces: world.pieces.filter((p) => p.id !== piece.id),
  };
  if (
    next.pieces.some(
      (p) =>
        solid(p) &&
        levelOf(p) > 0 &&
        structureError(next, p.kind, p, p.rotation, p.id),
    )
  )
    return 'This part supports an upper floor. Remove the parts above it first.';
  if (
    next.pieces.some(
      (p) =>
        solid(p) &&
        p.kind === 'roof' &&
        levelOf(p) > 0 &&
        !next.pieces.some(
          (w) =>
            solid(w) &&
            isWall(w.kind) &&
            levelOf(w) === levelOf(p) &&
            touches(
              footprint(w.kind, w, w.rotation),
              footprint(p.kind, p, p.rotation),
            ),
        ),
    )
  )
    return 'Remove the supported roof first.';
  return null;
}
