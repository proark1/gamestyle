export type VoyageFactKind =
  | 'director-warning'
  | 'director-active'
  | 'director-complete'
  | 'director-cancelled'
  | 'catch'
  | 'overboard'
  | 'rescue'
  | 'repair'
  | 'run-finished';

export type VoyageFact = {
  id: string;
  at: number;
  kind: VoyageFactKind;
  actorId?: string;
  targetId?: string;
  objectId?: string;
  sourceEventId?: string;
  causeFactId?: string;
  severity: number;
  benefit: number;
  playerCaused: boolean;
  tags: string[];
};

export type VoyageStoryState = {
  nextFact: number;
  facts: VoyageFact[];
  dedupe: string[];
};

export type PersonalObjectiveId = 'storm-catch' | 'patch-up' | 'stay-aboard';
export type PersonalObjectiveStatus =
  | 'active'
  | 'completed'
  | 'failed'
  | 'neutral';

export type PersonalObjectiveProgress = {
  id: PersonalObjectiveId;
  playerId: string;
  progress: number;
  target: number;
  status: PersonalObjectiveStatus;
  seenFactIds: string[];
};

export type PersonalObjectiveState = Record<string, PersonalObjectiveProgress>;
