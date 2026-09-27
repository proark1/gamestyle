import type { MissionKind } from '../types';
export type MissionDefinition = {
  kind: MissionKind;
  name: string;
  requires: 'school' | 'rare' | 'large' | 'fragile' | 'any';
  baseGoal: number;
};
export const MISSION_DEFINITIONS: Record<MissionKind, MissionDefinition> = {
  'species-quota': {
    kind: 'species-quota',
    name: 'Species order',
    requires: 'any',
    baseGoal: 3,
  },
  'weight-quota': {
    kind: 'weight-quota',
    name: 'Heavy haul',
    requires: 'any',
    baseGoal: 10,
  },
  'rare-fish': {
    kind: 'rare-fish',
    name: 'Lantern hunt',
    requires: 'rare',
    baseGoal: 1,
  },
  'team-fish': {
    kind: 'team-fish',
    name: 'Big one',
    requires: 'large',
    baseGoal: 1,
  },
  'fragile-catch': {
    kind: 'fragile-catch',
    name: 'Handle with care',
    requires: 'fragile',
    baseGoal: 1,
  },
  'moving-school': {
    kind: 'moving-school',
    name: 'Follow the school',
    requires: 'school',
    baseGoal: 4,
  },
};
export const MISSION_KINDS = Object.keys(MISSION_DEFINITIONS) as MissionKind[];
