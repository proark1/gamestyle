import type { VoyageAct, VoyageEventDefinition } from './chaos-director';

const ACTS: readonly VoyageAct[] = ['plan', 'escalation', 'finale', 'complete'];

export function validateVoyageCatalog(
  catalog: readonly VoyageEventDefinition[],
) {
  const errors: string[] = [],
    known = new Set<string>();
  for (const definition of catalog) {
    if (!definition.id.trim()) errors.push('Event id cannot be empty.');
    else if (known.has(definition.id))
      errors.push(`Duplicate event id: ${definition.id}.`);
    known.add(definition.id);
  }
  for (const definition of catalog) {
    const at = `Event ${definition.id || '<empty>'}`;
    if (
      !definition.acts.length ||
      definition.acts.some((act) => !ACTS.includes(act))
    )
      errors.push(`${at} has an invalid act range.`);
    if (!Number.isFinite(definition.warningMs) || definition.warningMs < 0)
      errors.push(`${at} has an invalid warning duration.`);
    if (!Number.isFinite(definition.cooldownMs) || definition.cooldownMs < 0)
      errors.push(`${at} has an invalid cooldown.`);
    if (!Number.isFinite(definition.danger) || definition.danger < 0)
      errors.push(`${at} has an invalid danger cost.`);
    if (!Number.isFinite(definition.weight) || definition.weight <= 0)
      errors.push(`${at} has an invalid weight.`);
    if (typeof definition.eligible !== 'function')
      errors.push(`${at} is missing its eligibility handler.`);
    if (typeof definition.targets !== 'function')
      errors.push(`${at} is missing its target handler.`);
    if (!definition.activation)
      errors.push(`${at} is missing its activation action.`);
    if (typeof definition.complete !== 'function')
      errors.push(`${at} is missing its completion handler.`);
    if (typeof definition.cancel !== 'function')
      errors.push(`${at} is missing its cancellation handler.`);
    if (!definition.recovery)
      errors.push(`${at} is missing its recovery path.`);
    else if (
      definition.recovery.kind === 'quiet' &&
      (!Number.isFinite(definition.recovery.durationMs) ||
        definition.recovery.durationMs < 0)
    )
      errors.push(`${at} has an invalid recovery duration.`);
    for (const incompatible of definition.incompatible ?? [])
      if (!known.has(incompatible))
        errors.push(`${at} names unknown incompatibility ${incompatible}.`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return catalog;
}

const crew = () => ['crew'];
const afloat = (flags: readonly string[]) => !flags.includes('boat-sunk');
const after =
  (durationMs: number) =>
  (_observation: { now: number }, instance: { activateAt: number }) =>
    _observation.now >= instance.activateAt + durationMs;

export const CHAOS_VOYAGE_CATALOG = validateVoyageCatalog([
  {
    id: 'hard-gust',
    category: 'disruption',
    acts: ['plan'],
    urgent: true,
    danger: 1,
    warningMs: 3_000,
    cooldownMs: 45_000,
    weight: 3,
    incompatible: [],
    eligible: (observation) => afloat(observation.flags),
    targets: crew,
    activation: 'weather:hard-gust',
    complete: after(9_000),
    cancel: (observation) => !afloat(observation.flags),
    recovery: { kind: 'quiet', durationMs: 6_000 },
  },
  {
    id: 'driftwood-rush',
    category: 'disruption',
    acts: ['escalation'],
    urgent: true,
    danger: 1,
    warningMs: 2_500,
    cooldownMs: 55_000,
    weight: 2,
    incompatible: [],
    eligible: (observation) =>
      afloat(observation.flags) && observation.flags.includes('debris-ready'),
    targets: crew,
    activation: 'debris:rush',
    complete: after(10_000),
    cancel: (observation) => !afloat(observation.flags),
    recovery: { kind: 'quiet', durationMs: 6_000 },
  },
  {
    id: 'shark-circle',
    category: 'reaction',
    acts: ['escalation'],
    urgent: false,
    danger: 1,
    warningMs: 3_500,
    cooldownMs: 70_000,
    weight: 2,
    incompatible: [],
    eligible: (observation) => observation.flags.includes('shark-ready'),
    targets: crew,
    activation: 'wildlife:shark-circle',
    complete: after(12_000),
    cancel: () => false,
    recovery: { kind: 'quiet', durationMs: 7_000 },
  },
  {
    id: 'rogue-wave',
    category: 'finale',
    acts: ['finale'],
    urgent: true,
    danger: 3,
    warningMs: 4_000,
    cooldownMs: 75_000,
    weight: 1,
    incompatible: [],
    eligible: (observation) => afloat(observation.flags),
    targets: crew,
    activation: 'weather:rogue-wave',
    complete: after(12_000),
    cancel: (observation) => !afloat(observation.flags),
    recovery: { kind: 'quiet', durationMs: 8_000 },
  },
] satisfies VoyageEventDefinition[]);

export const FOUNDATION_VOYAGE_CATALOG = CHAOS_VOYAGE_CATALOG;

export const CHAOS_EVENT_PRESENTATION = {
  'hard-gust': {
    title: 'Hard Gust',
    warning: 'Hard gust incoming — brace!',
    active: 'The crosswind is here. Hold Shift to stay planted.',
    kind: 'weather' as const,
  },
  'driftwood-rush': {
    title: 'Driftwood Rush',
    warning: 'A log is bearing down on the hull!',
    active: 'Driftwood rush — steer clear of the impact line.',
    kind: 'ram' as const,
  },
  'shark-circle': {
    title: 'Shark Circle',
    warning: 'A fin is circling the boat. Keep the crew aboard!',
    active: 'Shark in the water — rescue swimmers quickly.',
    kind: 'shark' as const,
  },
  'rogue-wave': {
    title: 'Rogue Wave',
    warning: 'ROGUE WAVE — BRACE!',
    active: 'The rogue wave hit. Hold Shift and ride it out!',
    kind: 'thunder' as const,
  },
} as const;

export function chaosEventPresentation(id: string) {
  return CHAOS_EVENT_PRESENTATION[id as keyof typeof CHAOS_EVENT_PRESENTATION];
}
