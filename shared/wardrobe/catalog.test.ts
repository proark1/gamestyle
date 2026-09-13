import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOALS, ITEMS, SLOTS } from './catalog';
import { parseLook } from './look';

void test('every item has its own id, a real slot, and either a price or a goal', () => {
  const ids = ITEMS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const item of ITEMS) {
    assert.ok(SLOTS.includes(item.slot), `${item.id} has a real slot`);
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.notEqual(
      item.price === undefined,
      item.goal === undefined,
      `${item.id} has a price or a goal, not both`,
    );
    if (item.price !== undefined)
      assert.ok(Number.isInteger(item.price) && item.price > 0, item.id);
    if (item.goal !== undefined)
      assert.ok(
        GOALS.some((goal) => goal.id === item.goal),
        `${item.id} unlocks through a real goal`,
      );
  }
  for (const slot of SLOTS)
    assert.ok(
      ITEMS.filter((item) => item.slot === slot).length >= 3,
      `${slot} offers a choice`,
    );
  for (const goal of GOALS)
    assert.ok(
      ITEMS.some((item) => item.goal === goal.id),
      `${goal.id} unlocks something`,
    );
});

void test('a look keeps only real items in their own slots', () => {
  assert.deepEqual(parseLook({ hat: 'top-hat', face: 'star-shades' }), {
    hat: 'top-hat',
    face: 'star-shades',
  });
  assert.deepEqual(
    parseLook({
      hat: 'top-hat',
      top: 'top-hat',
      legs: 42,
      shoes: 'retired-item',
      cape: 'hero-cape',
    }),
    { hat: 'top-hat' },
  );
  const inherited = Object.create({ hat: 'top-hat' }) as object;
  for (const junk of [
    undefined,
    null,
    'top-hat',
    ['top-hat'],
    {},
    { hat: '' },
    inherited,
  ])
    assert.equal(parseLook(junk), undefined);
});
