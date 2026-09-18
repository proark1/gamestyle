import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generatePlaylist, PARTY_GAMES } from './playlist';
import {
  calculateRoundPoints,
  roundTeams,
  scoreGoalRound,
  scoreTeamRound,
} from './scoring';
import {
  createPartyRoom,
  joinPartyRoom,
  addBotToParty,
  toggleReady,
  startPartyTournament,
  recordRoundResult,
  reportRoundResult,
  closePartyRound,
  leavePartyRoom,
  advanceToNextRound,
  rematchParty,
  getPartyRoom,
  partyStorageKey,
} from './coordinator';
import type { GameId } from '../../shared/audio/types';
import type { RoomStore, Row } from '../../shared/rooms/types';
import {
  partyGoal,
  partyVersus,
  type PartyResult,
} from '../../shared/ui/party-round';

function createMockRoomStore(): RoomStore {
  const store = new Map<string, Row>();
  return {
    async get(code: string) {
      return store.get(code) ?? null;
    },
    async insert(row: Row) {
      if (store.has(row.code)) return false;
      store.set(row.code, { ...row });
      return true;
    },
    async compareAndSwap(row: Row, version: number) {
      const current = store.get(row.code);
      if (!current || current.version !== version) return false;
      store.set(row.code, { ...row });
      return true;
    },
    async purge() {
      const count = store.size;
      store.clear();
      return count;
    },
  };
}

void test('generatePlaylist selects 6 unique valid games', () => {
  const playlist = generatePlaylist(6);
  assert.equal(playlist.length, 6);
  const unique = new Set(playlist);
  assert.equal(unique.size, 6);
  for (const game of playlist) {
    assert(PARTY_GAMES.some((g) => g.id === game));
  }
});

