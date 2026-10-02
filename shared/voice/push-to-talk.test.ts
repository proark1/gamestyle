import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindPushToTalk } from './push-to-talk';

function setup() {
  const target = Object.assign(new EventTarget(), {
    document: Object.assign(new EventTarget(), { hidden: false }),
  });
  const calls: boolean[] = [];
  const binding = bindPushToTalk(target as unknown as Window, 'KeyT', (v) =>
    calls.push(v),
  );
  const key = (type: string, extra: object = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      code: 'KeyT',
      ...extra,
    });
    target.dispatchEvent(event);
    return event;
  };
  return { target, calls, binding, key };
}
void test('overlapping pointer and keyboard holds transmit until the last release', () => {
  const { binding, key, calls } = setup();
  binding.press('pointer:1');
  key('keydown');
  binding.release('pointer:1');
  assert.deepEqual(calls, [true]);
  key('keyup');
  assert.deepEqual(calls, [true, false]);
  binding.dispose();
});
void test('repeat, modifiers, and composition never start transmission', () => {
  const { binding, key, calls } = setup();
  key('keydown', { repeat: true });
  key('keydown', { ctrlKey: true });
  key('keydown', { isComposing: true });
  assert.deepEqual(calls, []);
  assert.equal(key('keydown').defaultPrevented, true);
  key('keydown', { repeat: true });
  assert.deepEqual(calls, [true]);
  key('keyup');
  binding.dispose();
});
void test('blur and hidden tabs clear all held inputs and require a fresh press', () => {
  const { target, binding, calls, key } = setup();
  key('keydown');
  target.dispatchEvent(new Event('blur'));
  key('keydown', { repeat: true });
  assert.deepEqual(calls, [true, false]);
  key('keyup');
  key('keydown');
  target.document.hidden = true;
  target.document.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(calls, [true, false, true, false]);
  binding.dispose();
});
