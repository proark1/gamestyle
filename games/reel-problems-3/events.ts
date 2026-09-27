import type { AdventureEventKind, AdventureWorld } from './types';

export function emit(
  world: AdventureWorld,
  kind: AdventureEventKind,
  actor?: string,
  detail?: string,
  position?: { x: number; z: number },
) {
  world.events.push({
    id: ++world.nextEvent,
    kind,
    at: world.clock,
    ...(actor ? { actor } : {}),
    ...(detail ? { detail } : {}),
    ...(position ? position : {}),
  });
  if (world.events.length > 48)
    world.events.splice(0, world.events.length - 48);
}
