import { spawn } from 'node:child_process';

const run = (command, args) =>
  spawn(command, args, { stdio: 'inherit', env: process.env });

function finished(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

const migration = await finished(
  run(process.execPath, ['scripts/migrate.mjs']),
);
if (migration.code !== 0) {
  console.error('Database migration failed; web service was not started.');
  process.exit(1);
}

const web = run(process.execPath, [
  'node_modules/vinext/dist/cli.js',
  'start',
  '--hostname',
  '0.0.0.0',
]);

let stopping = false;
let finalizing = false;
async function finalize() {
  if (stopping || finalizing) return;
  finalizing = true;
  try {
    const result = await finished(
      run(process.execPath, ['--import', 'tsx', 'scripts/finalize-ranked.ts']),
    );
    if (result.code !== 0)
      console.error(
        'Ranked finalization failed; next hourly check will retry.',
      );
  } catch (error) {
    console.error('Ranked finalization could not start:', error);
  } finally {
    finalizing = false;
  }
}

// The command is idempotent and uses the same mounted SQLite file as the web service.
// Start after migration, then retry hourly without depending on leaderboard traffic.
const firstCheck = setTimeout(() => void finalize(), 15_000);
const hourlyCheck = setInterval(() => void finalize(), 60 * 60 * 1000);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopping = true;
    clearTimeout(firstCheck);
    clearInterval(hourlyCheck);
    web.kill(signal);
  });

const result = await finished(web);
stopping = true;
clearTimeout(firstCheck);
clearInterval(hourlyCheck);
process.exit(result.code ?? (result.signal ? 1 : 0));
