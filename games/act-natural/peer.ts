import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceFarm,
  farmAction,
  farmPlayer,
  farmSnapshot,
  freshFarm,
  removeFarmPlayer,
} from './simulation';
import type { FarmAction, FarmSnapshot, FarmWorld } from './types';

const adapter: GameAdapter<FarmWorld, FarmSnapshot> = {
  game: 'act-natural',
  actions: ['start', 'restart', 'interact', 'inspect', 'drop', 'graze', 'mode'],
  create(now) {
    return freshFarm(now, crypto.getRandomValues(new Uint32Array(1))[0]);
  },
  remove(world, id, members) {
    if (world.phase === 'playing' && world.farmerId === id) {
      const successor = members
        .map((member) =>
          world.players.find((player) => player.id === member.id),
        )
        .find(Boolean);
      if (successor) {
        const cow = world.cows.find((cow) => cow.id === successor.cowId);
        if (cow) {
          farmAction(world, successor.id, { type: 'drop' }, successor.id);
          cow.captured = true;
        }
        successor.cowId = null;
        world.farmerId = successor.id;
      }
    }
    removeFarmPlayer(world, id);
  },
  add(world, member) {
    world.players.push(farmPlayer(member.id, member.name, world.clock));
  },
  input(world, id, value) {
    world.players.find((player) => player.id === id)!.input = {
      x: Number(value.x),
      z: Number(value.z),
      graze: value.graze === true,
    };
  },
  idle(player) {
    player.input = { ...player.input, x: 0, z: 0 };
  },
  advance: advanceFarm,
  act(world, id, action, host) {
    farmAction(world, id, action as FarmAction, host);
  },
  snapshot: farmSnapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
