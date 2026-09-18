import {
  crewOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { CarryOnSnapshot } from './types';

export const carryOnCarnageAnalytics: GameAnalytics = {
  game: 'carry-on-carnage',
  milestones: [
    { key: 'packed-luggage', label: 'Packed vacation junk into suitcase' },
    {
      key: 'compressed-luggage',
      label: 'Sat on luggage to compress bulging seams',
    },
    { key: 'zipped-luggage', label: 'Successfully pulled zipper closed' },
    {
      key: 'sizer-passed',
      label: 'Baggage passed the dreaded metal sizer box',
    },
    { key: 'pinata-burst', label: 'Suitcase violently burst like a piñata' },
    { key: 'contraband-smuggled', label: 'Smuggled live lobster past TSA' },
  ],
  reasons: {
    'flight-departed': 'Flight 707 took off for vacation',
    'fees-avoided': 'Crew boarded with all bags approved and zero fees',
    bankrupted: 'Crew bankrupted by $150 airline gate fees',
  },
  actions: {
    start: 'Started packing scramble',
    restart: 'Restarted flight scramble',
    grab: 'Packed or picked up item',
    compress: 'Sat on luggage to compress',
    zip: 'Pulled luggage zipper',
    drop: 'Dropped item or suitcase',
  },
};

export function carryOnCarnagePlayState(
  snapshot: CarryOnSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const base = crewOf(session, snapshot.session.host, world.players);

  if (world.phase === 'lobby') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  if (world.suitcases.some((s) => s.items.length > 0)) {
    milestones.push('packed-luggage');
  }
  if (world.suitcases.some((s) => s.compression > 0.4)) {
    milestones.push('compressed-luggage');
  }
  if (world.suitcases.some((s) => s.zipped >= 0.95)) {
    milestones.push('zipped-luggage');
  }
  if (world.approvedCount > 0) {
    milestones.push('sizer-passed');
  }
  if (world.suitcases.some((s) => s.burst)) {
    milestones.push('pinata-burst');
  }
  if (world.contrabandCount > 0) {
    milestones.push('contraband-smuggled');
  }

  if (world.phase !== 'flight_departed') {
    return { stage: 'playing', ...base, milestones };
  }

  const reason =
    world.feesPaid > 600
      ? 'bankrupted'
      : world.approvedCount >= world.targetBags && world.feesPaid === 0
        ? 'fees-avoided'
        : 'flight-departed';

  return {
    stage: 'finished',
    result: {
      outcome: world.totalScore > 0 ? 'won' : 'lost',
      reason,
      score: world.totalScore,
    },
    ...base,
    milestones,
  };
}
