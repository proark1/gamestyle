import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { FarmSnapshot } from './types';

export const farmAnalytics: GameAnalytics = {
  game: 'act-natural',
  milestones: [
    { key: 'first-catch', label: 'The farmer caught a cow' },
    { key: 'first-key', label: 'A gate key was delivered' },
    { key: 'both-keys', label: 'Both gate keys were delivered' },
    { key: 'power-off', label: 'The fence power was cut' },
    { key: 'ladder', label: 'The ladder went up' },
    { key: 'first-escape', label: 'A cow escaped' },
  ],
  reasons: {
    'cows-escaped': 'At least one cow escaped',
    'all-caught': 'The farmer caught every cow',
    'time-up': 'Time ran out before an escape',
  },
  actions: {
    interact: 'Used a key, switch or ladder',
    inspect: 'Inspected a cow',
    drop: 'Dropped an item',
    mode: 'Changed who plays the farmer',
    'add-bot': 'Added an NPC cow',
    'fill-bots': 'Filled seats with NPC cows',
    'remove-bot': 'Removed an NPC cow',
    start: 'Started a round',
    restart: 'Started a rematch',
  },
};

export function farmPlayState(
  snapshot: FarmSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((player) => player.bot).length;
  // A computer farmer is a whole opposing role played by the game.
  const computerFarmer =
    (world.mode ?? (world.practice ? 'computer' : 'human')) === 'computer';
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots + (computerFarmer ? 1 : 0),
    round: world.round,
  };
  if (world.phase === 'lobby') return { stage: 'lobby', ...base };
  const cows = world.players.filter((player) => player.role === 'cow');
  const escaped = cows.filter((cow) => cow.status === 'escaped').length;
  const milestones: string[] = [];
  if (cows.some((cow) => cow.status === 'caught'))
    milestones.push('first-catch');
  if (world.keysDelivered >= 1) milestones.push('first-key');
  if (world.keysDelivered >= 2) milestones.push('both-keys');
  if (world.powerOff) milestones.push('power-off');
  if (world.ladderPlaced) milestones.push('ladder');
  if (escaped) milestones.push('first-escape');
  if (world.phase === 'playing')
    return { stage: 'playing', ...base, milestones };
  const cowsWon = world.phase === 'cows-win';
  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: cowsWon === (snapshot.you.role === 'cow') ? 'won' : 'lost',
      reason: cowsWon
        ? 'cows-escaped'
        : cows.length && cows.every((cow) => cow.status === 'caught')
          ? 'all-caught'
          : 'time-up',
      score: escaped,
    },
  };
}
