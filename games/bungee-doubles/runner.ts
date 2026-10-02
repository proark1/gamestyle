import type { BungeeWorld } from './types';
import { advanceBungee, autoServe } from './simulation';
import { stepBungeeBot } from './bots';

export const FIXED_STEP = 1 / 120;

/** Both solo and peers run the same physics and AI cadence, regardless of display Hz. */
export function createBungeeRunner(servePatience?: number) {
  let accumulator = 0;
  const serve = servePatience === undefined ? null : autoServe(servePatience);
  return (world: BungeeWorld, elapsed: number) => {
    accumulator += Math.max(0, Math.min(0.1, elapsed));
    while (accumulator + 1e-9 >= FIXED_STEP) {
      const stepNow = world.clock + FIXED_STEP * 1000;
      for (const player of world.players)
        if (player.bot) stepBungeeBot(player, world, FIXED_STEP, stepNow);
      serve?.(world, stepNow);
      advanceBungee(world, FIXED_STEP, stepNow);
      accumulator = Math.max(0, accumulator - FIXED_STEP);
    }
  };
}
