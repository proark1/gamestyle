import { audioAdminFetch } from './audio-admin-request.mjs';
import assert from 'node:assert/strict';

const base = process.argv[2];
if (!base) throw new Error('Pass the running Jumbleyard origin.');
const origin = new URL(base).origin;
const paths = [
  '/siege-and-desist',
  '/wrong-floor',
  '/one-more-button',
  '/four-brain-cells',
  '/reel-problems',
  '/stack-or-sink',
  '/act-natural',
  '/shelf-control',
  '/uphill-delivery',
  '/dont-wake-the-giant',
  '/chaos',
  '/first-person',
];
const homeResponse = await audioAdminFetch(origin);
assert.equal(homeResponse.status, 200);
const home = await homeResponse.text();
for (const path of paths)
  assert.ok(home.includes(`href="${path}"`), `Missing game card: ${path}`);
for (const [query, target] of [
  ['room=ABCDEF', '/stack-or-sink?room=ABCDEF'],
  ['raum=ABCDEF', '/chaos?raum=ABCDEF'],
]) {
  const response = await audioAdminFetch(`${origin}/?${query}`, {
    redirect: 'manual',
  });
  assert.equal(response.status, 307);
  assert.equal(
    new URL(response.headers.get('location'), origin).pathname +
      new URL(response.headers.get('location'), origin).search,
    target,
  );
}
for (const path of [
  ...paths,
  '/chaos/admin',
  '/first-person/admin',
  '/first-person/credits',
]) {
  const response = await audioAdminFetch(origin + path);
  assert.equal(response.status, 200, `${path} failed`);
  const html = await response.text();
  assert.ok(
    !html.includes('Internal Server Error'),
    `${path} failed during rendering`,
  );
  if (paths.includes(path)) {
    const toolbar = html.match(/<nav class="game-toolbar"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(toolbar, `${path} lacks the shared game toolbar`);
    const labels = Array.from(
      toolbar.matchAll(/aria-label="([^"]+)"/g),
      (match) => match[1],
    );
    assert.deepEqual(
      labels,
      [
        'Game controls',
        'Voice chat',
        'Mute game sound',
        'How to play',
        'All games',
        'Sound workshop',
      ],
      `${path} has different game controls or ordering`,
    );
    const workshop = toolbar.match(
      /href="([^"]+)"\s+aria-label="Sound workshop"/,
    )?.[1];
    assert.ok(workshop, `${path} lacks a workshop destination`);
    assert.equal((await audioAdminFetch(origin + workshop)).status, 200);
  }
  if (path.startsWith('/chaos') || path.startsWith('/first-person'))
    assert.ok(
      html.includes('class="handwerker"'),
      `${path} lacks style isolation`,
    );
}
for (const path of [
  '/images/siege-and-desist.png',
  '/images/one-more-button.png',
  '/images/four-brain-cells.png',
  '/images/reel-problems.png',
  '/images/wrong-floor.png',
  '/images/shelf-control.png?v=toy-style-2',
  '/images/permit-pending.png',
  '/images/brick-by-hand.png',
  '/first-person/textures/brick.jpg',
  '/first-person/textures/dirt.jpg',
  '/first-person/textures/wood.jpg',
]) {
  const response = await audioAdminFetch(origin + path);
  assert.equal(response.status, 200, `Missing asset: ${path}`);
  assert.ok(response.headers.get('content-type')?.startsWith('image/'));
  await response.arrayBuffer();
}
for (const game of ['chaos', 'first-person']) {
  const response = await audioAdminFetch(
    `${origin}/api/handwerker/audio/${game}?manifest`,
  );
  assert.equal(response.status, 200);
  const manifest = await response.json();
  assert.ok(manifest.settings && manifest.cues);
  for (const route of [
    `/api/handwerker/audio/${game}`,
    game === 'chaos'
      ? '/api/handwerker/rooms'
      : '/api/handwerker/first-person/rooms',
  ]) {
    const rejected = await audioAdminFetch(origin + route, {
      method: 'POST',
      headers: {
        Origin: 'https://unrelated.example',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(rejected.status, 403, `${route} accepted a foreign origin`);
  }
}
for (const path of [
  '/api/audio/chaos',
  '/api/audio/first-person',
  '/api/handwerker/audio/stack-or-sink',
]) {
  assert.equal(
    (await audioAdminFetch(origin + path)).status,
    404,
    `Audio namespace collision: ${path}`,
  );
}
console.log(
  `PASS: ${paths.length} game cards, matching toolbars and workshop links, invite redirects, game/admin routes, static assets, isolated audio manifests and origin checks.`,
);
