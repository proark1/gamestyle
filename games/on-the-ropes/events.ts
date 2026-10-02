import type { World, BoxingEvent, Boxer } from './types';

export function emit(
  w: World,
  kind: BoxingEvent['kind'],
  p: Pick<Boxer, 'x' | 'z' | 'team'>,
  strength = 1,
) {
  w.events.push({
    id: ++w.nextEvent,
    kind,
    x: p.x,
    z: p.z,
    team: p.team,
    strength,
  });
  if (w.events.length > 24) w.events.shift();
}
