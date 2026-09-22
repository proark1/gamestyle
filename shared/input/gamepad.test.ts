import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindGamepad, deadzone, gamepadKeys, DEFAULT_KEYS } from './gamepad';
void test('controller drift is ignored and held/released actions map without repetition', () => {
  assert.equal(deadzone(0.1), 0);
  assert.equal(deadzone(-1), -1);
  assert.deepEqual(
    [...gamepadKeys([0.1, -1], [{ pressed: true }], DEFAULT_KEYS)],
    ['KeyW', 'Space'],
  );
  assert.equal(gamepadKeys([0, 0], [], DEFAULT_KEYS).size, 0);
  assert.ok(gamepadKeys([1, 0], [{ pressed: true }], ['KeyE']).has('KeyE'));
});

void test('party controller input belongs to the game frame and yields to a parent dialog', () => {
  const names = [
    'window',
    'document',
    'navigator',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'KeyboardEvent',
  ] as const;
  const saved = names.map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  const browserWindow = Object.assign(new EventTarget(), {
    parent: {} as object,
  });
  browserWindow.parent = browserWindow;
  const canvas = new EventTarget();
  const emitted: string[] = [];
  canvas.addEventListener('keydown', () => emitted.push('down'));
  canvas.addEventListener('keyup', () => emitted.push('up'));
  let parentFrame = true,
    parentDialog = false;
  let animation: FrameRequestCallback = () => {};
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  const browserDocument = {
    hidden: false,
    activeElement: null,
    querySelector: (selector: string) =>
      selector === 'canvas'
        ? canvas
        : selector === 'iframe.party-game-frame' && parentFrame
          ? {}
          : null,
  };
  class KeyEvent extends Event {
    constructor(type: string, init: { code: string }) {
      super(type);
      Object.assign(this, { code: init.code });
    }
  }
  const values = {
    window: browserWindow,
    document: browserDocument,
    navigator: {
      getGamepads: () => [{ connected: true, axes: [0, 0, 0, 0], buttons }],
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      animation = callback;
      return 1;
    },
    cancelAnimationFrame: () => {},
    KeyboardEvent: KeyEvent,
  };
  let cleanup: (() => void) | undefined;
  try {
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: values[name],
      });
    cleanup = bindGamepad();
    animation(0);
    browserWindow.dispatchEvent(
      new CustomEvent('game:controller-mode', { detail: false }),
    );
    buttons[0].pressed = true;
    animation(16);
    assert.deepEqual(
      emitted,
      [],
      'the parent must not repeat game controller actions',
    );
    parentFrame = false;
    browserWindow.parent = {
      document: {
        querySelector: (selector: string) =>
          selector === '.party-playing' || parentDialog ? {} : null,
      },
    };
    animation(32);
    assert.deepEqual(emitted, ['down']);
    parentDialog = true;
    animation(48);
    assert.deepEqual(
      emitted,
      ['down', 'up'],
      'opening the party dialog releases a held game action',
    );
    animation(64);
    assert.deepEqual(emitted, ['down', 'up']);
  } finally {
    cleanup?.();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
