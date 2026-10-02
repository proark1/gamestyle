import { applyObjectiveFact } from './personal-objectives';
import type { ReelWorld } from './types';
import type { VoyageFact, VoyageStoryState } from './voyage-types';

export const MAX_VOYAGE_FACTS = 160;
const MAX_DEDUPE_KEYS = 256;

export type VoyageFactInput = Omit<VoyageFact, 'id' | 'at'> & { at?: number };

export function freshVoyageStory(): VoyageStoryState {
  return { nextFact: 1, facts: [], dedupe: [] };
}

export function emitVoyageFact(
  w: ReelWorld,
  input: VoyageFactInput,
  dedupeKey?: string,
) {
  const voyage = w.voyage;
  if (!voyage || (dedupeKey && voyage.story.dedupe.includes(dedupeKey)))
    return undefined;
  const fact: VoyageFact = {
    ...input,
    id: `fact-${voyage.story.nextFact++}`,
    at: input.at ?? w.clock,
    tags: [...input.tags],
  };
  voyage.story.facts.push(fact);
  if (dedupeKey) {
    voyage.story.dedupe.push(dedupeKey);
    if (voyage.story.dedupe.length > MAX_DEDUPE_KEYS)
      voyage.story.dedupe.splice(
        0,
        voyage.story.dedupe.length - MAX_DEDUPE_KEYS,
      );
  }
  while (voyage.story.facts.length > MAX_VOYAGE_FACTS) {
    const referenced = new Set(
      voyage.story.facts.flatMap((item) =>
        item.causeFactId ? [item.causeFactId] : [],
      ),
    );
    const removable = voyage.story.facts.findIndex(
      (item) => item.kind !== 'run-finished' && !referenced.has(item.id),
    );
    voyage.story.facts.splice(Math.max(0, removable), 1);
  }
  applyObjectiveFact(voyage.objectives, fact);
  return fact;
}

export type VoyageRecap = {
  disaster?: { factIds: string[]; score: number; at: number };
  hero?: VoyageFact;
  questionable?: VoyageFact;
  notableAt: number;
  summaryKey: 'wild-save' | 'rough-ride' | 'clean-run';
};

export function buildVoyageRecap(
  story: VoyageStoryState,
  startedAt: number,
  durationMs: number,
): VoyageRecap {
  const facts = story.facts,
    byId = new Map(facts.map((fact) => [fact.id, fact])),
    chains = facts
      .filter((fact) => fact.severity > 0)
      .map((fact) => {
        const chain = [fact];
        let current = fact;
        while (current.causeFactId && byId.has(current.causeFactId)) {
          current = byId.get(current.causeFactId)!;
          if (chain.some((item) => item.id === current.id)) break;
          chain.push(current);
        }
        return {
          factIds: chain.map((item) => item.id),
          score: chain.reduce((sum, item) => sum + item.severity, 0),
          at: Math.max(...chain.map((item) => item.at)),
        };
      })
      .sort((a, b) => b.score - a.score || a.at - b.at),
    hero = [...facts]
      .filter((fact) => fact.benefit > 0 && fact.actorId)
      .sort((a, b) => b.benefit - a.benefit || a.at - b.at)[0],
    questionable = [...facts]
      .filter(
        (fact) => fact.playerCaused && !!fact.actorId && fact.severity > 0,
      )
      .sort((a, b) => b.severity - a.severity || a.at - b.at)[0],
    notableAt = Math.max(
      0,
      Math.min(durationMs, (chains[0]?.at ?? startedAt) - startedAt),
    );
  return {
    disaster: chains[0],
    hero,
    questionable,
    notableAt,
    summaryKey: hero ? 'wild-save' : chains[0] ? 'rough-ride' : 'clean-run',
  };
}
