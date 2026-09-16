import {
  BURST_THRESHOLD,
  ITEM_CONFIGS,
  PLAYER_RADIUS,
  SIZER_MAX_H,
  SUITCASE_BASE_H,
  type CarryOnWorld,
  type LuggageItem,
  type Suitcase,
  type Traveler,
} from './types';

export const STEP = 1 / 60;
export const WALK_SPEED = 4.8;
export const JUMP_SPEED = 6.0;
export const GRAVITY = -14.0;

export const TERMINAL_MIN_X = -9.5;
export const TERMINAL_MAX_X = 11.0;
export const TERMINAL_MIN_Z = -5.0;
export const TERMINAL_MAX_Z = 5.0;

export const TSA_GATE_X = 3.5;
export const TSA_GATE_HALF_WIDTH = 1.4;

export const SIZER_X = 8.5;
export const SIZER_Z = 0.0;

export type BoxCollider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type CircleCollider = {
  x: number;
  z: number;
  radius: number;
};

export const TERMINAL_BOX_COLLIDERS: BoxCollider[] = [
  // Left benches (2 lounge benches)
  { minX: -8.3, maxX: -4.7, minZ: -3.0, maxZ: -1.8 },
  { minX: -8.3, maxX: -4.7, minZ: 1.8, maxZ: 3.0 },
  // Luggage scale in packing area
  { minX: -3.7, maxX: -1.9, minZ: -3.7, maxZ: -1.9 },
  // TSA X-ray scanner conveyor & tunnel
  { minX: 2.5, maxX: 4.5, minZ: -4.0, maxZ: -0.7 },
  // TSA Guard Desk
  { minX: 2.8, maxX: 4.2, minZ: 1.6, maxZ: 2.8 },
  // Gate Agent counter desk
  { minX: 7.6, maxX: 9.4, minZ: -3.6, maxZ: -0.8 },
  // Sizer Box Station
  {
    minX: SIZER_X - 0.75,
    maxX: SIZER_X + 0.75,
    minZ: SIZER_Z - 0.45,
    maxZ: SIZER_Z + 0.45,
  },
  // Jetway doorway boundary walls
  { minX: 10.0, maxX: 11.2, minZ: -5.0, maxZ: -1.4 },
  { minX: 10.0, maxX: 11.2, minZ: 1.4, maxZ: 5.0 },
];

export const TERMINAL_CIRCLE_COLLIDERS: CircleCollider[] = [
  // TSA Metal Detector portal side arch pillars
  { x: 3.5, z: -0.9, radius: 0.28 },
  { x: 3.5, z: 0.9, radius: 0.28 },
  // Stanchion posts
  { x: 5.0, z: 1.4, radius: 0.2 },
  { x: 6.6, z: 1.4, radius: 0.2 },
  { x: 8.2, z: 1.4, radius: 0.2 },
  { x: 5.0, z: -1.4, radius: 0.2 },
  { x: 6.6, z: -1.4, radius: 0.2 },
];

