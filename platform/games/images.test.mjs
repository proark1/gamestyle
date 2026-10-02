import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
import { PARTY_GAMES } from '../party/playlist.ts';

async function assertImage(url) {
  const file = `public${url.split('?')[0]}`;
  assert.ok(existsSync(file), `${url} is missing`);
  const { info } = await sharp(file)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.ok(info.width > 0 && info.height > 0, `${url} has no pixels`);
  return { file, info };
}

void test('every collection cover exists, decodes and fits the card download budget', async () => {
  const source = readFileSync('app/CollectionClient.tsx', 'utf8');
  const urls = new Set(
    [...source.matchAll(/imgSrc: '([^']+)'/g)].map((match) => match[1]),
  );
  assert.ok(urls.size > 0, 'no collection covers were found');
  for (const url of urls) {
    const { file, info } = await assertImage(url);
    assert.ok(info.width <= 1024, `${url} is oversized for its card`);
    assert.ok(statSync(file).size < 250_000, `${url} exceeds 250 KB`);
  }
});

void test('every party voting image is its own decodable gameplay capture', async () => {
  for (const game of PARTY_GAMES) {
    assert.equal(game.image, `/images/party-gameplay/${game.id}.webp`);
    const { info } = await assertImage(game.image);
    assert.equal(info.width, 960, `${game.id} capture width`);
    assert.equal(info.height, 540, `${game.id} capture height`);
  }
});

void test('every game start image and background resolves to a decodable public asset', async () => {
  const urls = new Set();
  for (const file of readdirSync('games', {
    recursive: true,
    encoding: 'utf8',
  })) {
    if (!/\.(tsx|css)$/.test(file)) continue;
    const source = readFileSync(`games/${file}`, 'utf8');
    for (const match of source.matchAll(/['"(](\/images\/[^'"\s)]+)/g))
      urls.add(match[1]);
  }
  assert.ok(urls.size > 0, 'no game start images were found');
  for (const url of urls) await assertImage(url);
});