void test('every party game tells the ribbon when its match is over', () => {
  // Game components import stylesheets, so their source is read as text. The
  // ribbon used to guess each game's end banner by class name and stalled the
  // playlist on most of them when those names drifted.
  for (const { id } of PARTY_GAMES) {
    const source = readFileSync(`games/${id}/Game.tsx`, 'utf8');
    assert.match(
      source,
      /\{\.\.\.partyRound\(/,
      `games/${id}/Game.tsx does not spread partyRound() onto its root, so a ` +
        `party playlist never advances past it`,
    );
  }
});

void test('every party game reports the kind of result its round is scored by', () => {
  // Team rounds are scored from who won; every other party game is played
  // against its own goal or clock. The server refuses the other kind.
  for (const { id, teams } of PARTY_GAMES) {
    const source = readFileSync(`games/${id}/Game.tsx`, 'utf8');
    const [reports, never] = teams
      ? ['partyVersus', 'partyGoal']
      : ['partyGoal', 'partyVersus'];
    assert.match(
      source,
      new RegExp(`\\b${reports}\\(`),
      `games/${id}/Game.tsx must report its result with ${reports}()`,
    );
    assert.doesNotMatch(
      source,
      new RegExp(`\\b${never}\\(`),
      `games/${id}/Game.tsx reports ${never}(), which its round refuses`,
    );
  }
});

void test('calculateRoundPoints assigns 10, 6, 3, 1 points correctly', () => {
  const scores = [
    { playerId: 'p1', score: 100 },
    { playerId: 'p2', score: 75 },
    { playerId: 'p3', score: 50 },
    { playerId: 'p4', score: 25 },
  ];
  const points = calculateRoundPoints(scores);
  assert.equal(points.p1, 10);
  assert.equal(points.p2, 6);
  assert.equal(points.p3, 3);
  assert.equal(points.p4, 1);
});

void test('calculateRoundPoints handles ties by pooling points', () => {
  // p1 and p2 tied for 1st place -> (10 + 6) / 2 = 8 pts each
  const scores = [
    { playerId: 'p1', score: 100 },
    { playerId: 'p2', score: 100 },
    { playerId: 'p3', score: 50 },
    { playerId: 'p4', score: 25 },
  ];
  const points = calculateRoundPoints(scores);
  assert.equal(points.p1, 8);
  assert.equal(points.p2, 8);
  assert.equal(points.p3, 3);
  assert.equal(points.p4, 1);
});

void test('calculateRoundPoints handles 2v2 team games', () => {
  const scores = [
    { playerId: 'p1', score: 100 },
    { playerId: 'p2', score: 90 },
    { playerId: 'p3', score: 40 },
    { playerId: 'p4', score: 30 },
  ];
  const points = calculateRoundPoints(scores, true);
  assert.equal(points.p1, 10);
  assert.equal(points.p2, 10);
  assert.equal(points.p3, 3);
  assert.equal(points.p4, 3);
});

void test('the 2v2 party games score their round as two pairs', async () => {
  for (const game of [
    'zorb-clash',
    'sample-stampede',
    'siege-and-desist',
  ] as const) {
    const store = createMockRoomStore();
    const { state, playerId: hostId } = await createPartyRoom(store, 'Host', 0);
    // Pin the game into round 0; the tournament keeps a full playlist.
    const row = (await store.get(partyStorageKey(state.code)))!;
    const playlist = [
      game,
      ...PARTY_GAMES.map((entry) => entry.id).filter((id) => id !== game),
    ].slice(0, 6);
    await store.compareAndSwap(
      {
        ...row,
        state: JSON.stringify({ ...state, playlist }),
        version: row.version + 1,
      },
      row.version,
    );
    await joinPartyRoom(store, state.code, 'Guest', 1);
    const started = await startPartyTournament(store, state.code, hostId);
    const [red1, red2, blue1, blue2] = started.players.map((p) => p.id);

    const after = await recordRoundResult(
      store,
      state.code,
      0,
      { [red1]: 3, [red2]: 3, [blue1]: 1, [blue2]: 1 },
      hostId,
    );
    assert.deepEqual(
      after.roundResults[0].pointsAwarded,
      { [red1]: 10, [red2]: 10, [blue1]: 3, [blue2]: 3 },
      `${game} did not award team points`,
    );
  }
});

void test('Party Room Lifecycle: create -> join -> start -> score -> next round -> finish -> rematch', async () => {
  const store = createMockRoomStore();

  // 1. Create party room
  const { state: initialRoom, playerId: hostId } = await createPartyRoom(
    store,
    'HostHero',
    0,
  );
  assert.equal(initialRoom.status, 'lobby');
  assert.equal(initialRoom.players.length, 1);
  assert.equal(initialRoom.players[0].isHost, true);

  const code = initialRoom.code;

  // 2. Join players
  const { playerId: guestId1 } = await joinPartyRoom(
    store,
    code,
    'GuestOne',
    1,
  );
  const { playerId: guestId2 } = await joinPartyRoom(
    store,
    code,
    'GuestTwo',
    2,
  );

  // 3. Add a bot
  await addBotToParty(store, code, hostId);

  const roomWith4 = await getPartyRoom(store, code);
  assert(roomWith4);
  assert.equal(roomWith4.players.length, 4);
  assert(roomWith4.players.some((p) => p.isBot));

  // 4. Toggle ready
  await toggleReady(store, code, guestId1, true);
  await toggleReady(store, code, guestId2, true);

  // 5. Start tournament
  const started = await startPartyTournament(store, code, hostId);
  assert.equal(started.status, 'countdown');
  assert.equal(started.currentRound, 0);
  assert.equal(started.playlist.length, 6);

  // 6. Record round result for round 0
  const scores = {
    [hostId]: 50,
    [guestId1]: 80,
    [guestId2]: 30,
    [started.players[3].id]: 10,
  };
  const afterRound0 = await recordRoundResult(store, code, 0, scores, hostId);
  assert.equal(afterRound0.status, 'intermission');
  const round0Result = afterRound0.roundResults[0];
  const ptsAwarded = round0Result.pointsAwarded;
  assert.equal(ptsAwarded[guestId1], 10);
  assert(ptsAwarded[hostId] === 6 || ptsAwarded[hostId] === 10);
  assert(afterRound0.players.find((p) => p.id === guestId1)!.score >= 10);

  // 7. Advance to next round
  const round1 = await advanceToNextRound(store, code, hostId);
  assert.equal(round1.status, 'countdown');
  assert.equal(round1.currentRound, 1);

  // Fast forward through rounds 1..5
  for (let r = 1; r <= 5; r++) {
    const afterR = await recordRoundResult(store, code, r, scores, hostId);
    if (r === 5) {
      assert.equal(afterR.status, 'finished');
    } else {
      await advanceToNextRound(store, code, hostId);
    }
  }

  const finished = await getPartyRoom(store, code);
  assert(finished);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.roundResults.length, 6);

  // 8. Rematch
  const rematched = await rematchParty(store, code, hostId);
  assert.equal(rematched.status, 'lobby');
  assert.equal(rematched.currentRound, 0);
  assert.equal(rematched.roundResults.length, 0);
  assert(rematched.players.every((p) => p.score === 0));
});

const won = partyVersus('red', 'red');
const lost = partyVersus('red', 'blue');
const drew = partyVersus('red', 'draw');

void test('team rounds rotate partners so everyone pairs up with everyone', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const pairings = [0, 1, 2].map((round) => roundTeams(ids, round));
  assert.deepEqual(pairings, [
    [
      ['a', 'b'],
      ['c', 'd'],
    ],
    [
      ['a', 'c'],
      ['b', 'd'],
    ],
    [
      ['a', 'd'],
      ['b', 'c'],
    ],
  ]);
  assert.deepEqual(roundTeams(ids, 3), pairings[0]);
  // Someone left mid-tournament: the rest still split into two sides.
  assert.deepEqual(roundTeams(['a', 'b', 'c'], 1), [['a', 'c'], ['b']]);
});

