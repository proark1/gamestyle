import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { Snapshot } from './types';
import { score } from './styles';
export const cageAnalytics: GameAnalytics = {
  game: 'cage-clash',
  milestones: [
    { key: 'first-strike', label: 'Threw a strike' },
    { key: 'first-takedown', label: 'Landed a takedown' },
    { key: 'submission', label: 'Won by submission' },
  ],
  reasons: { 'match-ended': 'MMA match completed' },
  actions: { commit: 'Locked a fighting style', reset: 'Played again' },
};
export function cagePlayState(s: Snapshot): PlayState {
  const w = s.world,
    me = w.players.find((p) => p.id === s.selfId);
  return {
    ...crewOf({ code: s.code, id: s.selfId }, s.host, w.players),
    stage:
      w.phase === 'selection'
        ? 'lobby'
        : w.phase === 'ended'
          ? 'finished'
          : 'playing',
    milestones: [
      ...(w.players.some((p) => p.punches > 0) ? ['first-strike'] : []),
      ...(w.players.some((p) => p.takedowns > 0) ? ['first-takedown'] : []),
      ...(w.finish === 'Submission' ? ['submission'] : []),
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
            score: me ? score(me) : 0,
          },
        }
      : {}),
  };
}
