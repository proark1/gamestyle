import {
  NET,
  PENDULUM,
  PLANK,
  SURFACES,
  nearNet,
  onPlank,
  pendulumBall,
  plankSurfaceY,
  type Box,
} from './course';
import {
  AIR_CONTROL,
  CHAIN_DAMPING,
  CHAIN_ITERATIONS,
  CHAIN_MAX,
  CHAIN_SLACK,
  CHAIN_STIFFNESS,
  GRAVITY,
  JUMP_SPEED,
  PLAYER_HEIGHT,
  NO_SUPPORT,
  PLAYER_RADIUS,
  TERMINAL_FALL,
  WALK_SPEED,
  chainOrder,
  clamp,
  inverseMass,
  type ChainLink,
  type ChainWorld,
  type GameEvent,
  type Player,
} from './types';

/** A landing faster than this hurts: the worker goes limp on impact. */
export const HARD_LANDING_SPEED = 13.5;
/** Small ledges a walking worker steps over without jumping. */
export const STEP_HEIGHT = 0.45;
/** How fast a worker hanging on the line stops swinging. */
export const DANGLE_SWING_DAMPING = 2.8;

const EPS = 0.001;

/** Does the worker's footprint circle overlap this box in the ground plane? */
function overlapsXZ(x: number, z: number, b: Box, radius: number): boolean {
  const nx = clamp(x, b.minX, b.maxX);
  const nz = clamp(z, b.minZ, b.maxZ);
  const dx = x - nx;
  const dz = z - nz;
  return dx * dx + dz * dz < radius * radius - EPS;
}

/**
 * Is this box a wall to a worker whose feet are at `y`? Only boxes the boots
 * are actually level with count. Something overhead is an overhang, not a wall:
 * a worker hanging on the line under a deck must be free to hang there rather
 * than be shoved out sideways by their own hard hat.
 */
function blocksAt(y: number, b: Box): boolean {
  return y >= b.minY - EPS && y < b.maxY - EPS;
}

/** Nearest face to leave this box by, moving only along x or only along z. */
function nearestFace(
  x: number,
  z: number,
  b: Box,
): { axis: 'x' | 'z'; value: number } {
  const left = x - b.minX;
  const right = b.maxX - x;
  const back = z - b.minZ;
  const front = b.maxZ - z;
  const least = Math.min(left, right, back, front);
  if (least === left) return { axis: 'x', value: b.minX - PLAYER_RADIUS };
  if (least === right) return { axis: 'x', value: b.maxX + PLAYER_RADIUS };
  if (least === back) return { axis: 'z', value: b.minZ - PLAYER_RADIUS };
  return { axis: 'z', value: b.maxZ + PLAYER_RADIUS };
}

/** Highest surface directly under the worker, or null over open air. */
export function supportUnder(
  x: number,
  y: number,
  z: number,
  plankTilt: number,
): number | null {
  let best: number | null = null;
  for (const b of SURFACES) {
    if (b.maxY > y + 0.35) continue;
    if (!overlapsXZ(x, z, b, PLAYER_RADIUS)) continue;
    if (best === null || b.maxY > best) best = b.maxY;
  }
  if (onPlank(x, z)) {
    const surface = plankSurfaceY(x, plankTilt);
    if (surface <= y + 0.35 && (best === null || surface > best))
      best = surface;
  }
  return best;
}

/**
 * Lowest surface a worker could hop up onto from here: higher than a step but
 * inside a jump. `supportUnder` only ever looks downwards, so this is what tells
 * anyone the difference between a wall and the next stair up.
 */
export function climbAhead(
  x: number,
  y: number,
  z: number,
  maxRise: number,
): number | null {
  let best: number | null = null;
  for (const b of SURFACES) {
    if (b.maxY <= y + STEP_HEIGHT || b.maxY > y + maxRise) continue;
    if (!overlapsXZ(x, z, b, PLAYER_RADIUS)) continue;
    if (best === null || b.maxY < best) best = b.maxY;
  }
  return best;
}

/**
 * Move a worker's footprint circle out of a box by the shortest route. From
 * outside the box that is straight away from the closest point, which lets a
 * worker slide along a wall or round a corner instead of sticking to it.
 */
function resolveCircleBox(player: Player, b: Box) {
  const cx = clamp(player.x, b.minX, b.maxX);
  const cz = clamp(player.z, b.minZ, b.maxZ);
  const dx = player.x - cx;
  const dz = player.z - cz;
  const distance = Math.hypot(dx, dz);
  if (distance > EPS) {
    const push = PLAYER_RADIUS - distance;
    player.x += (dx / distance) * push;
    player.z += (dz / distance) * push;
    return;
  }
  const face = nearestFace(player.x, player.z, b);
  if (face.axis === 'x') player.x = face.value;
  else player.z = face.value;
}

