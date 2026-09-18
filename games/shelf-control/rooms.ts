import {
  ROOM_SEATS,
  handleRoomRequest,
  type RoomAdapter,
} from '../../shared/rooms/lifecycle';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  advanceShop,
  freshShop,
  removeShelfPlayer,
  shelfAction,
  shelfPlayer,
  shelfSnapshot,
} from './simulation';
import type { Action, Input, Player, Snapshot, World } from './types';

const words = {
  busy: 'The shop is busy. Try creating a room again.',
  unknownOp: 'Unknown shop operation.',
  code: 'Enter the six-character room code.',
  passMissing: 'Your shop pass is missing. Rejoin with the room code.',
  notFound: 'Shop not found. Check the code or create a room.',
  passExpired: 'Your shop pass expired. Rejoin with the room code.',
  full: 'All four places are taken. This room is full.',
  inProgress: 'A shift is in progress. Join when it ends.',
  rejoin: 'Rejoin the shop to continue.',
  invalidAction: 'Invalid shop action.',
  missingRequest: 'Invalid shop action.',
  contention: 'Everyone moved at once. Try again.',
};

/**
 * Shelf Control stays server-authoritative on purpose: roles are hidden, and a
 * player acting as host would see who the mannequins are.
 */
const shop: RoomAdapter<World, Action, Snapshot> = {
  game: 'shelf-control',
  key: (code) => `shelf:${code}`,
  words,
  defaultName: 'Shopper',
  actions: [
    'start',
    'restart',
    'pose',
    'interact',
    'drop',
    'inspect',
    'add-bot',
    'remove-bot',
    'fill-start',
  ],
  validAction: (action) =>
    action.target === undefined ||
    (typeof action.target === 'string' && action.target.length <= 50),
  attempts: 16,
  requestLog: 100,
  create(now, id, name) {
    const world = freshShop(now, crypto.getRandomValues(new Uint32Array(1))[0]);
    world.players = [shelfPlayer(id, name, now)];
    return world;
  },
  // The shop rejects malformed controls before it looks the room up.
  precheck(body) {
    const input = body.input as Input | undefined;
    if (
      body.input !== undefined &&
      (!input ||
        typeof input !== 'object' ||
        ![input.x, input.z].every(
          (v) => typeof v === 'number' && Number.isFinite(v),
        ) ||
        !Number.isSafeInteger(input.seq) ||
        input.seq < 0)
    )
      throw new RoomError('Invalid movement controls.');
  },
  join(world, id, name, now) {
    const vacantBot = world.players.findIndex((p) => p.bot);
    if (world.players.length >= ROOM_SEATS && vacantBot < 0)
      throw new RoomError(words.full, 409);
    if (world.phase === 'hiding' || world.phase === 'playing')
      throw new RoomError(words.inProgress, 409);
    const joined = shelfPlayer(id, name, now);
    // A person takes a bot's place, and its spot in the order, when the room is full.
    if (world.players.length >= ROOM_SEATS) {
      const replaced = world.players[vacantBot];
      if (world.botBrains) delete world.botBrains[replaced.id];
      world.players.splice(vacantBot, 1, joined);
    } else world.players.push(joined);
  },
  remove: removeShelfPlayer,
  advance: (world, now) => advanceShop(world, now),
  input(player: Player, body) {
    const input = body.input as Input | undefined;
    if (input && input.seq > player.input.seq)
      player.input = {
        x: Math.max(-1, Math.min(1, input.x)),
        z: Math.max(-1, Math.min(1, input.z)),
        seq: input.seq,
      };
  },
  act: shelfAction,
  snapshot: shelfSnapshot,
};

export function handleShelfRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
) {
  return handleRoomRequest(shop, store, body, now);
}
