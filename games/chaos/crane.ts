import { validateAppearance, type Appearance } from './appearance';
import { levelOf, validLevel } from './levels';
import { mapConfig, type MapId } from './maps';
import type { Piece, Player, Vec, World } from './model';
import { placementError, roofAccessError, snapPlacement } from './placement';
import { surfaceHeight } from './colliders';

export const CRANE_BASE = { x: 7, z: -6 };
export const CRANE_RADIUS = 16;
export const PICKUP_MS = 3000;
export const PLACE_MS = 2200;
const LOWER_MS = 1100,
  LIFT_MS = 1400,
  CRUISE_Y = 2,
  HOOK_OFFSET = 3.65;
export const smooth = (t: number) => {
  const v = Math.max(0, Math.min(1, t));
  return v * v * (3 - 2 * v);
};
export const craneBase = (map?: MapId) => ({
  x: CRANE_BASE.x * mapConfig(map).scale,
  z: CRANE_BASE.z * mapConfig(map).scale,
});
// Smoothstep peaks at 1.5 times average speed. Limit the peak to four units/second.

const pathGeometry = (a: Vec, b: Vec, map?: MapId) => {
  const base = craneBase(map),
    start = Math.atan2(a.z - base.z, a.x - base.x),
    end = Math.atan2(b.z - base.z, b.x - base.x);
  return {
    base,
    start,
    delta: Math.atan2(Math.sin(end - start), Math.cos(end - start)),
    r0: Math.hypot(a.x - base.x, a.z - base.z),
    r1: Math.hypot(b.x - base.x, b.z - base.z),
  };
};
const travelTime = (a: Vec, b: Vec, map?: MapId) => {
  const { delta, r0, r1 } = pathGeometry(a, b, map);
  return Math.max(
    700,
    (Math.hypot(r1 - r0, delta * Math.max(r0, r1)) / 4) * 1500,
    (Math.abs(delta) / 0.65) * 1500,
  );
};
const pathPoint = (a: Vec, b: Vec, t: number, map?: MapId) => {
  if (t <= 0) return { x: a.x, z: a.z };
  if (t >= 1) return { x: b.x, z: b.z };
  const { base, start, delta, r0, r1 } = pathGeometry(a, b, map),
    radius = mix(r0, r1, t),
    angle = start + delta * t;
  return {
    x: base.x + Math.cos(angle) * radius,
    z: base.z + Math.sin(angle) * radius,
  };
};
export type CraneState = {
  operatorId: string;
  pieceId: string;
  phase: 'pickup' | 'ready' | 'placing';
  at: number;
  error?: string;
  map?: MapId;
  duration?: number;
  travelMs?: number;
  lowerMs?: number;
  liftMs?: number;
  hookFrom?: Vec & { hookY: number };
  fromRotation?: number;
  origin: Piece;
  from: Vec & { y: number };
  to?: Vec & { rotation: number };
};
export type CraneAction =
  | { type: 'crane-pick'; id: string }
  | (Appearance & {
      type: 'crane-place';
      x: number;
      z: number;
      rotation: number;
      level?: number;
    })
  | { type: 'crane-cancel' };
export const craneReach = (p: Vec, map?: MapId) =>
  Math.hypot(p.x - craneBase(map).x, p.z - craneBase(map).z) <=
  CRANE_RADIUS * mapConfig(map).scale;
export const roofSupplies = (map?: MapId): Piece[] =>
  [
    {
      id: 'roof-supply-east',
      kind: 'roof',
      x: 7.6,
      z: -3.3,
      rotation: 0,
      placed: false,
      supply: true,
    },
    {
      id: 'roof-supply-back',
      kind: 'roof',
      x: 3.8,
      z: -6.3,
      rotation: 0,
      placed: false,
      supply: true,
    },
  ].map((p) => ({
    ...p,
    kind: 'roof',
    x: p.x * mapConfig(map).scale,
    z: p.z * mapConfig(map).scale,
  }));
export const roofBase = (p: Piece, map?: MapId) =>
  p.supply
    ? surfaceHeight(p, map) - 2.6
    : (p.physics?.y ?? surfaceHeight(p, map));
const mix = (a: number, b: number, t: number) =>
  a + (b - a) * Math.max(0, Math.min(1, t));

export const craneDuration = (crane: CraneState) =>
  crane.duration ?? (crane.phase === 'placing' ? PLACE_MS : PICKUP_MS);
