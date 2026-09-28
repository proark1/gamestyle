import type {
  PersonalObjectiveId,
  PersonalObjectiveProgress,
  PersonalObjectiveState,
  VoyageFact,
} from './voyage-types';

export type PersonalObjectiveDefinition = {
  id: PersonalObjectiveId;
  title: string;
  instruction: string;
  target: number;
  soloEligible: true;
  sabotageSafe: true;
};

export const PERSONAL_OBJECTIVES: readonly PersonalObjectiveDefinition[] = [
  {
    id: 'storm-catch',
    title: 'Storm Catch',
    instruction: 'Land a catch during rough weather.',
    target: 1,
    soloEligible: true,
    sabotageSafe: true,
  },
  {
    id: 'patch-up',
    title: 'Patch Crew',
    instruction: 'Help finish a hull repair.',
    target: 1,
    soloEligible: true,
    sabotageSafe: true,
  },
  {
    id: 'stay-aboard',
    title: 'Sea Legs',
    instruction: 'Finish the voyage without going overboard.',
    target: 1,
    soloEligible: true,
    sabotageSafe: true,
  },
];

const byId = new Map(PERSONAL_OBJECTIVES.map((item) => [item.id, item]));

export function assignPersonalObjectives(
  seed: number,
  playerIds: readonly string[],
): PersonalObjectiveState {
  return Object.fromEntries(
    [...playerIds].sort().map((playerId, index) => {
      const id =
        PERSONAL_OBJECTIVES[(seed + index) % PERSONAL_OBJECTIVES.length].id;
      const definition = byId.get(id)!;
      return [
        playerId,
        {
          id,
          playerId,
          progress: 0,
          target: definition.target,
          status: 'active',
          seenFactIds: [],
        } satisfies PersonalObjectiveProgress,
      ];
    }),
  );
}

export function applyObjectiveFact(
  objectives: PersonalObjectiveState,
  fact: VoyageFact,
) {
  for (const objective of Object.values(objectives)) {
    if (
      objective.status !== 'active' ||
      objective.seenFactIds.includes(fact.id)
    )
      continue;
    let relevant = false;
    if (objective.id === 'storm-catch')
      relevant =
        fact.kind === 'catch' &&
        fact.actorId === objective.playerId &&
        fact.tags.includes('rough-weather');
    else if (objective.id === 'patch-up')
      relevant = fact.kind === 'repair' && fact.actorId === objective.playerId;
    else if (
      objective.id === 'stay-aboard' &&
      fact.kind === 'overboard' &&
      fact.actorId === objective.playerId
    ) {
      objective.status = 'failed';
      relevant = true;
    } else if (objective.id === 'stay-aboard' && fact.kind === 'run-finished')
      relevant = true;
    if (!relevant) continue;
    objective.seenFactIds.push(fact.id);
    if (objective.status === 'failed') continue;
    objective.progress = Math.min(objective.target, objective.progress + 1);
    if (objective.progress >= objective.target) objective.status = 'completed';
  }
}

export function neutralizePersonalObjective(
  objectives: PersonalObjectiveState | undefined,
  playerId: string,
) {
  const objective = objectives?.[playerId];
  if (objective?.status === 'active') objective.status = 'neutral';
}

export function personalObjectiveDefinition(id: PersonalObjectiveId) {
  return byId.get(id)!;
}
