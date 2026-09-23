import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMERCE_PRICES,
  COMMERCE_OFFERS,
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

void test('premium offers have purchase-only items and the bundle is cheaper', async () => {
  const { ITEMS } = await import('../wardrobe/catalog');
  const pieces = COMMERCE_OFFERS.filter(
    (offer) =>
      offer.grants.length === 1 &&
      offer.grants[0] !== 'entitlement:full-game' &&
      !offer.id.startsWith('costume:'),
  );
  assert.equal(pieces.length, 4);
  for (const offer of pieces) {
    const item = ITEMS.find((candidate) => candidate.id === offer.grants[0]);
    assert.equal(item?.premiumOffer, offer.id);
    assert.equal(item?.price, undefined);
    assert.equal(item?.goal, undefined);
  }
  const bundle = COMMERCE_OFFERS.find(
    (offer) => offer.id === 'party-style-bundle',
  )!;
  assert.deepEqual(
    bundle.grants,
    pieces.map((offer) => offer.grants[0]),
  );
  assert.ok(
    bundle.usdCents <
      pieces.reduce((total, offer) => total + offer.usdCents, 0),
  );
});

void test('five costumes have individual offers and a collection bundle', async () => {
  const { ITEMS } = await import('../wardrobe/catalog');
  const costumes = ITEMS.filter((item) => item.slot === 'costume');
  assert.equal(costumes.length, 5);
  for (const item of costumes) {
    const offer = COMMERCE_OFFERS.find(
      (entry) => entry.id === item.premiumOffer,
    );
    assert.deepEqual(offer?.grants, [item.id]);
    assert.equal(offer?.usdCents, COMMERCE_PRICES.special);
  }
  assert.deepEqual(
    COMMERCE_OFFERS.find((offer) => offer.id === 'costume-bundle')?.grants,
    costumes.map((item) => item.id),
  );
});
