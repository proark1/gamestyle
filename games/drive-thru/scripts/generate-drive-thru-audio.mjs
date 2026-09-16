import { audioAdminFetch } from '../../../scripts/audio-admin-request.mjs';
import { driveThruCatalog } from '../audio/catalog.ts';

// Usage:
// Preview: node --import tsx games/drive-thru/scripts/generate-drive-thru-audio.mjs
// Generate missing clips: node --import tsx games/drive-thru/scripts/generate-drive-thru-audio.mjs --generate
const origin = process.env.GAME_TEST_URL || 'http://127.0.0.1:3012';
const endpoint = new URL('/api/audio/drive-thru', origin);
const generate = process.argv.includes('--generate');

const read = async () => {
  const response = await audioAdminFetch(endpoint, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Workshop returned HTTP ${response.status}.`);
  }
  return response.json();
};

const library = await read();
const missing = driveThruCatalog.filter((cue) => {
  const saved = library.cues.find((item) => item.id === cue.id);
  return !saved || !saved.file;
});

console.log(
  `${driveThruCatalog.length} Drive-Thru Static cues; ${driveThruCatalog.length - missing.length} already saved; ${missing.length} missing.`,
);

if (!generate) {
  console.log(
    'Preview only. Pass --generate to generate missing audio clips with the workshop’s saved ElevenLabs key.',
  );
  for (const cue of missing) {
    console.log(`${cue.id} (${cue.duration}s) [${cue.category}]: ${cue.name}`);
  }
} else {
  if (!library.keyAvailable && !library.keySaved) {
    throw new Error(
      'Save an ElevenLabs key in the workshop before generating.',
    );
  }
  if (library.busy) {
    throw new Error(
      'The workshop is already busy generating. Wait for it to finish.',
    );
  }

  for (const cue of missing) {
    const current = await read();
    if (current.cues.find((item) => item.id === cue.id)?.file) continue;
    if (current.busy) {
      throw new Error('Another generation started. Stopping this queue.');
    }

    const requestId = crypto.randomUUID();
    console.log(`Generating ${cue.id}; request ${requestId}...`);

    const response = await audioAdminFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: endpoint.origin },
      body: JSON.stringify({ op: 'generate', cueId: cue.id, requestId }),
      signal: AbortSignal.timeout(210_000),
    });

    if (!response.ok) {
      throw new Error(
        `Generation stopped at ${cue.id}, HTTP ${response.status}.`,
      );
    }

    const updated = await read();
    if (!updated.cues.find((item) => item.id === cue.id)?.file) {
      throw new Error(
        `No saved file confirmed for ${cue.id}. Inspect the workshop.`,
      );
    }
    console.log(`Saved ${cue.id}.`);
  }
  console.log('All missing Drive-Thru Static clips successfully generated!');
}
