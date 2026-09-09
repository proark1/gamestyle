import test from 'node:test';
import assert from 'node:assert/strict';
import { bindJoystick } from './joystick';

function pointer(
  target: EventTarget,
  type: string,
  id: number,
  x = 40,
  y = 40,
  extra: object = {},
) {
  const event = new Event(type, { cancelable: true });
  Object.assign(
    event,
    {
      pointerId: id,
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
    },
    extra,
  );
  target.dispatchEvent(event);
  return event;
}

function fixture() {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    defaultView: win,
    hidden: false,
  });
  const attributes = new Map<string, string>(),
    styles = new Map<string, string>(),
    captured = new Set<number>();
  let rect = { left: 10, top: 10, width: 86, height: 86 },
    reads = 0;
  let vector = { x: 0, z: 0 };
  const pad = Object.assign(new EventTarget(), {
    ownerDocument: doc,
    getBoundingClientRect: () => {
      reads++;
      return rect;
    },
    style: {
      setProperty: (key: string, value: string) => styles.set(key, value),
    },
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
    setPointerCapture: (id: number) => {
      captured.add(id);
    },
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => {
      captured.delete(id);
    },
  });
  const dispose = bindJoystick(pad as unknown as HTMLElement, (x, z) => {
    vector = { x, z };
  });
  return {
    win,
    doc,
    pad,
    attributes,
    styles,
    captured,
    dispose,
    vector: () => vector,
    reads: () => reads,
    movePad: () => {
      rect = { left: 0, top: 90, width: 78, height: 78 };
    },
  };
}

void test('held drag survives repeated viewport changes without jumping when the pad moves', (t) => {
  const f = fixture();
  t.after(f.dispose);
  assert.equal(pointer(f.pad, 'pointerdown', 7, 22, 33).defaultPrevented, true);
  assert.deepEqual(f.vector(), { x: 0, z: 0 }); // No jump toward the centre on contact.
  pointer(f.win, 'pointermove', 7, 52, 18);
  const held = f.vector();
  assert.ok(held.x > 0.8 && held.z < -0.4);
  f.movePad();
  for (let i = 0; i < 120; i++) f.win.dispatchEvent(new Event('resize'));
  assert.deepEqual(f.vector(), held);
  pointer(f.win, 'pointermove', 7, 52, 18); // Same physical finger, new pad bounds.
  assert.deepEqual(f.vector(), held);
  assert.equal(f.reads(), 1); // No forced layout on every pointer sample.
  pointer(f.win, 'pointerup', 7, 52, 18);
  assert.deepEqual(f.vector(), { x: 0, z: 0 });
  assert.equal(f.attributes.has('data-active'), false);
});

void test('drag outside the pad survives capture loss and stops on release outside it', (t) => {
  const f = fixture();
  t.after(f.dispose);
  pointer(f.pad, 'pointerdown', 2);
  f.captured.clear();
  pointer(f.pad, 'lostpointercapture', 2);
  assert.equal(
    pointer(f.win, 'pointermove', 2, 400, 40).defaultPrevented,
    true,
  );
  assert.deepEqual(f.vector(), { x: 1, z: 0 });
  pointer(f.win, 'pointerup', 2, 400, 40);
  pointer(f.win, 'pointermove', 2, 500, 40);
  assert.deepEqual(f.vector(), { x: 0, z: 0 });
});

void test('a second finger cannot steal or stop the walking finger', (t) => {
  const f = fixture();
  t.after(f.dispose);
  pointer(f.pad, 'pointerdown', 10);
  pointer(f.win, 'pointermove', 10, 80, 40);
  pointer(f.pad, 'pointerdown', 11, 80, 90);
  assert.equal(
    pointer(f.win, 'pointermove', 11, 40, 100).defaultPrevented,
    false,
  );
  pointer(f.win, 'pointerup', 11);
  pointer(f.win, 'pointercancel', 11);
  assert.deepEqual(f.vector(), { x: 1, z: 0 });
  pointer(f.win, 'pointermove', 10, 40, 0);
  assert.deepEqual(f.vector(), { x: 0, z: -1 });
  pointer(f.win, 'pointerup', 10);
  assert.deepEqual(f.vector(), { x: 0, z: 0 });
});

void test('cancel, backgrounding, focus loss and unmount always stop held movement', () => {
  for (const event of [
    'pointercancel',
    'blur',
    'pagehide',
    'visibilitychange',
    'unmount',
  ]) {
    const f = fixture();
    pointer(f.pad, 'pointerdown', 3);
    pointer(f.win, 'pointermove', 3, 40, 0);
    if (event === 'pointercancel') pointer(f.win, event, 3);
    else if (event === 'visibilitychange') {
      f.doc.hidden = true;
      f.doc.dispatchEvent(new Event(event));
    } else if (event === 'unmount') f.dispose();
    else f.win.dispatchEvent(new Event(event));
    assert.deepEqual(f.vector(), { x: 0, z: 0 }, event);
    assert.equal(f.captured.size, 0, event);
    pointer(f.win, 'pointermove', 3, 80, 40);
    assert.deepEqual(
      f.vector(),
      { x: 0, z: 0 },
      `stale contact after ${event}`,
    );
    f.dispose();
  }
});

void test('a failed capture still tracks movement; long-press menus cannot interrupt it', (t) => {
  const f = fixture();
  t.after(f.dispose);
  f.pad.setPointerCapture = () => {
    throw new Error('Capture unavailable');
  };
  pointer(f.pad, 'pointerdown', 5);
  pointer(f.win, 'pointermove', 5, 40, 0);
  const menu = new Event('contextmenu', { cancelable: true });
  f.pad.dispatchEvent(menu);
  assert.equal(menu.defaultPrevented, true);
  f.doc.dispatchEvent(new Event('visibilitychange')); // Still visible.
  assert.deepEqual(f.vector(), { x: 0, z: -1 });
  pointer(f.win, 'pointerup', 5);
  assert.deepEqual(f.vector(), { x: 0, z: 0 });
});

void test('mouse fallback ignores secondary buttons and recovers from a release outside the window', (t) => {
  const f = fixture();
  t.after(f.dispose);
  pointer(f.pad, 'pointerdown', 1, 40, 40, { pointerType: 'mouse', button: 2 });
  assert.equal(f.attributes.has('data-active'), false);
  pointer(f.pad, 'pointerdown', 1, 40, 40, { pointerType: 'mouse' });
  pointer(f.win, 'pointermove', 1, 80, 40, { pointerType: 'mouse' });
  assert.deepEqual(f.vector(), { x: 1, z: 0 });
  pointer(f.win, 'pointermove', 1, 80, 40, {
    pointerType: 'mouse',
    buttons: 0,
  });
  assert.deepEqual(f.vector(), { x: 0, z: 0 });
});