void test('a team round counts every human match as a leg for that side', () => {
  const teams: [string[], string[]] = [
    ['host', 'bot1'],
    ['guest', 'bot2'],
  ];
  const round = (reports: Record<string, PartyResult | null>) => {
    const scores = scoreTeamRound(teams, reports);
    const points = calculateRoundPoints(
      Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
      true,
    );
    return { scores, points };
  };

  // Each human played their own match with NPCs standing in for the rest;
  // both legs went to the host's side, and both teammates share the win.
  assert.deepEqual(round({ host: won, guest: lost }), {
    scores: { host: 1, bot1: 1, guest: 0, bot2: 0 },
    points: { host: 10, bot1: 10, guest: 3, bot2: 3 },
  });
  // Both sides won a leg: the round is drawn.
  assert.deepEqual(round({ host: won, guest: won }).points, {
    host: 6,
    bot1: 6,
    guest: 6,
    bot2: 6,
  });
  // Giving up loses the leg; a drawn match splits it.
  assert.deepEqual(round({ host: null, guest: drew }), {
    scores: { host: 0.25, bot1: 0.25, guest: 0.75, bot2: 0.75 },
    points: { host: 3, bot1: 3, guest: 10, bot2: 10 },
  });
  // A lone human's match decides the round for both sides.
  assert.deepEqual(
    scoreTeamRound(
      [
        ['host', 'bot1'],
        ['bot2', 'bot3'],
      ],
      { host: lost },
    ),
    { host: 0, bot1: 0, bot2: 1, bot3: 1 },
  );
});

void test('in a goal round the bots stand for the goal itself', () => {
  const ids = ['host', 'guest', 'bot1', 'bot2'];
  // Cleared beats the bots, failing loses to them, however big the score.
  const scores = scoreGoalRound(ids, {
    host: partyGoal(true, 40),
    guest: partyGoal(false, 900),
  });
  const points = calculateRoundPoints(
    ids.map((playerId) => ({ playerId, score: scores[playerId] })),
  );
  assert.deepEqual(scores, { host: 3, guest: 0, bot1: 1, bot2: 1 });
  assert.deepEqual(points, { host: 10, bot1: 5, bot2: 5, guest: 1 });

  // Humans on the same side of the goal are ranked by score; giving up is
  // last of all.
  assert.deepEqual(
    scoreGoalRound(['a', 'b', 'c', 'd', 'bot'], {
      a: partyGoal(true, 10),
      b: partyGoal(true, 30),
      c: null,
      d: partyGoal(true, 10),
    }),
    { a: 2, b: 4, c: 0, d: 2, bot: 1 },
  );
  // A lone human who fails the goal comes in behind the bots.
  assert.deepEqual(
    scoreGoalRound(['host', 'bot1', 'bot2', 'bot3'], {
      host: partyGoal(false, 5),
    }),
    { host: 0, bot1: 1, bot2: 1, bot3: 1 },
  );
});

/** A started party whose every round is `game`, with `guests` joined humans. */
async function startParty(game: GameId, guests: number) {
  const store = createMockRoomStore();
  const { state, playerId: hostId } = await createPartyRoom(store, 'Host', 0);
  const row = (await store.get(partyStorageKey(state.code)))!;
  await store.compareAndSwap(
    {
      ...row,
      state: JSON.stringify({ ...state, playlist: Array(6).fill(game) }),
      version: row.version + 1,
    },
    row.version,
  );
  const guestIds: string[] = [];
  for (let i = 0; i < guests; i++) {
    const joined = await joinPartyRoom(store, state.code, `Guest ${i}`, i + 1);
    guestIds.push(joined.playerId);
  }
  const started = await startPartyTournament(store, state.code, hostId);
  const bots = started.players.filter((p) => p.isBot).map((p) => p.id);
  return { store, code: state.code, hostId, guestIds, bots };
}

