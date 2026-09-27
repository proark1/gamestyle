import { clamp } from '../../shared/math/clamp';
import {
  boundedImpulse,
  dampedSpring,
  stableRest,
} from '../../shared/physics/damped-motion';
import { cupPosition } from './courses';
import {
  BALL_RADIUS,
  MAX_SPEED,
  type CourseEventKind,
  type CourseWorld,
  type GolfBall,
  type PivotWall,
} from './types';

const FRICTION = 0.72;
const CUP_RADIUS = 0.39;

function event(
  w: CourseWorld,
  kind: CourseEventKind,
  x: number,
  z: number,
  player?: string,
  count?: number,
) {
  w.events.push({
    id: ++w.nextEvent,
    kind,
    at: w.clock,
    x,
    z,
    ...(player ? { player } : {}),
    ...(count === undefined ? {} : { count }),
  });
  if (w.events.length > 40) w.events.shift();
}

function speed(ball: GolfBall) {
  return Math.hypot(ball.vx, ball.vz);
}

function cap(ball: GolfBall) {
  const magnitude = speed(ball);
  if (magnitude > MAX_SPEED) {
    ball.vx = (ball.vx / magnitude) * MAX_SPEED;
    ball.vz = (ball.vz / magnitude) * MAX_SPEED;
  }
}

function wallCollision(w: CourseWorld, ball: GolfBall, wall: PivotWall) {
  const cos = Math.cos(wall.angle);
  const sin = Math.sin(wall.angle);
  const dx = ball.x - wall.x;
  const dz = ball.z - wall.z;
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;
  const halfW = wall.width / 2;
  const halfD = wall.depth / 2;
  const nearestX = clamp(localX, -halfW, halfW);
  const nearestZ = clamp(localZ, -halfD, halfD);
  const sepX = localX - nearestX;
  const sepZ = localZ - nearestZ;
  const distance = Math.hypot(sepX, sepZ);
  if (distance >= ball.radius) return;
  const nx = distance > 0.0001 ? sepX / distance : 0;
  const nz = distance > 0.0001 ? sepZ / distance : localZ >= 0 ? 1 : -1;
  const worldNx = nx * cos - nz * sin;
  const worldNz = nx * sin + nz * cos;
  const overlap = ball.radius - distance + 0.002;
  ball.x += worldNx * overlap;
  ball.z += worldNz * overlap;
  const alongNormal = ball.vx * worldNx + ball.vz * worldNz;
  if (alongNormal < 0) {
    const impulse = -(1.72 * alongNormal);
    ball.vx += worldNx * impulse;
    ball.vz += worldNz * impulse;
    const torque = (localX / halfW) * Math.min(8, Math.abs(alongNormal)) * 0.22;
    wall.velocity = boundedImpulse(wall.velocity, torque, 3.8);
    event(w, 'wall', wall.x, wall.z, ball.owner);
  }
}

function obstacleCollisions(w: CourseWorld, ball: GolfBall) {
  for (const obstacle of w.course.obstacles) {
    const dx = ball.x - obstacle.x;
    const dz = ball.z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    const minimum = ball.radius + obstacle.radius;
    if (distance >= minimum) continue;
    const nx = distance > 0.0001 ? dx / distance : 1;
    const nz = distance > 0.0001 ? dz / distance : 0;
    ball.x += nx * (minimum - distance + 0.002);
    ball.z += nz * (minimum - distance + 0.002);
    const alongNormal = ball.vx * nx + ball.vz * nz;
    if (alongNormal >= 0) continue;
    ball.vx -= 1.72 * alongNormal * nx;
    ball.vz -= 1.72 * alongNormal * nz;
    event(w, 'impact', obstacle.x, obstacle.z, ball.owner);
  }
}

function ballCollisions(w: CourseWorld) {
  for (let i = 0; i < w.balls.length; i++) {
    const a = w.balls[i];
    if (a.holed) continue;
    for (let j = i + 1; j < w.balls.length; j++) {
      const b = w.balls[j];
      if (b.holed) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distance = Math.hypot(dx, dz);
      const minimum = a.radius + b.radius;
      if (distance >= minimum) continue;
      const nx = dx / (distance || 1);
      const nz = dz / (distance || 1);
      const overlap = minimum - distance + 0.001;
      a.x -= nx * overlap * 0.5;
      a.z -= nz * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.z += nz * overlap * 0.5;
      const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (relative >= 0) continue;
      const aIncoming = speed(a);
      const bIncoming = speed(b);
      const impulse = (-1.82 * relative) / 2;
      a.vx -= impulse * nx;
      a.vz -= impulse * nz;
      b.vx += impulse * nx;
      b.vz += impulse * nz;
      if (aIncoming > 0.45) {
        b.lastTouch = a.owner;
        b.lastTouchAt = w.clock;
      }
      if (bIncoming > 0.45) {
        a.lastTouch = b.owner;
        a.lastTouchAt = w.clock;
      }
      a.moving = b.moving = true;
      event(w, 'impact', (a.x + b.x) / 2, (a.z + b.z) / 2);
    }
  }
}

function mutateCourse(w: CourseWorld, ball: GolfBall, dt: number) {
  const bridge = w.course.bridge;
  if (bridge) {
    const inside =
      Math.abs(ball.x - bridge.x) < bridge.width / 2 &&
      Math.abs(ball.z - bridge.z) < bridge.depth / 2;
    if (inside) {
      ball.vx += Math.sin(bridge.angle) * 3.2 * dt;
      if (speed(ball) > 0.35) {
        const leverage = clamp((ball.x - bridge.x) / (bridge.width / 2), -1, 1);
        bridge.velocity = boundedImpulse(
          bridge.velocity,
          leverage * speed(ball) * dt * 0.95,
          1.8,
        );
      }
    }
  }
  const platform = w.course.platform;
  if (platform) {
    const cx = platform.baseX + platform.offset;
    const distance = Math.hypot(ball.x - cx, ball.z - platform.z);
    if (distance < 1.45 && speed(ball) > 4.7) {
      platform.velocity = boundedImpulse(
        platform.velocity,
        ball.vx * dt * 0.72,
        2.6,
      );
      event(w, 'platform', cx, platform.z, ball.owner);
    }
  }
}

