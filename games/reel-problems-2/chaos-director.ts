export type VoyageAct = 'plan' | 'escalation' | 'finale' | 'complete';
export type VoyageEventCategory =
  | 'setup'
  | 'disruption'
  | 'reaction'
  | 'recovery'
  | 'finale';
export type VoyageEventStatus = 'warned' | 'active' | 'completed' | 'cancelled';

export type DirectorObservation = {
  now: number;
  phase: 'playing' | 'finished';
  struggling: boolean;
  playerIds: readonly string[];
  flags: readonly string[];
};

export type VoyageEventInstance = {
  id: string;
  definitionId: string;
  target: string;
  status: VoyageEventStatus;
  warnedAt: number;
  activateAt: number;
  resolvedAt?: number;
};

export type VoyageRecovery =
  | { kind: 'none' }
  | { kind: 'quiet'; durationMs: number };

export type VoyageEventDefinition = {
  id: string;
  category: VoyageEventCategory;
  acts: readonly VoyageAct[];
  urgent: boolean;
  danger: number;
  warningMs: number;
  cooldownMs: number;
  weight: number;
  incompatible: readonly string[];
  eligible: (observation: DirectorObservation) => boolean;
  targets: (observation: DirectorObservation) => readonly string[];
  activation: string;
  complete: (
    observation: DirectorObservation,
    instance: VoyageEventInstance,
  ) => boolean;
  cancel: (
    observation: DirectorObservation,
    instance: VoyageEventInstance,
  ) => boolean;
  recovery: VoyageRecovery;
};

export type VoyageDirectorState = {
  version: 1;
  seed: number;
  startedAt: number;
  act: VoyageAct;
  nextEventAt: number;
  nextInstance: number;
  recoveryUntil: number;
  cooldowns: Record<string, number>;
  events: VoyageEventInstance[];
};

export type DirectorTransition = {
  eventId: string;
  definitionId: string;
  target: string;
  status: VoyageEventStatus;
  action?: string;
};

export type DirectorConfig = {
  planMs: number;
  finaleAtMs: number;
  durationMs: number;
  maxUrgent: number;
  budgets: Record<VoyageAct, number>;
  gaps: Record<VoyageAct, number>;
};

export const DEFAULT_DIRECTOR_CONFIG: DirectorConfig = {
  planMs: 120_000,
  finaleAtMs: 360_000,
  durationMs: 540_000,
  maxUrgent: 2,
  budgets: { plan: 1, escalation: 2, finale: 3, complete: 0 },
  gaps: {
    plan: 24_000,
    escalation: 14_000,
    finale: 18_000,
    complete: Infinity,
  },
};

const live = (status: VoyageEventStatus) =>
  status === 'warned' || status === 'active';

const actAt = (elapsed: number, config: DirectorConfig): VoyageAct =>
  elapsed >= config.durationMs
    ? 'complete'
    : elapsed >= config.finaleAtMs
      ? 'finale'
      : elapsed >= config.planMs
        ? 'escalation'
        : 'plan';

function draw(seed: number) {
  const next = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return { seed: next, value: next / 4294967296 };
}

export function freshDirectorState(
  seed: number,
  startedAt: number,
  _config: DirectorConfig = DEFAULT_DIRECTOR_CONFIG,
): VoyageDirectorState {
  return {
    version: 1,
    seed: seed >>> 0,
    startedAt,
    act: 'plan',
    nextEventAt: startedAt,
    nextInstance: 1,
    recoveryUntil: startedAt,
    cooldowns: {},
    events: [],
  };
}

function definitionMap(catalog: readonly VoyageEventDefinition[]) {
  return new Map(catalog.map((definition) => [definition.id, definition]));
}

function currentDanger(
  state: VoyageDirectorState,
  definitions: Map<string, VoyageEventDefinition>,
) {
  let danger = 0;
  for (const instance of state.events) {
    if (!live(instance.status)) continue;
    danger += definitions.get(instance.definitionId)?.danger ?? 0;
  }
  return danger;
}

function compatible(
  candidate: VoyageEventDefinition,
  active: readonly VoyageEventDefinition[],
) {
  return active.every(
    (other) =>
      !candidate.incompatible.includes(other.id) &&
      !other.incompatible.includes(candidate.id),
  );
}

