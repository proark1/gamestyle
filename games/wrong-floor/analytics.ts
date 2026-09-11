import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { HotelSnapshot } from './types';

export const hotelAnalytics: GameAnalytics = {
  game: 'wrong-floor',
  milestones: [
    { key: 'wrong-call', label: 'Made a wrong call and ran' },
    { key: 'stop-1', label: 'Cleared the first stop' },
    { key: 'stop-2', label: 'Cleared two stops' },
    { key: 'stop-3', label: 'Cleared three stops' },
    { key: 'stop-4', label: 'Cleared four stops' },
  ],
  reasons: {
    'checked-out': 'Cleared all five stops',
    'three-mistakes': 'Three wrong calls',
    'nobody-escaped': 'Nobody reached the elevator',
  },
  actions: {
    inspect: 'Inspected a clue',
    report: 'Shared a finding',
    vote: 'Voted to advance or retreat',
    start: 'Started the stay',
    restart: 'Started another stay',
  },
};

export function hotelPlayState(
  snapshot: HotelSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((player) => player.bot).length;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots,
    round: world.run,
  };
  if (world.phase === 'lobby') return { stage: 'lobby', ...base };
  const milestones: string[] = [];
  if (world.mistakes > 0) milestones.push('wrong-call');
  for (let stop = 1; stop <= 4; stop++)
    if (world.cleared >= stop) milestones.push(`stop-${stop}`);
  if (world.phase === 'playing' || world.phase === 'escape')
    return { stage: 'playing', ...base, milestones };
  return {
    stage: 'finished',
    ...base,
    milestones,
    result:
      world.phase === 'won'
        ? { outcome: 'won', reason: 'checked-out', score: world.cleared }
        : {
            outcome: 'lost',
            reason: world.mistakes >= 3 ? 'three-mistakes' : 'nobody-escaped',
            score: world.cleared,
          },
  };
}