void test('a goal round waits for every human, then scores their reports', async () => {
  const {
    store,
    code,
    hostId,
    guestIds: [guestId],
    bots,
  } = await startParty('chain-of-fools', 1);

  const waiting = await reportRoundResult(
    store,
    code,
    0,
    hostId,
    partyGoal(true, 1200),
  );
  assert.equal(waiting.status, 'countdown');
  assert.deepEqual(waiting.reports, { [hostId]: partyGoal(true, 1200) });

  // The first report stands, so a better rematch changes nothing.
  const again = await reportRoundResult(
    store,
    code,
    0,
    hostId,
    partyGoal(true, 9999),
  );
  assert.deepEqual(again.reports, waiting.reports);

  const scored = await reportRoundResult(
    store,
    code,
    0,
    guestId,
    partyGoal(false, 300),
  );
  assert.equal(scored.status, 'intermission');
  assert.equal(scored.reports, undefined);
  const [result] = scored.roundResults;
  assert.deepEqual(result.pointsAwarded, {
    [hostId]: 10,
    [guestId]: 1,
    [bots[0]]: 5,
    [bots[1]]: 5,
  });
  assert.deepEqual(result.reports, {
    [hostId]: partyGoal(true, 1200),
    [guestId]: partyGoal(false, 300),
  });
  assert.equal(result.winnerId, hostId);

  // A late report once the round is scored is ignored.
  const late = await reportRoundResult(
    store,
    code,
    0,
    guestId,
    partyGoal(true, 1),
  );
  assert.deepEqual(late.roundResults, scored.roundResults);
});

void test('a team round scores both teammates alike from the human legs', async () => {
  const {
    store,
    code,
    hostId,
    guestIds: [guestId],
    bots,
  } = await startParty('crane-clash', 1);

  // Round 0 pairs the host with the guest against the two bots.
  await reportRoundResult(store, code, 0, hostId, won);
  const round0 = await reportRoundResult(store, code, 0, guestId, won);
  assert.deepEqual(round0.roundResults[0].teams, [
    [hostId, guestId],
    [bots[0], bots[1]],
  ]);
  assert.deepEqual(round0.roundResults[0].pointsAwarded, {
    [hostId]: 10,
    [guestId]: 10,
    [bots[0]]: 3,
    [bots[1]]: 3,
  });

  // Round 1 puts the two humans on opposite sides.
  await advanceToNextRound(store, code, hostId);
  await reportRoundResult(store, code, 1, hostId, won);
  const round1 = await reportRoundResult(store, code, 1, guestId, lost);
  const [, result] = round1.roundResults;
  assert.deepEqual(result.teams, [
    [hostId, bots[0]],
    [guestId, bots[1]],
  ]);
  assert.deepEqual(result.pointsAwarded, {
    [hostId]: 10,
    [guestId]: 3,
    [bots[0]]: 10,
    [bots[1]]: 3,
  });
});

void test('a report is refused unless it is a real result for this round', async () => {
  const { store, code, hostId, bots } = await startParty('crane-clash', 1);
  await assert.rejects(
    reportRoundResult(store, code, 0, hostId, partyGoal(true, 1)),
    /does not belong to this round/,
  );
  await assert.rejects(
    reportRoundResult(store, code, 0, hostId, { kind: 'versus', outcome: 1 }),
    /could not be read/,
  );
  await assert.rejects(
    reportRoundResult(store, code, 0, bots[0], won),
    /Only a player in this party/,
  );
  await assert.rejects(
    reportRoundResult(store, code, 0, 'stranger', won),
    /Only a player in this party/,
  );
  // A report for another round is ignored.
  const other = await reportRoundResult(store, code, 3, hostId, won);
  assert.equal(other.reports, undefined);
});

void test('the host can score the round without the players still out', async () => {
  const {
    store,
    code,
    hostId,
    guestIds: [guestId],
  } = await startParty('reel-problems', 1);
  await reportRoundResult(store, code, 0, hostId, partyGoal(false, 90));
  await assert.rejects(
    closePartyRound(store, code, 0, guestId),
    /Only the party host/,
  );
  const closed = await closePartyRound(store, code, 0, hostId);
  assert.equal(closed.status, 'intermission');
  const [result] = closed.roundResults;
  assert.equal(result.reports?.[guestId], null);
  assert.equal(result.pointsAwarded[guestId], 1);
});

void test('a round is scored once the last player still out leaves', async () => {
  const {
    store,
    code,
    hostId,
    guestIds: [guestId],
  } = await startParty('wrong-floor', 1);
  await reportRoundResult(store, code, 0, hostId, partyGoal(true, 0));
  const left = await leavePartyRoom(store, code, guestId);
  assert.equal(left.status, 'intermission');
  assert.equal(left.roundResults[0].pointsAwarded[hostId], 10);
});

void test('a round is only ever scored once', async () => {
  const {
    store,
    code,
    hostId,
    guestIds: [guestId],
  } = await startParty('reel-problems', 1);
  const scores = { [hostId]: 5, [guestId]: 3 };
  await recordRoundResult(store, code, 0, scores, hostId);
  const twice = await recordRoundResult(store, code, 0, scores, hostId);
  assert.equal(twice.roundResults.length, 1);
  assert.equal(twice.players.find((p) => p.id === hostId)!.score, 10);
});
