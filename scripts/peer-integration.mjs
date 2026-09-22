import { spawn } from 'node:child_process';
import { GAME_IDS } from '../shared/games/identity.ts';
import { existsSync } from 'node:fs';

// Isolate native WebRTC teardown between games, including on Windows.
for (const game of process.argv.length > 2
  ? process.argv.slice(2)
  : GAME_IDS.filter((game) =>
      existsSync(new URL(`../games/${game}/peer.ts`, import.meta.url)),
    )) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/peer-integration-client.mjs', game],
      {
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    child.on('error', reject);
    child.on('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`${game} failed (${signal || code})`)),
    );
  });
}
console.log(
  'All requested peer integrations passed with real local WebRTC and generated audio. Physical devices and restrictive networks require separate checks.',
);
