import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { PanicCurlingSnapshot } from './types';

export const panicCurlingAnalytics: GameAnalytics = {
  game: 'panic-curling',
  milestones: [
    { key: 'first-delivery', label: 'First stone launched down ice' },
    { key: 'first-sweep', label: 'Swept ice path' },
    { key: 'ice-cracked', label: 'Pond ice cracked' },
    { key: 'button-scored', label: 'Stone landed in the button' },
  ],
  reasons: {
    'ends-completed': 'All curling ends completed',
    surrender: 'Team conceded the match',
  },
  actions: {
    start: 'Started the match',
    restart: 'Restarted the match',
    deliver: 'Delivered stone',
    sweep: 'Swept ice',
    'switch-team': 'Switched team',
    'switch-role': 'Switched role',
  },
};

export function panicCurlingPlayState(
  snapshot: PanicCurlingSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((p) => p.bot).length;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots,
    round: world.round,
  };

  if (world.phase === 'warmup') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  if (world.stones.length > 0) milestones.push('first-delivery');
  if (world.players.some((p) => p.sweepIntensity > 0))
    milestones.push('first-sweep');
  if (world.iceTiles.some((t) => t.cracked || t.broken))
    milestones.push('ice-cracked');
  if (world.stones.some((s) => s.distanceToTee < 0.5))
    milestones.push('button-scored');

  if (world.phase !== 'match_over') {
    return { stage: 'playing', ...base, milestones };
  }

  const score = Math.max(world.scores.red, world.scores.blue);
  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: 'won',
      reason: 'ends-completed',
      score,
    },
  };
}
