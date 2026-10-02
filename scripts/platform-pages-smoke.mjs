import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GAME_IDS } from '../shared/games/identity.ts';

const base = new URL(process.env.SMOKE_URL ?? 'http://127.0.0.1:4194');
if (
  !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) ||
  !['http:', 'https:'].includes(base.protocol)
) {
  throw new Error('Page smoke tests require an isolated localhost server.');
}
const origin = base.origin;
const paths = [
  '/',
  ...GAME_IDS.map((game) => `/${game}`),
  '/party',
  ...[1, 2, 3, 4, 5].map((number) => `/landing${number}`),
  '/admin',
];
const report = {
  origin,
  checkedAt: new Date().toISOString(),
  pages: [],
  redirects: [],
  assets: [],
  api: [],
};
const failures = [];
const resources = new Map();

function decodeAttribute(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,
    (entity, key) => {
      if (!key.startsWith('#')) return named[key.toLowerCase()] ?? entity;
      const codePoint = /^#x/i.test(key)
        ? Number.parseInt(key.slice(2), 16)
        : Number.parseInt(key.slice(1), 10);
      return codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    },
  );
}

function attributes(tag) {
  return Object.fromEntries(
    [
      ...tag.matchAll(
        /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
      ),
    ].map((match) => [
      match[1].toLowerCase(),
      decodeAttribute(match[2] ?? match[3] ?? match[4]),
    ]),
  );
}

function addResource(value, kind, reference) {
  if (!value || value.startsWith('data:')) return;
  const url = new URL(value, `${origin}${reference}`);
  if (url.origin !== origin) return;
  url.hash = '';
  const key = url.href;
  const existing = resources.get(key);
  if (existing) {
    existing.references.add(reference);
    return;
  }
  resources.set(key, {
    url: url.pathname + url.search,
    kind,
    references: new Set([reference]),
    checked: false,
  });
}

function collectResources(html, path) {
  for (const match of html.matchAll(/<(script|link|img|source)\b[^>]*>/gi)) {
    const tag = match[1].toLowerCase();
    const props = attributes(match[0]);
    if (tag === 'script' && props.src) addResource(props.src, 'script', path);
    if (tag === 'img' && props.src) addResource(props.src, 'image', path);
    if (tag !== 'link') continue;
    const rel = (props.rel ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('stylesheet')) addResource(props.href, 'style', path);
    else if (rel.includes('modulepreload'))
      addResource(props.href, 'script', path);
    else if (rel.includes('preload')) {
      const kind = { script: 'script', style: 'style', image: 'image' }[
        props.as
      ];
      if (kind) addResource(props.href, kind, path);
    } else if (rel.includes('icon') || rel.includes('apple-touch-icon')) {
      addResource(props.href, 'image', path);
    }
  }
}

async function request(path) {
  const url = new URL(path, origin);
  assert.equal(url.origin, origin, 'requests must remain on the local server');
  return fetch(url, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Jumbleyard local production smoke' },
    signal: AbortSignal.timeout(30_000),
  });
}

function fail(item, error) {
  item.error = error instanceof Error ? error.message : String(error);
  failures.push({ url: item.path ?? item.url, error: item.error });
  console.error(`FAIL ${item.path ?? item.url}: ${item.error}`);
}

async function page(path) {
  const result = { path };
  report.pages.push(result);
  try {
    const response = await request(path);
    result.status = response.status;
    result.contentType = response.headers.get('content-type') ?? '';
    const html = await response.text();
    result.bytes = Buffer.byteLength(html);
    assert.equal(response.status, 200, `${path} must render successfully`);
    assert.match(result.contentType, /^text\/html\b/i);
    assert.match(html, /<html\b/i, `${path} must contain a document`);
    collectResources(html, path);
    console.log(`PASS ${path}`);
  } catch (error) {
    fail(result, error);
  }
}

