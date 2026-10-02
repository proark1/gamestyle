import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMERCE_PRICES,
  COMMERCE_OFFERS,
  FREE_GAME_IDS,
  hasGameAccess,
  partyCanPlay,
} from './catalog';
import { ITEMS } from '../wardrobe/catalog';

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

void test('every premium costume has a single offer and the bundle grants all five', () => {
  const costumes = ITEMS.filter((item) => item.slot === 'costume');
  assert.equal(costumes.length, 5);
  for (const costume of costumes) {
    assert.equal(costume.premium, true);
    assert.deepEqual(
      COMMERCE_OFFERS.find((offer) => offer.id === `costume:${costume.id}`),
      { id: `costume:${costume.id}`, grants: [costume.id], usdCents: 199 },
    );
  }
  assert.deepEqual(
    COMMERCE_OFFERS.find((offer) => offer.id === 'costume-bundle')?.grants,
    costumes.map((costume) => costume.id),
  );
});
