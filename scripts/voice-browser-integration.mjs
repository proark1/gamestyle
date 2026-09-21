import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { handlePeerRoom } from '../shared/peer/coordinator.ts';
import tailwindcss from '@tailwindcss/postcss';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { AccessToken } from 'livekit-server-sdk';
import { authorizeVoice, storageCode } from '../shared/voice/membership.ts';
import { hashToken } from '../shared/rooms/identity.ts';

// Real browser WebRTC and Web Audio; only microphone hardware and storage are
// substituted. No public rooms, microphone permissions, or external ICE servers.
const rows = new Map();
const earlyJoin = process.argv.includes('--early');
const ui = process.argv.includes('--ui');
const serverGame = process.argv
  .find((arg) => arg.startsWith('--livekit='))
  ?.split('=')[1];
if (serverGame)
  assert.ok(['chaos', 'first-person', 'shelf-control'].includes(serverGame));
let livekit;
mkdirSync('.tmp/voice', { recursive: true });
if (ui)
  writeFileSync(
    '.tmp/voice/test.css',
    readFileSync('app/globals.css', 'utf8')
      .replace(
        "@import 'tw-animate-css';",
        "@import 'tw-animate-css';\n@source '../../components/ui';\n@source '../../shared/voice';",
      )
      .replace("@import 'tailwindcss';", "@import 'tailwindcss' source(none);"),
  );
