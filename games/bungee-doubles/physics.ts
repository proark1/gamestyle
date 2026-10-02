import {
  BALL_RADIUS,
  BUNGEE,
  COURT,
  type Ball,
  type GameEvent,
  type Player,
  type TeamId,
  type TeamTether,
} from './types';

export const GRAVITY = -14.0;
export const RESTITUTION_COURT = 0.78;
export const AIR_DRAG = 0.993;
export const PLAYER_MASS = 1.0;

export type PhysicsStepResult = {
  events: GameEvent[];
  pointScored: boolean;
  scoringTeam: TeamId | null;
  faultReason?: string;
};

/** Get net height at horizontal position x */
export function getNetHeightAt(x: number): number {
  const halfW = COURT.width / 2;
  const ratio = Math.min(1, Math.abs(x) / halfW);
  return (
    COURT.netCenterHeight + (COURT.netHeight - COURT.netCenterHeight) * ratio
  );
}

/** Check if a point (x, z) is inside tennis court bounds */
export function isInsideCourt(x: number, z: number): boolean {
  return Math.abs(x) <= COURT.width / 2 && Math.abs(z) <= COURT.length / 2;
}

/** Update the bungee tether physics between two teammates */
export function stepBungeeTether(
  playerA: Player,
  playerB: Player,
  dt: number,
  now: number,
  events: GameEvent[],
  eventIdRef: { current: number },
): TeamTether {
  const dx = playerB.x - playerA.x;
  const dz = playerB.z - playerA.z;
  const distance = Math.hypot(dx, dz);

  const nx = distance > 0.001 ? dx / distance : 1;
  const nz = distance > 0.001 ? dz / distance : 0;

  const stretch = Math.max(0, distance - BUNGEE.restLength);
  const maxDelta = BUNGEE.maxStretch - BUNGEE.restLength;
  const tension = Math.min(1, stretch / maxDelta);
  const isCritical = distance >= BUNGEE.snapThreshold;

  if (distance > BUNGEE.restLength) {
    // Relative velocity along tether normal
    const rvx = playerB.vx - playerA.vx;
    const rvz = playerB.vz - playerA.vz;
    const relVel = rvx * nx + rvz * nz;

    // Spring + damping force
    const springForce = stretch * BUNGEE.stiffness + relVel * BUNGEE.damping;
    const forceClamped = Math.max(0, springForce);

    // Apply force to players
    const ax = (forceClamped * nx) / PLAYER_MASS;
    const az = (forceClamped * nz) / PLAYER_MASS;

    playerA.vx += ax * dt;
    playerA.vz += az * dt;

    playerB.vx -= ax * dt;
    playerB.vz -= az * dt;

    // Overstretch snap / head-on bonk
    if (isCritical) {
      // Strong pull towards center
      if (Math.random() < 1 - Math.pow(0.96, dt * 60)) {
        events.push({
          id: ++eventIdRef.current,
          type: 'bungee_stretch',
          text: 'Bungee Strain!',
          team: playerA.team,
          pos: [(playerA.x + playerB.x) / 2, 1, (playerA.z + playerB.z) / 2],
        });
      }
    }
  }

  // Teammate head-on collision check
  if (
    distance < 0.95 &&
    (Math.hypot(playerA.vx, playerA.vz) > 6 ||
      Math.hypot(playerB.vx, playerB.vz) > 6)
  ) {
    // Bonk! Both stumble
    if (playerA.stunnedUntil < now && playerB.stunnedUntil < now) {
      playerA.stunnedUntil = now + 1300;
      playerB.stunnedUntil = now + 1300;
      playerA.specialState = 'stunned';
      playerB.specialState = 'stunned';
      playerA.bonks++;
      playerB.bonks++;

      // Recoil
      playerA.vx = -nx * 4;
      playerA.vz = -nz * 4;
      playerB.vx = nx * 4;
      playerB.vz = nz * 4;

      events.push({
        id: ++eventIdRef.current,
        type: 'partner_bonk',
        text: 'TEAM BONK!',
        team: playerA.team,
        pos: [(playerA.x + playerB.x) / 2, 1.2, (playerA.z + playerB.z) / 2],
      });
    }
  }

  return {
    team: playerA.team,
    playerA: playerA.id,
    playerB: playerB.id,
    distance,
    tension,
    isCritical,
  };
}

