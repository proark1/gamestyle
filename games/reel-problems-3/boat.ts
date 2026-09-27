import { emit } from './events';
import { updateStream } from './world-stream';
import type { AdventureWorld } from './types';

const MAX_SPEED = 9;
const REVERSE_SPEED = -2.5;
const WORLD_LIMIT = 170;

export function toWorldSpace(
  world: AdventureWorld,
  point: { x: number; z: number },
) {
  const cosine = Math.cos(world.boat.yaw);
  const sine = Math.sin(world.boat.yaw);
  return {
    x: world.boat.x + point.x * cosine + point.z * sine,
    z: world.boat.z - point.x * sine + point.z * cosine,
  };
}

export function toBoatSpace(
  world: AdventureWorld,
  point: { x: number; z: number },
) {
  const dx = point.x - world.boat.x;
  const dz = point.z - world.boat.z;
  const cosine = Math.cos(world.boat.yaw);
  const sine = Math.sin(world.boat.yaw);
  return { x: dx * cosine - dz * sine, z: dx * sine + dz * cosine };
}

function nearestHelmInput(world: AdventureWorld) {
  const helms = world.players.filter((player) => player.station === 'helm');
  return helms.find((player) => !player.bot)?.input ?? helms[0]?.input;
}

export function stepBoat(world: AdventureWorld, dt: number) {
  if (world.boat.docked || world.boat.engine !== 'running') {
    world.boat.speed *= Math.exp(-dt * 3);
    updateStream(world);
    return;
  }
  const input = nearestHelmInput(world);
  const targetThrottle = input?.throttle ?? 0;
  const targetSteer = input?.steer ?? 0;
  world.boat.throttle +=
    (targetThrottle - world.boat.throttle) * Math.min(1, dt * 4);
  world.boat.steer += (targetSteer - world.boat.steer) * Math.min(1, dt * 5);
  const targetSpeed =
    world.boat.throttle >= 0
      ? world.boat.throttle * MAX_SPEED
      : -world.boat.throttle * REVERSE_SPEED;
  world.boat.speed += (targetSpeed - world.boat.speed) * Math.min(1, dt * 1.5);
  world.boat.yaw += world.boat.steer * world.boat.speed * dt * 0.045;
  world.boat.x += Math.sin(world.boat.yaw) * world.boat.speed * dt;
  world.boat.z += Math.cos(world.boat.yaw) * world.boat.speed * dt;
  world.boat.roll +=
    (-world.boat.steer *
      Math.min(1, Math.abs(world.boat.speed) / MAX_SPEED) *
      0.13 -
      world.boat.roll) *
    Math.min(1, dt * 2.2);
  world.boat.pitch = Math.sin(world.clock / 850) * 0.025;
  const distance = Math.hypot(world.boat.x, world.boat.z);
  if (distance > WORLD_LIMIT) {
    const scale = WORLD_LIMIT / distance;
    world.boat.x *= scale;
    world.boat.z *= scale;
    world.boat.speed *= -0.25;
    world.boat.hull = Math.max(0, world.boat.hull - 4);
    emit(
      world,
      'damage',
      undefined,
      'The current shoved the boat back toward shore.',
    );
  }
  for (const cell of world.cells) {
    if (cell.kind !== 'rocks') continue;
    const rockX = (cell.x + 0.5) * 48;
    const rockZ = (cell.z + 0.5) * 48;
    const gap = Math.hypot(world.boat.x - rockX, world.boat.z - rockZ);
    if (gap < 5.5 && Math.abs(world.boat.speed) > 1.4) {
      const damage = Math.min(14, Math.abs(world.boat.speed) * 1.4);
      world.boat.hull = Math.max(0, world.boat.hull - damage);
      for (const player of world.players)
        if (player.station === 'helm') player.stats.collisionDamage += damage;
      world.boat.speed *= -0.3;
      emit(world, 'damage', undefined, 'Rock strike');
    }
  }
  updateStream(world);
}

export function nearHarbor(world: AdventureWorld, radius = 10) {
  return Math.hypot(world.boat.x, world.boat.z) <= radius;
}
