import { hashToken, isRoomCode, newRoomCode, playerName } from './identity';
import { RoomError, type RoomStore } from './types';

/**
 * The lifecycle every server-run room shares: create, join, sync, act and leave,
 * persisted with compare-and-swap so simultaneous requests never lose a write.
 *
 * Five games used to carry their own copy of this, about 75% identical and
 * differing mostly in names. Each now supplies a `RoomAdapter` with what is
 * genuinely theirs — who can take a seat, what controls look like, what an
 * action may be, and the words players read — and the frame lives here. Peer
 * games get the same arrangement from `GameAdapter` in `shared/peer/engine.ts`.
 *
 * The stored shape is unchanged from the per-game handlers, so rooms that are
 * live across a deploy keep working.
 */

/** A seat in a server-run room. */
export type RoomPlayer = { id: string; seen: number; bot?: boolean };

export type RoomWorld = { players: RoomPlayer[] };

/** What is persisted for a room. Rooms live across deploys, so this does not change. */
export type StoredRoom<W> = {
  /** Absent only for Stack or Sink, whose rooms predate the stamp. */
  game?: string;
  world: W;
  host: string;
  members: Record<string, string>;
  requests: string[];
};

/** Everything a player can read from a room request, in the game's own voice. */
export type RoomWords = {
  /** No free code could be found (503). */
  busy: string;
  unknownOp: string;
  /** The code is not six room-code characters. */
  code: string;
  /** No id or token came with the request (401). */
  passMissing: string;
  /** The room does not exist, or has been idle for a day (404). */
  notFound: string;
  /** The token does not match this seat any more (401). */
  passExpired: string;
  /** Every seat is taken (409). Thrown by the game's `join`. */
  full: string;
  /** A round is running and cannot take a newcomer (409). Thrown by `join`. */
  inProgress: string;
  /** A sync or action from a seat that is gone (401). */
  rejoin: string;
  invalidAction: string;
  /** Defaults to "Missing action identifier.". */
  missingRequest?: string;
  /** Every retry lost the compare-and-swap (409). */
  contention: string;
};

type Body = Record<string, unknown>;

export interface RoomAdapter<
  W extends RoomWorld,
  A extends { type: string },
  S,
> {
  /**
   * Stamped into each stored room and checked when one is loaded, so a code
   * minted by one game cannot be opened by another. Stack or Sink predates the
   * stamp and relies on its unprefixed key instead.
   */
  game?: string;
  /** The storage key for a room code. */
  key(code: string): string;
  words: RoomWords;
  /** The name a player gets when they leave theirs blank. */
  defaultName: string;
  /** The action types a request may carry. */
  actions: readonly string[];
  /** Checks beyond the type, such as the length of a target. */
  validAction?(action: A): boolean;
  /** Tries at the compare-and-swap before giving up. Default 12. */
  attempts?: number;
  /** How many handled request ids are remembered to drop repeats. Default 80. */
  requestLog?: number;

  /** Refuses a create before anything is minted. Throw a RoomError. */
  validateCreate?(body: Body): void;
  /** A fresh world with the creator already seated. */
  create(now: number, id: string, name: string, body: Body): W;
  /**
   * Checks that run once the request is known to be well formed, before the
   * room is loaded. Throw a RoomError.
   */
  precheck?(body: Body): void;
  /** Seat a newcomer, or throw a RoomError with `words.full` or `words.inProgress`. */
  join(world: W, id: string, name: string, now: number): void;
  remove(world: W, id: string): void;
  advance(world: W, now: number, code: string): void;
  /** Validate and apply this player's controls from the request. Throw a RoomError. */
  input(player: W['players'][number], body: Body): void;
  act(world: W, id: string, action: A, host: string): void;
  snapshot(
    world: W,
    code: string,
    host: string,
    id: string,
    version: number,
  ): S;
}

export type RoomReply<S> =
  | { ok: true }
  | { session?: { code: string; id: string; token: string }; snapshot: S };

/** Seats per room across the collection. */
export const ROOM_SEATS = 4;

/** A player who has not been heard from in this long gives up their seat. */
export const SEAT_TIMEOUT_MS = 30_000;

/** A room nobody has touched in this long is gone. */
export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000;

const OPERATIONS = ['join', 'sync', 'action', 'leave'];

/** The lowest player colour nobody in the room is using. */
export function freeColor(players: readonly { color?: number }[]): number {
  return (
    [0, 1, 2, 3].find((color) => !players.some((p) => p.color === color)) ?? 0
  );
}

/** The seat that inherits hosting: the first person, never a bot. */
const successor = (world: RoomWorld) => world.players.find((p) => !p.bot)?.id;

export async function handleRoomRequest<
  W extends RoomWorld,
  A extends { type: string },
  S,
