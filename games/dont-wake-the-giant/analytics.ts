import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { GiantSnapshot } from './types';

export const giantAnalytics: GameAnalytics = {
  game: 'dont-wake-the-giant',
  milestones: [
    { key: 'first-gold', label: 'Banked the first gold' },
    { key: 'half-gold', label: 'Banked half the target' },
    { key: 'enough-gold', label: 'Banked the full target' },
    { key: 'giant-woke', label: 'The giant woke up' },
    { key: 'first-escape', label: 'A thief got out' },
  ],
  reasons: {
    'crept-out': 'Everyone crept out before he woke',
    'woke-him': 'Noise woke the giant',
    sunrise: 'Sunrise woke the giant',
  },
  actions: {
    interact: 'Grabbed, banked or used something',
    pass: 'Passed loot down a ledge',
    drop: 'Dropped loot',
    tickle: 'Tickled his foot',
    help: 'Helped a dazed friend',
    exit: 'Left through the door',
    rotate: 'Turned the teaspoon bridge',
    start: 'Started the heist',
    restart: 'Started another heist',
  },
};

/** Sunrise schedules the wake-up 3 s after the deadline, then a 25 s escape. */
const SUNRISE_ESCAPE_MS = 28_000;

export function giantPlayState(
  snapshot: GiantSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length,
    round: world.started,
  };
  if (world.phase === 'lobby') return { stage: 'lobby', ...base };
  const milestones: string[] = [];
  if (world.banked > 0) milestones.push('first-gold');
  if (world.banked >= world.target / 2) milestones.push('half-gold');
  if (world.banked >= world.target) milestones.push('enough-gold');
  if (world.escapeAt > 0) milestones.push('giant-woke');
  if (world.players.some((player) => player.escaped))
    milestones.push('first-escape');
  if (world.phase === 'playing' || world.phase === 'escape')
    return { stage: 'playing', ...base, milestones };
  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: world.banked >= world.target ? 'won' : 'lost',
      reason: !world.escapeAt
        ? 'crept-out'
        : world.escapeAt >= world.deadline + SUNRISE_ESCAPE_MS
          ? 'sunrise'
          : 'woke-him',
      score: world.banked,
    },
  };
}
