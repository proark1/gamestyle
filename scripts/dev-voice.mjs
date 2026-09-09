import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const binary =
  process.env.LIVEKIT_BINARY ||
  (process.platform === 'win32'
    ? 'work/livekit/livekit-server.exe'
    : 'livekit-server');
if (process.platform === 'win32' && !existsSync(binary))
  throw new Error(
    'Install the official LiveKit server into work/livekit, or set LIVEKIT_BINARY. See docs/audio-setup.md.',
  );
const voice = spawn(
  binary,
  ['--dev', '--config', 'config/livekit.local.yaml'],
  { stdio: 'inherit', windowsHide: true },
);
const env = {
  ...process.env,
  GAME_RUNTIME: 'node',
  DATABASE_PATH: process.env.DATABASE_PATH || 'data/voice-preview.sqlite',
  LIVEKIT_URL: 'ws://127.0.0.1:18880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'secret',
};
let game,
  closing = false;
const migrate = spawn(process.execPath, ['scripts/migrate.mjs'], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});
migrate.on('exit', (code) => {
  if (closing) return;
  if (code) {
    closing = true;
    voice.kill();
    process.exitCode = code;
    return;
  }
  game = spawn(
    process.execPath,
    [
      'node_modules/vinext/dist/cli.js',
      'dev',
      '--hostname',
      '127.0.0.1',
      ...process.argv.slice(2),
    ],
    { env, stdio: 'inherit', windowsHide: true },
  );
  game.on('exit', (code) => {
    closing = true;
    voice.kill();
    process.exitCode = code || 0;
  });
});
voice.on('error', (error) => {
  closing = true;
  console.error(error.message);
  game?.kill();
  migrate.kill();
  process.exitCode = 1;
});
voice.on('exit', (code) => {
  if (!closing) {
    closing = true;
    game?.kill();
    migrate.kill();
    console.error(
      'The local Voice server stopped. Check its message and the ports in config/livekit.local.yaml.',
    );
    process.exitCode = code || 1;
  }
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    closing = true;
    game?.kill();
    migrate.kill();
    voice.kill();
  });
