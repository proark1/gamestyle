import { CORNERS, type Boxer, type World } from './types';
import { emit } from './events';

// Animation and hit timing share these profiles: contact happens at full extension.
export const PUNCHES = {
  jab: {
    duration: 0.42,
    windup: 0.16,
    range: 1.48,
    damage: 14,
    cost: 8,
    recovery: 0.08,
  },
  cross: {
    duration: 0.52,
    windup: 0.22,
    range: 1.58,
    damage: 20,
    cost: 12,
    recovery: 0.12,
  },
  uppercut: {
    duration: 0.64,
    windup: 0.26,
    range: 1.25,
    damage: 26,
    cost: 18,
    recovery: 0.17,
  },
  hook: {
    duration: 0.86,
    windup: 0.36,
    range: 1.62,
    damage: 32,
    cost: 25,
    recovery: 0.22,
  },
} as const;
export function punchProfile(p: Boxer) {
  return PUNCHES[punchKind(p)];
}
export function punchKind(p: Boxer) {
  return p.heavy
    ? 'hook'
    : p.combo === 3
      ? 'uppercut'
      : p.combo === 2
        ? 'cross'
        : 'jab';
}
export function nextCombo(p: Boxer) {
  if (p.comboTime <= 0) return 1;
  if (p.combo === 1 && p.stamina >= PUNCHES.cross.cost) return 2;
  if (p.combo === 2 && p.stamina >= PUNCHES.uppercut.cost) return 3;
  return 1;
}
export function resetCombat(p: Boxer) {
  p.attack = p.charge = p.cooldown = p.stagger = p.dodge = p.dodgeCooldown = 0;
  p.assistCharge =
    p.botHold =
    p.combo =
    p.comboTime =
    p.guardAge =
    p.counter =
    p.parryCooldown =
      0;
  p.counterPunch = p.whiffed = p.guarding = p.wasDodge = false;
  p.vx = p.vz = 0;
}
type Impact = {
  attacker: Boxer;
  target: Boxer;
  nx: number;
  nz: number;
  damage: number;
  heavy: boolean;
  counter: boolean;
};

