import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SiteAudio } from './player';
import { DEFAULT_SETTINGS } from './types';
import type { AudioManifest } from './types';

void test('alternate takes avoid repeats, speech never overlaps, conversation ducks loops and music falls back until generated', async (t) => {
  const oldDocument = globalThis.document,
    oldContext = globalThis.AudioContext,
    oldFetch = globalThis.fetch;
  let now = 5000;
  t.mock.method(performance, 'now', () => now);
  const played: string[] = [],
    sources: {
      buffer: { label: string } | null;
      onended: (() => void) | null;
      stop(): void;
    }[] = [];
  const gains: { value: number; setTargetAtTime(v: number): void }[] = [];
  let closed = false;
  class Context {
    state = 'running';
    currentTime = 0;
    destination = {};
    createGain() {
      const gain = {
        value: 1,
        setTargetAtTime(v: number) {
          this.value = v;
        },
      };
      gains.push(gain);
      return { gain, connect() {}, disconnect() {} };
    }
    createDynamicsCompressor() {
      return { connect() {} };
    }
    createBufferSource() {
      const source = {
        buffer: null as { label: string } | null,
        onended: null as (() => void) | null,
        loop: false,
        connect() {},
        disconnect() {},
        start() {
          played.push(source.buffer!.label);
        },
        stop() {
          source.onended?.();
        },
      };
      sources.push(source);
      return source;
    }
    async decodeAudioData(data: ArrayBuffer) {
      return { label: new TextDecoder().decode(data) };
    }
    async resume() {}
    async close() {
      closed = true;
    }
  }
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  const cues: AudioManifest['cues'] = {
    'music.challenge': {
      url: 'challenge',
      volume: 1,
      category: 'music',
      loop: true,
    },
    'prop.duck.use.alt1': {
      url: 'duck-one',
      volume: 1,
      category: 'event',
      loop: false,
      variantOf: 'prop.duck.use',
    },
    'prop.duck.use.alt2': {
      url: 'duck-two',
      volume: 1,
      category: 'event',
      loop: false,
      variantOf: 'prop.duck.use',
    },
    'speech.crew.lift': {
      url: 'lift-voice',
      volume: 1,
      category: 'speech',
      loop: false,
    },
    'speech.crew.spill': {
      url: 'spill-voice',
      volume: 1,
      category: 'speech',
      loop: false,
    },
  };
  globalThis.fetch = async (url) =>
    typeof url === 'string' && url.includes('manifest')
      ? Response.json({ settings: DEFAULT_SETTINGS, cues })
      : new Response(
          typeof url === 'string'
            ? url
            : url instanceof URL
              ? url.href
              : url.url,
        );
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  const audio = new SiteAudio('chaos');
  try {
    await audio.refresh();
    audio.unlock();
    audio.atmosphere('lastCall');
    await flush();
    assert.deepEqual(played, ['challenge']);
    audio.play('prop.duck.use');
    await flush();
    now += 200;
    audio.play('prop.duck.use');
    await flush();
    assert.notEqual(played[1], played[2]);
    assert.ok(
      played.slice(1).every((id) => id.startsWith('duck-')),
      'a generated alternate works even before the base take exists',
    );
    audio.play('speech.crew.lift');
    await flush();
    now += 3000;
    audio.play('speech.crew.spill');
    await flush();
    assert.equal(
      played.filter((id) => id.endsWith('voice')).length,
      1,
      'a long line cannot overlap another after its cooldown',
    );
    assert.equal(gains[1].value, DEFAULT_SETTINGS.music * 0.45);
    audio.duck(true);
    await flush();
    assert.equal(gains[1].value, DEFAULT_SETTINGS.music * 0.25);
    now += 3000;
    audio.play('speech.crew.spill');
    await flush();
    assert.equal(
      played.filter((id) => id.endsWith('voice')).length,
      1,
      'player conversation suppresses game chatter',
    );
    audio.duck(false);
    audio.play('speech.crew.spill');
    await flush();
    assert.equal(played.at(-1), 'spill-voice');
    sources.at(-1)!.stop();
    assert.equal(gains[1].value, DEFAULT_SETTINGS.music);
    cues['music.lastCall'] = {
      url: 'last-call',
      volume: 1,
      category: 'music',
      loop: true,
    };
    await audio.refresh();
    await flush();
    assert.equal(played.at(-1), 'last-call');
    const count = played.length;
    audio.atmosphere('lastCall');
    await audio.refresh();
    await flush();
    assert.equal(
      played.length,
      count,
      'same phase and manifest do not restart music',
    );
    audio.dispose();
    assert.equal(closed, true);
  } finally {
    audio.dispose();
    globalThis.document = oldDocument;
    globalThis.AudioContext = oldContext;
    globalThis.fetch = oldFetch;
  }
});

