/** Shared keyboard/touch/network unit-disk mapping, with an optional stick deadzone. */
export function movement(x: number, z: number, deadzone = 0) {
  x = Number.isFinite(x) ? x : 0;
  z = Number.isFinite(z) ? z : 0;
  const length = Math.hypot(x, z);
  if (length <= deadzone) return { x: 0, z: 0 };
  const magnitude = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: (x / length) * magnitude, z: (z / length) * magnitude };
}

export function cameraTarget(
  player: { x: number; z: number } | undefined,
  ball: { x: number; z: number },
  aspect: number,
) {
  const clamp = (v: number, limit: number) =>
    Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : 0;
  const px = clamp(player?.x ?? ball.x, 16),
    pz = clamp(player?.z ?? ball.z, 29);
  const bx = clamp(ball.x, 16),
    bz = clamp(ball.z, 29);
  const x = clamp((px + bx) / 2, 10),
    z = clamp((pz + bz) / 2, 20);
  const height = Math.min(
    65,
    Math.max(
      26,
      (Math.abs(px - bx) + 9) /
        (2 * Math.tan(Math.PI / 8) * Math.max(0.4, aspect)),
    ),
  );
  return { x, z, height };
}