export function combatStep(w: World, dt: number) {
  const impacts: Impact[] = [];
  for (const p of w.players) {
    for (const key of [
      'stagger',
      'cooldown',
      'dodge',
      'dodgeCooldown',
      'comboTime',
      'counter',
      'parryCooldown',
      'tagTransition',
    ] as const)
      p[key] = Math.max(0, p[key] - dt);
    p.stamina = Math.min(
      100,
      p.stamina +
        dt *
          (p.active
            ? p.guarding
              ? -1.5
              : p.charge > 0 || p.attack > 0
                ? 0
                : 8
            : 18),
    );
    p.stamina = Math.max(0, p.stamina);
    p.balance = Math.max(
      0,
      p.balance - dt * (p.active ? (w.clock - p.lastHit > 1800 ? 7 : 0) : 14),
    );
    if (p.input.cancel) p.charge = p.assistCharge = 0;
    if (p.tagTransition > 0) {
      p.vx = p.vz = 0;
      continue;
    }
    if (!p.active) {
      const c = CORNERS[p.team];
      // A queued tag brings the reserve to the handoff spot too.
      p.z = p.tagRequested
        ? p.z + Math.sign(c.z - p.z) * Math.min(Math.abs(c.z - p.z), dt * 2.5)
        : Math.max(c.z - 1.2, Math.min(c.z + 1.2, p.z + p.input.z * dt * 2));
      continue;
    }
    if (p.down) {
      resetCombat(p);
      continue;
    }
    const foe = w.players.find((q) => q.active && q.team !== p.team)!;
    if (p.attack === 0 && p.stagger === 0) {
      const target = Math.atan2(foe.x - p.x, foe.z - p.z);
      const delta = Math.atan2(
        Math.sin(target - p.heading),
        Math.cos(target - p.heading),
      );
      p.heading += Math.max(-dt * 7, Math.min(dt * 7, delta));
    }
    const wasGuarding = p.guarding;
    p.guarding =
      p.input.guard &&
      p.attack === 0 &&
      p.stagger === 0 &&
      p.dodge === 0 &&
      p.stamina > 5;
    p.guardAge = p.guarding ? (wasGuarding ? p.guardAge + dt : 0) : 0;
    if (
      p.input.dodge &&
      !p.wasDodge &&
      p.dodgeCooldown === 0 &&
      p.stagger === 0 &&
      p.attack === 0 &&
      p.stamina >= 20
    ) {
      const length = Math.hypot(p.input.x, p.input.z);
      p.vx += (length > 0 ? p.input.x / length : -Math.sin(p.heading)) * 6;
      p.vz += (length > 0 ? p.input.z / length : -Math.cos(p.heading)) * 6;
      p.dodge = 0.23;
      p.dodgeCooldown = 0.9;
      p.stamina -= 20;
      p.charge = 0;
      p.guarding = false;
    }
    p.wasDodge = p.input.dodge;
    if (
      p.attack === 0 &&
      p.stagger === 0 &&
      p.dodge === 0 &&
      p.cooldown === 0 &&
      !p.guarding &&
      !p.input.cancel
    ) {
      if (p.input.punch && p.stamina >= 8)
        p.charge = Math.min(1, p.charge + dt);
      else if (p.charge > 0) {
        p.heavy = p.charge >= 0.45 && p.stamina >= 25;
        p.combo = p.heavy ? 0 : nextCombo(p);
        const profile = punchProfile(p);
        if (p.stamina >= profile.cost) {
          p.attack = profile.duration;
          p.struck = p.whiffed = false;
          p.hand = p.heavy ? 1 - p.hand : p.combo === 2 ? 1 : 0;
          p.stamina -= profile.cost;
          p.counterPunch = p.counter > 0;
          p.counter = 0;
          p.comboTime = 1.2;
          p.punches++;
          emit(w, 'punch', p, p.heavy ? 1 : 0.5);
        }
        p.charge = 0;
      }
    } else p.charge = 0;
    if (p.attack > 0) {
      const profile = punchProfile(p);
      p.attack = Math.max(0, p.attack - dt);
      if (!p.struck && p.attack <= profile.duration - profile.windup) {
        p.struck = true;
        const dx = foe.x - p.x,
          dz = foe.z - p.z,
          distance = Math.hypot(dx, dz);
        const nx = dx / Math.max(0.01, distance),
          nz = dz / Math.max(0.01, distance);
        const facing = Math.sin(p.heading) * nx + Math.cos(p.heading) * nz;
        if (
          distance < profile.range &&
          facing > (p.heavy ? 0.55 : 0.72) &&
          !foe.down &&
          foe.tagTransition === 0
        ) {
          impacts.push({
            attacker: p,
            target: foe,
            nx,
            nz,
            heavy: p.heavy,
            counter: p.counterPunch,
            damage:
              profile.damage *
              (p.counterPunch ? 1.25 : 1) *
              (foe.stamina < 20 ? 1.2 : 1),
          });
        } else whiff(w, p);
      }
      if (p.attack === 0)
        p.cooldown =
          profile.recovery + (p.whiffed ? (p.heavy ? 0.22 : 0.1) : 0);
    }
    const speed =
      p.stagger > 0
        ? 0.35
        : p.guarding
          ? 2
          : p.charge > 0 || p.attack > 0
            ? 1.6
            : p.stamina < 15
              ? 2.4
              : 3.6;
    const blend = 1 - Math.exp(-dt * (p.dodge > 0 ? 1.5 : 5));
    p.vx += (p.input.x * speed - p.vx) * blend;
    p.vz += (p.input.z * speed - p.vz) * blend;
  }
  // Take all defense decisions before mutating either boxer: trades stay symmetric.
  const resolved = impacts.map((hit) => {
    const p = hit.target;
    const blocked =
      p.guarding &&
      Math.sin(p.heading) * -hit.nx + Math.cos(p.heading) * -hit.nz > 0.45;
    return {
      ...hit,
      avoided: p.dodge > 0,
      blocked,
      parried:
        blocked && p.guardAge < 0.12 && p.parryCooldown === 0 && p.stamina >= 8,
      broken: blocked && p.stamina < (hit.heavy ? 18 : 9),
    };
  });
  for (const hit of resolved) {
    const {
      target: p,
      attacker,
      nx,
      nz,
      damage,
      heavy,
      counter,
      blocked,
      parried,
      broken,
    } = hit;
    if (hit.avoided) {
      whiff(w, attacker);
      p.counter = Math.max(p.counter, 0.65);
      continue;
    }
    p.lastHit = w.clock;
    p.charge = 0;
    if (parried) {
      p.stamina -= 3;
      p.parryCooldown = 1.1;
      p.counter = 0.8;
      attacker.stagger = Math.max(attacker.stagger, 0.24);
      attacker.cooldown = Math.max(attacker.cooldown, 0.25);
      attacker.attack = attacker.charge = 0;
      attacker.comboTime = 0;
      emit(w, 'parry', p, 0.8);
      continue;
    }
    p.balance += damage * (broken ? 0.65 : blocked ? 0.12 : 1);
    p.stamina = Math.max(0, p.stamina - (blocked ? (heavy ? 18 : 9) : 4));
    p.stagger = Math.max(
      p.stagger,
      broken ? 0.55 : blocked ? 0 : heavy ? 0.3 : 0.11,
    );
    if (broken) p.guarding = false;
    // A clean hit interrupts a windup, but never erases an already gathered trade.
    if (!blocked || broken) {
      p.attack = 0;
      p.cooldown = Math.max(p.cooldown, 0.14);
      p.comboTime = 0;
    }
    const impulse = blocked ? 1 : heavy ? 5 : 2.4;
    p.vx += nx * impulse;
    p.vz += nz * impulse;
    emit(
      w,
      broken ? 'guard-break' : blocked ? 'block' : counter ? 'counter' : 'hit',
      p,
      heavy ? 1 : 0.55,
    );
  }
}
function whiff(w: World, p: Boxer) {
  p.whiffed = true;
  p.comboTime = 0;
  if (p.heavy) {
    p.balance = Math.min(90, p.balance + 7);
    p.vx += Math.sin(p.heading) * 1.5;
    p.vz += Math.cos(p.heading) * 1.5;
  }
  emit(w, 'miss', p, p.heavy ? 1 : 0.4);
}
