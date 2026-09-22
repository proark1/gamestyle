import {
  FAR_HOG_Z,
  GADGET_CONFIGS,
  HOUSE_RINGS,
  RINK_WIDTH,
  STONE_CONFIGS,
  TEE_Z,
  type BananaHazard,
  type CurlingPlayer,
  type GameEvent,
  type IceTile,
  type Stone,
} from './types';

const GRAVITY = 9.81;

/** Simulates one step of curling physics, sweeping dynamics, and ice degradation. */
export function stepCurlingPhysics(
  stones: Stone[],
  players: CurlingPlayer[],
  iceTiles: IceTile[],
  hazards: BananaHazard[],
  dt: number,
  events: GameEvent[],
) {
  // 1. Maintain pristine solid ice sheet (no cracking or water holes)
  updateThinIce(iceTiles, players, stones, dt, events);

  // 2. Update players on ice (movement, deliverer slide, sweeper escort, banana slips)
  updatePlayers(players, stones, hazards, dt, events);

  // 3. Update stones (friction, sweeping effects, curl forces, collisions)
  updateStones(stones, players, hazards, dt, events);

  // 4. Resolve stone-to-stone collisions
  resolveStoneCollisions(stones, events);
}

/** Keeps the curling ice sheet pristine and solid (no cracking or water holes). */
function updateThinIce(
  tiles: IceTile[],
  _players: CurlingPlayer[],
  _stones: Stone[],
  _dt: number,
  _events: GameEvent[],
) {
  for (const tile of tiles) {
    tile.health = 1.0;
    tile.stress = 0;
    tile.cracked = false;
    tile.broken = false;
  }
}

