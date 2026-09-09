import { playerName, hashToken } from '../../shared/rooms/identity';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  advanceFarm,
  farmAction,
  farmPlayer,
  farmSnapshot,
  freshFarm,
  removeFarmPlayer,
} from './simulation';
import { type FarmAction, type FarmWorld } from './types';
type FarmRoom = {
  game: 'act-natural';
  world: FarmWorld;
  host: string;
  members: Record<string, string>;
  requests: string[];
};
const safeName = (value: unknown) => playerName(value, 'Farmhand');
const key = (code: string) => `act:${code}`;
export async function handleFarmRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
) {
  if (body.op === 'create') {
    if (
      body.mode !== undefined &&
      body.mode !== 'computer' &&
      body.mode !== 'human'
    )
      throw new RoomError('Choose a valid farmer mode.');
    const id = crypto.randomUUID(),
      token = crypto.randomUUID() + crypto.randomUUID(),
      hash = await hashToken(token);
    for (let attempt = 0; attempt < 5; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const code = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join(
        '',
      );
      const world = freshFarm(
        now,
        crypto.getRandomValues(new Uint32Array(1))[0],
      );
      world.players = [farmPlayer(id, safeName(body.name), now)];
      world.mode = body.mode === 'human' ? 'human' : 'computer';
      const room: FarmRoom = {
        game: 'act-natural',
        world,
        host: id,
        members: { [id]: hash },
        requests: [],
      };
      if (
        await store.insert({
          code: key(code),
          state: JSON.stringify(room),
          version: 0,
          updated: now,
        })
      )
        return {
          session: { code, id, token },
          snapshot: farmSnapshot(world, code, id, id, 0),
        };
    }
    throw new RoomError('The farm is busy. Try creating a room again.', 503);
  }
  if (!['join', 'sync', 'action', 'leave'].includes(String(body.op)))
    throw new RoomError('Unknown farm operation.');
  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  if (!/^[A-Z2-9]{6}$/.test(code))
    throw new RoomError('Enter the six-character farm code.');
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
      'Your farm pass is missing. Rejoin with the room code.',
      401,
    );
  const hash = await hashToken(token);
  if (body.op === 'action') {
    const action = body.action as FarmAction | undefined;
    if (
      !action ||
      typeof action !== 'object' ||
      ![
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
      ].includes(action.type) ||
      (action.target !== undefined &&
        (typeof action.target !== 'string' || action.target.length > 32))
    )
      throw new RoomError('Invalid farm action.');
    if (
      typeof body.requestId !== 'string' ||
      !body.requestId ||
      body.requestId.length > 80
    )
      throw new RoomError('Missing action identifier.');
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const row = await store.get(key(code));
    if (!row || row.updated < now - 86400000)
      throw new RoomError(
        'Farm not found. Check the code or create a new room.',
        404,
      );
    const room = JSON.parse(row.state) as FarmRoom;
    if (room.game !== 'act-natural')
      throw new RoomError('This code belongs to another game.', 404);
    if (!joining && room.members[id] !== hash)
      throw new RoomError(
        'Your farm pass expired. Rejoin with the room code.',
        401,
      );
    for (const p of room.world.players)
      if (!p.bot && p.id !== id && now - p.seen > 30000) {
        removeFarmPlayer(room.world, p.id);
        delete room.members[p.id];
      }
    if (!room.world.players.some((p) => p.id === room.host))
      room.host = room.world.players.find((p) => !p.bot)?.id ?? id;
    advanceFarm(room.world, now);
    if (joining) {
      const npc = room.world.players.find((p) => p.bot);
      if (room.world.players.length >= 4 && !npc)
        throw new RoomError(
          'All four farmhands are here. This room is full.',
          409,
        );
      if (room.world.phase === 'playing')
        throw new RoomError('A round is in progress. Join after it ends.', 409);
      if (room.world.players.length >= 4 && npc)
        removeFarmPlayer(room.world, npc.id);
      room.world.players.push(farmPlayer(id, safeName(body.name), now));
      room.members[id] = hash;
    } else if (body.op === 'leave') {
      removeFarmPlayer(room.world, id);
      delete room.members[id];
      if (room.host === id)
        room.host = room.world.players.find((p) => !p.bot)?.id ?? '';
    } else {
      const p = room.world.players.find((p) => p.id === id);
      if (!p) throw new RoomError('Rejoin the farm to continue.', 401);
      p.seen = now;
      if (body.input !== undefined) {
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
        if (sequence === undefined || sequence >= (p.inputSequence ?? -1)) {
          p.input = {
            x: Math.max(-1, Math.min(1, input.x)),
            z: Math.max(-1, Math.min(1, input.z)),
            graze: input.graze,
          };
          if (sequence !== undefined) p.inputSequence = sequence;
        }
      }
      if (body.op === 'action') {
        const request = `${id}:${String(body.requestId)}`;
        if (!room.requests.includes(request)) {
          try {
            farmAction(room.world, id, body.action as FarmAction, room.host);
          } catch (error) {
            throw new RoomError(
              error instanceof Error
                ? error.message
                : 'That action did not work.',
            );
          }
          room.requests.push(request);
          room.requests = room.requests.slice(-80);
        }
      }
    }
    const next = {
      code: key(code),
      state: JSON.stringify(room),
      version: row.version + 1,
      updated: now,
    };
    if (await store.compareAndSwap(next, row.version))
      return body.op === 'leave'
        ? { ok: true }
        : {
            ...(joining ? { session: { code, id, token } } : {}),
            snapshot: farmSnapshot(
              room.world,
              code,
              room.host,
              id,
              next.version,
            ),
          };
  }
  throw new RoomError('The herd moved at once. Try that action again.', 409);
}
