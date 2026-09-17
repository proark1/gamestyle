import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlaylist, PARTY_GAMES } from './playlist';
import { calculateRoundPoints } from './scoring';
import {
  createPartyRoom,
  joinPartyRoom,
  addBotToParty,
  toggleReady,
  startPartyTournament,
  recordRoundResult,
  advanceToNextRound,
  rematchParty,
  getPartyRoom,
} from './coordinator';
import type { RoomStore, Row } from '../../shared/rooms/types';

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
