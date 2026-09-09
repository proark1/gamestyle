import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  act,
  createPlayer,
  emptyInput,
  freshWorld,
  releasePlayer,
  tick,
} from './simulation';
import type { Action, Snapshot, World } from './types';

const adapter: GameAdapter<World, Snapshot> = {
  game: 'stack-or-sink',
  actions: [
    'start',
    'restart',
    'grab',
    'place',
    'rotate',
    'rescue',
    'crane',
    'crane-move',
    'crane-drop',
    'wave',
  ],
  create: freshWorld,
  remove(world, id) {
    releasePlayer(world, id);
    world.players = world.players.filter((player) => player.id !== id);
  },
  add(world, member) {
    world.players.push(
      createPlayer(
        member.id,
        member.name,
        member.color,
        world.players.length,
        world.clock,
      ),
    );
  },
  input(world, id, value, order) {
    world.players.find((player) => player.id === id)!.input = {
      x: Number(value.x),
      z: Number(value.z),
      seq: Number(value.seq),
      jump: value.jump === true,
      order,
    };
  },
  idle(player) {
    player.input = emptyInput();
  },
  advance: tick,
  act(world, id, action, host) {
    act(world, id, action as Action, host);
  },
  snapshot(world, code, host, _id, version) {
    return { code, host, version, world };
  },
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
