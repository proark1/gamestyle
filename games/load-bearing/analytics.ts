import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { LoadSnapshot } from './types';

export const loadBearingAnalytics: GameAnalytics = {
  game: 'load-bearing',
  milestones: [
    { key: 'first-break', label: 'Broke the first part' },
    { key: 'piano-hit', label: 'The piano took damage' },
    { key: 'half-down', label: 'Half the house came down' },
  ],
  reasons: {
    demolished: 'The house came down around the piano',
    'piano-destroyed': 'The piano was destroyed',
    'time-up': 'Time ran out',
  },
  actions: {
    swing: 'Swung the hammer',
    mark: 'Marked a part',
    help: 'Helped a friend up',
    crane: 'Took the crane',
    'crane-drop': 'Dropped the wrecking ball',
    wave: 'Waved',
    start: 'Started the job',
    restart: 'Started another job',
  },
};

/** A fresh site starts every round with this many standing parts. */
const STANDING_AT_START = 32;

export function loadBearingPlayState(
  snapshot: LoadSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((player) => player.bot).length;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots,
    round: world.seed,
  };
  if (world.phase === 'lobby') return { stage: 'lobby', ...base };
  const milestones: string[] = [];
  if (world.parts.some((part) => part.hits <= 0))
    milestones.push('first-break');
  if (world.piano.integrity < 100) milestones.push('piano-hit');
  if (world.standing <= STANDING_AT_START / 2) milestones.push('half-down');
  if (world.phase === 'playing')
    return { stage: 'playing', ...base, milestones };
  const score = Math.round(world.piano.integrity);
  return {
    stage: 'finished',
    ...base,
    milestones,
    result:
      world.phase === 'won'
        ? { outcome: 'won', reason: 'demolished', score }
        : {
            outcome: 'lost',
            reason: world.piano.integrity <= 0 ? 'piano-destroyed' : 'time-up',
            score,
          },
  };
}
