import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_LIFETIME_MS,
  ROOM_SEATS,
  SEAT_TIMEOUT_MS,
  freeColor,
  handleRoomRequest,
  type RoomAdapter,
} from './lifecycle';
import { RoomError, type RoomStore, type Row } from './types';

/**
 * The lifecycle contract on its own, through the smallest adapter that can
 * hold a room. Each game's own tests cover its rules; the five games' shared
 * behaviour was pinned against the old per-game handlers before extraction.
 */

type Player = {
  id: string;
  name: string;
  seen: number;
  bot?: boolean;
  color: number;
  input: { x: number; seq: number };
};
type World = { players: Player[]; phase: 'lobby' | 'playing'; ticks: number };
type Action = { type: string; target?: string };
type Snapshot = {
  code: string;
  host: string;
  you: string;
  version: number;
  players: string[];
};

class MemoryStore implements RoomStore {
  rows = new Map<string, Row>();
  losses = 0;
  async get(code: string) {
    const row = this.rows.get(code);
    return row ? { ...row } : null;
  }
  async insert(row: Row) {
    if (this.rows.has(row.code)) return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
  async compareAndSwap(row: Row, version: number) {
    if (this.losses > 0) {
      this.losses--;
      return false;
    }
    if (this.rows.get(row.code)?.version !== version) return false;
    this.rows.set(row.code, { ...row });
    return true;
  }
  world(key: string) {
    return JSON.parse(this.rows.get(key)!.state) as {
      game?: string;
      host: string;
      world: World;
      requests: string[];
      members: Record<string, string>;
    };
  }
}

const words = {
  busy: 'busy',
  unknownOp: 'unknown op',
  code: 'bad code',
  passMissing: 'pass missing',
  notFound: 'not found',
  passExpired: 'pass expired',
  full: 'full',
  inProgress: 'in progress',
  rejoin: 'rejoin',
  invalidAction: 'invalid action',
  contention: 'contention',
};

const acted: string[] = [];
const player = (
  id: string,
  name: string,
  color: number,
  now: number,
): Player => ({
  id,
  name,
  seen: now,
  color,
  input: { x: 0, seq: 0 },
});

const adapter: RoomAdapter<World, Action, Snapshot> = {
  game: 'test-game',
  key: (code) => `test:${code}`,
  words,
  defaultName: 'Tester',
  actions: ['start', 'poke', 'add-bot'],
  validAction: (action) =>
    action.target === undefined || action.target.length <= 8,
  attempts: 3,
  requestLog: 2,
  create: (now, id, name) => ({
    players: [player(id, name, 0, now)],
    phase: 'lobby',
    ticks: 0,
  }),
  join(world, id, name, now) {
    if (world.players.length >= ROOM_SEATS)
      throw new RoomError(words.full, 409);
    if (world.phase === 'playing') throw new RoomError(words.inProgress, 409);
    world.players.push(player(id, name, freeColor(world.players), now));
  },
  remove(world, id) {
    world.players = world.players.filter((p) => p.id !== id);
  },
  advance(world) {
    world.ticks++;
  },
  input(p, body) {
    const input = body.input as { x: number; seq: number } | undefined;
    if (!input) return;
    if (typeof input.x !== 'number') throw new RoomError('bad controls');
    if (input.seq > p.input.seq) p.input = input;
  },
  act(world, id, action, host) {
    if (action.type === 'start') {
      if (id !== host) throw new Error('Only the host can start.');
      world.phase = 'playing';
    }
    if (action.type === 'add-bot')
      world.players.push({
        ...player(`bot-${world.players.length}`, 'Bot', 3, 0),
        bot: true,
      });
    acted.push(`${id}:${action.type}`);
  },
  snapshot: (world, code, host, you, version) => ({
    code,
    host,
    you,
    version,
    players: world.players.map((p) => p.id),
  }),
};

const NOW = 5_000_000;
type Reply = {
  ok?: true;
  session?: { code: string; id: string; token: string };
  snapshot?: Snapshot;
};
const call = (store: RoomStore, body: Record<string, unknown>, now = NOW) =>
  handleRoomRequest(adapter, store, body, now) as Promise<Reply>;

async function room() {
  const store = new MemoryStore();
  const host = (await call(store, { op: 'create', name: 'Ada' })).session!;
  return { store, host, key: `test:${host.code}` };
}

async function rejects(
  promise: Promise<unknown>,
  status: number,
  message: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof RoomError);
    assert.equal(error.status, status);
    assert.equal(error.message, message);
    return true;
  });
}