function recover(w: CourseWorld, ball: GolfBall) {
  ball.x = ball.safe.x;
  ball.z = ball.safe.z;
  ball.vx = ball.vz = 0;
  ball.moving = false;
  ball.restFor = 0;
  ball.lastTouch = null;
  const player = w.players.find((p) => p.id === ball.owner);
  if (player) player.holeStrokes++;
  event(w, 'recover', ball.x, ball.z, ball.owner);
}

export function launchBall(
  w: CourseWorld,
  playerId: string,
  angle: number,
  power: number,
) {
  const ball = w.balls.find((candidate) => candidate.owner === playerId);
  const player = w.players.find((candidate) => candidate.id === playerId);
  if (!ball || !player || ball.holed || ball.moving || ball.restFor < 0.18)
    return false;
  const velocity = 3.2 + clamp(power, 0.12, 1) * 9.6;
  ball.vx = Math.sin(angle) * velocity;
  ball.vz = Math.cos(angle) * velocity;
  ball.moving = true;
  ball.restFor = 0;
  ball.lastTouch = playerId;
  ball.lastTouchAt = w.clock;
  player.holeStrokes++;
  player.aim = angle;
  player.power = power;
  event(w, 'shot', ball.x, ball.z, playerId);
  return true;
}

export function stepPhysics(w: CourseWorld, dt: number) {
  for (const wall of w.course.walls) {
    const next = dampedSpring(
      { value: wall.angle, velocity: wall.velocity },
      dt,
      {
        target: (wall.min + wall.max) / 2,
        stiffness: 0.8,
        damping: 1.15,
        min: wall.min,
        max: wall.max,
        velocityLimit: 3.8,
      },
    );
    wall.angle = next.value;
    wall.velocity = next.velocity;
  }
  if (w.course.bridge) {
    const next = dampedSpring(
      { value: w.course.bridge.angle, velocity: w.course.bridge.velocity },
      dt,
      {
        target: 0,
        stiffness: 5.8,
        damping: 1.8,
        min: -0.32,
        max: 0.32,
        velocityLimit: 2,
      },
    );
    w.course.bridge.angle = next.value;
    w.course.bridge.velocity = next.velocity;
  }
  if (w.course.platform) {
    const platform = w.course.platform;
    const next = dampedSpring(
      { value: platform.offset, velocity: platform.velocity },
      dt,
      {
        target: 0,
        stiffness: 0.28,
        damping: 0.72,
        min: platform.min,
        max: platform.max,
        velocityLimit: 2.8,
      },
    );
    platform.offset = next.value;
    platform.velocity = next.velocity;
  }

  for (const ball of w.balls) {
    if (ball.holed) continue;
    if (![ball.x, ball.z, ball.vx, ball.vz].every(Number.isFinite)) {
      recover(w, ball);
      continue;
    }
    mutateCourse(w, ball, dt);
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    const drag = Math.exp(-FRICTION * dt);
    ball.vx *= drag;
    ball.vz *= drag;
    cap(ball);
    const half = w.course.width / 2 - BALL_RADIUS;
    if (ball.x < -half || ball.x > half) {
      ball.x = clamp(ball.x, -half, half);
      ball.vx *= -0.74;
      event(w, 'impact', ball.x, ball.z, ball.owner);
    }
    if (ball.z < 0) {
      ball.z = 0;
      ball.vz = Math.abs(ball.vz) * 0.72;
    }
    for (const wall of w.course.walls) wallCollision(w, ball, wall);
    obstacleCollisions(w, ball);
  }
  ballCollisions(w);

  const cup = cupPosition(w.course);
  let holedThisStep = 0;
  for (const ball of w.balls) {
    if (ball.holed) continue;
    const currentSpeed = speed(ball);
    if (
      Math.hypot(ball.x - cup.x, ball.z - cup.z) < CUP_RADIUS &&
      currentSpeed < 6.5
    ) {
      ball.holed = true;
      ball.moving = false;
      ball.x = cup.x;
      ball.z = cup.z;
      ball.vx = ball.vz = 0;
      const player = w.players.find((p) => p.id === ball.owner);
      if (player) player.finishedAt = w.clock;
      if (
        ball.lastTouch &&
        ball.lastTouch !== ball.owner &&
        w.clock - ball.lastTouchAt < 12_000
      ) {
        const helper = w.players.find((p) => p.id === ball.lastTouch);
        if (helper) helper.assists++;
        event(w, 'assist', cup.x, cup.z, ball.lastTouch);
      }
      event(w, 'cup', cup.x, cup.z, ball.owner);
      holedThisStep++;
      continue;
    }
    if (
      ball.z > w.course.length + 0.9 ||
      Math.abs(ball.x) > w.course.width / 2 + 1.2
    ) {
      recover(w, ball);
      continue;
    }
    if (stableRest(currentSpeed)) {
      ball.vx = ball.vz = 0;
      ball.restFor += dt;
      ball.moving = false;
      if (ball.restFor > 0.7) ball.safe = { x: ball.x, z: ball.z };
    } else {
      ball.restFor = 0;
      ball.moving = true;
    }
  }
  if (holedThisStep >= 3)
    event(w, 'multi-cup', cup.x, cup.z, undefined, holedThisStep);
}
