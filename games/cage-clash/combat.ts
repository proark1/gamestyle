import { emit } from './events';
import { stats } from './styles';
import { STEP, type Fighter, type Move, type World } from './types';
export const MOVES = {
  jab: {
    duration: 0.4,
    windup: 0.14,
    range: 1.45,
    damage: 6,
    cost: 7,
    recovery: 0.1,
  },
  cross: {
    duration: 0.5,
    windup: 0.2,
    range: 1.6,
    damage: 9,
    cost: 10,
    recovery: 0.13,
  },
  hook: {
    duration: 0.8,
    windup: 0.34,
    range: 1.55,
    damage: 16,
    cost: 23,
    recovery: 0.3,
  },
  kick: {
    duration: 0.85,
    windup: 0.38,
    range: 2.25,
    damage: 13,
    cost: 19,
    recovery: 0.35,
  },
  clinch: {
    duration: 0.65,
    windup: 0.3,
    range: 1.5,
    damage: 0,
    cost: 13,
    recovery: 0.35,
  },
} as const;
export function clearCombat(p: Fighter) {
  p.attack = p.charge = p.cooldown = p.dodge = p.stagger = p.counter = 0;
  p.guarding = false;
  p.vx = p.vz = 0;
}
export function hurt(
  w: World,
  attacker: Fighter,
  target: Fighter,
  amount: number,
  kind: 'hit' | 'counter' = 'hit',
) {
  const damage = Math.min(target.health, amount);
  target.health = Math.max(0, target.health - amount);
  target.balance += amount * 2.4;
  target.lastHit = w.clock;
  attacker.damage += damage;
  emit(
    w,
    kind,
    target,
    Math.min(1, 0.4 + amount / 22),
    w.grapple ? 'jab' : attacker.move,
  );
}
function startAttack(p: Fighter, move: Move) {
  const profile = MOVES[move],
    cost =
      profile.cost *
      (p.style === 'boxer' && ['jab', 'cross', 'hook'].includes(move)
        ? 0.85
        : 1);
  if (p.stamina < cost) return;
  p.stamina -= cost;
  p.move = move;
  p.attack = profile.duration;
  p.struck = false;
  p.whiffed = false;
  p.charge = 0;
  if (move !== 'clinch') p.punches++;
}
export function standingStep(w: World) {
  const impacts: { p: Fighter; foe: Fighter }[] = [];
  for (const p of w.players) {
    const foe = w.players.find((q) => q.id !== p.id)!;
    for (const key of [
      'cooldown',
      'dodge',
      'dodgeCooldown',
      'stagger',
      'counter',
      'comboTime',
      'parryCooldown',
      'down',
    ] as const)
      p[key] = Math.max(0, p[key] - STEP);
    p.stamina = Math.min(
      100,
      p.stamina + STEP * (p.attack || p.charge ? 0 : p.input.guard ? 3 : 11),
    );
    if (w.clock - p.lastHit > 2000)
      p.balance = Math.max(0, p.balance - STEP * 12);
    const wasGuard = p.guarding;
    p.guarding =
      !p.down && !p.attack && !p.stagger && p.input.guard && p.stamina > 4;
    p.guardAge = p.guarding ? (wasGuard ? p.guardAge + STEP : 0) : 0;
    if (p.input.cancel || p.guarding) p.charge = 0;
    if (p.attack === 0) {
      const angle = Math.atan2(foe.x - p.x, foe.z - p.z);
      const delta = Math.atan2(
        Math.sin(angle - p.heading),
        Math.cos(angle - p.heading),
      );
      p.heading += Math.max(-STEP * 9, Math.min(STEP * 9, delta));
    }
    if (p.down) {
      p.vx *= 0.8;
      p.vz *= 0.8;
      continue;
    }
    if (
      !p.attack &&
      !p.stagger &&
      p.input.dodge &&
      !p.previous.dodge &&
      p.dodgeCooldown === 0 &&
      p.stamina >= 18
    ) {
      p.stamina -= 18;
      p.dodge = 0.24;
      p.dodgeCooldown = 0.85;
      p.charge = 0;
      const length = Math.hypot(p.input.x, p.input.z);
      p.vx = (length > 0 ? p.input.x / length : -Math.sin(p.heading)) * 7;
      p.vz = (length > 0 ? p.input.z / length : -Math.cos(p.heading)) * 7;
    }
    if (!p.dodge) {
      const speed =
        (p.attack ? 0.45 : p.guarding ? 1.5 : 3.4) *
        stats(p).speed *
        (p.stamina < 12 ? 0.65 : 1);
      p.vx += ((p.stagger ? 0 : p.input.x * speed) - p.vx) * 0.2;
      p.vz += ((p.stagger ? 0 : p.input.z * speed) - p.vz) * 0.2;
    }
    if (
      !p.attack &&
      !p.cooldown &&
      !p.stagger &&
      !p.dodge &&
      !p.guarding &&
      !p.input.cancel
    ) {
      if (p.input.grapple && !p.previous.grapple) startAttack(p, 'clinch');
      else if (p.input.kick && !p.previous.kick) startAttack(p, 'kick');
      else if (p.input.punch) p.charge = Math.min(1, p.charge + STEP);
      else if (p.charge > 0)
        startAttack(
          p,
          p.charge >= 0.4
            ? 'hook'
            : p.combo === 1 && p.comboTime > 0
              ? 'cross'
              : 'jab',
        );
    }
    if (p.attack > 0) {
      const profile = MOVES[p.move];
      const elapsed = profile.duration - p.attack;
      if (elapsed === 0) emit(w, p.move === 'kick' ? 'kick' : 'punch', p, 0.45);
      p.attack = Math.max(0, p.attack - STEP);
      if (!p.struck && profile.duration - p.attack >= profile.windup) {
        p.struck = true;
        impacts.push({ p, foe });
      }
      if (p.attack === 0) {
        p.cooldown = profile.recovery + (p.whiffed ? 0.35 : 0);
        p.combo = p.move === 'jab' ? 1 : 0;
        p.comboTime = 0.7;
      }
    }
  }
  // Resolve contacts together, preserving genuine simultaneous strikes.
  for (const { p, foe } of impacts) {
    const profile = MOVES[p.move],
      distance = Math.hypot(foe.x - p.x, foe.z - p.z);
    const facing =
      ((foe.x - p.x) * Math.sin(p.heading) +
        (foe.z - p.z) * Math.cos(p.heading)) /
      Math.max(0.001, distance);
    if (
      distance > profile.range ||
      facing < 0.35 ||
      foe.dodge > 0 ||
      (foe.down > 0 && p.move !== 'clinch')
    ) {
      p.whiffed = true;
      p.cooldown = Math.max(p.cooldown, profile.recovery + 0.35);
      emit(w, 'miss', p, 0.4);
      if (foe.dodge > 0 && distance < profile.range + 0.5) foe.counter = 0.8;
      continue;
    }
    if (p.move === 'clinch') {
      if (w.grapple) continue;
      if (foe.down > 0) {
        w.grapple = {
          mode: 'guard',
          top: p.id,
          age: 0,
          progress: 0,
          submissionBy: null,
          submission: 0,
          cooldown: 0.5,
          still: 0,
        };
        foe.down = 0;
        emit(w, 'takedown', p);
        clearCombat(p);
        clearCombat(foe);
      } else if (!foe.guarding || foe.guardAge > 0.3 || foe.stamina < 25) {
        w.grapple = {
          mode: 'clinch',
          top: p.id,
          age: 0,
          progress: 0,
          submissionBy: null,
          submission: 0,
          cooldown: 0.35,
          still: 0,
        };
        clearCombat(p);
        clearCombat(foe);
        emit(w, 'clinch', p);
      } else {
        emit(w, 'block', foe);
        p.stagger = 0.35;
      }
      continue;
    }
    if (w.grapple) continue;
    if (foe.guarding && foe.guardAge < 0.16 && foe.parryCooldown === 0) {
      foe.counter = 1;
      foe.parryCooldown = 1.25;
      foe.stamina = Math.max(0, foe.stamina - 5);
      p.stagger = 0.25;
      emit(w, 'parry', foe);
      continue;
    }
    let damage =
      profile.damage * (p.move === 'kick' ? stats(p).kick : stats(p).punch);
    const counter = p.counter > 0;
    if (counter) {
      damage *= 1.25;
      p.counter = 0;
    }
    if (foe.guarding) {
      foe.stamina = Math.max(0, foe.stamina - damage * 1.1);
      if (foe.stamina > 4) {
        damage *= 0.16;
        emit(w, 'block', foe);
      } else {
        foe.stagger = 0.7;
        foe.guarding = false;
        emit(w, 'guard-break', foe);
      }
    } else foe.stagger = Math.max(foe.stagger, p.move === 'hook' ? 0.2 : 0.08);
    hurt(w, p, foe, damage, counter ? 'counter' : 'hit');
    if (p.move === 'kick')
      foe.stamina = Math.max(0, foe.stamina - damage * 0.45);
    foe.vx += Math.sin(p.heading) * damage * 0.12;
    foe.vz += Math.cos(p.heading) * damage * 0.12;
  }
  if (!w.grapple)
    for (const p of w.players)
      if (p.balance >= 100 && !p.down && p.health > 0) {
        p.balance = 0;
        clearCombat(p);
        p.down = 1.8;
        w.players.find((q) => q.id !== p.id)!.knockdowns++;
        emit(w, 'down', p, 1);
      }
}
