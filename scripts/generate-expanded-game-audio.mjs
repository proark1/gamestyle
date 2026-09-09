// Resumable generation for the four approved libraries. Credentials stay in the environment.
// node scripts/generate-expanded-game-audio.mjs https://your-game GAME --generate
import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { audioAdminFetch } from './audio-admin-request.mjs';

const [originArg, game, action] = process.argv.slice(2);
const counts = {
  'four-brain-cells': 36,
  'reel-problems': 39,
  'wrong-floor': 46,
  'first-person': 61,
};
if (
  !Object.hasOwn(counts, game) ||
  !originArg ||
  (action && action !== '--generate')
)
  throw new Error(
    'Provide an HTTPS origin, one approved game ID, and optional --generate.',
  );
const origin = new URL(originArg);
if (origin.protocol !== 'https:' || origin.username || origin.password)
  throw new Error('Use an HTTPS origin without credentials.');
const apiUrl = `${origin.origin}/api/${game === 'first-person' ? 'handwerker/' : ''}audio/${game}`;
const directory = resolve('.tmp/audio-expansion-generation');
mkdirSync(directory, { recursive: true });
const journalFile = resolve(directory, `${game}-journal.json`);
const journal = existsSync(journalFile)
  ? JSON.parse(readFileSync(journalFile, 'utf8'))
  : [];
function save() {
  writeFileSync(journalFile, JSON.stringify(journal, null, 2));
}
async function api(body) {
  const res = await audioAdminFetch(apiUrl, {
    method: body ? 'POST' : 'GET',
    headers: {
      Origin: origin.origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(body ? 230000 : 25000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Workshop HTTP ${res.status}`);
  return data;
}
let library = await api();
if (library.cues.length !== counts[game])
  throw new Error(
    `Publish the expanded catalog first: ${library.cues.length}/${counts[game]} cues.`,
  );
const count = (data) => data.cues.filter((c) => c.file && !c.stale).length;
console.log(
  `${game}: ${count(library)}/${counts[game]} current recordings; ${library.cues
    .filter((c) => !c.file)
    .reduce((sum, c) => sum + c.duration, 0)
    .toFixed(1)} requested seconds.`,
);
if (action) {
  if (library.busy)
    throw new Error('Another generation is active. Resume after it finishes.');
  if (game === 'first-person' && !library.keySaved) {
    await api({ op: 'reuse-setup', from: 'chaos' });
    library = await api();
  }
  if (!(library.keyAvailable || library.keySaved))
    throw new Error('No saved audio account is available.');
  if (
    library.cues.some(
      (c) => c.category === 'speech' && !c.voiceId && !library.settings.voiceId,
    )
  )
    throw new Error('A saved narrator voice is required.');
  for (const item of journal.filter(
    (j) => j.status === 'pending' || j.status === 'uncertain',
  )) {
    const cue = library.cues.find((c) => c.id === item.cueId);
    if (cue?.file && !cue.stale) {
      item.status = 'saved';
      item.file = cue.file;
      save();
    } else
      throw new Error(
        `Inspect the uncertain paid request for ${item.cueId} before resuming. Request ${item.requestId}.`,
      );
  }
  for (const cue of library.cues) {
    const latest = await api(),
      current = latest.cues.find((c) => c.id === cue.id);
    if (current?.file && !current.stale) continue;
    if (current?.file)
      throw new Error(
        `Existing stale recording ${cue.id} needs review before replacement.`,
      );
    if (latest.busy)
      throw new Error('Another generation acquired the workshop.');
    const item = {
      cueId: cue.id,
      requestId: randomUUID(),
      status: 'pending',
      started: new Date().toISOString(),
    };
    journal.push(item);
    save();
    console.log(`${game}: generating ${cue.id}`);
    try {
      await api({ op: 'generate', cueId: cue.id, requestId: item.requestId });
      const after = await api(),
        saved = after.cues.find((c) => c.id === cue.id);
      if (!saved?.file || saved.stale)
        throw new Error(
          'The completed request did not publish a current recording.',
        );
      item.status = 'saved';
      item.file = saved.file;
      item.finished = new Date().toISOString();
      save();
      console.log(`${game}: saved ${count(after)}/${counts[game]} (${cue.id})`);
    } catch (error) {
      // Read after an uncertain response; never submit a replacement paid request automatically.
      const after = await api().catch(() => null),
        saved = after?.cues.find((c) => c.id === cue.id);
      item.error = error.message;
      if (saved?.file && !saved.stale) {
        item.status = 'saved';
        item.file = saved.file;
        save();
        continue;
      }
      item.status = 'uncertain';
      save();
      throw error;
    }
  }
  library = await api();
  writeFileSync(
    resolve(directory, `${game}-result.json`),
    JSON.stringify(
      {
        game,
        total: library.cues.length,
        recorded: count(library),
        verifiedAt: new Date().toISOString(),
        cues: library.cues.map(
          ({ id, name, category, file, generated, stale, error }) => ({
            id,
            name,
            category,
            file,
            generated,
            stale,
            error,
          }),
        ),
      },
      null,
      2,
    ),
  );
  if (count(library) !== counts[game])
    throw new Error('Some recordings are still missing or stale.');
  console.log(`${game}: COMPLETE ${count(library)}/${counts[game]}`);
}
