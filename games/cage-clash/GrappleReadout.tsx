import type { Grapple } from './types';

export function GrappleReadout({
  grapple: g,
  player,
  de,
}: {
  grapple: Grapple;
  player: string;
  de: boolean;
}) {
  const say = (en: string, german: string) => (de ? german : en);
  const attacking = g.submissionBy === player;
  const advantage = Math.max(
    -1,
    Math.min(1, g.progress * (g.top === player ? 1 : -1)),
  );
  const phase = (g.age % 1.4) / 1.4;
  const pulse = phase < 0.45 / 1.4;
  if (g.submissionBy)
    return (
      <div className="cage-grapple-readout">
        <div className="cage-grapple-caption">
          <span>
            {attacking
              ? say('Finish the hold', 'Griff vollenden')
              : say('Submission danger', 'Aufgabegefahr')}
          </span>
          <strong>{Math.round(g.submission * 100)}%</strong>
        </div>
        <meter
          className={attacking ? 'cage-hold-meter' : 'cage-danger-meter'}
          aria-label={
            attacking
              ? say('Submission completion', 'Griff-Fortschritt')
              : say('Submission danger', 'Aufgabegefahr')
          }
          min={0}
          max={1}
          value={g.submission}
        />
        <div className="cage-grapple-caption">
          <strong>
            {pulse
              ? attacking
                ? say('SQUEEZE NOW', 'JETZT ZIEHEN')
                : say('DEFEND NOW', 'JETZT ABWEHREN')
              : say('NEXT GOLD WINDOW', 'NÄCHSTES GOLDFENSTER')}
          </strong>
          <span>
            {pulse
              ? `${Math.max(0, 0.45 - (g.age % 1.4)).toFixed(1)}s`
              : `${(1.4 - (g.age % 1.4)).toFixed(1)}s`}
          </span>
        </div>
        <div
          className={`cage-pulse-timeline ${pulse ? 'is-gold' : ''}`}
          aria-hidden="true"
        >
          <span />
          <i style={{ left: `${phase * 100}%` }} />
        </div>
      </div>
    );
  return (
    <div className="cage-grapple-readout">
      <div className="cage-grapple-caption">
        <span>{say('POSITIONAL ADVANTAGE', 'POSITIONSVORTEIL')}</span>
        <strong>
          {Math.abs(advantage) < 0.04
            ? say('Even', 'Ausgeglichen')
            : advantage > 0
              ? say('You', 'Du')
              : say('Opponent', 'Gegner')}
        </strong>
      </div>
      <meter
        className="cage-position-accessible"
        aria-label={say('Your positional advantage', 'Dein Positionsvorteil')}
        min={-100}
        max={100}
        value={Math.round(advantage * 100)}
      />
      <div className="cage-position-track" aria-hidden="true">
        <i
          style={{
            left: `${Math.min(50, (advantage + 1) * 50)}%`,
            width: `${Math.abs(advantage) * 50}%`,
          }}
          data-winning={advantage >= 0}
        />
        <b />
      </div>
      <div className="cage-grapple-ends">
        <span>{say('OPPONENT', 'GEGNER')}</span>
        <span>{say('YOU', 'DU')}</span>
      </div>
      {g.mode !== 'clinch' && g.top !== player && (
        <div className="cage-bridge-cue">
          {g.cooldown > 0
            ? say(
                `Bridge recovers in ${g.cooldown.toFixed(1)}s`,
                `Brücke bereit in ${g.cooldown.toFixed(1)}s`,
              )
            : say('Bridge ready · Shift + Q', 'Brücke bereit · Shift + Q')}
        </div>
      )}
    </div>
  );
}
