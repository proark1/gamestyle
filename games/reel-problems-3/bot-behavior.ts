import type { AdventurePlayer, AdventureWorld, BotTask } from './types';

export type BotProfile = {
  reactionMs: number;
  walkSpeed: number;
  reelCycleMs: number;
  reelDuty: number;
  pauseMs: number;
  accuracy: number;
};

function mix(value: number) {
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function unit(seed: number, salt: number) {
  return mix(seed ^ Math.imul(salt + 1, 0x9e3779b1)) / 0xffffffff;
}

export function botProfile(seed: number, seat: number): BotProfile {
  const own = mix(seed ^ Math.imul(seat + 11, 0x45d9f3b));
  return {
    reactionMs: 280 + Math.round(unit(own, 1) * 520),
    walkSpeed: 2.35 + unit(own, 2) * 0.7,
    reelCycleMs: 720 + Math.round(unit(own, 3) * 620),
    reelDuty: 0.68 + unit(own, 4) * 0.14,
    pauseMs: 420 + Math.round(unit(own, 5) * 900),
    accuracy: 0.72 + unit(own, 6) * 0.22,
  };
}

export function profileFor(world: AdventureWorld, player: AdventurePlayer) {
  return botProfile(world.round.seed, player.seat);
}

export function commitTask(
  world: AdventureWorld,
  player: AdventurePlayer,
  next: Omit<BotTask, 'claimedAt'>,
) {
  const current = player.task;
  if (current?.kind === next.kind && current.target === next.target)
    return (
      world.clock >= current.claimedAt + profileFor(world, player).reactionMs
    );
  player.task = { ...next, claimedAt: world.clock };
  return false;
}

export function reelWindow(world: AdventureWorld, player: AdventurePlayer) {
  const profile = profileFor(world, player);
  const phase =
    ((world.clock + player.seat * 173) % profile.reelCycleMs) /
    profile.reelCycleMs;
  return phase < profile.reelDuty;
}
