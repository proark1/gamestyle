import { emit } from './events';
import { spawnLoadout } from './items';
import { generateMissions, insideMissionZone } from './missions';
import { safeReturnBonus } from './scoring';
import { freshStats } from './players';
import type { AdventureWorld } from './types';
import { BOAT_LAYOUT } from './boat-layout';

export const PREPARATION_MS = 60_000;
export const ROUND_MS = 8 * 60_000;

export function resetRound(world: AdventureWorld, seed = world.randomState) {
  const generated = generateMissions(seed);
  world.randomState = generated.state;
  world.started = world.clock;
  world.phase = 'preparing';
  world.round = {
    seed,
    phase: 'preparing',
    startedAt: world.clock,
    prepEndsAt: world.clock + PREPARATION_MS,
    roundEndsAt: world.clock + ROUND_MS,
    returnEndsAt: 0,
    finishedAt: 0,
  };
  world.boat = {
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
  };
  world.items = spawnLoadout();
  world.fish = [];
  world.missions = generated.missions;
  world.activeMission = 0;
  world.incidents = [];
  world.incidentId = 0;
  world.nextIncidentAt = world.clock + 18_000;
  world.fogUntil = 0;
  for (const player of world.players) {
    player.space = 'boat';
    player.x = -1.5 + player.seat;
    player.z = 0.8;
    player.yaw = 0;
    player.overboard = false;
    player.station = undefined;
    player.held = [];
    player.line = null;
    player.task = undefined;
    player.stats = freshStats();
    player.input.throttle = 0;
    player.input.steer = 0;
    player.input.reel = false;
  }
  emit(world, 'round-started');
}

export function depart(world: AdventureWorld, actor?: string) {
  if (world.phase !== 'preparing') return;
  world.phase = world.round.phase = 'outbound';
  world.boat.docked = false;
  world.boat.engine = 'running';
  emit(world, 'departed', actor);
}

export function finishDocking(world: AdventureWorld, actor?: string) {
  if (world.phase !== 'docking' || world.activeMission < world.missions.length)
    throw new Error('Complete every mission before docking.');
  if (
    Math.hypot(world.boat.x, world.boat.z) > 8 ||
    Math.abs(world.boat.speed) > 1.7
  )
    throw new Error('Slow down inside the harbor markers.');
  world.phase = world.round.phase = 'finished';
  world.round.finishedAt = world.clock;
  world.round.result = 'success';
  world.boat.docked = true;
  world.boat.engine = 'off';
  safeReturnBonus(world);
  emit(world, 'docked', actor);
}

export function stepRound(world: AdventureWorld) {
  if (world.phase === 'preparing' && world.clock >= world.round.prepEndsAt) {
    const botsAboard = world.players
      .filter((player) => player.bot && player.space === 'boat')
      .every((player) => player.x < BOAT_LAYOUT.starboardX - 0.15);
    if (botsAboard) depart(world);
    else world.round.prepEndsAt = world.clock + 1000;
  }
  if (world.phase === 'outbound' && insideMissionZone(world))
    world.phase = world.round.phase = 'fishing';
  if (
    world.phase === 'returning' &&
    Math.hypot(world.boat.x, world.boat.z) <= 10
  )
    world.phase = world.round.phase = 'docking';
  if (
    !['lobby', 'finished', 'failed'].includes(world.phase) &&
    (world.clock >= world.round.roundEndsAt ||
      (world.round.returnEndsAt > 0 && world.clock >= world.round.returnEndsAt))
  ) {
    world.phase = world.round.phase = 'failed';
    world.round.result = 'timeout';
    world.round.finishedAt = world.clock;
    emit(
      world,
      'round-failed',
      undefined,
      'The harbor bell rang before the boat returned.',
    );
  }
  if (
    !['lobby', 'finished', 'failed'].includes(world.phase) &&
    world.boat.hull <= 0
  ) {
    world.phase = world.round.phase = 'failed';
    world.round.result = 'sunk';
    world.round.finishedAt = world.clock;
    emit(world, 'round-failed', undefined, 'The boat could not stay afloat.');
  }
}
