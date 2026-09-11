import type { GameAnalytics, PlayState } from '../../shared/analytics/protocol';
import type { Snapshot } from './model';

export const chaosAnalytics: GameAnalytics = {
  game: 'chaos',
  milestones: [
    { key: 'half-built', label: 'Built half the job checklist' },
    { key: 'all-built', label: 'Built the whole job checklist' },
    { key: 'last-call', label: 'Reached last call' },
    { key: 'rescue', label: 'Needed a last-second rescue' },
    { key: 'home-project', label: 'Finished a home project' },
  ],
  labels: {
    lobby: 'Waited in the crew lobby',
    playing: 'Started building',
    finished: 'Reached the inspection',
    won: 'Passed the inspection',
    again: 'Built another house',
  },
  reasons: {
    'inspection-passed': 'Passed the inspection',
    'inspection-failed': 'Failed the inspection',
  },
  actions: {
    build: 'Built a part',
    remove: 'Removed a part',
    paint: 'Painted',
    grab: 'Picked something up',
    drop: 'Put something down',
    throw: 'Threw something',
    use: 'Tried out an object',
    emote: 'Emoted',
    'crane-pick': 'Lifted with the crane',
    'crane-place': 'Placed with the crane',
    'crane-cancel': 'Cancelled a crane lift',
    reset: 'Started a new round',
  },
};

/** Progress helpers live in the game model, so the caller passes their results. */
export type ChaosProgress = { checklist: number; projectDone: boolean };

export function chaosPlayState(
  snapshot: Snapshot,
  session: { code: string; id: string },
  progress: ChaosProgress,
): PlayState {
  const { world } = snapshot;
  const party = world.party;
  const base = {
    mode: snapshot.host === session.id ? ('host' as const) : ('join' as const),
    room: session.code,
    humans: snapshot.players.length,
    round: party?.roundId ?? `round-${world.round}`,
  };
  if (party?.phase === 'lobby') return { stage: 'lobby', ...base };
  const milestones: string[] = [];
  if (world.mode === 'job') {
    if (progress.checklist >= 0.5) milestones.push('half-built');
    if (progress.checklist >= 1) milestones.push('all-built');
  } else if (progress.projectDone) milestones.push('home-project');
  if (party && party.phase !== 'building') milestones.push('last-call');
  if (party?.phase === 'rescue') milestones.push('rescue');
  if (!party || ['building', 'lastCall', 'rescue'].includes(party.phase))
    return { stage: 'playing', ...base, milestones };
  const passed = party.result?.passed;
  return {
    stage: 'finished',
    ...base,
    milestones,
    result:
      passed === undefined
        ? { outcome: 'ended' }
        : {
            outcome: passed ? 'won' : 'lost',
            reason: passed ? 'inspection-passed' : 'inspection-failed',
            score: Math.round(progress.checklist * 100),
          },
  };
}
