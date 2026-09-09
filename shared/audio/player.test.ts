import { audioProfile as stackAudioProfile } from '../../games/stack-or-sink/audio/profile';
import { audioProfile as farmAudioProfile } from '../../games/act-natural/audio/profile';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { SiteAudio } from './player';
import { DEFAULT_SETTINGS } from './types';

void test('urgent speech interrupts a playing line, applies its voice rate, and reset cancels queued speech', async () => {
  const oldDocument = globalThis.document,
    oldFetch = globalThis.fetch,
    oldAudio = globalThis.AudioContext;
  const sources: Source[] = [];
  let release: (() => void) | undefined;
  class Node {
    connect() {}
    disconnect() {}
  }
  class Source extends Node {
    playbackRate = { value: 1 };
    onended?: () => void;
    stopped = false;
    start() {}
    stop() {
      this.stopped = true;
      this.onended?.();
    }
  }
  class Context {
    state = 'running';
    currentTime = 0;
    destination = new Node();
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    createDynamicsCompressor() {
      return new Node();
    }
    createGain() {
      return Object.assign(new Node(), {
        gain: { value: 1, setTargetAtTime() {} },
      });
    }
    createBufferSource() {
      const source = new Source();
      sources.push(source);
      return source;
    }
    decodeAudioData() {
      return Promise.resolve({});
    }
  }
  class UrgentAudio extends SiteAudio {
    urgent(id: string) {
      this.interruptSpeech();
      this.play(id);
    }
  }
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  globalThis.fetch = async (url) => {
    const path =
      typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    if (path.includes('manifest=1'))
      return Response.json({
        settings: DEFAULT_SETTINGS,
        cues: Object.fromEntries(
          ['smalltalk', 'giant', 'queued'].map((id) => [
            `speech.${id}`,
            { url: `/${id}.mp3`, category: 'speech', volume: 1, loop: false },
          ]),
        ),
      });
    if (path === '/queued.mp3')
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return new Response(new Uint8Array(10));
  };
  const audio = new UrgentAudio('dont-wake-the-giant', {
    playbackRate: (id) => (id === 'speech.giant' ? 0.84 : 1),
  });
  try {
    await setImmediate();
    audio.unlock();
    await setImmediate();
    audio.play('speech.smalltalk');
    await setImmediate();
    assert.equal(sources.length, 1);
    audio.urgent('speech.giant');
    await setImmediate();
    assert.equal(sources[0].stopped, true);
    assert.equal(sources.length, 2);
    assert.equal(sources[1].playbackRate.value, 0.84);
    audio.urgent('speech.queued');
    await setImmediate();
    assert.ok(release);
    audio.reset();
    release();
    await setImmediate();
    assert.equal(
      sources.length,
      2,
      'queued speech cannot play after a restart',
    );
    assert.equal(sources[1].stopped, true);
  } finally {
    release?.();
    audio.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
    globalThis.AudioContext = oldAudio;
  }
});