/** Push a worker out of anything they ended up inside, without touching speed. */
export function pushOutOfGeometry(player: Player, plankTilt: number) {
  for (const b of SURFACES) {
    if (!blocksAt(player.y, b)) continue;
    if (!overlapsXZ(player.x, player.z, b, PLAYER_RADIUS)) continue;
    resolveCircleBox(player, b);
  }
  const support = supportUnder(player.x, player.y + 0.4, player.z, plankTilt);
  if (support !== null && player.y < support && player.y > support - 0.6) {
    player.y = support;
  }
}

/** Horizontal move with wall resolution and a small automatic step up. */
function moveHorizontal(player: Player, dx: number, dz: number) {
  player.x += dx;
  player.z += dz;
  for (const b of SURFACES) {
    if (!blocksAt(player.y, b)) continue;
    if (!overlapsXZ(player.x, player.z, b, PLAYER_RADIUS)) continue;
    if (b.maxY <= player.y + STEP_HEIGHT && b.maxY > player.y) {
      player.y = b.maxY;
      continue;
    }
    resolveCircleBox(player, b);
  }
}

/** Vertical move: land on the highest top crossed, or bump a ceiling. */
function moveVertical(
  player: Player,
  dy: number,
  plankTilt: number,
): { landed: boolean; impact: number } {
  const from = player.y;
  const to = from + dy;
  let landed = false;
  let impact = 0;

  if (dy <= 0) {
    let top: number | null = null;
    for (const b of SURFACES) {
      if (!overlapsXZ(player.x, player.z, b, PLAYER_RADIUS)) continue;
      if (b.maxY > from + EPS || b.maxY < to - EPS) continue;
      if (top === null || b.maxY > top) top = b.maxY;
    }
    if (onPlank(player.x, player.z)) {
      const surface = plankSurfaceY(player.x, plankTilt);
      if (surface <= from + EPS && surface >= to - EPS) {
        if (top === null || surface > top) top = surface;
      }
    }
    if (top !== null) {
      impact = Math.abs(player.vy);
      player.y = top;
      player.vy = 0;
      landed = true;
    } else {
      player.y = to;
    }
  } else {
    let ceiling: number | null = null;
    for (const b of SURFACES) {
      if (!overlapsXZ(player.x, player.z, b, PLAYER_RADIUS)) continue;
      const head = from + PLAYER_HEIGHT;
      if (b.minY < head - EPS || b.minY > to + PLAYER_HEIGHT + EPS) continue;
      if (ceiling === null || b.minY < ceiling) ceiling = b.minY;
    }
    if (ceiling !== null) {
      player.y = ceiling - PLAYER_HEIGHT;
      player.vy = 0;
    } else {
      player.y = to;
    }
  }

  return { landed, impact };
}

export type MoveResult = {
  landed: boolean;
  impact: number;
  jumped: boolean;
};

/**
 * One worker's movement for a tick: intent, gravity, collision. The safety line
 * is not applied here — it runs across the whole crew afterwards.
 */
export function stepPlayer(
  player: Player,
  dt: number,
  plankTilt: number,
): MoveResult {
  const input = player.input;
  let jumped = false;

  // Clipped to a ring or flat on their back: no walking, just hanging on.
  const canWalk =
    player.state !== 'limp' && player.state !== 'finished' && !player.anchorId;

  // On the net only once the boots have left the deck, and off it again at the
  // bottom, so walking up to it and away from it both feel like walking.
  const climbing =
    canWalk && !player.grounded && nearNet(player.x, player.y, player.z);

  if (climbing) {
    // Gravity is off. Forward climbs down, because the course goes that way.
    player.vy = -clamp(input.x, -1, 1) * NET.climbSpeed;
    player.vz = clamp(input.z, -1, 1) * NET.climbSpeed * 0.5;
    player.vx = 0;
    player.y = clamp(player.y + player.vy * dt, NET.minY, NET.maxY);
    player.x = Math.max(player.x, NET.x);
    moveHorizontal(player, 0, player.vz * dt);
    player.grounded = player.y <= NET.minY + EPS;
    if (input.jump) {
      // Letting go: a long drop onto the pad below.
      player.vy = JUMP_SPEED * 0.5;
      player.vx = 2.6;
      jumped = true;
    }
    player.supportY =
      supportUnder(player.x, player.y + 0.2, player.z, plankTilt) ?? NO_SUPPORT;
    return { landed: false, impact: 0, jumped };
  }

  const hanging = player.state === 'dangling';
  const wantX = canWalk ? clamp(input.x, -1, 1) : 0;
  const wantZ = canWalk ? clamp(input.z, -1, 1) : 0;
  const bracing = player.braced && player.grounded && player.stamina > 0;

  if (bracing) {
    // Braced workers plant their boots and stop moving under their own power.
    player.vx *= Math.exp(-dt * 12);
    player.vz *= Math.exp(-dt * 12);
  } else {
    // Someone on the line can kick a little, but they are not walking anywhere.
    const speed =
      WALK_SPEED * (player.state === 'limp' ? 0 : hanging ? 0.3 : 1);
    const response = player.grounded ? 12 : 12 * AIR_CONTROL;
    player.vx += (wantX * speed - player.vx) * Math.min(1, dt * response);
    player.vz += (wantZ * speed - player.vz) * Math.min(1, dt * response);
  }

  if (hanging) {
    // A harness is not a swing: the worker settles under whoever is holding
    // them instead of keeping a pendulum going forever.
    player.vx *= Math.exp(-dt * DANGLE_SWING_DAMPING);
    player.vz *= Math.exp(-dt * DANGLE_SWING_DAMPING);
  }

  if (wantX !== 0 || wantZ !== 0) player.facing = Math.atan2(wantX, wantZ);

  if (input.jump && player.grounded && !bracing && player.state !== 'limp') {
    player.vy = JUMP_SPEED;
    player.grounded = false;
    jumped = true;
  }

  player.vy = Math.max(TERMINAL_FALL, player.vy + GRAVITY * dt);

  moveHorizontal(player, player.vx * dt, player.vz * dt);
  const vertical = moveVertical(player, player.vy * dt, plankTilt);

  if (vertical.landed) {
    player.grounded = true;
  } else {
    const support = supportUnder(player.x, player.y, player.z, plankTilt);
    player.grounded = support !== null && player.y - support < 0.06;
    if (player.grounded) player.y = support as number;
  }

  player.supportY =
    supportUnder(player.x, player.y + 0.2, player.z, plankTilt) ?? NO_SUPPORT;

  return { landed: vertical.landed, impact: vertical.impact, jumped };
}

