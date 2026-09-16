import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { SampleStampedeSnapshot } from './types';

export const sampleStampedeAnalytics: GameAnalytics = {
  game: 'sample-stampede',
  milestones: [
    { key: 'first-sample', label: 'Collected first free sample' },
    { key: 'first-drift', label: 'Executed squeaky-wheel drift slide' },
    { key: 'sugar-rush', label: 'Triggered sample sugar rush speed boost' },
    { key: 'shelf-tumbled', label: 'Tumbled a cereal box shelf pyramid' },
    {
      key: 'receipt-approved',
      label: 'Successfully cleared the Receipt Gauntlet',
    },
    {
      key: 'teddy-sabotage',
      label: 'Sabotaged rival with 10-foot giant teddy bear',
    },
  ],
  reasons: {
    'time-expired': 'Shopping derby clock ran out',
    forfeit: 'Competitor abandoned warehouse cart',
  },
  actions: {
    start: 'Started warehouse shopping derby',
    restart: 'Restarted the match',
    drift: 'Initiated shopping cart drift',
    grab: 'Used grabber pole',
    'sample-rush': 'Rushed to sample kiosk',
  },
};

export function sampleStampedePlayState(
  snapshot: SampleStampedeSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const bots = world.players.filter((p) => p.bot).length;
  const base = {
    mode: modeOf(session, snapshot.localPlayerId),
    room: session.code,
    humans: world.players.length - bots,
    npcs: bots,
    round: 1,
  };

  if (world.status === 'warmup') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  if (
    world.carts.some((c) => c.items.some((it) => it.kind.startsWith('sample_')))
  ) {
    milestones.push('first-sample');
  }
  if (world.carts.some((c) => c.driftSlip > 1.5)) {
    milestones.push('first-drift');
  }
  if (world.carts.some((c) => c.sugarRushTimer > 0)) {
    milestones.push('sugar-rush');
  }
  if (world.groundItems.some((it) => !it.onShelf && it.kind === 'cereal_box')) {
    milestones.push('shelf-tumbled');
  }
  if (world.carts.some((c) => c.score > 500)) {
    milestones.push('receipt-approved');
  }
  if (
    world.carts.some((c) => c.items.some((it) => it.kind === 'giant_teddy'))
  ) {
    milestones.push('teddy-sabotage');
  }

  if (world.status !== 'finished') {
    return { stage: 'playing', ...base, milestones };
  }

  const topScore = Math.max(
    world.teamScores.red,
    world.teamScores.blue,
    world.teamScores.yellow,
    world.teamScores.green,
  );

  return {
    stage: 'finished',
    ...base,
    milestones,
    result: {
      outcome: 'won',
      reason: 'time-expired',
      score: topScore,
    },
  };
}
