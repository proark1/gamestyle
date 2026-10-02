import { AlertTriangle, CheckCircle2, Circle, Target } from 'lucide-react';
import { chaosEventPresentation } from './chaos-catalog';
import { personalObjectiveDefinition } from './personal-objectives';
import type { ReelWorld } from './types';

const ACTS = ['plan', 'escalation', 'finale'] as const;
const ACT_LABELS = { plan: 'Plan', escalation: 'Escalation', finale: 'Finale' };

export default function ChaosHud({
  world,
  playerId,
}: {
  world: ReelWorld;
  playerId?: string;
}) {
  const voyage = world.voyage;
  if (!voyage) return null;
  const objective = playerId ? voyage.objectives[playerId] : undefined,
    definition = objective
      ? personalObjectiveDefinition(objective.id)
      : undefined,
    liveEvent = [...voyage.director.events]
      .reverse()
      .find((event) => event.status === 'warned' || event.status === 'active'),
    event = liveEvent
      ? chaosEventPresentation(liveEvent.definitionId)
      : undefined;
  return (
    <aside className="chaos-hud" aria-label="Chaos Voyage status">
      <div className="chaos-hud-acts" aria-label="Voyage stages">
        {ACTS.map((act) => (
          <span
            className={voyage.director.act === act ? 'active' : ''}
            key={act}
          >
            {voyage.director.act === act ? (
              <Circle size={8} fill="currentColor" />
            ) : null}
            {ACT_LABELS[act]}
          </span>
        ))}
      </div>
      {definition && objective && (
        <div className="chaos-hud-objective">
          <Target size={17} aria-hidden="true" />
          <div>
            <small>YOUR SECRET OBJECTIVE</small>
            <strong>{definition.title}</strong>
            <span>{definition.instruction}</span>
          </div>
          {objective.status === 'completed' ? (
            <CheckCircle2
              className="complete"
              size={20}
              aria-label="Complete"
            />
          ) : (
            <b>
              {objective.progress}/{objective.target}
            </b>
          )}
        </div>
      )}
      {event && liveEvent && (
        <output className={`chaos-hud-event ${liveEvent.status}`}>
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <small>
              {liveEvent.status === 'warned' ? 'INCOMING' : 'ACTIVE'}
            </small>
            <strong>{event.title}</strong>
          </div>
        </output>
      )}
    </aside>
  );
}
