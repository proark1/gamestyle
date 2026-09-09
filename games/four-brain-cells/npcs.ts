import { cupPosition, handPosition, platePosition } from './geometry';
import {
  BREWER,
  STOVE,
  idleInput,
  type BrainControlAction,
  type BrainPlayer,
  type BrainWorld,
  type Utensil,
  type Vec,
} from './types';

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const distance = (a: Vec, b: Vec) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finished = (w: BrainWorld, u: Utensil) =>
  u.id === 'pan' ? w.pancakes >= 3 : w.coffee >= 0.98;

function utensilFor(w: BrainWorld, p: BrainPlayer) {
  const held = w.utensils.find((u) => u.held === p.limb);
  if (held) return held;
  const available = w.utensils.filter(
    (u) => u.held === null && !finished(w, u),
  );
  return (
    available.find((u) => u.id === (p.limb === 0 ? 'pan' : 'jug')) ??
    available[0]
  );
}

function handTarget(w: BrainWorld, u: Utensil): Vec {
  if (u.held === null) return u;
  return u.id === 'pan'
    ? u.ready
      ? platePosition(w)
      : STOVE
    : u.fill < 0.01
      ? BREWER
      : { ...cupPosition(w), y: 2.25 };
}

/** A destination for feet, leaving room around the table and within arm reach. */
function walkingTarget(w: BrainWorld) {
  const hands = w.players.filter((p) => p.limb < 2);
  // Let a human hand finish its job before taking the robot away to help a bot.
  const humanJob = hands
    .filter((p) => !p.bot)
    .map((p) => utensilFor(w, p))
    .find((u) => u && !finished(w, u));
  const jobs = hands
    .map((p) => utensilFor(w, p))
    .filter((u): u is Utensil => !!u && !finished(w, u));
  const job = humanJob ?? jobs.find((u) => u.id === 'pan') ?? jobs[0];
  if (!job) return null;
  const target = handTarget(w, job);
  if (job.held !== null && job.id === 'pan' && job.ready)
    return { x: w.table.x - 2.25, z: w.table.z };
  if (job.held !== null && job.id === 'jug' && job.fill >= 0.01)
    return { x: w.table.x - 1.65, z: w.table.z + 1.55 };
  return { x: Math.max(-3.5, Math.min(6, target.x + 1.9)), z: target.z };
}

/** Bots submit ordinary limb inputs and grab actions; food and physics stay in the simulation. */
export function tickBreakfastNpcs(
  w: BrainWorld,
  act: (id: string, action: BrainControlAction) => void,
) {
  const bots = w.players.filter((p) => p.bot);
  if (!bots.length) return;
  for (const p of bots) p.input = idleInput();
  if (w.phase !== 'playing' || w.robot.fallenUntil > w.clock) return;
  const humanFoot = w.players.find((p) => !p.bot && p.limb > 1);
  const destination = humanFoot ? null : walkingTarget(w);
  for (const p of bots) {
    p.seen = w.clock;
    if (p.limb > 1) {
      if (humanFoot) {
        p.input = {
          ...idleInput(),
          x: humanFoot.input.x,
          z: humanFoot.input.z,
          steady: humanFoot.input.steady,
        };
      } else if (destination) {
        const dx = destination.x - w.robot.x,
          dz = destination.z - w.robot.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.2)
          p.input = {
            ...idleInput(),
            x: dx / Math.max(1, d),
            z: dz / Math.max(1, d),
            steady: d < 1 || w.utensils.some((u) => u.held !== null && u.ready),
          };
      }
      continue;
    }
    const u = utensilFor(w, p);
    if (!u || finished(w, u)) continue;
    const h = handPosition(w, p.limb),
      target = handTarget(w, u);
    p.input = {
      ...idleInput(),
      x: clamp((target.x - h.x) * 3),
      z: clamp((target.z - h.z) * 3),
      lift: clamp((target.y - h.y) * 3),
      steady: true,
    };
    if (u.held === null) {
      if (distance(h, u) < 0.9 && w.clock - (p.npcActionAt ?? 0) > 450) {
        p.npcActionAt = w.clock;
        act(p.id, { type: 'grab' });
      }
    } else {
      // Never pour on the journey, and never use a pan outside its current station.
      p.input.use =
        distance(h, target) < (u.id === 'jug' && u.fill >= 0.01 ? 0.65 : 1);
    }
  }
}
