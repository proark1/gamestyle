import { chromium } from '@playwright/test';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const origin = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw Error('Smoke test must use an isolated local build.');
const browser = await chromium.launch({
  channel: process.env.SMOKE_BROWSER ?? 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const games = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('games', { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
const results = [];
const mobile = process.env.SMOKE_MOBILE === '1';
const automatic = new Set(['bungee-doubles', 'drive-thru', 'panic-curling']);
// These existing games require a coordinator even for a one-player room.
const onlineOnly = new Set(['chaos', 'first-person', 'shelf-control']);
try {
  for (const game of games) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 900, height: 650 },
      isMobile: mobile,
      hasTouch: mobile,
      locale: 'en-US',
    });
    // Load every route offline; exercise solo starts where the game provides one.
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/${game}`, { waitUntil: 'networkidle' });
    const practice = page
      .getByRole('button', {
        name: /practice|solo|alone|training|üben|alleine|start match|let.s shop|let.s bounce|start flipping|start game|start (the )?shift|start round|ready.*play|vs bots|learn with|gloves up|lock in .*fighter/i,
      })
      .first();
    let started = automatic.has(game);
    if ((await practice.count()) && (await practice.isVisible())) {
      await practice.click();
      started = true;
    }
    await page.waitForTimeout(2500);
    const diagnostics = await page
      .locator('canvas[data-performance]')
      .evaluateAll((canvases) =>
        canvases.map((c) => JSON.parse(c.dataset.performance)),
      );
    const buttons = await page.getByRole('button').allTextContents();
    const result = {
      game,
      started,
      scope: onlineOnly.has(game) ? 'offline-menu' : 'offline-solo',
      canvases: await page.locator('canvas').count(),
      diagnostics,
      errors,
      buttons: started ? undefined : buttons,
    };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
} finally {
  await browser.close();
  mkdirSync('.tmp/platform-audit', { recursive: true });
  writeFileSync(
    `.tmp/platform-audit/browser-smoke${mobile ? '-mobile' : ''}.json`,
    JSON.stringify(results, null, 2),
  );
}
if (
  results.some(
    (r) =>
      r.errors.length ||
      (!r.started && r.scope !== 'offline-menu') ||
      !r.diagnostics.length,
  )
)
  process.exitCode = 1;
