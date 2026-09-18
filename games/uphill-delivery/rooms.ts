import {
  ROOM_SEATS,
  freeColor,
  handleRoomRequest,
  type RoomAdapter,
} from '../../shared/rooms/lifecycle';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  advanceDelivery,
  deliveryAction,
  deliveryPlayer,
  deliverySnapshot,
  freshDelivery,
  removeDeliveryPlayer,
} from './simulation';
import {
  type DeliveryAction,
  type DeliveryPlayer,
  type DeliverySnapshot,
  type DeliveryWorld,
} from './types';

const words = {
  busy: 'The delivery is busy. Try creating a room again.',
  unknownOp: 'Unknown delivery operation.',
  code: 'Enter the six-character delivery code.',
  passMissing: 'Your delivery pass is missing. Rejoin with the room code.',
  notFound: 'Delivery not found. Check the code or create a new room.',
  passExpired: 'Your delivery pass expired. Rejoin with the room code.',
  full: 'All four workers are here. This room is full.',
  inProgress: 'A round is in progress. Join after it ends.',
  rejoin: 'Rejoin the delivery to continue.',
  invalidAction: 'Invalid delivery action.',
  contention: 'The crew moved at once. Try that action again.',
};

const delivery: RoomAdapter<DeliveryWorld, DeliveryAction, DeliverySnapshot> = {
  game: 'uphill-delivery',
  key: (code) => `delivery:${code}`,
  words,
  defaultName: 'Mover',
  actions: [
    'start',
    'restart',
    'interact',
    'grab',
    'release',
    'rotate',
    'add-npc',
    'remove-npc',
    'fill-npcs',
  ],
  create(now, id, name) {
    const world = freshDelivery(now);
    world.players = [deliveryPlayer(id, name, 0, now)];
    return world;
  },
  join(world, id, name, now) {
    // NPC movers hold their seats; the host removes one to make room.
    if (world.players.length >= ROOM_SEATS)
      throw new RoomError(words.full, 409);
    if (world.phase === 'playing') throw new RoomError(words.inProgress, 409);
    world.players.push(deliveryPlayer(id, name, freeColor(world.players), now));
  },
  remove: removeDeliveryPlayer,
  advance: (world, now) => advanceDelivery(world, now),
  input(player: DeliveryPlayer, body) {
    if (body.input === undefined) return;
    const input = body.input as {
      x: number;
      z: number;
      jump: boolean;
      seq: number;
    };
    if (
      !input ||
      ![input.x, input.z].every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      ) ||
      typeof input.jump !== 'boolean' ||
      !Number.isSafeInteger(input.seq) ||
      input.seq < 0
    )
      throw new RoomError('Invalid delivery controls.');
    if (input.seq >= player.input.seq)
      player.input = {
        x: Math.max(-1, Math.min(1, input.x)),
        z: Math.max(-1, Math.min(1, input.z)),
        jump: input.jump,
        seq: input.seq,
      };
  },
  act: deliveryAction,
  snapshot: deliverySnapshot,
};

export function handleDeliveryRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
) {
  return handleRoomRequest(delivery, store, body, now);
}
