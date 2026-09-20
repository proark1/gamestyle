import { advanceHotel } from './simulation';
import type { HotelWorld } from './types';

/** A dialog pauses the entire local world, not just its controls or visible timer. */
export function advancePractice(
  world: HotelWorld,
  delta: number,
  paused: boolean,
) {
  if (!paused)
    advanceHotel(world, world.clock + Math.min(100, Math.max(0, delta)));
}
