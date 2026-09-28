import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GAME_IDS } from '@/shared/games/identity';
import { FEATURED_GAMES, getLandingGames } from './catalog';

void test('alternate landings expose the full canonical game catalogue', () => {
  for (const language of ['en', 'de']) {
    const games = getLandingGames(language);
    assert.deepEqual(
      games.map((game) => game.slug),
      [...GAME_IDS],
    );
    assert.equal(new Set(games.map((game) => game.slug)).size, GAME_IDS.length);

    for (const game of games) {
      assert.equal(game.href, `/${game.slug}`);
      assert.ok(game.title.length > 2, `${game.slug} has no ${language} title`);
      assert.ok(
        game.copy.cta.length > 2,
        `${game.slug} has no ${language} action`,
      );
      assert.ok(
        existsSync(`public${game.image}`),
        `${game.slug} is missing ${game.image}`,
      );
    }
  }
});

void test('each visual concept features three real, distinct games', () => {
  const canonical = new Set<string>(GAME_IDS);
  for (const [concept, slugs] of Object.entries(FEATURED_GAMES)) {
    assert.equal(slugs.length, 3, `${concept} needs three featured games`);
    assert.equal(
      new Set(slugs).size,
      slugs.length,
      `${concept} repeats a game`,
    );
    for (const slug of slugs) {
      assert.ok(
        canonical.has(slug),
        `${concept} features unknown game ${slug}`,
      );
    }
  }
});
