import { clamp } from '../math/clamp';

export type SpringState = { value: number; velocity: number };

export function finite(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function boundedImpulse(
  velocity: number,
  impulse: number,
  limit: number,
) {
  return clamp(
    finite(velocity) + finite(impulse),
    -Math.abs(limit),
    Math.abs(limit),
  );
}

export function dampedSpring(
  state: SpringState,
  dt: number,
  options: {
    target?: number;
    stiffness: number;
    damping: number;
    min: number;
    max: number;
    velocityLimit?: number;
  },
): SpringState {
  const step = clamp(finite(dt), 0, 0.1);
  const target = finite(options.target);
  let velocity = finite(state.velocity);
  let value = finite(state.value, target);
  velocity +=
    ((target - value) * Math.max(0, options.stiffness) -
      velocity * Math.max(0, options.damping)) *
    step;
  velocity = clamp(
    velocity,
    -(options.velocityLimit ?? 100),
    options.velocityLimit ?? 100,
  );
  value += velocity * step;
  if (value <= options.min || value >= options.max) {
    value = clamp(value, options.min, options.max);
    if (
      (value === options.min && velocity < 0) ||
      (value === options.max && velocity > 0)
    )
      velocity *= -0.18;
  }
  return { value, velocity };
}

export function stableRest(
  linearSpeed: number,
  angularSpeed = 0,
  threshold = 0.08,
) {
  return (
    Number.isFinite(linearSpeed) &&
    Number.isFinite(angularSpeed) &&
    Math.abs(linearSpeed) <= threshold &&
    Math.abs(angularSpeed) <= threshold
  );
}
