import {
  BAIL_RATE,
  BUCKET,
  BUCKET_REACH,
  DOCK,
  DRAIN_RATE,
  FLOOD_RUSH,
  FLOOD_SEEP,
  LEAK_FIRST_MS,
  LEAK_GAP_MS,
  LEAK_LAST_MS,
  LEAK_REACH,
  LEAK_WINDOW_MS,
  MOORING,
  PATCH_DECAY,
  PATCH_HELP,
  PATCH_MS,
  ROUND_MS,
  WRECK_SHARK_MS,
  type Angler,
  type LeakCause,
  type ReelEvent,
  type ReelWorld,
  type Vector,
} from './types';
import { random } from './chaos';

type Emit = (w: ReelWorld, kind: ReelEvent['kind'], text: string) => void;

const CRACKS: Record<LeakCause, string> = {
  random: 'Pop! The boat sprang a leak!',
  shark: 'That shark bump cracked a plank!',
  thunder: 'The wave split a seam!',
  log: 'Rammed a log and cracked a plank!',
  monster: 'The Lake Manager slammed the hull!',
  landing: 'Two anglers landed at once and cracked a plank!',
};

/** What a held E does for an angler on deck, when it is not reeling. */
export function handsOnHull(w: ReelWorld, p: Angler): 'patch' | 'bail' | null {
  if (p.swimming || p.paddle || p.y > 0) return null;
  if (w.leak && Math.hypot(p.x - w.leak.x, p.z - w.leak.z) < LEAK_REACH)
    return 'patch';
  if (
    w.boat.flood > 0 &&
    Math.hypot(p.x - BUCKET.x, p.z - BUCKET.z) < BUCKET_REACH
  )
    return 'bail';
  return null;
}

/**
 * Cracks a plank if the tournament allows a leak right now: one at a time,
 * never in the opening or closing stretch, and never hard on the last one.
 */
export function springLeak(w: ReelWorld, cause: LeakCause, emit: Emit) {
  const into = w.clock - w.started;
  if (
    w.phase !== 'playing' ||
    w.boat.sunk ||
    w.leak ||
    w.clock < w.leakReadyAt ||
    into < LEAK_FIRST_MS ||
    ROUND_MS - into < LEAK_LAST_MS
  )
    return false;
  // A plank clear of the live well and the bucket, a step in from the rails.
  let spot = { x: 1.2, z: -2.2 };
  for (let i = 0; i < 6; i++) {
    const x = (random(w) * 2 - 1) * 1.8,
      z = (random(w) * 2 - 1) * 2.9;
    if (Math.abs(x) < 1.5 && Math.abs(z) < 0.75) continue;
    if (Math.hypot(x - BUCKET.x, z - BUCKET.z) < 1.2) continue;
    spot = { x, z };
    break;
  }
  w.leak = { ...spot, at: w.clock, patch: 0, warned: false };
  w.leaks++;
  emit(w, 'leak', `${CRACKS[cause]} Stand on the leak and hold E to patch it.`);
  return true;
}

function settle(w: ReelWorld) {
  w.leak = null;
  w.leakReadyAt = w.clock + LEAK_GAP_MS;
  w.leakDueAt = w.leakReadyAt + random(w) * 40_000;
}

/**
 * Patching, bailing and the water line. Returns true on the frame the boat
 * goes under; the caller puts the crew in the lake.
 */
export function advanceHull(w: ReelWorld, dt: number, emit: Emit) {
  const boat = w.boat;
  if (boat.sunk) return false;
  if (!w.leak && w.clock >= w.leakDueAt) springLeak(w, 'random', emit);
  const holding = w.players.filter((p) => p.input.reel);
  const bail = holding.some((p) => handsOnHull(w, p) === 'bail')
    ? BAIL_RATE
    : 0;
  const leak = w.leak;
  if (!leak) {
    boat.flood = Math.max(0, boat.flood - (DRAIN_RATE + bail) * dt);
    return false;
  }
  const patchers = holding.filter((p) => handsOnHull(w, p) === 'patch');
  for (const p of patchers) {
    p.stats.leaksRepaired += dt;
  }
  // Friends on the same crack finish it faster; walking off lets it gape again, slowly.
  leak.patch = patchers.length
    ? leak.patch +
      ((dt * 1000) / PATCH_MS) * (1 + PATCH_HELP * (patchers.length - 1))
    : Math.max(0, leak.patch - PATCH_DECAY * dt);
  const pouring = w.clock - leak.at >= LEAK_WINDOW_MS;
  if (pouring && !leak.warned) {
    leak.warned = true;
    emit(
      w,
      'flooding',
      'Water is pouring in! Patch the leak, bail with the bucket, or swim for it.',
    );
  }
  boat.flood = Math.min(
    1,
    Math.max(0, boat.flood + ((pouring ? FLOOD_RUSH : FLOOD_SEEP) - bail) * dt),
  );
  if (leak.patch >= 1) {
    emit(
      w,
      'patched',
      `${patchers.map((p) => p.name).join(' & ')} patched the leak!${boat.flood > 0.05 ? ' Now bail her out.' : ''}`,
    );
    settle(w);
    return false;
  }
  if (boat.flood < 1) return false;
  sink(w, emit);
  return true;
}

function sink(w: ReelWorld, emit: Emit) {
  const boat = w.boat;
  boat.sunk = true;
  boat.sunkAt = w.clock;
  boat.vx = boat.vz = boat.spin = 0;
  boat.rollVelocity = boat.pitchVelocity = 0;
  w.sinks++;
  const geared = w.gear.tire || w.gear.magnet || w.gear.boot;
  w.gear = { tire: false, magnet: false, boot: false };
  w.crab = null;
  settle(w);
  // The commotion brings sharks: two more, arriving from either side of the wreck.
  for (const side of [-1, 1]) {
    const angle = random(w) * Math.PI;
    w.wildlife.push({
      id: `wreck-shark-${w.sinks}-${side < 0 ? 'a' : 'b'}`,
      kind: 'shark',
      x: boat.x + Math.cos(angle) * 10 * side,
      z: boat.z + Math.sin(angle) * 10 * side,
      angle: 0,
      activeUntil: w.clock + WRECK_SHARK_MS,
      nextAt: 0,
      hitAt: w.clock + 2500,
      wreck: true,
    });
  }
  emit(
    w,
    'sink',
    `The boat sank!${geared ? ' The gear went down with it.' : ''} Swim to the dock for a new one, and mind the sharks.`,
  );
}

/** A dry new boat waiting at the dock. */
export function launchBoat(w: ReelWorld) {
  Object.assign(w.boat, {
    x: MOORING.x,
    z: MOORING.z,
    vx: 0,
    vz: 0,
    yaw: 0,
    spin: 0,
    roll: 0,
    pitch: 0,
    rollVelocity: 0,
    pitchVelocity: 0,
    flood: 0,
    sunk: false,
    sunkAt: 0,
  });
  w.boat.hull++;
  w.leakReadyAt = Math.max(w.leakReadyAt, w.clock + LEAK_GAP_MS);
  w.leakDueAt = Math.max(w.leakDueAt, w.leakReadyAt);
}

/** How far a swimmer is from the water end of the dock, in metres. */
export function dockGap(point: Vector) {
  return Math.hypot(
    Math.max(0, Math.abs(point.x - DOCK.x) - DOCK.half),
    Math.max(0, DOCK.z - point.z),
  );
}
