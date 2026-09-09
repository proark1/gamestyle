import { audioProfile as deliveryAudioProfile } from './profile';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { SiteAudio } from '../../../shared/audio/player';
import { DEFAULT_SETTINGS } from '../../../shared/audio/types';

void test('delivery ambience blends its seam; positional Foley softens with distance and cleans up on reset', async () => {
  const original = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    context: globalThis.AudioContext,
  };
  const filters: { frequency: { value: number }; disconnected: boolean }[] = [];
  const sources: { playbackRate: { value: number }; stopped: boolean }[] = [];
  let blended = 0;
  const input = {
    sampleRate: 100,
    length: 100,
    numberOfChannels: 2,
    getChannelData: () => new Float32Array(100).fill(0.2),
  };
  class Context {
    state = 'running';
    currentTime = 0;
    destination = {};
    async resume() {}
    async close() {}
    createGain() {
      return {
        gain: { value: 1, setTargetAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
    createDynamicsCompressor() {
      return { connect() {} };
    }
    createStereoPanner() {
      return { pan: { value: 0 }, connect() {}, disconnect() {} };
    }
    createBiquadFilter() {
      const filter = {
        frequency: { value: 0 },
        Q: { value: 0 },
        type: '',
        disconnected: false,
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
      };
      filters.push(filter);
      return filter;
    }
    createBufferSource() {
      const source = {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        stopped: false,
        onended: null as (() => void) | null,
        connect() {},
        disconnect() {},
        start() {},
        stop() {
          this.stopped = true;
          this.onended?.();
        },
      };
      sources.push(source);
      return source;
    }
    async decodeAudioData() {
      return input;
    }
    createBuffer(_channels: number, length: number) {
      blended++;
      assert.ok(length < input.length);
      return { getChannelData: () => new Float32Array(length) };
    }
  }
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  globalThis.fetch = async (url) =>
    (typeof url === 'string'
      ? url
      : url instanceof URL
        ? url.href
        : url.url
    ).includes('manifest=1')
      ? Response.json({
          settings: DEFAULT_SETTINGS,
          cues: {
            'ambience.ridge': {
              url: '/ridge.mp3',
              volume: 0.5,
              loop: true,
              category: 'ambience',
            },
            'sofa.carry.1': {
              url: '/carry.mp3',
              volume: 0.5,
              loop: false,
              category: 'event',
            },
            'goat.bell.1': {
              url: '/bell.mp3',
              volume: 0.5,
              loop: false,
              category: 'event',
            },
          },
        })
      : new Response(new Uint8Array(10));
  const sound = new SiteAudio('uphill-delivery', deliveryAudioProfile);
  try {
    await sound.refresh();
    sound.unlock();
    await setImmediate();
    sound.setLoop('ridge', 'ambience.ridge', 0.4);
    await setImmediate();
    assert.equal(blended, 1);
    sound.listen({ x: 0, y: 0, z: 0 });
    sound.play('sofa.carry.1', 1, { x: 1, z: 0 });
    await setImmediate();
    sound.play('goat.bell.1', 1, { x: 19, z: 0 });
    await setImmediate();
    assert.equal(filters.length, 2);
    assert.ok(filters[1].frequency.value < filters[0].frequency.value);
    assert.ok(
      sources.at(-1)!.playbackRate.value >= 0.98 &&
        sources.at(-1)!.playbackRate.value <= 1.02,
    );
    const count = sources.length;
    sound.enabled = false;
    sound.play('sofa.carry.1', 1, { x: 0, z: 0 });
    await setImmediate();
    assert.equal(sources.length, count);
    sound.reset();
    assert.ok(sources.every((source) => source.stopped));
    assert.ok(filters.every((filter) => filter.disconnected));
  } finally {
    sound.dispose();
    globalThis.document = original.document;
    globalThis.fetch = original.fetch;
    globalThis.AudioContext = original.context;
  }
});
