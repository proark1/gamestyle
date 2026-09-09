import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FarmAmbience,
  farmAcoustics,
  farmAttenuation,
  farmLoopLevels,
  farmBreeze,
} from './audio';
import { freshFarm, farmSnapshot } from './simulation';
import { farmEvents } from './audio-events';
import { type AudioEvent } from '../../shared/audio/world';
import { seamlessAmbience } from '../../shared/audio/loop-buffer';
import { getCatalog } from '../../platform/audio/catalog';
import { Sound } from './sound';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';
import { farmRecordingGain } from './audio/recording-levels';
import { farmNaturalAdditions } from './audio/detail-catalog';

function snapshot() {
  const next = farmSnapshot(freshFarm(1_000), 'FARMAA', '', '', 1_000);
  next.world.phase = 'playing';
  next.world.started = 1_000;
  next.world.clock = 1_000;
  next.you.role = 'farmer';
  next.world.farmer = { x: 0, z: 0, angle: 0 };
  return next;
}

void test('gate opens audibly with its second key, and does not open again on escape or stale snapshots', () => {
  const before = snapshot().world;
  before.keysDelivered = 1;
  const after = structuredClone(before);
  after.clock += 100;
  after.keysDelivered = 2;
  const gates = farmEvents(before, after).filter((e) => e.id === 'event.gate');
  assert.deepEqual(gates, [{ id: 'event.gate', position: { x: 0, z: 10 } }]);
  const escape = structuredClone(after);
  escape.clock += 100;
  escape.cows[0].escaped = true;
  escape.cows[0].x = 0;
  assert.ok(!farmEvents(after, escape).some((e) => e.id === 'event.gate'));
  assert.ok(farmEvents(after, escape).some((e) => e.id === 'speech.escape'));
  after.round++;
  assert.deepEqual(farmEvents(before, after), []);
});

void test('intimate Foley disappears nearby while moos carry; fence and panel stay local', () => {
  assert.equal(farmAttenuation('animal.graze.1', 4), 0);
  assert.equal(farmAttenuation('animal.breath.1', 4), 0);
  assert.equal(farmAttenuation('step.hoof.1', 12), 0);
  assert.ok(farmAttenuation('animal.moo.1', 22) > 0);
  assert.ok(
    farmAttenuation('animal.graze.1', 2) < farmAttenuation('animal.graze.1', 1),
  );
  assert.equal(farmLoopLevels({ x: 0, z: 0 }, 1_000).panel, 0);
  assert.equal(farmLoopLevels({ x: -9, z: 2 }, 1_000).panel, 1);
  assert.ok(
    farmLoopLevels({ x: 9, z: 0 }, 1_000).fence >
      farmLoopLevels({ x: 0, z: 0 }, 1_000).fence,
  );
});

