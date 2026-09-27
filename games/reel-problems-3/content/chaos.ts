import type { IncidentKind } from '../types';
export type ChaosDefinition = {
  kind: IncidentKind;
  name: string;
  severity: 'minor' | 'major';
  durationMs: number;
  phases: readonly ('outbound' | 'fishing' | 'returning')[];
  requires?: 'lines' | 'catch' | 'engine' | 'net';
};
export const CHAOS_DEFINITIONS: Record<IncidentKind, ChaosDefinition> = {
  'deck-wave': {
    kind: 'deck-wave',
    name: 'Broadside wave',
    severity: 'minor',
    durationMs: 5200,
    phases: ['outbound', 'fishing', 'returning'],
  },
  'line-tangle': {
    kind: 'line-tangle',
    name: 'Crossed lines',
    severity: 'minor',
    durationMs: 9000,
    phases: ['fishing'],
    requires: 'lines',
  },
  'fish-pull': {
    kind: 'fish-pull',
    name: 'Fish on the run',
    severity: 'minor',
    durationMs: 6000,
    phases: ['fishing'],
    requires: 'lines',
  },
  seabirds: {
    kind: 'seabirds',
    name: 'Bait bandits',
    severity: 'minor',
    durationMs: 9000,
    phases: ['outbound', 'fishing', 'returning'],
  },
  'engine-stall': {
    kind: 'engine-stall',
    name: 'Engine stalled',
    severity: 'major',
    durationMs: 30000,
    phases: ['outbound', 'fishing', 'returning'],
    requires: 'engine',
  },
  'hull-leak': {
    kind: 'hull-leak',
    name: 'Hull leak',
    severity: 'major',
    durationMs: 30000,
    phases: ['outbound', 'fishing', 'returning'],
  },
  'fog-bank': {
    kind: 'fog-bank',
    name: 'Fog bank',
    severity: 'minor',
    durationMs: 15000,
    phases: ['outbound', 'fishing', 'returning'],
  },
  'debris-field': {
    kind: 'debris-field',
    name: 'Debris field',
    severity: 'major',
    durationMs: 18000,
    phases: ['outbound', 'returning'],
  },
  'fish-escape': {
    kind: 'fish-escape',
    name: 'Slippery catch',
    severity: 'minor',
    durationMs: 7000,
    phases: ['fishing', 'returning'],
    requires: 'catch',
  },
  'torn-net': {
    kind: 'torn-net',
    name: 'Torn net',
    severity: 'major',
    durationMs: 30000,
    phases: ['fishing'],
    requires: 'net',
  },
};
export const INCIDENT_KINDS = Object.keys(CHAOS_DEFINITIONS) as IncidentKind[];
