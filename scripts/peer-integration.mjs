import { spawn } from 'node:child_process';

// Isolate native WebRTC teardown between games, including on Windows.
for (const game of process.argv[2]
  ? [process.argv[2]]
  : [
      'stack-or-sink',
      'act-natural',
      'uphill-delivery',
      'dont-wake-the-giant',
      'reel-problems',
      'one-more-button',
      'four-brain-cells',
      'wrong-floor',
    ]) {
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