/** Resolve player collisions against terminal furniture, suitcases, and boundaries */
export function resolvePlayerCollisions(p: Traveler, world: CarryOnWorld) {
  const pr = PLAYER_RADIUS;

  // 1. Static Box Colliders (benches, desks, conveyor, sizer box, walls)
  for (const b of TERMINAL_BOX_COLLIDERS) {
    const clampX = Math.max(b.minX, Math.min(b.maxX, p.x));
    const clampZ = Math.max(b.minZ, Math.min(b.maxZ, p.z));
    const dx = p.x - clampX;
    const dz = p.z - clampZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < pr * pr) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.001) {
        const pen = pr - dist;
        p.x += (dx / dist) * pen;
        p.z += (dz / dist) * pen;
      } else {
        const dMinX = Math.abs(p.x - b.minX);
        const dMaxX = Math.abs(p.x - b.maxX);
        const dMinZ = Math.abs(p.z - b.minZ);
        const dMaxZ = Math.abs(p.z - b.maxZ);
        const minD = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);
        if (minD === dMinX) p.x = b.minX - pr;
        else if (minD === dMaxX) p.x = b.maxX + pr;
        else if (minD === dMinZ) p.z = b.minZ - pr;
        else p.z = b.maxZ + pr;
      }
    }
  }

  // 2. Static Circle Colliders (TSA portal posts, queue stanchions)
  for (const c of TERMINAL_CIRCLE_COLLIDERS) {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const dist = Math.hypot(dx, dz);
    const minDist = pr + c.radius;
    if (dist < minDist && dist > 0.001) {
      const pen = minDist - dist;
      p.x += (dx / dist) * pen;
      p.z += (dz / dist) * pen;
    }
  }

  // 3. Suitcases on the floor (solid obstacles unless being sat on or held)
  if (!p.sittingOn && p.y < 0.35) {
    for (const sc of world.suitcases) {
      if (sc.heldBy || world.sizer.insertedSuitcase === sc.id) continue;
      const sDx = p.x - sc.x;
      const sDz = p.z - sc.z;
      const sDist = Math.hypot(sDx, sDz);
      const scRadius = 0.52;
      const minDist = pr + scRadius;
      if (sDist < minDist && sDist > 0.001) {
        const pen = minDist - sDist;
        p.x += (sDx / sDist) * pen;
        p.z += (sDz / sDist) * pen;
      }
    }
  }

  // 4. Other players (mutual capsule collision)
  for (const other of world.players) {
    if (other.id === p.id) continue;
    const pDx = p.x - other.x;
    const pDz = p.z - other.z;
    const pDist = Math.hypot(pDx, pDz);
    const minDist = pr * 2;
    if (pDist < minDist && pDist > 0.001) {
      const pen = (minDist - pDist) * 0.5;
      p.x += (pDx / pDist) * pen;
      p.z += (pDz / pDist) * pen;
      other.x -= (pDx / pDist) * pen;
      other.z -= (pDz / pDist) * pen;
    }
  }

  // 5. Terminal boundary clamp
  p.x = Math.max(TERMINAL_MIN_X + pr, Math.min(TERMINAL_MAX_X - pr, p.x));
  p.z = Math.max(TERMINAL_MIN_Z + pr, Math.min(TERMINAL_MAX_Z - pr, p.z));
}

/** Calculate luggage fullness, squished height, and bulging tension */
export function computeSuitcaseBulge(
  suitcase: Suitcase,
  items: LuggageItem[],
): {
  rawVolume: number;
  effectiveVolume: number;
  bulge: number;
  height: number;
  strain: number;
  canZip: boolean;
} {
  const packed = items.filter((it) => it.packedIn === suitcase.id);
  if (packed.length === 0) {
    return {
      rawVolume: 0,
      effectiveVolume: 0,
      bulge: 0,
      height: SUITCASE_BASE_H,
      strain: 0,
      canZip: true,
    };
  }

  let totalVol = 0;
  let squishSum = 0;
  for (const it of packed) {
    const cfg = ITEM_CONFIGS[it.kind];
    totalVol += cfg.volume;
    squishSum += cfg.squish * cfg.volume;
  }
  const avgSquish = totalVol > 0 ? squishSum / totalVol : 0.5;

  // Compression from players sitting/stomping on it
  const compressionRatio = Math.min(1.0, suitcase.compression);
  const squishedVol = totalVol * (1.0 - compressionRatio * avgSquish * 0.7);

  // Bulge is excess volume above standard capacity 1.0
  const excess = Math.max(0, squishedVol - 1.0);
  const bulge = excess * 0.28;
  const height = SUITCASE_BASE_H + bulge;

  // Strain is tension on seams: rises with excess volume if not compressed
  const uncompressedExcess = Math.max(0, totalVol - 1.0);
  const strain = uncompressedExcess * (1.0 - compressionRatio * 0.85);

  // Can zip if bulge is low enough (< 0.15) or compressed, provided bag is not bursting/overflowing (> 2.2 vol)
  const canZip =
    (bulge <= 0.15 || compressionRatio >= 0.7) && squishedVol <= 2.2;

  return {
    rawVolume: totalVol,
    effectiveVolume: squishedVol,
    bulge,
    height,
    strain,
    canZip,
  };
}

