import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteAdapter } from '../../db/node';
import { getCatalog } from '../../platform/audio/catalog';
import { promptLimit } from '../../shared/audio/limits';
import { generationRequest } from '../../shared/audio/provider';
import {
  library,
  manifest,
  parseCue,
  updateAudio,
} from '../../platform/audio/service';
import { DEFAULT_SETTINGS, GAME_NAMES } from '../../shared/audio/types';
import { NARRATOR_DEFAULTS } from '../../shared/audio/narrator-config';
import { giantAudioEvents, giantSurface } from './audio-events';
import {
  freshGiant,
  giantPlayer,
  giantSnapshot,
  giantAction,
  advanceGiant,
  warnGiant,
} from './simulation';
import { GiantSound } from './sound';

const game = 'dont-wake-the-giant';
function round() {
  const world = freshGiant(10000);
  world.players = [
    giantPlayer('one', 'One', 0, world.clock),
    giantPlayer('two', 'Two', 1, world.clock),
  ];
  giantAction(world, 'one', { type: 'start' }, 'one');
  return world;
}
const snapshot = (world: ReturnType<typeof round>) =>
  structuredClone(giantSnapshot(world, 'ABC234', 'one', 'one', world.clock));
const ids = (
  before: ReturnType<typeof snapshot> | null,
  after: ReturnType<typeof snapshot>,
) => giantAudioEvents(before, after).map((cue) => cue.id);

void test('Giant workshop defaults cover every item and surface and satisfy generation limits', () => {
  const cues = getCatalog(game);
  assert.equal(new Set(cues.map((c) => c.id)).size, cues.length);
  for (const cue of cues) {
    assert.ok(
      cue.prompt.length <= promptLimit(cue.category),
      `${cue.id}: ${cue.prompt.length}`,
    );
    assert.deepEqual(parseCue(cue, cue), cue);
    assert.ok(
      generationRequest(cue, { ...DEFAULT_SETTINGS, voiceId: 'shared_voice' }),
    );
  }
  assert.equal(cues.filter((c) => c.category === 'speech').length, 16);
  assert.equal(cues.filter((c) => c.category === 'music').length, 6);
  const world = round(),
    player = world.players[0];
  for (const item of world.items)
    for (const action of ['grab', 'place'])
      assert.ok(cues.some((c) => c.id === `item.${item.kind}.${action}`));
  for (const [support, surface] of [
    ['floor', 'wood'],
    ['book-one', 'paper'],
    ['bed', 'fabric'],
    ['head', 'skin'],
    ['chandelier', 'metal'],
    ['item:pillow-1', 'fabric'],
    ['item:spoon', 'metal'],
  ]) {
    player.support = support;
    assert.equal(giantSurface(player, world), surface);
    for (const take of [1, 2, 3])
      assert.ok(cues.some((c) => c.id === `step.${surface}.${take}`));
  }
});

void test('actual Giant pickup, banking, reaction warnings and reactions produce distinct cues without duplicates', () => {
  const world = round();
  let before = snapshot(world);
  assert.deepEqual(ids(null, before), ['speech.start']);
  const coin = world.items[0];
  Object.assign(world.players[0], { x: coin.x, y: coin.y, z: coin.z });
  giantAction(world, 'one', { type: 'interact' }, 'one');
  let after = snapshot(world);
  assert.ok(ids(before, after).includes('item.coin.grab'));
  assert.ok(ids(before, after).includes('speech.treasure'));
  assert.deepEqual(ids(after, after), []);
  before = after;
  Object.assign(world.players[0], { x: -11.7, y: 0, z: 8.5 });
  giantAction(world, 'one', { type: 'interact' }, 'one');
  after = snapshot(world);
  assert.ok(ids(before, after).includes('event.bank'));
  assert.ok(!ids(before, after).includes('item.coin.place'));
  before = after;
  warnGiant(world, 'sneeze');
  after = snapshot(world);
  assert.ok(ids(before, after).includes('speech.sneeze-warning'));
  assert.ok(!ids(before, after).includes('giant.sneeze'));
  before = after;
  advanceGiant(world, world.pending!.at + 30);
  after = snapshot(world);
  assert.ok(ids(before, after).includes('giant.sneeze'));
  assert.ok(!ids(before, after).includes('speech.sneeze-warning'));
  const tickledWorld = round();
  Object.assign(tickledWorld.players[0], { x: 2, y: 3.3, z: 6.4 });
  const beforeTickle = snapshot(tickledWorld);
  giantAction(tickledWorld, 'one', { type: 'tickle' }, 'one');
  const tickleCues = ids(beforeTickle, snapshot(tickledWorld));
  assert.ok(tickleCues.includes('event.tickle'));
  assert.equal(
    tickleCues.find((id) => id.startsWith('speech.')),
    'speech.tickle',
  );
});

void test('Giant audio silences history across late joins, rooms, reconnect gaps and restarts', () => {
  const world = round();
  world.clock += 5000;
  const before = snapshot(world),
    next = structuredClone(before);
  next.world.banked = 150;
  next.world.sneezeAt = next.world.clock;
  assert.deepEqual(ids(null, next), []);
  assert.deepEqual(ids(before, { ...next, code: 'XYZ234' }), []);
  next.world.clock += 3000;
  assert.deepEqual(ids(before, next), []);
  const restarted = snapshot(round());
  restarted.world.started = before.world.clock + 100;
  restarted.world.clock = restarted.world.started;
  assert.deepEqual(ids(before, restarted), ['speech.start']);
});

