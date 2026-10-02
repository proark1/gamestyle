import type { Fighter, EventKind, Move, World } from './types';
export function emit(
  w: World,
  kind: EventKind,
  p: Fighter,
  strength = 0.8,
  move?: Move,
) {
  w.events.push({
    id: ++w.nextEvent,
    kind,
    x: p.x,
    z: p.z,
    team: p.team,
    strength,
    ...(move ? { move } : {}),
  });
  if (w.events.length > 32) w.events.splice(0, w.events.length - 32);
}
