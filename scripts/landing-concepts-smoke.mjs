import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const origin = process.env.SMOKE_URL ?? 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) {
  throw new Error('Landing smoke tests must use an isolated local build.');
}

const routes = ['landing1', 'landing2', 'landing3'];
const viewports = {
  desktop: { width: 1440, height: 1000 },
  phone: { width: 390, height: 844 },
};
const outputDirectory = '.tmp/landing-concepts';
mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  channel: process.env.SMOKE_BROWSER ?? 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const failures = [];

try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport,
        isMobile: viewportName === 'phone',
        hasTouch: viewportName === 'phone',
        locale: 'en-US',
        reducedMotion: 'reduce',
      });
      await context.route('**/*', (requestRoute) => {
        const requestUrl = new URL(requestRoute.request().url());
        if (requestUrl.pathname === '/api/account/session') {
          return requestRoute.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              account: null,
              methods: { google: false, email: false },
            }),
          });
        }
        return requestUrl.origin === origin
          ? requestRoute.continue()
          : requestRoute.abort();
      });

      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 400) {
          errors.push(`response ${response.status()}: ${response.url()}`);
        }
      });
      page.on('console', (message) => {
        if (message.type() === 'error')
          errors.push(`console: ${message.text()}`);
      });

      try {
        await page.goto(`${origin}/${route}`, {
          waitUntil: 'domcontentloaded',
        });
        await page.locator('h1').waitFor({ state: 'visible' });

        const h1Count = await page.locator('h1').count();
        if (h1Count !== 1) throw new Error(`expected one h1, found ${h1Count}`);

        const gameCards = page.locator('#games .alt-game-card');
        const gameCount = await gameCards.count();
        if (gameCount !== 31) {
          throw new Error(`expected 31 catalogue links, found ${gameCount}`);
        }

        const partyLinks = page.locator('a[href="/party"]');
        if (!(await partyLinks.count())) throw new Error('missing party link');

        const horizontalOverflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        if (horizontalOverflow > 1) {
          throw new Error(`horizontal overflow: ${horizontalOverflow}px`);
        }

        for (const selector of [
          `.${route === 'landing1' ? 'cinematic' : route === 'landing2' ? 'broadcast' : 'arcade'}-actions a:first-child`,
          '.language-header-button',
          '.wardrobe-header-button',
        ]) {
          const control = page.locator(selector);
          if (
            !(await control.count()) ||
            !(await control.first().isVisible())
          ) {
            throw new Error(`missing visible primary control: ${selector}`);
          }
        }
        if (viewportName === 'desktop') {
          const catalogueLink = page.locator('.alt-games-link');
          if (!(await catalogueLink.isVisible())) {
            throw new Error('missing visible desktop catalogue control');
          }
        }

        await page.screenshot({
          path: `${outputDirectory}/${route}-${viewportName}-hero.png`,
        });

        for (const selector of [
          '.language-header-button',
          '.wardrobe-header-button',
          '.account-header-button',
        ]) {
          const entryPoint = page.locator(selector).first();
          if ((await entryPoint.count()) && (await entryPoint.isVisible())) {
            await entryPoint.click();
            await page.waitForTimeout(100);
            await page.keyboard.press('Escape');
          }
        }

        if (route === 'landing2') {
          const choices = page.locator('.broadcast-rundown button');
          await choices.nth(1).focus();
          await page.keyboard.press('Enter');
          if ((await choices.nth(1).getAttribute('aria-pressed')) !== 'true') {
            throw new Error(
              'broadcast selector did not respond to keyboard input',
            );
          }
        }

        if (route === 'landing3') {
          const active = page.locator(
            '.arcade-cabinet-choice[aria-pressed="true"]',
          );
          const before = await active.textContent();
          await active.focus();
          await page.keyboard.press('ArrowRight');
          const after = await page
            .locator('.arcade-cabinet-choice[aria-pressed="true"]')
            .textContent();
          if (before === after) {
            throw new Error('arcade selector did not respond to arrow keys');
          }
        }

        await page.screenshot({
          path: `${outputDirectory}/${route}-${viewportName}.png`,
          fullPage: true,
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
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.join('\n')}`);
  process.exitCode = 1;
}
