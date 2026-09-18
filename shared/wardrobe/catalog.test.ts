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

void test('admin wardrobe state helpers allow adding coins, unlocking all items, and reset', async () => {
  const {
    adminAddCoins,
    adminUnlockAllItems,
    adminResetWardrobe,
    wardrobeSnapshot,
    DEFAULT_UNLOCKED,
  } = await import('./wardrobe-state');

  adminResetWardrobe();
  const initial = wardrobeSnapshot();
  assert.equal(initial.unlockedItems.length, DEFAULT_UNLOCKED.length);

  adminAddCoins(500);
  assert.equal(wardrobeSnapshot().coins, initial.coins + 500);

  adminUnlockAllItems();
  const allUnlocked = wardrobeSnapshot();
  for (const item of ITEMS) {
    assert.ok(
      allUnlocked.unlockedItems.includes(item.id),
      `${item.id} is unlocked`,
    );
  }

  adminResetWardrobe();
  const reset = wardrobeSnapshot();
  assert.equal(reset.coins, initial.coins);
  assert.equal(reset.unlockedItems.length, DEFAULT_UNLOCKED.length);
});

void test('players start with nothing equipped, and an untouched old starter outfit reads as empty', async () => {
  const { serverWardrobeSnapshot, storedLook } =
    await import('./wardrobe-state');
  assert.deepEqual(serverWardrobeSnapshot().look, {});
  const oldStarter = {
    hat: 'bobble-beanie',
    top: 'striped-tee',
    legs: 'denim-overalls',
    shoes: 'rain-boots',
    face: 'round-glasses',
  };
  assert.deepEqual(storedLook(oldStarter), {}, 'the untouched outfit clears');
  const chosen = { ...oldStarter, hat: 'top-hat' };
  assert.deepEqual(storedLook(chosen), chosen, 'a changed outfit stays');
  const partial = { hat: 'bobble-beanie', face: 'round-glasses' };
  assert.deepEqual(storedLook(partial), partial, 'a trimmed outfit stays');
  assert.deepEqual(storedLook('junk'), {}, 'junk reads as empty');
});