void test('a created room is stored under its key, stamped with its game', async () => {
  const { store, host, key } = await room();
  const stored = store.world(key);
  assert.equal(stored.game, 'test-game');
  assert.equal(stored.host, host.id);
  assert.deepEqual(Object.keys(stored).sort(), [
    'game',
    'host',
    'members',
    'requests',
    'world',
  ]);
  assert.notEqual(
    stored.members[host.id],
    host.token,
    'only a hash of the token is kept',
  );
});

void test('a game without a stamp stores none, for rooms that predate it', async () => {
  const store = new MemoryStore();
  const reply = (await handleRoomRequest(
    { ...adapter, game: undefined },
    store,
    { op: 'create' },
    NOW,
  )) as Reply;
  assert.equal('game' in store.world(`test:${reply.session!.code}`), false);
});

void test('a code minted by another game is not found', async () => {
  const { store, host, key } = await room();
  const stored = store.world(key);
  stored.game = 'another-game';
  store.rows.get(key)!.state = JSON.stringify(stored);
  await rejects(
    call(store, { op: 'sync', ...host }),
    404,
    'This code belongs to another game.',
  );
});

void test('requests are checked in a fixed order, the operation first', async () => {
  const { store, host } = await room();
  await rejects(call(store, { op: 'bogus' }), 400, words.unknownOp);
  await rejects(call(store, { op: 'sync', code: 'no' }), 400, words.code);
  await rejects(
    call(store, { op: 'sync', code: host.code }),
    401,
    words.passMissing,
  );
  await rejects(
    call(store, { op: 'sync', ...host, token: 'x'.repeat(101) }),
    401,
    words.passMissing,
  );
  await rejects(
    call(store, { op: 'sync', ...host, token: 'wrong' }),
    401,
    words.passExpired,
  );
  await rejects(
    call(store, { op: 'sync', ...host, code: 'ZZZZZZ' }),
    404,
    words.notFound,
  );
  await rejects(
    call(store, {
      op: 'action',
      ...host,
      action: { type: 'nope' },
      requestId: 'r',
    }),
    400,
    words.invalidAction,
  );
  await rejects(
    call(store, {
      op: 'action',
      ...host,
      action: { type: 'poke', target: 'much-too-long' },
      requestId: 'r',
    }),
    400,
    words.invalidAction,
  );
  await rejects(
    call(store, {
      op: 'action',
      ...host,
      action: { type: 'poke' },
      requestId: '',
    }),
    400,
    'Missing action identifier.',
  );
  await rejects(
    handleRoomRequest(
      { ...adapter, words: { ...words, missingRequest: 'custom' } },
      store,
      { op: 'action', ...host, action: { type: 'poke' } },
      NOW,
    ),
    400,
    'custom',
  );
});

void test('a lower-case code reaches the same room', async () => {
  const { store, host } = await room();
  const reply = await call(store, {
    op: 'sync',
    ...host,
    code: host.code.toLowerCase(),
  });
  assert.equal(reply.snapshot?.code, host.code);
});

