import { chaosEventPresentation } from './chaos-catalog';
import { personalObjectiveDefinition } from './personal-objectives';
import type { ReelWorld } from './types';
import { buildVoyageRecap } from './voyage-story';
import { CHAOS_VOYAGE_DURATION_MS } from './chaos-voyage';

const stamp = (ms: number) => {
  const seconds = Math.floor(ms / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function VoyageRecap({ world }: { world: ReelWorld }) {
  if (!world.voyage) return null;
  const recap = buildVoyageRecap(
      world.voyage.story,
      world.started,
      CHAOS_VOYAGE_DURATION_MS,
    ),
    facts = new Map(world.voyage.story.facts.map((fact) => [fact.id, fact])),
    disasterFact = recap.disaster
      ? facts.get(recap.disaster.factIds[0])
      : undefined,
    disaster = disasterFact?.objectId
      ? chaosEventPresentation(disasterFact.objectId)
      : undefined,
    name = (id?: string) =>
      world.players.find((player) => player.id === id)?.name ?? 'The crew';
  return (
    <section className="voyage-recap" aria-label="Voyage story recap">
      <div className="voyage-recap-heading">
        <div>
          <small>THE STORY THE LAKE WILL TELL</small>
          <h3>
            {recap.summaryKey === 'wild-save'
              ? 'Chaos arrived. The crew answered.'
              : recap.summaryKey === 'rough-ride'
                ? 'Nine minutes of deeply questionable seamanship.'
                : 'Suspiciously smooth sailing.'}
          </h3>
        </div>
        <code>SEED {world.voyage.seed.toString(36).toUpperCase()}</code>
      </div>
      <div className="voyage-recap-grid">
        <article>
          <small>BIGGEST DISASTER · {stamp(recap.notableAt)}</small>
          <strong>{disaster?.title ?? 'The lake behaved itself'}</strong>
          <span>
            {recap.disaster
              ? `${recap.disaster.factIds.length} linked moments in the chaos chain.`
              : 'No disaster was recorded.'}
          </span>
        </article>
        <article>
          <small>HERO MOMENT</small>
          <strong>
            {recap.hero ? name(recap.hero.actorId) : 'No solo credit'}
          </strong>
          <span>
            {recap.hero?.kind === 'rescue'
              ? `Pulled ${name(recap.hero.targetId)} back aboard.`
              : recap.hero?.kind === 'repair'
                ? 'Helped patch the hull.'
                : recap.hero?.kind === 'catch'
                  ? 'Landed a vital catch.'
                  : 'The crew shared the work.'}
          </span>
        </article>
        <article>
          <small>QUESTIONABLE DECISION</small>
          <strong>
            {recap.questionable
              ? name(recap.questionable.actorId)
              : 'No culprit found'}
          </strong>
          <span>
            {recap.questionable
              ? 'Went into the lake by their own recorded action.'
              : 'The facts do not support blaming anyone.'}
          </span>
        </article>
      </div>
      <div className="voyage-objective-reveal">
        <small>SECRET OBJECTIVES REVEALED</small>
        {Object.values(world.voyage.objectives).map((objective) => (
          <span key={objective.playerId}>
            <b>{name(objective.playerId)}</b>
            {personalObjectiveDefinition(objective.id).title}
            <em data-status={objective.status}>{objective.status}</em>
          </span>
        ))}
      </div>
    </section>
  );
}
