import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { AdventureSnapshot } from './types';

export const reelProblems3Analytics: GameAnalytics = {
  game: 'reel-problems-3',
  milestones: [
    { key: 'loaded', label: 'Loaded the boat' },
    { key: 'first-catch', label: 'Secured the first catch' },
    { key: 'missions', label: 'Completed all missions' },
    { key: 'home', label: 'Returned safely' },
  ],
  reasons: {
    'safe-return': 'Catch delivered safely',
    sunk: 'Boat sank',
    timeout: 'Round timer expired',
  },
  actions: {
    start: 'Started party round',
    interact: 'Used boat object',
    cast: 'Cast line',
    hook: 'Hooked fish',
    restart: 'Started another round',
  },
};

export function reelProblems3PlayState(snapshot: AdventureSnapshot): PlayState {
  const { world } = snapshot;
  const catches = world.items.filter(
    (item) => item.kind === 'fish' && item.state === 'secured',
  ).length;
  return {
    ...crewOf(
      { code: snapshot.code, id: snapshot.selfId },
      snapshot.host,
      world.players,
    ),
    stage:
      world.phase === 'lobby'
        ? 'lobby'
        : ['finished', 'failed'].includes(world.phase)
          ? 'finished'
          : 'playing',
    milestones: [
      ...(!['lobby', 'preparing'].includes(world.phase) ? ['loaded'] : []),
      ...(catches > 0 ? ['first-catch'] : []),
      ...(world.activeMission >= world.missions.length ? ['missions'] : []),
      ...(world.phase === 'finished' ? ['home'] : []),
    ],
    ...(['finished', 'failed'].includes(world.phase)
      ? {
          result: {
            outcome:
              world.phase === 'finished' ? ('won' as const) : ('lost' as const),
            reason:
              world.phase === 'finished'
                ? 'safe-return'
                : (world.round.result ?? 'timeout'),
            score: world.players.reduce(
              (sum, player) => sum + player.stats.score,
              0,
            ),
          },
        }
      : {}),
  };
}
