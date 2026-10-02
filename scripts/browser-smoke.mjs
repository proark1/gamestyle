import { chromium, firefox, webkit } from '@playwright/test';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const origin = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw Error('Smoke test must use an isolated local build.');
const engine = process.env.SMOKE_ENGINE ?? 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(engine))
  throw Error('Unknown smoke browser engine.');
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(engine === 'chromium'
    ? {
        channel: process.env.SMOKE_BROWSER ?? 'chrome',
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      }
    : {}),
});
const games = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('games', { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
const results = [];
const mobile = process.env.SMOKE_MOBILE === '1';
const capture = process.env.SMOKE_CAPTURE === '1';
const artifactDir = `.tmp/platform-audit/game-starts${mobile ? '-mobile' : ''}${engine === 'chromium' ? '' : '-' + engine}`;
mkdirSync(artifactDir, { recursive: true });
const automatic = new Set(['bungee-doubles', 'drive-thru', 'panic-curling']);
// These existing games require a coordinator even for a one-player room.
const onlineOnly = new Set(['chaos', 'first-person', 'shelf-control']);
try {
  for (const game of games) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : capture
          ? { width: 960, height: 540 }
          : { width: 900, height: 650 },
      isMobile: mobile && engine !== 'firefox',
      hasTouch: mobile,
      locale: 'en-US',
    });
    if (capture)
      await context.addInitScript(() => {
        localStorage.setItem(
          'jumbleyard:graphics',
          JSON.stringify({ quality: 'low', fps: 30 }),
        );
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
    page.setDefaultTimeout(45000);
    const result = {
      game,
      started: false,
      scope: onlineOnly.has(game) ? 'offline-menu' : 'offline-solo',
      errors,
    };
    try {
      await page.goto(`${origin}/${game}`, {
        waitUntil: 'networkidle',
        timeout: 90000,
      });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('canvas[data-performance]')].some(
            (canvas) => JSON.parse(canvas.dataset.performance).frames > 0,
          ),
        null,
        { timeout: 60000 },
      );
      if (game === 'carry-on-carnage')
        await page.getByRole('dialog', { name: 'How to play' }).waitFor();
      const practice = page
        .getByRole('button', {
          name: /practice|solo|alone|training|üben|alleine|start match|let.s shop|let.s bounce|let.s drive|gloves up|lock in .*fighter|start game|start (the )?(shift|round|race)|ready.*play|vs bots|learn with/i,
        })
        .first();
      let started = automatic.has(game);
      if (!started && !onlineOnly.has(game))
        await practice.waitFor({ state: 'visible' });
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
      Object.assign(result, {
        started,
        scope: onlineOnly.has(game) ? 'offline-menu' : 'offline-solo',
        canvases: await page.locator('canvas').count(),
        diagnostics,
        errors,
        buttons: started ? undefined : buttons,
      });
      await page.screenshot({
        path: `${artifactDir}/${game}.png`,
        timeout: 60000,
      });
    } catch (error) {
      result.failure = error.message;
      result.buttons = await page
        .getByRole('button')
        .allTextContents()
        .catch(() => []);
      result.screen = await page
        .locator('body')
        .innerText()
        .catch(() => '');
      await page
        .screenshot({
          path: `${artifactDir}/${game}-failure.png`,
          timeout: 60000,
        })
        .catch(() => {});
    }
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
} finally {
  await browser.close();
  mkdirSync('.tmp/platform-audit', { recursive: true });
  writeFileSync(
    `.tmp/platform-audit/browser-smoke${mobile ? '-mobile' : ''}${engine === 'chromium' ? '' : '-' + engine}.json`,
    JSON.stringify(results, null, 2),
  );
}
if (
  results.some(
    (r) =>
      r.errors.length ||
      r.failure ||
      (!r.started && r.scope !== 'offline-menu') ||
      !r.diagnostics.length,
  )
)
  process.exitCode = 1;
