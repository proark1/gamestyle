import assert from 'node:assert/strict';
import test from 'node:test';
import { runIsolatedPeer } from './peer-integration-runner.mjs';

void test('successful assertions survive bounded native teardown and the child exits', async () => {
  const result = await runIsolatedPeer(
    'success fixture',
    [
      '-e',
      "process.send({type:'peer-test-cleanup',ok:true}); setInterval(() => {}, 1000);",
    ],
    { cleanupTimeoutMs: 100, timeoutMs: 3000, quiet: true },
  );
  assert.equal(result.forcedCleanup, true);
  assert.throws(() => process.kill(result.pid, 0), { code: 'ESRCH' });
});

void test('failed assertions remain failures when native teardown hangs', async () => {
  await assert.rejects(
    runIsolatedPeer(
      'failure fixture',
      [
        '-e',
        "process.send({type:'peer-test-cleanup',ok:false}); setInterval(() => {}, 1000);",
      ],
      { cleanupTimeoutMs: 100, timeoutMs: 3000, quiet: true },
    ),
    /failure fixture failed.*native cleanup/,
  );
});

void test('a child without a completion signal cannot run beyond its deadline', async () => {
  await assert.rejects(
    runIsolatedPeer('timeout fixture', ['-e', 'setInterval(() => {}, 1000);'], {
      timeoutMs: 200,
      quiet: true,
    }),
    /timeout fixture failed.*exceeded 200 ms/,
  );
});
