import test from 'node:test';
import assert from 'node:assert/strict';
import type { PartyRoomState } from '@/platform/party/types';
import { partyAwards } from './party-share';

void test('share awards use completed rounds and exclude bot seats', () => {
  const room = {
    players: [
      { id: 'a', name: 'Alex', score: 13 },
      { id: 'b', name: 'Bo', score: 11 },
      { id: 'bot', name: 'Bot', score: 99, isBot: true },
    ],
    roundResults: [
      {
        pointsAwarded: { a: 10, b: 5, bot: 99 },
        reports: { a: {}, b: {}, bot: {} },
      },
      {
        pointsAwarded: { a: 3, b: 6 },
        reports: { a: {}, b: {} },
      },
    ],
  } as unknown as PartyRoomState;
  assert.deepEqual(partyAwards(room, false), [
    { playerId: 'a', label: 'Point magnet' },
    { playerId: 'a', label: 'Always in' },
    { playerId: 'b', label: 'Finale spark' },
  ]);
  assert.equal(partyAwards({ ...room, roundResults: [] }, true).length, 0);
});