void test('Giant dialogue prioritizes escape and result, distinguishes rescues from recovery and confirms item contact', () => {
  const before = snapshot(round()),
    next = structuredClone(before);
  next.world.clock += 100;
  next.world.phase = 'escape';
  next.world.escapeAt = next.world.clock + 25000;
  next.world.banked = 120;
  assert.equal(ids(before, next)[0], 'speech.giant-wake');
  assert.ok(ids(before, next).includes('speech.target'));
  assert.ok(ids(before, next).includes('giant.wake'));
  const ended = structuredClone(next);
  ended.world.phase = 'ended';
  assert.equal(ids(next, ended)[0], 'speech.win');
  ended.world.banked = 0;
  assert.equal(ids(next, ended)[0], 'speech.fail');
  const down = structuredClone(before),
    helped = structuredClone(before);
  down.world.players[1].downUntil = down.world.clock + 5000;
  helped.world.clock += 100;
  assert.ok(ids(down, helped).includes('event.rescue'));
  down.world.players[1].downUntil = helped.world.clock - 1;
  assert.ok(!ids(down, helped).includes('event.rescue'));
  const dropping = structuredClone(before),
    landed = structuredClone(before);
  dropping.world.items[0].support = null;
  assert.ok(ids(dropping, landed).includes('item.coin.place'));
  landed.world.items[0].support = null;
  assert.ok(!ids(dropping, landed).includes('item.coin.place'));
});

void test('Giant inherits the saved Chaos narrator and owning key, publishes generated speech, and preserves a custom voice', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('drizzle/0001_round_xorn.sql', 'utf8'));
  const db = sqliteAdapter(sqlite),
    files = new Map<string, Uint8Array>();
  const storage = {
    masterKey: async () => 'ab'.repeat(32),
    putAudio: async (file: string, bytes: Uint8Array) => {
      files.set(file, bytes);
    },
  };
  try {
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'key', key: 'sk_source_account_placeholder' },
      storage,
    );
    const state = {
      config: NARRATOR_DEFAULTS,
      voice: {
        id: 'shared_voice',
        name: NARRATOR_DEFAULTS.name,
        sourceGame: 'stack-or-sink',
      },
      audition: {
        config: NARRATOR_DEFAULTS,
        sourceGame: 'stack-or-sink',
        previews: [
          { id: 'saved_audition', voiceId: 'shared_voice', url: '/sample.mp3' },
        ],
      },
    };
    sqlite
      .prepare('INSERT INTO audio_settings (game, settings) VALUES (?, ?)')
      .run('shared-narrator', JSON.stringify(state));
    const data = await library(db, game);
    assert.equal(data.settings.voiceId, 'shared_voice');
    assert.equal(data.keyAvailable, true);
    assert.equal(data.keySaved, false);
    const provider: typeof fetch = async (url, options) => {
      assert.equal(typeof url, 'string');
      assert.ok((url as string).includes('/text-to-speech/shared_voice'));
      assert.equal(
        new Headers(options?.headers).get('xi-api-key'),
        'sk_source_account_placeholder',
      );
      assert.ok(
        JSON.parse(options?.body as string).text.includes('Eight minutes.'),
      );
      return new Response(new Uint8Array(100), {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    };
    await updateAudio(
      db,
      game,
      { op: 'generate', cueId: 'speech.start', requestId: crypto.randomUUID() },
      storage,
      provider,
    );
    assert.ok(
      manifest(await library(db, game)).cues['speech.start'].url.startsWith(
        `/api/audio/${game}/file/`,
      ),
    );
    assert.equal(files.size, 1);
    await updateAudio(
      db,
      game,
      {
        op: 'settings',
        settings: {
          ...DEFAULT_SETTINGS,
          effects: 0.27,
          voiceId: 'custom_voice',
        },
      },
      storage,
    );
    assert.equal((await library(db, game)).settings.voiceId, 'custom_voice');
    assert.equal(
      manifest(await library(db, game)).cues['speech.start'],
      undefined,
    );
    await updateAudio(
      db,
      game,
      { op: 'narrator-select', previewId: 'saved_audition' },
      storage,
      async () => {
        throw new Error('Must reuse the saved voice');
      },
    );
    for (const target of Object.keys(GAME_NAMES) as (keyof typeof GAME_NAMES)[])
      assert.equal(
        (await library(db, target)).settings.voiceId,
        'shared_voice',
      );
    assert.equal((await library(db, game)).settings.effects, 0.27);
  } finally {
    sqlite.close();
  }
});

void test('Giant playback changes music and breathing with the round, returns to menu and does not replay stale packets', async () => {
  const oldDocument = globalThis.document,
    oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.fetch = async () =>
    Response.json({ settings: DEFAULT_SETTINGS, cues: {} });
  const audio = new GiantSound(),
    played: string[] = [],
    loops = new Map<string, string | null>();
  audio.play = (id) => {
    played.push(id);
  };
  audio.setLoop = (channel, id) => {
    loops.set(channel, id);
  };
  try {
    const next = snapshot(round());
    audio.update(next);
    assert.equal(loops.get('music'), 'music.build');
    assert.equal(loops.get('breathing'), 'ambience.breathing');
    assert.deepEqual(played, ['speech.start']);
    const escaped = structuredClone(next);
    escaped.world.clock += 100;
    escaped.world.phase = 'escape';
    audio.update(escaped);
    assert.equal(loops.get('breathing'), null);
    assert.equal(loops.get('music'), 'music.escape');
    played.length = 0;
    audio.update(next);
    audio.update(escaped);
    assert.deepEqual(played, []);
    audio.menu();
    assert.equal(loops.get('music'), 'music.menu');
  } finally {
    audio.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});
