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

/** Shared body dimensions in metres; yaw is clockwise from forward (-Z). */
export const CAR = {
  halfWidth: 1.1,
  halfLength: 2.45,
  wheelbase: 2.9,
  wheelRadius: 0.43,
};
export function carPoint(car: SedanState, x: number, z: number) {
  return {
    x: car.x + Math.cos(car.yaw) * x - Math.sin(car.yaw) * z,
    z: car.z + Math.sin(car.yaw) * x + Math.cos(car.yaw) * z,
  };
}
export function poleClearance(car: SedanState): number {
  const dx = SPEAKER_POLE_POS.x - car.x,
    dz = SPEAKER_POLE_POS.z - car.z;
  const x = Math.cos(car.yaw) * dx + Math.sin(car.yaw) * dz;
  const z = -Math.sin(car.yaw) * dx + Math.cos(car.yaw) * dz;
  return (
    Math.hypot(
      Math.max(0, Math.abs(x) - CAR.halfWidth),
      Math.max(0, Math.abs(z) - CAR.halfLength),
    ) - SPEAKER_POLE_RADIUS
  );
}
export function stepCarPhysics(
  car: SedanState,
  throttle: boolean,
  reverse: boolean,
  steerInput: number,
  dt: number,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const steps = Math.ceil(Math.min(dt, 1) * 120),
    h = Math.min(dt, 1) / steps;
  for (let i = 0; i < steps; i++) {
    const direction = Number(throttle) - Number(reverse);
    const braking =
      direction !== 0 &&
      Math.sign(car.speed) !== direction &&
      Math.abs(car.speed) > 0.01;
    if (braking || (throttle && reverse))
      car.speed =
        Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - 11 * h);
    else if (direction)
      car.speed = Math.max(-3.2, Math.min(7, car.speed + direction * 4.8 * h));
    else
      car.speed =
        Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - 3.2 * h);
    const targetSteer = Math.max(-1, Math.min(1, steerInput)) * 0.6;
    car.steer += (targetSteer - car.steer) * (1 - Math.exp(-9 * h));
    car.yaw += ((Math.tan(car.steer) * car.speed) / CAR.wheelbase) * h;
    car.x += Math.sin(car.yaw) * car.speed * h;
    car.z -= Math.cos(car.yaw) * car.speed * h;
    // Circle against the oriented body rectangle.
    const c = Math.cos(car.yaw),
      s = Math.sin(car.yaw);
    const dx = SPEAKER_POLE_POS.x - car.x,
      dz = SPEAKER_POLE_POS.z - car.z;
    const px = c * dx + s * dz,
      pz = -s * dx + c * dz;
    const qx = Math.max(-CAR.halfWidth, Math.min(CAR.halfWidth, px));
    const qz = Math.max(-CAR.halfLength, Math.min(CAR.halfLength, pz));
    let nx = px - qx,
      nz = pz - qz;
    const distance = Math.hypot(nx, nz);
    if (distance < SPEAKER_POLE_RADIUS) {
      let overlap = SPEAKER_POLE_RADIUS - distance;
      if (distance > 1e-6) {
        nx /= distance;
        nz /= distance;
      } else if (CAR.halfWidth - Math.abs(px) < CAR.halfLength - Math.abs(pz)) {
        nx = Math.sign(px) || 1;
        nz = 0;
        overlap += CAR.halfWidth - Math.abs(px);
      } else {
        nx = 0;
        nz = Math.sign(pz) || 1;
        overlap += CAR.halfLength - Math.abs(pz);
      }
      car.x -= (c * nx - s * nz) * (overlap + 0.001);
      car.z -= (s * nx + c * nz) * (overlap + 0.001);
      if (car.speed < -1) car.reversedIntoPole = true;
      if (Math.abs(car.speed) > 0.8)
        car.bumperDamage = Math.min(100, car.bumperDamage + 10);
      car.speed = 0;
    }
    const extentX = Math.abs(c) * CAR.halfWidth + Math.abs(s) * CAR.halfLength;
    const extentZ = Math.abs(s) * CAR.halfWidth + Math.abs(c) * CAR.halfLength;
    const x = Math.max(-8 + extentX, Math.min(CURB_X - extentX, car.x));
    const z = Math.max(-12 + extentZ, Math.min(24 - extentZ, car.z));
    if (x !== car.x || z !== car.z) car.speed *= Math.exp(-14 * h);
    car.x = x;
    car.z = z;
  }
  if (car.wipersActive)
    car.windshieldSplat = Math.max(0, car.windshieldSplat - 0.45 * dt);
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
      } else {
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
  const { x: windowWorldX, z: windowWorldZ } = carPoint(car, 1.05, -0.2);

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
