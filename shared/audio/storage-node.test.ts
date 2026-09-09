import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteAdapter } from '../../db/node';
import { masterKey, putAudio, getAudio, deleteAudio } from './storage-node';
import { encryptKey, decryptKey } from './crypto';
import { DEFAULT_SETTINGS, GAME_NAMES } from './types';
import { library, manifest, updateAudio } from '../../platform/audio/service';
void test('Node audio files and encryption master persist independently of the server process', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gamestyle-audio-test-'));
  const oldPath = process.env.DATABASE_PATH,
    oldMaster = process.env.AUDIO_MASTER_KEY;
  process.env.DATABASE_PATH = join(root, 'game.sqlite');
  delete process.env.AUDIO_MASTER_KEY;
  try {
    const first = await masterKey();
    assert.equal(first.length, 64);
    assert.equal(await masterKey(), first);
    const encrypted = await encryptKey(
      'fake-secret-for-storage-check',
      first,
      'stack-or-sink',
    );
    assert.equal(
      await decryptKey(encrypted, await masterKey(), 'stack-or-sink'),
      'fake-secret-for-storage-check',
    );
    const bytes = new Uint8Array([1, 2, 3, 4]);
    for (const game of Object.keys(GAME_NAMES)) {
      const path = `${game}/${crypto.randomUUID()}.mp3`;
      assert.equal(await getAudio(path), null);
      await putAudio(path, bytes);
      assert.deepEqual(new Uint8Array((await getAudio(path))!), bytes);
      await assert.rejects(putAudio(path, bytes));
      await deleteAudio(path);
      assert.equal(await getAudio(path), null);
      await deleteAudio(path);
    }
    for (const path of [
      'stack-or-sink/../../.master-key',
      `unknown-game/${crypto.randomUUID()}.mp3`,
      `dont-wake-the-giant/${crypto.randomUUID()}.mp3/extra`,
      `dont-wake-the-giant\\${crypto.randomUUID()}.mp3`,
      `dont-wake-the-giant/${crypto.randomUUID()}.wav`,
    ]) {
      await assert.rejects(getAudio(path));
      await assert.rejects(putAudio(path, bytes));
      await assert.rejects(deleteAudio(path));
    }
    const sqlite = new DatabaseSync(':memory:');
    try {
      sqlite.exec(readFileSync('drizzle/0001_round_xorn.sql', 'utf8'));
      const db = sqliteAdapter(sqlite);
      const storage = { masterKey, putAudio };
      const game = 'dont-wake-the-giant';
      await updateAudio(
        db,
        game,
        { op: 'key', key: 'sk_storage_test_placeholder' },
        storage,
      );
      await updateAudio(
        db,
        game,
        {
          op: 'settings',
          settings: { ...DEFAULT_SETTINGS, voiceId: 'test_voice' },
        },
        storage,
      );
      const clip = new Uint8Array(100).fill(7);
      let requests = 0;
      const provider: typeof fetch = async () => {
        requests++;
        return new Response(clip, {
          headers: { 'Content-Type': 'audio/mpeg' },
        });
      };
      for (const cueId of ['event.ui', 'speech.start']) {
        await updateAudio(
          db,
          game,
          {
            op: 'generate',
            cueId,
            requestId: crypto.randomUUID(),
          },
          storage,
          provider,
        );
        const saved = await library(db, game);
        const cue = saved.cues.find((cue) => cue.id === cueId)!;
        assert.ok(cue.file);
        assert.ok(cue.file.startsWith(`${game}/`));
        assert.deepEqual(new Uint8Array((await getAudio(cue.file))!), clip);
        assert.equal(cue.error, '');
        assert.equal(cue.stale, false);
        assert.equal(saved.busy, false);
        assert.equal(
          manifest(saved).cues[cueId].url,
          `/api/audio/${game}/file/${cue.file.split('/')[1]}`,
        );
      }
      assert.equal(requests, 2);
    } finally {
      sqlite.close();
    }
  } finally {
    if (oldPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = oldPath;
    if (oldMaster === undefined) delete process.env.AUDIO_MASTER_KEY;
    else process.env.AUDIO_MASTER_KEY = oldMaster;
    if (
      resolve(root).startsWith(join(resolve(tmpdir()), 'gamestyle-audio-test-'))
    )
      await rm(root, { recursive: true, force: true });
  }
});
