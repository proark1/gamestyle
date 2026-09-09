import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceGiant,
  giantAction,
  giantPlayer,
  giantSnapshot,
  freshGiant,
  removeGiantPlayer,
} from './simulation';
import type { GiantAction, GiantSnapshot, GiantWorld } from './types';
const adapter: GameAdapter<GiantWorld, GiantSnapshot> = {
  game: 'dont-wake-the-giant',
  actions: [
    'start',
    'restart',
    'interact',
    'pass',
    'drop',
    'tickle',
    'help',
    'exit',
    'rotate',
  ],
  create: freshGiant,
  remove: removeGiantPlayer,
  add(world, member) {
    world.players.push(
      giantPlayer(member.id, member.name, member.color, world.clock),
    );
  },
  input(world, id, value) {
    const player = world.players.find((player) => player.id === id)!;
    player.input = {
      x: Number(value.x),
      z: Number(value.z),
      seq: Number(value.seq),
      jump: value.jump === true || player.input.jump,
      crouch: value.crouch === true,
    };
  },
  idle(player) {
    player.input = { ...player.input, x: 0, z: 0, jump: false };
  },
  advance(world, now) {
    advanceGiant(world, now);
    for (const player of world.players) player.input.jump = false;
  },
  act(world, id, action, host) {
    giantAction(world, id, action as GiantAction, host);
  },
  snapshot: giantSnapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
