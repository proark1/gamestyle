// Local, headless Chromium integration check for the six bundled sound banks.
// node scripts/audio-expansion-smoke.mjs
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const entries = [
  ['crane-clash', 'CraneClashSound'],
  ['load-bearing', 'LoadBearingSound'],
  ['panic-curling', 'CurlingAudio'],
  ['zorb-clash', 'ZorbClashAudio'],
  ['one-more-button', 'ButtonSound'],
  ['siege-and-desist', 'SiegeSound'],
];
const result = await build({
  stdin: {
    contents:
      entries
        .map(
          ([game, name]) => `import { ${name} } from './games/${game}/audio';`,
        )
        .join('\n') +
      `\nwindow.soundBanks = {${entries.map(([game, name]) => `'${game}': ${name}`).join(',')}};`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  logLevel: 'silent',
});
const failures = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><button>Enable audio</button><script src="/bundle.js"></script>',
    );
    return;
  }
  if (url.pathname === '/bundle.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(result.outputFiles[0].contents);
    return;
  }
  if (url.pathname.startsWith('/api/audio/')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        settings: {
          effects: 0.75,
          speech: 0.85,
          ambience: 0.25,
          music: 0.18,
          voiceId: '',
        },
        cues: {},
      }),
    );
    return;
  }
  if (/^\/audio\/[a-z-]+\/[a-z0-9_.-]+\.wav$/.test(url.pathname)) {
    try {
      res.setHeader('Content-Type', 'audio/wav');
      res.end(await readFile(`public${url.pathname}`));
      return;
    } catch {
      failures.push(url.pathname);
    }
  }
  res.statusCode = 404;
  res.end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  for (const [game] of entries) {
    await page.evaluate((game) => {
      window.bank = new window.soundBanks[game]();
      window.ctx = null;
    }, game);
    await page.click('button');
    // Decode and play each WAV through the actual shared audio player.
    const report = await page.evaluate(async () => {
      const bank = window.bank;
      bank.unlock();
      const cues = Object.keys(bank.manifest.cues);
      for (const id of cues) {
        const buffer = await bank.buffer(id);
        if (!buffer || buffer.length === 0) throw Error(`Cannot decode ${id}`);
      }
      const effect = cues.find((id) => !bank.manifest.cues[id].loop);
      bank.play(effect);
      const loop = cues.find((id) => bank.manifest.cues[id].loop);
      bank.setLoop('test', loop, 0.5);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const playing = bank.sources.size > 0 && !!bank.loops.get('test')?.source;
      bank.enabled = false;
      await new Promise((resolve) => setTimeout(resolve, 250));
      const muted = bank.master.gain.value < 0.01;
      bank.enabled = true;
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const hidden = bank.context.state === 'suspended';
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      bank.reset();
      const stopped = bank.loops.size === 0;
      const context = bank.context;
      bank.dispose();
      await new Promise((resolve) => setTimeout(resolve, 80));
      return {
        cues: cues.length,
        playing,
        muted,
        hidden,
        stopped,
        closed: context.state === 'closed',
      };
    });
    for (const key of ['playing', 'muted', 'hidden', 'stopped', 'closed'])
      assert.equal(report[key], true, `${game}: ${key}`);
    console.log(`${game}: ${JSON.stringify(report)}`);
  }
  assert.deepEqual(failures, []);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
