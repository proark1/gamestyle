import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { SiegeSnapshot } from './types';

export const siegeAnalytics: GameAnalytics = {
  game: 'siege-and-desist',
  milestones: [
    { key: 'first-volley', label: 'Fired the first shot' },
    { key: 'first-rubble', label: 'Knocked masonry loose' },
    { key: 'quarter-castle', label: 'A quarter of the castle came down' },
    { key: 'half-castle', label: 'Half of the castle came down' },
    { key: 'last-30s', label: 'Reached the last 30 seconds' },
  ],
  reasons: {
    'banner-down': 'Brought the banner down',
    dawn: 'Dawn broke first',
    'crew-left': 'The whole crew left',
  },
  actions: {
    wind: 'Wound the winch',
    push: 'Swung the aim',
    loose: 'Pulled the release lever',
    ride: 'Climbed into the sling',
    jump: 'Jumped',
    help: 'Hauled up a crewmate',
    start: 'Called the assault',
    restart: 'Started another siege',
  },
};

export function siegePlayState(
  snapshot: SiegeSnapshot,
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
  if (world.volleys > 0) milestones.push('first-volley');
  if (world.rubble > 0) milestones.push('first-rubble');
  if (world.rubble >= world.totalBlocks / 4) milestones.push('quarter-castle');
  if (world.rubble >= world.totalBlocks / 2) milestones.push('half-castle');
  if (world.phase === 'relief') milestones.push('last-30s');
  if (world.phase === 'playing' || world.phase === 'relief')
    return { stage: 'playing', ...base, milestones };
  return {
    stage: 'finished',
    ...base,
    milestones,
    result:
      world.phase === 'won'
        ? { outcome: 'won', reason: 'banner-down', score: world.rubble }
        : {
            outcome: 'lost',
            reason: world.players.length ? 'dawn' : 'crew-left',
            score: world.rubble,
          },
  };
}
