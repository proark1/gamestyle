import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceWorld,
  adventureAction,
  freshWorld,
  newPlayer,
  setInput,
  snapshot,
} from './simulation';
import {
  idleInput,
  type AdventureSnapshot,
  type AdventureWorld,
} from './types';

const adapter: GameAdapter<AdventureWorld, AdventureSnapshot> = {
  game: 'reel-problems-3',
  actions: ['start', 'interact', 'restart'],
  create: freshWorld,
  add: (world, member) => {
    const player = newPlayer(world.players.length);
    Object.assign(player, {
      id: member.id,
      name: member.name,
      color: member.color,
      seat: member.order,
      bot: false,
      seen: world.clock,
      x: -1.5 + world.players.length,
    });
    world.players.push(player);
  },
  remove: (world, id) => {
    const index = world.players.findIndex((player) => player.id === id);
    if (index >= 0) world.players.splice(index, 1);
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
