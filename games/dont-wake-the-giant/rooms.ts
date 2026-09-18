import {
  ROOM_SEATS,
  freeColor,
  handleRoomRequest,
  type RoomAdapter,
} from '../../shared/rooms/lifecycle';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  advanceGiant,
  giantAction,
  giantPlayer,
  giantSnapshot,
  freshGiant,
  removeGiantPlayer,
} from './simulation';
import {
  type GiantAction,
  type GiantPlayer,
  type GiantSnapshot,
  type GiantWorld,
} from './types';

const words = {
  busy: 'The giant is busy. Try creating a room again.',
  unknownOp: 'Unknown giant operation.',
  code: 'Enter the six-character giant code.',
  passMissing: 'Your giant pass is missing. Rejoin with the room code.',
  notFound: 'Giant not found. Check the code or create a new room.',
  passExpired: 'Your giant pass expired. Rejoin with the room code.',
  full: 'All four workers are here. This room is full.',
  inProgress: 'A round is in progress. Join after it ends.',
  rejoin: 'Rejoin the giant to continue.',
  invalidAction: 'Invalid giant action.',
  contention: 'The crew moved at once. Try that action again.',
};

const giant: RoomAdapter<GiantWorld, GiantAction, GiantSnapshot> = {
  game: 'dont-wake-the-giant',
  key: (code) => `giant:${code}`,
  words,
  defaultName: 'Thief',
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
  create(now, id, name) {
    const world = freshGiant(now);
    world.players = [giantPlayer(id, name, 0, now)];
    return world;
  },
  join(world, id, name, now) {
    if (world.players.length >= ROOM_SEATS)
      throw new RoomError(words.full, 409);
    // The escape counts as the round: the giant is awake and nobody walks in.
    if (['playing', 'escape'].includes(world.phase))
      throw new RoomError(words.inProgress, 409);
    world.players.push(giantPlayer(id, name, freeColor(world.players), now));
  },
  remove: removeGiantPlayer,
  advance: (world, now) => advanceGiant(world, now),
  input(player: GiantPlayer, body) {
    if (body.input === undefined) return;
    const input = body.input as {
      x: number;
      z: number;
      jump: boolean;
      crouch: boolean;
      seq: number;
    };
    if (
      !input ||
      ![input.x, input.z].every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      ) ||
      typeof input.jump !== 'boolean' ||
      typeof input.crouch !== 'boolean' ||
      !Number.isSafeInteger(input.seq) ||
      input.seq < 0
    )
      throw new RoomError('Invalid giant controls.');
    if (input.seq > player.input.seq)
      player.input = {
        x: Math.max(-1, Math.min(1, input.x)),
        z: Math.max(-1, Math.min(1, input.z)),
        jump: input.jump,
        crouch: input.crouch,
        seq: input.seq,
      };
  },
  act: giantAction,
  snapshot: giantSnapshot,
};

export function handleGiantRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
) {
  return handleRoomRequest(giant, store, body, now);
}