void test('a repeated request is answered without acting twice, and the log is bounded', async () => {
  const { store, host, key } = await room();
  acted.length = 0;
  const poke = (requestId: string) =>
    call(store, { op: 'action', ...host, action: { type: 'poke' }, requestId });
  await poke('a');
  await poke('a');
  assert.deepEqual(acted, [`${host.id}:poke`]);
  await poke('b');
  await poke('c');
  assert.deepEqual(
    store.world(key).requests,
    [`${host.id}:b`, `${host.id}:c`],
    'requestLog: 2',
  );
});

void test('a failing action reaches the player as a room error', async () => {
  const { store, host } = await room();
  const friend = (await call(store, { op: 'join', code: host.code })).session!;
  await rejects(
    call(store, {
      op: 'action',
      ...friend,
      action: { type: 'start' },
      requestId: 'r',
    }),
    400,
    'Only the host can start.',
  );
});

void test('a quiet seat is released, but never the caller or a bot', async () => {
  const { store, host, key } = await room();
  const friend = (
    await call(store, { op: 'join', code: host.code, name: 'Bo' }, NOW + 1)
  ).session!;
  await call(
    store,
    { op: 'action', ...host, action: { type: 'add-bot' }, requestId: 'bot' },
    NOW + 2,
  );
  // The friend reconnects after everyone else has gone quiet: they keep their seat.
  const late = await call(
    store,
    { op: 'sync', ...friend },
    NOW + SEAT_TIMEOUT_MS + 10,
  );
  assert.deepEqual(late.snapshot?.players, [friend.id, 'bot-2']);
  assert.equal(
    late.snapshot?.host,
    friend.id,
    'hosting passes to a person, not the bot',
  );
  assert.equal(store.world(key).members[host.id], undefined);
});

void test('a room idle for a day is gone', async () => {
  const { store, host } = await room();
  await rejects(
    call(store, { op: 'sync', ...host }, NOW + ROOM_LIFETIME_MS + 1),
    404,
    words.notFound,
  );
});

void test('seats and rounds are the game’s to refuse', async () => {
  const { store, host } = await room();
  for (let i = 0; i < ROOM_SEATS - 1; i++)
    await call(store, { op: 'join', code: host.code });
  await rejects(call(store, { op: 'join', code: host.code }), 409, words.full);
});

void test('leaving hands hosting on, and a departed seat cannot sync', async () => {
  const { store, host } = await room();
  const friend = (await call(store, { op: 'join', code: host.code }, NOW + 1))
    .session!;
  assert.deepEqual(await call(store, { op: 'leave', ...host }, NOW + 2), {
    ok: true,
  });
  const reply = await call(store, { op: 'sync', ...friend }, NOW + 3);
  assert.equal(reply.snapshot?.host, friend.id);
  await rejects(
    call(store, { op: 'sync', ...host }, NOW + 4),
    401,
    words.passExpired,
  );
});

void test('controls go through the game, which decides what is newer', async () => {
  const { store, host, key } = await room();
  await call(store, { op: 'sync', ...host, input: { x: 1, seq: 2 } });
  await call(store, { op: 'sync', ...host, input: { x: -1, seq: 1 } });
  assert.deepEqual(store.world(key).world.players[0].input, { x: 1, seq: 2 });
  await rejects(
    call(store, { op: 'sync', ...host, input: { x: 'no', seq: 3 } }),
    400,
    'bad controls',
  );
});

void test('a write that keeps losing the race gives up after the game’s attempts', async () => {
  const { store, host } = await room();
  store.losses = 3;
  await rejects(call(store, { op: 'sync', ...host }), 409, words.contention);
  store.losses = 2;
  assert.ok(
    (await call(store, { op: 'sync', ...host })).snapshot,
    'the third attempt lands',
  );
});

void test('a free colour is the lowest one unused', () => {
  assert.equal(freeColor([]), 0);
  assert.equal(freeColor([{ color: 0 }, { color: 2 }]), 1);
  assert.equal(
    freeColor([{ color: 0 }, { color: 1 }, { color: 2 }, { color: 3 }]),
    0,
  );
});