let allowSignals;
const signalsReady = new Promise((resolve) => {
  allowSignals = resolve;
});
const store = {
  get: async (code) => (rows.has(code) ? { ...rows.get(code) } : null),
  insert: async (row) => {
    if (rows.has(row.code)) return false;
    rows.set(row.code, { ...row });
    return true;
  },
  compareAndSwap: async (row, version) => {
    if (rows.get(row.code)?.version !== version) return false;
    rows.set(row.code, { ...row });
    return true;
  },
};
const server = await createServer({
  configFile: false,
  cacheDir: '.tmp/voice/vite-cache',
  resolve: { alias: { '@': process.cwd().replaceAll('\\', '/') } },
  css: { postcss: { plugins: [tailwindcss()] } },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      '@capacitor/core',
      ...(serverGame ? ['livekit-client'] : []),
      ...(ui
        ? [
            'react',
            'react-dom/client',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            '@base-ui/react/dialog',
            '@base-ui/react/button',
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
          ]
        : []),
    ],
  },
  server: { host: '127.0.0.1', port: 0, watch: null },
  plugins: [
    {
      name: 'voice-test-coordinator',
      resolveId(id) {
        if (id === '/voice-test-ui') return '\0voice-test-ui';
      },
      load(id) {
        if (id !== '\0voice-test-ui') return;
        return `import React from 'react'; import { createRoot } from 'react-dom/client';
          import VoicePanel from '/shared/voice/VoicePanel.tsx';
          import '/.tmp/voice/test.css'; import '/shared/ui/toolbar.css';
          import '@fontsource/dm-sans/400.css'; import '@fontsource/dm-sans/700.css'; import '@fontsource/fredoka/500.css';
          export function mount(session, sessions) {
            const container = document.createElement('div'); container.className = 'game-toolbar';
            container.style.cssText = 'position:fixed;right:24px;top:24px'; document.body.appendChild(container);
            const root = createRoot(container);
            root.render(React.createElement(VoicePanel, {session, snapshot: {players: sessions.map((s,i)=>({id:s.id,name:'Player '+(i+1)})), nearby:false}}));
            return () => root.unmount();
          }`;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url === '/voice-test') {
            res.setHeader('Content-Type', 'text/html');
            res.end(
              '<!doctype html><title>Voice integration</title><link rel="icon" href="data:,">',
            );
          } else if (req.url === '/api/voice/token') {
            try {
              let body = '';
              for await (const chunk of req) body += chunk;
              const { player, name } = await authorizeVoice(
                store,
                JSON.parse(body),
              );
              const token = new AccessToken('devkey', 'secret', {
                identity: player.id,
                name: player.name,
                ttl: 120,
              });
              token.addGrant({
                room: name,
                roomJoin: true,
                canPublish: true,
                canSubscribe: true,
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  configured: true,
                  url: 'ws://127.0.0.1:19880',
                  token: await token.toJwt(),
                }),
              );
            } catch (error) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: error.message }));
            }
          } else if (req.url === '/api/peer') {
            try {
              let body = '';
              for await (const chunk of req) body += chunk;
              const request = JSON.parse(body);
              if (earlyJoin && request.op === 'signal') await signalsReady;
              const reply = await handlePeerRoom(store, request);
              reply.view.iceServers = [];
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(reply));
            } catch (error) {
              res.statusCode = error.status || 500;
              res.end(JSON.stringify({ error: error.message }));
            }
          } else next();
        });
      },
    },
  ],
});
await server.listen();
let browser;
try {
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  console.log(`Voice test server: ${origin}`);
  if (serverGame) {
    mkdirSync('.tmp/voice', { recursive: true });
    writeFileSync(
      '.tmp/voice/livekit-test.yaml',
      'port: 19880\nbind_addresses: [127.0.0.1]\nrtc:\n  tcp_port: 19881\n  udp_port: 19882\n  node_ip: 127.0.0.1\n  use_external_ip: false\nkeys:\n  devkey: secret\nlogging:\n  level: error\n',
    );
    livekit = spawn(
      process.env.LIVEKIT_BINARY || 'work/livekit/livekit-server.exe',
      ['--dev', '--config', '.tmp/voice/livekit-test.yaml'],
      { windowsHide: true, stdio: 'inherit' },
    );
    for (let attempt = 0; ; attempt++) {
      try {
        await fetch('http://127.0.0.1:19880', {
          signal: AbortSignal.timeout(500),
        });
        break;
      } catch {
        if (attempt > 300) throw new Error('Local LiveKit did not start');
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  browser = await chromium.launch({
    channel: process.env.VOICE_TEST_BROWSER || 'chrome',
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--disable-features=WebRtcHideLocalIpsWithMdns',
    ],
  });
  console.log('Browser launched');
  const pages = await Promise.all(
    [0, 1].map(async () => {
      const context = await browser.newContext({
        permissions: ['microphone'],
        hasTouch: true,
      });
      const page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() === 'error') console.error(message.text());
      });
      console.log('Page created');
      await page.goto(`${origin}/voice-test`);
      await page.evaluate(async (serverVoice) => {
        const permission = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        permission.getTracks().forEach((track) => track.stop());
        window.voiceModules = {
          mesh: await import('/shared/peer/mesh.ts'),
          voice: await import(
            serverVoice
              ? '/shared/voice/client.ts'
              : '/shared/voice/peer-client.ts'
          ),
        };
      }, !!serverGame);
      return page;
    }),
  );
  if (ui) await pages[0].evaluate(() => import('/voice-test-ui'));
  const sessions = [];
  console.log('Browser pages ready');
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${origin}/api/peer`, {
      method: 'POST',
      body: JSON.stringify({
        op: i ? 'join' : 'create',
        game: 'stack-or-sink',
        code: sessions[0]?.code,
        name: `Voice ${i}`,
      }),
    });
    assert.equal(response.status, 200);
    const session = (await response.json()).session;
    if (serverGame) {
      delete session.peer;
      session.game = serverGame;
    }
    sessions.push(session);
  }
  if (serverGame) {
    const now = Date.now(),
      members = {};
    for (const session of sessions)
      members[session.id] = await hashToken(session.token);
    rows.set(storageCode(serverGame, sessions[0].code), {
      code: sessions[0].code,
      updated: now,
      version: 0,
      state: JSON.stringify({
        members,
        world: {
          players: sessions.map((s, i) => ({
            id: s.id,
            name: 'Voice ' + i,
            seen: now,
          })),
        },
      }),
    });
  }
  await Promise.all(
    pages.map((page, i) =>
      page.evaluate(
        async ({ session, sessions, i, earlyJoin }) => {
          const { acquireMesh } = window.voiceModules.mesh;
          const { VoiceClient } = window.voiceModules.voice;
          const lease = session.peer
            ? acquireMesh(session)
            : {
                mesh: { links: new Map(), on: () => {}, start: () => {} },
                release: () => {},
              };
          window.voiceTest = { lease, VoiceClient, session, sessions, i };
          lease.mesh.on('error', (error) => console.error(error.message));
          if (!earlyJoin) lease.mesh.start();
        },
        { session: sessions[i], sessions, i, earlyJoin },
      ),
    ),
  );
  console.log('Game meshes started');
  async function connected() {
    if (serverGame) return;
    await Promise.all(
      pages.map((page) =>
        page.waitForFunction(
          () =>
            [...window.voiceTest.lease.mesh.links.values()].some(
              (l) => l.channel?.readyState === 'open',
            ),
          null,
          { timeout: 20000 },
        ),
      ),
    ).catch(async (error) => {
      for (const page of pages)
        console.error(
          await page.evaluate(() => ({
            members: window.voiceTest.lease.mesh.view?.members.length,
            links: [...window.voiceTest.lease.mesh.links.values()].map((l) => ({
              state: l.pc.connectionState,
              signaling: l.pc.signalingState,
            })),
          })),
        );
      throw error;
    });
  }
  if (!earlyJoin) await connected();
  console.log(
    earlyJoin
      ? 'Joining voice before negotiation'
      : 'Joining voice after game data channels connect',
  );
  await Promise.all(
    pages.map((page) =>
      page.evaluate(async () => {
        const t = window.voiceTest;
        t.input = new AudioContext();
        await t.input.resume();
        navigator.mediaDevices.getUserMedia = async () => {
          const oscillator = t.input.createOscillator();
          oscillator.frequency.value = 440 + t.i * 220;
          const output = t.input.createMediaStreamDestination();
          oscillator.connect(output);
          oscillator.start();
          output.stream
            .getAudioTracks()[0]
            .addEventListener('ended', () => oscillator.stop());
          return output.stream;
        };
        t.join = async () => {
          t.client = new t.VoiceClient(t.session, () => {});
          t.client.update({
            players: t.sessions.map((s, i) => ({
              id: s.id,
              name: `Voice ${i}`,
            })),
            nearby: false,
          });
          await t.client.connect();
          await t.client.microphone(true);
        };
        t.rms = () => {
          const peer = t.client.peers.get(t.sessions[1 - t.i].id);
          if (!peer) return 0;
          if (t.peer !== peer) {
            t.peer = peer;
            t.meter = t.client.context.createAnalyser();
            peer.gain.connect(t.meter);
          }
          const values = new Float32Array(t.meter.fftSize);
          t.meter.getFloatTimeDomainData(values);
          return Math.sqrt(
            values.reduce((sum, v) => sum + v * v, 0) / values.length,
          );
        };
        await t.join();
      }),
    ),
  );
  allowSignals();
  await connected();
  for (const page of serverGame ? [] : pages) {
    const directions = await page.evaluate(() =>
      [...window.voiceTest.lease.mesh.links.values()].flatMap((link) =>
        link.pc.getTransceivers().map((t) => t.currentDirection),
      ),
    );
    assert.deepEqual(
      directions,
      ['sendrecv'],
      'Exactly one negotiated two-way audio transceiver per peer',
    );
  }
  async function sound(page, audible, label) {
    try {
      await page.evaluate(() => {
        window.voiceTest.quietSince = undefined;
      });
      await page.waitForFunction(
        (audible) => {
          const t = window.voiceTest,
            rms = t.rms();
          if (audible) return rms > 0.05;
          if (rms >= 0.001) {
            t.quietSince = undefined;
            return false;
          }
          t.quietSince ??= performance.now();
          return performance.now() - t.quietSince > 250;
        },
        audible,
        { timeout: 10000 },
      );
    } catch (error) {
      console.error(
        label,
        await page.evaluate(() => ({
          state: window.voiceTest.client.state,
          rms: window.voiceTest.rms(),
          links: [...window.voiceTest.lease.mesh.links.values()].map((l) => ({
            state: l.pc.connectionState,
            transceivers: l.pc.getTransceivers().map((t) => ({
              mid: t.mid,
              direction: t.currentDirection,
              sending: !!t.sender.track,
              receiving: t.receiver.track.readyState,
            })),
          })),
        })),
      );
      throw error;
    }
    console.log(`PASS: ${label}`);
  }
  for (let i = 0; i < 2; i++)
    await sound(
      pages[i],
      true,
      `player ${i + 1} receives audible remote audio`,
    );
  await pages[0].evaluate(() => window.voiceTest.client.microphone(false));
  await sound(pages[1], false, 'microphone mute stops remote audio');
  await pages[0].evaluate(() => window.voiceTest.client.microphone(true));
  await sound(pages[1], true, 'microphone re-enable restores remote audio');
  await pages[0].evaluate(() => window.voiceTest.client.deafen(true));
  await sound(pages[0], false, 'incoming mute silences playback');
  await pages[0].evaluate(() => window.voiceTest.client.deafen(false));
  await sound(pages[0], true, 'incoming unmute restores playback');
  await pages[0].evaluate(() =>
    window.voiceTest.client.volume(window.voiceTest.sessions[1].id, 0),
  );
  await sound(pages[0], false, 'per-player volume zero silences playback');
  await pages[0].evaluate(() =>
    window.voiceTest.client.volume(window.voiceTest.sessions[1].id, 1),
  );
  await sound(pages[0], true, 'per-player volume restores playback');
  await pages[0].evaluate(() => window.voiceTest.client.context.suspend());
  await pages[0].waitForFunction(
    () => window.voiceTest.client.state.audioBlocked,
  );
  await pages[0].evaluate(() => window.voiceTest.client.resumeAudio());
  await sound(pages[0], true, 'playback recovery resumes the audio context');
  await pages[0].evaluate(async () => {
    await window.voiceTest.client.dispose();
    await window.voiceTest.join();
  });
  for (let i = 0; i < 2; i++)
    await sound(
      pages[i],
      true,
      `voice rejoin preserves audio to player ${i + 1}`,
    );
  if (ui) {
    const page = pages[0];
    await page.evaluate(async () => {
      const t = window.voiceTest;
      await t.client.dispose();
      const { mount } = await import('/voice-test-ui');
      t.unmount = mount(t.session, t.sessions);
    });
    await page.getByRole('button', { name: 'Voice chat', exact: true }).click();
    await page.getByRole('button', { name: 'Join with push to talk' }).click();
    await page.getByRole('button', { name: 'Disable push to talk' }).waitFor();
    await sound(pages[1], false, 'UI push-to-talk joins silently');
    await page.keyboard.down('t');
    await sound(pages[1], true, 'holding the talk key transmits remote audio');
    await page.keyboard.up('t');
    await sound(pages[1], false, 'releasing the talk key stops remote audio');
    const hold = page.locator('[data-voice-hold]');
    await hold.hover();
    await page.mouse.down();
    await sound(pages[1], true, 'holding the on-screen button transmits');
    await page.keyboard.down('t');
    await page.mouse.up();
    await sound(pages[1], true, 'keyboard hold survives pointer release');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await sound(pages[1], false, 'window blur stops held transmission');
    await page.keyboard.up('t');
    await page.getByRole('combobox', { name: 'Talk key' }).selectOption('KeyV');
    await hold.focus();
    await page.keyboard.down('v');
    await sound(pages[1], true, 'selected shortcut transmits');
    await page.keyboard.up('v');
    await sound(pages[1], false, 'selected shortcut releases');
    await page.keyboard.down('Space');
    await sound(
      pages[1],
      true,
      'focused hold button supports keyboard activation',
    );
    await page.keyboard.up('Space');
    await sound(pages[1], false, 'focused button key release stops audio');
    await page.keyboard.down('Control');
    await page.keyboard.press('v');
    await page.keyboard.up('Control');
    await sound(pages[1], false, 'modified shortcuts do not transmit');
    await page.evaluate(() => {
      const field = document.createElement('input');
      field.id = 'voice-test-typing';
      document.querySelector('[role="dialog"]').appendChild(field);
      field.focus();
    });
    await page.keyboard.press('v');
    assert.equal(await page.locator('#voice-test-typing').inputValue(), 'v');
    await sound(pages[1], false, 'typing the shortcut does not transmit');
    await page
      .locator('#voice-test-typing')
      .evaluate((field) => field.remove());
    mkdirSync('.tmp/voice', { recursive: true });
    await page.screenshot({ path: '.tmp/voice/push-to-talk-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.tmp/voice/push-to-talk-mobile.png' });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('.voice-hold').waitFor();
    await page.locator('.voice-hold').focus();
    await page.keyboard.down('v');
    await sound(pages[1], true, 'persistent gameplay control transmits');
    await page.keyboard.up('v');
    await sound(pages[1], false, 'persistent gameplay control releases');
    const touch = await page.context().newCDPSession(page);
    const box = await page.locator('.voice-hold').boundingBox();
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await sound(pages[1], true, 'touch hold transmits');
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
    await sound(pages[1], false, 'cancelled touch stops transmission');
    await touch.detach();
    await page.evaluate(() => window.voiceTest.unmount());
  }
  await Promise.all(
    pages.map((page) =>
      page.evaluate(async () => {
        await window.voiceTest.client.dispose();
        window.voiceTest.lease.release();
        await window.voiceTest.input.close();
      }),
    ),
  );
} finally {
  await browser?.close();
  await server.close();
  livekit?.kill();
}
