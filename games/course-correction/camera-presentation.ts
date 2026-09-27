import { clamp } from '../../shared/math/clamp';
import { cupPosition } from './courses';
import type { CourseWorld, Vec2 } from './types';

export type CourseCameraMode = 'aim' | 'follow' | 'celebrate';

export type CourseCameraPose = {
  mode: CourseCameraMode;
  position: { x: number; y: number; z: number };
  look: { x: number; y: number; z: number };
};

const CELEBRATION_MS = 1_650;

function average(points: readonly Vec2[], fallback: Vec2): Vec2 {
  if (!points.length) return fallback;
  let x = 0;
  let z = 0;
  for (const point of points) {
    x += point.x;
    z += point.z;
  }
  return { x: x / points.length, z: z / points.length };
}

export function cameraMode(
  world: CourseWorld,
  aiming: boolean,
  reducedMotion: boolean,
): CourseCameraMode {
  if (aiming || reducedMotion) return 'aim';
  const event = [...world.events]
    .reverse()
    .find((candidate) =>
      ['cup', 'multi-cup', 'match'].includes(candidate.kind),
    );
  if (event && world.clock - event.at <= CELEBRATION_MS) return 'celebrate';
  if (world.balls.some((ball) => ball.moving && !ball.holed)) return 'follow';
  return 'aim';
}

export function courseCameraPose(
  world: CourseWorld,
  portrait: boolean,
  aiming = false,
  reducedMotion = false,
): CourseCameraPose {
  const mode = cameraMode(world, aiming, reducedMotion);
  const length = world.course.length;
  const baseLook = { x: 0, y: 0.22, z: length * 0.48 };
  const basePosition = portrait
    ? { x: 8.4, y: 18.4, z: -11.8 }
    : { x: 10.6, y: 14.25, z: -10.35 };

  if (mode === 'celebrate') {
    const cup = cupPosition(world.course);
    return {
      mode,
      position: {
        x: basePosition.x + clamp(cup.x, -2, 2) * 0.22,
        y: basePosition.y - (portrait ? 0.35 : 0.7),
        z: basePosition.z + (portrait ? 1.5 : 2.25),
      },
      look: {
        x: clamp(cup.x, -2.4, 2.4) * 0.45,
        y: 0.35,
        z: clamp(cup.z - 1.3, length * 0.5, length - 1.2),
      },
    };
  }

  if (mode === 'follow') {
    const moving = world.balls.filter((ball) => ball.moving && !ball.holed);
    const focus = average(moving, baseLook);
    const z = clamp(focus.z, length * 0.22, length * 0.78);
    const progress = (z - baseLook.z) / length;
    return {
      mode,
      position: {
        x: basePosition.x + clamp(focus.x, -2.2, 2.2) * 0.12,
        y: basePosition.y,
        z: basePosition.z + progress * (portrait ? 1.3 : 1.8),
      },
      look: {
        x: clamp(focus.x, -2.2, 2.2) * 0.28,
        y: 0.24,
        z: baseLook.z + (z - baseLook.z) * 0.42,
      },
    };
  }

  return { mode, position: basePosition, look: baseLook };
}
