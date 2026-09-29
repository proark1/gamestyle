import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const origin = process.env.SMOKE_URL ?? 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) {
  throw new Error(
    'Enhanced landing smoke tests must use an isolated local build.',
  );
}

const routes = ['landing4', 'landing5'];
const viewports = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};
const outputDirectory = '.tmp/enhanced-standard-landings';
mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  channel: process.env.SMOKE_BROWSER ?? 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const failures = [];

function registerLocalRoutes(
  context,
  { abortVideo = false, requestTracker } = {},
) {
  return context.route('**/*', (requestRoute) => {
    const requestUrl = new URL(requestRoute.request().url());
    if (requestUrl.pathname === '/api/account/session') {
      return requestRoute.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          account: null,
          methods: { google: false, email: true },
        }),
      });
    }
    if (requestUrl.pathname === '/api/analytics') {
      return requestRoute.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    }
    if (abortVideo && requestUrl.pathname.endsWith('.mp4')) {
      if (requestTracker) requestTracker.videoFailures += 1;
      return requestRoute.fulfill({
        status: 503,
        contentType: 'video/mp4',
        body: '',
      });
    }
    return requestUrl.origin === origin
      ? requestRoute.continue()
      : requestRoute.abort();
  });
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function enterTrailer(page, viewportName) {
  const trailer = page.locator('.trailer-intro');
  await trailer.waitFor({ state: 'visible' });
  const contentIsInert = await page
    .locator('.enhanced-standard-content')
    .evaluate((element) => element.inert);
  if (!contentIsInert) throw new Error('trailer content should begin inert');

  const selector =
    viewportName === 'desktop'
      ? '.trailer-actions > button'
      : '.trailer-header > button';
  await page.locator(selector).click();
  await page.locator('.clubhouse-trailer.is-entered').waitFor();
  await page.waitForTimeout(800);

  const contentRemainsInert = await page
    .locator('.enhanced-standard-content')
    .evaluate((element) => element.inert);
  if (contentRemainsInert)
    throw new Error('trailer content remained inert after entry');
}

async function assertStandardExperience(page) {
  const h1Count = await page.locator('h1').count();
  if (h1Count !== 1) throw new Error(`expected one h1, found ${h1Count}`);

  const gameCount = await page.locator('.game-shelf .game-card').count();
  if (gameCount !== 30) {
    throw new Error(`expected 30 standard game cards, found ${gameCount}`);
  }

  const partyLinks = page.locator('a[href="/party"]');
  if (!(await partyLinks.count())) throw new Error('missing party link');

  for (const selector of [
    '.language-header-button',
    '.wardrobe-header-button',
  ]) {
    const control = page.locator(selector).first();
    if (!(await control.count()) || !(await control.isVisible())) {
      throw new Error(`missing visible standard control: ${selector}`);
    }
  }
  await page
    .locator('.account-header-button')
    .waitFor({ state: 'visible', timeout: 5000 });

  const pathLinks = page.locator('.yard-path a');
  if ((await pathLinks.count()) !== 4) {
    throw new Error('yard path does not contain four stops');
  }
  await pathLinks.last().click();
  await page.waitForTimeout(250);
  if (!page.url().endsWith('#games')) {
    throw new Error(`yard path did not update the games hash: ${page.url()}`);
  }

  const horizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  if (horizontalOverflow > 1) {
    throw new Error(`horizontal overflow: ${horizontalOverflow}px`);
  }
}

try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport,
        isMobile: viewportName === 'phone',
        hasTouch: viewportName === 'phone',
        locale: 'en-US',
        reducedMotion: 'no-preference',
      });
      await registerLocalRoutes(context);
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(60_000);
      const errors = collectBrowserErrors(page);

      try {
        await page.goto(`${origin}/${route}`, {
          waitUntil: 'domcontentloaded',
        });
        await page.locator('h1').waitFor({ state: 'attached' });
        await page.screenshot({
          path: `${outputDirectory}/${route}-${viewportName}-arrival.png`,
        });

        if (route === 'landing5') await enterTrailer(page, viewportName);
        await assertStandardExperience(page);

        await page.screenshot({
          path: `${outputDirectory}/${route}-${viewportName}-games.png`,
        });

        if (errors.length) throw new Error(errors.join('\n'));
        console.log(`PASS ${route} ${viewportName}`);
      } catch (error) {
        const message = `${route} ${viewportName}: ${error.message}`;
        failures.push(message);
        console.error(`FAIL ${message}`);
      } finally {
        await context.close();
      }
    }
  }

  for (const route of routes) {
    const context = await browser.newContext({
      viewport: viewports.desktop,
      locale: 'en-US',
      reducedMotion: 'reduce',
    });
    await registerLocalRoutes(context);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60_000);
    const errors = collectBrowserErrors(page);

    try {
      await page.goto(`${origin}/${route}`, { waitUntil: 'domcontentloaded' });
      await page
        .locator(
          `.${route === 'landing4' ? 'living-clubhouse' : 'clubhouse-trailer'}.is-entered`,
        )
        .waitFor();
      const videoState = await page.locator('video').evaluate((video) => ({
        paused: video.paused,
        currentTime: video.currentTime,
      }));
      if (!videoState.paused || videoState.currentTime > 0.05) {
        throw new Error(
          `reduced-motion video played: ${JSON.stringify(videoState)}`,
        );
      }
      if (
        route === 'landing4' &&
        !(await page.locator('.enhanced-media > img').isVisible())
      ) {
        throw new Error('reduced-motion poster is not visible');
      }
      await assertStandardExperience(page);
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`PASS ${route} reduced-motion`);
    } catch (error) {
      const message = `${route} reduced-motion: ${error.message}`;
      failures.push(message);
      console.error(`FAIL ${message}`);
    } finally {
      await context.close();
    }
  }

  for (const route of routes) {
    const context = await browser.newContext({
      viewport: viewports.desktop,
      locale: 'en-US',
      reducedMotion: 'no-preference',
    });
    const requestTracker = { videoFailures: 0 };
    await registerLocalRoutes(context, { abortVideo: true, requestTracker });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60_000);

    try {
      await page.goto(`${origin}/${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      if (!requestTracker.videoFailures) {
        throw new Error('failed-video test did not intercept the MP4 request');
      }
      const mediaState = await page
        .locator('.enhanced-media')
        .getAttribute('data-media-state');
      if (mediaState === 'playing') {
        throw new Error('failed video incorrectly entered the playing state');
      }
      if (!(await page.locator('.enhanced-media > img').isVisible())) {
        throw new Error('failed-video poster is not visible');
      }
      if (route === 'landing5') await enterTrailer(page, 'desktop');
      await assertStandardExperience(page);
      console.log(`PASS ${route} failed-video fallback`);
    } catch (error) {
      const message = `${route} failed-video fallback: ${error.message}`;
      failures.push(message);
      console.error(`FAIL ${message}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.join('\n')}`);
  process.exitCode = 1;
}
