import { mapConfig, onFoundation, type MapId } from './maps';
import type { Piece, Vec, World } from './model';

export const STOREY_HEIGHT = 3;
export const MAX_LEVEL = 2;
export type LevelPosition = Vec & { level?: number; y?: number };
export const levelOf = (p: { level?: number }) => p.level ?? 0;
export const validLevel = (level: number) =>
  Number.isInteger(level) && level >= 0 && level <= MAX_LEVEL;
export function groundHeight(p: Vec, map?: MapId) {
  const { scale } = mapConfig(map);
  return onFoundation(p, map)
    ? 0.43
    : Math.abs(p.x) <= 9.25 * scale && Math.abs(p.z) <= 7.75 * scale
      ? 0.18
      : 0.08;
}
export function surfaceHeight(p: LevelPosition, map?: MapId) {
  return levelOf(p) > 0
    ? 0.43 + levelOf(p) * STOREY_HEIGHT
    : groundHeight(p, map);
}
export function pieceBase(p: Piece, map?: MapId) {
  return (
    surfaceHeight(p, map) - (p.kind === 'floor' && levelOf(p) > 0 ? 0.275 : 0)
  );
}
export function actorLevel(p: LevelPosition, map?: MapId) {
  return Math.max(
    0,
    Math.min(
      MAX_LEVEL,
      Math.round(((p.y ?? groundHeight(p, map)) - 0.43) / STOREY_HEIGHT),
    ),
  );
}
export function localPoint(piece: Piece, point: Vec) {
  const a = (piece.rotation * Math.PI) / 2,
    dx = point.x - piece.x,
    dz = point.z - piece.z;
  return {
    x: dx * Math.cos(a) - dz * Math.sin(a),
    z: dx * Math.sin(a) + dz * Math.cos(a),
  };
}
export function stairHeight(piece: Piece, point: Vec, map?: MapId) {
  const p = localPoint(piece, point);
  if (
    piece.kind !== 'stairs' ||
    !piece.placed ||
    piece.heldBy ||
    Math.abs(p.x) > 0.99 ||
    Math.abs(p.z) > 2
  )
    return null;
  return (
    surfaceHeight(piece, map) +
    Math.min(12, Math.max(1, Math.ceil((2 - p.z) * 3))) * 0.25
  );
}
export function stairLanding(piece: Piece): LevelPosition {
  const a = (piece.rotation * Math.PI) / 2;
  return {
    x: piece.x - 3 * Math.sin(a),
    z: piece.z - 3 * Math.cos(a),
    level: levelOf(piece) + 1,
  };
}
export function walkSurfaces(world: Pick<World, 'pieces' | 'map'>, point: Vec) {
  const heights = [groundHeight(point, world.map)];
  for (const p of world.pieces) {
    if (!p.placed || p.heldBy || p.hoisted) continue;
    if (
      p.kind === 'floor' &&
      Math.abs(point.x - p.x) <= 1 &&
      Math.abs(point.z - p.z) <= 1
    )
      heights.push(
        levelOf(p) > 0
          ? surfaceHeight(p, world.map)
          : groundHeight(p, world.map) + 0.275,
      );
    const stair = stairHeight(p, point, world.map);
    if (stair !== null) heights.push(stair);
  }
  return heights.filter(
    (y) =>
      !world.pieces.some((p) => {
        const stair = stairHeight(p, point, world.map);
        return (
          stair !== null &&
          y >= surfaceHeight(p, world.map) - 0.1 &&
          y < stair - 0.12
        );
      }),
  );
}
export function woodenSurface(
  world: Pick<World, 'pieces' | 'map'>,
  point: LevelPosition,
) {
  return world.pieces.some(
    (p) =>
      p.placed &&
      !p.heldBy &&
      ((p.kind === 'stairs' &&
        Math.abs((stairHeight(p, point, world.map) ?? -100) - (point.y ?? 0)) <
          0.35) ||
        (p.kind === 'floor' &&
          Math.abs(p.x - point.x) <= 1 &&
          Math.abs(p.z - point.z) <= 1 &&
          Math.abs(pieceBase(p, world.map) + 0.275 - (point.y ?? 0)) < 0.35)),
  );
}
