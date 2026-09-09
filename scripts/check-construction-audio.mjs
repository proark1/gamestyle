import { audioAdminFetch } from './audio-admin-request.mjs';
import fs from 'node:fs/promises';
import { dirname } from 'node:path';
const origin = process.argv[2] || 'http://127.0.0.1:3105';
const game = process.argv[3] || 'chaos';
const output = process.argv[4];
if (!['chaos', 'first-person'].includes(game)) throw new Error('Unknown game');
const response = await audioAdminFetch(
  `${origin}/api/handwerker/audio/${game}`,
  {
    signal: AbortSignal.timeout(15000),
  },
);
if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
const data = await response.json();
const playback = await audioAdminFetch(
  `${origin}/api/handwerker/audio/${game}?manifest=1`,
  {
    signal: AbortSignal.timeout(15000),
  },
);
if (!playback.ok) throw new Error(`Manifest HTTP ${playback.status}`);
const manifest = await playback.json();
if (
  'keySaved' in manifest ||
  'secret' in manifest ||
  Object.values(manifest.cues).some((c) => 'prompt' in c || 'text' in c)
)
  throw new Error('Private admin fields in playback manifest');
const files = Object.entries(manifest.cues),
  failures = [];
let checked = 0;
for (let i = 0; i < files.length; i += 6)
  await Promise.all(
    files.slice(i, i + 6).map(async ([id, cue]) => {
      const url = new URL(cue.url, origin);
      if (url.origin !== new URL(origin).origin)
        throw new Error('Unexpected media origin');
      try {
        const file = await audioAdminFetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(20000),
        });
        const type = file.headers.get('content-type') || '';
        const reader = file.body?.getReader();
        const head = await reader?.read();
        await reader?.cancel();
        if (!file.ok || !type.startsWith('audio/') || !head?.value?.length)
          failures.push({ id, status: file.status, type });
        checked++;
      } catch {
        failures.push({ id, error: 'Audio file unavailable' });
      }
    }),
  );
const report = {
  at: new Date().toISOString(),
  origin,
  game,
  cues: data.cues.length,
  keySaved: data.keySaved,
  voiceSelected: !!data.settings.voiceId,
  generationBusy: data.busy,
  storedFiles: data.cues.filter((c) => c.file).length,
  playbackFiles: files.length,
  checked,
  failures,
  missing: data.cues.filter((c) => !c.file).map((c) => c.id),
  outdated: data.cues.filter((c) => c.stale).map((c) => c.id),
  errors: data.cues
    .filter((c) => c.error)
    .map((c) => ({ id: c.id, error: c.error })),
  categories: Object.fromEntries(
    [...new Set(data.cues.map((c) => c.category))].map((category) => [
      category,
      {
        prompts: data.cues.filter((c) => c.category === category).length,
        files: data.cues.filter((c) => c.category === category && c.file)
          .length,
      },
    ]),
  ),
};
if (output) {
  await fs.mkdir(dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(
  JSON.stringify(
    {
      ...report,
      missing: report.missing.length,
      outdated: report.outdated.length,
      errors: report.errors.length,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
