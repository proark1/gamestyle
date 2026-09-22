import { idleInput, type World } from './types';
export function updateBots(w: World) {
  for (const p of w.players.filter((p) => p.bot)) {
    const foe = w.players.find((q) => q.id !== p.id)!,
      input = idleInput();
    p.input = input;
    if (w.phase !== 'playing') continue;
    const beat = (w.tick + p.color * 47) % 180;
    const g = w.grapple;
    if (g) {
      if (g.submissionBy) {
        if (g.submissionBy === p.id) input.grapple = g.age % 1.4 < 0.55;
        else {
          input.guard = g.age % 1.4 < 0.6;
          input.dodge = beat < 60;
        }
      } else if (g.mode === 'clinch') {
        input.grapple = g.top === p.id ? beat < 140 : beat % 60 === 0;
        input.guard = g.top !== p.id && beat > 50;
        input.dodge = g.top !== p.id && beat < 45;
        input.punch = beat % 45 === 0;
      } else {
        input.guard = beat > 110;
        input.kick = beat < 80;
        input.grapple =
          (p.style === 'jiu-jitsu' || p.style === 'mma') && beat === 90;
        input.punch = beat % 40 === 0;
        input.dodge = g.top !== p.id && p.style !== 'jiu-jitsu' && beat < 75;
      }
      continue;
    }
    const dx = foe.x - p.x,
      dz = foe.z - p.z,
      distance = Math.max(0.01, Math.hypot(dx, dz));
    const range =
      p.style === 'kickboxer' ? 1.95 : p.style === 'boxer' ? 1.25 : 1.15;
    const retreat = p.stamina < 24;
    const drive = retreat
      ? -1
      : distance > range
        ? 1
        : distance < range - 0.2
          ? -0.55
          : 0;
    input.x = (dx / distance) * drive + (dz / distance) * 0.32;
    input.z = (dz / distance) * drive - (dx / distance) * 0.32;
    // React after a windup delay; do not read the opponent's raw controls.
    input.guard = foe.attack > 0 && foe.attack < 0.48 && beat > 55;
    input.dodge = foe.attack > 0 && foe.attack < 0.3 && beat < 22;
    if (retreat || input.guard || input.dodge) continue;
    if (foe.down && distance < 1.5) input.grapple = beat % 35 === 0;
    else if (
      (p.style === 'jiu-jitsu' || p.style === 'mma') &&
      distance < 1.5 &&
      beat < 15
    )
      input.grapple = beat % 10 === 0;
    else if (distance < 2.25 && p.style === 'kickboxer') {
      input.kick = beat % 65 === 0;
      input.punch = distance < 1.5 && beat % 60 < 8;
    } else if (distance < 1.5) input.punch = beat % 64 < (beat < 64 ? 30 : 6);
    else if (distance < 2.1 && beat === 100) input.kick = true;
  }
}
