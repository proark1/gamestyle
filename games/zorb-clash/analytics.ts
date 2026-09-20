import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { ZorbClashSnapshot } from './types';

export const zorbClashAnalytics: GameAnalytics = {
  game: 'zorb-clash',
  milestones: [
    { key: 'first-bonk', label: 'First explosive zorb collision' },
    { key: 'first-turtle', label: 'First player tipped into turtle state' },
    { key: 'first-goal', label: 'First goal scored' },
    { key: 'bumper-dash-score', label: 'Bumper dash launch leading to goal' },
  ],
  reasons: {
    'target-score': 'A team reached the winning score',
    'time-up': 'Match time expired and highest score won',
  },
  actions: {
    start: 'Started the match',
    restart: 'Restarted the match',
    dash: 'Executed a bumper dash',
    brace: 'Braced against impact',
    'switch-team': 'Switched team',
  },
};

export function zorbClashPlayState(
  snapshot: ZorbClashSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const base = crewOf(session, snapshot.host, world.players);

  const milestones: string[] = [];
  if (world.bonkCount > 0) milestones.push('first-bonk');
  if (world.players.some((p) => p.turtle)) milestones.push('first-turtle');
  if (world.score.red > 0 || world.score.blue > 0)
    milestones.push('first-goal');

  if (
    world.status === 'playing' ||
    world.status === 'countdown' ||
    world.status === 'goal_scored'
  ) {
    return { stage: 'playing', ...base, milestones };
  }

  const winner =
    world.score.red > world.score.blue
      ? 'red'
      : world.score.blue > world.score.red
        ? 'blue'
        : 'draw';

  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: winner !== 'draw' ? 'won' : 'ended',
      reason:
        world.score.red >= 5 || world.score.blue >= 5
          ? 'target-score'
          : 'time-up',
      score: Math.max(world.score.red, world.score.blue),
    },
  };
}
