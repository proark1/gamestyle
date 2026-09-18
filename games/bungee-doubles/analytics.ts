import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { BungeeSnapshot } from './types';

export const bungeeDoublesAnalytics: GameAnalytics = {
  game: 'bungee-doubles',
  milestones: [
    { key: 'first-point', label: 'First point scored' },
    { key: 'first-smash', label: 'First power smash hit' },
    { key: 'slingshot-boost', label: 'Executed partner slingshot' },
    { key: 'partner-bonk', label: 'Teammates collided head-on' },
    { key: 'epic-rally', label: 'Rally reached 5+ returns' },
    { key: 'match-win', label: 'Won the championship match' },
  ],
  reasons: {
    'target-reached': 'A team reached the target score',
    ended: 'Match concluded',
  },
  actions: {
    start: 'Started the match',
    restart: 'Restarted the match',
    swing: 'Volleyed the ball',
    smash: 'Smashed the ball',
    dive: 'Executed dive save',
    jump: 'Jumped',
    'switch-team': 'Switched team',
  },
};

export function bungeeDoublesPlayState(
  snapshot: BungeeSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const base = crewOf(session, snapshot.host, world.players);

  if (world.phase === 'lobby') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  const maxScore = Math.max(world.scores.orange, world.scores.teal);
  if (maxScore > 0) milestones.push('first-point');
  if (world.players.some((p) => p.smashes > 0)) milestones.push('first-smash');
  if (world.players.some((p) => p.slingshots > 0))
    milestones.push('slingshot-boost');
  if (world.players.some((p) => p.bonks > 0)) milestones.push('partner-bonk');
  if (world.maxRally >= 5) milestones.push('epic-rally');

  if (world.phase !== 'ended') {
    return { stage: 'playing', milestones, ...base };
  }

  milestones.push('match-win');
  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: world.winner ? 'won' : 'ended',
      reason: 'target-reached',
      score: maxScore,
    },
  };
}
