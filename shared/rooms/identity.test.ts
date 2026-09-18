import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_CODE_PATTERN,
  isRoomCode,
  looksLikeRoomCode,
  newRoomCode,
  playerName,
  roomCode,
} from './identity';

void test('a minted code is canonical and drawn from the readable alphabet', () => {
  for (let i = 0; i < 200; i++) {
    const code = newRoomCode();
    assert.equal(code.length, ROOM_CODE_LENGTH);
    assert.ok(isRoomCode(code), code);
    for (const character of code)
      assert.ok(
        ROOM_CODE_ALPHABET.includes(character),
        `${code}: ${character}`,
      );
  }
});

void test('the alphabet leaves out the glyphs players misread aloud', () => {
  for (const confusable of ['I', 'O', '0', '1'])
    assert.ok(
      !ROOM_CODE_ALPHABET.includes(confusable),
      `${confusable} is easy to mishear`,
    );
});

void test('canonical codes are accepted and lower case is not', () => {
  assert.ok(isRoomCode('ABC234'));
  assert.ok(!isRoomCode('abc234'));
  assert.ok(!isRoomCode('ABC23'));
  assert.ok(!isRoomCode('ABC2345'));
  assert.ok(!isRoomCode('ABC-34'));
  assert.ok(
    !isRoomCode('ABC201'),
    'the digits 0 and 1 are not code characters',
  );
  assert.ok(!isRoomCode(undefined));
  assert.ok(!isRoomCode(123456));
});

void test('player-typed input is accepted in any case and normalised', () => {
  assert.ok(looksLikeRoomCode('abc234'));
  assert.ok(looksLikeRoomCode('AbC234'));
  assert.ok(!looksLikeRoomCode('abc'));
  assert.equal(roomCode('abc234'), 'ABC234');
  assert.equal(roomCode('ABC234'), 'ABC234');
  assert.equal(roomCode('not a code'), null);
  assert.equal(roomCode(null), null);
});

void test('validation stays looser than generation for older codes', () => {
  // I and O were once mintable; those invites must still resolve.
  assert.ok(isRoomCode('AIOZ23'));
  assert.ok(!ROOM_CODE_ALPHABET.includes('I'));
});

void test('the input pattern matches the canonical guard', () => {
  const anchored = new RegExp(`^${ROOM_CODE_PATTERN}$`);
  for (const value of ['ABC234', 'ZZZ999', 'abc234', 'ABC2', 'ABCDEFG'])
    assert.equal(anchored.test(value), isRoomCode(value), value);
});

void test('player names are trimmed, capped and stripped of control characters', () => {
  assert.equal(playerName('  Ana  ', 'Player'), 'Ana');
  assert.equal(playerName('', 'Player'), 'Player');
  assert.equal(playerName(undefined, 'Player'), 'Player');
  assert.equal(playerName('<script>', 'Player'), 'script');
  assert.equal(playerName('a'.repeat(40), 'Player').length, 18);
});
