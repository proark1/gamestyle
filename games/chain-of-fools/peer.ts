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
  actions: ['start', 'restart', 'jump', 'clip', 'ping'],

  create: (now) => {
    const world = freshChainWorld(now);
    reconcileChainBots(world);
    return world;
  },

  add: (world, member) => {
    world.players.push(
      newPlayer(
        member.id,
        member.name,
        member.color,
        world.players.length,
        false,
      ),
    );
    reconcileChainBots(world);
  },

  remove: (world, id) => {
    world.players = world.players.filter((player) => player.id !== id);
    reconcileChainBots(world);
  },

  input(world, id, raw) {
    const player = world.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
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
