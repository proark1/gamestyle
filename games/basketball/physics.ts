import {
  BALL_RADIUS,
  COURT,
  HOOP,
  type Ball,
  type GameEvent,
  type Player,
} from './types';

export const GRAVITY = -13.5;
export const RESTITUTION_FLOOR = 0.76;
export const RESTITUTION_BACKBOARD = 0.62;
export const RESTITUTION_RIM = 0.55;
export const AIR_DRAG = 0.994;

export type PhysicsStepResult = {
  scored: boolean;
  isThree: boolean;
  isDunk: boolean;
  isSuper: boolean;
  shooterId: string | null;
  shooterTeam: string | null;
  events: GameEvent[];
};

export function isBeyondThreePoint(x: number, z: number): boolean {
  const dist = Math.hypot(x - HOOP.x, z - HOOP.z);
  return dist >= COURT.threePointRadius;
}

export function distanceToHoop(x: number, z: number): number {
  return Math.hypot(x - HOOP.x, z - HOOP.z);
}

/** Calculate launch velocity for a shot aiming at the hoop from (fromX, fromY, fromZ) */
export function calculateShotVelocity(
  fromX: number,
  fromY: number,
  fromZ: number,
  charge: number, // 0..1 (sweet spot ~ 0.70..0.85)
  isSuper: boolean,
): { vx: number; vy: number; vz: number; isThree: boolean } {
  const dx = HOOP.x - fromX;
  const dz = HOOP.z - fromZ;
  const dist = Math.hypot(dx, dz);
  const isThree = dist >= COURT.threePointRadius;

  // Arc height depends on distance
  const targetArcHeight = Math.max(
    HOOP.y + 1.2,
    fromY + dist * 0.45 + (isSuper ? 1.5 : 0),
  );
  const heightDiff = targetArcHeight - fromY;
  const vy = Math.sqrt(Math.max(10, 2 * Math.abs(GRAVITY) * heightDiff));

  // Time to reach peak and then fall to hoop
  const tUp = vy / Math.abs(GRAVITY);
  const fallDist = targetArcHeight - HOOP.y;
  const tDown = Math.sqrt(Math.max(0.01, (2 * fallDist) / Math.abs(GRAVITY)));
  const totalTime = tUp + tDown;

  // Base perfect velocity
  let vx = dx / totalTime;
  let vz = dz / totalTime;

  // Apply shot timing inaccuracy if not super
  // Sweet spot is 0.72..0.82
  const sweetMin = 0.68;
  const sweetMax = 0.84;
  if (!isSuper) {
    let error = 0;
    if (charge < sweetMin) {
      // Short / underpowered
      error = (charge - sweetMin) * 2.2;
    } else if (charge > sweetMax) {
      // Long / overpowered
      error = (charge - sweetMax) * 2.5;
    }
    vz += (dz / dist) * error * 2.0;
    vx += (dx / dist) * error * 2.0;
    // Slight lateral dispersion on poorly timed shots
    if (Math.abs(error) > 0.2) {
      vx += (Math.random() - 0.5) * 0.7;
    }
  }

  return { vx, vy, vz, isThree };
}

