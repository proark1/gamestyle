import { audioAdminFetch } from './audio-admin-request.mjs';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const origin = process.argv[2];
if (!origin || new URL(origin).protocol !== 'https:')
  throw new Error('Specify the live HTTPS game origin.');
async function api(game, body) {
  const response = await audioAdminFetch(
    `${origin}/api/handwerker/audio/${game}`,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        Origin: origin,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    },
  );
  const value = await response.json();
  assert.equal(
    response.status,
    200,
    `${game}: ${value.error || response.status}`,
  );
  return value;
}
const before = await api('chaos');
assert.equal(
  before.cues.length,
  259,
  'the new catalog must be live before testing writes',
);
const tick = before.cues.find((c) => c.id === 'timer.tick');
assert.ok(tick);
// Save the current prompt unchanged. This tests the real write path without changing the intended sound.
await api('chaos', { op: 'cue', cueId: tick.id, config: tick });
await api('chaos', { op: 'volume', cueId: tick.id, volume: tick.volume });
const after = await api('chaos');
const saved = after.cues.find((c) => c.id === tick.id);
for (const key of ['prompt', 'text', 'duration', 'loop', 'volume'])
  assert.equal(saved[key], tick[key], key);
const beforeFiles = before.cues
  .filter((c) => c.file)
  .map((c) => [c.id, c.file, c.generated]);
assert.deepEqual(
  after.cues.filter((c) => c.file).map((c) => [c.id, c.file, c.generated]),
  beforeFiles,
);
assert.deepEqual(after.settings, before.settings);
const voices = {};
for (const game of ['chaos', 'first-person']) {
  const data = await api(game);
  assert.equal(data.keySaved, true);
  const result = await api(game, { op: 'voices' });
  assert.ok(result.voices.length > 0);
  voices[game] = {
    available: result.voices.length,
    savedVoiceAvailable: result.voices.some(
      (v) => v.id === data.settings.voiceId,
    ),
  };
}
const wrongOrigin = await audioAdminFetch(
  `${origin}/api/handwerker/audio/chaos`,
  {
    method: 'POST',
    headers: {
      Origin: 'https://example.invalid',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ op: 'volume', cueId: tick.id, volume: tick.volume }),
    signal: AbortSignal.timeout(15000),
  },
);
assert.equal(wrongOrigin.status, 403);
for (const path of [
  '/api/health',
  '/chaos',
  '/chaos/admin',
  '/first-person/admin',
]) {
  const page = await audioAdminFetch(origin + path, {
    method: 'HEAD',
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(page.status, 200, path);
}
const report = {
  at: new Date().toISOString(),
  origin,
  prompts: after.cues.length,
  existingFiles: beforeFiles.length,
  promptSave: 'passed',
  volumeSave: 'passed',
  settingsPreserved: true,
  recordingsPreserved: true,
  crossOriginRejected: true,
  providerConnections: voices,
};
await mkdir('outputs', { recursive: true });
await writeFile(
  'outputs/live-audio-edit-check.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
