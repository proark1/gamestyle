import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import {
  BORROWED_AUDIO,
  GAME_IDS,
  HANDWERKER_GAMES,
  PARTY_EXCLUDED,
  isGame,
  isHandwerkerGame,
  workshopOf,
} from './identity';

const directories = readdirSync('games', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

void test('the collection list is exactly the folders under games/', () => {
  // A new game folder must be named here, which is what makes every registry
  // check in platform/games/registry.test.ts meaningful.
  assert.deepEqual([...GAME_IDS], directories);
  assert.equal(new Set(GAME_IDS).size, GAME_IDS.length);
});

void test('every trait names a real game', () => {
  for (const game of HANDWERKER_GAMES) assert.ok(isGame(game), game);
  for (const [game, source] of Object.entries(BORROWED_AUDIO)) {
    assert.ok(isGame(game), game);
    assert.ok(isGame(source), source);
    assert.notEqual(game, source, `${game} cannot borrow from itself`);
  }
  for (const [game, reason] of Object.entries(PARTY_EXCLUDED)) {
    assert.ok(isGame(game), game);
    assert.ok(reason.length > 10, `${game} needs a reason, not a placeholder`);
  }
});

void test('the guards accept only real games', () => {
  assert.ok(isGame('stack-or-sink'));
  assert.ok(!isGame('stack-or-sunk'));
  assert.ok(!isGame(''));
  assert.ok(!isGame(undefined));
  assert.ok(isHandwerkerGame('chaos'));
  assert.ok(!isHandwerkerGame('basketball'));
});

void test('a game owns its workshop unless it borrows recordings', () => {
  assert.equal(workshopOf('basketball'), 'basketball');
  assert.equal(workshopOf('shelf-control'), 'act-natural');
  // Borrowing is not transitive: the source must own its own workshop.
  for (const source of Object.values(BORROWED_AUDIO))
    assert.equal(workshopOf(source), source);
});
