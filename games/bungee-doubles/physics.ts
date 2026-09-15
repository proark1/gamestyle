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
      if (Math.random() < 0.04) {
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
};

/** Step ball simulation including gravity, bounce, net collisions, and padel wall reflections */
export function stepBallPhysics(
  ball: Ball,
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
): BallPhysicsResult {
  if (ball.state === 'serving') {
    return { bounced: false, floorY: 0, crossedNet: false, hitWall: null };
  }

  const prevZ = ball.z;

  // Apply gravity & drag
  ball.vy += GRAVITY * dt;
  ball.vx *= AIR_DRAG;
  ball.vz *= AIR_DRAG;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;

  let crossedNet = false;
  // Net collision check (net at z = 0)
  if (
    (prevZ * ball.z <= 0 || Math.abs(ball.z) < BALL_RADIUS) &&
    Math.abs(ball.x) <= COURT.width / 2 + 0.6
  ) {
    const netHeight = getNetHeightAt(ball.x);
    if (ball.y <= netHeight + BALL_RADIUS) {
      // Rebound off net
      ball.z = prevZ < 0 ? -BALL_RADIUS - 0.02 : BALL_RADIUS + 0.02;
      ball.vz = -ball.vz * 0.32;
      ball.vx *= 0.5;
      ball.vy = Math.max(1.5, ball.vy * 0.4);
      ball.speedTrail = false;
      ball.isSmash = false;

      events.push({
        id: ++eventIdRef.current,
        type: 'net_hit',
        text: 'Net Cord!',
        pos: [ball.x, ball.y, 0],
      });
    } else {
      crossedNet = true;
    }
  } else if (prevZ * ball.z <= 0) {
    crossedNet = true;
  }

  let bounced = false;
  // Floor bounce
  if (ball.y <= BALL_RADIUS) {
    ball.y = BALL_RADIUS;
    if (Math.abs(ball.vy) > 0.8) {
      ball.vy = -ball.vy * RESTITUTION_COURT;
      ball.vx *= 0.88;
      ball.vz *= 0.88;
      bounced = true;

      events.push({
        id: ++eventIdRef.current,
        type: 'ball_bounce',
        text: 'Bounce',
        pos: [ball.x, 0, ball.z],
      });
    } else {
      ball.vy = 0;
      ball.vx *= 0.94;
      ball.vz *= 0.94;
    }
  }

  let hitWall: 'back' | 'side' | null = null;
  let wallPos: [number, number, number] | undefined;
  const halfL = COURT.length / 2;
  const halfW = COURT.width / 2;

  // Wall collisions (Padel enclosed court)
  if (ball.y <= COURT.wallHeight) {
    // Back glass walls
    if (ball.z <= -halfL + BALL_RADIUS && ball.vz < 0) {
      ball.z = -halfL + BALL_RADIUS;
      ball.vz = -ball.vz * 0.75;
      ball.vx *= 0.92;
      hitWall = 'back';
      wallPos = [ball.x, ball.y, ball.z];
    } else if (ball.z >= halfL - BALL_RADIUS && ball.vz > 0) {
      ball.z = halfL - BALL_RADIUS;
      ball.vz = -ball.vz * 0.75;
      ball.vx *= 0.92;
      hitWall = 'back';
      wallPos = [ball.x, ball.y, ball.z];
    }

    // Side mesh/glass walls
    if (ball.x <= -halfW + BALL_RADIUS && ball.vx < 0) {
      ball.x = -halfW + BALL_RADIUS;
      ball.vx = -ball.vx * 0.72;
      ball.vz *= 0.92;
      if (!hitWall) hitWall = 'side';
      wallPos = [ball.x, ball.y, ball.z];
    } else if (ball.x >= halfW - BALL_RADIUS && ball.vx > 0) {
      ball.x = halfW - BALL_RADIUS;
      ball.vx = -ball.vx * 0.72;
      ball.vz *= 0.92;
      if (!hitWall) hitWall = 'side';
      wallPos = [ball.x, ball.y, ball.z];
    }
  }

  return { bounced, floorY: BALL_RADIUS, crossedNet, hitWall, wallPos };
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
  const targetZ = hitterTeam === 'orange' ? 7.5 : -7.5;
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
