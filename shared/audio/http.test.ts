import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAudioRoutes } from './http';

void test('both audio APIs can share authorization, public caching and bounded mutations', async (t) => {
  const previous = process.env.AUDIO_ADMIN_PASSWORD;
  const password = 'test-password-no-provider-123';
  process.env.AUDIO_ADMIN_PASSWORD = password;
  t.after(() => {
    if (previous === undefined) delete process.env.AUDIO_ADMIN_PASSWORD;
    else process.env.AUDIO_ADMIN_PASSWORD = previous;
  });
  let reads = 0,
    writes = 0;
  const routes = createAudioRoutes({
    isGame: (value): value is 'test' => value === 'test',
    library: async () => {
      reads++;
      return { cues: [], secretField: true };
    },
    manifest: (value) => ({ cues: value.cues }),
    update: async () => {
      writes++;
      return { ok: true };
    },
  });
  const context = { params: Promise.resolve({ game: 'test' }) };
  const get = (query = '', auth = '') =>
    routes.GET(
      new Request(`http://localhost/api/audio/test${query}`, {
        headers: { 'x-audio-admin': auth },
      }),
      context,
    );
  const post = (auth = '', body = '{}', origin = 'http://localhost') =>
    routes.POST(
      new Request('http://localhost/api/audio/test', {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          'x-audio-admin': auth,
        },
        body,
      }),
      context,
    );
  assert.equal((await get()).status, 401);
  assert.equal((await post()).status, 401);
  assert.equal(
    reads + writes,
    0,
    'Denied requests never reach storage or a paid provider',
  );
  const manifests = await Promise.all(
    Array.from({ length: 30 }, () => get('?manifest')),
  );
  assert.equal(reads, 1, 'Simultaneous public requests share one library load');
  assert.deepEqual(await manifests[0].json(), { cues: [] });
  assert.equal(
    (await post(password, '{}', 'https://evil.example')).status,
    403,
  );
  assert.equal((await post(password, 'x'.repeat(16_001))).status, 413);
  assert.equal(writes, 0);
  assert.equal((await post(password)).status, 200);
  await get('?manifest');
  assert.equal(reads, 2, 'An edit invalidates the public cache');
  assert.equal((await get('', password)).status, 200);
  delete process.env.AUDIO_ADMIN_PASSWORD;
  assert.equal((await post(password)).status, 503);
  assert.equal(
    (await get('?manifest')).status,
    200,
    'Playback works with no administrator configured',
  );
});
