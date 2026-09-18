import {
  ROOM_SEATS,
  handleRoomRequest,
  type RoomAdapter,
} from '../../shared/rooms/lifecycle';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  advanceFarm,
  farmAction,
  farmPlayer,
  farmSnapshot,
  freshFarm,
  removeFarmPlayer,
} from './simulation';
import {
  type FarmAction,
  type FarmPlayer,
  type FarmSnapshot,
  type FarmWorld,
} from './types';

const words = {
  busy: 'The farm is busy. Try creating a room again.',
  unknownOp: 'Unknown farm operation.',
  code: 'Enter the six-character farm code.',
  passMissing: 'Your farm pass is missing. Rejoin with the room code.',
  notFound: 'Farm not found. Check the code or create a new room.',
  passExpired: 'Your farm pass expired. Rejoin with the room code.',
  full: 'All four farmhands are here. This room is full.',
  inProgress: 'A round is in progress. Join after it ends.',
  rejoin: 'Rejoin the farm to continue.',
  invalidAction: 'Invalid farm action.',
  contention: 'The herd moved at once. Try that action again.',
};

const farm: RoomAdapter<FarmWorld, FarmAction, FarmSnapshot> = {
  game: 'act-natural',
  key: (code) => `act:${code}`,
  words,
  defaultName: 'Farmhand',
  actions: [
    'start',
    'restart',
    'interact',
    'inspect',
    'drop',
    'graze',
    'mode',
    'add-bot',
    'fill-bots',
    'remove-bot',
  ],
  validAction: (action) =>
    action.target === undefined ||
    (typeof action.target === 'string' && action.target.length <= 32),
  validateCreate(body) {
    if (
      body.mode !== undefined &&
      body.mode !== 'computer' &&
      body.mode !== 'human'
    )
      throw new RoomError('Choose a valid farmer mode.');
  },
  create(now, id, name, body) {
    const world = freshFarm(now, crypto.getRandomValues(new Uint32Array(1))[0]);
    world.players = [farmPlayer(id, name, now)];
    world.mode = body.mode === 'human' ? 'human' : 'computer';
    return world;
  },
  join(world, id, name, now) {
    // A computer cow gives up its seat to a person.
    const npc = world.players.find((p) => p.bot);
    if (world.players.length >= ROOM_SEATS && !npc)
      throw new RoomError(words.full, 409);
    if (world.phase === 'playing') throw new RoomError(words.inProgress, 409);
    if (world.players.length >= ROOM_SEATS && npc)
      removeFarmPlayer(world, npc.id);
    world.players.push(farmPlayer(id, name, now));
  },
  remove: removeFarmPlayer,
  advance: (world, now) => advanceFarm(world, now),
  input(player: FarmPlayer, body) {
    if (body.input === undefined) return;
    const input = body.input as { x: number; z: number; graze: boolean };
    if (
      !input ||
      ![input.x, input.z].every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      ) ||
      typeof input.graze !== 'boolean'
    )
      throw new RoomError('Invalid farm controls.');
    const sequence = body.inputSequence;
    if (
      sequence !== undefined &&
      (typeof sequence !== 'number' ||
        !Number.isSafeInteger(sequence) ||
        sequence < 0)
    )
      throw new RoomError('Invalid control sequence.');
    // An older in-flight sync must not undo a newer stop/turn sent with an action.
    if (sequence === undefined || sequence >= (player.inputSequence ?? -1)) {
      player.input = {
        x: Math.max(-1, Math.min(1, input.x)),
        z: Math.max(-1, Math.min(1, input.z)),
        graze: input.graze,
      };
      if (sequence !== undefined) player.inputSequence = sequence;
    }
  },
  act: farmAction,
  snapshot: farmSnapshot,
};

export function handleFarmRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
) {
  return handleRoomRequest(farm, store, body, now);
}
