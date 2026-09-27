export type MotionSample = {
  x: number;
  z: number;
  at: number;
  speed: number;
  phase: number;
};

export function sampleMotion(
  previous: MotionSample | undefined,
  x: number,
  z: number,
  at: number,
): MotionSample {
  if (!previous) return { x, z, at, speed: 0, phase: 0 };
  const dt = Math.max(1 / 120, Math.min(0.25, (at - previous.at) / 1000));
  const distance = Math.hypot(x - previous.x, z - previous.z);
  const measured = distance < 0.002 ? 0 : Math.min(8, distance / dt);
  const blend = 1 - Math.exp(-dt * (measured > previous.speed ? 14 : 8));
  const speed = previous.speed + (measured - previous.speed) * blend;
  return {
    x,
    z,
    at,
    speed: speed < 0.035 ? 0 : speed,
    phase: previous.phase + dt * (0.65 + speed * 0.16),
  };
}

export function interpolateAngle(from: number, to: number, amount: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * Math.max(0, Math.min(1, amount));
}
