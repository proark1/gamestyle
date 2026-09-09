import { audioAdminFetch } from '../../../scripts/audio-admin-request.mjs';
// One-time recovery of the imported game's existing public audio library.
// Run on the destination service. Defaults to a read-only plan; --apply restores
// only an empty library, with files written before an atomic database update.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const origin = 'https://game-production-ff1d.up.railway.app';
const game = 'chaos';
const databasePath = resolve(
  process.env.DATABASE_PATH || 'data/stack-or-sink.sqlite',
);
const audioDirectory = resolve(dirname(databasePath), 'audio');
const apply = process.argv.includes('--apply');
const db = new DatabaseSync(databasePath, { readOnly: !apply });
db.exec('PRAGMA busy_timeout = 5000');
const current = () => ({
  settings:
    db
      .prepare(
        'SELECT settings, lease_until FROM audio_settings WHERE game = ?',
      )
      .get(game) ?? null,
  cues: db
    .prepare(
      'SELECT cue, config, file, generated, generated_config, error, request FROM audio_cues WHERE game = ? ORDER BY cue',
    )
    .all(game),
});
const fingerprint = (cue, settings) =>
  JSON.stringify({
    prompt: cue.prompt,
    ...(cue.category === 'speech'
      ? {
          text: cue.text,
          voiceId: cue.voiceId || settings.voiceId,
          language: 'en',
        }
      : { duration: cue.duration, loop: cue.loop }),
  });
try {
  const before = current();
  assert.equal(
    before.cues.length,
    0,
    'Destination has saved audio entries; refusing to overwrite them',
  );
  assert.ok(
    !before.settings || before.settings.lease_until < Date.now(),
    'Destination generation is busy',
  );
  const response = await audioAdminFetch(`${origin}/api/audio/${game}`, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  assert.equal(response.status, 200);
  const library = await response.json();
  assert.equal(library.game, game);
  assert.equal(library.busy, false, 'Source generation is busy');
  const cues = library.cues.filter((cue) => cue.file);
  assert.ok(cues.length > 0, 'Source has no recordings');
  for (const cue of cues) {
    assert.match(cue.file, /^chaos\/[a-f0-9-]{36}\.mp3$/);
    assert.ok(cue.id && cue.prompt && typeof cue.stale === 'boolean');
  }
  console.log(
    JSON.stringify({
      mode: apply ? 'restore' : 'plan',
      game,
      recordings: cues.length,
      stale: cues.filter((c) => c.stale).length,
      destinationEntries: before.cues.length,
    }),
  );
  if (apply) {
    const backupDirectory = resolve(
      dirname(databasePath),
      'audio-migrations',
      `chaos-${Date.now()}`,
    );
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    await writeFile(
      resolve(backupDirectory, 'before.json'),
      JSON.stringify(before),
      { flag: 'wx', mode: 0o600 },
    );
    await writeFile(
      resolve(backupDirectory, 'source.json'),
      JSON.stringify({ settings: library.settings, cues }),
      { flag: 'wx', mode: 0o600 },
    );
    await mkdir(resolve(audioDirectory, game), {
      recursive: true,
      mode: 0o700,
    });
    const files = [...new Set(cues.map((cue) => cue.file))];
    const hashes = {};
    let bytes = 0;
    for (let i = 0; i < files.length; i += 4) {
      await Promise.all(
        files.slice(i, i + 4).map(async (file) => {
          const response = await audioAdminFetch(
            `${origin}/api/audio/${game}/file/${file.split('/')[1]}`,
            { signal: AbortSignal.timeout(60000), redirect: 'error' },
          );
          assert.equal(response.status, 200, file);
          assert.ok(
            response.headers.get('content-type')?.startsWith('audio/'),
            file,
          );
          const data = Buffer.from(await response.arrayBuffer());
          assert.ok(
            data.length > 128 && data.length < 50_000_000,
            `Invalid audio size: ${file}`,
          );
          const path = resolve(audioDirectory, file);
          try {
            await writeFile(path, data, { flag: 'wx', mode: 0o600 });
          } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            assert.ok(
              (await readFile(path)).equals(data),
              `Existing file differs: ${file}`,
            );
          }
          hashes[file] = createHash('sha256').update(data).digest('hex');
          bytes += data.length;
        }),
      );
      if (i % 40 === 0)
        console.log(
          `Copied ${Math.min(i + 4, files.length)}/${files.length} audio files`,
        );
    }
    await writeFile(
      resolve(backupDirectory, 'sha256.json'),
      JSON.stringify(hashes),
      { flag: 'wx', mode: 0o600 },
    );
    db.exec('BEGIN IMMEDIATE');
    try {
      assert.deepEqual(
        current(),
        before,
        'Destination changed during copying; no database entries updated',
      );
      db.prepare(
        'INSERT INTO audio_settings (game, settings) VALUES (?, ?) ON CONFLICT(game) DO UPDATE SET settings = excluded.settings',
      ).run(game, JSON.stringify(library.settings));
      const insert = db.prepare(
        'INSERT INTO audio_cues (game, cue, config, file, generated, generated_config, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
      );
      for (const cue of cues) {
        const { file, generated, error, stale, ...config } = cue;
        insert.run(
          game,
          cue.id,
          JSON.stringify(config),
          file,
          generated,
          stale
            ? 'restored-stale-recording'
            : fingerprint(cue, library.settings),
          error || '',
        );
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    console.log(
      JSON.stringify({
        restored: cues.length,
        files: files.length,
        bytes,
        backupDirectory,
      }),
    );
  }
} finally {
  db.close();
}
