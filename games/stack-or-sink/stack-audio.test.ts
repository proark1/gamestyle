import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshWorld } from './simulation';
import {
  StackAmbience,
  stackAcoustics,
  stackAttenuation,
  stackLoopLevels,
} from './audio/ambience';
import { Footsteps, type AudioEvent } from '../../shared/audio/world';
import { getCatalog } from '../../platform/audio/catalog';
import { parseCue } from '../../platform/audio/service';
import { Sound } from './sound';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';
import type { Snapshot, Player } from './types';

function world() {
  const w = freshWorld(1000);
  w.phase = 'playing';
  w.started = 1000;
  w.clock = 1000;
  return w;
}
const player: Player = {
  id: 'me',
  name: 'Crew',
  color: 0,
  x: 0,
  y: 1,
  z: 0,
  vy: 0,
  angle: 0,
  grounded: true,
  breath: 8,
  down: false,
  rescued: false,
  seen: 1000,
  input: { x: 0, z: 0, jump: false, seq: 0 },
  lastJump: 0,
};

void test('cinematic catalog preserves original cues and validates every new recording', () => {
  const catalog = getCatalog('stack-or-sink');
  assert.equal(catalog.length, 121);
  assert.equal(new Set(catalog.map((cue) => cue.id)).size, catalog.length);
  for (const cue of catalog)
    assert.doesNotThrow(() => parseCue(cue, cue), cue.id);
  for (const id of [
    'music.build',
    'music.challenge',
    'material.fridge.impact',
    'event.land',
    'music.cinematic.build',
    'music.cinematic.challenge',
    'music.cinematic.rescue',
  ])
    assert.ok(
      catalog.some((cue) => cue.id === id),
      id,
    );
});

void test('climbing exposes wind and reduces surf; nearby flood and danger build the mix', () => {
  const w = world();
  w.water = 1;
  const near = stackLoopLevels(w, { x: 0, y: 1.2, z: 0, breath: 3 });
  const high = stackLoopLevels(w, { x: 0, y: 12, z: 0, breath: 8 });
  assert.ok(high.wind > near.wind);
  assert.ok(high.surf < near.surf);
  assert.ok(near.flood > high.flood);
  assert.ok(near.music > high.music);
  assert.ok(stackLoopLevels(w, { x: 10, y: 1.2, z: 0 }).surf > near.surf);
  w.mode = 'practice';
  assert.equal(stackLoopLevels(w, player).flood, 0);
  assert.equal(stackLoopLevels(w, player).challenge, false);
  assert.equal(stackAttenuation('water.drip.1', 10), 0);
  assert.ok(stackAttenuation('coast.gull.1', 35) > 0);
  assert.ok(
    stackAttenuation('material.fridge.impact', 10) <
      stackAttenuation('material.fridge.impact', 2),
  );
});

void test('coastal details are sparse, positional, and silent on reconnect and round endings', () => {
  const w = world();
  const director = new StackAmbience(() => 0.5);
  const events: AudioEvent[] = [];
  let last = -Infinity;
  director.update(w, undefined, player);
  for (let i = 0; i < 1200; i++) {
    const old = structuredClone(w);
    w.clock += 100;
    const next = director.update(w, old, player);
    assert.ok(next.length <= 1);
    for (const cue of next) {
      assert.ok(w.clock - last >= 2400);
      last = w.clock;
      assert.ok(cue.position);
      assert.ok(
        getCatalog('stack-or-sink').some((c) => c.id === `${cue.id}.1`),
      );
      assert.ok(
        Math.hypot(
          cue.position.x,
          cue.position.z,
          (cue.position.y ?? 0) - player.y,
        ) < stackAcoustics(cue.id).range,
      );
    }
    events.push(...next);
  }
  assert.ok(events.some((cue) => cue.id === 'coast.gull'));
  assert.ok(events.some((cue) => cue.id === 'coast.palm'));
  const old = structuredClone(w);
  w.clock += 30000;
  assert.deepEqual(director.update(w, old, player), []);
  w.phase = 'won';
  w.clock += 100;
  assert.deepEqual(director.update(w, old, player), []);
});

