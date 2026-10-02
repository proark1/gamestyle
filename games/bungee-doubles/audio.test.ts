import test from 'node:test';
import assert from 'node:assert/strict';
import { BungeeDoublesSound } from './audio';
import { applyAudioPreferences } from '../../shared/audio/preferences';
import { freshBungeeWorld } from './simulation';

void test('effects respect volume, mute, event deduplication, visibility and disposal', async (t) => {
  class Parameter {
    value = 1;
    setValueAtTime(value: number) {
      this.value = value;
    }
    setTargetAtTime(value: number) {
      this.value = value;
    }
    exponentialRampToValueAtTime(value: number) {
      this.value = value;
    }
  }
  class Node {
    gain = new Parameter();
    frequency = new Parameter();
    onended: (() => void) | null = null;
    connect() {}
    disconnect() {}
    start() {}
    stop() {
      this.onended?.();
    }
  }
  const contexts: Context[] = [];
  class Context {
    currentTime = 0;
    state = 'running';
    destination = new Node();
    gains: Node[] = [];
    oscillators: Node[] = [];
    constructor() {
      contexts.push(this);
    }
    createGain() {
      const node = new Node();
      this.gains.push(node);
      return node;
    }
    createOscillator() {
      const node = new Node();
      this.oscillators.push(node);
      return node;
    }
    createDynamicsCompressor() {
      return new Node();
    }
    async resume() {
      this.state = 'running';
    }
    async suspend() {
      this.state = 'suspended';
    }
    async close() {
      this.state = 'closed';
    }
  }
  const document = Object.assign(new EventTarget(), { hidden: false });
  const replacements = {
    document,
    window: { AudioContext: Context },
    AudioContext: Context,
  };
  const originals = Object.keys(replacements).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries(replacements))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 404 }),
  );
  let sound: BungeeDoublesSound | undefined;
  try {
    applyAudioPreferences({ volume: 0.25, music: false });
    sound = new BungeeDoublesSound();
    sound.unlock();
    assert.equal(contexts.length, 2);
    const procedural = contexts[1];
    assert.equal(procedural.gains[0].gain.value, 0.25);
    const w = freshBungeeWorld(0);
    w.events.push({ id: 1, type: 'racket_hit', text: 'Hit' });
    sound.update(w, 'you');
    sound.update(w, 'you');
    assert.equal(procedural.oscillators.length, 1);
    applyAudioPreferences({ volume: 0, music: false });
    assert.equal(procedural.gains[0].gain.value, 0);
    w.events.push({ id: 2, type: 'racket_hit', text: 'Hit' });
    sound.update(w, 'you');
    assert.equal(procedural.oscillators.length, 1);
    applyAudioPreferences({ volume: 1, music: true });
    sound.enabled = false;
    assert.equal(procedural.gains[0].gain.value, 0);
    sound.enabled = true;
    assert.equal(procedural.gains[0].gain.value, 1);
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.ok(contexts.every((ctx) => ctx.state === 'suspended'));
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.ok(contexts.every((ctx) => ctx.state === 'running'));
    sound.dispose();
    assert.ok(contexts.every((ctx) => ctx.state === 'closed'));
    sound.unlock();
    assert.equal(contexts.length, 2, 'disposed audio cannot be resurrected');
    await Promise.resolve();
  } finally {
    sound?.dispose();
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
