import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { BrainSnapshot } from './types';

export const breakfastAnalytics: GameAnalytics = {
  game: 'four-brain-cells',
  milestones: [
    { key: 'pancake-1', label: 'The first pancake was done' },
    { key: 'pancake-2', label: 'Two pancakes were done' },
    { key: 'pancake-3', label: 'All three pancakes were done' },
    { key: 'coffee-half', label: 'The coffee cup was half full' },
    { key: 'coffee-full', label: 'The coffee cup was full' },
  ],
  reasons: {
    'breakfast-served': 'Pancakes and coffee were served',
    'time-up': 'Breakfast ran out of time',
  },
  actions: {
    claim: 'Claimed a limb',
    grab: 'Grabbed or released',
    kick: 'Kicked',
    center: 'Centred a limb',
    'add-npc': 'Added an NPC',
    'fill-npcs': 'Filled seats with NPCs',
    'remove-npc': 'Removed an NPC',
    start: 'Started breakfast',
    restart: 'Started another breakfast',
  },
};

export function breakfastPlayState(
  snapshot: BrainSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((player) => player.bot).length;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots,
    round: world.started,
  };
  if (world.phase === 'lobby') return { stage: 'lobby', ...base };
  const milestones: string[] = [];
  for (let pancakes = 1; pancakes <= 3; pancakes++)
    if (world.pancakes >= pancakes) milestones.push(`pancake-${pancakes}`);
  if (world.coffee >= 0.5) milestones.push('coffee-half');
  if (world.coffee >= 0.98) milestones.push('coffee-full');
  if (world.phase === 'playing')
    return { stage: 'playing', ...base, milestones };
  return {
    stage: 'finished',
    ...base,
    milestones,
    result:
      world.phase === 'won'
        ? { outcome: 'won', reason: 'breakfast-served', score: world.pancakes }
        : { outcome: 'lost', reason: 'time-up', score: world.pancakes },
  };
}
