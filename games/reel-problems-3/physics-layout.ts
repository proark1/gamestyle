import { ITEM_DEFINITIONS } from './content/items';
import type { AdventureWorld, RoundPhase } from './types';

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.46;
export const WORLD_LIMIT = 10.5;

export type AdventureCollider =
  | {
      id: string;
      shape: 'box';
      x: number;
      z: number;
      width: number;
      depth: number;
      angle?: number;
    }
  | { id: string; shape: 'cylinder'; x: number; z: number; radius: number };

const box = (
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
): AdventureCollider => ({ id, shape: 'box', x, z, width, depth });

function boundaries(preparing: boolean): AdventureCollider[] {
  const west = -3.35;
  const east = preparing ? 10.55 : 3.35;
  const north = -4.05;
  const south = 4.05;
  return [
    box('rail-port', west - 0.15, 0, 0.3, 8.4),
    box('rail-starboard', east + 0.15, 0, 0.3, 8.4),
    box('rail-bow', (west + east) / 2, north - 0.15, east - west + 0.6, 0.3),
    box('rail-stern', (west + east) / 2, south + 0.15, east - west + 0.6, 0.3),
    ...(preparing ? [box('dock-water-gap', 3.45, -2.7, 0.55, 2.1)] : []),
  ];
}

export function adventureColliders(world: AdventureWorld): AdventureCollider[] {
  const result = boundaries(world.phase === 'preparing');
  result.push(
    box('wheel-house', 0, -3.1, 2.2, 0.72),
    box('engine-box', 0.25, 3.15, 2.6, 0.72),
    box('ice-hold', 2.35, 1.9, 0.85, 1.25),
  );
  for (const item of world.items) {
    if (item.space !== 'boat' || !['loose', 'racked'].includes(item.state))
      continue;
    if (ITEM_DEFINITIONS[item.kind].size !== 'large') continue;
    result.push({
      id: `item-${item.id}`,
      shape: 'cylinder',
      x: item.x,
      z: item.z,
      radius: item.kind === 'ice-box' ? 0.62 : 0.32,
    });
  }
  return result;
}

export function physicsEnvironmentKey(world: AdventureWorld) {
  return `${world.phase}:${world.items
    .filter(
      (item) =>
        item.space === 'boat' &&
        ['loose', 'racked'].includes(item.state) &&
        ITEM_DEFINITIONS[item.kind].size === 'large',
    )
    .map(
      (item) =>
        `${item.id}:${item.state}:${item.x.toFixed(1)}:${item.z.toFixed(1)}`,
    )
    .join('|')}`;
}

export function safeSpawn(_phase: RoundPhase, seat: number) {
  return { x: -1.35 + seat * 0.9, z: 0.55 };
}

function circleBox(
  x: number,
  z: number,
  radius: number,
  collider: Extract<AdventureCollider, { shape: 'box' }>,
) {
  const px = Math.max(
    collider.x - collider.width / 2,
    Math.min(x, collider.x + collider.width / 2),
  );
  const pz = Math.max(
    collider.z - collider.depth / 2,
    Math.min(z, collider.z + collider.depth / 2),
  );
  return Math.hypot(x - px, z - pz) < radius;
}

export function positionIsBlocked(
  world: AdventureWorld,
  x: number,
  z: number,
  radius = PLAYER_RADIUS * 0.65,
) {
  return adventureColliders(world).some((collider) =>
    collider.shape === 'cylinder'
      ? Math.hypot(x - collider.x, z - collider.z) < radius + collider.radius
      : circleBox(x, z, radius, collider),
  );
}
