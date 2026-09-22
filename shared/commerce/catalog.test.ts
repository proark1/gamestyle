import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMERCE_PRICES,
  FREE_GAME_IDS,
  hasGameAccess,
  partyCanPlay,
} from './catalog';

void test('individual ownership gates paid games while mixed parties retain the free selection', () => {
  assert.equal(FREE_GAME_IDS.length, 3);
  for (const game of FREE_GAME_IDS)
    assert.ok(partyCanPlay(game, [true, false, false, true]));
  assert.ok(!partyCanPlay('wrong-floor', [true, true, false]));
  assert.ok(partyCanPlay('wrong-floor', [true, true]));
  assert.ok(!partyCanPlay('wrong-floor', []));
  assert.ok(!hasGameAccess('invented-game', true));
  assert.deepEqual(COMMERCE_PRICES, {
    fullGame: 499,
    standard: 99,
    special: 199,
    bundle: 499,
  });
});
