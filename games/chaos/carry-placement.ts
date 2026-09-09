import type { Piece, Player, World } from './model';
import { actorLevel } from './levels';
import { mapBounds } from './maps';
import { inReach } from './colliders';
import { placementError } from './placement';

/** The HUD and the authoritative drop use exactly the same snapped footprint. */
export function carryPlacement(
  world: World,
  player: Player,
  piece: Piece,
  players: Player[],
) {
  const bounds = mapBounds(world.map);
  const limit = (value: number, extent: number) =>
    Math.round(
      Math.max(-Math.floor(extent), Math.min(Math.floor(extent), value)),
    );
  const target = {
    x: limit(player.x + Math.sin(player.angle) * 1.8, bounds.buildX),
    z: limit(player.z + Math.cos(player.angle) * 1.8, bounds.buildZ),
    level: actorLevel(player, world.map),
    rotation: ((Math.round(player.angle / (Math.PI / 2)) % 4) + 4) % 4,
  };
  const error =
    placementError(world, piece.kind, target, piece.id, target.rotation) ||
    (!inReach(world, player, target, piece.id)
      ? 'No clear space in front of you. Aim toward an open area.'
      : null) ||
    (players.some((p) => Math.hypot(p.x - target.x, p.z - target.z) < 0.85)
      ? 'Someone is standing here. Aim toward an open area.'
      : null);
  return { ...target, error };
}
