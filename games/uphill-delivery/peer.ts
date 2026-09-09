import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceDelivery,
  deliveryAction,
  deliveryPlayer,
  deliverySnapshot,
  freshDelivery,
  removeDeliveryPlayer,
  reconcileDeliveryNpcs,
} from './simulation';
import type { DeliveryAction, DeliverySnapshot, DeliveryWorld } from './types';
const adapter: GameAdapter<DeliveryWorld, DeliverySnapshot> = {
  game: 'uphill-delivery',
  autonomous: (player) => !!player.bot,
  roster: (world, roster) => reconcileDeliveryNpcs(world, roster.slots),
  actions: ['start', 'restart', 'interact', 'grab', 'release', 'rotate'],
  create: freshDelivery,
  remove: removeDeliveryPlayer,
  add(world, member) {
    world.players.push(
      deliveryPlayer(member.id, member.name, member.color, world.clock),
    );
  },
  input(world, id, value) {
    const player = world.players.find((player) => player.id === id)!;
    player.input = {
      x: Number(value.x),
      z: Number(value.z),
      seq: Number(value.seq),
      jump: value.jump === true || player.input.jump,
    };
  },
  idle(player) {
    player.input = { ...player.input, x: 0, z: 0, jump: false };
  },
  advance(world, now) {
    advanceDelivery(world, now);
    for (const player of world.players) player.input.jump = false;
  },
  act(world, id, action, host) {
    deliveryAction(world, id, action as DeliveryAction, host);
  },
  snapshot: deliverySnapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
