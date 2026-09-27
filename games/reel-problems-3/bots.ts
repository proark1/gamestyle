import { toBoatSpace } from './boat';
import { castLine, hookLine, untangleLine } from './fishing';
import { dropItem, pickUpItem, placeItem } from './items';
import { currentMission, insideMissionZone } from './missions';
import { createPlayer } from './players';
import { finishDocking } from './round';
import { STATION_POSITIONS } from './stations';
import { ITEM_DEFINITIONS } from './content/items';
import { FISH_DEFINITIONS } from './content/fish';
import type {
  AdventurePlayer,
  AdventureWorld,
  ItemStateRecord,
  StationKind,
} from './types';

const CREW_SIZE = 4;

export function reconcileBots(world: AdventureWorld) {
  const humans = new Set(
    world.players.filter((player) => !player.bot).map((player) => player.seat),
  );
  world.players = world.players.filter(
    (player) => !player.bot || !humans.has(player.seat),
  );
  for (let seat = 0; seat < CREW_SIZE; seat++) {
    if (!world.players.some((player) => player.seat === seat))
      world.players.push(createPlayer(seat, world.clock, true));
  }
  world.players.sort((a, b) => a.seat - b.seat);
}

function moveTo(
  player: AdventurePlayer,
  target: { x: number; z: number },
  dt: number,
) {
  if (player.space !== 'boat')
    return Math.hypot(target.x - player.x, target.z - player.z);
  const dx = target.x - player.x;
  const dz = target.z - player.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 0.06) {
    const step = Math.min(distance, dt * 3.25);
    player.x += (dx / distance) * step;
    player.z += (dz / distance) * step;
    player.yaw = Math.atan2(dx, dz);
  }
  return distance;
}

function station(
  world: AdventureWorld,
  player: AdventurePlayer,
  kind: StationKind,
  dt: number,
) {
  const distance = moveTo(player, STATION_POSITIONS[kind], dt);
  if (distance < 0.65) player.station = kind;
  return distance < 0.8;
}

function loadTarget(world: AdventureWorld, player: AdventurePlayer) {
  if (player.held.length)
    return world.items.find((item) => item.id === player.held[0]);
  const claimed = new Set(
    world.players
      .filter(
        (candidate) =>
          candidate.task?.kind === 'load' && candidate.id !== player.id,
      )
      .map((candidate) => candidate.task?.target),
  );
  return world.items.find(
    (item) =>
      ITEM_DEFINITIONS[item.kind].essential &&
      item.state === 'loose' &&
      !claimed.has(item.id),
  );
}

function stepLoading(
  world: AdventureWorld,
  player: AdventurePlayer,
  dt: number,
) {
  const item = loadTarget(world, player);
  if (!item) {
    station(world, player, 'helm', dt);
    return;
  }
  player.task = { kind: 'load', target: item.id, claimedAt: world.clock };
  if (!player.held.includes(item.id)) {
    if (moveTo(player, item, dt) < 0.8)
      pickUpItem(world, player, item.id, true);
    return;
  }
  const rack = ITEM_DEFINITIONS[item.kind].rack as StationKind | undefined;
  if (rack && station(world, player, rack, dt)) {
    placeItem(world, player, rack, item.id, true);
    player.task = undefined;
    player.station = undefined;
  }
}

function helmBot(world: AdventureWorld) {
  if (world.players.some((player) => !player.bot && player.station === 'helm'))
    return undefined;
  return (
    world.players.find((player) => player.bot && player.station === 'helm') ??
    world.players.find((player) => player.bot)
  );
}

function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function stepHelm(world: AdventureWorld, player: AdventurePlayer, dt: number) {
  if (!station(world, player, 'helm', dt)) return;
  player.task = { kind: 'helm', claimedAt: world.clock };
  const mission = currentMission(world);
  const target =
    world.phase === 'returning' || world.phase === 'docking'
      ? { x: 0, z: 0 }
      : mission
        ? { x: mission.zoneX, z: mission.zoneZ }
        : { x: 0, z: 0 };
  const desired = Math.atan2(target.x - world.boat.x, target.z - world.boat.z);
  const error = wrapAngle(desired - world.boat.yaw);
  const distance = Math.hypot(target.x - world.boat.x, target.z - world.boat.z);
  player.input.steer = Math.max(-1, Math.min(1, error * 1.8));
  player.input.throttle =
    Math.abs(error) > 1.35 ? 0.2 : distance < 8 ? 0.18 : 0.82;
  if (world.phase === 'fishing' && insideMissionZone(world))
    player.input.throttle = 0;
  if (world.phase === 'docking') {
    player.input.throttle = distance > 5 ? 0.18 : -0.15;
    if (distance < 5.5 && Math.abs(world.boat.speed) < 1.7)
      finishDocking(world, player.id);
  }
}

function acquire(
  world: AdventureWorld,
  player: AdventurePlayer,
  kind: ItemStateRecord['kind'],
  dt: number,
) {
  if (
    player.held.some(
      (id) => world.items.find((item) => item.id === id)?.kind === kind,
    )
  )
    return true;
  if (player.held.length) dropItem(world, player, player.held[0]);
  const item = world.items.find(
    (candidate) =>
      candidate.kind === kind && ['racked', 'loose'].includes(candidate.state),
  );
  if (!item) return false;
  if (moveTo(player, item, dt) < 0.8) pickUpItem(world, player, item.id, true);
  return false;
}

