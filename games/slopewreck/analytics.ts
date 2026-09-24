import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { Snapshot } from './types';

export const slopewreckAnalytics: GameAnalytics = {
  game: 'slopewreck',
  milestones: [
    { key: 'first-trick', label: 'Landed a trick' },
    { key: 'first-feature', label: 'Built a course feature' },
    { key: 'finish', label: 'Crossed the finish line' },
  ],
  reasons: { 'race-ended': 'Slopewreck race completed' },
  actions: {
    start: 'Started race',
    reset: 'Raced again',
    jump: 'Jumped',
    'trick-ramp': 'Tried a ramp trick',
    'trick-rail': 'Tried a rail trick',
  },
};

export function slopewreckPlayState(s: Snapshot): PlayState {
  const w = s.world,
    me = w.players.find((p) => p.id === s.selfId);
  return {
    ...crewOf({ code: s.code, id: s.selfId }, s.host, w.players),
    stage:
      w.phase === 'lobby'
        ? 'lobby'
        : w.phase === 'ended'
          ? 'finished'
          : 'playing',
    milestones: [
      ...(me?.cleanLandings ? ['first-trick'] : []),
      ...(me?.featuresMade ? ['first-feature'] : []),
      ...(me?.finishAt ? ['finish'] : []),
    ],
    ...(w.phase === 'ended'
      ? {
          result: {
            outcome: w.winner === me?.id ? ('won' as const) : ('lost' as const),
            reason: 'race-ended',
            score: Math.round((me?.z ?? 0) + (me?.style ?? 0) / 10),
          },
        }
      : {}),
  };
}
