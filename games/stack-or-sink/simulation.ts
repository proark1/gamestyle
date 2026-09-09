import {
  GOAL,
  ITEMS,
  dimensions,
  type Action,
  type Input,
  type Kind,
  type Piece,
  type Player,
  type World,
} from './types';
import { clamp } from '../../shared/math/clamp';
import { FLOOR } from './geometry';
import {
  simulationPhysics,
  STEP,
  landingHeight,
  playerSpotClear,
  poseError,
  cranePoseError,
  predictPlayer,
  resetMotion,
  supportSurface,
  topOf,
  touchPiece,
} from './physics';

export const emptyInput = (): Input => ({ x: 0, z: 0, jump: false, seq: 0 });
export function createPlayer(
  id: string,
  name: string,
  color: number,
  slot: number,
  now: number,
): Player {
  return {
    id,
    name,
    color,
    x: -2.4 + slot * 1.5,
    y: FLOOR,
    z: 7.8,
    vy: 0,
    angle: Math.PI,
    grounded: true,
    breath: 8,
    down: false,
    rescued: false,
    seen: now,
    input: emptyInput(),
    lastJump: -1,
  };
}
export function freshWorld(
  now: number,
  mode: World['mode'] = 'normal',
  seed = 1,
): World {
  const world: World = {
    phase: 'lobby',
    mode,
    started: 0,
    clock: now,
    water: -0.4,
    pieces: [],
    players: [],
    bestHeight: 0,
    events: [],
    crane: { owner: null, piece: null, x: 0, y: 3, z: 0 },
    seed,
    remainder: 0,
  };
  const kinds: Kind[] = [
    'crate',
    'pallet',
    'sofa',
    'crate',
    'fridge',
    'plank',
    'bathtub',
    'crate',
    'pallet',
  ];
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 5; col++) {
      if (
        (row === 0 && col === 0) ||
        (row === 2 && col === 2) ||
        (row === 4 && col > 0 && col < 4)
      )
        continue;
      const i = world.pieces.length,
        kind =
          row === 0 && col === 1 ? 'crate' : kinds[(i + seed) % kinds.length];
      const p: Piece = {
        id: `junk-${i}`,
        kind,
        x: -7.4 + col * 3.7,
        y: FLOOR,
        z: -7.4 + row * 3.7,
        rotation: 0,
        vy: 0,
        tilt: 0,
        unstable: 0,
        revision: 0,
      };
      if (!poseError(world, p)) world.pieces.push(p);
    }
  // Supply 28 pieces while checking the actual compound supports.
  const bases = [...world.pieces];
  let index = 0;
  while (world.pieces.length < 28) {
    const base = bases[index++ % bases.length],
      p: Piece = {
        id: `junk-${world.pieces.length}`,
        kind: 'crate',
        x: base.x,
        y: 0,
        z: base.z,
        rotation: 0,
        vy: 0,
        tilt: 0,
        unstable: 0,
        revision: 0,
      };
    p.y = landingHeight(world, p, p.x, p.z, 6);
    if (!poseError(world, p)) world.pieces.push(p);
    if (index > 100) throw new Error('Unable to arrange salvage safely.');
  }
  return world;
}
export function emit(
  world: World,
  text: string,
  kind: 'info' | 'danger' | 'good' = 'info',
) {
  world.events.push({
    id: `${world.clock}-${world.events.length}-${text.slice(0, 12)}`,
    text,
    kind,
    at: world.clock,
  });
  world.events = world.events.slice(-12);
}
export function waterAt(world: World, now: number) {
  return world.mode === 'practice' || !world.started
    ? -0.4
    : Math.min(
        15,
        -0.4 + Math.max(0, (now - world.started) / 1000 - 60) * 0.025,
      );
}
export function overlaps(
  x: number,
  z: number,
  w: number,
  d: number,
  p: Piece,
  pad = 0,
) {
  const s = dimensions(p);
  return (
    Math.abs(x - p.x) < (w + s.w) / 2 - pad &&
    Math.abs(z - p.z) < (d + s.d) / 2 - pad
  );
}
export const supportHeight = supportSurface;
export const movePlayer = predictPlayer;
/** `cacheKey` lets a caller that re-parses the world each time (the room
 *  handler) keep one rigid-body world instead of rebuilding it per request. */
