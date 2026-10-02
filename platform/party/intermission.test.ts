import test from 'node:test';
import assert from 'node:assert/strict';
import {
  highlightedCandidate,
  progressIntermission,
  voteCandidates,
  voteCounts,
} from './intermission';
import type { PartyRoomState } from './types';

function fixture(): PartyRoomState {
  return {
    code: 'ABCDEF',
    hostId: 'a',
    status: 'intermission',
    currentRound: 0,
    updated: 0,
    playlist: [
      'basketball',
      'crane-clash',
      'wrong-floor',
      'load-bearing',
      'act-natural',
      'reel-problems',
    ],
    players: ['a', 'b', 'c', 'd'].map((id, color) => ({
      id,
      color,
      name: id,
      ready: true,
      isHost: id === 'a',
      score: 0,
    })),
    roundResults: [
      { round: 0, game: 'basketball', scores: {}, pointsAwarded: {} },
    ],
  };
}
function voting() {
  const podium = progressIntermission(fixture(), 1000, () => 0);
  return progressIntermission(podium, 5000, () => 0);
}

void test('candidates are three distinct unplayed games, including provisional future games', () => {
  const room = fixture();
  const candidates = voteCandidates(room, () => 0);
  assert.equal(candidates.length, 3);
  assert.equal(new Set(candidates).size, 3);
  assert(!candidates.includes('basketball'));
  room.roundResults.push({
    round: 1,
    game: candidates[0],
    scores: {},
    pointsAwarded: {},
  });
  assert(!voteCandidates(room, () => 0).includes(candidates[0]));
});

void test('phase deadlines hold; idle reconnect gets a full voting window', () => {
  const podium = progressIntermission(fixture(), 1000);
  assert.equal(progressIntermission(podium, 4999), podium);
  const next = progressIntermission(podium, 90000);
  assert.equal(next.intermission!.phase, 'voting');
  assert.equal(next.intermission!.endsAt, 105000);
  assert.equal(progressIntermission(next, 104999), next);
});

void test('helpers never vote and departed human voters disappear', () => {
  const room = fixture();
  room.players[3].isBot = true;
  let next = progressIntermission(room, 1000, () => 0);
  next = progressIntermission(next, 5000, () => 0);
  assert.deepEqual(next.intermission!.votes, {});
  assert.equal(progressIntermission(next, 5001), next);
  next.intermission!.votes.c = next.intermission!.candidates[0];
  next = progressIntermission(
    { ...next, players: next.players.slice(0, 2) },
    5002,
  );
  assert.deepEqual(next.intermission!.votes, {});
});

void test('a majority reveals its winner then launches precisely that game once', () => {
  let room = voting();
  const ballot = room.intermission!;
  ballot.votes = {
    a: ballot.candidates[1],
    b: ballot.candidates[1],
    c: ballot.candidates[2],
  };
  assert.deepEqual(voteCounts(ballot), [0, 2, 1]);
  room = progressIntermission(room, ballot.endsAt, () => 0);
  assert.equal(room.intermission!.phase, 'reveal');
  assert.equal(room.intermission!.winner, ballot.candidates[1]);
  room = progressIntermission(room, room.intermission!.endsAt);
  assert.equal(room.status, 'countdown');
  assert.equal(room.currentRound, 1);
  assert.equal(room.playlist[1], ballot.candidates[1]);
  assert.equal(room.intermission, undefined);
  assert.equal(progressIntermission(room, 100000), room);
});

for (const votes of [2, 3, 0]) {
  void test(`${votes === 0 ? 'no votes' : `${votes}-way tie`} cycles only tied cards and lands on the saved winner`, () => {
    for (const random of [0, 0.49, 0.999]) {
      let room = voting();
      const ballot = room.intermission!;
      for (let i = 0; i < votes; i++)
        ballot.votes[room.players[i].id] = ballot.candidates[i];
      room = progressIntermission(room, ballot.endsAt, () => random);
      const tie = room.intermission!;
      assert.equal(tie.phase, 'tie-break');
      assert.equal(tie.tied.length, votes || 3);
      assert.equal(tie.winner, tie.tied[Math.floor(random * tie.tied.length)]);
      for (let time = tie.startedAt; time <= tie.endsAt; time += 50) {
        assert(tie.tied.includes(highlightedCandidate(tie, time)!));
      }
      assert.equal(highlightedCandidate(tie, tie.endsAt), tie.winner);
      const reveal = progressIntermission(room, tie.endsAt);
      assert.equal(reveal.intermission!.winner, tie.winner);
      assert.equal(reveal.intermission!.phase, 'reveal');
    }
  });
}

void test('departures after resolution do not change the winner', () => {
  let room = voting();
  room.intermission!.votes = { a: room.intermission!.candidates[0] };
  room = progressIntermission(room, room.intermission!.endsAt);
  const winner = room.intermission!.winner;
  room = progressIntermission(
    { ...room, players: room.players.slice(1) },
    room.intermission!.endsAt,
  );
  assert.equal(room.playlist[1], winner);
});

void test('final round celebrates before finishing without a ballot', () => {
  const room = progressIntermission({ ...fixture(), currentRound: 5 }, 1000);
  assert.deepEqual(room.intermission!.candidates, []);
  const final = progressIntermission(room, room.intermission!.endsAt);
  assert.equal(final.status, 'finished');
  assert.equal(final.currentRound, 5);
  assert.equal(final.intermission, undefined);
});
