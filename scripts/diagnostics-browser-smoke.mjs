import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const origin = process.env.SMOKE_URL ?? 'http://127.0.0.1:4194';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw Error('Diagnostics smoke requires an isolated localhost server.');
const credential = process.env.SMOKE_ADMIN_PASSWORD;
if (!credential)
  throw Error('An isolated smoke administrator password is required.');
const headers = { 'x-audio-admin': encodeURIComponent(credential) };
const reportUrl = `${origin}/api/admin/analytics?view=health&game=stack-or-sink`;
assert.equal(
  (await fetch(reportUrl)).status,
  401,
  'health report must require administrator authentication',
);
const rejected = await fetch(`${origin}/api/diagnostics`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ v: 1, game: 'private-data' }),
});
assert.equal(rejected.status, 400);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.SMOKE_BROWSER ?? 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const bodies = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname === '/api/diagnostics' &&
      request.method() === 'POST'
    )
      bodies.push(request.postDataJSON());
  });
  await page.goto(`${origin}/stack-or-sink`);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('canvas[data-performance]')].some(
        (canvas) => JSON.parse(canvas.dataset.performance).frames > 0,
      ),
    null,
    { timeout: 60000 },
  );
  await context.setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    const script = document.createElement('script');
    script.src = '/diagnostic-smoke-missing.js';
    document.head.appendChild(script);
  });
  await page.waitForTimeout(1000);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  const deadline = Date.now() + 15000;
  let report;
  while (Date.now() < deadline) {
    const response = await fetch(reportUrl, { headers });
    assert.equal(response.status, 200);
    report = await response.json();
    if (
      report.totals.readyVisits > 0 &&
      report.totals.errors.offline > 0 &&
      report.totals.errors.resource > 0
    )
      break;
    await new Promise((success) => setTimeout(success, 500));
  }
  assert.ok(
    report.totals.readyVisits > 0,
    'first-frame readiness was not reported',
  );
  assert.ok(report.totals.samples > 0, 'frame sampling was not reported');
  assert.ok(
    report.totals.errors.offline > 0,
    'offline interruption was not reported',
  );
  assert.ok(
    report.totals.errors.resource > 0,
    'failed download was not reported',
  );
  assert.ok(bodies.length > 0);
  for (const body of bodies) {
    const text = JSON.stringify(body);
    assert.ok(
      !text.includes(origin) &&
        !text.includes('diagnostic-smoke-missing') &&
        !text.includes('stack:'),
    );
    assert.ok(body.summary.samples <= 120);
  }
  await page.goto(`${origin}/admin`);
  await page.getByLabel('Administrator password').fill(credential);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('heading', { name: 'Health by game' }).waitFor();
  await page
    .getByRole('columnheader', { name: 'First frame', exact: true })
    .waitFor();
  const filtered = page.waitForResponse(
    (response) =>
      response.url().includes('/api/admin/analytics?') &&
      new URL(response.url()).searchParams.get('platform') === 'web' &&
      response.status() === 200,
  );
  await page.getByLabel('Platform', { exact: true }).selectOption('web');
  await filtered;
  await page
    .getByRole('rowheader', { name: 'Stack or Sink', exact: true })
    .waitFor();
  mkdirSync('.tmp/platform-audit', { recursive: true });
  await page.screenshot({
    path: '.tmp/platform-audit/health-admin.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.tmp/platform-audit/health-admin-mobile.png',
    fullPage: true,
  });
  const scrolling = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  assert.equal(scrolling, false, 'admin page must contain wide data tables');
  const result = {
    passed: true,
    checks: [
      'admin authentication',
      'invalid report rejection',
      'first-frame timing',
      'bounded frame samples',
      'offline recovery',
      'resource failures',
      'no private error text',
      'desktop and mobile Health UI',
    ],
    totals: report.totals,
    diagnosticReports: bodies.length,
  };
  console.log(
    'PASS anonymous diagnostics, interruption recovery and admin Health view.',
  );
  await context.close();
  for (const signal of [
    { key: 'doNotTrack', value: '1' },
    { key: 'globalPrivacyControl', value: true },
  ]) {
    const privacy = await browser.newContext();
    await privacy.addInitScript(
      (signal) =>
        Object.defineProperty(navigator, signal.key, {
          value: signal.value,
          configurable: true,
        }),
      signal,
    );
    let privacyReports = 0;
    privacy.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/diagnostics')
        privacyReports++;
    });
    const privatePage = await privacy.newPage();
    await privatePage.goto(`${origin}/stack-or-sink`);
    await privatePage.waitForTimeout(6000);
    assert.equal(privacyReports, 0, `${signal.key} must disable diagnostics`);
    await privacy.close();
    result.checks.push(signal.key);
    console.log(`PASS ${signal.key} disables diagnostics.`);
  }
  writeFileSync(
    '.tmp/platform-audit/diagnostics-smoke.json',
    JSON.stringify(result, null, 2),
  );
} finally {
  await browser.close();
}
