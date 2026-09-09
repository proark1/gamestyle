import { playerName, hashToken } from '../../shared/rooms/identity';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  advanceShop,
  freshShop,
  removeShelfPlayer,
  shelfAction,
  shelfPlayer,
  shelfSnapshot,
} from './simulation';
import type { Action, Input, World } from './types';
type Room = {
  game: 'shelf-control';
  world: World;
  host: string;
  members: Record<string, string>;
  requests: string[];
};
const safeName = (value: unknown) => playerName(value, 'Shopper');
export async function handleShelfRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
) {
  if (body.op === 'create') {
    const id = crypto.randomUUID(),
      token = crypto.randomUUID() + crypto.randomUUID(),
      hash = await hashToken(token);
    for (let attempt = 0; attempt < 5; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(6)),
        (n) => alphabet[n % alphabet.length],
      ).join('');
      const world = freshShop(
        now,
        crypto.getRandomValues(new Uint32Array(1))[0],
      );
      world.players = [shelfPlayer(id, safeName(body.name), now)];
      const room: Room = {
        game: 'shelf-control',
        world,
        host: id,
        members: { [id]: hash },
        requests: [],
      };
      if (
        await store.insert({
          code: `shelf:${code}`,
          state: JSON.stringify(room),
          version: 0,
          updated: now,
        })
      )
        return {
          session: { code, id, token },
          snapshot: shelfSnapshot(world, code, id, id, 0),
        };
    }
    throw new RoomError('The shop is busy. Try creating a room again.', 503);
  }
  if (!['join', 'sync', 'action', 'leave'].includes(String(body.op)))
    throw new RoomError('Unknown shop operation.');
  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  if (!/^[A-Z2-9]{6}$/.test(code))
    throw new RoomError('Enter the six-character room code.');
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
    throw new RoomError(
      'Your shop pass is missing. Rejoin with the room code.',
      401,
    );
  const hash = await hashToken(token);
  const action = body.action as Action | undefined;
  if (
    body.op === 'action' &&
    (!action ||
      typeof action !== 'object' ||
      ![
        'start',
        'restart',
        'pose',
        'interact',
        'drop',
        'inspect',
        'add-bot',
        'remove-bot',
        'fill-start',
      ].includes(action.type) ||
      (action.target !== undefined &&
        (typeof action.target !== 'string' || action.target.length > 50)) ||
      typeof body.requestId !== 'string' ||
      !body.requestId ||
      body.requestId.length > 80)
  )
    throw new RoomError('Invalid shop action.');
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
  for (let attempt = 0; attempt < 16; attempt++) {
    const row = await store.get(`shelf:${code}`);
    if (!row || row.updated < now - 86400000)
      throw new RoomError(
        'Shop not found. Check the code or create a room.',
        404,
      );
    const room = JSON.parse(row.state) as Room;
    if (room.game !== 'shelf-control')
      throw new RoomError('This code belongs to another game.', 404);
    if (!joining && room.members[id] !== hash)
      throw new RoomError(
        'Your shop pass expired. Rejoin with the room code.',
        401,
      );
    for (const p of room.world.players)
      if (!p.bot && p.id !== id && now - p.seen > 30000) {
        removeShelfPlayer(room.world, p.id);
        delete room.members[p.id];
      }
    if (!room.world.players.some((p) => p.id === room.host && !p.bot))
      room.host = room.world.players.find((p) => !p.bot)?.id ?? id;
    advanceShop(room.world, now);
    if (joining) {
      const vacantBot = room.world.players.findIndex((p) => p.bot);
      if (room.world.players.length >= 4 && vacantBot < 0)
        throw new RoomError(
          'All four places are taken. This room is full.',
          409,
        );
      if (room.world.phase === 'hiding' || room.world.phase === 'playing')
        throw new RoomError('A shift is in progress. Join when it ends.', 409);
      const joined = shelfPlayer(id, safeName(body.name), now);
      if (room.world.players.length >= 4) {
        const replaced = room.world.players[vacantBot];
        if (room.world.botBrains) delete room.world.botBrains[replaced.id];
        room.world.players.splice(vacantBot, 1, joined);
      } else room.world.players.push(joined);
      room.members[id] = hash;
    } else if (body.op === 'leave') {
      removeShelfPlayer(room.world, id);
      delete room.members[id];
      if (room.host === id)
        room.host = room.world.players.find((p) => !p.bot)?.id ?? '';
    } else {
      const player = room.world.players.find((p) => p.id === id);
      if (!player) throw new RoomError('Rejoin the shop to continue.', 401);
      player.seen = now;
      if (input && input.seq > player.input.seq)
        player.input = {
          x: Math.max(-1, Math.min(1, input.x)),
          z: Math.max(-1, Math.min(1, input.z)),
          seq: input.seq,
        };
      if (body.op === 'action') {
        const request = `${id}:${String(body.requestId)}`;
        if (!room.requests.includes(request)) {
          try {
            shelfAction(room.world, id, action!, room.host);
          } catch (error) {
            throw new RoomError(
              error instanceof Error
                ? error.message
                : 'That action did not work.',
            );
          }
          room.requests.push(request);
          room.requests = room.requests.slice(-100);
        }
      }
    }
    const next = {
      code: `shelf:${code}`,
      state: JSON.stringify(room),
      version: row.version + 1,
      updated: now,
    };
    if (await store.compareAndSwap(next, row.version))
      return body.op === 'leave'
        ? { ok: true }
        : {
            ...(joining ? { session: { code, id, token } } : {}),
            snapshot: shelfSnapshot(
              room.world,
              code,
              room.host,
              id,
              next.version,
            ),
          };
  }
  throw new RoomError('Everyone moved at once. Try again.', 409);
}
