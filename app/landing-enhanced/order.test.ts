import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEnhancedCollectionOrder,
  STANDARD_GAME_SLUGS,
  STANDARD_PINNED,
  STANDARD_SHUFFLED,
} from './order';

void test('enhanced routes preserve the standard homepage catalogue contract', () => {
  const order = createEnhancedCollectionOrder(() => 0.25);

  assert.equal(order.length, STANDARD_GAME_SLUGS.length);
  assert.equal(new Set(order).size, order.length);
  assert.deepEqual(order.slice(0, STANDARD_PINNED.length), STANDARD_PINNED);
  assert.deepEqual(
    new Set(order.slice(STANDARD_PINNED.length)),
    new Set(STANDARD_SHUFFLED),
  );
});

void test('only the standard shuffled subset changes position', () => {
  const start = createEnhancedCollectionOrder(() => 0);
  const end = createEnhancedCollectionOrder(() => 0.999999);

  assert.deepEqual(start.slice(0, STANDARD_PINNED.length), STANDARD_PINNED);
  assert.deepEqual(end.slice(0, STANDARD_PINNED.length), STANDARD_PINNED);
  assert.notDeepEqual(
    start.slice(STANDARD_PINNED.length),
    end.slice(STANDARD_PINNED.length),
  );
});
