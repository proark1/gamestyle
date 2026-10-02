import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  addAdventureVisit,
  parseAdventure,
  pickAdventure,
  adventureSnapshot,
  recordAdventureVisit,
  recordAdventureLook,
  acknowledgeAdventure,
  subscribeAdventure,
} from './adventure-state';

void test('corrupt, missing, and future storage safely starts empty', () => {
  for (const raw of [
    null,
    '{',
    'null',
    '[]',
    '{"version":2,"visited":["basketball"]}',
  ]) {
    assert.deepEqual(parseAdventure(raw).visited, []);
  }
});
void test('persisted progress validates, deduplicates, and clamps acknowledgement', () => {
  const state = parseAdventure(
    JSON.stringify({
      version: 1,
      visited: ['basketball', 'basketball', '../admin', 42, 'wrong-floor'],
      styled: true,
      acknowledged: 999,
    }),
  );
  assert.deepEqual(state.visited, ['basketball', 'wrong-floor']);
  assert.equal(state.acknowledged, 3);
  assert.equal(
    parseAdventure('{"version":1,"styled":"true","acknowledged":-4}').styled,
    false,
  );
});
void test('repeat arrivals do not award duplicate stamps', () => {
  const state = addAdventureVisit(parseAdventure(null), 'basketball');
  assert.equal(addAdventureVisit(state, 'basketball'), state);
  assert.equal(addAdventureVisit(state, '/admin'), state);
  assert.deepEqual(addAdventureVisit(state, 'wrong-floor').visited, [
    'basketball',
    'wrong-floor',
  ]);
});
void test('shuffle favors unvisited games and avoids the last reveal', () => {
  const slugs = ['a', 'b', 'c'];
  assert.equal(pickAdventure(slugs, ['a'], 'b', 0), 'c');
  assert.equal(pickAdventure(slugs, slugs, 'a', 0), 'b');
  assert.equal(pickAdventure(['a'], [], 'a', 0), 'a');
  assert.equal(pickAdventure([], [], null, 0), undefined);
});

void test('progress survives writes, notifies subscribers, and retains session progress when storage fails', () => {
  let stored: string | null = null;
  let blocked = false;
  let notifications = 0;
  const handlers = new Map<string, () => void>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => {
          if (blocked) throw new Error('Storage unavailable');
          stored = value;
        },
      },
      addEventListener: (name: string, handler: () => void) =>
        handlers.set(name, handler),
      removeEventListener: (name: string) => handlers.delete(name),
    },
  });
  let unsubscribe = () => {};
  try {
    unsubscribe = subscribeAdventure(() => {
      notifications++;
    });
    recordAdventureVisit('basketball');
    recordAdventureVisit('basketball');
    assert.equal(notifications, 1);
    assert.deepEqual(parseAdventure(stored).visited, ['basketball']);
    recordAdventureLook();
    acknowledgeAdventure();
    assert.equal(parseAdventure(stored).acknowledged, 2);
    blocked = true;
    recordAdventureVisit('wrong-floor');
    handlers.get('pageshow')?.();
    assert.equal(adventureSnapshot().persistent, false);
    assert.deepEqual(adventureSnapshot().visited, [
      'basketball',
      'wrong-floor',
    ]);
  } finally {
    unsubscribe();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
