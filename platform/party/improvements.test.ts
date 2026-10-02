import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomStore, Row } from '../../shared/rooms/types';
import type { GameId } from '../../shared/audio/types';
import { partyGoal } from '../../shared/ui/party-round';
import {
  createPartyRoom,
  joinPartyRoom,
  toggleReady,
  startPartyTournament,
  partyPlayerAction,
  setPartyFormat,
  pauseParty,
  reportRoundResult,
  getPartyRoom,
  voteForNextGame,
  closePartyRound,
} from './coordinator';
import { sharedRoundPoints } from './scoring';
import { roundAssignments, roundSeats } from './flow';
import { partyGameSession } from './game-session';
import { handlePeerRoom } from '../../shared/peer/coordinator';
import { handleVoicePeer } from '../../shared/voice/peer-coordinator';
import { compatibility } from '../../shared/peer/protocol';
import { createEngine as bungeeEngine } from '../../games/bungee-doubles/peer';
import { createEngine as brainEngine } from '../../games/four-brain-cells/peer';
import { createEngine as zorbEngine } from '../../games/zorb-clash/peer';

function memory() {
  const rows = new Map<string, Row>();
  const store: RoomStore = {
    get: async (code) => rows.get(code) ?? null,
    insert: async (row) => {
      if (rows.has(row.code)) return false;
      rows.set(row.code, row);
      return true;
    },
    compareAndSwap: async (row, version) => {
      if (rows.get(row.code)?.version !== version) return false;
      rows.set(row.code, row);
      return true;
    },
  };
  return { store, rows };
}
async function fixture(humans = 2, game: GameId = 'crane-clash') {
  const { store, rows } = memory();
  const host = await createPartyRoom(store, 'Alex', 0, 1000),
    code = host.state.code;
  const seats = [{ id: host.playerId, token: host.token }];
  for (let i = 1; i < humans; i++) {
    const guest = await joinPartyRoom(store, code, `Guest ${i}`, 0, 1000);
    seats.push({ id: guest.playerId, token: guest.token });
  }
  const row = rows.get(`party:${code}`)!;
  row.state = JSON.stringify({
    ...JSON.parse(row.state),
    playlist: Array(6).fill(game),
  });
  for (const pass of seats) await toggleReady(store, code, pass, true, 1000);
  let room = await startPartyTournament(store, code, seats[0], 1000);
  for (const pass of seats)
    room = await partyPlayerAction(
      store,
      code,
      pass,
      'briefing_ready',
      0,
      6000,
    );
  return { store, rows, code, seats, room };
}

