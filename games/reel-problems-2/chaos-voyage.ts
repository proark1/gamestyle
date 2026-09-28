import {
  DEFAULT_DIRECTOR_CONFIG,
  advanceDirector,
  freshDirectorState,
  type VoyageDirectorState,
} from './chaos-director';
import { CHAOS_VOYAGE_CATALOG, chaosEventPresentation } from './chaos-catalog';
import { assignPersonalObjectives } from './personal-objectives';
import type { ReelEvent, ReelWorld } from './types';
import { emitVoyageFact, freshVoyageStory } from './voyage-story';
import type { PersonalObjectiveState, VoyageStoryState } from './voyage-types';

export const CHAOS_VOYAGE_DURATION_MS = DEFAULT_DIRECTOR_CONFIG.durationMs;
export const CHAOS_CONTRACTS = [
  'giant-catch',
  'storm-quota',
  'rescue-haul',
] as const;
export type ChaosContractId = (typeof CHAOS_CONTRACTS)[number];

export type ChaosVoyageState = {
  version: 2;
  contract: ChaosContractId;
  seed: number;
  director: VoyageDirectorState;
  story: VoyageStoryState;
  objectives: PersonalObjectiveState;
};

export const isChaosContract = (value: unknown): value is ChaosContractId =>
  CHAOS_CONTRACTS.includes(value as ChaosContractId);

export function normalizeVoyageSeed(value: unknown, fallback = 421337) {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value) >>> 0
    : fallback >>> 0;
}

export function nextVoyageSeed(seed: number) {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

export function freshChaosVoyage(
  contract: ChaosContractId,
  seed: number,
  startedAt: number,
  playerIds: readonly string[] = [],
): ChaosVoyageState {
  const normalized = normalizeVoyageSeed(seed);
  return {
    version: 2,
    contract,
    seed: normalized,
    director: freshDirectorState(normalized, startedAt),
    story: freshVoyageStory(),
    objectives: assignPersonalObjectives(normalized, playerIds),
  };
}

export function upgradeChaosVoyage(
  state: ChaosVoyageState,
  playerIds: readonly string[],
) {
  const legacy = state as ChaosVoyageState & {
    version: number;
    story?: VoyageStoryState;
    objectives?: PersonalObjectiveState;
  };
  legacy.version = 2;
  legacy.story ??= freshVoyageStory();
  legacy.objectives ??= assignPersonalObjectives(legacy.seed, playerIds);
  return legacy as ChaosVoyageState;
}

type Emit = (w: ReelWorld, kind: ReelEvent['kind'], text: string) => void;

function causeFor(w: ReelWorld, sourceEventId: string) {
  return [...(w.voyage?.story.facts ?? [])]
    .reverse()
    .find(
      (fact) =>
        fact.sourceEventId === sourceEventId &&
        fact.kind === 'director-warning',
    )?.id;
}

function applyAction(w: ReelWorld, action: string | undefined) {
  if (action === 'weather:hard-gust') {
    const direction = ((w.voyage!.director.seed % 6283) / 1000) % (Math.PI * 2);
    Object.assign(w.weather, {
      kind: 'wind',
      since: w.clock,
      until: w.clock + 12_000,
      direction,
      windX: Math.sin(direction),
      windZ: Math.cos(direction),
      gust: 1,
    });
  } else if (action === 'weather:rogue-wave') {
    const direction = ((w.voyage!.director.seed % 6283) / 1000) % (Math.PI * 2);
    Object.assign(w.weather, {
      kind: 'storm',
      since: w.clock,
      until: w.clock + 16_000,
      direction,
      windX: Math.sin(direction),
      windZ: Math.cos(direction),
      rain: 1,
      gust: 1,
      flashUntil: w.clock + 500,
    });
    w.boat.rollVelocity += Math.sin(direction) * 0.9;
    w.boat.pitchVelocity += Math.cos(direction) * 0.75;
  } else if (action === 'debris:rush') {
    const log = w.debris[0];
    if (log) {
      const angle = ((w.voyage!.director.seed % 6283) / 1000) % (Math.PI * 2),
        x = w.boat.x + Math.sin(angle) * 15,
        z = w.boat.z + Math.cos(angle) * 15,
        dx = w.boat.x - x,
        dz = w.boat.z - z,
        length = Math.max(1, Math.hypot(dx, dz));
      Object.assign(log, {
        x,
        z,
        vx: (dx / length) * 2.8,
        vz: (dz / length) * 2.8,
        angle: Math.atan2(dx, dz),
      });
    }
  } else if (action === 'wildlife:shark-circle') {
    const shark = w.wildlife.find((visitor) => visitor.kind === 'shark');
    if (shark) {
      shark.x = w.boat.x + 8;
      shark.z = w.boat.z;
      shark.activeUntil = w.clock + 15_000;
      shark.nextAt = w.clock + 25_000;
      shark.hitAt = w.clock + 2_500;
    }
  }
}

export function advanceChaosVoyage(w: ReelWorld, emit?: Emit) {
  if (!w.voyage) return [];
  const swimmers = w.players.filter((player) => player.swimming).length,
    result = advanceDirector(
      w.voyage.director,
      {
        now: w.clock,
        phase: w.phase === 'playing' ? 'playing' : 'finished',
        struggling:
          w.boat.sunk ||
          w.boat.flood >= 0.75 ||
          (!!w.players.length && swimmers * 2 >= w.players.length),
        playerIds: w.players.map((player) => player.id),
        flags: [
          ...(w.boat.sunk ? ['boat-sunk'] : []),
          ...(w.leak ? ['leaking'] : []),
          ...(swimmers ? ['crew-overboard'] : []),
          ...(w.debris.length ? ['debris-ready'] : []),
          ...(w.wildlife.some((visitor) => visitor.kind === 'shark')
            ? ['shark-ready']
            : []),
        ],
      },
      CHAOS_VOYAGE_CATALOG,
    );
  w.voyage.director = result.state;
  for (const transition of result.transitions) {
    const presentation = chaosEventPresentation(transition.definitionId);
    if (transition.status === 'warned') {
      emitVoyageFact(
        w,
        {
          kind: 'director-warning',
          sourceEventId: transition.eventId,
          objectId: transition.definitionId,
          severity: 0.5,
          benefit: 0,
          playerCaused: false,
          tags: ['telegraph'],
        },
        `director:${transition.eventId}:warned`,
      );
      if (presentation && emit)
        emit(w, presentation.kind, presentation.warning);
    } else if (transition.status === 'active') {
      applyAction(w, transition.action);
      emitVoyageFact(
        w,
        {
          kind: 'director-active',
          sourceEventId: transition.eventId,
          objectId: transition.definitionId,
          causeFactId: causeFor(w, transition.eventId),
          severity: transition.definitionId === 'rogue-wave' ? 4 : 2,
          benefit: 0,
          playerCaused: false,
          tags: ['chaos-event'],
        },
        `director:${transition.eventId}:active`,
      );
      if (presentation && emit) emit(w, presentation.kind, presentation.active);
    } else {
      emitVoyageFact(
        w,
        {
          kind:
            transition.status === 'completed'
              ? 'director-complete'
              : 'director-cancelled',
          sourceEventId: transition.eventId,
          objectId: transition.definitionId,
          causeFactId: causeFor(w, transition.eventId),
          severity: 0,
          benefit: transition.status === 'completed' ? 0.5 : 0,
          playerCaused: false,
          tags: [],
        },
        `director:${transition.eventId}:${transition.status}`,
      );
    }
  }
  return result.transitions;
}
