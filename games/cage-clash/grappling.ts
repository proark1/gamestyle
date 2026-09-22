import { emit } from './events';
import { clearCombat, hurt } from './combat';
import { cageDistance, contain } from './physics';
import { stats } from './styles';
import { STEP, type Fighter, type World } from './types';
export function breakGrapple(w: World, p: Fighter) {
  for (const q of w.players) {
    clearCombat(q);
    q.cooldown = 0.45;
    q.x -= Math.sin(q.heading) * 0.45;
    q.z -= Math.cos(q.heading) * 0.45;
    contain(q);
  }
  w.grapple = null;
  emit(w, 'escape', p);
}
export function grapplingStep(w: World) {
  const g = w.grapple;
  if (!g) return;
  const top = w.players.find((p) => p.id === g.top)!,
    bottom = w.players.find((p) => p.id !== g.top)!;
  g.age += STEP;
  g.cooldown = Math.max(0, g.cooldown - STEP);
  for (const p of w.players) {
    p.attack = Math.max(0, p.attack - STEP);
    p.cooldown = Math.max(0, p.cooldown - STEP);
    p.guarding = p.input.guard && p.stamina > 2;
    p.guardAge = p.guarding ? p.guardAge + STEP : 0;
    p.vx = p.vz = 0;
    p.down = 0;
    p.stamina = Math.min(
      100,
      Math.max(
        0,
        p.stamina +
          STEP *
            (p.input.grapple || p.input.kick || p.input.dodge
              ? -6
              : p.guarding
                ? 5
                : 9),
      ),
    );
  }
  if (g.mode === 'clinch') {
    const nearCage = cageDistance(bottom) < 0.9;
    const attack =
      top.input.grapple && top.stamina > 8
        ? stats(top).takedown * (nearCage ? 1.3 : 1)
        : 0;
    const defense =
      bottom.input.guard && bottom.stamina > 8
        ? stats(bottom).takedown * 0.85
        : 0.15;
    g.progress = Math.max(
      -1,
      Math.min(1, g.progress + STEP * (attack - defense) * 0.8),
    );
    if (bottom.input.dodge && bottom.stamina > 8)
      g.progress -= STEP * (nearCage ? 0.45 : 0.85);
    if (top.input.dodge && top.stamina > 8) {
      breakGrapple(w, top);
      return;
    }
    if (g.progress >= 1) {
      g.mode = 'guard';
      g.progress = 0;
      g.age = 0;
      g.cooldown = 0.7;
      top.takedowns++;
      emit(w, 'takedown', top, 1);
    } else if (g.progress <= -1 || g.age > 7) {
      breakGrapple(w, bottom);
      return;
    }
    // Pummelling reverses control, at the cost of giving up takedown defense.
    if (
      bottom.input.grapple &&
      !bottom.previous.grapple &&
      !g.cooldown &&
      bottom.stamina > 15 &&
      !top.input.grapple
    ) {
      g.top = bottom.id;
      g.progress = 0;
      g.cooldown = 0.8;
      bottom.stamina -= 10;
      emit(w, 'advance', bottom);
    }
  } else {
    // Keep the pair together; ground positions are a single authoritative state.
    const centerX = (top.x + bottom.x) / 2,
      centerZ = (top.z + bottom.z) / 2;
    top.x = centerX;
    top.z = centerZ - 0.34;
    bottom.x = centerX;
    bottom.z = centerZ + 0.34;
    top.heading = 0;
    bottom.heading = Math.PI;
    contain(top);
    contain(bottom);
    if (!g.submissionBy) {
      const advance = top.input.kick && top.stamina > 8 ? stats(top).ground : 0;
      const escape =
        (bottom.input.kick || bottom.input.dodge) && bottom.stamina > 8
          ? stats(bottom).ground
          : 0;
      const guardTop = top.guarding ? 0.65 : 0,
        guardBottom = bottom.guarding ? 0.7 : 0;
      g.progress +=
        STEP *
        ((advance ? advance - guardBottom : 0) -
          (escape ? escape - guardTop : 0)) *
        0.6;
      g.progress *= 1 - STEP * 0.05;
      if (g.progress >= 1) {
        if (g.mode === 'guard') {
          g.mode = 'mount';
          top.advances++;
          emit(w, 'advance', top);
        }
        g.progress = 0;
      }
      if (g.progress <= -1) {
        if (g.mode === 'mount') {
          g.mode = 'guard';
          emit(w, 'escape', bottom);
        } else if (bottom.input.kick) {
          g.top = bottom.id;
          bottom.advances++;
          emit(w, 'advance', bottom);
        } else {
          breakGrapple(w, bottom);
          return;
        }
        g.progress = 0;
      }
      if (top.input.dodge && top.stamina > 10) {
        breakGrapple(w, top);
        return;
      }
      for (const p of [top, bottom])
        if (
          p.input.grapple &&
          !p.previous.grapple &&
          p.stamina >= 25 &&
          !g.cooldown &&
          (p === top || g.mode === 'guard')
        ) {
          g.submissionBy = p.id;
          g.submission = 0.12;
          g.age = 0;
          p.stamina -= 12;
          emit(w, 'submission', p);
          break;
        }
    } else {
      const attacker = w.players.find((p) => p.id === g.submissionBy)!,
        defender = w.players.find((p) => p.id !== g.submissionBy)!;
      // A visible pulse every 1.4 seconds. Attack on gold; defend on gold or escape.
      const window = g.age % 1.4 < 0.45;
      const attack =
        attacker.input.grapple && attacker.stamina > 5
          ? stats(attacker).submission * (window ? 0.8 : -0.08)
          : -0.03;
      const defense =
        defender.guarding && defender.stamina > 5
          ? window
            ? 0.95
            : 0.1
          : defender.input.dodge && defender.stamina > 5
            ? 0.28
            : 0;
      g.submission = Math.max(
        0,
        Math.min(1, g.submission + STEP * (attack - defense)),
      );
      if (attacker.input.grapple)
        attacker.stamina = Math.max(0, attacker.stamina - STEP * 3);
      if (g.submission >= 1) {
        w.winner = attacker.team;
        w.finish = 'Submission';
        w.phase = 'ended';
        emit(w, 'bell', attacker);
        return;
      }
      if (g.submission <= 0 || g.age > 10 || attacker.stamina <= 1) {
        g.submissionBy = null;
        g.submission = 0;
        g.cooldown = 1.3;
        emit(w, 'escape', defender);
      }
    }
    const engaged = w.players.some(
      (p) => p.input.punch || p.input.kick || p.input.grapple || p.input.dodge,
    );
    g.still = engaged ? 0 : g.still + STEP;
    if (g.still >= 5) {
      breakGrapple(w, bottom);
      return;
    }
  }
  if (g.submissionBy) return;
  for (const p of w.players) {
    const foe = w.players.find((q) => q.id !== p.id)!;
    if (!p.input.punch || p.previous.punch || p.cooldown || p.stamina < 8)
      continue;
    p.stamina -= 8;
    p.attack = 0.3;
    p.move = 'jab';
    p.cooldown = 0.65;
    p.punches++;
    const power =
      g.mode === 'clinch'
        ? 4
        : p.id === g.top
          ? g.mode === 'mount'
            ? 7
            : 4.5
          : 2;
    hurt(w, p, foe, power * stats(p).punch * (foe.guarding ? 0.2 : 1));
    if (foe.guarding) {
      foe.stamina = Math.max(0, foe.stamina - 6);
      emit(w, 'block', foe);
    }
  }
}
