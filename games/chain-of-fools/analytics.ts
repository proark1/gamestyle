import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { ChainSnapshot } from './types';

/** Checkpoint index to milestone key, in the order the course reaches them. */
export const CHECKPOINT_MILESTONES: readonly [number, string][] = [
  [1, 'girders'],
  [2, 'scaffold'],
  [3, 'scaffold-top'],
  [4, 'wrecking'],
  [5, 'pipe'],
  [6, 'net'],
  [7, 'lower-pad'],
];

export const chainOfFoolsAnalytics: GameAnalytics = {
  game: 'chain-of-fools',
  milestones: [
    { key: 'first-dangle', label: 'A worker went over and hung on the line' },
    { key: 'girders', label: 'Reached the girder run' },
    { key: 'first-haul', label: 'Hauled a crewmate back up' },
    { key: 'scaffold', label: 'Reached the scaffold foot' },
    { key: 'scaffold-top', label: 'Climbed to the scaffold top' },
    { key: 'wrecking', label: 'Crossed the plank to the wrecking ledge' },
    { key: 'pipe', label: 'Reached the pipe mouth' },
    { key: 'net', label: 'Reached the net head' },
    { key: 'lower-pad', label: 'Down the cargo net' },
  ],
  reasons: {
    'clocked-in': 'The whole crew reached the site office',
    'shift-over': 'The shift horn went before the crew arrived',
  },
  actions: {
    start: 'Started the shift',
    restart: 'Restarted the shift',
    jump: 'Jumped',
    clip: 'Clipped or unclipped the line',
    ping: 'Called the crew over',
  },
};

export function chainPlayState(
  snapshot: ChainSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const base = crewOf(session, snapshot.host, world.players, world.startedAt);

  if (world.phase === 'lobby') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  if (world.players.some((p) => p.falls > 0)) milestones.push('first-dangle');
  if (world.players.some((p) => p.hauls > 0)) milestones.push('first-haul');
  for (const [index, key] of CHECKPOINT_MILESTONES)
    if (world.checkpoint >= index) milestones.push(key);

  if (world.phase === 'playing')
    return { stage: 'playing', ...base, milestones };

  const won = world.winner === 'crew';
  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: won ? 'won' : 'lost',
      reason: won ? 'clocked-in' : 'shift-over',
      score: Math.round(world.bestX),
    },
  };
}
