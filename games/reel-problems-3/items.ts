import { ITEM_DEFINITIONS, LOADOUT } from './content/items';
import { toBoatSpace, toWorldSpace } from './boat';
import { emit } from './events';
import { recordSecuredFish } from './missions';
import { scoreCatch } from './scoring';
import { STATION_POSITIONS } from './stations';
import type {
  AdventurePlayer,
  AdventureWorld,
  FishSpecies,
  ItemKind,
  ItemStateRecord,
  StationKind,
} from './types';

export function spawnLoadout(): ItemStateRecord[] {
  const counts = new Map<ItemKind, number>();
  return LOADOUT.map((kind, index) => {
    const count = counts.get(kind) ?? 0;
    counts.set(kind, count + 1);
    return {
      id: `${kind}-${count}`,
      kind,
      state: 'loose' as const,
      space: 'boat' as const,
      x: 4.8 + (index % 4) * 1.15,
      y: 0.32,
      z: -2.2 + Math.floor(index / 4) * 1.4,
      vx: 0,
      vz: 0,
      yaw: (index % 3) * 0.18,
      durability: 100,
      contents:
        kind === 'bait-bucket' ? 96 : kind === 'ice-box' ? 12 : undefined,
    };
  });
}

function playerPoint(world: AdventureWorld, player: AdventurePlayer) {
  return player.space === 'boat'
    ? { x: player.x, z: player.z }
    : toBoatSpace(world, player);
}

function freeHands(
  world: AdventureWorld,
  player: AdventurePlayer,
  kind: ItemKind,
) {
  const definition = ITEM_DEFINITIONS[kind];
  if (definition.size === 'large') return player.held.length === 0;
  return (
    player.held.length < 2 &&
    player.held.every(
      (id) =>
        ITEM_DEFINITIONS[world.items.find((item) => item.id === id)!.kind]
          .size === 'small',
    )
  );
}

export function pickUpItem(
  world: AdventureWorld,
  player: AdventurePlayer,
  itemId: string,
  ignoreRange = false,
) {
  const item = world.items.find((candidate) => candidate.id === itemId);
  if (
    !item ||
    ['held', 'secured', 'recovering', 'submerged'].includes(item.state)
  )
    throw new Error('That item is not available.');
  if (!freeHands(world, player, item.kind))
    throw new Error('Your hands are full. Drop something first.');
  const point =
    item.space === 'boat' ? item : toBoatSpace(world, { x: item.x, z: item.z });
  const playerLocal = playerPoint(world, player);
  if (
    !ignoreRange &&
    Math.hypot(point.x - playerLocal.x, point.z - playerLocal.z) > 2.2
  )
    throw new Error('Move closer to pick that up.');
  item.state = 'held';
  item.holder = player.id;
  item.station = undefined;
  item.vx = 0;
  item.vz = 0;
  player.held.push(item.id);
  emit(world, 'item-picked', player.id, item.kind);
}

export function dropItem(
  world: AdventureWorld,
  player: AdventurePlayer,
  itemId = player.held.at(-1),
  throwForce = 0,
) {
  if (!itemId || !player.held.includes(itemId))
    throw new Error('You are not holding that.');
  const item = world.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('That item is missing.');
  player.held = player.held.filter((id) => id !== itemId);
  item.holder = undefined;
  item.station = undefined;
  item.space = player.space;
  item.state = throwForce > 0 ? 'thrown' : 'loose';
  item.x = player.x + Math.sin(player.yaw) * 0.75;
  item.z = player.z + Math.cos(player.yaw) * 0.75;
  item.y = 0.55;
  item.vx = Math.sin(player.yaw) * Math.min(8, throwForce);
  item.vz = Math.cos(player.yaw) * Math.min(8, throwForce);
  if (item.kind === 'fish') player.stats.droppedFish++;
}

export function placeItem(
  world: AdventureWorld,
  player: AdventurePlayer,
  station: StationKind,
  itemId = player.held.at(-1),
  ignoreRange = false,
) {
  if (!itemId || !player.held.includes(itemId))
    throw new Error('Carry the right item here first.');
  const item = world.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('That item is missing.');
  const definition = ITEM_DEFINITIONS[item.kind];
  if (item.kind === 'fish' && station !== 'ice-hold')
    throw new Error('Fresh catch belongs in the ice hold.');
  if (item.kind !== 'fish' && definition.rack !== station)
    throw new Error(`${definition.name} does not belong here.`);
  const position = STATION_POSITIONS[station];
  const local = playerPoint(world, player);
  if (
    !ignoreRange &&
    Math.hypot(position.x - local.x, position.z - local.z) > 2.4
  )
    throw new Error('Move closer to that station.');
  player.held = player.held.filter((id) => id !== itemId);
  item.holder = undefined;
  item.station = station;
  item.space = 'boat';
  item.state = item.kind === 'fish' ? 'secured' : 'racked';
  item.x = position.x;
  item.z = position.z;
  item.y = 0.55;
  item.vx = 0;
  item.vz = 0;
  if (item.kind === 'fish' && item.fishSpecies && item.fishWeight) {
    scoreCatch(player, item.fishSpecies, item.fishWeight);
    recordSecuredFish(world, player.id, item.fishSpecies, item.fishWeight);
  }
  emit(
    world,
    item.kind === 'fish' ? 'fish-secured' : 'item-placed',
    player.id,
    item.kind,
  );
  return item;
}

