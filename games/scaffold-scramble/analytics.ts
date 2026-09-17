import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { ScaffoldSnapshot } from './types';

export const scaffoldScrambleAnalytics: GameAnalytics = {
  game: 'scaffold-scramble',
  milestones: [
    { key: 'first-crank', label: 'First winch cranked' },
    { key: 'first-clean', label: 'First window cleaned spotless' },
    { key: 'cradle-tilt-20', label: 'Platform tilted past 20 degrees' },
    { key: 'first-dangle', label: 'Cleaner slipped off and dangled by tether' },
    { key: 'clean-15', label: 'Halfway point: 15 windows cleaned' },
    { key: 'clean-30', label: 'All 30 dirty windows cleaned' },
  ],
  reasons: {
    'all-clean':
      'All 30 windows were cleaned spotless before the helicopter landed',
    'time-up': 'CEO helicopter arrived before all windows were clean',
  },
  actions: {
    start: 'Started the window cleaning shift',
    restart: 'Restarted the shift',
    crank: 'Cranked suspension winch',
    'use-tool': 'Applied soap foam or wiped with squeegee',
    'switch-tool': 'Switched between sponge and squeegee',
    shoo: 'Shooed away cable pigeon',
    climb: 'Climbed back onto deck from safety tether',
  },
};

export function scaffoldScramblePlayState(
  snapshot: ScaffoldSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const base = crewOf(session, snapshot.host, world.players, world.seed);

  if (world.phase === 'lobby') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  if (world.cleanedCount > 0) milestones.push('first-clean');
  if (world.cleanedCount >= 15) milestones.push('clean-15');
  if (world.cleanedCount >= 30) milestones.push('clean-30');
  if (Math.abs(world.cradle.tiltDeg) >= 20.0) milestones.push('cradle-tilt-20');
  if (world.players.some((p) => p.dangles > 0)) milestones.push('first-dangle');

  if (world.phase === 'playing') {
    return { stage: 'playing', ...base, milestones };
  }

  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: world.winner === 'crew' ? 'won' : 'ended',
      reason: world.winner === 'crew' ? 'all-clean' : 'time-up',
      score: world.cleanedCount,
    },
  };
}