void test('playback unlocks on a gesture, replaces loops once, suppresses rapid duplicates and disposes', async () => {
  const previousDocument = globalThis.document,
    previousContext = globalThis.AudioContext,
    previousFetch = globalThis.fetch;
  let started = 0,
    stopped = 0,
    closed = false,
    version = 1;
  let cueVolume = 1;
  const events = new Map<string, unknown>(),
    gains: { value: number; setTargetAtTime(value: number): void }[] = [];
  class FakeContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    createGain() {
      const gain = {
        value: 1,
        setTargetAtTime(value: number) {
          this.value = value;
        },
      };
      gains.push(gain);
      return { gain, connect() {}, disconnect() {} };
    }
    createDynamicsCompressor() {
      return { connect() {} };
    }
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect() {},
        disconnect() {},
        start() {
          started++;
        },
        stop() {
          stopped++;
        },
        onended: null,
      };
    }
    async decodeAudioData() {
      return {};
    }
    async resume() {}
    async close() {
      closed = true;
    }
  }
  globalThis.document = {
    addEventListener(name: string, fn: unknown) {
      events.set(name, fn);
    },
    removeEventListener(name: string) {
      events.delete(name);
    },
  } as unknown as Document;
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext;
  globalThis.fetch = async (url) =>
    typeof url === 'string' && url.includes('manifest')
      ? Response.json({
          settings: DEFAULT_SETTINGS,
          cues: {
            'music.menu': {
              url: `/music-${version}.mp3`,
              volume: cueVolume,
              category: 'music',
              loop: true,
            },
            'material.brick.place': {
              url: '/brick.mp3',
              volume: cueVolume,
              category: 'material',
              loop: false,
            },
          },
        })
      : new Response(new Uint8Array(64));
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  let audio: SiteAudio | undefined;
  try {
    audio = new SiteAudio('chaos');
    await audio.refresh();
    audio.atmosphere('menu');
    await flush();
    assert.equal(started, 0);
    audio.unlock();
    await flush();
    assert.equal(started, 1);
    audio.atmosphere('menu');
    audio.unlock();
    await flush();
    assert.equal(started, 1);
    version++;
    await audio.refresh();
    await flush();
    assert.equal(started, 2);
    assert.equal(stopped, 1);
    cueVolume = 0.25;
    await audio.refresh();
    await flush();
    assert.equal(started, 2, 'volume updates must not restart a playing loop');
    assert.equal(gains[2].value, 0.25 * DEFAULT_SETTINGS.music);
    audio.play('material.brick.place');
    audio.play('material.brick.place');
    await flush();
    assert.equal(started, 3);
    assert.equal(gains[3].value, 0.25 * DEFAULT_SETTINGS.effects);
    audio.enabled = false;
    assert.equal(gains[0].value, 0);
    audio.play('material.brick.place');
    await flush();
    assert.equal(started, 3);
    audio.dispose();
    assert.equal(events.size, 0);
    assert.equal(closed, true);
  } finally {
    audio?.dispose();
    globalThis.document = previousDocument;
    globalThis.AudioContext = previousContext;
    globalThis.fetch = previousFetch;
  }
});
