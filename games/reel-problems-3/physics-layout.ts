import { ITEM_DEFINITIONS } from './content/items';
import type { AdventureWorld, RoundPhase } from './types';
import { HARBOR_LAYOUT } from './world-layout';
import {
  BOAT_FIXTURES,
  BOAT_LAYOUT,
  STARBOARD_RAIL_SEGMENTS,
} from './boat-layout';

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
  const halfLength = BOAT_LAYOUT.deck.halfLength;
  const result: AdventureCollider[] = [
    box('rail-port', BOAT_LAYOUT.portX, 0, 0.3, halfLength * 2 + 0.45),
    box('rail-bow', 0, -halfLength, BOAT_LAYOUT.deck.halfWidth * 2 + 0.45, 0.3),
    box(
      'rail-stern',
      0,
      halfLength,
      BOAT_LAYOUT.deck.halfWidth * 2 + 0.45,
      0.3,
    ),
    ...STARBOARD_RAIL_SEGMENTS.map((segment, index) =>
      box(
        `rail-starboard-${index}`,
        BOAT_LAYOUT.starboardX,
        segment.z,
        0.3,
        segment.depth,
      ),
    ),
  ];
  if (!preparing)
    result.push(
      box(
        'rail-starboard-gate-closed',
        BOAT_LAYOUT.starboardX,
        BOAT_LAYOUT.gate.z,
        0.3,
        BOAT_LAYOUT.gate.width,
      ),
    );
  return result;
}

export function adventureColliders(world: AdventureWorld): AdventureCollider[] {
  const result = boundaries(world.phase === 'preparing');
  for (const fixture of BOAT_FIXTURES)
    result.push(
      'radius' in fixture
        ? {
            id: fixture.id,
            shape: 'cylinder',
            x: fixture.x,
            z: fixture.z,
            radius: fixture.radius,
          }
        : box(fixture.id, fixture.x, fixture.z, fixture.width, fixture.depth),
    );
  if (world.phase === 'preparing') {
    result.push(
      {
        id: 'harbor-bell-frame',
        shape: 'box',
        x: HARBOR_LAYOUT.bell.x,
        z: HARBOR_LAYOUT.bell.z,
        width: HARBOR_LAYOUT.bell.width,
        depth: HARBOR_LAYOUT.bell.depth,
      },
      {
        id: 'harbor-tower',
        shape: 'cylinder',
        x: HARBOR_LAYOUT.tower.x,
        z: HARBOR_LAYOUT.tower.z,
        radius: HARBOR_LAYOUT.tower.radius,
      },
      {
        id: 'harbor-shed',
        shape: 'box',
        x: HARBOR_LAYOUT.shed.x,
        z: HARBOR_LAYOUT.shed.z,
        width: HARBOR_LAYOUT.shed.width,
        depth: HARBOR_LAYOUT.shed.depth,
      },
      ...HARBOR_LAYOUT.trees.map((tree, index) => ({
        id: `harbor-tree-${index}`,
        shape: 'cylinder' as const,
        x: tree.x,
        z: tree.z,
        radius: tree.radius,
      })),
      ...HARBOR_LAYOUT.rocks.map((rock, index) => ({
        id: `harbor-rock-${index}`,
        shape: 'cylinder' as const,
        x: rock.x,
        z: rock.z,
        radius: rock.radius,
      })),
      ...HARBOR_LAYOUT.posts.map((post, index) => ({
        id: `dock-post-${index}`,
        shape: 'cylinder' as const,
        x: post.x,
        z: post.z,
        radius: post.radius,
      })),
    );
  }
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
  return BOAT_LAYOUT.spawns[seat % BOAT_LAYOUT.spawns.length];
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
