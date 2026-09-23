import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_IDS, isHandwerkerGame } from '../games/identity';

void test('every game route applies the dormant server-side access boundary', () => {
  for (const game of GAME_IDS) {
    const route = isHandwerkerGame(game)
      ? `app/(handwerker)/${game}/page.tsx`
      : `app/${game}/page.tsx`;
    const source = readFileSync(route, 'utf8');
    assert.match(
      source,
      new RegExp(`gamePageAccess\\(['\"]${game}['\"]\\)`),
      `${route} can bypass admission when the gate is activated`,
    );
  }
});