export function createFishItem(
  world: AdventureWorld,
  species: FishSpecies,
  weight: number,
  local: { x: number; z: number },
  motion: { y?: number; vx?: number; vy?: number; vz?: number } = {},
) {
  const item: ItemStateRecord = {
    id: `catch-${world.nextEvent + 1}-${world.items.length}`,
    kind: 'fish',
    state: motion.vy ? 'thrown' : 'loose',
    space: 'boat',
    x: local.x,
    y: motion.y ?? 0.35,
    z: local.z,
    vx: motion.vx ?? 0,
    vy: motion.vy ?? 0,
    vz: motion.vz ?? 0,
    yaw: 0,
    fishSpecies: species,
    fishWeight: weight,
  };
  world.items.push(item);
  return item;
}

export function loadedEssentials(world: AdventureWorld) {
  return world.items.filter(
    (item) => ITEM_DEFINITIONS[item.kind].essential && !!item.station,
  ).length;
}

export function stepItems(world: AdventureWorld, dt: number) {
  for (const item of world.items) {
    if (item.state === 'held') {
      const holder = world.players.find((player) => player.id === item.holder);
      if (!holder) {
        item.state = 'loose';
        item.holder = undefined;
        continue;
      }
      item.space = holder.space;
      item.x = holder.x + Math.sin(holder.yaw) * 0.55;
      item.z = holder.z + Math.cos(holder.yaw) * 0.55;
      item.y = 1.05;
      continue;
    }
    if (item.state === 'thrown' || item.state === 'loose') {
      item.x += item.vx * dt;
      item.z += item.vz * dt;
      item.vx *= Math.exp(-dt * 3.4);
      item.vz *= Math.exp(-dt * 3.4);
      if (item.kind === 'fish' && ((item.vy ?? 0) !== 0 || item.y > 0.35)) {
        item.vy = (item.vy ?? 0) - 12 * dt;
        item.y += item.vy * dt;
        if (item.y <= 0.35) {
          item.y = 0.35;
          if (Math.abs(item.vy) > 1.1) item.vy *= -0.28;
          else {
            item.vy = 0;
            item.state = 'loose';
            item.landedAt ??= world.clock;
          }
        }
      } else if (item.state === 'thrown' && Math.hypot(item.vx, item.vz) < 0.25)
        item.state = 'loose';
      const outsideDeck = Math.abs(item.x) > 3.45 || Math.abs(item.z) > 4.25;
      const onDock = world.phase === 'preparing' && item.x > 3.3 && item.x < 10;
      if (item.space === 'boat' && outsideDeck && !onDock) {
        const worldPoint = toWorldSpace(world, item);
        item.space = 'world';
        item.x = worldPoint.x;
        item.z = worldPoint.z;
        item.state = ITEM_DEFINITIONS[item.kind].floats
          ? 'floating'
          : 'submerged';
        item.recoverAt =
          world.clock + (ITEM_DEFINITIONS[item.kind].essential ? 9000 : 16000);
      }
    } else if (item.state === 'floating') {
      const dx = world.boat.x - item.x;
      const dz = world.boat.z - item.z;
      const distance = Math.max(0.1, Math.hypot(dx, dz));
      if (distance > 18) {
        item.x += (dx / distance) * dt * 0.8;
        item.z += (dz / distance) * dt * 0.8;
      }
    }
    if (
      item.recoverAt &&
      world.clock >= item.recoverAt &&
      ITEM_DEFINITIONS[item.kind].essential
    ) {
      const rack = ITEM_DEFINITIONS[item.kind].rack as StationKind;
      const position = STATION_POSITIONS[rack];
      item.state = 'racked';
      item.space = 'boat';
      item.x = position.x;
      item.z = position.z;
      item.y = 0.55;
      item.vx = 0;
      item.vz = 0;
      item.station = rack;
      item.recoverAt = undefined;
    }
  }
}
