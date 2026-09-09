import { audioAdminFetch } from '../../../scripts/audio-admin-request.mjs';
import assert from 'node:assert/strict';
import { getCatalog } from '../../../platform/audio/catalog.ts';

const origin = process.env.GAME_TEST_URL || 'http://127.0.0.1:3021';
const endpoint = `${origin}/api/audio/dont-wake-the-giant`;
const get = async () => {
  const response = await audioAdminFetch(endpoint);
  assert.equal(response.status, 200);
  return response.json();
};
const post = (body, requestOrigin = origin) =>
  audioAdminFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
    body: JSON.stringify(body),
  });
assert.equal(
  (await audioAdminFetch(`${origin}/dont-wake-the-giant/admin`)).status,
  200,
);
assert.equal(
  (await audioAdminFetch(`${origin}/dont-wake-the-giant`)).status,
  200,
);
const before = await get();
assert.deepEqual(
  before.cues.map((c) => c.id),
  getCatalog('dont-wake-the-giant').map((c) => c.id),
);
assert.equal(before.cues.filter((c) => c.category === 'speech').length, 14);
const cue = before.cues.find((c) => c.id === 'speech.start');
assert.equal(
  (
    await post(
      { op: 'volume', cueId: cue.id, volume: 0.27 },
      'https://untrusted.example',
    )
  ).status,
  403,
);
try {
  assert.equal(
    (
      await post({
        op: 'cue',
        cueId: cue.id,
        config: { ...cue, text: 'Quiet feet. Mind the sleeping giant.' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await get()).cues.find((c) => c.id === cue.id).text,
    'Quiet feet. Mind the sleeping giant.',
  );
  assert.equal(
    (await post({ op: 'volume', cueId: cue.id, volume: 0.27 })).status,
    200,
  );
  const edited = (await get()).cues.find((c) => c.id === cue.id);
  assert.equal(edited.volume, 0.27);
  assert.equal(edited.file, cue.file);
  const manifest = await (
    await audioAdminFetch(`${endpoint}?manifest=1`)
  ).json();
  assert.equal('keySaved' in manifest, false);
  assert.equal('keyAvailable' in manifest, false);
  assert.ok(
    !Object.values(manifest.cues).some((c) => 'prompt' in c || 'text' in c),
  );
  assert.equal(
    (await audioAdminFetch(`${endpoint}/file/not-a-file`)).status,
    404,
  );
} finally {
  assert.equal(
    (await post({ op: 'cue', cueId: cue.id, config: cue })).status,
    200,
  );
}
console.log(
  `Giant audio workshop: ${before.cues.length} cues, routes, prompt/volume persistence, origin checks and public manifest passed. No audio generated.`,
);
