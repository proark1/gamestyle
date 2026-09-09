import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteAdapter } from '../../db/node';
import { updateAudio, library, manifest } from './service';
import { narratorState } from './narrator';
import { NARRATOR_DEFAULTS } from '../../shared/audio/narrator-config';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('drizzle/0001_round_xorn.sql', 'utf8'));
  const db = sqliteAdapter(sqlite);
  const files = new Map<string, Uint8Array>();
  const storage = {
    masterKey: async () => 'ab'.repeat(32),
    putAudio: async (file: string, bytes: Uint8Array) => {
      files.set(file, bytes);
    },
  };
  const calls: {
    url: string;
    body: Record<string, unknown>;
    key: string | null;
  }[] = [];
  const provider: typeof fetch = async (url, options) => {
    assert.equal(typeof url, 'string');
    assert.equal(typeof options?.body, 'string');
    const path = url as string;
    calls.push({
      url: path,
      body: JSON.parse(options?.body as string),
      key: new Headers(options?.headers).get('xi-api-key'),
    });
    if (path.includes('/design'))
      return Response.json({
        previews: [1, 2, 3].map((id) => ({
          generated_voice_id: `audition_${id}`,
          media_type: 'audio/mpeg',
          audio_base_64: btoa('a'.repeat(100)),
        })),
      });
    if (path.endsWith('/text-to-voice'))
      return Response.json({ voice_id: 'shared_voice' });
    return new Response(new Uint8Array(100), {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  };
  const act = (
    op: string,
    fields: Record<string, unknown> = {},
    game: 'stack-or-sink' | 'act-natural' = 'stack-or-sink',
  ) => updateAudio(db, game, { op, ...fields }, storage, provider);
  return { sqlite, db, storage, files, calls, act };
}
void test('shared narrator auditions persist, selection is reused, both games keep their mixes and speech uses the owning account', async () => {
  const { sqlite, db, files, calls, act } = setup();
  try {
    await act('key', { key: 'sk_source_account_placeholder' });
    await act(
      'settings',
      { settings: { ...DEFAULT_SETTINGS, effects: 0.3 } },
      'act-natural',
    );
    await act('narrator-design', { config: NARRATOR_DEFAULTS });
    const audition = (await narratorState(db)).audition!;
    assert.equal(audition.previews.length, 3);
    assert.equal(files.size, 3);
    assert.equal(calls[0].body.model_id, 'eleven_ttv_v3');
    assert.equal(
      calls[0].body.voice_description,
      NARRATOR_DEFAULTS.description,
    );
    assert.equal(calls[0].body.text, NARRATOR_DEFAULTS.text);
    // A later draft must never be substituted for the description that made an audition.
    await act('narrator-save', {
      config: { ...NARRATOR_DEFAULTS, name: 'New draft' },
    });
    await act(
      'narrator-select',
      { previewId: audition.previews[0].id },
      'act-natural',
    );
    await act('narrator-select', { previewId: audition.previews[0].id });
    assert.equal(
      calls.filter((c) => c.url.endsWith('/text-to-voice')).length,
      1,
    );
    assert.equal(calls[1].body.voice_name, NARRATOR_DEFAULTS.name);
    const second = await library(db, 'act-natural');
    assert.equal(second.settings.voiceId, 'shared_voice');
    assert.equal(second.settings.effects, 0.3);
    assert.equal(second.keyAvailable, true);
    assert.equal(second.keySaved, false);
    await db
      .prepare('DELETE FROM audio_settings WHERE game = ?')
      .bind('uphill-delivery')
      .run();
    const delivery = await library(db, 'uphill-delivery');
    assert.equal(delivery.settings.voiceId, 'shared_voice');
    assert.equal(delivery.keyAvailable, true);
    assert.equal(
      (await library(db, 'stack-or-sink')).settings.voiceId,
      'shared_voice',
    );
    assert.ok(!JSON.stringify(manifest(second)).includes('audition'));
    await act(
      'key',
      { key: 'sk_different_account_placeholder' },
      'act-natural',
    );
    const cue = second.cues.find((c) => c.category === 'speech')!;
    await act(
      'generate',
      { cueId: cue.id, requestId: crypto.randomUUID() },
      'act-natural',
    );
    assert.equal(calls.at(-1)?.key, 'sk_source_account_placeholder');
    await act(
      'narrator-speak',
      { text: 'There goes the house. Magnificent.' },
      'act-natural',
    );
    assert.equal(
      calls.at(-1)?.body.text,
      '[playfully]\nThere goes the house. Magnificent.',
    );
    assert.ok(
      !String(calls.at(-1)?.body.text).includes(NARRATOR_DEFAULTS.description),
    );
    assert.ok(
      (await narratorState(db)).sample?.url.startsWith(
        '/api/audio/act-natural/file/',
      ),
    );
    assert.equal((await narratorState(db)).busy, false);
  } finally {
    sqlite.close();
  }
});
void test('invalid narrator inputs and stale selections never reach the provider; failures retain auditions and release the lease', async () => {
  const { sqlite, db, storage, calls, act } = setup();
  try {
    await act('key', { key: 'sk_source_account_placeholder' });
    await assert.rejects(
      act('narrator-design', {
        config: { ...NARRATOR_DEFAULTS, text: 'short' },
      }),
      /100/,
    );
    await assert.rejects(
      act('narrator-select', { previewId: 'unknown' }),
      /no longer/,
    );
    await assert.rejects(act('narrator-speak', { text: '' }), /spoken text/);
    assert.equal(calls.length, 0);
    await act('narrator-design', { config: NARRATOR_DEFAULTS });
    const before = (await narratorState(db)).audition;
    await assert.rejects(
      updateAudio(
        db,
        'act-natural',
        { op: 'narrator-design', config: NARRATOR_DEFAULTS },
        storage,
        async () => Response.json({}, { status: 429 }),
      ),
      /API key/,
    );
    await assert.rejects(
      updateAudio(
        db,
        'stack-or-sink',
        { op: 'narrator-design', config: NARRATOR_DEFAULTS },
        storage,
        async () => Response.json({}, { status: 429 }),
      ),
      /limit/,
    );
    assert.deepEqual((await narratorState(db)).audition, before);
    assert.equal((await narratorState(db)).busy, false);
    await db
      .prepare('UPDATE audio_settings SET lease_until = ? WHERE game = ?')
      .bind(Date.now() + 50000, 'shared-narrator')
      .run();
    await assert.rejects(
      act('narrator-design', { config: NARRATOR_DEFAULTS }),
      /busy/,
    );
    assert.equal(calls.length, 1);
  } finally {
    sqlite.close();
  }
});
