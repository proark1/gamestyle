import type { AdventurePhase, AdventureWorld } from './types';

export const PLAYER_RADIUS = 0.43;
export const PLAYER_HEIGHT = 1.46;
export const WORLD_LIMIT = 17;
export const ISLAND_CENTER_Z = -1;
export const ISLAND_LAND_RADIUS = 12.5;
export const ISLAND_BOAT_Z = 15.9;
export const ISLAND_GANGWAY_Z = 11.55;
export const ISLAND_GANGWAY_LENGTH = 4.2;
export const BELL_STATION = { x: 3.7, z: -3 } as const;

export type BoxCollider = {
  id: string;
  shape: 'box';
  x: number;
  z: number;
  width: number;
  depth: number;
  angle?: number;
};

export type CylinderCollider = {
  id: string;
  shape: 'cylinder';
  x: number;
  z: number;
  radius: number;
};

export type AdventureCollider = BoxCollider | CylinderCollider;

export type IslandScenery = {
  id: string;
  x: number;
  z: number;
  rockRadius: number;
  rockScale: [number, number, number];
  angle: number;
  tree?: { x: number; z: number; radius: number };
};

export function islandScenery(): IslandScenery[] {
  const scenery: IslandScenery[] = [];
  for (let index = 0; index < 34; index++) {
    const angle = index * 2.399;
    const radius = 5 + (index % 6) * 1.1;
    const x = Math.cos(angle) * radius;
    const z = ISLAND_CENTER_Z + Math.sin(angle) * radius;
    if (Math.abs(x) < 2.7 && z > -6 && z < 10) continue;
    scenery.push({
      id: `island-rock-${index}`,
      x,
      z,
      angle,
      rockRadius: 0.4 + (index % 3) * 0.13,
      rockScale: [0.45 + (index % 3) * 0.16, 0.45, 0.55],
      ...(index % 3 === 0
        ? {
            tree: {
              x: x + 0.3,
              z: z - 0.1,
              radius: 0.2,
            },
          }
        : {}),
    });
  }
  return scenery;
}

function box(
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  angle = 0,
): BoxCollider {
  return { id, shape: 'box', x, z, width, depth, angle };
}

function cylinder(
  id: string,
  x: number,
  z: number,
  radius: number,
): CylinderCollider {
  return { id, shape: 'cylinder', x, z, radius };
}

function worldBounds() {
  const thickness = 1;
  const span = WORLD_LIMIT * 2 + thickness * 2;
  return [
    box('world-west', -WORLD_LIMIT - thickness / 2, 0, thickness, span),
    box('world-east', WORLD_LIMIT + thickness / 2, 0, thickness, span),
    box('world-north', 0, -WORLD_LIMIT - thickness / 2, span, thickness),
    box('world-south', 0, WORLD_LIMIT + thickness / 2, span, thickness),
  ];
}

function boatColliders(centerZ: number, shoreOpening: boolean) {
  const colliders: AdventureCollider[] = [
    box('boat-port-rail', -3.2, centerZ, 0.32, 6.9),
    box('boat-starboard-rail', 3.2, centerZ, 0.32, 6.9),
    box('boat-bow-rail', 0, centerZ + 3.45, 6.7, 0.32),
    cylinder('boat-mast', 0, centerZ + 0.55, 0.18),
    box('boat-console', -1.72, centerZ - 1.95, 1.15, 0.9),
  ];
  if (shoreOpening) {
    colliders.push(
      box('boat-stern-port', -2.45, centerZ - 3.45, 1.85, 0.32),
      box('boat-stern-starboard', 2.45, centerZ - 3.45, 1.85, 0.32),
    );
  } else colliders.push(box('boat-stern-rail', 0, centerZ - 3.45, 6.7, 0.32));
  return colliders;
}

function harborColliders(world: AdventureWorld) {
  const colliders: AdventureCollider[] = [
    box('harbor-west-edge', -8.65, 1, 0.5, 13.5),
    box('harbor-east-edge', 8.65, 1, 0.5, 13.5),
    box('harbor-back-edge', 0, -5.7, 17.8, 0.5),
    box('harbor-water-port', -6.1, 7.55, 5.1, 0.45),
    box('harbor-water-starboard', 6.1, 7.55, 5.1, 0.45),
    ...boatColliders(10.5, true),
  ];
  for (let index = 0; index < 5; index++) {
    const x = -12 + index * 6;
    const z = -8 - (index % 2) * 1.7;
    colliders.push(box(`harbor-house-${index}`, x, z, 4.45, 4.05));
  }
  const stations: [string, number, number][] = [
    ['rope', -5.1, 0.2],
    ['lanterns', -1.7, -0.6],
    ['timber', 1.7, -0.6],
    ['chart', 5.1, 0.2],
  ];
  for (const [id, x, z] of stations)
    if (!world.loaded.includes(id))
      colliders.push(box(`supply-${id}`, x, z, 1.05, 0.88));
  for (const x of [-8, -6, -4, 4, 6, 8])
    colliders.push(cylinder(`dock-post-${x}`, x, 7, 0.17));
  return colliders;
}

