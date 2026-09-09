import { ESCAPE, type GiantWorld, type Vec } from './types';

export const SIT_PIVOT: Vec = { x: 2, y: 2.9, z: 2.6 };
export const THIGH = 2.45;
export const SHIN = 2.35;
export const UPPER_ARM = 3.15;
export const FOREARM = 2.85;
const ease = (t: number) => {
  const n = Math.max(0, Math.min(1, t));
  return n * n * n * (n * (n * 6 - 15) + 10);
};
const blend = (a: number, b: number, t: number) => a + (b - a) * t;
const add = (a: Vec, b: Vec): Vec => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});
const sub = (a: Vec, b: Vec): Vec => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const mul = (v: Vec, s: number): Vec => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
});
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v: Vec) => Math.hypot(v.x, v.y, v.z);
const lerp = (a: Vec, b: Vec, t: number) => add(a, mul(sub(b, a), t));

/** Absolute shared-clock choreography: curl up, tuck feet, load, push, settle. */
export function wakePose(w: GiantWorld, clock = w.clock) {
  const elapsed =
    w.escapeAt > 0 ? Math.max(0, clock - (w.escapeAt - ESCAPE)) : 0;
  const rise = w.escapeAt > 0 ? ease((elapsed - 160) / 1940) : 0;
  const stand = w.escapeAt > 0 ? ease((elapsed - 2600) / 2400) : 0;
  const load =
    ease((elapsed - 1900) / 700) * (1 - ease((elapsed - 2900) / 1400));
  const settle =
    Math.sin((elapsed - 4300) / 420) *
    ease((elapsed - 4300) / 700) *
    (1 - ease((elapsed - 5000) / 900));
  return {
    elapsed,
    rise,
    stand,
    lift: stand * 2.8 - load * 0.12 + settle * 0.035,
    shift: rise * 0.35 + stand * 1.05 + load * 0.3,
    angle: rise * 1.22 + stand * 0.33 + load * 0.22,
  };
}

export function bodyPoint(p: Vec, angle: number, lift = 0, shift = 0): Vec {
  const y = p.y - SIT_PIVOT.y,
    z = p.z - SIT_PIVOT.z;
  return {
    x: p.x,
    y: SIT_PIVOT.y + y * Math.cos(angle) - z * Math.sin(angle) + lift,
    z: SIT_PIVOT.z + y * Math.sin(angle) + z * Math.cos(angle) + shift,
  };
}

