import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advanceFarm,
  farmAction,
  farmPlayer,
  farmSnapshot,
  freshFarm,
} from './simulation';
import {
  cowExposed,
  FENCE_CONTACT,
  shockAge,
  SHOCK_STUN_MS,
  SHOCK_EXPOSURE_MS,
} from './fence';
import { PANEL, GATE } from './types';
import { farmEvents } from './audio-events';
import { farmLoopLevels } from './audio';
import { FARM_FENCE_CUES, withFarmFenceAudio } from './audio/fence';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';
import { getCatalog } from '../../platform/audio/catalog';
import { manifest } from '../../platform/audio/service';

function round(practice = false) {
  const world = freshFarm(100_000, 9717, practice);
  world.players = [
    farmPlayer('farmer', 'Farmer', world.clock),
    farmPlayer('player', 'Player', world.clock),
  ];
  farmAction(world, 'farmer', { type: 'start' }, 'farmer');
  const player = world.players[1];
  const cow = world.cows.find((c) => c.id === player.cowId)!;
  return { world, player, cow };
}

void test('each live edge and corner shocks on actual contact, including a stationary cow', () => {
  for (const [x, z] of [
    [9.4, 0],
    [-9.4, 0],
    [0, 9.4],
    [0, -9.4],
    [9.4, 9.4],
    [-9.4, -9.4],
  ]) {
    const { world, cow } = round();
    Object.assign(cow, { x, z, grazing: true, task: 0.1 });
    advanceFarm(world, world.clock + 50);
    assert.equal(cow.shockedAt, world.clock);
    assert.equal(cowExposed(cow, world.clock), true);
    assert.equal(cow.captured, false);
    assert.equal(cow.task, 0);
    assert.equal(cow.grazing, false);
    assert.equal(cow.moving, false);
    assert.ok(
      Math.abs(cow.x) < FENCE_CONTACT && Math.abs(cow.z) < FENCE_CONTACT,
    );
    assert.equal(
      world.events.filter((e) => e.text.startsWith('ZAP!')).length,
      1,
    );
  }
});

void test('approaching is safe; crossing the contact threshold triggers one shock', () => {
  const { world, player, cow } = round();
  Object.assign(cow, { x: 9.2, z: 0 });
  advanceFarm(world, world.clock + 50);
  assert.equal(cow.shockedAt, 0);
  player.input = { x: 1, z: 0, graze: false };
  advanceFarm(world, world.clock + 100);
  assert.ok(cow.shockedAt);
  const hit = cow.shockedAt;
  const position = { x: cow.x, z: cow.z };
  assert.throws(
    () => farmAction(world, player.id, { type: 'interact' }, 'farmer'),
    /Recover/,
  );
  advanceFarm(world, world.clock + 500);
  assert.deepEqual({ x: cow.x, z: cow.z }, position);
  assert.equal(cow.shockedAt, hit);
  player.seen = world.clock + 400;
  advanceFarm(world, world.clock + 400);
  assert.ok(cow.x > position.x, 'movement resumes after stun');
  assert.equal(cow.shockedAt, hit, 'cooldown blocks repeated shocks');
  assert.equal(cowExposed(cow, hit + SHOCK_EXPOSURE_MS - 1), true);
  assert.equal(cowExposed(cow, hit + SHOCK_EXPOSURE_MS), false);
  player.seen = hit + 1600;
  advanceFarm(world, hit + 1600);
  assert.ok(
    cow.shockedAt > hit,
    'sustained contact can shock again after cooldown',
  );
});

void test('powered-off contact never shocks and does not prevent the existing gate escape', () => {
  const { world, player, cow } = round();
  world.powerOff = true;
  Object.assign(cow, { x: 9.4, z: -9.4 });
  player.input = { x: 1, z: -1, graze: false };
  advanceFarm(world, world.clock + 500);
  assert.equal(cow.shockedAt, 0);
  assert.equal(cowExposed(cow, world.clock), false);
  world.keysDelivered = 2;
  Object.assign(cow, GATE);
  farmAction(world, player.id, { type: 'interact' }, 'farmer');
  assert.equal(cow.escaped, true);
});

void test('the power switch remains safely reachable and disables contact immediately', () => {
  const { world, player, cow } = round();
  Object.assign(cow, PANEL);
  farmAction(world, player.id, { type: 'interact' }, 'farmer');
  for (let i = 0; i < 9; i++) {
    player.seen = world.clock + 500;
    advanceFarm(world, world.clock + 500);
  }
  assert.equal(world.powerOff, true);
  assert.equal(cow.shockedAt, 0);
  cow.x = -FENCE_CONTACT;
  advanceFarm(world, world.clock + 50);
  assert.equal(cow.shockedAt, 0);
});

