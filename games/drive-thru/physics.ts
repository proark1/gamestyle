import type { SedanState, Patty } from './types';

export const SPEAKER_POLE_POS = { x: -3.8, z: 10.5 };
export const SPEAKER_POLE_RADIUS = 0.45;
/** How far the sedan's body reaches from its centre when it meets the pole. */
export const CAR_BODY_RADIUS = 1.2;

export const WINDOW_SILL_POS = { x: 2.2, z: 0.0, y: 1.1 };
export const CURB_X = 1.4;

export const GRILL_BOUNDS = {
  minX: 3.2,
  maxX: 5.2,
  minZ: -2.0,
  maxZ: 0.5,
  y: 0.95,
};

export const TRAY_LEDGE_POS = {
  x: 2.3,
  y: 1.1,
  z: 0.0,
};

/**
 * Step car kinematics with realistic inertia, steering lag, and collision against the speaker pole.
 */
export function stepCarPhysics(
  car: SedanState,
  throttle: boolean,
  reverse: boolean,
  steerInput: number,
  dt: number,
): void {
  // Acceleration & Braking
  const accel = 6.5;
  const maxSpeed = 11.0;
  const reverseMaxSpeed = -4.5;
  const drag = 3.2;

  if (throttle) {
    car.speed = Math.min(maxSpeed, car.speed + accel * dt);
  } else if (reverse) {
    car.speed = Math.max(reverseMaxSpeed, car.speed - accel * dt);
  } else {
    // Natural friction drag
    if (car.speed > 0) {
      car.speed = Math.max(0, car.speed - drag * dt);
    } else if (car.speed < 0) {
      car.speed = Math.min(0, car.speed + drag * dt);
    }
  }

  // Steering: speed-dependent turn rate with smooth interpolation
  const targetSteer = steerInput * 0.65;
  car.steer += (targetSteer - car.steer) * Math.min(1, 10 * dt);

  if (Math.abs(car.speed) > 0.05) {
    const turnSign = car.speed >= 0 ? 1 : -1;
    car.yaw += car.steer * (car.speed / maxSpeed) * turnSign * 2.4 * dt;
  }

  // Movement along forward direction (-Z in local car space, facing drive-thru lane)
  const forwardX = Math.sin(car.yaw);
  const forwardZ = -Math.cos(car.yaw);

  car.x += forwardX * car.speed * dt;
  car.z += forwardZ * car.speed * dt;

  // Speaker pole collision
  const distToPole = Math.hypot(
    car.x - SPEAKER_POLE_POS.x,
    car.z - SPEAKER_POLE_POS.z,
  );
  if (distToPole < SPEAKER_POLE_RADIUS + CAR_BODY_RADIUS) {
    // Collision impact!
    const overlap = SPEAKER_POLE_RADIUS + CAR_BODY_RADIUS - distToPole;
    const nx = (car.x - SPEAKER_POLE_POS.x) / (distToPole || 1);
    const nz = (car.z - SPEAKER_POLE_POS.z) / (distToPole || 1);
    car.x += nx * overlap;
    car.z += nz * overlap;

    // If reversing into pole with speed, trigger pole crash!
    if (car.speed < -1.0) {
      car.reversedIntoPole = true;
    }
    car.speed = -car.speed * 0.35;
    car.bumperDamage = Math.min(100, car.bumperDamage + 25);
  }

  // Track drive-thru lane bounds (X: [-8, 2.0], Z: [-12, 24]). Scraping an
  // edge keeps 85% of the speed per 1/60 s, whatever the frame rate: a flat
  // 0.85 per step pinned a car on the curb at 0.26 m/s at 144 Hz.
  const scrape = Math.pow(0.85, dt * 60);
  if (car.x > 1.8) {
    // Rubbing curb
    car.x = 1.8;
    car.speed *= scrape;
  } else if (car.x < -8.0) {
    car.x = -8.0;
    car.speed *= scrape;
  }

  // Windshield wipers auto-clear splat
  if (car.wipersActive && car.windshieldSplat > 0) {
    car.windshieldSplat = Math.max(0, car.windshieldSplat - 0.45 * dt);
  }
}

/**
 * Step patty flip & gravity physics on the flat-top grill
 */
export function stepPattyPhysics(patty: Patty, dt: number): void {
  if (patty.vy !== 0 || patty.y > GRILL_BOUNDS.y) {
    // In mid-air flip
    patty.vy -= 9.81 * dt;
    patty.y += patty.vy * dt;
    patty.x += patty.vx * dt;
    patty.z += patty.vz * dt;
    patty.flipAngle += Math.PI * 3.5 * dt;

    if (patty.y <= GRILL_BOUNDS.y) {
      patty.y = GRILL_BOUNDS.y;
      patty.vy = 0;
      patty.vx = 0;
      patty.vz = 0;
      // Flip settles
      patty.flipAngle = Math.round(patty.flipAngle / Math.PI) * Math.PI;
    }
  }

  // Cooking progression when resting on the hot grill
  if (patty.y <= GRILL_BOUNDS.y + 0.05) {
    if (patty.sizzleProgress < 1) {
      patty.sizzleProgress += 0.12 * dt;
      patty.state = patty.sizzleProgress > 0.4 ? 'sizzling' : 'raw';
    } else if (patty.burnProgress < 1) {
      patty.burnProgress += 0.08 * dt;
      if (patty.burnProgress > 0.85) {
        patty.state = 'burnt';
      } else if (patty.burnProgress > 0.4) {
        patty.state = 'cooked';
      }
    } else {
      patty.state = 'fire';
    }
  }
}

/**
 * Compute the distance from passenger door to the pickup window sill
 */
export function computeWindowReachGap(car: SedanState): {
  gapDistance: number;
  isShortStop: boolean;
  canReach: boolean;
} {
  // Passenger window is on the right side (+X in local car space)
  const windowWorldX = car.x + Math.cos(car.yaw) * 0.95;
  const windowWorldZ = car.z + Math.sin(car.yaw) * 0.95;

  const dx = WINDOW_SILL_POS.x - windowWorldX;
  const dz = WINDOW_SILL_POS.z - windowWorldZ;
  const gapDistance = Math.hypot(dx, dz);

  // Ideal parking is within 0.8m of sill.
  // 0.8m to 2.2m is "Short Stop" requiring ragdoll reach!
  // > 2.2m is too far!
  const isShortStop = gapDistance > 0.75 && gapDistance <= 2.2;
  const canReach = gapDistance <= 2.2;

  return { gapDistance, isShortStop, canReach };
}