export function stepBallPhysics(
  ball: Ball,
  dt: number,
  eventIdRef: { current: number },
): PhysicsStepResult {
  const result: PhysicsStepResult = {
    scored: false,
    isThree: ball.isThreePointer,
    isDunk: ball.isDunk,
    isSuper: ball.isSuperShot,
    shooterId: ball.shotBy,
    shooterTeam: ball.shotTeam,
    events: [],
  };

  // If held, ball is positioned by holder in simulation
  if (ball.heldBy) return result;

  const prevY = ball.y;

  // 1. Gravity & Drag
  ball.vy += GRAVITY * dt;
  ball.vx *= AIR_DRAG;
  ball.vz *= AIR_DRAG;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;

  // 2. Floor Collision
  if (ball.y <= BALL_RADIUS) {
    ball.y = BALL_RADIUS;
    if (Math.abs(ball.vy) > 0.8) {
      result.events.push({
        id: ++eventIdRef.current,
        type: 'bounce',
        text: 'ball bounce',
        pos: [ball.x, ball.y, ball.z],
      });
      ball.vy = -ball.vy * RESTITUTION_FLOOR;
      ball.vx *= 0.85;
      ball.vz *= 0.85;
    } else {
      ball.vy = 0;
      ball.vx *= 0.94;
      ball.vz *= 0.94;
    }
  }

  // 3. Backboard Collision
  // Backboard is at z = HOOP.backboardZ (-10.6)
  const bbHalfW = HOOP.backboardWidth / 2;
  const bbMinY = HOOP.backboardY - HOOP.backboardHeight / 2;
  const bbMaxY = HOOP.backboardY + HOOP.backboardHeight / 2;
  const bbFrontZ = HOOP.backboardZ + 0.05;

  if (
    ball.y >= bbMinY &&
    ball.y <= bbMaxY &&
    Math.abs(ball.x - HOOP.x) <= bbHalfW &&
    Math.abs(ball.z - bbFrontZ) <= BALL_RADIUS + 0.08 &&
    ball.vz < 0
  ) {
    ball.z = bbFrontZ + BALL_RADIUS;
    ball.vz = Math.abs(ball.vz) * RESTITUTION_BACKBOARD;
    ball.vx += (Math.random() - 0.5) * 0.4;
    result.events.push({
      id: ++eventIdRef.current,
      type: 'backboard',
      text: 'backboard hit',
      pos: [ball.x, ball.y, ball.z],
    });
  }

  // 4. Rim Collision & Scoring
  const dx = ball.x - HOOP.x;
  const dz = ball.z - HOOP.z;
  const distXZ = Math.hypot(dx, dz);

  // Check for basket score (passes through rim cylinder from above)
  if (
    distXZ <= HOOP.rimRadius - BALL_RADIUS * 0.35 &&
    prevY >= HOOP.y &&
    ball.y < HOOP.y &&
    ball.vy < 0
  ) {
    result.scored = true;
    result.isThree = ball.isThreePointer;
    result.isDunk = ball.isDunk;
    result.isSuper = ball.isSuperShot;
    result.shooterId = ball.shotBy;
    result.shooterTeam = ball.shotTeam;

    // Dampen velocity through the net
    ball.vy *= 0.35;
    ball.vx *= 0.25;
    ball.vz *= 0.25;

    result.events.push({
      id: ++eventIdRef.current,
      type: ball.isSuperShot ? 'superdunk' : ball.isDunk ? 'dunk' : 'swish',
      text: ball.isSuperShot
        ? 'SUPER DUNK!'
        : ball.isDunk
          ? 'SLAM DUNK!'
          : 'SWISH!',
      pos: [HOOP.x, HOOP.y, HOOP.z],
    });

    return result;
  }

  // Check collision with rim ring
  if (distXZ > 0.01) {
    const rimPointX = HOOP.x + (dx / distXZ) * HOOP.rimRadius;
    const rimPointY = HOOP.y;
    const rimPointZ = HOOP.z + (dz / distXZ) * HOOP.rimRadius;

    const rdx = ball.x - rimPointX;
    const rdy = ball.y - rimPointY;
    const rdz = ball.z - rimPointZ;
    const distToRim = Math.hypot(rdx, rdy, rdz);

    if (distToRim < BALL_RADIUS + 0.05) {
      const normalX = rdx / Math.max(0.01, distToRim);
      const normalY = rdy / Math.max(0.01, distToRim);
      const normalZ = rdz / Math.max(0.01, distToRim);

      // Repel from rim
      ball.x = rimPointX + normalX * (BALL_RADIUS + 0.06);
      ball.y = rimPointY + normalY * (BALL_RADIUS + 0.06);
      ball.z = rimPointZ + normalZ * (BALL_RADIUS + 0.06);

      // Reflect velocity
      const dot = ball.vx * normalX + ball.vy * normalY + ball.vz * normalZ;
      if (dot < 0) {
        ball.vx = (ball.vx - 2 * dot * normalX) * RESTITUTION_RIM;
        ball.vy = (ball.vy - 2 * dot * normalY) * RESTITUTION_RIM;
        ball.vz = (ball.vz - 2 * dot * normalZ) * RESTITUTION_RIM;

        result.events.push({
          id: ++eventIdRef.current,
          type: 'rim',
          text: 'rim clang',
          pos: [rimPointX, rimPointY, rimPointZ],
        });
      }
    }
  }

  // 5. Court bounds soft reflection
  if (ball.x < COURT.minX - 1.5) {
    ball.x = COURT.minX - 1.5;
    ball.vx = Math.abs(ball.vx) * 0.7;
  } else if (ball.x > COURT.maxX + 1.5) {
    ball.x = COURT.maxX + 1.5;
    ball.vx = -Math.abs(ball.vx) * 0.7;
  }
  if (ball.z < COURT.baselineZ - 2.5) {
    ball.z = COURT.baselineZ - 2.5;
    ball.vz = Math.abs(ball.vz) * 0.7;
  } else if (ball.z > COURT.halfCourtZ + 3.5) {
    ball.z = COURT.halfCourtZ + 3.5;
    ball.vz = -Math.abs(ball.vz) * 0.7;
  }

  return result;
}

export function stepPlayerMovement(player: Player, dt: number): void {
  const speed = player.input.sprint ? 7.2 : 5.0;
  const accel = 18;

  // Target velocities from input
  const length = Math.hypot(player.input.x, player.input.z);
  const normX = length > 0.1 ? player.input.x / length : 0;
  const normZ = length > 0.1 ? player.input.z / length : 0;

  const targetVx = normX * speed;
  const targetVz = normZ * speed;

  player.vx += (targetVx - player.vx) * Math.min(1, accel * dt);
  player.vz += (targetVz - player.vz) * Math.min(1, accel * dt);

  // Update facing angle when moving
  if (Math.hypot(player.vx, player.vz) > 0.3) {
    player.facing = Math.atan2(player.vx, player.vz);
  }

  // Jump physics
  if (!player.grounded) {
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
      player.jumping = false;
      player.superJump = false;
    }
  }

  // Position update
  player.x += player.vx * dt;
  player.z += player.vz * dt;

  // Court clamping
  player.x = Math.max(COURT.minX + 0.6, Math.min(COURT.maxX - 0.6, player.x));
  player.z = Math.max(
    COURT.baselineZ + 0.6,
    Math.min(COURT.halfCourtZ + 1.5, player.z),
  );

  // Dribble animation phase
  if (player.hasBall) {
    const moveSpeed = Math.hypot(player.vx, player.vz);
    const dribbleRate = player.grounded ? Math.max(8, moveSpeed * 3) : 4;
    player.dribblePhase =
      (player.dribblePhase + dribbleRate * dt) % (Math.PI * 2);
  }
}