function stepAngler(
  world: AdventureWorld,
  player: AdventurePlayer,
  dt: number,
) {
  player.task = { kind: 'fish', claimedAt: world.clock };
  player.station = undefined;
  if (!acquire(world, player, 'rod', dt)) return;
  const rail = {
    x: player.seat % 2 ? 2.45 : -2.45,
    z: player.seat < 2 ? 0.4 : 1.5,
  };
  if (moveTo(player, rail, dt) > 0.65) return;
  player.yaw = rail.x < 0 ? -Math.PI / 2 : Math.PI / 2;
  if (!player.line) {
    const hasBait = world.items.some(
      (item) => item.kind === 'bait-bucket' && (item.contents ?? 0) > 0,
    );
    if (hasBait) castLine(world, player, 0.72);
    return;
  }
  if (player.line.state === 'biting') hookLine(world, player);
  if (player.line.state === 'tangled') untangleLine(world, player);
  const hookedFish = player.line?.fishId
    ? world.fish.find((fish) => fish.id === player.line?.fishId)
    : undefined;
  const safeTension = hookedFish
    ? FISH_DEFINITIONS[hookedFish.species].safeTension
    : 0.7;
  player.input.reel =
    player.line?.state === 'hooked' &&
    player.line.tension < safeTension - 0.025;
}

function stepNet(world: AdventureWorld, player: AdventurePlayer, dt: number) {
  player.task = { kind: 'net', claimedAt: world.clock };
  if (!acquire(world, player, 'landing-net', dt)) return;
  station(world, player, 'net-rack', dt);
}

function stepStore(world: AdventureWorld, player: AdventurePlayer, dt: number) {
  const heldFish = player.held.find(
    (id) => world.items.find((item) => item.id === id)?.kind === 'fish',
  );
  const fish = heldFish
    ? world.items.find((item) => item.id === heldFish)
    : world.items.find(
        (item) =>
          item.kind === 'fish' &&
          item.state === 'loose' &&
          item.space === 'boat',
      );
  if (!fish) return false;
  player.task = { kind: 'store', target: fish.id, claimedAt: world.clock };
  if (!heldFish) {
    if (player.held.length) dropItem(world, player, player.held[0]);
    if (moveTo(player, fish, dt) < 0.75)
      pickUpItem(world, player, fish.id, true);
    return true;
  }
  if (station(world, player, 'ice-hold', dt)) {
    placeItem(world, player, 'ice-hold', fish.id, true);
    player.station = undefined;
  }
  return true;
}

function stepEmergency(
  world: AdventureWorld,
  player: AdventurePlayer,
  dt: number,
) {
  const overboard = world.players.find((candidate) => candidate.overboard);
  if (overboard) {
    player.task = {
      kind: 'rescue',
      target: overboard.id,
      claimedAt: world.clock,
    };
    if (station(world, player, 'rescue-line', dt)) {
      const local = toBoatSpace(world, overboard);
      overboard.space = 'boat';
      overboard.overboard = false;
      overboard.x = Math.max(-2.4, Math.min(2.4, local.x));
      overboard.z = 0.4;
      player.stats.rescues++;
    }
    return true;
  }
  if (world.boat.water > 68) {
    player.task = { kind: 'bail', claimedAt: world.clock };
    if (station(world, player, 'bilge-pump', dt)) {
      world.boat.water = Math.max(0, world.boat.water - dt * 24);
      player.stats.bails += dt;
    }
    return true;
  }
  if (
    world.boat.engine === 'stalled' ||
    world.boat.hull < 42 ||
    world.boat.netTorn
  ) {
    player.task = { kind: 'repair', claimedAt: world.clock };
    if (
      station(
        world,
        player,
        world.boat.engine === 'stalled' ? 'engine' : 'repair-bench',
        dt,
      )
    ) {
      world.boat.engine = 'running';
      world.boat.hull = Math.min(100, world.boat.hull + dt * 12);
      world.boat.netTorn = false;
      player.stats.repairs += dt;
    }
    return true;
  }
  return false;
}

export function stepBots(world: AdventureWorld, dt: number) {
  const designatedHelm = helmBot(world);
  const largeFish = world.fish.find(
    (fish) =>
      fish.state === 'hooked' && FISH_DEFINITIONS[fish.species].needsNet,
  );
  const netHelper = largeFish
    ? world.players.find(
        (player) =>
          player.bot &&
          player !== designatedHelm &&
          !largeFish.hookedBy.includes(player.id),
      )
    : undefined;
  const emergencyHelper = world.players.find(
    (player) => player.bot && player !== designatedHelm && player !== netHelper,
  );
  for (const player of world.players) {
    if (!player.bot) continue;
    player.input.reel = false;
    player.input.brace = false;
    if (player.overboard) {
      player.stats.overboardMs += dt * 1000;
      continue;
    }
    if (world.phase === 'preparing') {
      stepLoading(world, player, dt);
      continue;
    }
    if (['outbound', 'fishing', 'returning', 'docking'].includes(world.phase)) {
      if (player === designatedHelm) {
        stepHelm(world, player, dt);
        player.stats.helmTime += dt;
        continue;
      }
      if (player === netHelper) {
        stepNet(world, player, dt);
        continue;
      }
      if (player === emergencyHelper && stepEmergency(world, player, dt))
        continue;
      if (stepStore(world, player, dt)) continue;
      if (world.phase === 'fishing' && insideMissionZone(world))
        stepAngler(world, player, dt);
    }
  }
}