void test('ambience is sparse, audible, respects cow activity and includes all new environment families', () => {
  const world = snapshot().world;
  for (const cow of world.cows)
    Object.assign(cow, { x: -8, z: -7, grazing: true, moving: false });
  const listener = { x: -8, z: -7 };
  let seed = 1234;
  const director = new FarmAmbience(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  const events: AudioEvent[] = [];
  let last = -Infinity;
  for (let i = 0; i < 1800; i++) {
    world.clock += 100;
    const next = director.update(world, listener);
    assert.ok(next.length <= 1);
    for (const event of next) {
      assert.ok(world.clock - last >= 1200);
      last = world.clock;
      assert.ok(event.position);
      assert.ok(
        Math.hypot(
          event.position.x - listener.x,
          event.position.z - listener.z,
        ) < farmAcoustics(`${event.id}.1`).range,
      );
      assert.ok(
        getCatalog('act-natural').some((cue) => cue.id === `${event.id}.1`),
      );
    }
    events.push(...next);
  }
  for (const family of [
    'animal.moo',
    'animal.graze',
    'animal.breath',
    'animal.snuffle',
    'nature.bird',
    'nature.insect',
    'nature.leaves',
    'nature.barn',
  ])
    assert.ok(
      events.some((event) => event.id === family),
      family,
    );
  for (const cow of world.cows) cow.captured = true;
  for (let i = 0; i < 600; i++) {
    world.clock += 100;
    assert.ok(
      director
        .update(world, listener)
        .every((event) => !event.id.startsWith('animal.')),
    );
  }
  world.phase = 'lobby';
  assert.deepEqual(director.update(world, listener), []);
  world.phase = 'playing';
  assert.deepEqual(director.update(world, listener), []);
  world.clock += 60_000;
  assert.ok(director.update(world, listener).length <= 1, 'no catch-up burst');
});

void test('ambient animal behavior does not depend on player cow identity', () => {
  const a = snapshot(),
    b = structuredClone(a);
  b.you.role = 'cow';
  b.you.cowId = b.world.cows[0].id;
  b.world.players = [];
  const first = new FarmAmbience(() => 0.5),
    second = new FarmAmbience(() => 0.5);
  for (let i = 0; i < 900; i++) {
    a.world.clock += 100;
    b.world.clock += 100;
    assert.deepEqual(
      first.update(a.world, { x: 0, z: 0 }),
      second.update(b.world, { x: 0, z: 0 }),
    );
  }
});

void test('farm playback prioritizes nearest hoofsteps, ignores stale packets and clears ambience on menu', () => {
  const oldDocument = globalThis.document,
    oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.fetch = async () =>
    Response.json({ settings: DEFAULT_SETTINGS, cues: {} });
  const sound = new Sound();
  const played: AudioEvent[] = [];
  const loops = new Map<string, string | null>();
  sound.play = (id, strength, position) => {
    played.push({ id, strength, position });
  };
  sound.variant = (id, strength, position) => {
    played.push({ id, strength, position });
  };
  const originalLoop = sound.setLoop.bind(sound);
  sound.setLoop = (channel, id, strength) => {
    loops.set(channel, id);
    originalLoop(channel, id, strength);
  };
  try {
    const first = snapshot();
    first.world.cows.forEach((cow, i) =>
      Object.assign(cow, { x: 9 - i * 0.4, z: 0, moving: true }),
    );
    sound.farmSnapshot(first);
    const next = structuredClone(first);
    next.world.clock += 100;
    next.world.cows.forEach((cow) => {
      cow.x -= 0.8;
    });
    played.length = 0;
    sound.farmSnapshot(next);
    const steps = played.filter((event) => event.id === 'step.hoof');
    assert.equal(steps.length, 3);
    assert.ok(steps[0].position!.x < steps[1].position!.x);
    assert.equal(steps[0].position!.x, next.world.cows.at(-1)!.x);
    played.length = 0;
    sound.farmSnapshot(first);
    sound.farmSnapshot(next);
    assert.deepEqual(played, []);
    const powerOff = structuredClone(next);
    powerOff.world.clock += 50;
    powerOff.world.powerOff = true;
    sound.farmSnapshot(powerOff);
    assert.equal(
      loops.get('fence'),
      null,
      'power-off snapshot silences the warning hum',
    );
    sound.menu();
    assert.equal(loops.get('fence'), null);
    assert.equal(loops.get('panel'), null);
    assert.equal(loops.get('trees'), null);
  } finally {
    sound.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});

function buffer(channels: Float32Array[], sampleRate = 1000): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
}
void test('ambience overlap removes an abrupt wrap without clipping, changing stereo balance or mutating source', () => {
  const left = Float32Array.from({ length: 4000 }, (_, i) => i / 2000 - 1);
  const right = Float32Array.from(left, (sample) => sample * 0.5);
  const source = buffer([left, right]);
  const context = {
    createBuffer: (channels: number, length: number, rate: number) =>
      buffer(
        Array.from({ length: channels }, () => new Float32Array(length)),
        rate,
      ),
  } as BaseAudioContext;
  const output = seamlessAmbience(context, source);
  const samples = output.getChannelData(0);
  assert.ok(Math.abs(samples[0] - samples.at(-1)!) < 0.001);
  assert.equal(left[0], -1);
  for (let i = 0; i < samples.length; i++) {
    assert.ok(Math.abs(samples[i]) <= 1);
    assert.equal(output.getChannelData(1)[i], samples[i] * 0.5);
    if (i) assert.ok(Math.abs(samples[i] - samples[i - 1]) < 0.02);
  }
});

void test('farm level conditioning reduces loud variants and peaks without boosting quiet takes or changing samples', () => {
  const wave = (level: number) =>
    Float32Array.from({ length: 1000 }, (_, i) => (i % 2 ? level : -level));
  const quiet = buffer([wave(0.05), wave(0.025)]);
  assert.equal(farmRecordingGain('animal.breath.1', quiet), 1);
  const loud = buffer([wave(0.5), wave(0.25)]);
  const before = loud.getChannelData(0).slice();
  const gain = farmRecordingGain('animal.breath.2', loud);
  assert.ok(gain < 0.2 && gain > 0);
  const rms = Math.sqrt((0.5 ** 2 + 0.25 ** 2) / 2) * gain;
  assert.ok(Math.abs(20 * Math.log10(rms) - -24) < 0.001);
  assert.deepEqual(loud.getChannelData(0), before);
  assert.equal(farmRecordingGain('music.build', loud), 1);
  assert.equal(farmRecordingGain('speech.start', loud), 1);
  assert.equal(
    farmRecordingGain('animal.breath.1', buffer([new Float32Array(100)])),
    1,
  );
  const transient = new Float32Array(10_000);
  transient[50] = 1.2;
  assert.ok(
    farmRecordingGain('nature.barn.1', buffer([transient])) * 1.2 <= 0.89,
  );
  assert.equal(
    farmRecordingGain('animal.breath.1', buffer([Float32Array.of(NaN)])),
    0,
  );
});

void test('new farm details follow measured movement, carried objects, weather and real scene locations', () => {
  assert.equal(farmNaturalAdditions.length, 12);
  assert.equal(getCatalog('act-natural').length, 77);
  const world = snapshot().world;
  const cow = world.cows[0];
  for (const body of world.cows)
    Object.assign(body, { captured: true, moving: false });
  Object.assign(cow, {
    x: -5,
    z: -6,
    captured: false,
    moving: true,
    carrying: null,
  });
  let seed = 4321;
  const director = new FarmAmbience(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  let lastWildlife = -Infinity;
  const run = (frames: number, move: (i: number) => void) => {
    const events: AudioEvent[] = [];
    for (let i = 0; i < frames; i++) {
      world.clock += 100;
      move(i);
      const next = director.update(world, { x: -5, z: -6 });
      assert.ok(next.length <= 1);
      for (const event of next) {
        if (/^nature\.(bird|insect|wings)$/.test(event.id)) {
          assert.ok(world.clock - lastWildlife >= 8_000);
          lastWildlife = world.clock;
        }
        if (/^nature\.(leaves|barn|trough)$/.test(event.id))
          assert.ok(farmBreeze(world.clock) >= 0.55);
        if (event.id === 'nature.trough')
          assert.deepEqual(event.position, { x: -3, z: -6.9 });
        if (event.id === 'movement.grass' || event.id === 'item.ladder.carry')
          assert.equal(event.sourceId, cow.id);
      }
      events.push(...next);
    }
    return events;
  };
  const motion = (i: number) => {
    cow.x = -5 + Math.sin(i / 10) * 0.8;
  };
  const stationary = run(1200, () => {});
  assert.ok(
    !stationary.some((event) =>
      /^(movement\.|item\.ladder\.carry)/.test(event.id),
    ),
    'a moving flag alone makes no sound',
  );
  const emptyHanded = run(1200, motion);
  assert.ok(emptyHanded.some((event) => event.id === 'movement.grass'));
  assert.ok(!emptyHanded.some((event) => event.id === 'item.ladder.carry'));
  cow.carrying = 'ladder';
  const carrying = run(3600, motion);
  for (const family of [
    'movement.grass',
    'item.ladder.carry',
    'nature.trough',
    'nature.wings',
  ])
    assert.ok(
      carrying.some((event) => event.id === family),
      family,
    );
  const teleports = run(1200, (i) => {
    cow.x = i % 2 ? -8 : -2;
  });
  assert.ok(
    !teleports.some((event) =>
      /^(movement\.|item\.ladder\.carry)/.test(event.id),
    ),
  );
  cow.captured = true;
  assert.ok(!run(1200, motion).some((event) => event.sourceId === cow.id));
  const stale = structuredClone(world);
  stale.clock -= 100;
  assert.deepEqual(director.update(stale, cow), []);
  world.clock += 60_000;
  assert.deepEqual(
    director.update(world, cow),
    [],
    'a long gap restarts quietly',
  );
});
