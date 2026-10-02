import { chromium, webkit } from '@playwright/test';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const origin = process.env.SMOKE_URL ?? 'http://127.0.0.1:4175';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw Error('Use an isolated local server.');
const engine = process.env.SMOKE_ENGINE ?? 'chromium';
if (!['chromium', 'webkit'].includes(engine))
  throw Error('SMOKE_ENGINE must be chromium or webkit.');
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true,
  ...(engine === 'chromium'
    ? {
        channel: process.env.SMOKE_BROWSER ?? 'chrome',
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      }
    : {}),
});
const artifactDir = `.tmp/mobile-audit/${engine}`;
const games = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('games', { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
const results = [];
const automatic = new Set(['bungee-doubles', 'drive-thru', 'panic-curling']);
const onlineOnly = new Set(['chaos', 'first-person', 'shelf-control']);
mkdirSync(artifactDir, { recursive: true });
async function inspect(page, stage) {
  return page.evaluate((stage) => {
    const visible = (e) =>
      e.checkVisibility({ checkVisibilityCSS: true }) &&
      !e.closest('details:not([open]) > :not(summary)');
    const summarize = (e) => {
      const r = e.getBoundingClientRect();
      return {
        tag: e.tagName,
        cls: typeof e.className === 'string' ? e.className : '',
        label: (e.getAttribute('aria-label') || e.textContent || '')
          .trim()
          .slice(0, 65),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    const controls = [
      ...document.querySelectorAll('button,a,input,textarea,select,summary'),
    ].filter(visible);
    const outside = controls
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1);
      })
      .map(summarize);
    const touch = [
      ...document.querySelectorAll(
        '[data-touch-controls] button, .bb-touch-controls button, .cc-touch-ui button, button[class*="touch-"]',
      ),
    ]
      .filter(visible)
      .map(summarize);
    return {
      stage,
      scrollWidth: document.documentElement.scrollWidth,
      width: document.documentElement.clientWidth,
      height: innerHeight,
      outside,
      touch,
      touchOutside: touch.filter(
        (t) => t.w && t.h && (t.y < 0 || t.y + t.h > innerHeight + 1),
      ),
      inputs: controls
        .filter(
          (e) =>
            e.matches(
              'input:not([type=radio]):not([type=checkbox]):not([type=range]),select,textarea',
            ) && parseFloat(getComputedStyle(e).fontSize) < 16,
        )
        .map(summarize),
    };
  }, stage);
}
try {
  for (const slug of games) {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true,
      locale: 'en-US',
    });
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (request) => {
      if (
        new URL(request.url()).origin === origin &&
        ['script', 'stylesheet'].includes(request.resourceType())
      )
        errors.push(
          `${request.resourceType()} failed: ${request.url()} (${request.failure()?.errorText})`,
        );
    });
    const result = {
      slug,
      started: automatic.has(slug),
      scope: onlineOnly.has(slug) ? 'offline-menu' : 'offline-solo',
      errors,
      checks: [],
    };
    try {
      await page.goto(origin + '/' + slug, {
        waitUntil: 'networkidle',
        timeout: 90000,
      });
      await page.waitForTimeout(250);
      // This native dialog enters the top layer after React hydrates.
      if (slug === 'carry-on-carnage')
        await page.getByRole('dialog', { name: 'How to play' }).waitFor();
      const practice = page
        .getByRole('button', {
          name: /practice|solo|alone|training|üben|alleine|start match|let.s shop|let.s bounce|gloves up|lock in|start game|start (the )?(shift|round|race)|ready.*play|vs bots|learn with|let.s drive|sneak in solo/i,
        })
        .first();
      if (!result.started && !onlineOnly.has(slug))
        await practice.waitFor({ state: 'visible' });
      result.checks.push(await inspect(page, 'menu-portrait'));
      if (await practice.isVisible().catch(() => false)) {
        await practice.tap({ timeout: 6000 });
        result.started = true;
        await page.waitForTimeout(500);
      }
      if (!result.started && !onlineOnly.has(slug))
        result.failure = 'No supported local start button was found.';
      if (!result.started)
        result.buttons = await page.getByRole('button').allTextContents();
      const more = page.getByRole('button', {
        name: 'Settings',
        exact: true,
      });
      if (await more.isVisible().catch(() => false)) {
        await more.tap();
        result.checks.push(await inspect(page, 'settings'));
        await page.screenshot({
          path: artifactDir + '/' + slug + '-settings.png',
          timeout: 60000,
        });
        const resume = page.getByRole('dialog').getByRole('button', {
          name: /^(keep shopping|weiter einkaufen)$/i,
        });
        if (await resume.isVisible().catch(() => false)) await resume.tap();
        else await more.tap();
      }
      const stage = result.started ? 'play' : 'menu';
      result.checks.push(await inspect(page, stage + '-portrait'));
      await page.screenshot({
        timeout: 60000,
        path: artifactDir + '/' + slug + '-' + stage + '.png',
      });
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(250);
      result.checks.push(await inspect(page, stage + '-landscape'));
      await page.screenshot({
        timeout: 60000,
        path: artifactDir + '/' + slug + '-landscape.png',
      });
    } catch (e) {
      result.failure = e.message;
    } finally {
      results.push(result);
      console.log(
        JSON.stringify({
          slug,
          started: result.started,
          scope: result.scope,
          errors: result.errors,
          buttons: result.buttons,
          failure: result.failure,
          checks: result.checks.map(({ touch: _touch, ...check }) => check),
        }),
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    `${artifactDir}/games${process.argv.slice(2).length ? '-' + games.join('-') : ''}.json`,
    JSON.stringify(results, null, 2),
  );
}
if (
  results.some(
    (r) =>
      r.failure ||
      r.errors.length ||
      r.checks.some(
        (c) =>
          c.outside.length ||
          c.inputs.length ||
          c.scrollWidth > c.width + 1 ||
          (c.stage.startsWith('play') && c.touchOutside.length),
      ),
  )
)
  process.exitCode = 1;