async function asset(resource) {
  resource.checked = true;
  const result = {
    url: resource.url,
    kind: resource.kind,
    references: [...resource.references],
  };
  report.assets.push(result);
  try {
    const response = await request(resource.url);
    result.status = response.status;
    result.contentType = response.headers.get('content-type') ?? '';
    assert.equal(response.status, 200, 'referenced local asset must exist');
    const expected = {
      script:
        /^(?:text|application)\/(?:javascript|ecmascript|x-javascript)\b/i,
      style: /^text\/css\b/i,
      image: /^image\//i,
    }[resource.kind];
    assert.match(
      result.contentType,
      expected,
      'asset content type must match its use',
    );
    if (resource.kind === 'style') {
      const css = await response.text();
      result.bytes = Buffer.byteLength(css);
      for (const match of css.matchAll(
        /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi,
      )) {
        const value = match[1] ?? match[2] ?? match[3];
        if (/\.(png|jpe?g|webp|gif|svg|avif)(?:[?#]|$)/i.test(value))
          addResource(value, 'image', resource.url);
      }
    } else {
      result.bytes = (await response.arrayBuffer()).byteLength;
    }
    assert.ok(result.bytes > 0, 'referenced asset must not be empty');
  } catch (error) {
    fail(result, error);
  }
}

async function redirect(path, destination) {
  const result = { path, expected: destination };
  report.redirects.push(result);
  try {
    const response = await request(path);
    result.status = response.status;
    result.location = response.headers.get('location');
    assert.ok(
      response.status >= 300 && response.status < 400,
      'invite must redirect',
    );
    assert.ok(result.location, 'invite redirect must have a location');
    const target = new URL(result.location, origin);
    assert.equal(target.origin, origin, 'invite redirect must remain local');
    assert.equal(target.pathname + target.search, destination);
    await response.body?.cancel();
    console.log(`PASS ${path} -> ${destination}`);
  } catch (error) {
    fail(result, error);
  }
}

async function pool(items, operation) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (index < items.length) await operation(items[index++]);
    }),
  );
}

await pool(paths, page);
await redirect('/?room=ABCD23', '/stack-or-sink?room=ABCD23');
await redirect('/?raum=ABCD23', '/chaos?raum=ABCD23');
await redirect('/?room=ABCD23&raum=EFGH45', '/stack-or-sink?room=ABCD23');
await page('/?room=invalid');
await page('/?raum=invalid');

for (const kind of ['script', 'style', 'image']) {
  if (![...resources.values()].some((resource) => resource.kind === kind)) {
    failures.push({
      url: origin,
      error: `No local ${kind} references were discovered in the rendered pages.`,
    });
  }
}

while ([...resources.values()].some((resource) => !resource.checked)) {
  await pool(
    [...resources.values()].filter((resource) => !resource.checked),
    asset,
  );
}

const session = { path: '/api/account/session' };
report.api.push(session);
try {
  const response = await request(session.path);
  session.status = response.status;
  session.contentType = response.headers.get('content-type') ?? '';
  assert.equal(
    response.status,
    200,
    'guest session endpoint must remain available',
  );
  assert.match(session.contentType, /^application\/json\b/i);
  const body = await response.json();
  assert.equal(body.account, null, 'local smoke must remain signed out');
  assert.equal(typeof body.methods, 'object');
  session.signedOut = true;
  session.methods = body.methods;
  console.log('PASS guest session endpoint');
} catch (error) {
  fail(session, error);
}

report.summary = {
  gameRoutes: GAME_IDS.length,
  pages: report.pages.length,
  redirects: report.redirects.length,
  assets: report.assets.length,
  assetKinds: Object.fromEntries(
    ['script', 'style', 'image'].map((kind) => [
      kind,
      report.assets.filter((asset) => asset.kind === kind).length,
    ]),
  ),
  api: report.api.length,
  failures: failures.length,
};
report.failures = failures;
mkdirSync('.tmp/platform-audit', { recursive: true });
writeFileSync(
  '.tmp/platform-audit/web-routes.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report.summary));
process.exitCode = failures.length ? 1 : 0;
