import {
  ROOM_SEATS,
  freeColor,
  handleRoomRequest,
  type RoomAdapter,
  type StoredRoom as SharedStoredRoom,
} from '../../shared/rooms/lifecycle';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  act,
  createPlayer,
  freshWorld,
  releasePlayer,
  tick,
} from './simulation';
import { clamp } from '../../shared/math/clamp';
import {
  type Action,
  type Input,
  type Player,
  type Snapshot,
  type World,
} from './types';

const words = {
  busy: 'The yard is busy. Try creating a crew again.',
  unknownOp: 'Unknown room action.',
  code: 'Enter the six-character room code.',
  passMissing: 'Your crew pass is missing. Rejoin with the room code.',
  notFound: 'Crew not found. Check the room code or create a new crew.',
  passExpired: 'Your crew pass has expired. Rejoin with the room code.',
  full: 'All four hard hats are taken. This crew is full.',
  inProgress:
    'This crew is already in a run. Join when they return to the lobby.',
  rejoin: 'Rejoin the crew to continue.',
  invalidAction: 'Unknown game action.',
  contention: 'Your crew is moving quickly. Try that action again.',
};

/** A stored Stack or Sink room, as its tests read it back. */
export type StoredRoom = SharedStoredRoom<World>;

const remove = (world: World, id: string) => {
  releasePlayer(world, id);
  world.players = world.players.filter((p) => p.id !== id);
};

/**
 * Stack or Sink rooms predate the per-game prefix and `game` stamp: they are
 * stored under the bare code, and a code from another game misses because its
 * key carries that game's prefix.
 */
const yard: RoomAdapter<World, Action, Snapshot> = {
  key: (code) => code,
  words,
  defaultName: 'Apprentice',
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
  attempts: 10,
  requestLog: 64,
  create(now, id, name, body) {
    const world = freshWorld(now);
    world.players = [
      createPlayer(id, name, clamp(Number(body.color) || 0, 0, 3) | 0, 0, now),
    ];
    return world;
  },
  join(world, id, name, now) {
    if (world.players.length >= ROOM_SEATS)
      throw new RoomError(words.full, 409);
    if (world.phase === 'playing') throw new RoomError(words.inProgress, 409);
    world.players.push(
      createPlayer(
        id,
        name,
        freeColor(world.players),
        world.players.length,
        now,
      ),
    );
  },
  remove,
  advance: (world, now, code) => tick(world, now, `room:${code}`),
  input(player: Player, body) {
    const input = body.input as Input | undefined;
    if (!input) return;
    if (
      ![input.x, input.z, input.seq].every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      ) ||
      typeof input.jump !== 'boolean' ||
      (input.order !== undefined &&
        (!Number.isSafeInteger(input.order) || input.order < 0))
    )
      throw new RoomError('Invalid player controls.');
    if (
      player.input.order === undefined ||
      (input.order !== undefined && input.order >= player.input.order)
    )
      player.input = {
        x: clamp(input.x, -1, 1),
        z: clamp(input.z, -1, 1),
        jump: input.jump,
        seq: clamp(Math.trunc(input.seq), 0, 1e9),
        ...(input.order === undefined ? {} : { order: input.order }),
      };
  },
  act,
  snapshot: (world, code, host, _id, version) => ({
    code,
    host,
    world,
    version,
  }),
};

export function handleRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
) {
  return handleRoomRequest(yard, store, body, now);
}