void test('drips, strain and cable sounds require real movement and respect contact cooldowns', () => {
  const w = world();
  w.water = 1;
  w.pieces = [
    { ...w.pieces[0], x: 0, y: 0.9, z: 0, kind: 'crate', heldBy: 'me' },
  ];
  const director = new StackAmbience(() => 0.5);
  director.update(w, undefined, player);
  let old = structuredClone(w);
  w.clock += 100;
  w.pieces[0].y = 1.01;
  assert.ok(
    director.update(w, old, player).some((cue) => cue.id === 'water.drip'),
  );
  old = structuredClone(w);
  w.clock += 100;
  assert.deepEqual(director.update(w, old, player), []);
  delete w.pieces[0].heldBy;
  w.pieces[0].y = 2;
  old = structuredClone(w);
  w.clock += 100;
  w.pieces[0].x += 0.05;
  w.pieces[0].vx = 0.2;
  assert.ok(
    director.update(w, old, player).some((cue) => cue.id === 'strain.wood'),
  );
  old = structuredClone(w);
  w.clock += 100;
  w.pieces[0].x += 0.05;
  assert.ok(
    !director.update(w, old, player).some((cue) => cue.id === 'strain.wood'),
  );
  w.pieces[0].heldBy = 'crane';
  old = structuredClone(w);
  w.clock += 100;
  w.pieces[0].y += 0.1;
  assert.ok(
    director.update(w, old, player).some((cue) => cue.id === 'crane.cable'),
  );
});

void test('material landings reflect the support and fall height, while legacy callers keep the original cue', () => {
  const landing = (peak: number, materials = true) => {
    const f = new Footsteps();
    f.update('me', { x: 0, y: peak, z: 0 }, false, 'metal', 0, materials);
    return f.update(
      'me',
      { x: 0, y: 0, z: 0 },
      true,
      'metal',
      100,
      materials,
    )[0];
  };
  assert.equal(landing(2).id, 'land.metal');
  assert.equal(landing(2).variant, true);
  assert.ok(landing(2).strength! > landing(0.3).strength!);
  assert.equal(landing(2, false).id, 'event.land');
});

void test('Stack snapshot mixing retains fallback music, ignores stale packets and clears loops in menu', async () => {
  const original = { document: globalThis.document, fetch: globalThis.fetch };
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.fetch = async () =>
    Response.json({ settings: DEFAULT_SETTINGS, cues: {} });
  const sound = new Sound();
  const loops = new Map<string, { id: string | null; strength: number }>();
  const plays: string[] = [];
  const setLoop = sound.setLoop.bind(sound);
  sound.setLoop = (channel, id, strength) => {
    loops.set(channel, { id, strength: strength ?? 1 });
    setLoop(channel, id, strength);
  };
  sound.play = (id) => {
    plays.push(id);
  };
  try {
    await sound.refresh();
    const s: Snapshot = {
      code: 'STACKA',
      host: 'me',
      version: 1,
      world: world(),
    };
    s.world.players = [{ ...player }];
    sound.stackSnapshot(s, 'me');
    assert.equal(loops.get('music')?.id, 'music.build');
    const flood = structuredClone(s);
    flood.world.clock += 100;
    flood.world.water = 1;
    sound.stackSnapshot(flood, 'me');
    assert.equal(loops.get('music')?.id, 'music.challenge');
    const count = plays.length;
    sound.stackSnapshot(s, 'me');
    assert.equal(plays.length, count);
    assert.equal(loops.get('music')?.id, 'music.challenge');
    sound.menu();
    assert.equal(loops.get('music')?.id, 'music.menu');
    assert.equal(loops.get('flood')?.id, null);
    assert.equal(loops.get('site')?.id, null);
    assert.equal(loops.get('trees')?.id, null);
  } finally {
    sound.dispose();
    globalThis.document = original.document;
    globalThis.fetch = original.fetch;
  }
});