void test('forfeits, failed goals and helper slots cannot earn a fake first place', () => {
  for (const kind of ['team', 'individual', 'cooperative'] as const)
    assert.deepEqual(
      sharedRoundPoints({ a: null, b: null, c: null, d: null }, kind),
      { a: 0, b: 0, c: 0, d: 0 },
    );
  assert.deepEqual(sharedRoundPoints({ a: null }, 'individual'), { a: 0 });
  assert.deepEqual(
    sharedRoundPoints(
      { a: partyGoal(false, 0), b: partyGoal(false, 0) },
      'cooperative',
    ),
    { a: 0, b: 0 },
  );
  assert.deepEqual(
    sharedRoundPoints(
      { a: partyGoal(true, 50), b: partyGoal(true, 50), c: null },
      'cooperative',
    ),
    { a: 6, b: 6, c: 0 },
  );
  assert.deepEqual(
    sharedRoundPoints(
      {
        a: partyGoal(true, 100),
        b: partyGoal(true, 50),
        c: partyGoal(false, 900),
        d: null,
      },
      'individual',
    ),
    { a: 10, b: 6, c: 0, d: 0 },
  );
  assert.deepEqual(
    sharedRoundPoints(
      { a: { kind: 'versus', outcome: 'draw' }, b: null },
      'team',
    ),
    { a: 6, b: 0 },
  );
});
void test('solo is practice, all-forfeit round has no winner and helpers never enter the score map', async () => {
  const f = await fixture(1, 'chain-of-fools');
  assert.equal(f.room.practice, true);
  const scored = await reportRoundResult(
    f.store,
    f.code,
    0,
    f.seats[0],
    null,
    10000,
  );
  assert.deepEqual(scored.roundResults[0].pointsAwarded, {
    [f.seats[0].id]: 0,
  });
  assert.equal(scored.roundResults[0].winnerId, undefined);
  assert.equal(scored.roundResults[0].outcome, 'skipped');
  assert(scored.players.every((p) => p.score === 0));
});
void test('start requires ready humans; briefing has a minimum read time and authenticates every seat', async () => {
  const { store } = memory();
  const h = await createPartyRoom(store, 'A', 0, 1000),
    code = h.state.code;
  const g = await joinPartyRoom(store, code, 'B', 0, 1000);
  const host = { id: h.playerId, token: h.token },
    guest = { id: g.playerId, token: g.token };
  assert.notEqual(g.state.players[0].color, g.state.players[1].color);
  await assert.rejects(startPartyTournament(store, code, host, 1000), /ready/);
  await toggleReady(store, code, guest, true, 1000);
  await startPartyTournament(store, code, host, 1000);
  await assert.rejects(
    partyPlayerAction(
      store,
      code,
      { ...guest, token: 'forged' },
      'briefing_ready',
      0,
      1001,
    ),
    /recognise/,
  );
  await partyPlayerAction(store, code, host, 'briefing_ready', 0, 1001);
  const early = await partyPlayerAction(
    store,
    code,
    guest,
    'briefing_ready',
    0,
    1001,
  );
  assert.equal(early.status, 'briefing');
  assert.equal((await getPartyRoom(store, code, 5999))?.status, 'briefing');
  assert.equal((await getPartyRoom(store, code, 6000))?.status, 'countdown');
  await assert.rejects(
    partyPlayerAction(store, code, guest, 'briefing_ready', 1, 6001),
    /changed/,
  );
});
void test('presence transfers leadership, retains seats, gives a full reconnect grace and settles missing reports', async () => {
  const f = await fixture();
  let room = await partyPlayerAction(
    f.store,
    f.code,
    f.seats[1],
    'heartbeat',
    undefined,
    26001,
  );
  assert.equal(room.hostId, f.seats[1].id);
  assert.equal(
    room.players.find((p) => p.id === f.seats[0].id)?.connected,
    false,
  );
  room = await reportRoundResult(
    f.store,
    f.code,
    0,
    f.seats[1],
    { kind: 'versus', outcome: 'won' },
    27000,
  );
  assert.equal(room.status, 'countdown');
  room = await partyPlayerAction(
    f.store,
    f.code,
    f.seats[1],
    'heartbeat',
    undefined,
    65999,
  );
  assert.equal(room.status, 'countdown');
  room = await partyPlayerAction(
    f.store,
    f.code,
    f.seats[1],
    'heartbeat',
    undefined,
    66001,
  );
  assert.equal(room.status, 'intermission');
  assert.equal(room.roundResults[0].pointsAwarded[f.seats[0].id], 0);
  room = await partyPlayerAction(
    f.store,
    f.code,
    f.seats[0],
    'heartbeat',
    undefined,
    67000,
  );
  assert.equal(room.hostId, f.seats[1].id);
  assert.equal(
    room.players.find((p) => p.id === f.seats[0].id)?.connected,
    true,
  );
  assert.equal(room.players.filter((p) => !p.isBot).length, 2);
});
void test('crew break freezes deadlines; human vote locks never close before the reading window', async () => {
  const f = await fixture();
  let room = await closePartyRound(f.store, f.code, 0, f.seats[0], 10000);
  room = await partyPlayerAction(
    f.store,
    f.code,
    f.seats[0],
    'heartbeat',
    undefined,
    16000,
  );
  assert.equal(room.intermission?.phase, 'voting');
  assert.deepEqual(room.intermission?.votes, {});
  const game = room.intermission!.candidates[0];
  room = await pauseParty(f.store, f.code, f.seats[1], true, 17000);
  const deadline = room.intermission!.endsAt;
  await partyPlayerAction(
    f.store,
    f.code,
    f.seats[0],
    'heartbeat',
    undefined,
    27000,
  );
  await partyPlayerAction(
    f.store,
    f.code,
    f.seats[1],
    'heartbeat',
    undefined,
    27000,
  );
  assert.equal(
    (await getPartyRoom(f.store, f.code, 34000))?.intermission?.phase,
    'voting',
  );
  await assert.rejects(
    pauseParty(f.store, f.code, f.seats[1], false, 34000),
    /host/,
  );
  room = await pauseParty(f.store, f.code, f.seats[0], false, 34000);
  assert.equal(room.intermission!.endsAt, deadline + 17000);
  for (const p of f.seats) {
    room = await voteForNextGame(f.store, f.code, 0, p, game, 34001);
    room = await partyPlayerAction(f.store, f.code, p, 'vote_lock', 0, 34001);
  }
  assert.equal(room.intermission?.phase, 'voting');
  room = await partyPlayerAction(
    f.store,
    f.code,
    f.seats[0],
    'heartbeat',
    undefined,
    38000,
  );
  assert.equal(room.status, 'briefing');
  assert.equal(room.playlist[1], game);
});
void test('Quick Party has three short rounds, clear host controls and a final result after round three', async () => {
  const { store, rows } = memory();
  const h = await createPartyRoom(store, 'A', 0, 1000),
    pass = { id: h.playerId, token: h.token };
  const room = await setPartyFormat(store, h.state.code, pass, 'quick', 1000);
  assert.equal(room.playlist.length, 3);
  const started = await startPartyTournament(store, room.code, pass, 1000);
  const row = rows.get(`party:${room.code}`)!;
  row.state = JSON.stringify({
    ...JSON.parse(row.state),
    currentRound: 2,
    status: 'countdown',
  });
  const done = await closePartyRound(store, room.code, 2, pass, 10000);
  assert.deepEqual(done.intermission?.candidates, []);
  assert.equal(
    (await getPartyRoom(store, room.code, done.intermission!.endsAt))?.status,
    'finished',
  );
  assert.equal(started.practice, true);
});
void test('actual Bungee engine preserves scores and teams against reset and team-switch attempts, including after recovery', () => {
  const members = ['a', 'b', 'c', 'd'].map((id, order) => ({
    id,
    name: id,
    color: order,
    order,
    instance: id,
    seen: 1000,
  }));
  const engine = bungeeEngine(1000);
  engine.configureParty();
  engine.reconcile(members);
  Object.assign(engine.world, { partyRoundStarted: true });
  engine.world.scores.red = 6;
  engine.world.scores.blue = 1;
  const team = engine.world.players.find((p) => p.id === 'b')!.team;
  assert(engine.execute('b', 'switch', { type: 'switchTeam' }, 'a').error);
  assert(engine.execute('a', 'reset', { type: 'restart' }, 'a').error);
  assert.equal(engine.world.players.find((p) => p.id === 'b')!.team, team);
  assert.deepEqual(engine.world.scores, { red: 6, blue: 1 });
  const recovered = bungeeEngine(5000, engine.checkpoint());
  recovered.configureParty();
  assert(recovered.execute('b', 'reset-2', { type: 'restart' }, 'a').error);
  assert.deepEqual(recovered.world.scores, engine.world.scores);
});
void test('loading waits do not consume Zorb match time and rotating breakfast limbs retain player colors', () => {
  const members = ['a', 'b', 'c', 'd'].map((id, order) => ({
    id,
    name: id,
    color: order,
    order,
    instance: id,
    seen: 1000,
  }));
  const zorb = zorbEngine(1000);
  zorb.configureParty();
  zorb.reconcile(members);
  const time = zorb.world.timeRemaining;
  for (let i = 0; i < 100; i++) zorb.advance(100);
  assert.equal(zorb.world.timeRemaining, time);
  Object.assign(zorb.world, { partyRoundStarted: true });
  zorb.advance(100);
  assert(zorb.world.timeRemaining < time);
  const brain = brainEngine(1000);
  brain.configureParty(1);
  brain.reconcile(members);
  assert.deepEqual(
    brain.world.players.map((p) => [p.color, p.limb]),
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  );
});
void test('party peer host lease expiry transfers authority without destroying the slow host seat', async () => {
  const f = await fixture();
  const hostSession = await partyGameSession(
    f.store,
    f.code,
    f.seats[0].id,
    f.seats[0].token,
    0,
    10000,
  );
  const guestSession = await partyGameSession(
    f.store,
    f.code,
    f.seats[1].id,
    f.seats[1].token,
    0,
    10000,
  );
  const request = (
    session: typeof hostSession,
    op: string,
    instance: string,
  ) => ({ ...compatibility('crane-clash'), ...session, op, instance });
  await handlePeerRoom(f.store, request(hostSession, 'hello', 'host'), 10000);
  await handlePeerRoom(f.store, request(guestSession, 'hello', 'guest'), 10000);
  await handlePeerRoom(f.store, request(guestSession, 'poll', 'guest'), 17000);
  const transferred = await handlePeerRoom(
    f.store,
    request(guestSession, 'poll', 'guest'),
    19000,
  );
  assert.equal(transferred.view.host, guestSession.id);
  assert.equal(transferred.view.members.length, 2);
  const restored = await handlePeerRoom(
    f.store,
    request(hostSession, 'poll', 'host'),
    20000,
  );
  assert.equal(restored.view.host, guestSession.id);
  assert(restored.view.members.some((m) => m.id === hostSession.id));
});
void test('shared assignment rotates real team insertion order across the tournament', async () => {
  const f = await fixture(4);
  const partners = new Set<string>();
  for (let round = 0; round < 3; round++) {
    const room = { ...f.room, currentRound: round };
    const teams = roundAssignments(room);
    partners.add(teams[0].find((id) => id !== f.seats[0].id)!);
    const engine = bungeeEngine(1000);
    engine.configureParty(round);
    engine.reconcile(
      roundSeats(room).map((p, order) => ({
        ...p,
        order,
        instance: p.id,
        seen: 1000,
      })),
    );
    assert.deepEqual(
      engine.world.players
        .filter((p) => !p.bot && p.team === 'red')
        .map((p) => p.id)
        .sort(),
      [...teams[0]].sort(),
    );
  }
  assert.equal(partners.size, 3);
});