function islandShore() {
  const colliders: AdventureCollider[] = [];
  const segments = 24;
  const radius = ISLAND_LAND_RADIUS + 0.28;
  const length = (Math.PI * 2 * radius) / segments + 0.22;
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = ISLAND_CENTER_Z + Math.sin(angle) * radius;
    if (z > 10.35 && Math.abs(x) < 3.5) continue;
    colliders.push(
      box(`shore-${index}`, x, z, length, 0.72, angle + Math.PI / 2),
    );
  }
  return colliders;
}

function islandColliders(world: AdventureWorld) {
  const colliders: AdventureCollider[] = [
    cylinder('beacon-tower', 0, -4.2, 2.25),
    ...islandShore(),
    ...boatColliders(ISLAND_BOAT_Z, true),
    box(
      'gangway-port-rope',
      -1.45,
      ISLAND_GANGWAY_Z,
      0.16,
      ISLAND_GANGWAY_LENGTH,
    ),
    box(
      'gangway-starboard-rope',
      1.45,
      ISLAND_GANGWAY_Z,
      0.16,
      ISLAND_GANGWAY_LENGTH,
    ),
  ];
  for (const item of islandScenery()) {
    colliders.push(cylinder(item.id, item.x, item.z, item.rockRadius));
    if (item.tree)
      colliders.push(
        cylinder(`${item.id}-tree`, item.tree.x, item.tree.z, item.tree.radius),
      );
  }
  if (!world.beacons[world.beaconIndex]?.active)
    colliders.push(
      box('beacon-bell-frame', BELL_STATION.x, BELL_STATION.z, 1.95, 0.58),
    );
  return colliders;
}

export function adventureColliders(world: AdventureWorld) {
  let phaseColliders: AdventureCollider[] = [];
  if (world.phase === 'lobby' || world.phase === 'harbor')
    phaseColliders = harborColliders(world);
  else if (world.phase === 'search') phaseColliders = islandColliders(world);
  else if (world.phase === 'storm') phaseColliders = boatColliders(1.5, false);
  else if (world.phase === 'sanctuary')
    phaseColliders = boatColliders(2.5, false);
  else phaseColliders = harborColliders(world);
  return [...worldBounds(), ...phaseColliders];
}

export function physicsEnvironmentKey(world: AdventureWorld) {
  return [
    world.phase,
    world.beaconIndex,
    world.beacons[world.beaconIndex]?.active ? 'lit' : 'dark',
    world.loaded.join(','),
  ].join(':');
}

export function safeSpawn(phase: AdventurePhase, seat: number) {
  const x = -1.5 + seat;
  if (phase === 'search') return { x: (seat - 1.5) * 0.55, z: 7.8 };
  if (phase === 'storm') return { x, z: 3.35 };
  if (phase === 'sanctuary') return { x, z: 4.25 };
  return { x, z: 5 };
}

export function overlapsCollider(
  collider: AdventureCollider,
  x: number,
  z: number,
  radius = PLAYER_RADIUS,
) {
  const dx = x - collider.x;
  const dz = z - collider.z;
  if (collider.shape === 'cylinder')
    return Math.hypot(dx, dz) < collider.radius + radius;
  const angle = -(collider.angle ?? 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  const halfWidth = collider.width / 2;
  const halfDepth = collider.depth / 2;
  const closestX = Math.max(-halfWidth, Math.min(halfWidth, localX));
  const closestZ = Math.max(-halfDepth, Math.min(halfDepth, localZ));
  return Math.hypot(localX - closestX, localZ - closestZ) < radius;
}

export function positionIsBlocked(
  world: AdventureWorld,
  x: number,
  z: number,
  radius = PLAYER_RADIUS * 0.65,
) {
  return adventureColliders(world).some((collider) =>
    overlapsCollider(collider, x, z, radius),
  );
}
