import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteAdapter } from '../../db/node';
import { getCatalog } from '../../platform/audio/catalog';
import { encryptKey, decryptKey } from './crypto';
import {
  library,
  manifest,
  parseCue,
  updateAudio,
} from '../../platform/audio/service';
import { DEFAULT_SETTINGS } from './types';
import { generationRequest, generateAudio, elevenRequest } from './provider';
import { promptLimit } from './limits';

const master = 'ac'.repeat(32),
  fakeKey = 'sk_test_audio_placeholder_123456789';
void test('delivery reuses saved music and matching effects without generation, preserving edits and game-specific dialogue', async () => {
  const { db, storage, sqlite } = setup();
  try {
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'key', key: fakeKey },
      storage,
    );
    await updateAudio(
      db,
      'stack-or-sink',
      {
        op: 'settings',
        settings: { ...DEFAULT_SETTINGS, voiceId: 'savedVoice' },
      },
      storage,
    );
    let calls = 0;
    const provider: typeof fetch = async () => {
      calls++;
      return new Response(new Uint8Array(100), {
        headers: { 'content-type': 'audio/mpeg' },
      });
    };
    for (const cueId of [
      'music.build',
      'step.wood.1',
      'event.ui',
      'speech.start',
    ]) {
      await updateAudio(
        db,
        'stack-or-sink',
        { op: 'generate', cueId, requestId: crypto.randomUUID() },
        storage,
        provider,
      );
    }
    await updateAudio(
      db,
      'uphill-delivery',
      { op: 'volume', cueId: 'event.ui', volume: 0.17 },
      storage,
    );
    const source = await library(db, 'stack-or-sink');
    const before = calls;
    const result = await updateAudio(
      db,
      'uphill-delivery',
      { op: 'reuse', sourceGame: 'stack-or-sink' },
      storage,
      provider,
    );
    assert.ok('reused' in result);
    assert.equal(result.reused, 2);
    assert.equal(calls, before);
    const delivery = await library(db, 'uphill-delivery');
    assert.equal(delivery.settings.voiceId, 'savedVoice');
    const cue = delivery.cues.find((c) => c.id === 'music.build')!;
    assert.equal(
      cue.file,
      source.cues.find((c) => c.id === 'music.build')!.file,
    );
    assert.equal(cue.stale, false);
    assert.ok(
      manifest(delivery).cues['music.build'].url.startsWith(
        '/api/audio/stack-or-sink/file/',
      ),
    );
    assert.equal(delivery.cues.find((c) => c.id === 'event.ui')!.volume, 0.17);
    assert.equal(
      delivery.cues.find((c) => c.id === 'speech.start')!.file,
      null,
    );
    const again = await updateAudio(
      db,
      'uphill-delivery',
      { op: 'reuse', sourceGame: 'stack-or-sink' },
      storage,
      provider,
    );
    assert.ok('reused' in again);
    assert.equal(again.reused, 0);
    await updateAudio(
      db,
      'uphill-delivery',
      {
        op: 'cue',
        cueId: cue.id,
        config: { ...cue, prompt: 'A new gentle alpine music loop.' },
      },
      storage,
    );
    assert.equal(
      (await library(db, 'uphill-delivery')).cues.find((c) => c.id === cue.id)!
        .stale,
      true,
    );
    await assert.rejects(
      updateAudio(
        db,
        'uphill-delivery',
        { op: 'reuse', sourceGame: '../private' },
        storage,
      ),
    );
    sqlite
      .prepare('UPDATE audio_settings SET lease_until = ? WHERE game = ?')
      .run(Date.now() + 10_000, 'uphill-delivery');
    await assert.rejects(
      updateAudio(
        db,
        'uphill-delivery',
        { op: 'reuse', sourceGame: 'act-natural' },
        storage,
      ),
      /current generation/,
    );
  } finally {
    sqlite.close();
  }
});
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('drizzle/0001_round_xorn.sql', 'utf8'));
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
void test('voice list exposes descriptions and safe sample URLs without private provider fields', async () => {
  const { db, storage, sqlite } = setup();
  try {
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'key', key: fakeKey },
      storage,
    );
    const result = await updateAudio(
      db,
      'stack-or-sink',
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
void test('saved per-sound volume reaches the game without regeneration and preserves custom prompts', async () => {
  const { db, storage, sqlite, files } = setup();
  try {
    await updateAudio(db, 'act-natural', { op: 'key', key: fakeKey }, storage);
    let calls = 0;
    const provider: typeof fetch = async () => {
      calls++;
      return new Response(new Uint8Array(100), {
        headers: { 'content-type': 'audio/mpeg' },
      });
    };
    const cueId = 'item.key.grab';
    await updateAudio(
      db,
      'act-natural',
      { op: 'generate', cueId, requestId: crypto.randomUUID() },
      storage,
      provider,
    );
    const before = (await library(db, 'act-natural')).cues.find(
      (c) => c.id === cueId,
    )!;
    await updateAudio(
      db,
      'act-natural',
      { op: 'volume', cueId, volume: 0.35 },
      storage,
      provider,
    );
    const data = await library(db, 'act-natural'),
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
      .run(customPrompt, 'act-natural', cueId);
    await updateAudio(
      db,
      'act-natural',
      { op: 'volume', cueId, volume: 0 },
      storage,
      provider,
    );
    const custom = (await library(db, 'act-natural')).cues.find(
      (c) => c.id === cueId,
    )!;
    assert.equal(custom.volume, 0);
    assert.equal(custom.prompt, customPrompt.trim());
    assert.equal(custom.file, before.file);
    assert.equal(calls, 1);
    assert.equal(
      (await library(db, 'stack-or-sink')).cues[0].volume,
      getCatalog('stack-or-sink')[0].volume,
    );
    for (const volume of [-0.1, 1.01, NaN, '0.5'])
      await assert.rejects(
        updateAudio(
          db,
          'act-natural',
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
    await updateAudio(db, 'act-natural', { op: 'key', key: fakeKey }, storage);
    const cueId = 'item.key.unlock';
    await updateAudio(
      db,
      'act-natural',
      { op: 'generate', cueId, requestId: crypto.randomUUID() },
      storage,
      async () =>
        new Response(new Uint8Array(100), {
          headers: { 'content-type': 'audio/mpeg' },
        }),
    );
    const oldFile = (await library(db, 'act-natural')).cues.find(
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
      'act-natural',
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
    await updateAudio(db, 'act-natural', { op: 'cancel', requestId }, storage);
    await rejected;
    assert.equal(wasAborted, true);
    const data = await library(db, 'act-natural');
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
    for (const game of ['stack-or-sink', 'act-natural'] as const)
      await updateAudio(db, game, { op: 'key', key: fakeKey }, storage);
    const requestId = crypto.randomUUID();
    await updateAudio(db, 'act-natural', { op: 'cancel', requestId }, storage);
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
        'act-natural',
        { op: 'generate', cueId: 'item.key.unlock', requestId },
        storage,
        provider,
      ),
      /Generation cancelled/,
    );
    assert.equal(calls, 0);
    assert.equal((await library(db, 'act-natural')).busy, false);
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'generate', cueId: 'material.crate.place', requestId },
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
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'key', key: fakeKey },
      storage,
    );
    const requestId = crypto.randomUUID();
    await assert.rejects(
      updateAudio(
        db,
        'stack-or-sink',
        { op: 'generate', cueId: 'material.crate.place', requestId },
        storage,
        async () => {
          await updateAudio(
            db,
            'stack-or-sink',
            { op: 'cancel', requestId },
            storage,
          );
          return new Response(new Uint8Array(100), {
            headers: { 'content-type': 'audio/mpeg' },
          });
        },
      ),
      /Generation cancelled/,
    );
    assert.equal(files.size, 0);
    assert.equal((await library(db, 'stack-or-sink')).busy, false);
  } finally {
    sqlite.close();
  }
});
void test('every default fits its provider limit; oversized effects are rejected before a provider request', async () => {
  for (const game of [
    'stack-or-sink',
    'act-natural',
    'uphill-delivery',
  ] as const) {
    for (const cue of getCatalog(game)) {
      assert.ok(
        cue.prompt.length <= promptLimit(cue.category),
        `${game}/${cue.id}: ${cue.prompt.length}`,
      );
      generationRequest(cue, { ...DEFAULT_SETTINGS, voiceId: 'testVoice' });
    }
  }
  const cue = getCatalog('act-natural').find((c) => c.id === 'item.key.grab')!;
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
void test('keys are encrypted, authenticated per game and never returned to the browser', async () => {
  const encrypted = await encryptKey(fakeKey, master, 'stack-or-sink');
  assert.ok(!encrypted.includes(fakeKey));
  assert.equal(await decryptKey(encrypted, master, 'stack-or-sink'), fakeKey);
  await assert.rejects(decryptKey(encrypted, master, 'act-natural'));
  await assert.rejects(decryptKey(encrypted, 'bc'.repeat(32), 'stack-or-sink'));
  const { db, storage, sqlite } = setup();
  try {
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'key', key: fakeKey },
      storage,
    );
    const raw = sqlite.prepare('SELECT secret FROM audio_settings').get() as {
      secret: string;
    };
    assert.ok(!raw.secret.includes(fakeKey));
    const result = await library(db, 'stack-or-sink');
    assert.equal(result.keySaved, true);
    assert.ok(!JSON.stringify(result).includes(fakeKey));
    assert.ok(!JSON.stringify(result).includes(raw.secret));
    assert.equal((await library(db, 'act-natural')).keySaved, false);
    await updateAudio(db, 'stack-or-sink', { op: 'delete-key' }, storage);
    assert.equal((await library(db, 'stack-or-sink')).keySaved, false);
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
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'key', key: fakeKey },
      storage,
    );
    const cue = getCatalog('stack-or-sink')[0],
      requestId = crypto.randomUUID();
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'generate', cueId: cue.id, requestId },
      storage,
      mock,
    );
    assert.equal(calls, 1);
    assert.equal(files.size, 1);
    let data = await library(db, 'stack-or-sink');
    assert.ok(data.cues[0].file);
    assert.equal(data.cues[0].stale, false);
    assert.equal(Object.keys(manifest(data).cues).length, 1);
    assert.equal(
      Object.keys(manifest(await library(db, 'act-natural')).cues).length,
      2,
    );
    await assert.rejects(
      updateAudio(
        db,
        'stack-or-sink',
        { op: 'generate', cueId: cue.id, requestId },
        storage,
        mock,
      ),
    );
    assert.equal(calls, 1);
    await updateAudio(
      db,
      'stack-or-sink',
      {
        op: 'cue',
        cueId: cue.id,
        config: { ...cue, prompt: cue.prompt + ' Softer contact.' },
      },
      storage,
    );
    data = await library(db, 'stack-or-sink');
    assert.equal(data.cues[0].stale, true);
    const oldFile = data.cues[0].file;
    await assert.rejects(
      updateAudio(
        db,
        'stack-or-sink',
        { op: 'generate', cueId: cue.id, requestId: crypto.randomUUID() },
        storage,
        async () => new Response(fakeKey, { status: 401 }),
      ),
    );
    data = await library(db, 'stack-or-sink');
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
    await updateAudio(
      db,
      'stack-or-sink',
      { op: 'key', key: fakeKey },
      storage,
    );
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
      'stack-or-sink',
      {
        op: 'generate',
        cueId: getCatalog('stack-or-sink')[0].id,
        requestId: crypto.randomUUID(),
      },
      storage,
      mock,
    );
    await started;
    assert.equal((await library(db, 'stack-or-sink')).busy, true);
    await assert.rejects(
      updateAudio(
        db,
        'stack-or-sink',
        {
          op: 'generate',
          cueId: getCatalog('stack-or-sink')[1].id,
          requestId: crypto.randomUUID(),
        },
        storage,
        mock,
      ),
    );
    release();
    await first;
    assert.equal(calls, 1);
    assert.equal((await library(db, 'stack-or-sink')).busy, false);
  } finally {
    release?.();
    sqlite.close();
  }
});
void test('speech uses separate delivery tags, English text and selected voice; music uses actual music API', () => {
  const speech = getCatalog('stack-or-sink').find(
    (c) => c.category === 'speech',
  )!;
  assert.throws(() => generationRequest(speech, DEFAULT_SETTINGS));
  const request = generationRequest(speech, {
    ...DEFAULT_SETTINGS,
    voiceId: 'voice_123',
  });
  assert.match(request.path, /text-to-speech\/voice_123/);
  assert.match(JSON.stringify(request.body), /eleven_v3/);
  assert.equal(request.body.language_code, 'en');
  assert.equal(
    speech.text,
    'Sixty seconds to build. Keep a way up for everyone.',
  );
  assert.throws(() =>
    parseCue(speech, { ...speech, prompt: 'Speak cheerfully in English' }),
  );
  const music = getCatalog('stack-or-sink').find(
    (c) => c.category === 'music',
  )!;
  assert.match(generationRequest(music, DEFAULT_SETTINGS).path, /^\/music\?/);
  assert.throws(() => parseCue(music, { ...music, duration: 200 }));
});
