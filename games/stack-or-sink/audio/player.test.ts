import { audioProfile as stackAudioProfile } from './profile';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { SiteAudio } from '../../../shared/audio/player';
import { DEFAULT_SETTINGS } from '../../../shared/audio/types';

void test('Stack smooths ambience, filters distance, selects available variants, ducks music and disposes sources', async () => {
  const original = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    context: globalThis.AudioContext,
  };
  const parameter = () => ({
    value: 0,
    setTargetAtTime(value: number) {
      this.value = value;
    },
  });
  class Node {
    disconnected = false;
    connect() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  class Source extends Node {
    buffer?: AudioBuffer;
    playbackRate = { value: 1 };
    stopped = false;
    onended?: () => void;
    start() {}
    stop() {
      this.stopped = true;
      this.onended?.();
    }
  }
  class Filter extends Node {
    frequency = parameter();
    Q = parameter();
  }
  const sources: Source[] = [],
    filters: Filter[] = [],
    gains: ReturnType<typeof parameter>[] = [];
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
    destination = new Node();
    async resume() {}
    async close() {}
    createGain() {
      const gain = parameter();
      gains.push(gain);
      return Object.assign(new Node(), { gain });
    }
    createDynamicsCompressor() {
      return new Node();
    }
    createStereoPanner() {
      return Object.assign(new Node(), { pan: parameter() });
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
    async decodeAudioData() {
      return { ...input };
    }
    createBuffer(_channels: number, length: number) {
      blended++;
      return { getChannelData: () => new Float32Array(length) };
    }
  }
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  const cue = (url: string, category = 'event', loop = false) => ({
    url,
    volume: 0.5,
    category,
    loop,
  });
  let releaseMusic!: (response: Response) => void;
  const musicDownload = new Promise<Response>((resolve) => {
    releaseMusic = resolve;
  });
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
            'ambience.site': cue('/surf', 'ambience', true),
            'music.build': cue('/build', 'music', true),
            'music.challenge': cue('/challenge', 'music', true),
            'event.land': cue('/land'),
            'water.drip.2': cue('/drip'),
            'material.crate.impact': cue('/impact'),
            'material.crate.impact.3': cue('/impact3'),
            'coast.gull.1': cue('/gull'),
          },
        })
      : url === '/challenge'
        ? musicDownload
        : new Response(new Uint8Array(10));
  const sound = new SiteAudio('stack-or-sink', stackAudioProfile);
  try {
    await sound.refresh();
    sound.unlock();
    await setImmediate();
    sound.setLoop('site', 'ambience.site', 0.5);
    await setImmediate();
    assert.equal(blended, 1);
    sound.setLoop('music', 'music.build', 0.8);
    await setImmediate();
    const musicGain = gains.at(-1)!;
    const full = musicGain.value;
    assert.ok(full > 0);
    sound.duck(true);
    assert.ok(musicGain.value < full * 0.4);
    sound.duck(false);
    assert.equal(musicGain.value, full);
    const oldMusic = sources.at(-1)!;
    sound.setLoop('music', 'music.challenge', 0.9);
    await setImmediate();
    assert.equal(
      oldMusic.stopped,
      false,
      'old score continues during a slow download',
    );
    releaseMusic(new Response(new Uint8Array(10)));
    await setImmediate();
    assert.equal(
      oldMusic.stopped,
      true,
      'fade starts only after the replacement is ready',
    );
    sound.listen({ x: 0, y: 0, z: 0 });
    sound.variant('water.drip', 1, { x: 1, z: 0 });
    await setImmediate();
    assert.equal(
      filters.length,
      1,
      'a partially generated family uses its available recording',
    );
    sound.variant('coast.gull', 1, { x: 35, z: 0 });
    await setImmediate();
    assert.equal(filters.length, 2);
    assert.ok(filters[1].frequency.value < filters[0].frequency.value);
    sound.variant('land.metal', 1, { x: 0, z: 0 });
    await setImmediate();
    assert.equal(
      filters.length,
      3,
      'missing landing family uses legacy landing',
    );
    const chosen: string[] = [];
    const play = sound.play.bind(sound);
    sound.play = (id) => {
      chosen.push(id);
    };
    for (let i = 0; i < 20; i++) sound.variant('material.crate.impact');
    assert.equal(new Set(chosen).size, 2);
    assert.ok(
      chosen.every((id, index) => index === 0 || id !== chosen[index - 1]),
    );
    sound.play = play;
    const count = sources.length;
    sound.enabled = false;
    sound.variant('coast.gull', 1, { x: 0, z: 0 });
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