export function parkedCranePose(
  world: Pick<World, 'map' | 'cranePark'>,
  now: number,
) {
  const rest = world.cranePark;
  if (!rest) {
    const stock = roofSupplies(world.map)[1];
    return { x: stock.x, z: stock.z, hookY: 5.65 };
  }
  return {
    x: rest.x,
    z: rest.z,
    hookY: mix(rest.hookY, 5.65, smooth((now - rest.at) / 1600)),
  };
}
/** Cargo, hook and server completion share one eased, distance-aware timeline. */
export function cranePose(crane: CraneState, now: number) {
  const { from, to } = crane;
  const elapsed = Math.max(0, now - crane.at);
  if (crane.phase === 'placing' && to) {
    const travel = crane.travelMs ?? craneDuration(crane) - LOWER_MS;
    const horizontal = smooth(elapsed / travel),
      lower = smooth((elapsed - travel) / LOWER_MS);
    const startCruise = Math.max(CRUISE_Y, from.y + 1),
      cruise = Math.max(startCruise, surfaceHeight(to, crane.map) + 1);
    const y =
      elapsed < travel
        ? mix(startCruise, cruise, horizontal)
        : mix(cruise, surfaceHeight(to, crane.map), lower);
    const rotation =
      ((crane.fromRotation ?? crane.origin.rotation) * Math.PI) / 2;
    const delta = Math.atan2(
      Math.sin((to.rotation * Math.PI) / 2 - rotation),
      Math.cos((to.rotation * Math.PI) / 2 - rotation),
    );
    const point = pathPoint(from, to, horizontal, crane.map);
    return {
      ...point,
      y,
      hookX: point.x,
      hookZ: point.z,
      hookY: y + HOOK_OFFSET,
      rotation: rotation + delta * horizontal,
    };
  }
  const lowerMs = crane.lowerMs ?? LOWER_MS,
    liftMs = crane.liftMs ?? LIFT_MS;
  const approach =
    crane.travelMs ?? Math.max(0, craneDuration(crane) - lowerMs - liftMs);
  const hook = crane.hookFrom ?? { x: from.x, z: from.z, hookY: 5.65 };
  const travel = smooth(elapsed / Math.max(1, approach));
  const pickupCruise = Math.max(CRUISE_Y, from.y + 1);
  const y =
    crane.phase === 'ready'
      ? pickupCruise
      : mix(
          from.y,
          pickupCruise,
          smooth((elapsed - approach - lowerMs) / liftMs),
        );
  const hookY =
    crane.phase === 'ready'
      ? pickupCruise + HOOK_OFFSET
      : elapsed < approach
        ? mix(hook.hookY, 5.65, travel)
        : lowerMs > 0 && elapsed < approach + lowerMs
          ? mix(
              approach === 0 ? hook.hookY : 5.65,
              from.y + HOOK_OFFSET,
              smooth((elapsed - approach) / lowerMs),
            )
          : y + HOOK_OFFSET;
  const point =
    crane.phase === 'ready' ? from : pathPoint(hook, from, travel, crane.map);
  return {
    x: from.x,
    z: from.z,
    y,
    hookX: point.x,
    hookZ: point.z,
    hookY,
    rotation: ((crane.fromRotation ?? crane.origin.rotation) * Math.PI) / 2,
  };
}
function parkCrane(world: World, now: number) {
  if (!world.crane) return;
  const pose = cranePose(world.crane, now);
  world.cranePark = {
    x: pose.hookX,
    z: pose.hookZ,
    hookY: pose.hookY,
    at: now,
  };
}

export function cancelCrane(world: World, now = Date.now()) {
  const crane = world.crane;
  if (!crane) return;
  parkCrane(world, now);
  const index = world.pieces.findIndex((p) => p.id === crane.pieceId);
  if (index !== -1) {
    if (crane.origin.supply) world.pieces.splice(index, 1);
    else world.pieces[index] = structuredClone(crane.origin);
  }
  parkCrane(world, now);
  delete world.crane;
}