/** Test whether a suitcase fits inside the gate agent's sizer cage */
export function checkSizerFit(
  suitcase: Suitcase,
  items: LuggageItem[],
): { pass: boolean; reason?: string } {
  if (suitcase.zipped < 0.95) {
    return { pass: false, reason: 'Lid unzipped! Items spilling out.' };
  }

  const { height, rawVolume, bulge } = computeSuitcaseBulge(suitcase, items);

  if (height > SIZER_MAX_H || bulge > 0.12) {
    return {
      pass: false,
      reason: `Bulges by ${(height - SIZER_MAX_H + bulge).toFixed(2)}m! Sizer lid jammed.`,
    };
  }

  // Check if unyielding long items (like tennis rackets) were packed without zipping
  const packed = items.filter((it) => it.packedIn === suitcase.id);
  const hasRacket = packed.some((it) => it.kind === 'racket');
  if (hasRacket && rawVolume > 2.2 && suitcase.zipped < 0.98) {
    return {
      pass: false,
      reason: 'Tennis racket handle sticking out past metal frame!',
    };
  }

  return { pass: true };
}

/** Explode an overstrained or bursting suitcase like a piñata! */
export function burstSuitcase(
  world: CarryOnWorld,
  suitcase: Suitcase,
  eventIdRef: { current: number },
) {
  suitcase.burst = true;
  suitcase.open = true;
  suitcase.zipped = 0;
  suitcase.compression = 0;
  suitcase.strain = 0;

  // Pop all items out with explosive physical impulses
  for (const itemId of suitcase.items) {
    const item = world.items.find((it) => it.id === itemId);
    if (item) {
      item.packedIn = null;
      item.heldBy = null;
      item.x = suitcase.x + (Math.random() - 0.5) * 0.6;
      item.y = suitcase.y + SUITCASE_BASE_H + 0.3;
      item.z = suitcase.z + (Math.random() - 0.5) * 0.6;

      const angle = Math.random() * Math.PI * 2;
      const force = 3.5 + Math.random() * 4.5;
      item.vx = Math.cos(angle) * force;
      item.vy = 4.5 + Math.random() * 5.0;
      item.vz = Math.sin(angle) * force;
    }
  }
  suitcase.items = [];

  // Fling nearby players backwards and stun them
  for (const player of world.players) {
    const dx = player.x - suitcase.x;
    const dz = player.z - suitcase.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.8) {
      const push = (2.8 - dist) * 4.0;
      const nx = dist > 0.01 ? dx / dist : 1;
      const nz = dist > 0.01 ? dz / dist : 0;
      player.vx += nx * push;
      player.vy = 4.0;
      player.vz += nz * push;
      player.sittingOn = null;
      player.zippingSuitcase = null;
      player.downUntil = world.clock + 2200; // Stunned for 2.2s
    }
  }

  world.events.push({
    id: ++eventIdRef.current,
    type: 'burst',
    text: '💥 PIÑATA BURST! Suitcase exploded across the terminal!',
    pos: [suitcase.x, suitcase.y + 0.8, suitcase.z],
    color: '#ef4444',
  });
}

