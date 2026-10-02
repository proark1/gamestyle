import { runSmokeProcess, withSmokeServer } from './smoke-server.mjs';
const mode = process.argv[2];
if (!['production', 'games', 'mobile'].includes(mode))
  throw Error('Use production, games or mobile smoke mode.');
await withSmokeServer(
  mode === 'production' ? 'production' : 'installed',
  async (env) => {
    if (mode === 'production') {
      await runSmokeProcess(
        ['--import', 'tsx', 'scripts/platform-pages-smoke.mjs'],
        env,
      );
      await runSmokeProcess(['scripts/diagnostics-browser-smoke.mjs'], env);
    } else {
      await runSmokeProcess(
        [
          `scripts/${mode === 'games' ? 'browser-smoke' : 'mobile-ui-smoke'}.mjs`,
          ...process.argv.slice(3),
        ],
        env,
      );
    }
  },
);
