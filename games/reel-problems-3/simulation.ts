import { clamp } from '../../shared/math/clamp';
import { stepBoat, toBoatSpace } from './boat';
import { reconcileBots, stepBots } from './bots';
import { stepChaos, resolveIncident } from './chaos';
import { castLine, hookLine, stepFishing, untangleLine } from './fishing';
import {
  dropItem,
  loadedEssentials,
  pickUpItem,
  placeItem,
  spawnLoadout,
  stepItems,
} from './items';
import { generateMissions } from './missions';
import { createPlayer, freshStats } from './players';
import { adventurePhysics, resetAdventurePhysics } from './physics';
import { depart, finishDocking, resetRound, stepRound } from './round';
import { STATION_POSITIONS } from './stations';
import {
  idleInput,
  type AdventurePlayer,
  type AdventureSnapshot,
  type AdventureWorld,
  type StationKind,
} from './types';
import { updateStream } from './world-stream';

const STATIONS = new Set(Object.keys(STATION_POSITIONS));

export function newPlayer(seat: number): AdventurePlayer {
  return createPlayer(seat);
}

export function freshWorld(now: number): AdventureWorld {
  const seed = ((Math.floor(now) || 1) ^ 0x7265656c) >>> 0;
  const generated = generateMissions(seed);
  const world: AdventureWorld = {
    clock: now,
    started: 0,
    tick: 0,
    phase: 'lobby',
    randomState: generated.state,
    round: {
      seed,
      phase: 'lobby',
      startedAt: 0,
      prepEndsAt: 0,
      roundEndsAt: 0,
      returnEndsAt: 0,
      finishedAt: 0,
    },
    players: [],
    boat: {
      x: 0,
      z: 0,
      yaw: 0,
      speed: 0,
      throttle: 0,
      steer: 0,
      roll: 0,
      pitch: 0,
      hull: 100,
      water: 0,
      engine: 'off',
      docked: true,
      netTorn: false,
    },
    items: spawnLoadout(),
    fish: [],
    missions: generated.missions,
    activeMission: 0,
    cells: [],
    incidents: [],
    nextIncidentAt: now + 18_000,
    incidentId: 0,
    fogUntil: 0,
    events: [],
    nextEvent: 0,
  };
  reconcileBots(world);
  updateStream(world);
  return world;
}

export function startAdventure(world: AdventureWorld) {
  resetAdventurePhysics(world);
  reconcileBots(world);
  resetRound(world, (world.randomState ^ (world.clock | 0)) >>> 0);
}

export function setInput(
  world: AdventureWorld,
  id: string,
  raw: Record<string, unknown>,
) {
  const player = world.players.find(
    (candidate) => candidate.id === id && !candidate.bot,
  );
  if (!player) return;
  const yaw =
    typeof raw.yaw === 'number' && Number.isFinite(raw.yaw)
      ? clamp(raw.yaw, -Math.PI * 16, Math.PI * 16)
      : player.yaw;
  player.input = {
    x: clamp(Number(raw.x) || 0, -1, 1),
    z: clamp(Number(raw.z) || 0, -1, 1),
    yaw,
    sprint: raw.sprint === true,
    reel: raw.reel === true,
    brace: raw.brace === true,
    throttle: clamp(Number(raw.throttle) || 0, -1, 1),
    steer: clamp(Number(raw.steer) || 0, -1, 1),
    seq: Number.isSafeInteger(raw.seq) ? Number(raw.seq) : 0,
  };
  player.yaw = yaw;
}

function moveOverboardPlayers(world: AdventureWorld, dt: number) {
  for (const player of world.players) {
    if (player.bot || (!player.overboard && player.space !== 'world')) continue;
    if (player.overboard || player.space === 'world') {
      player.stats.overboardMs += dt * 1000;
      player.x += Math.sin(player.yaw) * player.input.z * 1.15 * dt;
      player.z += Math.cos(player.yaw) * player.input.z * 1.15 * dt;
      continue;
    }
  }
}

export function advanceWorld(world: AdventureWorld, now: number) {
  const delta = Math.max(0, Math.min(100, now - world.clock));
  world.clock = now;
  world.tick++;
  const dt = delta / 1000;
  if (dt <= 0 || ['lobby', 'finished', 'failed'].includes(world.phase)) return;
  moveOverboardPlayers(world, dt);
  adventurePhysics(world).step(dt);
  for (const player of world.players)
    if (!player.bot && player.station === 'helm') player.stats.helmTime += dt;
  stepBots(world, dt);
  stepBoat(world, dt);
  stepItems(world, dt);
  stepFishing(world, dt);
  stepChaos(world, dt);
  stepRound(world);
}

function actor(world: AdventureWorld, id: string) {
  const player = world.players.find((candidate) => candidate.id === id);
  if (!player) throw new Error('That crew member is not aboard.');
  return player;
}

function nearStation(player: AdventurePlayer, station: StationKind) {
  const point = STATION_POSITIONS[station];
  return Math.hypot(point.x - player.x, point.z - player.z) <= 2.5;
}