/** Step physics simulation */
export function stepPhysics(
  world: CarryOnWorld,
  dt: number,
  eventIdRef: { current: number },
) {
  const now = world.clock;

  // 1. Player movement and physics
  for (const p of world.players) {
    // If stunned, cannot steer
    if (now < p.downUntil) {
      p.input = { ...p.input, x: 0, z: 0, jump: false };
    }

    if (p.sittingOn) {
      // Sitting on a suitcase to compress it
      const sc = world.suitcases.find((s) => s.id === p.sittingOn);
      if (sc && !sc.burst) {
        p.x = sc.x;
        p.z = sc.z;
        p.y = sc.y + SUITCASE_BASE_H * 0.6;
        p.vx = 0;
        p.vz = 0;
        p.grounded = true;
      } else {
        p.sittingOn = null;
      }
    } else {
      // Normal walking
      if (Math.abs(p.input.x) > 0.01 || Math.abs(p.input.z) > 0.01) {
        p.vx = p.input.x * WALK_SPEED;
        p.vz = p.input.z * WALK_SPEED;
        p.facing = Math.atan2(p.input.x, p.input.z);
      } else {
        p.vx *= 0.8;
        p.vz *= 0.8;
      }

      // Jump
      if (p.input.jump && p.grounded && now >= p.downUntil) {
        p.vy = JUMP_SPEED;
        p.grounded = false;
      }

      // Gravity
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Floor clamp
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.grounded = true;
      }

      // Physical collisions with furniture, suitcases, other players, and boundaries
      resolvePlayerCollisions(p, world);
    }
  }

  // 2. Suitcase physics and compression calculation
  for (const sc of world.suitcases) {
    // Check players sitting or standing on this suitcase
    let sitters = 0;
    for (const p of world.players) {
      if (p.sittingOn === sc.id) {
        sitters++;
      } else if (
        !p.sittingOn &&
        Math.hypot(p.x - sc.x, p.z - sc.z) < 0.6 &&
        p.y >= sc.y + 0.2 &&
        p.y <= sc.y + 1.2
      ) {
        // Standing / jumping on it applies compression
        sitters += 0.7;
      }
    }
    sc.sittingCount = Math.round(sitters);

    // Dynamic spring compression: 1 player provides 88% compression (enough to zip),
    // 2+ players reach 100% max compression, jumping/stomping provides dynamic weight surges
    const targetComp = Math.min(
      1.0,
      sitters >= 1 ? 0.88 + (sitters - 1) * 0.12 : sitters * 0.88,
    );
    sc.compression += (targetComp - sc.compression) * 0.2;

    // Recalculate bulge and strain
    const stats = computeSuitcaseBulge(sc, world.items);
    sc.bulge = stats.bulge;
    sc.strain = stats.strain;

    // Check for violent burst if overpacked and uncompressed
    if (
      !sc.burst &&
      stats.rawVolume > BURST_THRESHOLD &&
      sc.zipped < 0.9 &&
      sitters === 0 &&
      stats.strain > 1.8
    ) {
      burstSuitcase(world, sc, eventIdRef);
    }

    // Carried suitcase moves with player
    if (sc.heldBy) {
      const holder = world.players.find((p) => p.id === sc.heldBy);
      if (holder) {
        const offX = Math.sin(holder.facing) * 0.65;
        const offZ = Math.cos(holder.facing) * 0.65;
        sc.x = holder.x + offX;
        sc.z = holder.z + offZ;
        sc.y = holder.y + 0.15;
        sc.yaw = holder.facing;
      } else {
        sc.heldBy = null;
      }
    }
  }

  // 3. Unpacked item physics
  for (const it of world.items) {
    if (it.packedIn) continue;

    if (it.heldBy) {
      const holder = world.players.find((p) => p.id === it.heldBy);
      if (holder) {
        const offX = Math.sin(holder.facing) * 0.5;
        const offZ = Math.cos(holder.facing) * 0.5;
        it.x = holder.x + offX;
        it.y = holder.y + 0.9;
        it.z = holder.z + offZ;
        it.rotation = holder.facing;
        it.vx = 0;
        it.vy = 0;
        it.vz = 0;
      } else {
        it.heldBy = null;
      }
      continue;
    }

    // Free item gravity & bounce
    it.vy += GRAVITY * dt;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    it.z += it.vz * dt;

    it.vx *= 0.94;
    it.vz *= 0.94;

    if (it.y <= 0.15) {
      it.y = 0.15;
      if (Math.abs(it.vy) > 1.2) {
        it.vy = -it.vy * 0.35; // bounce
      } else {
        it.vy = 0;
      }
    }

    it.x = Math.max(TERMINAL_MIN_X, Math.min(TERMINAL_MAX_X, it.x));
    it.z = Math.max(TERMINAL_MIN_Z, Math.min(TERMINAL_MAX_Z, it.z));
  }
}
