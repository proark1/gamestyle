import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from './catalog';
import { toggleTryOn } from './fitting';

const beanie = ITEMS.find((item) => item.id === 'bobble-beanie')!;
const cone = ITEMS.find((item) => item.id === 'party-cone')!;

void test('trying on a locked hat preserves the saved outfit and other preview slots', () => {
  const look = { hat: beanie.id };
  const draft = { face: 'star-shades' };
  const fitted = toggleTryOn(look, draft, cone);
  assert.deepEqual(fitted, { ...draft, hat: cone.id });
  assert.deepEqual(toggleTryOn(look, fitted, cone), draft);
  assert.deepEqual(look, { hat: beanie.id });
  assert.deepEqual(draft, { face: 'star-shades' });
});

void test('an equipped hat can be hidden temporarily and restored without saving', () => {
  const look = { hat: beanie.id };
  const hidden = toggleTryOn(look, {}, beanie);
  assert.deepEqual(hidden, { hat: null });
  assert.deepEqual(toggleTryOn(look, hidden, beanie), {});
  assert.deepEqual(toggleTryOn(look, { hat: cone.id }, beanie), {});
});

void test('undoing an unowned try-on restores a bare head', () => {
  const fitted = toggleTryOn({}, {}, cone);
  assert.deepEqual(fitted, { hat: cone.id });
  assert.deepEqual(toggleTryOn({}, fitted, cone), {});
});
