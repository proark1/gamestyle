import { FIELD, type Cow, type Point } from './types';

export const FENCE_CONTACT = FIELD - 0.6;
export const SHOCK_STUN_MS = 650;
export const SHOCK_COOLDOWN_MS = 1_500;
export const SHOCK_EXPOSURE_MS = 5_000;

export function shockAge(cow: Cow, clock: number) {
  return cow.shockedAt ? Math.max(0, clock - cow.shockedAt) : Infinity;
}

export function cowExposed(cow: Cow, clock: number) {
  return (
    !cow.captured && !cow.escaped && shockAge(cow, clock) < SHOCK_EXPOSURE_MS
  );
}

export function fenceDistance(point: Point) {
  return Math.max(0, FIELD - Math.max(Math.abs(point.x), Math.abs(point.z)));
}

/** Run on the authoritative simulation, including stationary contact. */
export function shockAtFence(cow: Cow, clock: number, powerOff: boolean) {
  if (
    powerOff ||
    cow.captured ||
    cow.escaped ||
    shockAge(cow, clock) < SHOCK_COOLDOWN_MS
  )
    return false;
  const hitX = Math.abs(cow.x) >= FENCE_CONTACT - 0.000001;
  const hitZ = Math.abs(cow.z) >= FENCE_CONTACT - 0.000001;
  if (!hitX && !hitZ) return false;
  cow.shockedAt = clock;
  if (hitX) cow.x = Math.sign(cow.x) * (FENCE_CONTACT - 0.5);
  if (hitZ) cow.z = Math.sign(cow.z) * (FENCE_CONTACT - 0.5);
  cow.moving = false;
  cow.grazing = false;
  cow.task = 0;
  return true;
}
