import { spawn } from 'node:child_process';

/** Native WebRTC cleanup must not leave an isolated test process running. */
export function runIsolatedPeer(
  game,
  args,
  { timeoutMs = 180_000, cleanupTimeoutMs = 3000, quiet = false } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: [
        quiet ? 'ignore' : 'inherit',
        quiet ? 'ignore' : 'inherit',
        quiet ? 'ignore' : 'inherit',
        'ipc',
      ],
      windowsHide: true,
    });
    let completed = null;
    let forcedCleanup = false;
    let failure = '';
    let cleanupTimer;
    const kill = (reason) => {
      failure = reason;
      forcedCleanup = true;
      child.kill('SIGKILL');
    };
    const deadline = setTimeout(
      () => kill(`exceeded ${timeoutMs} ms`),
      timeoutMs,
    );
    const clear = () => {
      clearTimeout(deadline);
      clearTimeout(cleanupTimer);
    };
    child.on('message', (message) => {
      if (
        message?.type !== 'peer-test-cleanup' ||
        typeof message.ok !== 'boolean'
      )
        return;
      completed = message.ok;
      clearTimeout(cleanupTimer);
      cleanupTimer = setTimeout(
        () => kill(`native cleanup exceeded ${cleanupTimeoutMs} ms`),
        cleanupTimeoutMs,
      );
    });
    child.on('error', (error) => {
      clear();
      reject(error);
    });
    child.on('exit', (code, signal) => {
      clear();
      if (
        (code === 0 && completed !== false) ||
        (forcedCleanup && completed === true)
      ) {
        resolve({ forcedCleanup, pid: child.pid });
      } else {
        reject(new Error(`${game} failed (${failure || signal || code})`));
      }
    });
  });
}