void test('a reported party seat leaves the shared roster and cannot re-enter the active round', async () => {
  const f = await fixture();
  const sessions = await Promise.all(
    f.seats.map((p) =>
      partyGameSession(f.store, f.code, p.id, p.token, 0, 10000),
    ),
  );
  const request = (i: number, op: string) => ({
    ...compatibility('crane-clash'),
    ...sessions[i],
    op,
    instance: `browser-${i}`,
  });
  await handlePeerRoom(f.store, request(0, 'hello'), 10000);
  await handlePeerRoom(f.store, request(1, 'hello'), 10000);
  await reportRoundResult(f.store, f.code, 0, f.seats[0], null, 11000);
  const remaining = await handlePeerRoom(f.store, request(1, 'poll'), 11000);
  assert.deepEqual(
    remaining.view.members.map((m) => m.id),
    [f.seats[1].id],
  );
  assert.equal(remaining.view.host, f.seats[1].id);
  await assert.rejects(
    handlePeerRoom(f.store, request(0, 'poll'), 11000),
    /party round has ended/,
  );
  await assert.rejects(
    partyGameSession(
      f.store,
      f.code,
      f.seats[0].id,
      f.seats[0].token,
      0,
      11000,
    ),
    /no longer available/,
  );
});

void test('party voice survives slow game loading without disarming through an unnecessary seat recovery', async () => {
  const f = await fixture();
  const voice = (i: number, op: string, at: number) =>
    handleVoicePeer(
      f.store,
      f.store,
      {
        game: 'party',
        code: f.code,
        ...f.seats[i],
        instance: `voice-${i}`,
        op,
      },
      at,
    );
  await voice(0, 'hello', 10000);
  await voice(1, 'hello', 10000);
  const slowLoad = await voice(0, 'poll', 40000);
  assert.equal(slowLoad.view.voiceRecovered, false);
  assert.equal(slowLoad.view.members.length, 2);
  const expired = await voice(0, 'poll', 101000);
  assert.equal(
    expired.view.voiceRecovered,
    true,
    'a real interruption still uses explicit microphone recovery',
  );
});
