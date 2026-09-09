import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  GAME_RUNTIME: 'node',
  DATABASE_PATH: process.env.DATABASE_PATH || 'data/peer-preview.sqlite',
};
let child;
let closing = false;
function run(args) {
  child = spawn(process.execPath, args, {
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  return child;
}
run(['scripts/migrate.mjs']).on('exit', (code) => {
  if (closing || code) {
    process.exitCode = code || 0;
    return;
  }
  run([
    'node_modules/vinext/dist/cli.js',
    'dev',
    '--hostname',
    '127.0.0.1',
    ...process.argv.slice(2),
  ]).on('exit', (code) => {
    process.exitCode = code || 0;
  });
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    closing = true;
    child?.kill();
  });
