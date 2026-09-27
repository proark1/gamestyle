import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botProfile, commitTask, reelWindow } from './bot-behavior';
import { freshWorld } from './simulation';
import { stepBots } from './bots';

void test('bot personalities are deterministic and vary by seat', () => {
  assert.deepEqual(botProfile(1234, 1), botProfile(1234, 1));
  assert.notDeepEqual(botProfile(1234, 0), botProfile(1234, 1));
  for (let seat = 0; seat < 4; seat++) {
    const profile = botProfile(1234, seat);
    assert.ok(profile.reactionMs >= 280 && profile.reactionMs <= 800);
    assert.ok(profile.walkSpeed >= 2.35 && profile.walkSpeed <= 3.05);
    assert.ok(profile.reelDuty >= 0.68 && profile.reelDuty <= 0.82);
  }
});

void test('bots commit to a task through a human reaction window', () => {
  const world = freshWorld(100);
  const bot = world.players.find((player) => player.bot)!;
  assert.equal(
    commitTask(world, bot, { kind: 'store', target: 'fish-1' }),
    false,
  );
  const claimedAt = bot.task!.claimedAt;
  world.clock += botProfile(world.round.seed, bot.seat).reactionMs - 1;
  assert.equal(
    commitTask(world, bot, { kind: 'store', target: 'fish-1' }),
    false,
  );
  assert.equal(bot.task!.claimedAt, claimedAt);
  world.clock++;
  assert.equal(
    commitTask(world, bot, { kind: 'store', target: 'fish-1' }),
    true,
  );
});

void test('reeling has deliberate work and rest windows', () => {
  const world = freshWorld(0);
  const bot = world.players.find((player) => player.bot)!;
  const values = new Set<boolean>();
  for (let time = 0; time < 3000; time += 100) {
    world.clock = time;
    values.add(reelWindow(world, bot));
  }
  assert.deepEqual(values, new Set([true, false]));
});

void test('bots settle at purposeful idle points instead of pacing', () => {
  const world = freshWorld(0);
  world.phase = world.round.phase = 'outbound';
  for (let index = 0; index < 200; index++) {
    world.clock += 50;
    stepBots(world, 0.05);
  }
  const resting = world.players
    .filter((player) => player.bot && player.task?.kind !== 'helm')
    .map((player) => ({ id: player.id, x: player.x, z: player.z }));
  for (let index = 0; index < 120; index++) {
    world.clock += 50;
    stepBots(world, 0.05);
  }
  for (const before of resting) {
    const after = world.players.find((player) => player.id === before.id)!;
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.03);
  }
});
