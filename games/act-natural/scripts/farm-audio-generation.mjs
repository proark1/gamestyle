import { audioAdminFetch } from '../../../scripts/audio-admin-request.mjs';
import {
  farmDetailCatalog,
  farmNaturalAdditions,
} from '../audio/detail-catalog.ts';

// Preview by default. After publishing the catalog, pass --generate to create only
// missing clips from this approved pass, using the workshop's saved provider key.
const origin = process.env.GAME_TEST_URL || 'http://127.0.0.1:3012';
const endpoint = new URL('/api/audio/act-natural', origin);
const generate = process.argv.includes('--generate');
const read = async () => {
  const response = await audioAdminFetch(endpoint, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`Workshop returned HTTP ${response.status}.`);
  return response.json();
};
const library = await read();
const selection = process.argv.includes('--all-details')
  ? farmDetailCatalog
  : farmNaturalAdditions;
const added = selection.map((cue) => {
  const saved = library.cues.find((item) => item.id === cue.id);
  if (!saved)
    throw new Error(
      `Publish the farm sound update first: ${cue.id} is not in this workshop.`,
    );
  return saved;
});
const missing = added.filter((cue) => !cue.file);
console.log(
  `${added.length} farm details; ${added.length - missing.length} already saved; ${missing.length} missing.`,
);
if (!generate) {
  console.log(
    'Preview only. Pass --generate to use the saved ElevenLabs key for the missing clips.',
  );
  for (const cue of missing)
    console.log(`${cue.id}: ${cue.duration}s — ${cue.name}`);
} else {
  if (!library.keyAvailable && !library.keySaved)
    throw new Error(
      'Save an ElevenLabs key in the workshop before generating.',
    );
  if (library.busy)
    throw new Error(
      'The workshop is already generating. Let that job finish first.',
    );
  for (const cue of missing) {
    const current = await read();
    if (current.cues.find((item) => item.id === cue.id)?.file) continue;
    if (current.busy)
      throw new Error('Another generation started. Stopping this queue.');
    const requestId = crypto.randomUUID();
    console.log(`Generating ${cue.id}; request ${requestId}.`);
    // Never retry an uncertain paid request automatically; the service retains
    // request IDs and prevents replay. A resumed queue rechecks saved files.
    const response = await audioAdminFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: endpoint.origin },
      body: JSON.stringify({ op: 'generate', cueId: cue.id, requestId }),
      signal: AbortSignal.timeout(210_000),
    });
    if (!response.ok)
      throw new Error(
        `Generation stopped at ${cue.id}, HTTP ${response.status}. Check the workshop before retrying.`,
      );
    const updated = await read();
    if (!updated.cues.find((item) => item.id === cue.id)?.file)
      throw new Error(
        `No saved file confirmed for ${cue.id}; inspect the workshop before retrying.`,
      );
    console.log(`Saved ${cue.id}.`);
  }
  console.log(
    'All new farm recordings are saved. Audition them in the workshop before approving the final mix.',
  );
}
