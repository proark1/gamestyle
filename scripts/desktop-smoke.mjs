import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(
  'output/desktop/Jumbleyard-win32-x64/Jumbleyard.exe',
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${resolve('.tmp/platform-audit/desktop-profile')}`,
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
  {
    windowsHide: true,
    env: { ...process.env, GAME_DESKTOP_SMOKE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
let browser;
try {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      const { webSocketDebuggerUrl } = await response.json();
      browser = await chromium.connectOverCDP(webSocketDebuggerUrl);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!browser)
    throw Error('Desktop did not expose a running browser within 30 seconds.');
  const context = browser.contexts()[0];
  const reports = [];
  await context.route(/^https?:\/\//, (route) => route.abort());
  await context.route('**/api/diagnostics', (route) => {
    reports.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  const page =
    context.pages()[0] ??
    (await context.waitForEvent('page', { timeout: 10000 }));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForURL('jumbleyard-app://client/');
  await page.locator('a.game-card[href="/stack-or-sink"]').click();
  await page
    .getByRole('button', { name: /practice|solo/i })
    .first()
    .click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('canvas[data-performance]')].some(
        (canvas) => JSON.parse(canvas.dataset.performance).frames > 0,
      ),
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(250);
  assert.ok(
    reports.some(
      (report) =>
        report.platform === 'desktop' && report.game === 'stack-or-sink',
    ),
    'desktop diagnostics must use the installed platform',
  );
  const diagnostics = await page
    .locator('canvas[data-performance]')
    .getAttribute('data-performance');
  const result = {
    url: page.url(),
    diagnostics: JSON.parse(diagnostics),
    errors,
  };
  mkdirSync('.tmp/platform-audit', { recursive: true });
  writeFileSync(
    '.tmp/platform-audit/desktop-smoke.json',
    JSON.stringify(result, null, 2),
  );
  console.log(result);
  if (errors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  child.kill();
}
