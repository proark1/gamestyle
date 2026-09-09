/** Polling games re-poll immediately when input changes, which keeps control
 *  latency low for discrete keys. Analog input changes on nearly every frame --
 *  a touch joystick, or a keyboard vector rotated by a moving camera yaw -- so
 *  without these two limits a single moving player polls as fast as the network
 *  allows, and every one of those requests runs a full server tick. */

/** Movement resolution the simulation can actually use. At 4.4 m/s and a 1/60
 *  step, one unit here is well under a millimetre of travel. */
const AXIS_STEPS = 100;

export function quantizeAxis(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * AXIS_STEPS) / AXIS_STEPS;
}

/** Floor for a change-triggered poll. A change can shorten the wait, never
 *  remove it. Held under the server's own per-member budget in
 *  shared/http/request-budget.ts (30 requests a second) so a moving player
 *  stays inside it instead of being answered with 429s and bounced into a
 *  reconnect backoff, which is what the unbounded rate actually caused. */
export const MIN_POLL_MS = 40;
