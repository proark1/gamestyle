import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { Snapshot } from './types';
export const boxingAnalytics: GameAnalytics = {
  game: 'on-the-ropes',
  milestones: [
    { key: 'first-punch', label: 'Threw a punch' },
    { key: 'first-tag', label: 'Tagged a teammate' },
    { key: 'first-knockdown', label: 'Scored a knockdown' },
  ],
  reasons: { 'match-ended': 'Boxing match completed' },
  actions: {
    ready: 'Started boxing',
    reset: 'Played again',
    'switch-team': 'Changed team',
    'switch-role': 'Changed starting role',
  },
};
export function boxingPlayState(s: Snapshot): PlayState {
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
      ...(w.players.some((p) => p.punches > 0) ? ['first-punch'] : []),
      ...(w.players.some((p) => p.tags > 0) ? ['first-tag'] : []),
      ...(w.teams.red.score + w.teams.blue.score > 0
        ? ['first-knockdown']
        : []),
    ],
    ...(w.phase === 'ended'
      ? {
          result: {
            outcome:
              w.winner === 'draw'
                ? ('ended' as const)
                : w.winner === me?.team
                  ? ('won' as const)
                  : ('lost' as const),
            reason: 'match-ended',
            score: me ? w.teams[me.team].score : 0,
          },
        }
      : {}),
  };
}