export function craneAction(
  world: World,
  action: CraneAction,
  player: Player,
  now: number,
) {
  const active = world.crane;
  if (active && active.operatorId !== player.id)
    throw new Error('The crane is in use. Wait for the other builder.');
  if (action.type === 'crane-cancel') {
    cancelCrane(world, now);
    return;
  }
  if (action.type === 'crane-pick') {
    if (active) throw new Error('Place the suspended roof or return it first.');
    if (world.pieces.some((p) => p.heldBy === player.id))
      throw new Error('Put down your carried object before using the crane.');
    const source = world.pieces.find((p) => p.id === action.id);
    if (
      !source ||
      source.kind !== 'roof' ||
      source.heldBy ||
      source.hoisted ||
      !craneReach(source, world.map)
    )
      throw new Error('Choose a roof module within crane reach.');
    if (source.physics && Math.hypot(...source.physics.v) > 1)
      throw new Error('Wait for the roof module to stop moving.');
    const access = roofAccessError(world, source, source.rotation, source.id);
    if (access) throw new Error(access);
    if (source.supply && world.pieces.length >= 160)
      throw new Error('The site is full. Remove a few parts first.');
    const origin = structuredClone(source);
    const cargo = source.supply
      ? { ...source, id: crypto.randomUUID() }
      : source;
    if (source.supply) world.pieces.push(cargo);
    cargo.supply = false;
    cargo.hoisted = true;
    cargo.placed = false;
    delete cargo.physics;
    const hookFrom = parkedCranePose(world, now),
      travelMs = Math.max(
        travelTime(hookFrom, source, world.map),
        Math.abs(hookFrom.hookY - 5.65) * 500,
      );
    const lowerMs = Math.max(
        LOWER_MS,
        Math.abs(2 - roofBase(origin, world.map)) * 500,
      ),
      liftMs = Math.max(LIFT_MS, lowerMs);
    world.crane = {
      map: world.map,
      hookFrom,
      travelMs,
      lowerMs,
      liftMs,
      duration: travelMs + lowerMs + liftMs,
      operatorId: player.id,
      pieceId: cargo.id,
      phase: 'pickup',
      at: now,
      origin,
      from: { x: origin.x, z: origin.z, y: roofBase(origin, world.map) },
    };
    world.events.push({
      id: crypto.randomUUID(),
      type: 'grab',
      text: 'Roof module hooked onto the crane.',
      at: now,
      x: origin.x,
      z: origin.z,
      audioCue: 'material.roof.grab',
    });
    world.events = world.events.slice(-12);
    return;
  }
  if (!active || active.phase !== 'ready')
    throw new Error('Wait until the roof is lifted, then choose its location.');
  if (!validLevel(action.level ?? 0))
    throw new Error('Choose Floor 1, 2 or 3.');
  if (
    ![action.x, action.z].every(Number.isFinite) ||
    !Number.isInteger(action.rotation)
  )
    throw new Error('Choose a valid roof location.');
  const rotation = ((action.rotation % 4) + 4) % 4;
  const target = snapPlacement(world, 'roof', action, rotation);
  if (!craneReach(target, world.map))
    throw new Error('This location is outside crane reach.');
  const error = placementError(world, 'roof', target, active.pieceId, rotation);
  if (error) throw new Error(error);
  const appearance = validateAppearance('roof', action);
  const cargo = world.pieces.find((p) => p.id === active.pieceId);
  if (cargo) Object.assign(cargo, appearance);
  delete active.error;
  active.to = target;
  active.phase = 'placing';
  active.at = now;
  active.travelMs = travelTime(active.from, target, world.map);
  active.duration = active.travelMs + LOWER_MS;
}

export function tickCrane(world: World, players: Player[], now: number) {
  const crane = world.crane;
  if (!crane) return;
  if (
    !players.some((p) => p.id === crane.operatorId) ||
    now - crane.at > 90000
  ) {
    cancelCrane(world, now);
    return;
  }
  if (crane.phase === 'pickup' && now - crane.at >= craneDuration(crane))
    crane.phase = 'ready';
  if (
    crane.phase !== 'placing' ||
    !crane.to ||
    now - crane.at < craneDuration(crane)
  )
    return;
  const target = crane.to;
  // Another builder may have changed the house while the load was travelling.
  const error = placementError(
    world,
    'roof',
    target,
    crane.pieceId,
    target.rotation,
  );
  if (error) {
    crane.error = error;
    // Re-lift at the destination; never teleport back across the site on validation failure.
    const pose = cranePose(crane, now);
    crane.from = { x: target.x, z: target.z, y: pose.y };
    crane.hookFrom = { x: target.x, z: target.z, hookY: pose.hookY };
    crane.fromRotation = target.rotation;
    crane.phase = 'pickup';
    crane.travelMs = 0;
    crane.lowerMs = 0;
    crane.liftMs = LIFT_MS;
    crane.duration = LIFT_MS;
    crane.at = now;
    delete crane.to;
    return;
  }
  const piece = world.pieces.find((p) => p.id === crane.pieceId);
  if (piece) {
    Object.assign(piece, {
      x: target.x,
      z: target.z,
      rotation: target.rotation,
      level: levelOf(target),
      placed: true,
    });
    delete piece.hoisted;
    world.builds++;
    world.events.push({
      id: crypto.randomUUID(),
      type: 'build',
      text: 'Roof lowered into place.',
      at: now,
      x: target.x,
      z: target.z,
      audioCue: 'material.roof.place',
    });
    world.events = world.events.slice(-12);
  }
  parkCrane(world, now);
  delete world.crane;
}