/**
 * The safety line. A soft spring through the slack zone, then hard positional
 * correction at the limit so the line can never be stretched past its length.
 * Each worker's inverse mass is what their stance can resist, which is why two
 * braced workers hold two who have gone over and one braced worker does not
 * hold three.
 */
export function stepChain(
  world: ChainWorld,
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
): ChainLink[] {
  const order = chainOrder(world);
  const links: ChainLink[] = [];
  if (order.length < 2) return links;

  // Soft zone: the pull you can still walk against.
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i];
    const b = order[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance <= CHAIN_SLACK || distance < EPS) continue;

    const nx = dx / distance;
    const ny = dy / distance;
    const nz = dz / distance;
    const relative =
      (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
    const force = Math.max(
      0,
      (distance - CHAIN_SLACK) * CHAIN_STIFFNESS + relative * CHAIN_DAMPING,
    );

    const wa = inverseMass(a);
    const wb = inverseMass(b);
    a.vx += nx * force * wa * dt;
    a.vy += ny * force * wa * dt;
    a.vz += nz * force * wa * dt;
    b.vx -= nx * force * wb * dt;
    b.vy -= ny * force * wb * dt;
    b.vz -= nz * force * wb * dt;
  }

  // Hard limit: iterated positional correction, so pull propagates down the line.
  const movedBy = new Map<string, number>();
  for (let pass = 0; pass < CHAIN_ITERATIONS; pass++) {
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i];
      const b = order[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance <= CHAIN_MAX || distance < EPS) continue;

      const wa = inverseMass(a);
      const wb = inverseMass(b);
      const total = wa + wb;
      if (total <= 0) continue;

      const excess = distance - CHAIN_MAX;
      const nx = dx / distance;
      const ny = dy / distance;
      const nz = dz / distance;

      const shiftA = (excess * wa) / total;
      const shiftB = (excess * wb) / total;
      a.x += nx * shiftA;
      a.y += ny * shiftA;
      a.z += nz * shiftA;
      b.x -= nx * shiftB;
      b.y -= ny * shiftB;
      b.z -= nz * shiftB;

      movedBy.set(a.id, (movedBy.get(a.id) ?? 0) + shiftA);
      movedBy.set(b.id, (movedBy.get(b.id) ?? 0) + shiftB);

      // Kill the separating velocity so the line does not fight itself.
      const separating =
        (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
      if (separating > 0) {
        const shareA = wa / total;
        const shareB = wb / total;
        a.vx += nx * separating * shareA;
        a.vy += ny * separating * shareA;
        a.vz += nz * separating * shareA;
        b.vx -= nx * separating * shareB;
        b.vy -= ny * separating * shareB;
        b.vz -= nz * separating * shareB;
      }
    }
  }

  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i];
    const b = order[i + 1];
    const distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const tension = clamp(
      (distance - CHAIN_SLACK) / (CHAIN_MAX - CHAIN_SLACK),
      0,
      1,
    );
    links.push({
      a: a.id,
      b: b.id,
      distance,
      tension,
      taut: tension >= 0.99,
    });
  }

  // A worker dragged a long way in one tick has been yanked off their feet.
  for (const player of order) {
    const dragged = movedBy.get(player.id) ?? 0;
    if (dragged > 0.45 && player.grounded && !player.braced) {
      player.grounded = false;
      events.push({
        id: ++eventIdRef.current,
        type: 'chain_yank',
        playerId: player.id,
        detail: `${player.name} was dragged off their feet by the line`,
        pos: [player.x, player.y, player.z],
      });
    }
  }

  return links;
}

