import { audioAdminFetch } from '../../../scripts/audio-admin-request.mjs';
// Preview: node --import tsx games/uphill-delivery/scripts/generate-delivery-details.mjs https://your-game
// Generate missing details only: append --generate. Existing files are preserved.
import { randomUUID } from 'node:crypto';
import { deliveryDetails } from '../audio/detail-catalog.ts';

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
const origin = url.origin;
async function api(body) {
  const response = await audioAdminFetch(
    `${origin}/api/audio/uphill-delivery`,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        Origin: origin,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(body ? 240000 : 20000),
      redirect: 'error',
    },
  );
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      value.error || `Workshop returned HTTP ${response.status}.`,
    );
  return value;
}
const library = await api();
const saved = new Map(library.cues.map((c) => [c.id, c]));
const unavailable = deliveryDetails.filter((c) => !saved.has(c.id));
if (unavailable.length)
  throw new Error(
    'Publish the expanded delivery catalog before generation. No sounds were changed.',
  );
const missing = deliveryDetails.filter((c) => !saved.get(c.id).file);
console.log(
  `${missing.length} missing delivery details; ${deliveryDetails.length - missing.length} already saved.`,
);
console.log(
  `Requested audio duration: ${missing.reduce((n, c) => n + saved.get(c.id).duration, 0).toFixed(1)} seconds.`,
);
if (action !== '--generate') {
  console.log(missing.map((c) => c.id).join('\n'));
} else {
  if (!library.keyAvailable)
    throw new Error(
      'Save an ElevenLabs key in the workshop first. No generation started.',
    );
  if (library.busy)
    throw new Error(
      'The workshop is already generating audio. Wait for it to finish.',
    );
  for (const cue of missing) {
    // Recheck immediately before a billable request, allowing interrupted runs
    // to resume and preserving files produced by another workshop tab.
    const latest = await api();
    if (latest.cues.find((c) => c.id === cue.id)?.file) continue;
    console.log(`Generating ${cue.name}…`);
    await api({ op: 'generate', cueId: cue.id, requestId: randomUUID() });
  }
  const result = await api();
  const remaining = deliveryDetails.filter(
    (c) => !result.cues.find((v) => v.id === c.id)?.file,
  );
  if (remaining.length)
    throw new Error(
      `${remaining.length} details remain missing; completed clips were preserved.`,
    );
  console.log(
    'All delivery details are saved. Audition the clips in the workshop before acoustic sign-off.',
  );
}
