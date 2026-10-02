import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import { reconcileChainBots, stepChainBot } from './bots';
import {
  advanceChainOfFools,
  chainOfFoolsAction,
  chainSnapshot,
  freshChainWorld,
  newPlayer,
} from './simulation';
import {
  clamp,
  idleInput,
  type ChainAction,
  type ChainSnapshot,
  type ChainWorld,
} from './types';

const adapter: GameAdapter<ChainWorld, ChainSnapshot> = {
  game: 'chain-of-fools',
  autonomous: (player) => !!player.bot,
  actions: ['start', 'restart', 'select_map', 'jump', 'clip', 'ping'],

  create: (now) => {
    const world = freshChainWorld(now);
    reconcileChainBots(world);
    return world;
  },

  add: (world, member) => {
    const slot = world.players.findIndex((p) => p.bot);
    const player = newPlayer(
      member.id,
      member.name,
      member.color,
      world.players.length,
      false,
      world.mapId,
    );
    if (slot >= 0) {
      const previous = world.players[slot];
      world.players[slot] = {
        ...previous,
        id: player.id,
        name: player.name,
        color: player.color,
        bot: false,
        input: idleInput(),
      };
      if (world.pendulumRider === previous.id) world.pendulumRider = player.id;
    } else world.players.push(player);
    reconcileChainBots(world);
  },

  remove: (world, id) => {
    const player = world.players.find((p) => p.id === id);
    if (player) {
      let index = 1;
      while (world.players.some((p) => p.id === `bot-${index}`)) index++;
      player.id = `bot-${index}`;
      player.name = 'Relief Rigger';
      player.bot = true;
      player.input = idleInput();
      if (world.pendulumRider === id) world.pendulumRider = player.id;
    }
    reconcileChainBots(world);
  },

  input(world, id, raw) {
    const player = world.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number.isFinite(Number(raw.x)) ? clamp(Number(raw.x), -1, 1) : 0,
      z: Number.isFinite(Number(raw.z)) ? clamp(Number(raw.z), -1, 1) : 0,
      jump: raw.jump === true,
      brace: raw.brace === true,
      haul: raw.haul === true,
      seq: Number(raw.seq) || 0,
    };
    player.seen = world.clock;
  },

  idle(player) {
    player.input = idleInput();
  },

  advance(world, now) {
    const dt = clamp((now - (world.clock || now)) / 1000, 0.001, 0.05);
    for (const player of world.players) {
      if (player.bot) stepChainBot(player, world, dt);
    }
    advanceChainOfFools(world, now, dt);
  },

  act: (world, id, action) => {
    chainOfFoolsAction(world, id, action as ChainAction);
  },

  snapshot: (world, code, host, id, version) =>
    chainSnapshot(world, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