/** Updates player movement on slick ice, deliverer lunges, sweeper tracking, and banana slips. */
function updatePlayers(
  players: CurlingPlayer[],
  stones: Stone[],
  hazards: BananaHazard[],
  dt: number,
  events: GameEvent[],
) {
  const halfWidth = RINK_WIDTH / 2 - 0.4;
  const activeStone = stones.find(
    (s) => s.active && !s.stopped && !s.outOfBounds,
  );

  for (const p of players) {
    if (p.status === 'slipping') {
      p.statusTimer -= dt;
      p.rotation += 15.0 * dt; // Rapid 360 spin
      p.vx *= Math.pow(0.92, dt * 60);
      p.vz *= Math.pow(0.92, dt * 60);
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.x = Math.max(-halfWidth, Math.min(halfWidth, p.x));

      if (p.statusTimer <= 0) {
        p.status = 'normal';
        p.statusTimer = 0;
      }
      continue;
    }

    // Check for banana hazard slip
    for (const h of hazards) {
      if (!h.active) continue;
      const d = Math.hypot(p.x - h.x, p.z - h.z);
      if (d < 0.65) {
        h.active = false;
        p.status = 'slipping';
        p.statusTimer = 1.8;
        p.vx *= 1.4;
        p.vz *= 1.4;
        events.push({ type: 'banana_slip', playerId: p.id });
        break;
      }
    }
    if (p.status === 'slipping') continue;

    // Deliverer sliding lunge from hack towards hog line
    if (p.status === 'sliding') {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.x = Math.max(-halfWidth, Math.min(halfWidth, p.x));

      // As deliverer reaches or passes release hog line (RELEASE_HOG_Z = 6.0),
      // decelerate to a stop and stand up
      if (p.z >= 6.0) {
        p.vx *= Math.pow(0.75, dt * 60);
        p.vz *= Math.pow(0.75, dt * 60);
        if (Math.hypot(p.vx, p.vz) < 0.25) {
          p.status = 'normal';
          p.vx = 0;
          p.vz = 0;
        }
      }
      continue;
    }

    // Sweeper dynamic escorting: stay ahead of active stone along its travel path
    if (activeStone && p.team === activeStone.team && p.role === 'sweeper') {
      const targetZ = activeStone.z + 1.15;
      const targetX =
        activeStone.x + (p.steerDir !== 0 ? p.steerDir * 0.35 : 0.45);

      // Match stone velocity so the sweeper is never outpaced
      p.vz = activeStone.vz;
      p.vx = activeStone.vx;

      // Keep sweeper ahead of stone
      p.z += (targetZ - p.z) * Math.min(1, dt * 14);
      p.x += (targetX - p.x) * Math.min(1, dt * 10);

      // Sweeper must never fall behind the rock
      if (p.z < activeStone.z + 0.75) {
        p.z = activeStone.z + 0.75;
      }

      p.status = p.sweepIntensity > 0 ? 'sweeping' : 'normal';
      const facing = Math.atan2(activeStone.x - p.x, activeStone.z - p.z);
      const turn = Math.atan2(
        Math.sin(facing - p.rotation),
        Math.cos(facing - p.rotation),
      );
      p.rotation += turn * (1 - Math.exp(-10 * dt));

      p.x = Math.max(-halfWidth, Math.min(halfWidth, p.x));
      p.z = Math.max(-4.0, Math.min(38.0, p.z));
      continue;
    }

    // Normal or sweeping movement
    const inputX = p.input.x;
    const inputZ = p.input.z;
    const isMoving = Math.hypot(inputX, inputZ) > 0.1;

    // Slippery ice friction vs propulsion
    const accel = p.status === 'sweeping' ? 14.0 : 18.0;
    const maxSpeed = p.status === 'sweeping' ? 4.8 : 6.2;
    const iceFriction = 0.88;

    p.vx += inputX * accel * dt;
    p.vz += inputZ * accel * dt;

    const currentSpeed = Math.hypot(p.vx, p.vz);
    if (currentSpeed > maxSpeed) {
      p.vx = (p.vx / currentSpeed) * maxSpeed;
      p.vz = (p.vz / currentSpeed) * maxSpeed;
    }

    if (!isMoving) {
      p.vx *= Math.pow(iceFriction, dt * 60);
      p.vz *= Math.pow(iceFriction, dt * 60);
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // Constrain to rink width and track length
    p.x = Math.max(-halfWidth, Math.min(halfWidth, p.x));
    p.z = Math.max(-4.0, Math.min(38.0, p.z));

    if (isMoving) {
      p.rotation = Math.atan2(p.vx, p.vz);
    }
  }
}

/** Updates stones sliding down the ice, applying curl forces and sweeper effects. */
function updateStones(
  stones: Stone[],
  players: CurlingPlayer[],
  hazards: BananaHazard[],
  dt: number,
  events: GameEvent[],
) {
  const halfWidth = RINK_WIDTH / 2;

  for (const s of stones) {
    if (s.stopped || s.outOfBounds) continue;

    const cfg = STONE_CONFIGS[s.kind];
    const speed = Math.hypot(s.vx, s.vz);

    // Stop threshold
    if (speed < 0.04) {
      s.vx = 0;
      s.vz = 0;
      s.stopped = true;
      s.active = false;
      s.inPlay = s.z >= FAR_HOG_Z && s.z <= 36.0;
      if (!s.inPlay && s.z < FAR_HOG_Z) {
        s.outOfBounds = true; // Failed to pass hog line
      }
      continue;
    }

    // Base kinetic friction
    let friction = cfg.baseFriction;

    // Check for sweeper influence ahead of the stone
    let totalSweepCut = 0;
    let totalSteer = 0;

    for (const p of players) {
      if (
        p.team === s.team &&
        p.status === 'sweeping' &&
        p.sweepIntensity > 0
      ) {
        // Sweeper must be directly in front of stone along its travel path
        const forwardDist = p.z - s.z;
        const sideDist = Math.abs(p.x - s.x);
        const gCfg = GADGET_CONFIGS[p.gadget];

        if (forwardDist > 0 && forwardDist < 2.4 && sideDist < gCfg.radius) {
          totalSweepCut += gCfg.frictionCut * p.sweepIntensity;
          totalSteer += p.steerDir * gCfg.steerPower * p.sweepIntensity;

          if (Math.random() < 0.25) {
            events.push({
              type: 'sweep_burst',
              gadget: p.gadget,
              x: p.x,
              z: p.z,
            });
          }
        }
      }
    }

    // Apply sweeping friction cut (up to 85% max reduction)
    totalSweepCut = Math.min(0.85, totalSweepCut);
    friction *= 1.0 - totalSweepCut;

    // Forward deceleration = friction * g
    const decel = friction * GRAVITY;
    const forwardX = s.vx / speed;
    const forwardZ = s.vz / speed;

    // Curling physics: rotational curl creates lateral curve perpendicular to forward vector
    // Standard curling: CW spin curls right (+X relative to forward), CCW curls left (-X)
    const perpX = forwardZ;
    const perpZ = -forwardX;

    const curlSign = Math.sign(s.spin);
    // Curl acceleration is stronger as stone slows down (authentic curling pebble effect!)
    const curlStrength = 0.045 * Math.min(1, speed) * cfg.curlMultiplier;
    let lateralAccel = curlSign * curlStrength;

    // Add sweeper steering influence
    lateralAccel += totalSteer * 0.45;

    // Update velocity components
    const braking = Math.min(speed, decel * dt);
    s.vx -= forwardX * braking;
    s.vz -= forwardZ * braking;
    s.vx += perpX * lateralAccel * dt;
    s.vz += perpZ * lateralAccel * dt;

    // Update position
    s.x += s.vx * dt;
    s.z += s.vz * dt;

    // Angular rotation update with friction
    s.rotation += s.spin * dt;
    s.spin *= Math.pow(0.97, dt * 60);

    // Distance to button
    s.distanceToTee = Math.hypot(s.x, s.z - TEE_Z);

    // Rink boundary checks
    if (Math.abs(s.x) > halfWidth - cfg.radius) {
      // Bounce off side bumper
      s.x = Math.sign(s.x) * (halfWidth - cfg.radius);
      s.vx = -s.vx * 0.45;
      s.spin *= -0.5;
    }

    // Check if passed back line
    if (s.z > 36.5) {
      s.stopped = true;
      s.active = false;
      s.outOfBounds = true;
    }

    // Check banana hazard collision with stone
    for (const h of hazards) {
      if (!h.active) continue;
      const d = Math.hypot(s.x - h.x, s.z - h.z);
      if (d < cfg.radius + 0.25) {
        h.active = false;
        // Chaotic spin out!
        s.spin *= 2.5;
        s.vx *= 0.7;
        s.vz *= 0.7;
        s.vx += (Math.random() - 0.5) * 1.5;
        events.push({
          type: 'stone_clack',
          x: s.x,
          z: s.z,
          volume: 0.8,
        });
        break;
      }
    }
  }
}

/** Resolves elastic collisions between pairs of curling stones. */
function resolveStoneCollisions(stones: Stone[], events: GameEvent[]) {
  const count = stones.length;

  for (let i = 0; i < count; i++) {
    const a = stones[i];
    if (a.outOfBounds) continue;
    const cfgA = STONE_CONFIGS[a.kind];

    for (let j = i + 1; j < count; j++) {
      const b = stones[j];
      if (b.outOfBounds) continue;
      const cfgB = STONE_CONFIGS[b.kind];

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      const minDist = cfgA.radius + cfgB.radius;

      if (dist < minDist && dist > 0.001) {
        // Normal vector
        const nx = dx / dist;
        const nz = dz / dist;

        // Separate intersecting circles
        const overlap = minDist - dist;
        a.x -= nx * overlap * 0.5;
        a.z -= nz * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.z += nz * overlap * 0.5;

        // Relative velocity along normal
        const rvx = b.vx - a.vx;
        const rvz = b.vz - a.vz;
        const velAlongNormal = rvx * nx + rvz * nz;

        // Only resolve if closing in
        if (velAlongNormal < 0) {
          const restitution = 0.86; // Solid stone clack restitution
          const impulseMag =
            (-(1 + restitution) * velAlongNormal) /
            (1 / cfgA.mass + 1 / cfgB.mass);

          a.vx -= (impulseMag / cfgA.mass) * nx;
          a.vz -= (impulseMag / cfgA.mass) * nz;
          b.vx += (impulseMag / cfgB.mass) * nx;
          b.vz += (impulseMag / cfgB.mass) * nz;

          // Awaken stopped stones upon collision
          if (a.stopped && Math.hypot(a.vx, a.vz) > 0.05) {
            a.stopped = false;
          }
          if (b.stopped && Math.hypot(b.vx, b.vz) > 0.05) {
            b.stopped = false;
          }

          const impactVolume = Math.min(1.0, Math.abs(velAlongNormal) * 0.4);
          events.push({
            type: 'stone_clack',
            x: (a.x + b.x) / 2,
            z: (a.z + b.z) / 2,
            volume: impactVolume,
          });
        }
      }
    }
  }
}

/** Computes traditional curling end score: points awarded to closest team's stones inside house. */
export function computeEndScore(stones: Stone[]): {
  red: number;
  blue: number;
  closestTeam: 'red' | 'blue' | null;
} {
  const inHouseStones = stones.filter(
    (s) =>
      s.inPlay &&
      !s.outOfBounds &&
      s.distanceToTee <= HOUSE_RINGS.twelveFoot.radius,
  );

  if (inHouseStones.length === 0) {
    return { red: 0, blue: 0, closestTeam: null };
  }

  // Sort stones strictly by distance to the tee
  inHouseStones.sort((a, b) => a.distanceToTee - b.distanceToTee);

  const closest = inHouseStones[0];
  const winningTeam = closest.team;
  const opponentTeam = winningTeam === 'red' ? 'blue' : 'red';

  // Find distance of opponent's closest stone in house
  const oppClosest = inHouseStones.find((s) => s.team === opponentTeam);
  const cutoffDist = oppClosest ? oppClosest.distanceToTee : Infinity;

  // Count all winning team stones closer than opponent's best stone
  let points = 0;
  for (const s of inHouseStones) {
    if (s.team === winningTeam && s.distanceToTee < cutoffDist) {
      points++;
    } else {
      break;
    }
  }

  return {
    red: winningTeam === 'red' ? points : 0,
    blue: winningTeam === 'blue' ? points : 0,
    closestTeam: winningTeam,
  };
}
