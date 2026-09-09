import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HotelSound, hotelFallbackCatalog } from './audio';
import { HotelFoley, type HotelCue } from './foley';
import { freshHotel, newGuest, hotelAction, hotelSnapshot } from './simulation';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';

void test('private door audio matches three impacts, deduplicates snapshots and stops outside inspection', async (t) => {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const previousDocument = globalThis.document;
  globalThis.document = doc as unknown as Document;
  t.after(() => {
    globalThis.document = previousDocument;
  });
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ settings: DEFAULT_SETTINGS, cues: {} }),
  );
  const played: HotelCue[] = [];
  t.mock.method(HotelFoley.prototype, 'play', (kind: HotelCue) => {
    played.push(kind);
  });
  const sound = new HotelSound();
  try {
    const world = freshHotel(100000);
    world.players.push(newGuest('you', 'You', 0, world.clock));
    hotelAction(world, 'you', { type: 'start' }, 'you');
    const s = hotelSnapshot(world, 'PRACTICE', 'you', 'you', 1);
    s.you.station = 2;
    s.you.anomaly = true;
    s.you.apparition = false;
    for (let ms = 0; ms < 6700; ms += 50) {
      const next = structuredClone(s);
      next.world.clock += ms;
      sound.update(next, 'you');
      sound.update(next, 'you');
    }
    assert.equal(played.filter((k) => k === 'door-knock').length, 3);
    assert.equal(played.filter((k) => k === 'handle').length, 1);
    assert.equal(played.filter((k) => k === 'start').length, 1);
    assert.equal(
      played.some((k) => k === 'step' || k === 'wet-step' || k === 'clock'),
      false,
    );
    const before = played.filter((k) => k === 'door-knock').length;
    s.world.stage = 'travel';
    s.world.clock += 7600;
    sound.update(s, 'you');
    assert.equal(played.filter((k) => k === 'door-knock').length, before);
    assert.ok(played.includes('motor'));
    await Promise.resolve();
  } finally {
    sound.dispose();
  }
});

void test('every fallback creates audible bounded samples; camera panning, mute, hidden tabs and disposal clean up', (t) => {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const previousDocument = globalThis.document;
  globalThis.document = doc as unknown as Document;
  t.after(() => {
    globalThis.document = previousDocument;
  });
  const sources: Source[] = [],
    pans: ReturnType<typeof parameter>[] = [];
  const parameter = () => ({
    value: 0,
    setTargetAtTime(value: number) {
      this.value = value;
    },
  });
  class Node {
    connect(node: Node) {
      return node;
    }
    disconnect() {}
  }
  class Source extends Node {
    buffer?: { getChannelData(channel: number): Float32Array };
    playbackRate = parameter();
    onended?: () => void;
    loop = false;
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
    sampleRate = 22050;
    destination = new Node();
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
    createGain() {
      return Object.assign(new Node(), { gain: parameter() });
    }
    createDynamicsCompressor() {
      return Object.assign(new Node(), {
        threshold: parameter(),
        ratio: parameter(),
      });
    }
    createConvolver() {
      return new Node();
    }
    createOscillator() {
      return Object.assign(new Source(), { frequency: parameter() });
    }
    createStereoPanner() {
      const pan = parameter();
      pans.push(pan);
      return Object.assign(new Node(), { pan });
    }
    createBuffer(channels: number, length: number) {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(length),
      );
      return { getChannelData: (channel: number) => data[channel] };
    }
    createBufferSource() {
      const source = new Source();
      sources.push(source);
      return source;
    }
  }
  const previousAudio = globalThis.AudioContext;
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  t.after(() => {
    globalThis.AudioContext = previousAudio;
  });
  const foley = new HotelFoley();
  foley.unlock();
  foley.ambience(true);
  try {
    for (const cue of hotelFallbackCatalog) {
      foley.play(cue.id.slice(6) as HotelCue);
      const data = sources.at(-1)!.buffer!.getChannelData(0);
      assert.ok(
        data.some((v) => Math.abs(v) > 0.01),
        `${cue.id} is audible`,
      );
      assert.ok(
        data.every((v) => Number.isFinite(v) && Math.abs(v) <= 1),
        `${cue.id} is bounded`,
      );
      foley.stopEffects();
    }
    foley.listen({ x: 0, z: -10 }, 0);
    foley.play('breath', { x: 4, z: -10 });
    assert.ok(pans.at(-1)!.value > 0);
    foley.listen({ x: 0, z: -10 }, Math.PI);
    assert.ok(pans.at(-1)!.value < 0, 'an active sound follows a camera turn');
    foley.setEnabled(false);
    assert.ok(sources.filter((s) => !s.loop).every((s) => s.stopped));
    let count = sources.length;
    foley.play('slam');
    assert.equal(sources.length, count);
    foley.setEnabled(true);
    foley.play('slam');
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    assert.ok(sources.filter((s) => !s.loop).every((s) => s.stopped));
    count = sources.length;
    foley.play('slam');
    assert.equal(sources.length, count);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    foley.play('step');
    assert.equal(sources.length, count + 1);
    foley.dispose();
    assert.ok(sources.filter((s) => !s.loop).every((s) => s.stopped));
    foley.play('step');
    assert.equal(sources.length, count + 1);
  } finally {
    foley.dispose();
  }
});
