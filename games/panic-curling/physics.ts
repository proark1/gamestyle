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
  // 1. Update thin ice stress and fracture states
  updateThinIce(iceTiles, players, stones, dt, events);

  // 2. Update players on ice (movement, sliding, hazards, rescues)
  updatePlayers(players, iceTiles, hazards, dt, events);

  // 3. Update stones (friction, sweeping effects, curl forces, collisions)
  updateStones(stones, players, hazards, dt, events);

  // 4. Resolve stone-to-stone collisions
  resolveStoneCollisions(stones, events);
}

/** Computes dynamic thin-ice cracking and breaking from player weight and gadget heat. */
function updateThinIce(
  tiles: IceTile[],
  players: CurlingPlayer[],
  stones: Stone[],
  dt: number,
  events: GameEvent[],
) {
  for (const tile of tiles) {
    if (tile.broken) continue;

    let load = 0;

    // Weight from players
    for (const p of players) {
      if (p.status === 'freezing') continue;
      const dx = Math.abs(p.x - tile.x);
      const dz = Math.abs(p.z - tile.z);
      if (dx <= tile.w / 2 && dz <= tile.d / 2) {
        load += 1.0;
        // Sweeper thermal stress
        if (p.status === 'sweeping' && p.sweepIntensity > 0) {
          const cfg = GADGET_CONFIGS[p.gadget];
          load += cfg.stressRate * p.sweepIntensity;
        }
      }
    }

    // Weight from stones
    for (const s of stones) {
      if (s.outOfBounds) continue;
      const dx = Math.abs(s.x - tile.x);
      const dz = Math.abs(s.z - tile.z);
      if (dx <= tile.w / 2 && dz <= tile.d / 2) {
        const cfg = STONE_CONFIGS[s.kind];
        load += 0.8 * cfg.iceStressMultiplier;
      }
    }

    tile.stress = load;

    // Capacity threshold: > 1.6 load causes ice to weaken
    if (load > 1.6) {
      const damage = (load - 1.2) * 0.35 * dt;
      tile.health = Math.max(0, tile.health - damage);

      if (tile.health < 0.45 && !tile.cracked) {
        tile.cracked = true;
        events.push({ type: 'ice_creak', tileId: tile.id });
      }

      if (tile.health <= 0) {
        tile.broken = true;
        tile.cracked = true;
        events.push({
          type: 'ice_break',
          tileId: tile.id,
          x: tile.x,
          z: tile.z,
        });

        // Plunge players on this tile into the freezing water
        for (const p of players) {
          const dx = Math.abs(p.x - tile.x);
          const dz = Math.abs(p.z - tile.z);
          if (dx <= tile.w / 2 + 0.2 && dz <= tile.d / 2 + 0.2) {
            p.status = 'freezing';
            p.statusTimer = 3.5;
            p.vx = 0;
            p.vz = 0;
            events.push({
              type: 'water_splash',
              x: p.x,
              z: p.z,
              playerId: p.id,
            });
          }
        }
      }
    } else if (load === 0 && tile.health < 1.0 && !tile.broken) {
      // Natural slow refreeze if unburdened
      tile.health = Math.min(1.0, tile.health + 0.04 * dt);
      if (tile.health > 0.75) {
        tile.cracked = false;
      }
    }
  }
}

/** Updates player movement on slick ice, slipping, and rescues. */
function updatePlayers(
  players: CurlingPlayer[],
  iceTiles: IceTile[],
  hazards: BananaHazard[],
  dt: number,
  events: GameEvent[],
) {
  const halfWidth = RINK_WIDTH / 2 - 0.4;

  for (const p of players) {
    if (p.status === 'freezing') {
      p.statusTimer -= dt;
      // Teeth chatter wobble
      p.rotation += Math.sin(p.statusTimer * 20) * 0.05;
      if (p.statusTimer <= 0) {
        p.status = 'normal';
        p.statusTimer = 0;
        // Scramble out of the hole
        p.z = Math.min(p.z + 1.0, 36);
      }
      continue;
    }

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

    // Check if stepped into already broken ice
    for (const tile of iceTiles) {
      if (!tile.broken) continue;
      const dx = Math.abs(p.x - tile.x);
      const dz = Math.abs(p.z - tile.z);
      if (dx < tile.w / 2 + 0.1 && dz < tile.d / 2 + 0.1) {
        p.status = 'freezing';
        p.statusTimer = 3.5;
        p.vx = 0;
        p.vz = 0;
        events.push({
          type: 'water_splash',
          x: p.x,
          z: p.z,
          playerId: p.id,
        });
        break;
      }
    }

    // Teammate rescue: if standing next to freezing teammate and pressing rescue
    if (p.input.rescue) {
      for (const mate of players) {
        if (
          mate.id !== p.id &&
          mate.team === p.team &&
          mate.status === 'freezing'
        ) {
          const d = Math.hypot(p.x - mate.x, p.z - mate.z);
          if (d < 2.0) {
            mate.status = 'normal';
            mate.statusTimer = 0;
            mate.x = p.x;
            mate.z = p.z;
          }
        }
      }
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

    const curlSign = Math.sign(s.spin) || 1;
    // Curl acceleration is stronger as stone slows down (authentic curling pebble effect!)
    const curlStrength = (0.28 / Math.max(0.4, speed)) * cfg.curlMultiplier;
    let lateralAccel = curlSign * curlStrength;

    // Add sweeper steering influence
    lateralAccel += totalSteer * 0.45;

    // Update velocity components
    s.vx -= forwardX * decel * dt;
    s.vz -= forwardZ * decel * dt;
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
