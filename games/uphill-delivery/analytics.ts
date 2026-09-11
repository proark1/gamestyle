import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { DeliverySnapshot } from './types';

export const deliveryAnalytics: GameAnalytics = {
  game: 'uphill-delivery',
  milestones: [
    { key: 'bridge', label: 'Reached the rope bridge' },
    { key: 'alley', label: 'Reached the village alley' },
    { key: 'broken-path', label: 'Reached the broken path' },
    { key: 'icy-stairs', label: 'Reached the icy stairs' },
    { key: 'front-door', label: 'Reached the front door' },
  ],
  reasons: { delivered: 'The sofa was delivered' },
  actions: {
    grab: 'Grabbed or let go of a corner',
    release: 'Let go of the sofa',
    rotate: 'Turned the sofa',
    interact: 'Worked a gate or door',
    'add-npc': 'Added an NPC',
    'fill-npcs': 'Filled seats with NPCs',
    'remove-npc': 'Removed an NPC',
    start: 'Started the delivery',
    restart: 'Restarted the delivery',
  },
};

/** The heights where `routeStage` in level.ts names the next part of the route. */
export const ROUTE_SECTIONS = [
  [3.5, 'bridge'],
  [7.5, 'alley'],
  [11.5, 'broken-path'],
  [15.5, 'icy-stairs'],
  [20, 'front-door'],
] as const;

export function deliveryPlayState(
  snapshot: DeliverySnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((player) => player.bot).length;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots,
    round: world.started,
  };
  if (world.phase === 'lobby') return { stage: 'lobby', ...base };
  const milestones = ROUTE_SECTIONS.filter(
    ([height]) => world.bestHeight >= height,
  ).map(([, key]) => key);
  if (world.phase === 'playing')
    return { stage: 'playing', ...base, milestones };
  return {
    stage: 'finished',
    ...base,
    milestones,
    result: { outcome: 'won', reason: 'delivered', score: world.drops },
  };
}
