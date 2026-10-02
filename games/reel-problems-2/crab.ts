import {
  BOAT_HALF,
  CRAB_CHANCE,
  CRAB_MS,
  PINCH_COOLDOWN,
  PINCH_HOP,
  PINCH_REACH,
  PINCH_SHOVE,
  STOMP_REACH,
  type Angler,
  type ReelEvent,
  type ReelWorld,
} from './types';
import { random } from './chaos';

type Emit = (w: ReelWorld, kind: ReelEvent['kind'], text: string) => void;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * A landed fish sometimes brings a stowaway up out of the live well. The catch
 * announcement mentions it, so the crowd hears about the fish first.
 */
export function maybeCrab(w: ReelWorld) {
  if (w.crab || w.boat.sunk || random(w) >= CRAB_CHANCE) return false;
  w.crab = {
    x: (random(w) < 0.5 ? -1 : 1) * 1.4,
    z: 0,
    angle: 0,
    pinchAt: w.clock + 1500,
    until: w.clock + CRAB_MS,
  };
  return true;
}

/**
 * The crab sidles after whoever is nearest. A pinch is a hop with a shove away
 * from the claws, which from beside the rail carries you over it.
 */
export function advanceCrab(w: ReelWorld, dt: number, emit: Emit) {
  const crab = w.crab;
  if (!crab) return;
  // Bored crabs wander back over the side.
  if (w.boat.sunk || w.clock >= crab.until) {
    w.crab = null;
    return;
  }
  const prey = w.players
    .filter((p) => !p.swimming)
    .map((p) => ({ p, d: Math.hypot(p.x - crab.x, p.z - crab.z) }))
    .sort((a, b) => a.d - b.d)[0];
  if (!prey) return;
  const d = Math.max(0.01, prey.d),
    step = Math.min(prey.d, dt * 0.9);
  crab.x = clamp(
    crab.x + ((prey.p.x - crab.x) / d) * step,
    -BOAT_HALF.x,
    BOAT_HALF.x,
  );
  crab.z = clamp(
    crab.z + ((prey.p.z - crab.z) / d) * step,
    -BOAT_HALF.z,
    BOAT_HALF.z,
  );
  if (prey.d > 0.05)
    crab.angle = Math.atan2(prey.p.x - crab.x, prey.p.z - crab.z);
  const p = prey.p;
  if (prey.d > PINCH_REACH || p.y > 0 || p.vy > 0 || w.clock < crab.pinchAt)
    return;
  crab.pinchAt = w.clock + PINCH_COOLDOWN;
  p.vy = PINCH_HOP;
  p.pinched = true;
  p.paddle = 0;
  p.slipX = Math.sin(crab.angle) * PINCH_SHOVE;
  p.slipZ = Math.cos(crab.angle) * PINCH_SHOVE;
  emit(w, 'pinch', `${p.name} got pinched! Ow!`);
}

/** Both feet came down on the crab: that is the end of its voyage. */
export function stompCrab(w: ReelWorld, p: Angler, emit: Emit) {
  const crab = w.crab;
  if (
    !crab ||
    p.pinched ||
    Math.hypot(p.x - crab.x, p.z - crab.z) > STOMP_REACH
  )
    return false;
  w.crab = null;
  emit(w, 'stomp', `${p.name} stomped the crab clean overboard!`);
  return true;
}
