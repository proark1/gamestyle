import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function runSmokeProcess(args, env = {}) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  await new Promise((success, failure) => {
    child.once('error', failure);
    child.once('exit', (code, signal) =>
      code === 0
        ? success()
        : failure(
            new Error(
              `Smoke command failed (${code ?? signal}): ${args.join(' ')}`,
            ),
          ),
    );
  });
}

/** Own one localhost process and one isolated database; always stop the owned server. */
export async function withSmokeServer(kind, run, options = {}) {
  if (!['production', 'installed'].includes(kind))
    throw Error('Unknown smoke server kind.');
  const port = options.port ?? (kind === 'production' ? 4194 : 4173);
  const origin = `http://127.0.0.1:${port}`;
  try {
    await fetch(origin, {
      signal: AbortSignal.timeout(1000),
      redirect: 'manual',
    });
    throw Error(`Smoke port ${port} is already in use.`);
  } catch (error) {
    if (error.message?.includes('already in use')) throw error;
  }
  mkdirSync('.tmp/platform-audit', { recursive: true });
  const env = {
    ...process.env,
    PUBLIC_GAME_ORIGIN: origin,
    DATABASE_PATH: resolve(`.tmp/platform-audit/server-${randomUUID()}.sqlite`),
    AUDIO_ADMIN_PASSWORD: 'local-smoke-admin-only-0123456789',
    SMOKE_ADMIN_PASSWORD: 'local-smoke-admin-only-0123456789',
    SMOKE_URL: origin,
    ...options.env,
  };
  if (kind === 'production')
    await runSmokeProcess(['scripts/migrate.mjs'], env);
  const args =
    kind === 'production'
      ? [
          'node_modules/vinext/dist/cli.js',
          'start',
          '--hostname',
          '127.0.0.1',
          '--port',
          String(port),
        ]
      : [
          'node_modules/vite/bin/vite.js',
          'preview',
          '--config',
          'vite.client.config.ts',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--strictPort',
        ];
  const log = createWriteStream(`.tmp/platform-audit/${kind}-server.log`);
  const child = spawn(process.execPath, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  let failure;
  child.once('error', (error) => {
    failure = error;
  });
  const exited = new Promise((success) => child.once('exit', success));
  try {
    const deadline = Date.now() + 60000;
    let ready = false;
    while (Date.now() < deadline) {
      if (failure) throw failure;
      if (child.exitCode !== null)
        throw Error(`${kind} smoke server exited before readiness.`);
      try {
        const response = await fetch(origin, {
          redirect: 'manual',
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Startup is bounded by the deadline. */
      }
      await new Promise((success) => setTimeout(success, 250));
    }
    if (!ready) throw Error(`${kind} smoke server did not become ready.`);
    return await run(env);
  } finally {
    if (child.exitCode === null) child.kill();
    let timer;
    await Promise.race([
      exited,
      new Promise((success) => {
        timer = setTimeout(() => {
          child.kill('SIGKILL');
          success();
        }, 3000);
      }),
    ]);
    clearTimeout(timer);
    log.end();
  }
}
