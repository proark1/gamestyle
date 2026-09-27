import { idleInput, type AdventurePlayer, type AdventureStats } from './types';

const CREW_NAMES = ['Milo', 'Lola', 'Nico', 'Pip'] as const;

export function freshStats(): AdventureStats {
  return {
    score: 0,
    casts: 0,
    catches: 0,
    catchWeight: 0,
    rareCatches: 0,
    netAssists: 0,
    repairs: 0,
    bails: 0,
    rescues: 0,
    helmTime: 0,
    droppedFish: 0,
    lostItems: 0,
    collisionDamage: 0,
    tangles: 0,
    overboardMs: 0,
  };
}

export function createPlayer(
  seat: number,
  now = 0,
  bot = true,
  id = bot ? `bot-${seat}` : `crew-${seat}`,
): AdventurePlayer {
  return {
    id,
    name: CREW_NAMES[seat] ?? `Crew ${seat + 1}`,
    color: seat,
    seat,
    bot,
    seen: now,
    input: idleInput(),
    space: 'boat',
    x: -1.5 + seat,
    z: 0.8,
    yaw: 0,
    overboard: false,
    held: [],
    line: null,
    nextBotThink: now,
    stats: freshStats(),
  };
}