export type BallPhysicsResult = {
  bounced: boolean;
  floorY: number;
  crossedNet: boolean;
  hitWall: 'back' | 'side' | null;
  wallPos?: [number, number, number];
  contacts: Array<{
    type: 'floor' | 'back' | 'side';
    pos: [number, number, number];
  }>;
};

/** Step ball simulation including gravity, bounce, net collisions, and padel wall reflections */
export function stepBallPhysics(
  ball: Ball,
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
): BallPhysicsResult {
  const result: BallPhysicsResult = {
    bounced: false,
    floorY: BALL_RADIUS,
    crossedNet: false,
    hitWall: null,
    contacts: [],
  };
  if (ball.state !== 'in_play' || dt <= 0) return result;
  ball.vy += GRAVITY * dt;
  const drag = Math.pow(AIR_DRAG, dt * 60);
  ball.vx *= drag;
  ball.vz *= drag;
  let remaining = dt;
  const halfW = COURT.width / 2 - BALL_RADIUS;
  const halfL = COURT.length / 2 - BALL_RADIUS;
  // Resolve contacts in time order. Floor-then-glass is legal; the reverse is not.
  for (let iteration = 0; remaining > 0.000001 && iteration < 12; iteration++) {
    let time = remaining;
    let kind: 'floor' | 'back' | 'side' | 'net' | null = null;
    const consider = (t: number, candidate: typeof kind) => {
      if (t >= -0.000001 && t <= time) {
        time = Math.max(0, t);
        kind = candidate;
      }
    };
    if (ball.vy < 0) consider((BALL_RADIUS - ball.y) / ball.vy, 'floor');
    if (ball.vz !== 0) {
      const t = ((ball.vz > 0 ? halfL : -halfL) - ball.z) / ball.vz;
      if (ball.y + ball.vy * t <= COURT.wallHeight) consider(t, 'back');
      const netZ = ball.vz > 0 ? -BALL_RADIUS : BALL_RADIUS;
      const nt = (netZ - ball.z) / ball.vz;
      const nx = ball.x + ball.vx * nt;
      if (
        Math.abs(nx) <= COURT.width / 2 + 0.6 &&
        ball.y + ball.vy * nt <= getNetHeightAt(nx) + BALL_RADIUS
      )
        consider(nt, 'net');
    }
    if (ball.vx !== 0) {
      const t = ((ball.vx > 0 ? halfW : -halfW) - ball.x) / ball.vx;
      if (ball.y + ball.vy * t <= COURT.wallHeight) consider(t, 'side');
    }
    const oldZ = ball.z;
    ball.x += ball.vx * time;
    ball.y += ball.vy * time;
    ball.z += ball.vz * time;
    if (oldZ * ball.z < 0) result.crossedNet = true;
    remaining -= time;
    if (!kind) break;
    if (kind === 'floor') {
      ball.y = BALL_RADIUS;
      result.bounced = true;
      result.contacts.push({ type: 'floor', pos: [ball.x, 0, ball.z] });
      events.push({
        id: ++eventIdRef.current,
        type: 'ball_bounce',
        text: 'Bounce',
        pos: [ball.x, 0, ball.z],
      });
      ball.vy = Math.abs(ball.vy) > 0.8 ? -ball.vy * RESTITUTION_COURT : 0;
      ball.vx *= 0.88;
      ball.vz *= 0.88;
    } else if (kind === 'net') {
      ball.z += ball.vz > 0 ? -0.001 : 0.001;
      ball.vz *= -0.32;
      ball.vx *= 0.5;
      ball.vy = Math.max(1.5, ball.vy * 0.4);
      ball.speedTrail = ball.isSmash = false;
      events.push({
        id: ++eventIdRef.current,
        type: 'net_hit',
        text: 'Net Cord!',
        pos: [ball.x, ball.y, 0],
      });
    } else {
      result.hitWall = kind;
      result.wallPos = [ball.x, ball.y, ball.z];
      result.contacts.push({ type: kind, pos: [...result.wallPos] });
      if (kind === 'back') {
        ball.vz *= -0.75;
        ball.vx *= 0.92;
      } else {
        ball.vx *= -0.72;
        ball.vz *= 0.92;
      }
    }
  }
  return result;
}

