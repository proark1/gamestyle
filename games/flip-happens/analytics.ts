import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { Snapshot } from './types';
export const flipAnalytics: GameAnalytics = {
  game: 'flip-happens',
  milestones: [
    { key: 'first-flip', label: 'Threw an object' },
    { key: 'first-landing', label: 'Landed upright' },
    { key: 'banked', label: 'Secured a combo' },
    { key: 'triple', label: 'Built a triple combo' },
  ],
  reasons: { 'round-ended': 'Table round completed' },
  actions: {
    start: 'Started round',
    reset: 'Played again',
    mode: 'Changed mode',
    select: 'Changed object',
    bank: 'Banked points',
  },
};
export function flipPlayState(s: Snapshot): PlayState {
  const w = s.world,
    me = w.players.find((p) => p.id === s.selfId);
  return {
    ...crewOf(
      { code: s.code, id: s.selfId },
      s.host,
      w.players.filter((p) => w.mode !== 'daily' || !p.bot),
    ),
    stage:
      w.phase === 'lobby'
        ? 'lobby'
        : w.phase === 'ended'
          ? 'finished'
          : 'playing',
    milestones: [
      ...(me?.throws ? ['first-flip'] : []),
      ...(me?.lands ? ['first-landing'] : []),
      ...(me?.banks ? ['banked'] : []),
      ...((me?.bestCombo ?? 0) >= 3 ? ['triple'] : []),
    ],
    ...(w.phase === 'ended'
      ? {
          result: {
            outcome:
              w.winner === 'draw'
                ? ('ended' as const)
                : w.winner === me?.id
                  ? ('won' as const)
                  : ('lost' as const),
            reason: 'round-ended',
            score: me?.score ?? 0,
          },
        }
      : {}),
  };
}
