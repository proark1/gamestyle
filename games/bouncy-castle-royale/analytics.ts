import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { Snapshot } from './types';
export const castleAnalytics: GameAnalytics = {
  game: 'bouncy-castle-royale',
  milestones: [
    { key: 'first-hit', label: 'Hit a volley' },
    { key: 'first-jump', label: 'Bounced' },
    { key: 'pumped', label: 'Pumped the castle' },
  ],
  reasons: { 'match-ended': 'Castle match completed' },
  actions: {
    start: 'Started match',
    reset: 'Played again',
    air: 'Changed air setting',
    'switch-team': 'Changed team',
  },
};
export function castlePlayState(s: Snapshot): PlayState {
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
      ...(me?.hits ? ['first-hit'] : []),
      ...(me?.jumps ? ['first-jump'] : []),
      ...(me?.pumped ? ['pumped'] : []),
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
            score: me ? w.scores[me.team] : 0,
          },
        }
      : {}),
  };
}