/** Two fixed-length bones, bending toward an anatomical pole rather than stretching. */
export function solveJoint(
  root: Vec,
  target: Vec,
  upper: number,
  lower: number,
  pole: Vec,
) {
  const offset = sub(target, root),
    raw = length(offset);
  const direction = raw > 1e-8 ? mul(offset, 1 / raw) : { x: 0, y: -1, z: 0 };
  const distance = Math.max(
    Math.abs(upper - lower) + 0.0001,
    Math.min(upper + lower - 0.0001, raw),
  );
  const along =
    (upper * upper - lower * lower + distance * distance) / (2 * distance);
  let bend = sub(pole, mul(direction, dot(pole, direction)));
  if (length(bend) < 1e-6) {
    const fallback =
      Math.abs(direction.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
    bend = sub(fallback, mul(direction, dot(fallback, direction)));
  }
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return {
    joint: add(
      add(root, mul(direction, along)),
      mul(bend, height / length(bend)),
    ),
    end: add(root, mul(direction, distance)),
  };
}

export function giantJoints(w: GiantWorld, armZ: number, clock = w.clock) {
  const wake = wakePose(w, clock);
  const transform = (p: Vec) => bodyPoint(p, wake.angle, wake.lift, wake.shift);
  const breath = w.escapeAt ? 0 : Math.sin((clock - w.started) / 900) * 0.035;
  const reach = ease((wake.elapsed - 4400) / 1700);
  const target = w.players
    .filter((p) => !p.escaped && !p.caught)
    .reduce<Vec | undefined>(
      (nearest, p) =>
        !nearest ||
        Math.hypot(p.x - 2, p.z - 4) < Math.hypot(nearest.x - 2, nearest.z - 4)
          ? p
          : nearest,
      undefined,
    );
  const look = target ? Math.max(-0.3, Math.min(0.3, (target.x - 2) / 16)) : 0;
  const legs = ([-1, 1] as const).map((side) => {
    const plant = ease((wake.elapsed - (side < 0 ? 1000 : 1230)) / 1300);
    const hip = transform({ x: 2 + side * 1.18, y: 3.3, z: 0.65 });
    const ankle = {
      x: 2 + side * blend(1.24, 1.38, plant),
      y: blend(3.36, 2.98, plant) + Math.sin(plant * Math.PI) * 0.55,
      z: blend(5.35, side < 0 ? 4.5 : 4.72, plant),
    };
    const solved = solveJoint(hip, ankle, THIGH, SHIN, {
      x: side * 0.12,
      y: 1 - wake.rise,
      z: wake.rise,
    });
    return {
      side,
      hip,
      knee: solved.joint,
      ankle: solved.end,
      footPitch: blend(-1.32, 0, plant) - Math.sin(plant * Math.PI) * 0.22,
      footYaw: side * blend(0.035, 0.09, plant),
      planted: plant === 1,
    };
  });
  const arms = ([-1, 1] as const).map((side) => {
    const shoulder = transform({
      x: 2 + side * 2.32,
      y: 3.82 + breath,
      z: -3.3,
    });
    const rest = {
      x: side < 0 ? -4.65 : 5.8,
      y: 3.32 + breath,
      z: side < 0 ? armZ : 2.25,
    };
    const brace = { x: 2 + side * 3.4, y: 3.16, z: 2.85 };
    const support = ease((wake.elapsed - 200) / 1250);
    const release = ease((wake.elapsed - (side < 0 ? 2750 : 3000)) / 1400);
    const hang = {
      x: shoulder.x + side * 0.8,
      y: shoulder.y - 5.3,
      z: shoulder.z + 0.65,
    };
    const gesture = Math.sin((wake.elapsed - 4400) / 1450) * 0.18;
    const reaching = {
      x: shoulder.x + side * 0.45 + look * 3,
      y: shoulder.y - 3.8 + gesture,
      z: shoulder.z + 3.6 + gesture,
    };
    const free = lerp(hang, reaching, reach * (side > 0 ? 0.85 : 0.25));
    const wristTarget = lerp(lerp(rest, brace, support), free, release);
    const elbowPole = { x: side * 0.9, y: -0.25, z: -0.55 };
    const solved = solveJoint(
      shoulder,
      wristTarget,
      UPPER_ARM,
      FOREARM,
      elbowPole,
    );
    return {
      side,
      shoulder,
      elbow: solved.joint,
      wrist: solved.end,
      brace: support * (1 - release),
      reach: reach * (side > 0 ? 0.85 : 0.25),
    };
  });
  return { wake, legs, arms, look };
}

export type GiantJoints = ReturnType<typeof giantJoints>;

/** Matches the foot mesh's XYZ Euler rotation, about its ankle. */
export function footPoint(p: Vec, leg: GiantJoints['legs'][number]): Vec {
  const x = p.x * Math.cos(leg.footYaw) + p.z * Math.sin(leg.footYaw);
  const z = -p.x * Math.sin(leg.footYaw) + p.z * Math.cos(leg.footYaw);
  return {
    x: leg.ankle.x + x,
    y:
      leg.ankle.y + p.y * Math.cos(leg.footPitch) - z * Math.sin(leg.footPitch),
    z:
      leg.ankle.z + p.y * Math.sin(leg.footPitch) + z * Math.cos(leg.footPitch),
  };
}