function interactWithStation(
  world: AdventureWorld,
  player: AdventurePlayer,
  station: StationKind,
) {
  if (player.space !== 'boat' || !nearStation(player, station))
    throw new Error('Move closer to that station.');
  if (station === 'helm') {
    if (
      world.phase === 'docking' &&
      Math.hypot(world.boat.x, world.boat.z) <= 8 &&
      Math.abs(world.boat.speed) <= 1.7
    )
      return finishDocking(world, player.id);
    const current = world.players.find(
      (candidate) => candidate.station === 'helm' && candidate.id !== player.id,
    );
    if (current && !current.bot)
      throw new Error(`${current.name} is already at the helm.`);
    if (current) current.station = undefined;
    player.station = player.station === 'helm' ? undefined : 'helm';
    return;
  }
  if (station === 'engine') {
    if (world.boat.engine !== 'stalled')
      throw new Error('The engine is already running cleanly.');
    world.boat.engine = 'running';
    player.stats.repairs++;
    player.stats.score += 35;
    resolveIncident(world, 'engine-stall', player.id);
    return;
  }
  if (station === 'repair-bench') {
    if (world.boat.hull >= 99 && !world.boat.netTorn)
      throw new Error('Nothing needs patching.');
    world.boat.hull = Math.min(100, world.boat.hull + 18);
    world.boat.netTorn = false;
    player.stats.repairs++;
    player.stats.score += 20;
    resolveIncident(world, 'hull-leak', player.id);
    resolveIncident(world, 'torn-net', player.id);
    return;
  }
  if (station === 'bilge-pump') {
    if (world.boat.water <= 1) throw new Error('The bilge is dry.');
    world.boat.water = Math.max(0, world.boat.water - 28);
    player.stats.bails++;
    return;
  }
  if (station === 'rescue-line') {
    const swimmer = world.players.find((candidate) => candidate.overboard);
    if (!swimmer) throw new Error('Everyone is safely aboard.');
    const local = toBoatSpace(world, swimmer);
    swimmer.space = 'boat';
    swimmer.overboard = false;
    swimmer.x = clamp(local.x, -2.3, 2.3);
    swimmer.z = 0.5;
    player.stats.rescues++;
    player.stats.score += 60;
    return;
  }
  const held = player.held.at(-1);
  if (held) placeItem(world, player, station, held);
  else player.station = player.station === station ? undefined : station;
}

function interact(
  world: AdventureWorld,
  player: AdventurePlayer,
  target: string,
) {
  const item = world.items.find((candidate) => candidate.id === target);
  if (item) return pickUpItem(world, player, item.id);
  if (target.startsWith('station:')) target = target.slice(8);
  if (STATIONS.has(target))
    return interactWithStation(world, player, target as StationKind);
  if (target === 'depart') {
    if (world.phase !== 'preparing')
      throw new Error('The boat is already away from the pier.');
    if (loadedEssentials(world) < 10)
      throw new Error('Load the essential fishing and safety gear first.');
    return depart(world, player.id);
  }
  throw new Error('There is nothing to use there.');
}

export function adventureAction(
  world: AdventureWorld,
  id: string,
  raw: Record<string, unknown>,
  isHost: boolean,
) {
  const type = String(raw.type);
  if (type === 'start' || type === 'restart') {
    if (!isHost) throw new Error('Only the crew leader can start the round.');
    if (
      type === 'start' &&
      !['lobby', 'finished', 'failed'].includes(world.phase)
    )
      throw new Error('The fishing round is already underway.');
    return startAdventure(world);
  }
  const player = actor(world, id);
  if (type === 'interact')
    return interact(
      world,
      player,
      typeof raw.target === 'string' ? raw.target : '',
    );
  if (type === 'drop')
    return dropItem(
      world,
      player,
      typeof raw.item === 'string' ? raw.item : undefined,
    );
  if (type === 'throw')
    return dropItem(
      world,
      player,
      typeof raw.item === 'string' ? raw.item : undefined,
      6,
    );
  if (type === 'cast')
    return castLine(world, player, Number(raw.power) || 0.65);
  if (type === 'hook') return hookLine(world, player);
  if (type === 'untangle') return untangleLine(world, player);
  if (type === 'dock') return finishDocking(world, player.id);
  throw new Error('That action is not available.');
}

export function replaceOwner(
  world: AdventureWorld,
  previous: string,
  next: string,
) {
  for (const event of world.events)
    if (event.actor === previous) event.actor = next;
  for (const item of world.items)
    if (item.holder === previous) item.holder = next;
}

export function resetPlayerForRound(player: AdventurePlayer) {
  player.stats = freshStats();
  player.input = idleInput();
}

export function snapshot(
  world: AdventureWorld,
  code: string,
  host: string,
  selfId: string,
  version: number,
): AdventureSnapshot {
  return {
    code,
    host,
    selfId,
    version,
    partyRoundStarted: world.partyRoundStarted,
    world: structuredClone(world),
  };
}
