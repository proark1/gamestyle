import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { Snapshot } from './types';

export const stackAnalytics: GameAnalytics = {
  game: 'stack-or-sink',
  milestones: [
    { key: 'flood', label: 'The flood started rising' },
    { key: 'tower-5m', label: 'The tower reached 5 m' },
    { key: 'tower-10m', label: 'The tower reached 10 m' },
    { key: 'rescued', label: 'Someone reached the platform' },
  ],
  reasons: {
    rescued: 'Someone reached the rescue platform',
    drowned: 'The whole crew went under',
  },
  actions: {
    grab: 'Picked up salvage',
    place: 'Placed salvage',
    rotate: 'Rotated salvage',
    crane: 'Took the crane',
    'crane-drop': 'Dropped a crane load',
    rescue: 'Rescued a teammate',
    wave: 'Called the crew over',
    start: 'Started the flood',
    restart: 'Started a rematch',
  },
};

/** Normal rounds give the crew a minute before the water moves. */
const FLOOD_DELAY_MS = 60_000;

export function stackPlayState(
  snapshot: Snapshot,
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
  if (world.mode === 'normal' && world.clock - world.started >= FLOOD_DELAY_MS)
    milestones.push('flood');
  if (world.bestHeight >= 5) milestones.push('tower-5m');
  if (world.bestHeight >= 10) milestones.push('tower-10m');
  if (world.players.some((player) => player.rescued))
    milestones.push('rescued');
  if (world.phase === 'playing')
    return { stage: 'playing', ...base, milestones };
  const score = Math.round(world.bestHeight * 10) / 10;
  return {
    stage: 'finished',
    ...base,
    milestones,
    result:
      world.phase === 'won'
        ? { outcome: 'won', reason: 'rescued', score }
        : { outcome: 'lost', reason: 'drowned', score },
  };
}