/** Calculate launch velocity for returning the ball across the net */
export function calculateRacketShot(
  fromX: number,
  fromY: number,
  fromZ: number,
  hitterTeam: TeamId,
  isSmash: boolean,
  isDive: boolean,
  facingAngle: number,
): { vx: number; vy: number; vz: number } {
  // Target is deep into opponent's court
  const targetZ = hitterTeam === 'red' ? 7.5 : -7.5;
  // Target X combines facing angle with slight baseline spread
  const targetX = Math.sin(facingAngle) * (COURT.width * 0.35);

  const dx = targetX - fromX;
  const dz = targetZ - fromZ;
  const dist = Math.hypot(dx, dz);

  if (isSmash) {
    // Powerful downward line-drive smash
    const time = Math.max(0.45, dist / 22);
    const vx = dx / time;
    const vz = dz / time;
    const vy = (1.5 - fromY) / time;
    return { vx, vy, vz };
  }

  if (isDive) {
    // Defensive high lob
    const time = Math.max(1.2, dist / 11);
    const vx = dx / time;
    const vz = dz / time;
    const vy = Math.sqrt(2 * Math.abs(GRAVITY) * 4.5); // high arc
    return { vx, vy, vz };
  }

  // Standard topspin volley
  const time = Math.max(0.75, dist / 15);
  const netTop = 1.35; // clearance over net
  const arcHeight = Math.max(fromY + 1.2, netTop + 0.6);
  const vy = Math.sqrt(
    2 * Math.abs(GRAVITY) * Math.max(0.5, arcHeight - fromY),
  );
  const vx = dx / time;
  const vz = dz / time;

  return { vx, vy, vz };
}

/**
 * Transforms screen-relative movement input (A/D = horizontal, W/S = forward/back)
 * into world space (X, Z) based on camera orientation matrix.
 *
 * Screen coordinates:
 * screenX: -1 for left (A), +1 for right (D)
 * screenZ: +1 for forward/up (W), -1 for backward/down (S)
 */
export function computeCameraRelativeMovement(
  screenX: number,
  screenZ: number,
  camMatrixElements: ArrayLike<number>,
): { x: number; z: number } {
  if (screenX === 0 && screenZ === 0) {
    return { x: 0, z: 0 };
  }

  // Camera local right projected onto XZ ground plane
  let rightX = camMatrixElements[0];
  let rightZ = camMatrixElements[2];
  const rightLen = Math.hypot(rightX, rightZ);
  if (rightLen > 0.0001) {
    rightX /= rightLen;
    rightZ /= rightLen;
  }

  // Camera local forward projected onto XZ ground plane (-Z column of world matrix)
  let fwdX = -camMatrixElements[8];
  let fwdZ = -camMatrixElements[10];
  const fwdLen = Math.hypot(fwdX, fwdZ);
  if (fwdLen > 0.0001) {
    fwdX /= fwdLen;
    fwdZ /= fwdLen;
  }

  let worldX = screenX * rightX + screenZ * fwdX;
  let worldZ = screenX * rightZ + screenZ * fwdZ;

  const len = Math.hypot(worldX, worldZ);
  if (len > 0.0001) {
    worldX /= len;
    worldZ /= len;
  } else {
    worldX = 0;
    worldZ = 0;
  }

  return {
    x: Math.abs(worldX) < 0.0001 ? 0 : worldX,
    z: Math.abs(worldZ) < 0.0001 ? 0 : worldZ,
  };
}
