import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  GAME_IDS,
  PARTY_EXCLUDED,
  isHandwerkerGame,
  workshopOf,
  type Game,
} from '../../shared/games/identity';
import { GAME_IDS_WITH_AUDIO, isGameId } from '../../shared/audio/types';
import { CARDS_TRANSLATIONS } from '../../shared/language/translations/cards';
import { GAMES } from '../analytics/catalog';
import { PARTY_GAMES } from '../party/playlist';
import { getCatalog } from '../audio/catalog';

/**
 * Adding a game means registering it in several places. Each check below turns one
 * of those steps from a checklist line into a failing test, so a game cannot ship
 * half-wired — the way Zorb Clash and Scaffold Scramble shipped emitting analytics
 * that the ingest route rejected because they were missing from the catalog.
 */

const route = (game: string) =>
  existsSync(`app/${game}/page.tsx`) ||
  existsSync(`app/(handwerker)/${game}/page.tsx`);

const adminRoute = (game: string) =>
  existsSync(`app/${game}/admin/page.tsx`) ||
  existsSync(`app/(handwerker)/${game}/admin/page.tsx`);

void test('every game has a route', () => {
  for (const game of GAME_IDS) assert.ok(route(game), `${game} has no route`);
});

void test('every game reports play analytics', () => {
  const registered = new Set(GAMES.map((entry) => entry.id));
  for (const game of GAME_IDS)
    assert.ok(
      registered.has(game),
      `${game} is missing from platform/analytics/catalog.ts, so /api/analytics ` +
        `rejects its reports with "Unknown game" and the admin page cannot show it`,
    );
  assert.equal(registered.size, GAMES.length, 'duplicate analytics entry');
  for (const entry of GAMES)
    assert.ok(
      (GAME_IDS as readonly string[]).includes(entry.id),
      `${entry.id} is registered but has no games/ folder`,
    );
});

void test('every game has a sound workshop, its own or the one it borrows', () => {
  for (const game of GAME_IDS) {
    const workshop = workshopOf(game);
    assert.ok(
      adminRoute(workshop),
      `${game} points at the ${workshop} workshop, which has no admin route`,
    );
  }
});

void test('a game owns an audio catalog unless it is Handwerker or borrows one', () => {
  for (const game of GAME_IDS_WITH_AUDIO) {
    assert.ok(
      !isHandwerkerGame(game),
      `${game} uses the construction workshop`,
    );
    const cues = getCatalog(game);
    assert.ok(cues?.length, `${game} has an empty audio catalog`);
  }
  // The audio id is the collection minus Handwerker titles and borrowers.
  for (const game of GAME_IDS)
    assert.equal(
      isGameId(game),
      (GAME_IDS_WITH_AUDIO as readonly string[]).includes(game),
      `${game} disagrees with isGameId`,
    );
});

void test('the party playlist covers every game that is not excluded by name', () => {
  const playlist = new Set(PARTY_GAMES.map((entry) => entry.id));
  for (const game of GAME_IDS) {
    const excluded = game in PARTY_EXCLUDED;
    assert.equal(
      playlist.has(game as never),
      !excluded,
      excluded
        ? `${game} is excluded from the party playlist but still listed`
        : `${game} is missing from platform/party/playlist.ts — add it, or name ` +
            `it in PARTY_EXCLUDED with the reason it cannot host a round`,
    );
  }
  assert.equal(playlist.size, PARTY_GAMES.length, 'duplicate playlist entry');
});

void test('every game has a collection card and its translations', () => {
  // CollectionClient is a client component with a stylesheet, so its card map is
  // read as text rather than imported.
  const source = readFileSync('app/CollectionClient.tsx', 'utf8');
  for (const game of GAME_IDS) {
    assert.match(
      source,
      new RegExp(`^  '?${game}'?: \\{`, 'm'),
      `${game} has no card in app/CollectionClient.tsx`,
    );
    const card = CARDS_TRANSLATIONS[game];
    assert.ok(card, `${game} has no card translations`);
    for (const language of ['en', 'de'] as const)
      assert.ok(
        card[language]?.cta,
        `${game} card is missing its ${language} copy`,
      );
  }
  for (const id of Object.keys(CARDS_TRANSLATIONS))
    assert.ok(
      (GAME_IDS as readonly string[]).includes(id),
      `${id} has card translations but no games/ folder`,
    );
});

void test('the README game table lists the whole collection', () => {
  const readme = readFileSync('README.md', 'utf8');
  const table = readme.slice(
    readme.indexOf('| Game '),
    readme.indexOf('## Code structure'),
  );
  const listed = new Set(
    [...table.matchAll(/`games\/([a-z-]+)\/`/g)].map((match) => match[1]),
  );
  const missing = GAME_IDS.filter((game: Game) => !listed.has(game));
  assert.deepEqual(
    missing,
    [],
    `the README table calls itself authoritative but omits: ${missing.join(', ')}`,
  );
});
