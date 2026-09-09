import type { RoomStore } from './types';

/** A room stops being reachable a day after its last write, but the row stayed
 *  forever, so the table only ever grew. Sweeping is opportunistic rather than
 *  scheduled because the Workers target has no background timers. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 10 * 60 * 1000;

let nextSweep = 0;
let sweeping = false;

/** Exported for tests; a fresh process starts ready to sweep. */
export function resetRoomSweep(at = 0) {
  nextSweep = at;
  sweeping = false;
}

/** Never awaited by a request: a slow sweep must not delay a player. */
export function sweepExpiredRooms(store: RoomStore, now = Date.now()) {
  if (!store.purge || sweeping || now < nextSweep) return;
  sweeping = true;
  nextSweep = now + SWEEP_EVERY_MS;
  void Promise.resolve(store.purge(now - ROOM_TTL_MS))
    .catch((error) => {
      // A failed sweep is not worth failing a request over; the next one retries.
      console.error('Room sweep failed', error);
    })
    .finally(() => {
      sweeping = false;
    });
}
