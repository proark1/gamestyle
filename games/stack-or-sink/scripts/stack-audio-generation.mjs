import { audioAdminFetch } from '../../../scripts/audio-admin-request.mjs';
// Preview: node --import tsx games/stack-or-sink/scripts/stack-audio-generation.mjs https://your-game
// Append --generate to create only missing recordings from this cinematic pass.
import { randomUUID } from 'node:crypto';
import { stackDetailCatalog } from '../audio/detail-catalog.ts';

const [originArg, action] = process.argv.slice(2);
if (!originArg || (action && action !== '--generate'))
  throw new Error('Provide the game origin and optional --generate.');
const url = new URL(originArg);
if (
  url.username ||
  url.password ||
  (url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(url.hostname)
    ))
)
  throw new Error(
    'Use HTTPS or a local development origin without credentials.',
  );
const endpoint = new URL('/api/audio/stack-or-sink', url.origin);
async function api(body) {
  const response = await audioAdminFetch(endpoint, {
    method: body ? 'POST' : 'GET',
    headers: {
      Origin: url.origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(body ? 240000 : 20000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(
      `Workshop returned HTTP ${response.status}. Check the workshop before retrying; completed recordings are preserved.`,
    );
  return response.json();
}
const library = await api();
const saved = new Map(library.cues.map((cue) => [cue.id, cue]));
if (stackDetailCatalog.some((cue) => !saved.has(cue.id)))
  throw new Error(
    'Publish the cinematic Stack catalog before generating. No audio was changed.',
  );
const missing = stackDetailCatalog.filter((cue) => !saved.get(cue.id).file);
console.log(
  `${stackDetailCatalog.length} cinematic cues; ${missing.length} missing; ${stackDetailCatalog.length - missing.length} already saved.`,
);
console.log(
  `${missing.reduce((sum, cue) => sum + saved.get(cue.id).duration, 0).toFixed(1)} seconds of requested audio.`,
);
if (action !== '--generate') {
  console.log(
    'Preview only. Pass --generate to use the workshop’s saved ElevenLabs key.',
  );
  for (const cue of missing)
    console.log(`${cue.id}: ${saved.get(cue.id).duration}s`);
} else {
  if (!library.keyAvailable)
    throw new Error(
      'The workshop needs an ElevenLabs key. No generation started.',
    );
  for (const cue of missing) {
    const current = await api();
    if (current.cues.find((item) => item.id === cue.id)?.file) continue;
    if (current.busy)
      throw new Error('Another job is running. Stopping this queue.');
    const requestId = randomUUID();
    console.log(`Generating ${cue.id}; request ${requestId}.`);
    // One attempt only. Never retry an uncertain paid request automatically.
    await api({ op: 'generate', cueId: cue.id, requestId });
    const updated = await api();
    if (!updated.cues.find((item) => item.id === cue.id)?.file)
      throw new Error(
        `No saved file confirmed for ${cue.id}. Inspect the workshop before retrying.`,
      );
    console.log(`Saved ${cue.id}.`);
  }
  console.log(
    'New recordings saved. Audition the complete round before approving acoustic quality.',
  );
}