/** The wrecking load: a pendulum a worker can hang off to stall. */
export function stepPendulum(
  world: ChainWorld,
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
) {
  const gravityTerm =
    -(9.81 / PENDULUM.ropeLength) * Math.sin(world.pendulumAngle);
  let damping = 0.06;

  const rider = world.pendulumRider
    ? world.players.find((p) => p.id === world.pendulumRider)
    : undefined;
  if (rider) damping = PENDULUM.riderDamping;

  world.pendulumVel += gravityTerm * dt;
  world.pendulumVel *= Math.exp(-damping * dt);
  world.pendulumAngle += world.pendulumVel * dt;

  // With nobody holding it the load keeps its swing going.
  if (!rider) {
    const amplitude = Math.abs(world.pendulumAngle);
    if (
      amplitude < PENDULUM.amplitude * 0.55 &&
      Math.abs(world.pendulumVel) > 0.01
    ) {
      world.pendulumVel *= 1 + dt * 0.55;
    }
  }

  const [bx, by, bz] = pendulumBall(world.pendulumAngle);
  if (rider) {
    rider.x = bx;
    rider.y = by - 1.5;
    rider.z = bz;
    rider.vx = 0;
    rider.vy = 0;
    rider.vz = 0;
    rider.grounded = false;
    if (Math.abs(world.pendulumVel) < 0.06) {
      world.pendulumVel = 0;
      world.pendulumAngle *= Math.exp(-dt * 2);
    }
  }

  // Tangential speed of the ball, used for the knock it delivers.
  const tangential = world.pendulumVel * PENDULUM.ropeLength;
  const dirZ = Math.cos(world.pendulumAngle);
  const dirY = Math.sin(world.pendulumAngle);

  for (const player of world.players) {
    if (player.id === world.pendulumRider) continue;
    if (player.state === 'finished') continue;
    const head = player.y + PLAYER_HEIGHT * 0.6;
    const distance = Math.hypot(player.x - bx, head - by, player.z - bz);
    if (distance > PENDULUM.ballRadius + PLAYER_RADIUS) continue;

    const knock = Math.max(4.5, Math.abs(tangential) * 1.35);
    player.vz += Math.sign(tangential) * dirZ * knock;
    player.vy += Math.abs(dirY) * knock * 0.25 + 3.2;
    player.grounded = false;
    events.push({
      id: ++eventIdRef.current,
      type: 'pendulum_swing',
      playerId: player.id,
      detail: `${player.name} took the wrecking load square on`,
      pos: [player.x, player.y, player.z],
    });
  }
}

/** The tipping plank: torque from where the crew is standing on it. */
export function stepPlank(
  world: ChainWorld,
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
) {
  let torque = 0;
  let riders = 0;
  for (const player of world.players) {
    if (!onPlank(player.x, player.z)) continue;
    const surface = plankSurfaceY(player.x, world.plankTilt);
    if (player.y > surface + 0.35 || player.y < surface - 1.2) continue;
    torque += player.x - PLANK.pivotX;
    riders++;
  }

  const wasSlipping = Math.abs(world.plankTilt) > PLANK.slipTilt;
  const restoring = -world.plankTilt * 1.35;
  const acceleration = torque * 0.052 + restoring - world.plankVel * 2.1;
  world.plankVel += acceleration * dt;
  world.plankTilt = clamp(
    world.plankTilt + world.plankVel * dt,
    -PLANK.maxTilt,
    PLANK.maxTilt,
  );
  if (Math.abs(world.plankTilt) >= PLANK.maxTilt) world.plankVel = 0;

  const slipping = Math.abs(world.plankTilt) > PLANK.slipTilt;
  if (slipping && !wasSlipping && riders > 0) {
    events.push({
      id: ++eventIdRef.current,
      type: 'plank_tip',
      detail: 'The plank tipped under the crew',
    });
  }

  // Past the slip angle boots lose their grip and workers slide downhill.
  if (slipping) {
    for (const player of world.players) {
      if (!onPlank(player.x, player.z)) continue;
      const surface = plankSurfaceY(player.x, world.plankTilt);
      if (Math.abs(player.y - surface) > 0.4) continue;
      player.vx += -Math.sign(world.plankTilt) * 9.0 * dt;
    }
  }
}
