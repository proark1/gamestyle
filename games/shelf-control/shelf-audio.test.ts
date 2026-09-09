import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SiteAudio } from '../../shared/audio/player';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';
import { ShelfAudio } from './audio';
import { audioProfile, SHELF_DEFAULT_AUDIO } from './audio-profile';
import {
  freshShop,
  shelfPlayer,
  shelfAction,
  shelfSnapshot,
} from './simulation';

void test('bundled music and varied soles are playable PCM with headroom and a smooth music seam', () => {
  const recordings = new Set<string>();
  for (const [id, cue] of Object.entries(SHELF_DEFAULT_AUDIO)) {
    const bytes = readFileSync(
      new URL(`../../public${cue.url}`, import.meta.url),
    );
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt16LE(20), 1);
    assert.equal(bytes.readUInt16LE(34), 16);
    const channels = bytes.readUInt16LE(22),
      rate = bytes.readUInt32LE(24);
    const frames = (bytes.length - 44) / (channels * 2);
    let peak = 0,
      energy = 0;
    for (let i = 44; i < bytes.length; i += 2) {
      const value = bytes.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
    }
    assert.ok(peak < 0.7, `${id} should have headroom`);
    assert.ok(
      Math.sqrt(energy / (frames * channels)) > 0.025,
      `${id} is not silent`,
    );
    if (cue.loop) {
      assert.ok(
        frames / rate >= 30,
        'the score should not repeat every few seconds',
      );
      for (let c = 0; c < channels; c++) {
        const first = bytes.readInt16LE(44 + c * 2);
        const last = bytes.readInt16LE(bytes.length - channels * 2 + c * 2);
        assert.ok(
          Math.abs(first - last) / 32768 < 0.01,
          'no click at the loop join',
        );
      }
    } else {
      assert.ok(frames / rate <= 0.35, 'steps end before the next foot lands');
      recordings.add(bytes.toString('base64'));
    }
  }
  assert.equal(recordings.size, 4, 'four different foot contacts');
  const manifest = audioProfile.prepareManifest!({
    settings: DEFAULT_SETTINGS,
    cues: {},
  });
  assert.ok(manifest.cues['music.showroom']);
  assert.equal(
    Object.keys(manifest.cues)[0],
    'music.showroom',
    'preload the score first',
  );
  assert.ok(
    manifest.cues['music.showroom'].volume * DEFAULT_SETTINGS.music <= 0.1,
  );
  assert.equal(audioProfile.attenuation!('step.floor', 7), 0);
});

void test('footsteps follow visible travel only, stay quiet, and reset between rounds', (t) => {
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: new EventTarget(),
  });
  t.mock.method(SiteAudio.prototype, 'refresh', async () => {});
  const music = t.mock.method(SiteAudio.prototype, 'setLoop', () => {});
  const steps = t.mock.method(SiteAudio.prototype, 'variant', () => {});
  const events = t.mock.method(SiteAudio.prototype, 'play', () => {});
  const tracked = t.mock.method(SiteAudio.prototype, 'trackSources', () => {});
  const audio = new ShelfAudio();
  t.after(() => {
    audio.dispose();
    if (previousDocument)
      Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  assert.deepEqual(music.mock.calls[0].arguments, ['music', 'music.showroom']);
  const world = freshShop(100_000);
  world.players = ['a', 'b', 'c', 'd'].map((id) =>
    shelfPlayer(id, id, world.clock),
  );
  shelfAction(world, 'a', { type: 'start' }, 'a');
  const hidden = shelfSnapshot(world, 'ABC234', 'a', 'a', 0);
  audio.update(hidden);
  assert.equal(steps.mock.callCount(), 0);
  assert.equal(events.mock.callCount(), 0);
  assert.equal(tracked.mock.calls.at(-1)!.arguments[0]!.size, 0);
  const visible = shelfSnapshot(world, 'ABC234', 'a', 'b', 0);
  const figure = visible.figures[0];
  visible.figures = [figure];
  visible.guard = null;
  audio.update(visible);
  for (let i = 0; i < 5; i++) audio.update(visible);
  assert.equal(steps.mock.callCount(), 0, 'stationary snapshots make no steps');
  for (let i = 0; i < 4; i++) {
    figure.x += 0.3;
    audio.update(visible);
  }
  assert.equal(steps.mock.callCount(), 1);
  const [cue, gain, , source] = steps.mock.calls[0].arguments;
  assert.equal(cue, 'step.floor');
  assert.ok(gain! >= 0.2 && gain! <= 0.24);
  assert.equal(source, figure.id);
  figure.x += 8;
  audio.update(visible);
  assert.equal(steps.mock.callCount(), 1, 'reconnect jumps do not stomp');
  audio.update({ ...visible, figures: [] });
  figure.x += 1.3;
  audio.update(visible);
  assert.equal(
    steps.mock.callCount(),
    1,
    'newly visible figures do not announce themselves',
  );
  visible.events = [
    { id: 1, at: world.clock, kind: 'switch', material: 'prop', x: 0, z: 0 },
  ];
  audio.update(visible);
  audio.update(visible);
  assert.equal(
    events.mock.callCount(),
    1,
    'snapshot repeats do not replay effects',
  );
  audio.update({ ...visible, round: visible.round + 1 });
  assert.equal(
    events.mock.callCount(),
    2,
    'event IDs can restart in a new round',
  );
  audio.update(hidden);
  assert.equal(
    tracked.mock.calls.at(-1)!.arguments[0]!.size,
    0,
    'hidden views release positional sounds',
  );
});

void test('music starts without a published library, shares mute, and suspends in hidden tabs', async (t) => {
  const descriptors = new Map(
    ['document', 'AudioContext'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const gains: { value: number; setTargetAtTime: (v: number) => void }[] = [];
  const sources: { loop: boolean; started: boolean }[] = [];
  let suspended = false,
    closed = false;
  const node = () => ({ connect() {}, disconnect() {} });
  class Context {
    state = 'running';
    currentTime = 0;
    destination = node();
    resume() {
      suspended = false;
      return Promise.resolve();
    }
    suspend() {
      suspended = true;
      return Promise.resolve();
    }
    close() {
      closed = true;
      return Promise.resolve();
    }
    createGain() {
      const gain = {
        value: 0,
        setTargetAtTime(v: number) {
          this.value = v;
        },
      };
      gains.push(gain);
      return { ...node(), gain };
    }
    createDynamicsCompressor() {
      return node();
    }
    decodeAudioData() {
      return Promise.resolve({});
    }
    createBufferSource() {
      const source = {
        ...node(),
        loop: false,
        started: false,
        start() {
          this.started = true;
        },
        stop() {},
      };
      sources.push(source);
      return source;
    }
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: doc,
  });
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: Context,
  });
  t.mock.method(
    globalThis,
    'fetch',
    async (url: Parameters<typeof fetch>[0]) => {
      const path =
        typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      return path.startsWith('/api/')
        ? new Response(null, { status: 503 })
        : new Response(new ArrayBuffer(8));
    },
  );
  const audio = new ShelfAudio();
  t.after(() => {
    audio.dispose();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  assert.equal(sources.length, 0, 'autoplay waits for interaction');
  audio.unlock();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sources.filter((s) => s.loop && s.started).length, 1);
  audio.unlock();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sources.length, 1, 'repeated gestures do not layer music');
  audio.mute(true);
  assert.equal(gains[0].value, 0);
  audio.mute(false);
  assert.equal(gains[0].value, 0.8);
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.ok(suspended);
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(suspended, false);
  audio.dispose();
  assert.ok(closed);
});
