import {
  playerName,
  hashToken as tokenHash,
} from '../../shared/rooms/identity';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  act,
  createPlayer,
  freshWorld,
  releasePlayer,
  tick,
} from './simulation';
import { clamp } from '../../shared/math/clamp';
import { type Action, type Input, type Snapshot, type World } from './types';

export type StoredRoom = {
  world: World;
  host: string;
  members: Record<string, string>;
  requests: string[];
};
const safeName = (value: unknown) => playerName(value, 'Apprentice');
const snapshot = (
  code: string,
  room: StoredRoom,
  version: number,
): Snapshot => ({ code, host: room.host, world: room.world, version });
const ACTIVE_MS = 30000;
export async function handleRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
) {
  if (body.op === 'create') {
    const id = crypto.randomUUID(),
      token = crypto.randomUUID() + crypto.randomUUID(),
      hash = await tokenHash(token);
    for (let attempt = 0; attempt < 5; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(6)),
        (v) => alphabet[v % alphabet.length],
      ).join('');
      const world = freshWorld(now);
      world.players = [
        createPlayer(
          id,
          safeName(body.name),
          clamp(Number(body.color) || 0, 0, 3) | 0,
          0,
          now,
        ),
      ];
      const room: StoredRoom = {
        world,
        host: id,
        members: { [id]: hash },
        requests: [],
      };
      if (
        await store.insert({
          code,
          state: JSON.stringify(room),
          version: 0,
          updated: now,
        })
      )
        return {
          session: { code, id, token },
          snapshot: snapshot(code, room, 0),
        };
    }
    throw new RoomError('The yard is busy. Try creating a crew again.', 503);
  }
  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  if (!/^[A-Z2-9]{6}$/.test(code))
    throw new RoomError('Enter the six-character room code.');
  const joining = body.op === 'join';
  const id = joining
    ? crypto.randomUUID()
    : typeof body.id === 'string'
      ? body.id
      : '';
  const token = joining
    ? crypto.randomUUID() + crypto.randomUUID()
    : typeof body.token === 'string'
      ? body.token
      : '';
  if (!id || !token || token.length > 100)
    throw new RoomError(
      'Your crew pass is missing. Rejoin with the room code.',
      401,
    );
  const hash = await tokenHash(token);
  const actions = [
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
  ];
  if (!['join', 'sync', 'action', 'leave'].includes(String(body.op)))
    throw new RoomError('Unknown room action.');
  if (
    body.op === 'action' &&
    (!body.action ||
      typeof body.action !== 'object' ||
      !actions.includes(String((body.action as Action).type)))
  )
    throw new RoomError('Unknown game action.');
  for (let attempt = 0; attempt < 10; attempt++) {
    const row = await store.get(code);
    if (!row || row.updated < now - 24 * 60 * 60 * 1000)
      throw new RoomError(
        'Crew not found. Check the room code or create a new crew.',
        404,
      );
    const room = JSON.parse(row.state) as StoredRoom;
    if (!joining && room.members[id] !== hash)
      throw new RoomError(
        'Your crew pass has expired. Rejoin with the room code.',
        401,
      );
    // Expire disconnected players without affecting the caller who is reconnecting.
    for (const player of room.world.players)
      if (player.id !== id && now - player.seen > ACTIVE_MS) {
        releasePlayer(room.world, player.id);
        room.world.players = room.world.players.filter(
          (p) => p.id !== player.id,
        );
        delete room.members[player.id];
      }
    if (!room.world.players.some((p) => p.id === room.host))
      room.host = room.world.players[0]?.id || id;
    tick(room.world, now);
    if (joining) {
      if (room.world.players.length >= 4)
        throw new RoomError(
          'All four hard hats are taken. This crew is full.',
          409,
        );
      if (room.world.phase === 'playing')
        throw new RoomError(
          'This crew is already in a run. Join when they return to the lobby.',
          409,
        );
      const slot =
        Array.from({ length: 4 }, (_, i) => i).find(
          (i) => !room.world.players.some((p) => p.color === i),
        ) ?? 0;
      room.world.players.push(
        createPlayer(
          id,
          safeName(body.name),
          slot,
          room.world.players.length,
          now,
        ),
      );
      room.members[id] = hash;
    } else if (body.op === 'leave') {
      releasePlayer(room.world, id);
      room.world.players = room.world.players.filter((p) => p.id !== id);
      delete room.members[id];
      if (room.host === id) room.host = room.world.players[0]?.id || '';
    } else {
      const player = room.world.players.find((p) => p.id === id);
      if (!player) throw new RoomError('Rejoin the crew to continue.', 401);
      player.seen = now;
      const input = body.input as Input | undefined;
      if (input) {
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
      }
      if (body.op === 'action') {
        const requestId = body.requestId;
        if (typeof requestId !== 'string' || requestId.length > 80)
          throw new RoomError('Missing action identifier.');
        const key = `${id}:${requestId}`;
        if (!room.requests.includes(key)) {
          try {
            act(room.world, id, body.action as Action, room.host);
          } catch (e) {
            throw new RoomError(
              e instanceof Error ? e.message : 'That action did not work.',
            );
          }
          room.requests.push(key);
          room.requests = room.requests.slice(-64);
        }
      }
    }
    const next = {
      code,
      state: JSON.stringify(room),
      version: row.version + 1,
      updated: now,
    };
    if (await store.compareAndSwap(next, row.version))
      return body.op === 'leave'
        ? { ok: true }
        : {
            ...(joining ? { session: { code, id, token } } : {}),
            snapshot: snapshot(code, room, next.version),
          };
  }
  throw new RoomError(
    'Your crew is moving quickly. Try that action again.',
    409,
  );
}
