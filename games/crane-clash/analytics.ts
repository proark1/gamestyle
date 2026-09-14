import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { CraneClashSnapshot } from './types';

export const craneClashAnalytics: GameAnalytics = {
  game: 'crane-clash',
  milestones: [
    { key: 'first-grab', label: 'First crate grabbed' },
    { key: 'first-stack', label: 'First crate stacked on platform' },
    { key: 'height-5m', label: 'Tower reached 5 meters' },
    { key: 'height-10m', label: 'Tower reached 10 meters' },
  ],
  reasons: {
    'target-reached': 'A team reached the 15m height goal',
    'time-up': 'Time expired and highest tower won',
  },
  actions: {
    start: 'Started the match',
    restart: 'Restarted the match',
    grab: 'Grabbed a crate',
    release: 'Released a crate',
    'switch-team': 'Switched team',
    'switch-role': 'Switched role',
  },
};

export function craneClashPlayState(
  snapshot: CraneClashSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((p) => p.bot).length;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots,
    round: world.seed,
  };

  if (world.phase === 'lobby') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  if (world.players.some((p) => p.holdingCrateId)) {
    milestones.push('first-grab');
  }
  const maxH = Math.max(world.scores.orange.height, world.scores.teal.height);
  if (maxH > 1.0) milestones.push('first-stack');
  if (maxH >= 5.0) milestones.push('height-5m');
  if (maxH >= 10.0) milestones.push('height-10m');

  if (world.phase === 'playing') {
    return { stage: 'playing', ...base, milestones };
  }

  const score = Math.round(maxH * 10) / 10;
  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: world.winner && world.winner !== 'draw' ? 'won' : 'ended',
      reason: maxH >= 15 ? 'target-reached' : 'time-up',
      score,
    },
  };
}
