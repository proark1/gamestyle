import {
  changeNpcSlots,
  isNpcAction,
  type NpcSlot,
} from '../../shared/rooms/npc-slots';
import { cupPosition, handPosition, platePosition } from './geometry';
import { tickBreakfastNpcs } from './npcs';
export { cupPosition, handPosition, platePosition } from './geometry';
import {
  BREWER,
  FAN,
  LIMBS,
  ROUND_MS,
  STOVE,
  idleInput,
  type BrainAction,
  type BrainControlAction,
  type BrainEvent,
  type BrainPlayer,
  type BrainWorld,
  type Utensil,
  type Vec,
} from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const distance = (a: Vec, b: Vec) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
const utensil = (id: 'pan' | 'jug'): Utensil => ({
  id,
  ...(id === 'pan' ? STOVE : BREWER),
  held: null,
  vx: 0,
  vy: 0,
  vz: 0,
  floorAt: 0,
  fill: id === 'jug' ? 1 : 0,
  cook: 0,
  flipped: false,
  ready: false,
});
export function freshBreakfast(now: number): BrainWorld {
  return {
    clock: now,
    started: 0,
    remainder: 0,
    phase: 'lobby',
    players: [],
    limbs: Array.from({ length: 4 }, (_, i) => ({
      x: i % 2 ? 1 : -1,
      y: i < 2 ? 2 : 0.3,
      z: i < 2 ? -0.2 : 0.35,
      owner: null,
      held: null,
      stepAt: 0,
      useAt: 0,
      kickAt: 0,
    })),
    robot: {
      x: -2.6,
      z: 0,
      vx: 0,
      vz: 0,
      lean: 0,
      wobble: 0,
      fallenUntil: 0,
      lastLeg: -1,
      stepAt: 0,
    },
    table: { x: 4, z: 0.5, vx: 0, vz: 0, jolt: 0 },
    utensils: [utensil('pan'), utensil('jug')],
    spills: [],
    pancakes: 0,
    coffee: 0,
    falls: 0,
    events: [],
    eventId: 0,
  };
}
export function newBrain(
  id: string,
  name: string,
  color: number,
  now: number,
): BrainPlayer {
  return {
    id,
    name,
    color,
    limb: -1,
    seen: now,
    input: idleInput(),
    mishaps: 0,
    steps: 0,
    served: 0,
  };
}
export function addBrain(
  w: BrainWorld,
  id: string,
  name: string,
  color: number,
) {
  const p = newBrain(id, name, color, w.clock);
  const slot =
    w.limbs[color] && !w.limbs[color].owner
      ? color
      : w.limbs.findIndex((l) => !l.owner);
  if (slot < 0) throw new Error('All four brain cells are occupied.');
  p.limb = slot;
  w.limbs[slot].owner = id;
  w.players.push(p);
}
export function removeBrain(w: BrainWorld, id: string) {
  // Hands keep their grip if a player disconnects; another player can take over.
  for (const l of w.limbs) if (l.owner === id) l.owner = null;
  w.players = w.players.filter((p) => p.id !== id);
}
export function reconcileBreakfastNpcs(w: BrainWorld, slots: NpcSlot[]) {
  for (const p of w.players)
    if (p.bot && !slots.some((s) => s.id === p.id)) removeBrain(w, p.id);
  for (const slot of slots) {
    const existing = w.players.find((p) => p.id === slot.id);
    if (existing) continue;
    addBrain(w, slot.id, slot.name, slot.color);
    w.players.find((p) => p.id === slot.id)!.bot = true;
  }
}
function event(
  w: BrainWorld,
  kind: BrainEvent['kind'],
  text: string,
  limb: number | null = null,
) {
  w.events.push({ id: ++w.eventId, at: w.clock, kind, text, limb });
  if (w.events.length > 12) w.events.shift();
}
function who(w: BrainWorld, limb: number) {
  const p = w.players.find((p) => p.id === w.limbs[limb].owner);
  return `${p?.name ?? 'The robot'} (${LIMBS[limb].name.toLowerCase()})`;
}
function spill(
  w: BrainWorld,
  limb: number,
  text: string,
  kind: BrainEvent['kind'] = 'spill',
) {
  const pos = handPosition(w, limb);
  w.spills.push({
    x: pos.x,
    z: pos.z,
    at: w.clock,
    color: limb < 2 && w.limbs[limb].held === 'jug' ? '#815737' : '#dba34c',
  });
  w.spills = w.spills.slice(-16);
  const p = w.players.find((p) => p.id === w.limbs[limb].owner);
  if (p) p.mishaps++;
  event(w, kind, `${who(w, limb)} ${text}`, limb);
}
function empty(u: Utensil) {
  u.fill = 0;
  u.cook = 0;
  u.flipped = false;
  u.ready = false;
}
function drop(w: BrainWorld, i: number, toss = false) {
  const l = w.limbs[i],
    u = w.utensils.find((u) => u.id === l.held);
  if (!u) return;
  Object.assign(u, handPosition(w, i));
  u.held = null;
  l.held = null;
  u.vx = w.robot.vx + (toss ? (i ? 5 : -5) : 0);
  u.vz = w.robot.vz;
  u.vy = toss ? 5 : 0;
}
function operateUtensil(w: BrainWorld, p: BrainPlayer, held: boolean, dt = 0) {
  const i = p.limb,
    l = w.limbs[i];
  if (i > 1) return;
  const u = w.utensils.find((u) => u.id === l.held);
  if (!u) {
    if (!held)
      throw new Error('Reach for the pan or coffee pot, then press E to grab.');
    return;
  }
  const h = handPosition(w, i);
  if (u.id === 'jug') {
    if (distance(h, BREWER) < 1.2) {
      u.fill = 1;
      return;
    }
    const cup = cupPosition(w);
    if (flat(h, cup) < 0.85 && h.y >= 1.7 && h.y <= 3.2) {
      const amount = Math.min(u.fill, held ? dt * 0.28 : 0.12);
      if (amount <= 0) {
        if (!held) throw new Error('Refill the pot at the coffee machine.');
        return;
      }
      u.fill -= amount;
      w.coffee = Math.min(1, w.coffee + amount);
      if (w.clock - l.useAt > 1000) {
        event(
          w,
          'pour',
          `${who(w, i)} is actually pouring coffee. Hold steady!`,
          i,
        );
        l.useAt = w.clock;
      }
    } else if (held && u.fill > 0) {
      u.fill = Math.max(0, u.fill - dt * 0.2);
      if (w.clock - l.useAt > 1500) {
        spill(w, i, 'watered the floor with coffee.');
        l.useAt = w.clock;
      }
    } else if (!held)
      throw new Error(
        'Hold the pot over the cup on the table, or refill at the coffee machine.',
      );
    return;
  }
  if (w.clock - l.useAt < 600) return;
  if (u.ready && distance(h, platePosition(w)) < 1.25) {
    w.pancakes = Math.min(3, w.pancakes + 1);
    p.served++;
    empty(u);
    l.useAt = w.clock;
    event(
      w,
      'serve',
      `${who(w, i)} served a pancake. ${w.pancakes}/3 on the plate!`,
      i,
    );
    return;
  }
  if (distance(h, STOVE) < 1.3) {
    if (!u.fill) {
      u.fill = 1;
      l.useAt = w.clock;
      event(w, 'flip', 'Batter in! Hold the pan over the glowing hob.', i);
    } else if (!u.flipped && u.cook >= 3 && !u.ready) {
      u.flipped = true;
      u.cook = 0;
      l.useAt = w.clock;
      event(w, 'flip', `${who(w, i)} flipped a pancake. A small miracle.`, i);
    }
    return;
  }
  if (!held)
    throw new Error(
      u.ready
        ? 'Bring the pancake to the plate, then press Space to serve.'
        : 'Bring the pan over the glowing hob. Space adds batter or flips it.',
    );
}
export function breakfastAction(
  w: BrainWorld,
  id: string,
  raw: BrainAction,
  host: string,
) {
  const p = w.players.find((p) => p.id === id);
  if (!p) throw new Error('Join the kitchen first.');
  if (isNpcAction(raw)) {
    if (id !== host || p.bot) throw new Error('Only the host can change NPCs.');
    if (w.phase === 'playing')
      throw new Error('Finish this breakfast before changing NPCs.');
    const slots = changeNpcSlots(
      w.players.filter((p) => p.bot),
      w.players.filter((p) => !p.bot),
      raw,
    );
    reconcileBreakfastNpcs(w, slots);
    return;
  }
  const a = raw as BrainControlAction;
  if (a.type === 'start' || a.type === 'restart') {
    if (id !== host) throw new Error('The host starts breakfast.');
    if (a.type === 'start' && w.phase !== 'lobby')
      throw new Error('Breakfast has already started.');
    if (a.type === 'restart' && w.phase === 'playing')
      throw new Error('Finish this breakfast before starting another.');
    const players = w.players.map((p) => ({
      ...p,
      input: idleInput(),
      mishaps: 0,
      steps: 0,
      served: 0,
      npcActionAt: 0,
    }));
    const next = freshBreakfast(w.clock);
    next.players = players;
    for (const p of players) next.limbs[p.limb].owner = p.id;
    Object.assign(w, next, { phase: 'playing', started: w.clock });
    event(
      w,
      'start',
      'Order up: three pancakes and one full cup of coffee. You have six minutes.',
    );
    return;
  }
  if (a.type === 'claim') {
    const n = a.limb;
    if (!Number.isInteger(n) || n! < 0 || n! > 3)
      throw new Error('Choose one of the four limbs.');
    if (w.limbs[n!].owner && w.limbs[n!].owner !== id)
      throw new Error('That limb belongs to a friend. Choose an empty one.');
    w.limbs[p.limb].owner = null;
    w.limbs[n!].owner = id;
    p.limb = n!;
    p.input = idleInput();
    return;
  }
  if (w.phase !== 'playing') throw new Error('Start breakfast first.');
  if (w.robot.fallenUntil > w.clock)
    throw new Error('The robot is getting back up…');
  const i = p.limb,
    l = w.limbs[i];
  if (a.type === 'center') {
    l.x = i % 2 ? 1 : -1;
    l.z = -0.2;
    l.y = i < 2 ? 2 : 0.3;
    return;
  }
  if (a.type === 'grab') {
    if (i > 1)
      throw new Error('Feet do the walking. Switch to a free hand to grab.');
    if (l.held) {
      drop(w, i);
      return;
    }
    const h = handPosition(w, i);
    const u = w.utensils
      .filter((u) => u.held === null && distance(h, u) < 1.2)
      .sort((a, b) => distance(a, h) - distance(b, h))[0];
    if (!u)
      throw new Error(
        'Move your hand closer to the pan or pot. R raises; F lowers.',
      );
    l.held = u.id;
    u.held = i;
    u.floorAt = 0;
    event(
      w,
      'grab',
      `${who(w, i)} grabbed the ${u.id === 'pan' ? 'pan' : 'coffee pot'}.`,
      i,
    );
    return;
  }
  if (a.type === 'use') {
    operateUtensil(w, p, false);
    return;
  }
  if (a.type === 'kick') {
    if (i < 2) throw new Error('Only a foot can kick.');
    if (w.clock - l.kickAt < 650) return;
    l.kickAt = w.clock;
    const dx = w.table.x - w.robot.x,
      dz = w.table.z - w.robot.z,
      d = Math.hypot(dx, dz);
    if (d < 3.2) {
      w.table.vx += (dx / Math.max(0.1, d)) * 5;
      w.table.vz += (dz / Math.max(0.1, d)) * 5;
      w.table.jolt = 1;
      w.coffee = Math.max(0, w.coffee - 0.45);
      spill(
        w,
        i,
        'kicked the breakfast table. The cup was right there.',
        'kick',
      );
    } else event(w, 'kick', `${who(w, i)} kicked absolutely nothing.`, i);
    w.robot.wobble = Math.min(1.1, w.robot.wobble + 0.28);
    return;
  }
  throw new Error('Unknown kitchen action.');
}
function step(w: BrainWorld, dt: number) {
  tickBreakfastNpcs(w, (id, action) => breakfastAction(w, id, action, id));
  const r = w.robot;
  w.table.x = clamp(w.table.x + w.table.vx * dt, 1, 6);
  w.table.z = clamp(w.table.z + w.table.vz * dt, -3.5, 4.3);
  w.table.vx *= Math.exp(-3.3 * dt);
  w.table.vz *= Math.exp(-3.3 * dt);
  w.table.jolt *= Math.exp(-4 * dt);
  if (r.fallenUntil > w.clock) {
    r.vx *= 0.9;
    r.vz *= 0.9;
  }
  let activity = 0;
  for (const p of w.players) {
    if (r.fallenUntil > w.clock) break;
    const l = w.limbs[p.limb],
      i = p.input,
      n = p.limb;
    const len = Math.max(1, Math.hypot(i.x, i.z)),
      x = i.x / len,
      z = i.z / len;
    if (n < 2) {
      const speed = i.steady ? 1.2 : 3;
      l.x = clamp(l.x + x * speed * dt, -3.1, 3.1);
      l.z = clamp(l.z + z * speed * dt, -3.1, 3.1);
      l.y = clamp(l.y + i.lift * 2.1 * dt, 0.3, 5.1);
      const reach = Math.hypot(l.x, l.z);
      if (reach > 3.15) {
        l.x *= 3.15 / reach;
        l.z *= 3.15 / reach;
      }
      if (reach > 2.8 && l.held && Math.hypot(r.vx, r.vz) > 1.2)
        activity += 0.2;
      const h = handPosition(w, n);
      if (h.y > 4.3 && flat(h, FAN) < 1.3 && w.clock - l.kickAt > 2000) {
        l.kickAt = w.clock;
        spill(w, n, 'found the ceiling fan. Breakfast is airborne.', 'fan');
        drop(w, n, true);
        r.wobble += 0.45;
        l.y = 2.8;
      }
      if (i.use) operateUtensil(w, p, true, dt);
    } else if (
      Math.hypot(x, z) > 0.15 &&
      w.clock - l.stepAt >= (i.steady ? 640 : 480)
    ) {
      const other = w.players.find((o) => o.limb === (n === 2 ? 3 : 2));
      const alternating = r.lastLeg !== n;
      // An unoccupied partner foot follows: a smaller crew can still finish breakfast.
      const assisted = !other;
      const conflict = other && other.input.x * x + other.input.z * z < -0.3;
      const impulse = i.steady ? 1.4 : 2.15;
      r.vx += x * impulse;
      r.vz += z * impulse;
      r.wobble += conflict ? 0.18 : assisted || alternating ? -0.12 : 0.14;
      r.lastLeg = n;
      r.stepAt = w.clock;
      l.stepAt = w.clock;
      p.steps++;
      l.x = (n === 2 ? -0.55 : 0.55) + x * 0.65;
      l.z = z * 0.7;
      if (assisted) {
        const partner = w.limbs[n === 2 ? 3 : 2];
        partner.stepAt = w.clock - 220;
        partner.x = (n === 2 ? 0.55 : -0.55) + x * 0.45;
        partner.z = z * 0.5;
      }
      if (w.clock - (w.events.at(-1)?.at ?? 0) > 1800)
        event(
          w,
          'step',
          'Small steps. One functioning adult. You can do this.',
          n,
        );
    }
  }
  r.wobble = clamp(r.wobble + (activity - 0.065) * dt, 0, 1.4);
  r.x = clamp(r.x + r.vx * dt, -4.05, 6.5);
  r.z = clamp(r.z + r.vz * dt, -4.5, 5.3);
  const tableDistance = flat(r, w.table);
  if (tableDistance < 1.8) {
    const dx = (r.x - w.table.x) / Math.max(0.01, tableDistance),
      dz = (r.z - w.table.z) / Math.max(0.01, tableDistance);
    r.x = w.table.x + dx * 1.8;
    r.z = w.table.z + dz * 1.8;
    const impact = Math.max(0, -(r.vx * dx + r.vz * dz));
    w.table.vx -= dx * impact * 0.28;
    w.table.vz -= dz * impact * 0.28;
    r.vx *= 0.4;
    r.vz *= 0.4;
    r.wobble += impact * 0.04;
  }
  const slippery = w.spills.some(
    (s) => flat(r, s) < 0.8 && w.clock - s.at < 18000,
  );
  r.vx *= Math.exp(-(slippery ? 1.2 : 3.5) * dt);
  r.vz *= Math.exp(-(slippery ? 1.2 : 3.5) * dt);
  r.lean +=
    (r.vx * -0.065 + Math.sin(w.clock * 0.009) * r.wobble * 0.28 - r.lean) *
    Math.min(1, dt * 9);
  if (r.wobble > 1) {
    r.fallenUntil = w.clock + 2300;
    r.wobble = 0.25;
    w.falls++;
    for (let n = 0; n < 2; n++) drop(w, n, true);
    event(w, 'fall', 'The adult has stopped functioning. Getting back up…');
  }
  for (const u of w.utensils) {
    if (u.held !== null) {
      Object.assign(u, handPosition(w, u.held));
      if (
        u.fill > 0 &&
        r.wobble > 0.78 &&
        w.clock - w.limbs[u.held].useAt > 1800
      ) {
        spill(
          w,
          u.held,
          u.id === 'pan'
            ? 'lost a pancake to the wobble.'
            : 'spilled the coffee.',
        );
        empty(u);
        w.limbs[u.held].useAt = w.clock;
      }
    } else {
      u.vy -= 9.8 * dt;
      u.x = clamp(u.x + u.vx * dt, -6.5, 7);
      u.z = clamp(u.z + u.vz * dt, -5, 5.5);
      u.y += u.vy * dt;
      const counter = u.x < -4.65 && u.z > -4 && u.z < 2.4;
      const onTable =
        Math.abs(u.x - w.table.x) < 1.45 && Math.abs(u.z - w.table.z) < 1.1;
      const surface = counter || onTable ? 1.8 : 0.22;
      if (u.y < surface) {
        if (surface === 0.22 && u.fill) {
          empty(u);
          event(
            w,
            'spill',
            'Utensil down. A clean replacement returns to its station in five seconds.',
          );
        }
        u.y = surface;
        u.vy = Math.abs(u.vy) > 1 ? -u.vy * 0.22 : 0;
        u.vx *= 0.9;
        u.vz *= 0.9;
        if (surface === 0.22 && !u.floorAt) u.floorAt = w.clock;
      }
      if (u.floorAt && w.clock - u.floorAt > 5000)
        Object.assign(u, utensil(u.id));
    }
    if (u.id === 'pan' && u.fill && !u.ready && distance(u, STOVE) < 1.35) {
      u.cook += dt;
      if (u.flipped && u.cook >= 3) {
        u.ready = true;
        event(
          w,
          'flip',
          'Golden on both sides. Take the pan to the plate!',
          u.held,
        );
      }
      if (!u.flipped && u.cook > 12) {
        empty(u);
        event(
          w,
          'spill',
          'That pancake became charcoal. Add fresh batter with Space.',
          u.held,
        );
      }
    }
  }
  w.spills = w.spills.filter((s) => w.clock - s.at < 24000);
  if (w.pancakes >= 3 && w.coffee >= 0.98) {
    w.phase = 'won';
    event(
      w,
      'finish',
      'Breakfast served. You are legally allowed to call yourselves an adult.',
    );
  } else if (w.clock - w.started >= ROUND_MS) {
    w.phase = 'lost';
    event(
      w,
      'finish',
      'Breakfast is now brunch. The kitchen would like another attempt.',
    );
  }
}
export function advanceBreakfast(w: BrainWorld, now: number) {
  const delta = clamp(now - w.clock, 0, 250);
  const target = w.clock + delta;
  if (w.phase !== 'playing') {
    w.clock = Math.max(w.clock, now);
    return;
  }
  w.remainder += delta;
  while (w.remainder >= 1000 / 60 && w.phase === 'playing') {
    w.remainder -= 1000 / 60;
    w.clock += 1000 / 60;
    step(w, 1 / 60);
  }
  w.clock = target;
}
export function breakfastSnapshot(
  w: BrainWorld,
  code: string,
  host: string,
  _id: string,
  version: number,
) {
  return { code, host, version, world: structuredClone(w) };
}
export function instruction(w: BrainWorld, id: string): string {
  const p = w.players.find((p) => p.id === id);
  if (!p) return 'Choose your brain cell.';
  if (p.limb > 1)
    return 'WASD takes steps · Space kicks · Shift takes smaller steps';
  const u = w.utensils.find((u) => u.held === p.limb);
  if (!u) return 'WASD reaches · R / F changes height · E grabs the pan or pot';
  if (u.id === 'jug')
    return u.fill < 0.05
      ? 'Empty pot. Hold Space at the coffee machine to refill.'
      : 'Reach over the cup. Hold Space to pour. Shift moves carefully.';
  if (u.ready)
    return 'Pancake ready! Reach over the plate and press Space to serve.';
  if (!u.fill) return 'Hold the pan over the glowing hob. Space adds batter.';
  if (!u.flipped && u.cook >= 3) return 'Flip now! Press Space over the hob.';
  return u.flipped
    ? 'Keep the pan over the hob. The second side is cooking…'
    : 'Keep the pan over the hob. Wait for the flip cue…';
}
