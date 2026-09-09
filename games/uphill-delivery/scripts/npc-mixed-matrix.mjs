// Full depot starts for every mixed roster and all five interruption variants.
// These are scripted control tests, not recorded human playtests.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const seconds = Number(process.argv[2] ?? 900);
const output = resolve(
  process.argv[3] ?? 'docs/superpowers/validation/uphill-delivery-npcs/mixed',
);
const concurrency = Number(process.argv[4] ?? 3);
if (
  !Number.isFinite(seconds) ||
  seconds <= 0 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 6
)
  throw new Error('Use a positive time limit and one to six workers.');
mkdirSync(output, { recursive: true });
const jobs = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [2, 2],
  [3, 1],
].flatMap(([humans, bots]) =>
  Array.from({ length: 5 }, (_, variant) => ({ humans, bots, variant })),
);
const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const name = `mixed-${job.humans}-${job.bots}-${job.variant}`;
    const report = join(output, `${name}.json`);
    let log = '';
    const exitCode = await new Promise((done, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          fileURLToPath(new URL('./npc-mixed-check.mjs', import.meta.url)),
          String(job.humans),
          String(job.bots),
          String(job.variant),
          String(seconds),
          `--report=${report}`,
        ],
        { windowsHide: true },
      );
      child.stdout.on('data', (chunk) => {
        log += chunk;
      });
      child.stderr.on('data', (chunk) => {
        log += chunk;
      });
      child.on('error', reject);
      child.on('close', done);
    });
    writeFileSync(join(output, `${name}.log`), log);
    let result;
    try {
      result = JSON.parse(readFileSync(report, 'utf8'));
    } catch {
      result = { ...job, phase: 'error' };
    }
    const entry = { ...result, exitCode };
    results.push(entry);
    console.log(
      JSON.stringify({
        completed: results.length,
        total: jobs.length,
        humans: job.humans,
        bots: job.bots,
        variant: job.variant,
        phase: result.phase,
        seconds: result.seconds,
        ignoredStopFrames: result.ignoredStopFrames,
      }),
    );
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
results.sort(
  (a, b) => a.humans - b.humans || a.bots - b.bots || a.variant - b.variant,
);
const passed = results.filter(
  (r) =>
    r.exitCode === 0 && r.phase === 'delivered' && r.ignoredStopFrames === 0,
).length;
const consistentRevision =
  new Set(results.map((r) => r.revision)).size === 1 &&
  results.every((r) => r.revision);
const consistentDriver =
  new Set(results.map((r) => r.driverRevision)).size === 1 &&
  results.every((r) => r.driverRevision);
const summary = {
  driver: 'scripted controls; not a human playtest',
  limitSeconds: seconds,
  passed,
  total: jobs.length,
  consistentRevision: !!consistentRevision,
  consistentDriver: !!consistentDriver,
  results,
};
writeFileSync(
  join(output, 'matrix.json'),
  JSON.stringify(summary, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    passed,
    total: jobs.length,
    consistentRevision,
    consistentDriver,
  }),
);
if (passed !== jobs.length || !consistentRevision || !consistentDriver)
  process.exitCode = 1;
