import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceWorld,
  adventureAction,
  freshWorld,
  setInput,
  snapshot,
} from './simulation';
import { reconcileBots } from './bots';
import { createPlayer } from './players';
import {
  idleInput,
  type AdventureSnapshot,
  type AdventureWorld,
} from './types';

const adapter: GameAdapter<AdventureWorld, AdventureSnapshot> = {
  game: 'reel-problems-3',
  actions: [
    'start',
    'interact',
    'restart',
    'drop',
    'throw',
    'cast',
    'hook',
    'untangle',
    'dock',
  ],
  create: freshWorld,
  canJoin: (world) => world.players.filter((player) => !player.bot).length < 4,
  autonomous: (player) => player.bot,
  add: (world, member) => {
    const occupied = new Set(
      world.players
        .filter((player) => !player.bot)
        .map((player) => player.seat),
    );
    const preferred = Math.max(0, Math.min(3, member.order));
    const seat = occupied.has(preferred)
      ? ([0, 1, 2, 3].find((candidate) => !occupied.has(candidate)) ??
        preferred)
      : preferred;
    world.players = world.players.filter(
      (player) => player.seat !== seat || !player.bot,
    );
    const player = createPlayer(seat, world.clock, false, member.id);
    Object.assign(player, {
      name: member.name,
      color: member.color,
      seen: world.clock,
    });
    world.players.push(player);
    reconcileBots(world);
  },
  remove: (world, id) => {
    const index = world.players.findIndex((player) => player.id === id);
    if (index >= 0) world.players.splice(index, 1);
    reconcileBots(world);
  },
  input: (world, id, input) => setInput(world, id, input),
  idle: (player) => {
    player.input = idleInput();
  },
  advance: advanceWorld,
  act: (world, id, action, host) =>
    adventureAction(world, id, action, host === id),
  snapshot,
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