export function tick(world: World, now: number, cacheKey?: object | string) {
  if (now <= world.clock) return world;
  const elapsed = Math.min((now - world.clock) / 1000, 2);
  world.clock = now;
  if (world.phase === 'won' || world.phase === 'lost') return world;
  world.water = waterAt(world, now);
  const total = elapsed + (world.remainder || 0),
    count = Math.floor((total + 1e-9) / STEP);
  world.remainder = total - count * STEP;
  if (count) {
    const physics = simulationPhysics(world, cacheKey ?? world);
    for (let step = 0; step < count; step++) {
      for (const p of world.players)
        physics.controls(p, now - p.seen > 750 ? emptyInput() : p.input, STEP);
      physics.step(STEP);
      for (const p of world.players) physics.readPlayer(p);
      for (const p of world.players) {
        if (world.phase !== 'playing') continue;
        if (world.water > p.y + 1.5) {
          p.breath = Math.max(0, p.breath - STEP);
          if (p.breath === 0 && !p.down) {
            p.down = true;
            p.input = emptyInput();
            emit(world, `${p.name} needs a rescue!`, 'danger');
            releasePlayer(world, p.id);
          }
        } else p.breath = Math.min(8, p.breath + STEP * 2);
        if (
          !p.down &&
          p.y >= GOAL - 0.08 &&
          p.grounded &&
          Math.abs(p.x) < 2.3 &&
          Math.abs(p.z) < 2.3
        ) {
          p.rescued = true;
          world.phase = 'won';
          emit(
            world,
            `${p.name} reached rescue. The whole crew is coming home!`,
            'good',
          );
          break;
        }
      }
      if (world.phase === 'won') break;
    }
    physics.save();
  }
  for (const p of world.players)
    if (p.down) p.y = Math.max(p.y, world.water - 1.2);
  world.bestHeight = Math.max(
    world.bestHeight,
    ...world.pieces
      .filter((p) => !p.heldBy && Math.abs(p.vy) < 0.12)
      .map((p) => topOf(p) - FLOOR),
  );
  if (
    world.phase === 'playing' &&
    world.players.length &&
    world.players.every((p) => p.down)
  ) {
    world.phase = 'lost';
    emit(world, 'The water won this round. Build it better.', 'danger');
  }
  return world;
}
export function releasePlayer(world: World, id: string) {
  for (const piece of world.pieces)
    if (piece.heldBy === id) {
      delete piece.heldBy;
      resetMotion(piece);
      touchPiece(piece);
    }
  if (world.crane.owner === id) {
    const p = world.pieces.find((p) => p.id === world.crane.piece);
    if (p) {
      delete p.heldBy;
      // Keep the suspended body's momentum when the cable is released.
      p.sleeping = false;
      p.idle = 0;
      touchPiece(p);
    }
    world.crane.owner = null;
    world.crane.piece = null;
  }
}
export function nearestPiece(world: World, p: Player) {
  return world.pieces
    .filter(
      (item) =>
        !item.heldBy &&
        Math.hypot(item.x - p.x, item.z - p.z) < 3.8 &&
        item.y < p.y + 2.8 &&
        topOf(item) > p.y - 1.4,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
}
export function placement(
  world: World,
  p: Player,
  item: Piece,
  x: number,
  z: number,
  y?: number,
) {
  // Explicit poses from the ghost are never moved to a different support.
  x = Math.round(x * 20) / 20;
  z = Math.round(z * 20) / 20;
  const height = y ?? landingHeight(world, item, x, z, p.y + 2.25),
    candidate = { ...item, x, y: height, z, quaternion: undefined };
  const d = dimensions(item);
  let error: string | null = null;
  if (![x, height, z].every(Number.isFinite))
    error = 'Choose a surface inside the yard.';
  else if (
    Math.hypot(x - p.x, z - p.z) > 4.5 ||
    height > p.y + 2.3 ||
    height < p.y - 3.5
  )
    error = 'Move a little closer to place it.';
  else if (
    Math.abs(x) + d.w / 2 > 9.85 ||
    Math.abs(z) + d.d / 2 > 9.85 ||
    height < FLOOR - 0.03
  )
    error = 'Keep your salvage inside the yard.';
  else error = poseError(world, candidate);
  return { x, y: height, z, error };
}
function ensureTarget(item: Piece, action: Action) {
  if (action.target && action.target !== item.id)
    throw new Error('The held piece changed. Aim again.');
  if (action.revision !== undefined && action.revision !== (item.revision || 0))
    throw new Error('The piece changed. Wait for the updated preview.');
}
function setHeldPose(item: Piece, p: Player) {
  item.x = p.x;
  item.y = p.y + 2.1;
  item.z = p.z;
  resetMotion(item);
}
export function act(world: World, id: string, action: Action, host: string) {
  const p = world.players.find((p) => p.id === id);
  if (!p) throw new Error('Rejoin the crew to play.');
  if (action.type === 'start' || action.type === 'restart') {
    if (id !== host)
      throw new Error('Only the crew captain can start a round.');
    if (action.type === 'start' && world.phase !== 'lobby') return;
    const next = freshWorld(world.clock, world.mode, world.seed);
    next.phase = 'playing';
    next.started = world.clock;
    next.players = world.players.map((a, i) =>
      createPlayer(a.id, a.name, a.color, i, world.clock),
    );
    Object.assign(world, next);
    emit(
      world,
      world.mode === 'practice'
        ? 'Practice run. Take your time.'
        : 'One minute before the tide turns. Start stacking!',
      'good',
    );
    return;
  }
  if (world.phase === 'won' || world.phase === 'lost')
    throw new Error('Start another round to keep building.');
  if (p.down)
    throw new Error('Call a teammate over. They can rescue you with F.');
  const held = world.pieces.find((item) => item.heldBy === id);
  if (action.type === 'grab') {
    if (held) throw new Error('Place what you are carrying first.');
    if (world.crane.owner === id) throw new Error('Release the crane first.');
    const item = action.target
      ? world.pieces.find((s) => s.id === action.target)
      : nearestPiece(world, p);
    if (!item || item.heldBy)
      throw new Error('Move close to a piece of junk and press E.');
    if (
      Math.hypot(item.x - p.x, item.z - p.z) > 4.3 ||
      item.y > p.y + 2.8 ||
      topOf(item) < p.y - 1.4
    )
      throw new Error('That piece is out of reach.');
    const lifted = { ...item };
    setHeldPose(lifted, p);
    const error = poseError(world, lifted, p.id);
    if (error)
      throw new Error('There is no room above you to carry that piece.');
    Object.assign(item, lifted);
    item.heldBy = id;
    touchPiece(item);
    return;
  }
  if (action.type === 'place') {
    if (!held) throw new Error('Pick up a piece of junk first.');
    ensureTarget(held, action);
    if (
      !Number.isFinite(action.x) ||
      !Number.isFinite(action.z) ||
      (action.y !== undefined && !Number.isFinite(action.y))
    )
      throw new Error('Choose a place inside the yard.');
    if (
      action.rotation !== undefined &&
      (!Number.isInteger(action.rotation) || action.rotation !== held.rotation)
    )
      throw new Error('Wait for the rotated preview before placing.');
    const spot = placement(world, p, held, action.x!, action.z!, action.y);
    if (spot.error) throw new Error(spot.error);
    Object.assign(held, { x: spot.x, y: spot.y, z: spot.z });
    delete held.heldBy;
    resetMotion(held);
    touchPiece(held);
    emit(world, `${p.name} placed ${ITEMS[held.kind].name.toLowerCase()}.`);
    return;
  }
  if (action.type === 'rotate') {
    const item =
      held ||
      (world.crane.owner === id
        ? world.pieces.find((s) => s.id === world.crane.piece)
        : undefined);
    if (!item) throw new Error('Pick up a piece before rotating it.');
    const rotated = {
      ...item,
      rotation: (item.rotation + 1) % 4,
      quaternion: undefined,
    };
    const error = poseError(world, rotated, p.id);
    if (error) throw new Error('Move the load clear before rotating it.');
    Object.assign(item, rotated);
    touchPiece(item);
    return;
  }
  if (action.type === 'rescue') {
    const teammate = world.players.find(
      (s) =>
        s.down &&
        Math.hypot(s.x - p.x, s.z - p.z) < 4 &&
        Math.abs(s.y - p.y) < 5,
    );
    if (!teammate)
      throw new Error('Get within four metres of a teammate who needs help.');
    let spot: Player | undefined;
    for (const [dx, dz] of [
      [0.85, 0],
      [-0.85, 0],
      [0, 0.85],
      [0, -0.85],
      [0.85, 0.85],
      [-0.85, -0.85],
    ]) {
      const candidate = {
        ...teammate,
        x: p.x + dx,
        z: p.z + dz,
        y: p.y + 0.05,
      };
      if (playerSpotClear(world, candidate)) {
        spot = candidate;
        break;
      }
    }
    if (!spot)
      throw new Error('Move to a clear surface to rescue your teammate.');
    Object.assign(teammate, {
      down: false,
      breath: 8,
      x: spot.x,
      z: spot.z,
      y: spot.y,
      vy: 0,
      grounded: false,
    });
    emit(world, `${p.name} rescued ${teammate.name}!`, 'good');
    return;
  }
  if (action.type === 'crane') {
    if (held) throw new Error('Place your salvage before taking the crane.');
    if (world.crane.owner) {
      if (world.crane.owner === id) {
        releasePlayer(world, id);
        return;
      }
      throw new Error('A teammate is using the crane.');
    }
    const item = action.target
      ? world.pieces.find((s) => s.id === action.target)
      : nearestPiece(world, p);
    if (!item || item.heldBy)
      throw new Error('Click a piece of salvage, then take the crane.');
    const lifted = { ...item, quaternion: undefined };
    const error = poseError(world, lifted);
    if (error)
      throw new Error(
        'The load needs clear space before the crane can lift it.',
      );
    resetMotion(item);
    item.heldBy = 'crane';
    touchPiece(item);
    world.crane = {
      owner: id,
      piece: item.id,
      x: item.x,
      y: item.y,
      z: item.z,
    };
    emit(world, `${p.name} has the crane. Mind your heads!`);
    return;
  }
  if (action.type === 'crane-move') {
    if (world.crane.owner !== id) throw new Error('Take the crane first.');
    for (const key of ['x', 'y', 'z'] as const)
      if (!Number.isFinite(action[key]))
        throw new Error('Invalid crane movement.');
    const load = world.pieces.find((s) => s.id === world.crane.piece);
    if (!load) throw new Error('The crane is empty.');
    const c = world.crane;
    const next = {
      x: clamp(c.x + clamp(action.x!, -1, 1), -8, 8),
      z: clamp(c.z + clamp(action.z!, -1, 1), -8, 8),
      y: clamp(
        c.y + clamp(action.y!, -1, 1),
        FLOOR,
        Math.min(GOAL + 1, world.bestHeight + 2.2),
      ),
    };
    const steps = Math.ceil(
      Math.hypot(next.x - load.x, next.y - load.y, next.z - load.z) / 0.06,
    );
    for (let i = 1; i <= steps; i++) {
      const f = i / steps,
        probe = {
          ...load,
          x: load.x + (next.x - load.x) * f,
          y: load.y + (next.y - load.y) * f,
          z: load.z + (next.z - load.z) * f,
        };
      if (cranePoseError(world, probe))
        throw new Error(
          'The load is blocked. Raise it or move around the obstacle.',
        );
    }
    Object.assign(c, next);
    // The target is serialized; the load travels there during fixed physics
    // steps so every contact transfers real momentum, including across syncs.
    return;
  }
  if (action.type === 'crane-drop') {
    if (world.crane.owner !== id) throw new Error('Take the crane first.');
    const load = world.pieces.find((item) => item.id === world.crane.piece);
    if (load && poseError(world, load))
      throw new Error('Move the load clear before releasing it.');
    releasePlayer(world, id);
    emit(world, 'Delivery incoming. Clear the landing zone!');
    return;
  }
  if (action.type === 'wave') {
    emit(world, `${p.name}: Over here!`);
    return;
  }
  throw new Error('Unknown game action.');
}
