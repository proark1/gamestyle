import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { CourseSnapshot } from './types';

export const courseCorrectionAnalytics: GameAnalytics = {
  game: 'course-correction',
  milestones: [
    { key: 'first-shot', label: 'Took a shot' },
    { key: 'first-cup', label: 'Sank a ball' },
    { key: 'first-assist', label: 'Earned an assist' },
  ],
  reasons: { 'match-ended': 'Course Correction match completed' },
  actions: {
    start: 'Started match',
    shoot: 'Took a shot',
    lock: 'Locked opening shot',
    restart: 'Played again',
  },
};

export function courseCorrectionPlayState(snapshot: CourseSnapshot): PlayState {
  const { world } = snapshot;
  const me = world.players.find((p) => p.id === snapshot.selfId);
  return {
    ...crewOf(
      { code: snapshot.code, id: snapshot.selfId },
      snapshot.host,
      world.players,
    ),
    stage:
      world.phase === 'lobby'
        ? 'lobby'
        : world.phase === 'match_over'
          ? 'finished'
          : 'playing',
    milestones: [
      ...(me?.totalStrokes || me?.holeStrokes ? ['first-shot'] : []),
      ...(me?.finishedAt ? ['first-cup'] : []),
      ...(me?.assists ? ['first-assist'] : []),
    ],
    ...(world.phase === 'match_over' && me
      ? {
          result: {
            outcome:
              me.totalStrokes ===
              Math.min(...world.players.map((p) => p.totalStrokes))
                ? ('won' as const)
                : ('lost' as const),
            reason: 'match-ended',
            score: me.totalStrokes,
          },
        }
      : {}),
  };
}
