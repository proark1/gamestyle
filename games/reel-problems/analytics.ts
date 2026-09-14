import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { ReelSnapshot } from './types';

export const reelAnalytics: GameAnalytics = {
  game: 'reel-problems',
  milestones: [
    { key: 'overboard', label: 'Someone fell overboard' },
    { key: 'leak', label: 'The boat sprang a leak' },
    { key: 'sank', label: 'The boat sank' },
    { key: 'first-catch', label: 'Landed the first catch' },
    { key: 'half-goal', label: 'Reached half the catch target' },
    { key: 'goal', label: 'Reached the catch target' },
  ],
  reasons: {
    'goal-reached': 'Beat the catch target',
    'goal-missed': 'Missed the catch target',
  },
  actions: {
    cast: 'Cast a line',
    cut: 'Cut a line free',
    untangle: 'Untangled lines',
    rescue: 'Pulled a friend aboard',
    jump: 'Jumped',
    paddle: 'Took or stowed a paddle',
    start: 'Started the tournament',
    restart: 'Started another tournament',
  },
};

export function reelPlayState(
  snapshot: ReelSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length,
    round: world.started,
  };
  if (world.phase === 'lobby') return { stage: 'lobby', ...base };
  const milestones: string[] = [];
  if (world.players.some((player) => player.swimming))
    milestones.push('overboard');
  if (world.leaks) milestones.push('leak');
  if (world.sinks) milestones.push('sank');
  if (Object.values(world.haul).some((count) => (count ?? 0) > 0))
    milestones.push('first-catch');
  if (world.score >= world.goal / 2) milestones.push('half-goal');
  if (world.score >= world.goal) milestones.push('goal');
  if (world.phase === 'playing')
    return { stage: 'playing', ...base, milestones };
  return {
    stage: 'finished',
    ...base,
    milestones,
    result:
      world.phase === 'won'
        ? { outcome: 'won', reason: 'goal-reached', score: world.score }
        : { outcome: 'lost', reason: 'goal-missed', score: world.score },
  };
}
