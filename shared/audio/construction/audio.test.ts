import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteAdapter } from '../../../db/node';
import { getCatalog } from '../../../platform/audio/construction/catalog';
import { encryptKey, decryptKey } from '../crypto';
import {
  library,
  manifest,
  parseCue,
  updateAudio,
} from '../../../platform/audio/construction/service';
import { DEFAULT_SETTINGS } from './types';
import { generationRequest, generateAudio, elevenRequest } from './provider';
import { promptLimit } from '../limits';
import { firstPersonMaterial } from '../../../games/first-person/audio/material-prompts';
import { recording } from './material-prompts';
import { CATALOG } from '../../../games/chaos/catalog';
import { firstPersonCue } from '../../../games/first-person/audio-events';
import { chaosCue } from '../../../games/chaos/audio-events';
import {
  freshWorld,
  applyAction,
  STATIONS,
  type Builder,
} from '../../../games/first-person/model';

const master = 'ac'.repeat(32),
  fakeKey = 'sk_test_audio_placeholder_123456789';
void test('Brick by Hand can securely reuse the saved construction account without replacing its settings or files', async () => {
  const { db, storage, sqlite } = setup();
  try {
    await assert.rejects(
      updateAudio(
        db,
        'first-person',
        { op: 'reuse-setup', from: 'chaos' },
        storage,
      ),
    );
    await updateAudio(db, 'chaos', { op: 'key', key: fakeKey }, storage);
    await updateAudio(
      db,
      'chaos',
      {
        op: 'settings',
        settings: { ...DEFAULT_SETTINGS, voiceId: 'savedVoice' },
      },
      storage,
    );
    const result = await updateAudio(
      db,
      'first-person',
      { op: 'reuse-setup', from: 'chaos' },
      storage,
    );
    assert.ok(!JSON.stringify(result).includes(fakeKey));
    const row = sqlite
      .prepare('SELECT secret FROM audio_settings WHERE game = ?')
      .get('first-person') as { secret: string };
    assert.equal(await decryptKey(row.secret, master, 'first-person'), fakeKey);
    assert.equal(
      (await library(db, 'first-person')).settings.voiceId,
      'savedVoice',
    );
    const own = 'sk_separate_saved_account_123456789';
    await updateAudio(db, 'first-person', { op: 'key', key: own }, storage);
    await updateAudio(
      db,
      'first-person',
      {
        op: 'settings',
        settings: { ...DEFAULT_SETTINGS, effects: 0.31, voiceId: 'ownVoice' },
      },
      storage,
    );
    await updateAudio(
      db,
      'first-person',
      { op: 'reuse-setup', from: 'chaos' },
      storage,
    );
    const kept = sqlite
      .prepare('SELECT secret FROM audio_settings WHERE game = ?')
      .get('first-person') as { secret: string };
    assert.equal(await decryptKey(kept.secret, master, 'first-person'), own);
    const after = await library(db, 'first-person');
    assert.equal(after.settings.effects, 0.31);
    assert.equal(after.settings.voiceId, 'ownVoice');
    await assert.rejects(
      updateAudio(
        db,
        'chaos',
        { op: 'reuse-setup', from: 'first-person' },
        storage,
      ),
    );
  } finally {
    sqlite.close();
  }
});
void test('voice list exposes descriptions and safe sample URLs without private provider fields', async () => {
  const { db, storage, sqlite } = setup();
  try {
    await updateAudio(db, 'chaos', { op: 'key', key: fakeKey }, storage);
    const result = await updateAudio(
      db,
      'chaos',
      { op: 'voices' },
      storage,
      async () =>
        Response.json({
          voices: [
            {
              voice_id: 'sample',
              name: 'Sample',
              description: 'Warm voice',
              labels: { accent: 'German' },
              preview_url: 'https://storage.googleapis.com/sample.mp3',
              private_metadata: fakeKey,
            },
            {
              voice_id: 'custom',
              name: 'Custom',
              preview_url: 'javascript:alert(1)',
            },
            { voice_id: 'empty', name: 'No sample', preview_url: null },
          ],
        }),
    );
    assert.ok('voices' in result);
    if (!('voices' in result) || !result.voices)
      throw new Error('Expected voice list');
    assert.equal(result.voices[0].description, 'Warm voice');
    assert.equal(result.voices[0].labels.accent, 'German');
    assert.equal(
      result.voices[0].previewUrl,
      'https://storage.googleapis.com/sample.mp3',
    );
    assert.equal(result.voices[1].previewUrl, null);
    assert.equal(result.voices[2].previewUrl, null);
    assert.ok(!JSON.stringify(result).includes(fakeKey));
  } finally {
    sqlite.close();
  }
});
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    readFileSync(
      'shared/audio/construction/fixtures/upstream-migrations/0001_audio.sql',
      'utf8',
    ),
  );
  sqlite.exec(
    readFileSync(
      'shared/audio/construction/fixtures/upstream-migrations/0003_audio_cancellation.sql',
      'utf8',
    ),
  );
  const db = sqliteAdapter(sqlite),
    files = new Map<string, Uint8Array>();
  const storage = {
    masterKey: async () => master,
    putAudio: async (file: string, bytes: Uint8Array) => {
      files.set(file, bytes);
    },
  };
  return { db, sqlite, files, storage };
}
void test('stairs use available timber Foley immediately and keep their own editable volume and custom recording', async () => {
  const { db, sqlite } = setup();
  try {
    const data = await library(db, 'chaos');
    const floor = data.cues.find((c) => c.id === 'material.floor.place')!,
      stairs = data.cues.find((c) => c.id === 'material.stairs.place')!;
    floor.file = 'chaos/floor.mp3';
    stairs.volume = 0.35;
    assert.equal(
      manifest(data).cues['material.stairs.place'].url,
      '/api/handwerker/audio/chaos/file/floor.mp3',
    );
    assert.equal(manifest(data).cues['material.stairs.place'].volume, 0.35);
    stairs.file = 'chaos/stairs.mp3';
    assert.equal(
      manifest(data).cues['material.stairs.place'].url,
      '/api/handwerker/audio/chaos/file/stairs.mp3',
    );
    assert.ok(data.cues.some((c) => c.id === 'step.wood'));
  } finally {
    sqlite.close();
  }
});
void test('saved per-sound volume reaches the game without regeneration and preserves custom prompts', async () => {
  const { db, storage, sqlite, files } = setup();
  try {
    await updateAudio(db, 'first-person', { op: 'key', key: fakeKey }, storage);
    let calls = 0;
    const provider: typeof fetch = async () => {
      calls++;
      return new Response(new Uint8Array(100), {
        headers: { 'content-type': 'audio/mpeg' },
      });
    };
    const cueId = 'material.cement.grab';
    await updateAudio(
      db,
      'first-person',
      { op: 'generate', cueId, requestId: crypto.randomUUID() },
      storage,
      provider,
    );
    const before = (await library(db, 'first-person')).cues.find(
      (c) => c.id === cueId,
    )!;
    await updateAudio(
      db,
      'first-person',
      { op: 'volume', cueId, volume: 0.35 },
      storage,
      provider,
    );
    const data = await library(db, 'first-person'),
      after = data.cues.find((c) => c.id === cueId)!;
    assert.equal(after.volume, 0.35);
    assert.equal(manifest(data).cues[cueId].volume, 0.35);
    assert.equal(after.file, before.file);
    assert.equal(after.generated, before.generated);
    assert.equal(after.prompt, before.prompt);
    assert.equal(after.stale, false);
    assert.equal(calls, 1);
    assert.equal(files.size, 1);
    const customPrompt = 'Custom '.repeat(80);
    sqlite
      .prepare(
        "UPDATE audio_cues SET config = json_set(config, '$.prompt', ?) WHERE game = ? AND cue = ?",
      )
      .run(customPrompt, 'first-person', cueId);
    await updateAudio(
      db,
      'first-person',
      { op: 'volume', cueId, volume: 0 },
      storage,
      provider,
    );
    const custom = (await library(db, 'first-person')).cues.find(
      (c) => c.id === cueId,
    )!;
    assert.equal(custom.volume, 0);
    assert.equal(custom.prompt, customPrompt.trim());
    assert.equal(custom.file, before.file);
    assert.equal(calls, 1);
    assert.equal((await library(db, 'chaos')).cues[0].volume, 1);
    for (const volume of [-0.1, 1.01, NaN, '0.5'])
      await assert.rejects(
        updateAudio(
          db,
          'first-person',
          { op: 'volume', cueId, volume },
          storage,
          provider,
        ),
        /Volume/,
      );
  } finally {
    sqlite.close();
  }
});
void test('stop aborts the active provider request, preserves prior audio and releases the game lock', async () => {
  const { db, storage, sqlite, files } = setup();
  try {
    await updateAudio(db, 'first-person', { op: 'key', key: fakeKey }, storage);
    const cueId = 'material.cement.pour';
    await updateAudio(
      db,
      'first-person',
      { op: 'generate', cueId, requestId: crypto.randomUUID() },
      storage,
      async () =>
        new Response(new Uint8Array(100), {
          headers: { 'content-type': 'audio/mpeg' },
        }),
    );
    const oldFile = (await library(db, 'first-person')).cues.find(
      (c) => c.id === cueId,
    )!.file;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let wasAborted = false;
    const requestId = crypto.randomUUID();
    const pending = updateAudio(
      db,
      'first-person',
      { op: 'generate', cueId, requestId },
      storage,
      async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener(
            'abort',
            () => {
              wasAborted = true;
              reject(new Error('Aborted'));
            },
            { once: true },
          );
          entered();
        }),
    );
    const rejected = assert.rejects(pending, /Generation cancelled/);
    await started;
    await updateAudio(db, 'first-person', { op: 'cancel', requestId }, storage);
    await rejected;
    assert.equal(wasAborted, true);
    const data = await library(db, 'first-person');
    assert.equal(data.busy, false);
    assert.equal(data.cues.find((c) => c.id === cueId)!.file, oldFile);
    assert.equal(files.size, 1);
  } finally {
    sqlite.close();
  }
});
void test('a stop arriving before generation prevents billing and stays isolated to its game', async () => {
  const { db, storage, sqlite } = setup();
  try {
    for (const game of ['chaos', 'first-person'] as const)
      await updateAudio(db, game, { op: 'key', key: fakeKey }, storage);
    const requestId = crypto.randomUUID();
    await updateAudio(db, 'first-person', { op: 'cancel', requestId }, storage);
    let calls = 0;
    const provider: typeof fetch = async () => {
      calls++;
      return new Response(new Uint8Array(100), {
        headers: { 'content-type': 'audio/mpeg' },
      });
    };
    await assert.rejects(
      updateAudio(
        db,
        'first-person',
        { op: 'generate', cueId: 'material.cement.pour', requestId },
        storage,
        provider,
      ),
      /Generation cancelled/,
    );
    assert.equal(calls, 0);
    assert.equal((await library(db, 'first-person')).busy, false);
    await updateAudio(
      db,
      'chaos',
      { op: 'generate', cueId: 'material.bricks.place', requestId },
      storage,
      provider,
    );
    assert.equal(calls, 1);
  } finally {
    sqlite.close();
  }
});
void test('cancel during audio delivery prevents a new file from replacing the previous sound', async () => {
  const { db, storage, sqlite, files } = setup();
  try {
    await updateAudio(db, 'chaos', { op: 'key', key: fakeKey }, storage);
    const requestId = crypto.randomUUID();
    await assert.rejects(
      updateAudio(
        db,
        'chaos',
        { op: 'generate', cueId: 'material.bricks.place', requestId },
        storage,
        async () => {
          await updateAudio(db, 'chaos', { op: 'cancel', requestId }, storage);
          return new Response(new Uint8Array(100), {
            headers: { 'content-type': 'audio/mpeg' },
          });
        },
      ),
      /Generation cancelled/,
    );
    assert.equal(files.size, 0);
    assert.equal((await library(db, 'chaos')).busy, false);
  } finally {
    sqlite.close();
  }
});
void test('realistic Foley migration updates built-in prompts and keeps custom prompts and existing files', async () => {
  const { db, sqlite } = setup();
  try {
    const original =
      'Realistic close-miked construction Foley outdoors. Physically accurate weight and texture. One isolated action with a clean transient and short natural decay. No music, voices, cartoon boing, synthetic beep, distortion or exaggerated reverb. Pouring material into a stationary steel cement mixer drum: a paper cement sack, coarse paper crinkle and a soft dry powder hiss.';
    const cement = getCatalog('first-person').find(
      (c) => c.id === 'material.cement.pour',
    )!;
    const water = getCatalog('first-person').find(
      (c) => c.id === 'material.water.pour',
    )!;
    for (const cue of [
      { ...cement, prompt: original, duration: 2 },
      { ...water, prompt: 'My custom water recording prompt.' },
    ])
      sqlite
        .prepare(
          'INSERT INTO audio_cues (game, cue, config, file, generated_config) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          'first-person',
          cue.id,
          JSON.stringify(cue),
          'first-person/keep.mp3',
          'old',
        );
    sqlite.exec(
      readFileSync(
        'shared/audio/construction/fixtures/upstream-migrations/0004_realistic_foley.sql',
        'utf8',
      ),
    );
    sqlite.exec(
      readFileSync(
        'shared/audio/construction/fixtures/upstream-migrations/0005_sound_prompt_limit.sql',
        'utf8',
      ),
    );
    const data = await library(db, 'first-person');
    const changed = data.cues.find((c) => c.id === cement.id)!;
    assert.equal(changed.prompt, cement.prompt);
    assert.equal(changed.duration, 4);
    assert.equal(changed.file, 'first-person/keep.mp3');
    assert.equal(changed.stale, true);
    assert.equal(
      data.cues.find((c) => c.id === water.id)!.prompt,
      'My custom water recording prompt.',
    );
  } finally {
    sqlite.close();
  }
});
void test('every default fits its provider limit; oversized effects are rejected before a provider request', async () => {
  for (const game of ['chaos', 'first-person'] as const) {
    for (const cue of getCatalog(game)) {
      assert.ok(
        cue.prompt.length <= promptLimit(cue.category),
        `${game}/${cue.id}: ${cue.prompt.length}`,
      );
      generationRequest(cue, { ...DEFAULT_SETTINGS, voiceId: 'testVoice' });
    }
  }
  const cue = getCatalog('first-person').find(
    (c) => c.id === 'material.cement.grab',
  )!;
  assert.throws(
    () => parseCue(cue, { ...cue, prompt: 'a'.repeat(451) }),
    /450/,
  );
  let calls = 0;
  await assert.rejects(
    generateAudio(
      { ...cue, prompt: 'a'.repeat(451) },
      DEFAULT_SETTINGS,
      fakeKey,
      async () => {
        calls++;
        return new Response();
      },
    ),
    /450/,
  );
  assert.equal(calls, 0);
});
void test('prompt-limit migration preserves completed short prompts and long custom prompts', async () => {
  const { db, sqlite } = setup();
  try {
    const cues = getCatalog('first-person').filter(
      (c) => c.category === 'material',
    );
    for (const cue of cues) {
      const prompt =
        cue.id === 'material.cement.drop'
          ? 'Custom '.repeat(80)
          : firstPersonMaterial[cue.id.replace('material.', '')].sound +
            ' ' +
            recording;
      const config = { ...cue, prompt };
      sqlite
        .prepare(
          'INSERT INTO audio_cues (game, cue, config, file, generated_config) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          'first-person',
          cue.id,
          JSON.stringify(config),
          'first-person/keep.mp3',
          JSON.stringify({ prompt, duration: cue.duration, loop: cue.loop }),
        );
    }
    sqlite.exec(
      readFileSync(
        'shared/audio/construction/fixtures/upstream-migrations/0005_sound_prompt_limit.sql',
        'utf8',
      ),
    );
    const data = await library(db, 'first-person');
    for (const cue of data.cues
      .filter((c) => c.category === 'material')
      .slice(0, 9)) {
      assert.equal(cue.stale, false, cue.id);
      assert.equal(cue.file, 'first-person/keep.mp3');
    }
    assert.equal(
      data.cues.find((c) => c.id === 'material.cement.grab')!.prompt,
      cues.find((c) => c.id === 'material.cement.grab')!.prompt,
    );
    assert.equal(
      data.cues.find((c) => c.id === 'material.cement.drop')!.prompt,
      'Custom '.repeat(80).trim(),
    );
  } finally {
    sqlite.close();
  }
});
void test('provider failures explain known reasons without exposing raw error bodies or unknown codes', async () => {
  for (const field of ['code', 'status']) {
    await assert.rejects(
      elevenRequest('/sound-generation', fakeKey, {}, async () =>
        Response.json(
          { detail: { [field]: 'text_too_long', message: fakeKey } },
          { status: 400 },
        ),
      ),
      (e) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /prompt length/);
        assert.match(e.message, /HTTP 400; text_too_long/);
        assert.ok(!e.message.includes(fakeKey));
        return true;
      },
    );
  }
  await assert.rejects(
    elevenRequest('/sound-generation', fakeKey, {}, async () =>
      Response.json(
        { detail: { code: fakeKey, message: fakeKey } },
        { status: 503 },
      ),
    ),
    (e) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /temporary server error/);
      assert.ok(!e.message.includes(fakeKey));
      return true;
    },
  );
});
void test('English migration preserves saved work and audio while retiring German speech', async () => {
  const { db, sqlite } = setup();
  try {
    sqlite.exec(
      'CREATE TABLE rooms (world TEXT, version INTEGER); CREATE TABLE fp_rooms (world TEXT, version INTEGER);',
    );
    sqlite.prepare('INSERT INTO rooms VALUES (?, 3)').run(
      JSON.stringify({
        pieces: [{ id: 'keep-building' }],
        events: [{ text: 'Das war schon so!' }],
      }),
    );
    sqlite.prepare('INSERT INTO fp_rooms VALUES (?, 7)').run(
      JSON.stringify({
        parts: [{ id: 'keep-brick' }],
        inventories: { player: { mortar: 8 } },
        notice: { text: 'Mischer klemmt' },
      }),
    );
    const speech = getCatalog('chaos').find((c) => c.id === 'speech.saying.0')!;
    sqlite
      .prepare(
        'INSERT INTO audio_cues (game, cue, config, file, generated_config) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        'chaos',
        speech.id,
        JSON.stringify({
          ...speech,
          name: 'Baustellenspruch 1',
          group: 'Baustellenstimmen',
          text: 'Das war schon so!',
        }),
        'chaos/old-speech.mp3',
        JSON.stringify({
          prompt: speech.prompt,
          text: 'Das war schon so!',
          voiceId: 'voice_123',
        }),
      );
    sqlite.exec(
      readFileSync(
        'shared/audio/construction/fixtures/upstream-migrations/0002_english.sql',
        'utf8',
      ),
    );
    const data = await library(db, 'chaos'),
      translated = data.cues.find((c) => c.id === speech.id)!;
    assert.equal(translated.text, 'It was like that when I got here!');
    assert.equal(translated.name, speech.name);
    assert.equal(translated.group, speech.group);
    assert.equal(translated.file, 'chaos/old-speech.mp3');
    assert.equal(translated.stale, true);
    assert.equal(manifest(data).cues[speech.id], undefined);
    const readWorld = (table: string) =>
      JSON.parse(
        (
          sqlite.prepare(`SELECT world FROM ${table}`).get() as {
            world: string;
          }
        ).world,
      );
    assert.deepEqual(readWorld('rooms').pieces, [{ id: 'keep-building' }]);
    assert.deepEqual(readWorld('rooms').events, []);
    assert.deepEqual(readWorld('fp_rooms').parts, [{ id: 'keep-brick' }]);
    assert.equal(readWorld('fp_rooms').inventories.player.mortar, 8);
    assert.equal(readWorld('fp_rooms').notice, null);
  } finally {
    sqlite.close();
  }
});
void test('catalog covers every existing chaos object and its six physical actions with unique prompts', () => {
  for (const game of ['chaos', 'first-person'] as const) {
    const cues = getCatalog(game);
    assert.equal(new Set(cues.map((c) => c.id)).size, cues.length);
    assert.equal(
      cues.filter((c) => c.id.startsWith('speech.saying.')).length,
      12,
    );
    for (const c of cues) assert.doesNotThrow(() => parseCue(c, c));
  }
  const cues = getCatalog('chaos');
  for (const item of CATALOG)
    for (const action of ['grab', 'place', 'drop', 'remove', 'throw', 'impact'])
      assert.ok(cues.some((c) => c.id === `material.${item.id}.${action}`));
  const material = cues.filter((c) => c.category === 'material');
  assert.equal(new Set(material.map((c) => c.prompt)).size, material.length);
});
void test('keys are encrypted, authenticated per game and never returned to the browser', async () => {
  const encrypted = await encryptKey(fakeKey, master, 'chaos');
  assert.ok(!encrypted.includes(fakeKey));
  assert.equal(await decryptKey(encrypted, master, 'chaos'), fakeKey);
  await assert.rejects(decryptKey(encrypted, master, 'first-person'));
  await assert.rejects(decryptKey(encrypted, 'bc'.repeat(32), 'chaos'));
  const { db, storage, sqlite } = setup();
  try {
    await updateAudio(db, 'chaos', { op: 'key', key: fakeKey }, storage);
    const raw = sqlite.prepare('SELECT secret FROM audio_settings').get() as {
      secret: string;
    };
    assert.ok(!raw.secret.includes(fakeKey));
    const result = await library(db, 'chaos');
    assert.equal(result.keySaved, true);
    assert.ok(!JSON.stringify(result).includes(fakeKey));
    assert.ok(!JSON.stringify(result).includes(raw.secret));
    assert.equal((await library(db, 'first-person')).keySaved, false);
    await updateAudio(db, 'chaos', { op: 'delete-key' }, storage);
    assert.equal((await library(db, 'chaos')).keySaved, false);
  } finally {
    sqlite.close();
  }
});
void test('generation persists audio, detects changed prompts, isolates games and rejects duplicate requests', async () => {
  const { db, storage, sqlite, files } = setup();
  let calls = 0;
  const mock: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(
      (init!.headers as Record<string, string>)['xi-api-key'],
      fakeKey,
    );
    return new Response(new Uint8Array(100), {
      headers: { 'content-type': 'audio/mpeg' },
    });
  };
  try {
    await updateAudio(db, 'chaos', { op: 'key', key: fakeKey }, storage);
    const cue = getCatalog('chaos')[0],
      requestId = crypto.randomUUID();
    await updateAudio(
      db,
      'chaos',
      { op: 'generate', cueId: cue.id, requestId },
      storage,
      mock,
    );
    assert.equal(calls, 1);
    assert.equal(files.size, 1);
    let data = await library(db, 'chaos');
    assert.ok(data.cues[0].file);
    assert.equal(data.cues[0].stale, false);
    assert.equal(Object.keys(manifest(data).cues).length, 1);
    assert.equal(
      Object.keys(manifest(await library(db, 'first-person')).cues).length,
      0,
    );
    await assert.rejects(
      updateAudio(
        db,
        'chaos',
        { op: 'generate', cueId: cue.id, requestId },
        storage,
        mock,
      ),
    );
    assert.equal(calls, 1);
    await updateAudio(
      db,
      'chaos',
      {
        op: 'cue',
        cueId: cue.id,
        config: { ...cue, prompt: cue.prompt + ' Softer contact.' },
      },
      storage,
    );
    data = await library(db, 'chaos');
    assert.equal(data.cues[0].stale, true);
    const oldFile = data.cues[0].file;
    await assert.rejects(
      updateAudio(
        db,
        'chaos',
        { op: 'generate', cueId: cue.id, requestId: crypto.randomUUID() },
        storage,
        async () => new Response(fakeKey, { status: 401 }),
      ),
    );
    data = await library(db, 'chaos');
    assert.equal(data.cues[0].file, oldFile);
    assert.ok(data.cues[0].error);
    assert.ok(!JSON.stringify(data).includes(fakeKey));
    assert.equal(data.busy, false);
  } finally {
    sqlite.close();
  }
});
void test('per-game lease prevents concurrent billable requests', async () => {
  const { db, storage, sqlite } = setup();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let calls = 0;
  try {
    await updateAudio(db, 'chaos', { op: 'key', key: fakeKey }, storage);
    const mock: typeof fetch = async () => {
      calls++;
      entered();
      await pending;
      return new Response(new Uint8Array(100), {
        headers: { 'content-type': 'audio/mpeg' },
      });
    };
    const first = updateAudio(
      db,
      'chaos',
      {
        op: 'generate',
        cueId: getCatalog('chaos')[0].id,
        requestId: crypto.randomUUID(),
      },
      storage,
      mock,
    );
    await started;
    assert.equal((await library(db, 'chaos')).busy, true);
    await assert.rejects(
      updateAudio(
        db,
        'chaos',
        {
          op: 'generate',
          cueId: getCatalog('chaos')[1].id,
          requestId: crypto.randomUUID(),
        },
        storage,
        mock,
      ),
    );
    release();
    await first;
    assert.equal(calls, 1);
    assert.equal((await library(db, 'chaos')).busy, false);
  } finally {
    release?.();
    sqlite.close();
  }
});
void test('speech uses separate delivery tags, English text and selected voice; music uses actual music API', () => {
  const speech = getCatalog('chaos').find((c) => c.category === 'speech')!;
  assert.throws(() => generationRequest(speech, DEFAULT_SETTINGS));
  const request = generationRequest(speech, {
    ...DEFAULT_SETTINGS,
    voiceId: 'voice_123',
  });
  assert.match(request.path, /text-to-speech\/voice_123/);
  assert.match(JSON.stringify(request.body), /eleven_v3/);
  assert.equal(request.body.language_code, 'en');
  assert.equal(speech.text, 'It was like that when I got here!');
  assert.throws(() =>
    parseCue(speech, { ...speech, prompt: 'Speak cheerfully in English' }),
  );
  const music = getCatalog('chaos').find((c) => c.category === 'music')!;
  assert.match(generationRequest(music, DEFAULT_SETTINGS).path, /^\/music\?/);
  assert.throws(() => parseCue(music, { ...music, duration: 200 }));
});
void test('first-person actions resolve inventory-specific sounds and emit multiplayer events only once', () => {
  const world = freshWorld(),
    station = STATIONS.find((s) => s.id === 'cement')!;
  const builder: Builder = {
    id: 'builder',
    name: 'Test',
    color: 0,
    seen: 0,
    x: station.x,
    z: station.z,
    y: 1.8,
    yaw: 0,
    pitch: 0,
  };
  const next = applyAction(
    world,
    { type: 'supply', station: 'cement' },
    builder,
    1000,
    'one',
  );
  assert.equal(next.audioEvents?.[0].cue, 'material.cement.grab');
  assert.equal(
    firstPersonCue({ type: 'supply', station: 'cement' }, next, builder.id),
    'material.cement.drop',
  );
  assert.equal(
    firstPersonCue({ type: 'mixer' }, next, builder.id),
    'material.cement.pour',
  );
  assert.equal(
    applyAction(
      next,
      { type: 'supply', station: 'cement' },
      builder,
      1000,
      'one',
    ),
    next,
  );
  const p = { x: 0, y: 0.245, z: 0, rotation: 0 };
  world.beds.push({ ...p, key: 'bed', by: 'builder' });
  assert.equal(
    firstPersonCue(
      { type: 'place', kind: 'brick', placement: p },
      world,
      builder.id,
    ),
    'material.brick.wet',
  );
  assert.equal(
    chaosCue({
      id: 'e',
      at: 0,
      type: 'build',
      text: '',
      x: 0,
      z: 0,
      audioCue: 'material.wall.place',
    }),
    'material.wall.place',
  );
});