void test('farm Web Audio applies distance filtering, natural variation and mute/reset cleanup without changing other games', async () => {
  const oldDocument = globalThis.document,
    oldFetch = globalThis.fetch,
    oldAudio = globalThis.AudioContext;
  const sources: Source[] = [],
    filters: Filter[] = [],
    panners: { pan: ReturnType<typeof parameter> }[] = [];
  let effects = DEFAULT_SETTINGS.effects;
  class Node {
    disconnected = false;
    connections: Node[] = [];
    connect(node: Node) {
      this.connections.push(node);
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  const parameter = () => ({
    value: 0,
    setTargetAtTime(value: number) {
      this.value = value;
    },
  });
  class Source extends Node {
    loop = false;
    playbackRate = { value: 1 };
    onended?: () => void;
    started = false;
    stopped = false;
    start() {
      this.started = true;
    }
    stop() {
      this.stopped = true;
      this.onended?.();
    }
  }
  class Filter extends Node {
    frequency = parameter();
    Q = parameter();
  }
  class Context {
    state = 'running';
    currentTime = 0;
    destination = new Node();
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    createDynamicsCompressor() {
      return new Node();
    }
    createGain() {
      return Object.assign(new Node(), { gain: parameter() });
    }
    createStereoPanner() {
      const node = Object.assign(new Node(), { pan: parameter() });
      panners.push(node);
      return node;
    }
    createBiquadFilter() {
      const node = new Filter();
      filters.push(node);
      return node;
    }
    createBufferSource() {
      const node = new Source();
      sources.push(node);
      return node;
    }
    decodeAudioData() {
      return Promise.resolve({
        numberOfChannels: 1,
        getChannelData: () => Float32Array.of(0.5, -0.5),
      });
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
          settings: { ...DEFAULT_SETTINGS, effects },
          cues: {
            'animal.breath.1': {
              url: '/breath.mp3',
              volume: 0.3,
              category: 'event',
              loop: false,
            },
            'animal.moo.1': {
              url: '/moo.mp3',
              volume: 0.5,
              category: 'event',
              loop: false,
            },
          },
        })
      : new Response(new Uint8Array(10));
  const farm = new SiteAudio('act-natural', farmAudioProfile),
    stack = new SiteAudio('stack-or-sink', stackAudioProfile);
  try {
    await setImmediate();
    farm.unlock();
    stack.unlock();
    await setImmediate();
    farm.listen({ x: 0, z: 0 });
    farm.play('animal.breath.1', 1, { x: 8, z: 0 });
    await setImmediate();
    assert.equal(sources.length, 0, 'distant breathing is inaudible');
    farm.play('animal.breath.1', 1, { x: 1, z: 0 });
    await setImmediate();
    assert.equal(sources.length, 1);
    assert.ok(sources[0].started);
    assert.ok(
      sources[0].playbackRate.value >= 0.98 &&
        sources[0].playbackRate.value <= 1.02,
    );
    const breathGain = filters[0].connections[0] as Node & {
      gain: ReturnType<typeof parameter>;
    };
    assert.ok(
      breathGain.gain.value < 0.03,
      'loud breath is conditioned before the user mix',
    );
    farm.trackSources(new Map([['cow', { x: 20, z: 0 }]]));
    farm.play('animal.moo.1', 1, { x: 20, z: 0 }, 'cow');
    await setImmediate();
    assert.equal(filters.length, 2);
    assert.ok(
      filters[1].frequency.value < filters[0].frequency.value,
      'distant call loses high frequencies',
    );
    stack.play('animal.breath.1', 1, { x: 8, z: 0 });
    await setImmediate();
    assert.equal(sources.length, 3, 'other games retain their existing range');
    assert.equal(filters.length, 2, 'other games retain their existing timbre');
    const mooGain = filters[1].connections[0] as Node & {
      gain: ReturnType<typeof parameter>;
    };
    const distantGain = mooGain.gain.value;
    farm.trackSources(new Map([['cow', { x: -3, z: 0 }]]));
    assert.ok(
      panners[1].pan.value < 0,
      'a moving cow crosses the stereo field',
    );
    assert.ok(mooGain.gain.value > distantGain, 'approaching cow gets louder');
    farm.listen({ x: -4, z: 0 });
    assert.ok(
      panners[1].pan.value > 0,
      'listener movement updates a playing sound',
    );
    assert.equal(
      breathGain.gain.value,
      0,
      'breathing falls silent beyond its range while playing',
    );
    const beforeMix = mooGain.gain.value;
    effects /= 2;
    await farm.refresh();
    assert.ok(
      Math.abs(mooGain.gain.value - beforeMix / 2) < 0.0001,
      'saved mix changes apply to active sound',
    );
    farm.trackSources(new Map());
    assert.ok(
      sources[1].stopped,
      'removed or captured cow stops its attached sound',
    );
    farm.enabled = false;
    farm.play('animal.breath.1', 1, { x: 0, z: 0 });
    await setImmediate();
    assert.equal(sources.length, 3);
    farm.reset();
    assert.ok(sources[0].stopped && sources[1].stopped);
    assert.ok(filters.every((filter) => filter.disconnected));
    farm.enabled = true;
    farm.trackSources(
      new Map([
        ['cow-a', { x: -4, z: 0 }],
        ['cow-b', { x: -3, z: 0 }],
      ]),
    );
    farm.play('event.fence-shock', 1, { x: -4, z: 0 }, 'cow-a');
    farm.play('event.fence-shock', 1, { x: -4, z: 0 }, 'cow-a');
    farm.play('event.fence-shock', 1, { x: -3, z: 0 }, 'cow-b');
    await setImmediate();
    assert.equal(
      sources.length,
      5,
      'bundled zaps play once for each cow even on simultaneous contact',
    );
    farm.setLoop('fence', 'ambience.fence', 0.8);
    await setImmediate();
    assert.equal(
      sources.length,
      6,
      'bundled warning loop plays without a workshop recording',
    );
    assert.equal(sources[5].loop, true);
    farm.setLoop('fence', null);
    assert.equal(sources[5].stopped, true, 'cutting power stops the loop');
    farm.reset();
    assert.ok(sources.slice(3).every((source) => source.stopped));
  } finally {
    farm.dispose();
    stack.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
    globalThis.AudioContext = oldAudio;
  }
});