>(
  adapter: RoomAdapter<W, A, S>,
  store: RoomStore,
  body: Body,
  now = Date.now(),
): Promise<RoomReply<S>> {
  const { words } = adapter;
  const name = () => playerName(body.name, adapter.defaultName);

  if (body.op === 'create') {
    adapter.validateCreate?.(body);
    const id = crypto.randomUUID(),
      token = crypto.randomUUID() + crypto.randomUUID(),
      hash = await hashToken(token);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode();
      const world = adapter.create(now, id, name(), body);
      const room: StoredRoom<W> = {
        ...(adapter.game ? { game: adapter.game } : {}),
        world,
        host: id,
        members: { [id]: hash },
        requests: [],
      };
      if (
        await store.insert({
          code: adapter.key(code),
          state: JSON.stringify(room),
          version: 0,
          updated: now,
        })
      )
        return {
          session: { code, id, token },
          snapshot: adapter.snapshot(world, code, id, id, 0),
        };
    }
    throw new RoomError(words.busy, 503);
  }

  if (!OPERATIONS.includes(String(body.op)))
    throw new RoomError(words.unknownOp);
  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  if (!isRoomCode(code)) throw new RoomError(words.code);
  const joining = body.op === 'join',
    id = joining ? crypto.randomUUID() : body.id,
    token = joining ? crypto.randomUUID() + crypto.randomUUID() : body.token;
  if (
    typeof id !== 'string' ||
    typeof token !== 'string' ||
    !id ||
    !token ||
    token.length > 100
  )
    throw new RoomError(words.passMissing, 401);
  const hash = await hashToken(token);

  const action = body.action as A | undefined;
  if (body.op === 'action') {
    if (
      !action ||
      typeof action !== 'object' ||
      typeof action.type !== 'string' ||
      !adapter.actions.includes(action.type) ||
      (adapter.validAction && !adapter.validAction(action))
    )
      throw new RoomError(words.invalidAction);
    if (
      typeof body.requestId !== 'string' ||
      !body.requestId ||
      body.requestId.length > 80
    )
      throw new RoomError(words.missingRequest ?? 'Missing action identifier.');
  }
  adapter.precheck?.(body);

  const key = adapter.key(code);
  for (let attempt = 0; attempt < (adapter.attempts ?? 12); attempt++) {
    const row = await store.get(key);
    if (!row || row.updated < now - ROOM_LIFETIME_MS)
      throw new RoomError(words.notFound, 404);
    const room = JSON.parse(row.state) as StoredRoom<W>;
    if (adapter.game && room.game !== adapter.game)
      throw new RoomError('This code belongs to another game.', 404);
    if (!joining && room.members[id] !== hash)
      throw new RoomError(words.passExpired, 401);

    // Release seats that went quiet, but never the caller who is reconnecting.
    // Bots are the game's to manage and never time out.
    for (const p of room.world.players)
      if (!p.bot && p.id !== id && now - p.seen > SEAT_TIMEOUT_MS) {
        adapter.remove(room.world, p.id);
        delete room.members[p.id];
      }
    if (!room.world.players.some((p) => p.id === room.host && !p.bot))
      room.host = successor(room.world) ?? id;
    adapter.advance(room.world, now, code);

    if (joining) {
      adapter.join(room.world, id, name(), now);
      room.members[id] = hash;
    } else if (body.op === 'leave') {
      adapter.remove(room.world, id);
      delete room.members[id];
      if (room.host === id) room.host = successor(room.world) ?? '';
    } else {
      const player = room.world.players.find((p) => p.id === id);
      if (!player) throw new RoomError(words.rejoin, 401);
      player.seen = now;
      adapter.input(player, body);
      if (body.op === 'action') {
        const request = `${id}:${String(body.requestId)}`;
        // A repeat of a request already handled is answered, not replayed.
        if (!room.requests.includes(request)) {
          try {
            adapter.act(room.world, id, action!, room.host);
          } catch (error) {
            throw new RoomError(
              error instanceof Error
                ? error.message
                : 'That action did not work.',
            );
          }
          room.requests.push(request);
          room.requests = room.requests.slice(-(adapter.requestLog ?? 80));
        }
      }
    }

    const next = {
      code: key,
      state: JSON.stringify(room),
      version: row.version + 1,
      updated: now,
    };
    if (await store.compareAndSwap(next, row.version))
      return body.op === 'leave'
        ? { ok: true }
        : {
            ...(joining ? { session: { code, id, token } } : {}),
            snapshot: adapter.snapshot(
              room.world,
              code,
              room.host,
              id,
              next.version,
            ),
          };
  }
  throw new RoomError(words.contention, 409);
}
