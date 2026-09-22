import { CORNERS, type World, type Boxer } from './types';
import { emit } from './events';
import { resetCombat } from './combat';

export const TAG_TRANSITION = 0.65;
export function updateTagRequests(w: World) {
  for (const p of w.players) {
    if (!p.bot && !p.active && p.tagTransition === 0) {
      if (p.input.cancel) p.tagRequested = false;
      else if (p.input.tag && !p.wasTag) p.tagRequested = !p.tagRequested;
    }
    p.wasTag = p.input.tag;
  }
}

export function tagReason(
  w: World,
  p: Boxer,
): 'ready' | 'corner' | 'fighting' | 'recovering' | 'cooldown' | 'partner' {
  const active = p.active
    ? p
    : w.players.find((q) => q.team === p.team && q.active);
  const reserve = w.players.find((q) => q.team === p.team && !q.active);
  if (
    !active ||
    !reserve ||
    active.down ||
    reserve.down ||
    active.tagTransition > 0 ||
    reserve.tagTransition > 0 ||
    w.phase !== 'playing'
  )
    return 'recovering';
  if (w.teams[p.team].tagCooldown > 0) return 'cooldown';
  if (
    active.attack > 0 ||
    active.charge > 0 ||
    active.stagger > 0 ||
    active.dodge > 0 ||
    w.clock - active.lastHit < 1000
  )
    return 'fighting';
  const c = CORNERS[p.team];
  if (
    Math.hypot(active.x - c.x, active.z - c.z) > 1.4 ||
    Math.abs(reserve.z - c.z) > 1
  )
    return 'corner';
  const accepted = reserve.bot
    ? reserve.input.tag
    : reserve.tagRequested ||
      (reserve.input.tag && !reserve.wasTag && !reserve.input.cancel);
  if (!accepted || !active.input.tag) return 'partner';
  return 'ready';
}
export function cornerPlay(w: World, dt: number) {
  for (const team of ['red', 'blue'] as const) {
    const t = w.teams[team],
      active = w.players.find((p) => p.team === team && p.active)!,
      reserve = w.players.find((p) => p.team === team && !p.active)!;
    const c = CORNERS[team];
    if (tagReason(w, active) === 'ready') {
      t.tagProgress += dt;
      if (t.tagProgress >= 0.45) {
        const x = active.x,
          z = active.z;
        for (const p of [active, reserve]) {
          p.tagFromX = p.x;
          p.tagFromZ = p.z;
          resetCombat(p);
          p.tagRequested = p.botReturning = false;
          p.tagTransition = TAG_TRANSITION;
          // A held key cannot become a fresh request as roles change.
          p.wasTag = p.input.tag;
        }
        active.active = false;
        reserve.active = true;
        active.x = Math.sign(c.x) * 6.2;
        active.z = c.z;
        reserve.x = x;
        reserve.z = z;
        reserve.heading = active.heading;
        active.vx = active.vz = reserve.vx = reserve.vz = 0;
        active.tags++;
        reserve.tags++;
        t.tagCooldown = 8;
        t.tagProgress = 0;
        emit(w, 'tag', reserve);
        continue;
      }
    } else t.tagProgress = 0;
    if (
      !reserve.active &&
      reserve.tagTransition === 0 &&
      active.tagTransition === 0 &&
      !reserve.tagRequested &&
      reserve.input.assist &&
      !active.down &&
      Math.hypot(active.x - c.x, active.z - c.z) < 1.6 &&
      Math.abs(reserve.z - c.z) < 1
    ) {
      reserve.assistCharge += dt;
      if (
        t.towelCooldown === 0 &&
        active.stamina < 85 &&
        reserve.assistCharge > 0.5
      ) {
        active.stamina = Math.min(100, active.stamina + 25);
        t.towelCooldown = 16;
        emit(w, 'towel', active);
      }
    } else {
      if (
        reserve.assistCharge >= 1 &&
        active.tagTransition === 0 &&
        !reserve.tagRequested &&
        t.ropeCooldown === 0 &&
        !active.down &&
        active.attack === 0 &&
        active.stagger === 0 &&
        active.dodge === 0 &&
        Math.hypot(active.x - c.x, active.z - c.z) < 1.6
      ) {
        const foe = w.players.find((p) => p.active && p.team !== team)!;
        const d = Math.max(
          0.01,
          Math.hypot(foe.x - active.x, foe.z - active.z),
        );
        active.vx += ((foe.x - active.x) / d) * 7;
        active.vz += ((foe.z - active.z) / d) * 7;
        t.ropeCooldown = 12;
        emit(w, 'launch', active);
      }
      reserve.assistCharge = 0;
    }
  }
}
