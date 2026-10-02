import { runIsolatedPeer } from './peer-integration-runner.mjs';
import { GAME_IDS } from '../shared/games/identity.ts';
import { existsSync } from 'node:fs';

// Isolate native WebRTC teardown between games, including on Windows.
for (const game of process.argv.length > 2
  ? process.argv.slice(2)
  : GAME_IDS.filter((game) =>
      existsSync(new URL(`../games/${game}/peer.ts`, import.meta.url)),
    )) {
  const result = await runIsolatedPeer(
    game,
    [
      '--import',
      'tsx',
      game === 'cage-clash'
        ? 'games/cage-clash/scripts/peer-integration.mjs'
        : 'scripts/peer-integration-client.mjs',
      game,
    ],
    { timeoutMs: game === 'reel-problems-2' ? 300_000 : 180_000 },
  );
  if (result.forcedCleanup)
    console.log(
      `${game}: completed checks; the isolated native WebRTC process needed bounded cleanup.`,
    );
}
console.log(
  'All requested peer integrations passed with real local WebRTC and generated audio. Physical devices and restrictive networks require separate checks.',
);
