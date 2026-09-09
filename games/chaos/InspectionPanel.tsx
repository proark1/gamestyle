import type { Snapshot } from './model';
import type { PartyAction } from './party';
import { checkComments } from './inspection';

export function InspectionPanel({
  snapshot: s,
  host,
  act,
  move,
}: {
  snapshot: Snapshot;
  host: boolean;
  act: (action: PartyAction) => void;
  move: (x: number, z: number, action: () => void) => void;
}) {
  const p = s.world.party!,
    i = p.inspection;
  if (!i) return null;
  const active =
    s.world.mode === 'job' &&
    ['building', 'lastCall', 'rescue'].includes(p.phase);
  const leaking = s.now >= i.rainAt && s.now <= i.rainUntil && !i.leakFixed;
  return (
    <div className="inspection-brief">
      <b>WILL IT HOLD?</b>
      <p>
        Carry the sofa into the blue living room. Leave a way in for the
        customer. Roof the whole blue square.
      </p>
      {active && (
        <p className="inspection-clock">
          {p.phase === 'rescue' ? 'REPAIR TIME' : 'INSPECTION IN'} ·{' '}
          {Math.max(0, Math.ceil((p.deadline - s.now) / 1000))}s
        </p>
      )}
      {p.phase === 'rescue' && i.firstCheck && (
        <output>
          <strong>One last chance to fix it!</strong>
          {checkComments(i.firstCheck).map((text, n) => (
            <p key={text}>
              {[
                i.firstCheck!.access,
                i.firstCheck!.covered === i.firstCheck!.samples,
                i.firstCheck!.delivered,
              ][n]
                ? '✓ '
                : '⚠ '}
              {text}
            </p>
          ))}
        </output>
      )}
      {active && (
        <>
          {s.now < i.rainAt && (
            <p>
              Pipe pressure rises in {Math.ceil((i.rainAt - s.now) / 1000)}s.
              Watch for the blue puddle by the living room.
            </p>
          )}
          {leaking && (
            <>
              <output>
                LEAK! The blue puddle makes the sofa slide. Walk to the pipe to
                stop it.
              </output>
              <button
                onClick={() =>
                  move(i.target.x, i.target.z + 2, () =>
                    act({ type: 'party', op: 'repair' }),
                  )
                }
              >
                Fix the leaking pipe
              </button>
            </>
          )}
          {i.leakFixed && (
            <p>✓ Leak repaired. The delivery route is dry again.</p>
          )}
          <button
            disabled={
              p.task.phase !== 'working' ||
              p.task.tilt < 0.25 ||
              s.now < i.nextSteadyAt
            }
            onClick={() => act({ type: 'party', op: 'steady' })}
          >
            Steady the sofa · nearby helper
          </button>
          {host && p.phase !== 'rescue' && (
            <button onClick={() => act({ type: 'party', op: 'inspect' })}>
              Call the customer now
            </button>
          )}
        </>
      )}
      {!active && i.check && (
        <output>
          {checkComments(i.check).map((text) => (
            <p key={text}>{text}</p>
          ))}
        </output>
      )}
    </div>
  );
}
