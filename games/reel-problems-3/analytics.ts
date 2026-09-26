import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { AdventureSnapshot } from './types';

export const reelProblems3Analytics: GameAnalytics = {
  game: 'reel-problems-3',
  milestones: [
    { key: 'departed', label: 'Left the harbor' },
    { key: 'beacons', label: 'Awakened all beacons' },
    { key: 'storm', label: 'Entered the storm' },
    { key: 'sanctuary', label: 'Reached the sanctuary' },
    { key: 'home', label: 'Finished the voyage' },
  ],
  reasons: { 'voyage-complete': 'Legendary fish reached the sanctuary' },
  actions: {
    start: 'Started voyage',
    interact: 'Used adventure object',
    restart: 'Started another voyage',
  },
};

export function reelProblems3PlayState(snapshot: AdventureSnapshot): PlayState {
  const { world } = snapshot;
  return {
    ...crewOf(
      { code: snapshot.code, id: snapshot.selfId },
      snapshot.host,
      world.players,
    ),
    stage:
      world.phase === 'lobby'
        ? 'lobby'
        : world.phase === 'finished'
          ? 'finished'
          : 'playing',
    milestones: [
      ...(world.phase !== 'lobby' ? ['departed'] : []),
      ...(world.beacons.every((beacon) => beacon.active) ? ['beacons'] : []),
      ...(['storm', 'sanctuary', 'homecoming', 'finished'].includes(world.phase)
        ? ['storm']
        : []),
      ...(['sanctuary', 'homecoming', 'finished'].includes(world.phase)
        ? ['sanctuary']
        : []),
      ...(world.phase === 'finished' ? ['home'] : []),
    ],
    ...(world.phase === 'finished'
      ? {
          result: {
            outcome: 'won' as const,
            reason: 'voyage-complete',
            score: world.fishTrust,
          },
        }
      : {}),
  };
}
