import { playerName, hashToken } from '../../shared/rooms/identity';
import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  advanceDelivery,
  deliveryAction,
  deliveryPlayer,
  deliverySnapshot,
  freshDelivery,
  removeDeliveryPlayer,
} from './simulation';
import { type DeliveryAction, type DeliveryWorld } from './types';
type DeliveryRoom = {
  game: 'uphill-delivery';
  world: DeliveryWorld;
  host: string;
  members: Record<string, string>;
  requests: string[];
};
const safeName = (value: unknown) => playerName(value, 'Mover');
const key = (code: string) => `delivery:${code}`;
export async function handleDeliveryRoom(
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
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const code = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join(
        '',
      );
      const world = freshDelivery(now);
      world.players = [deliveryPlayer(id, safeName(body.name), 0, now)];
      const room: DeliveryRoom = {
        game: 'uphill-delivery',
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
          snapshot: deliverySnapshot(world, code, id, id, 0),
        };
    }
    throw new RoomError(
      'The delivery is busy. Try creating a room again.',
      503,
    );
  }
  if (!['join', 'sync', 'action', 'leave'].includes(String(body.op)))
    throw new RoomError('Unknown delivery operation.');
  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  if (!/^[A-Z2-9]{6}$/.test(code))
    throw new RoomError('Enter the six-character delivery code.');
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
      'Your delivery pass is missing. Rejoin with the room code.',
      401,
    );
  const hash = await hashToken(token);
  if (body.op === 'action') {
    const action = body.action as DeliveryAction | undefined;
    if (
      !action ||
      typeof action !== 'object' ||
      ![
        'start',
        'restart',
        'interact',
        'grab',
        'release',
        'rotate',
        'add-npc',
        'remove-npc',
        'fill-npcs',
      ].includes(action.type)
    )
      throw new RoomError('Invalid delivery action.');
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
        'Delivery not found. Check the code or create a new room.',
        404,
      );
    const room = JSON.parse(row.state) as DeliveryRoom;
    if (room.game !== 'uphill-delivery')
      throw new RoomError('This code belongs to another game.', 404);
    if (!joining && room.members[id] !== hash)
      throw new RoomError(
        'Your delivery pass expired. Rejoin with the room code.',
        401,
      );
    for (const p of room.world.players)
      if (!p.bot && p.id !== id && now - p.seen > 30000) {
        removeDeliveryPlayer(room.world, p.id);
        delete room.members[p.id];
      }
    if (!room.world.players.some((p) => p.id === room.host))
      room.host = room.world.players.find((p) => !p.bot)?.id ?? id;
    advanceDelivery(room.world, now);
    if (joining) {
      if (room.world.players.length >= 4)
        throw new RoomError(
          'All four workers are here. This room is full.',
          409,
        );
      if (room.world.phase === 'playing')
        throw new RoomError('A round is in progress. Join after it ends.', 409);
      const color =
        [0, 1, 2, 3].find(
          (c) => !room.world.players.some((p) => p.color === c),
        ) ?? 0;
      room.world.players.push(
        deliveryPlayer(id, safeName(body.name), color, now),
      );
      room.members[id] = hash;
    } else if (body.op === 'leave') {
      removeDeliveryPlayer(room.world, id);
      delete room.members[id];
      if (room.host === id)
        room.host = room.world.players.find((p) => !p.bot)?.id ?? '';
    } else {
      const p = room.world.players.find((p) => p.id === id);
      if (!p) throw new RoomError('Rejoin the delivery to continue.', 401);
      p.seen = now;
      if (body.input !== undefined) {
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
        if (input.seq >= p.input.seq)
          p.input = {
            x: Math.max(-1, Math.min(1, input.x)),
            z: Math.max(-1, Math.min(1, input.z)),
            jump: input.jump,
            seq: input.seq,
          };
      }
      if (body.op === 'action') {
        const request = `${id}:${String(body.requestId)}`;
        if (!room.requests.includes(request)) {
          try {
            deliveryAction(
              room.world,
              id,
              body.action as DeliveryAction,
              room.host,
            );
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
            snapshot: deliverySnapshot(
              room.world,
              code,
              room.host,
              id,
              next.version,
            ),
          };
  }
  throw new RoomError('The crew moved at once. Try that action again.', 409);
}