void test('shock state is public without disclosing player ownership, survives old rooms, and resets each round', () => {
  const { world, cow } = round();
  delete cow.shockedAt;
  assert.equal(shockAge(cow, world.clock), Infinity);
  cow.x = FENCE_CONTACT;
  advanceFarm(world, world.clock + 50);
  const view = farmSnapshot(world, 'FENCEA', 'farmer', 'farmer', 1);
  assert.equal(
    view.world.cows.find((c) => c.id === cow.id)?.shockedAt,
    cow.shockedAt,
  );
  assert.equal(view.you.cowId, null);
  assert.ok(view.world.players.every((p) => !('cowId' in p)));
  for (const c of world.cows.filter((c) => c.id !== cow.id))
    assert.equal(c.shockedAt, 0);
  world.phase = 'farmer-win';
  farmAction(world, 'farmer', { type: 'restart' }, 'farmer');
  assert.ok(
    world.cows.every((c) => !cowExposed(c, world.clock) && c.shockedAt === 0),
  );
});

void test('practice farmer responds to the visible exposed marker', () => {
  const { world, cow } = round(true);
  Object.assign(cow, { x: 9.4, z: 0 });
  Object.assign(world.farmer, { x: 7, z: 0, angle: -Math.PI / 2 });
  advanceFarm(world, world.clock + 50);
  assert.ok(cow.shockedAt);
  assert.equal(
    cow.captured,
    true,
    'farmer can inspect the publicly exposed cow even when initially facing away',
  );
});

void test('shock audio plays once per new contact, with no stale, reconnect or rematch replay', () => {
  const { world, cow } = round();
  const before = farmSnapshot(world, 'FENCEA', 'farmer', 'player', 1).world;
  cow.x = FENCE_CONTACT;
  advanceFarm(world, world.clock + 50);
  const after = farmSnapshot(world, 'FENCEA', 'farmer', 'player', 2).world;
  const shocks = farmEvents(before, after).filter(
    (e) => e.id === 'event.fence-shock',
  );
  assert.equal(shocks.length, 1);
  assert.equal(shocks[0].sourceId, cow.id);
  assert.equal(shocks[0].position?.x, cow.x);
  assert.deepEqual(farmEvents(after, after), []);
  assert.deepEqual(farmEvents(after, before), []);
  const delayed = structuredClone(after);
  delayed.clock += SHOCK_STUN_MS;
  assert.ok(
    !farmEvents(before, delayed).some((e) => e.id === 'event.fence-shock'),
  );
  delayed.clock += 3000;
  assert.deepEqual(farmEvents(before, delayed), []);
  after.round++;
  assert.deepEqual(farmEvents(before, after), []);
});

void test('warning hum grows before contact on every side and corner', () => {
  assert.equal(farmLoopLevels({ x: 0, z: 0 }, 0).fence, 0);
  for (const [x, z] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
  ]) {
    const close = farmLoopLevels({ x: x * 9.2, z: z * 9.2 }, 0).fence;
    const far = farmLoopLevels({ x: x * 7, z: z * 7 }, 0).fence;
    assert.ok(close > far && far > 0);
  }
});

void test('bundled electrical audio preserves workshop recordings, cue volumes and mixer settings', () => {
  const settings = { ...DEFAULT_SETTINGS, ambience: 0, effects: 0.4 };
  const data = {
    game: 'act-natural' as const,
    settings,
    keySaved: false,
    keyAvailable: false,
    busy: false,
    cues: getCatalog('act-natural').map((c) => ({
      ...c,
      file: null as string | null,
      generated: null,
      error: '',
      stale: false,
    })),
  };
  const shock = data.cues.find((c) => c.id === 'event.fence-shock')!;
  shock.volume = 0;
  const fallback = manifest(data);
  assert.equal(fallback.cues[shock.id].url, FARM_FENCE_CUES[shock.id].url);
  assert.equal(fallback.cues[shock.id].volume, 0);
  assert.equal(fallback.settings.ambience, 0);
  shock.file = 'act-natural/custom-shock.mp3';
  assert.equal(
    manifest(data).cues[shock.id].url,
    '/api/audio/act-natural/file/custom-shock.mp3',
  );
  assert.equal(
    withFarmFenceAudio('act-natural', fallback).cues[shock.id].volume,
    0,
  );
  const empty = { settings, cues: {} };
  assert.equal(
    Object.keys(withFarmFenceAudio('act-natural', empty).cues).length,
    2,
  );
  assert.strictEqual(withFarmFenceAudio('stack-or-sink', empty), empty);
});

void test('bundled WAV files contain audible unclipped PCM and a smooth warning loop seam', () => {
  for (const [name, duration] of [
    ['fence-powered', 2],
    ['fence-shock', 0.65],
  ] as const) {
    const bytes = readFileSync(
      new URL(`../../public/audio/act-natural/${name}.wav`, import.meta.url),
    );
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.readUInt32LE(24), 48000);
    assert.equal(bytes.length, 44 + duration * 48000 * 2);
    let sum = 0,
      peak = 0;
    for (let i = 44; i < bytes.length; i += 2) {
      const value = bytes.readInt16LE(i) / 32768;
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    assert.ok(peak < 0.99 && peak > 0.3);
    assert.ok(Math.sqrt(sum / ((bytes.length - 44) / 2)) > 0.03);
    if (name === 'fence-powered')
      assert.ok(
        Math.abs(bytes.readInt16LE(44) - bytes.readInt16LE(bytes.length - 2)) /
          32768 <
          0.02,
      );
  }
});
