import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { BasketballSnapshot } from './types';

export const basketballAnalytics: GameAnalytics = {
  game: 'basketball',
  milestones: [
    { key: 'first-basket', label: 'First basket scored' },
    { key: 'first-three', label: 'First 3-pointer scored' },
    { key: 'first-dunk', label: 'First slam dunk' },
    { key: 'super-jump', label: 'Super jump combo executed' },
    { key: 'high-score', label: 'Team reached 10 points' },
  ],
  reasons: {
    'target-reached': 'A team reached the target score',
    ended: 'Match concluded',
  },
  actions: {
    start: 'Started the match',
    restart: 'Restarted the match',
    shoot: 'Took a shot',
    pass: 'Passed the ball',
    steal: 'Stole the ball',
    'super-jump': 'Activated super jump combo',
    'switch-team': 'Switched team',
  },
};

export function basketballPlayState(
  snapshot: BasketballSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((p) => p.bot).length;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots,
    round: 1,
  };

  if (world.phase === 'lobby') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  const maxScore = Math.max(world.scores.orange, world.scores.teal);
  if (maxScore > 0) milestones.push('first-basket');
  if (world.players.some((p) => p.dunks > 0)) milestones.push('first-dunk');
  if (world.players.some((p) => p.score >= 3)) milestones.push('first-three');
  if (world.players.some((p) => p.superJump)) milestones.push('super-jump');
  if (maxScore >= 10) milestones.push('high-score');

  if (world.phase === 'playing') {
    return { stage: 'playing', ...base, milestones };
  }

  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: world.winner ? 'won' : 'ended',
      reason: maxScore >= world.targetScore ? 'target-reached' : 'ended',
      score: maxScore,
    },
  };
}