export function advanceDirector(
  original: VoyageDirectorState,
  observation: DirectorObservation,
  catalog: readonly VoyageEventDefinition[],
  config: DirectorConfig = DEFAULT_DIRECTOR_CONFIG,
): { state: VoyageDirectorState; transitions: DirectorTransition[] } {
  const nextAct =
      observation.phase === 'finished'
        ? 'complete'
        : actAt(observation.now - original.startedAt, config),
    definitions = definitionMap(catalog),
    transitions: DirectorTransition[] = [];
  let changed = nextAct !== original.act;
  let recoveryUntil = original.recoveryUntil;
  const events = original.events.map((stored) => {
    if (!live(stored.status)) return stored;
    const definition = definitions.get(stored.definitionId);
    if (!definition || definition.cancel(observation, stored)) {
      changed = true;
      const cancelled = {
        ...stored,
        status: 'cancelled' as const,
        resolvedAt: observation.now,
      };
      transitions.push({
        eventId: stored.id,
        definitionId: stored.definitionId,
        target: stored.target,
        status: 'cancelled',
      });
      return cancelled;
    }
    if (stored.status === 'warned' && observation.now >= stored.activateAt) {
      changed = true;
      const active = { ...stored, status: 'active' as const };
      transitions.push({
        eventId: stored.id,
        definitionId: stored.definitionId,
        target: stored.target,
        status: 'active',
        action: definition.activation,
      });
      return active;
    }
    if (
      stored.status === 'active' &&
      definition.complete(observation, stored)
    ) {
      changed = true;
      const completed = {
        ...stored,
        status: 'completed' as const,
        resolvedAt: observation.now,
      };
      if (definition.recovery.kind === 'quiet')
        recoveryUntil = Math.max(
          recoveryUntil,
          observation.now + definition.recovery.durationMs,
        );
      transitions.push({
        eventId: stored.id,
        definitionId: stored.definitionId,
        target: stored.target,
        status: 'completed',
      });
      return completed;
    }
    return stored;
  });

  let state: VoyageDirectorState = changed
    ? { ...original, act: nextAct, recoveryUntil, events }
    : original;
  if (
    observation.phase !== 'playing' ||
    nextAct === 'complete' ||
    observation.now < state.nextEventAt ||
    observation.now < recoveryUntil
  )
    return { state, transitions };

  const activeDefinitions = state.events
      .filter((instance) => live(instance.status))
      .map((instance) => definitions.get(instance.definitionId))
      .filter(
        (definition): definition is VoyageEventDefinition => !!definition,
      ),
    urgent = activeDefinitions.filter((definition) => definition.urgent).length,
    danger = currentDanger(state, definitions),
    prepared = [...catalog]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((definition) => ({
        definition,
        targets: definition.targets(observation),
      }))
      .filter(({ definition, targets }) => {
        if (!targets.length || !definition.acts.includes(nextAct)) return false;
        if (!definition.eligible(observation)) return false;
        if ((state.cooldowns[definition.id] ?? 0) > observation.now)
          return false;
        if (definition.urgent && urgent >= config.maxUrgent) return false;
        if (danger + definition.danger > config.budgets[nextAct]) return false;
        if (!compatible(definition, activeDefinitions)) return false;
        if (observation.struggling && definition.category !== 'recovery')
          return false;
        if (
          nextAct === 'finale' &&
          definition.category !== 'finale' &&
          definition.category !== 'recovery'
        )
          return false;
        return true;
      });
  if (!prepared.length) return { state, transitions };

  let random = draw(state.seed),
    cursor =
      random.value *
      prepared.reduce((sum, item) => sum + item.definition.weight, 0),
    selected = prepared[prepared.length - 1];
  for (const candidate of prepared) {
    cursor -= candidate.definition.weight;
    if (cursor <= 0) {
      selected = candidate;
      break;
    }
  }
  let target = selected.targets[0];
  if (selected.targets.length > 1) {
    random = draw(random.seed);
    target =
      selected.targets[Math.floor(random.value * selected.targets.length)];
  }
  const instance: VoyageEventInstance = {
      id: `${original.seed >>> 0}:${state.nextInstance}`,
      definitionId: selected.definition.id,
      target,
      status: 'warned',
      warnedAt: observation.now,
      activateAt: observation.now + selected.definition.warningMs,
    },
    cooldowns = {
      ...state.cooldowns,
      [selected.definition.id]:
        observation.now + selected.definition.cooldownMs,
    };
  state = {
    ...state,
    seed: random.seed,
    nextEventAt: observation.now + config.gaps[nextAct],
    nextInstance: state.nextInstance + 1,
    cooldowns,
    events: [...state.events, instance],
  };
  transitions.push({
    eventId: instance.id,
    definitionId: instance.definitionId,
    target: instance.target,
    status: 'warned',
  });
  return { state, transitions };
}
