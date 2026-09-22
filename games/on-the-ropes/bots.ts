import { CORNERS, idleInput, type World } from './types';
import { punchProfile } from './combat';

export function updateBots(w: World, dt: number) {
  for (const p of w.players) {
    if (!p.bot) continue;
    const input = idleInput();
    if (p.down || p.tagTransition > 0) {
      p.input = input;
      continue;
    }
    if (!p.active) {
      input.tag = true;
      const mate = w.players.find((q) => q.team === p.team && q.active)!;
      input.assist = !mate.input.tag && mate.stamina < 65;
      p.input = input;
      continue;
    }
    const foe = w.players.find((q) => q.team !== p.team && q.active);
    if (!foe) continue;
    const partner = w.players.find((q) => q.team === p.team && !q.active);
    const requested = !!partner && !partner.bot && partner.tagRequested;
    p.botReturning =
      p.stamina < 27 ||
      p.balance > 88 ||
      (p.botReturning && (p.stamina < 70 || p.balance > 30));
    const retreat = requested || p.botReturning;
    const dx = foe.x - p.x,
      dz = foe.z - p.z;
    const distance = Math.hypot(dx, dz),
      d = Math.max(distance, 0.01);
    const beat = (w.tick + p.color * 43) % 240;
    if (retreat) {
      const c = CORNERS[p.team],
        cx = c.x - p.x,
        cz = c.z - p.z;
      const toCorner = Math.hypot(cx, cz);
      if (toCorner > 0.85) {
        input.x = cx / toCorner;
        input.z = cz / toCorner;
        // Steer around a boxer blocking the route, instead of pushing through them.
        const blocking = (cx * dx + cz * dz) / (toCorner * d);
        if (distance < 1.8 && blocking > 0.55) {
          const turn = cx * dz - cz * dx >= 0 ? -1 : 1;
          input.x += (-dz / d) * turn * 1.6;
          input.z += (dx / d) * turn * 1.6;
          const len = Math.hypot(input.x, input.z);
          input.x /= len;
          input.z /= len;
        }
        input.dodge =
          distance < 1.65 &&
          foe.attack > 0 &&
          p.dodgeCooldown === 0 &&
          p.stamina >= 25;
      }
      input.tag = true;
      // Cancel an unthrown punch on call-back; never release it into the opponent.
      input.cancel = p.charge > 0;
      p.botHold = 0;
      p.input = input;
      continue;
    }
    const opponentSwing = foe.attack > 0 && !foe.struck && distance < 1.85;
    const windupElapsed =
      foe.attack > 0 ? punchProfile(foe).duration - foe.attack : 0;
    // Reaction delay and occasional missed reads give humans room to outplay bots.
    input.guard = opponentSwing && windupElapsed > 0.09 && beat < 100;
    input.dodge =
      opponentSwing && foe.heavy && windupElapsed > 0.12 && beat >= 215;
    if (input.dodge) {
      input.x = -dz / d;
      input.z = dx / d;
    } else if (distance > 1.32) {
      input.x = dx / d;
      input.z = dz / d;
    } else if (distance < 1.04 || p.cooldown > 0 || p.stamina < 45) {
      input.x = (-dx / d) * 0.65;
      input.z = (-dz / d) * 0.65;
    } else if (p.attack === 0 && p.charge === 0 && beat > 145) {
      const side = p.color % 2 ? 1 : -1;
      input.x = (-dz / d) * side * 0.35;
      input.z = (dx / d) * side * 0.35;
    }
    p.botHold = Math.max(0, p.botHold - dt);
    if (p.botHold > 0 && !input.guard && !input.dodge) input.punch = true;
    else if (
      !input.guard &&
      !input.dodge &&
      distance < 1.65 &&
      p.cooldown === 0 &&
      p.attack === 0 &&
      p.charge === 0 &&
      p.stamina >= 15 &&
      (beat % 65 < 3 ||
        p.counter > 0 ||
        (p.combo === 1 && p.comboTime > 0.4 && beat < 140))
    ) {
      p.botHold =
        p.stamina >= 35 &&
        beat > 150 &&
        (foe.guarding || foe.balance > 45 || foe.charge > 0)
          ? 0.56
          : 0.1;
      input.punch = true;
    }
    p.input = input;
  }
}
