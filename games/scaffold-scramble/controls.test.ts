import test from 'node:test';
import assert from 'node:assert/strict';
import { combineInput, type TouchControl } from './controls';
import { scaffoldHint } from './guidance';
import {
  freshScaffoldWorld,
  newPlayer,
  scaffoldScrambleAction,
} from './simulation';
import { idleInput } from './types';

void test('touch hold survives keyboard polling and cancellation stops every held action', () => {
  const pointers = new Map<number, TouchControl>([
    [1, 'right'],
    [2, 'crankLeftUp'],
    [3, 'action'],
  ]);
  for (let frame = 0; frame < 10; frame++) {
    const input = combineInput(idleInput(), pointers.values(), true);
    assert.equal(input.x, 1);
    assert.equal(input.crankLeftUp, true);
    assert.equal(input.action, true);
    assert.equal(input.jump, true);
  }
  pointers.delete(1);
  assert.equal(combineInput(idleInput(), pointers.values(), true).x, 0);
  pointers.clear();
  assert.deepEqual(
    combineInput(idleInput(), pointers.values(), true),
    idleInput(),
  );
});

void test('opposite touch directions cancel and disabled controls clear keyboard and touch', () => {
  const keyboard = { ...idleInput(), x: 1, crankRightDown: true };
  assert.equal(combineInput(idleInput(), ['left', 'right'], true).x, 0);
  assert.equal(combineInput(keyboard, ['right'], true).x, 1);
  assert.deepEqual(
    combineInput(keyboard, ['left', 'action'], false),
    idleInput(),
  );
});

void test('guidance follows the actual reachable window through the cleaning cycle', () => {
  const world = freshScaffoldWorld(1000);
  const player = newPlayer('me', 'Me', 0, 'cleaner', false);
  world.players = [player];
  world.phase = 'playing';
  player.deckX = 0;
  world.windows = [
    {
      id: 'target',
      col: 0,
      row: 0,
      x: 0,
      y: 51.2,
      status: 'dirty',
      foamAmount: 0,
      sparkleTimer: 0,
    },
  ];
  assert.equal(scaffoldHint(world, player), 'soap');
  scaffoldScrambleAction(world, player.id, { type: 'useTool' });
  assert.equal(scaffoldHint(world, player), 'switchWipe');
  scaffoldScrambleAction(world, player.id, { type: 'switchTool' });
  assert.equal(scaffoldHint(world, player), 'wipe');
  scaffoldScrambleAction(world, player.id, { type: 'useTool' });
  assert.equal(scaffoldHint(world, player), 'done');
  assert.equal(world.cleanedCount, 1);
  player.deckX = 4;
  assert.equal(scaffoldHint(world, player), 'move');
  world.cradle.tiltDeg = 21;
  assert.equal(scaffoldHint(world, player), 'balance');
  player.state = 'dangling';
  assert.equal(scaffoldHint(world, player), 'climb');
});
