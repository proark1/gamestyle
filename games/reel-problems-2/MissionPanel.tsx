'use client';
import SurvivalBrief from './SurvivalBrief';
import { useEffect, type KeyboardEvent } from 'react';
import { useLanguage } from '../../shared/language/useLanguage';
import type { Angler, ReelAction, ReelWorld } from './types';
import { cargoCapacity, carriedCargo, roundDuration } from './campaign';
import { workTarget } from './mission';
export default function MissionPanel({
  world: w,
  player: p,
  action,
  hold,
  disabled,
}: {
  world: ReelWorld;
  player?: Angler;
  action: (a: ReelAction) => void;
  hold: (held: boolean) => void;
  disabled: boolean;
}) {
  const de = useLanguage().language === 'de';
  useEffect(() => {
    if (disabled) hold(false);
    return () => hold(false);
  }, [disabled, hold]);
  const m = w.mission!;
  const remaining = Math.max(
    0,
    Math.ceil((roundDuration(w) - w.clock + w.started) / 1000),
  );
  const recovering = m.status === 'recovering';
  const target = workTarget(w, p);
  const progress = p ? (m.holds[p.id]?.progress ?? 0) : 0;
  const carrying = m.components.find((c) => c.carrier === p?.id);
  const labels: Record<string, string> = {
    unload: 'Fische am Café abladen',
    repair: 'Rumpf reparieren',
    launch: 'Floß zu Wasser lassen',
  };
  const work = target
    ? de
      ? (labels[target.id] ??
        (m.survival?.jobs ? target.label : undefined) ??
        (target.id.startsWith('take:')
          ? 'Bauteil aufnehmen'
          : target.id.startsWith('install:')
            ? 'Bauteil befestigen'
            : 'Kiste bergen'))
      : target.label
    : de
      ? 'Zum markierten Arbeitsort gehen'
      : 'Move to the marked work area';
  const key = (e: KeyboardEvent<HTMLButtonElement>, held: boolean) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled && target) hold(held);
    }
  };
  return (
    <aside
      className={`reel-mission${m.survival ? ' survival-panel' : ''}`}
      aria-label={de ? 'Lieferauftrag' : 'Delivery contract'}
    >
      {m.survival ? (
        <SurvivalBrief
          world={w}
          player={p}
          action={action}
          disabled={disabled}
        />
      ) : (
        <>
          <div className="reel-mission-heading">
            <span>
              {de ? 'HAFENCAFÉ · AUFTRAG 01' : 'HARBOUR CAFÉ · ORDER 01'}
            </span>
            <time className={remaining < 60 ? 'urgent' : ''}>
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, '0')}
            </time>
          </div>
          <h2>{de ? 'Erste Lieferung' : 'First Delivery'}</h2>
          <div
            className="reel-delivery-stamps"
            aria-label={`${m.delivered}/3 ${de ? 'geliefert' : 'delivered'}`}
          >
            {[0, 1, 2].map((i) => (
              <span className={m.delivered > i ? 'delivered' : ''} key={i}>
                {m.delivered > i ? '✓' : '○'}
              </span>
            ))}
            <b>
              {m.delivered}/3 {de ? 'geliefert' : 'delivered'}
            </b>
          </div>
          <p>
            {de ? 'An Bord' : 'On board'}{' '}
            <b>
              {carriedCargo(w)}/{cargoCapacity(w)}
            </b>{' '}
            · {de ? 'Wasser' : 'Water'} <b>{Math.round(w.boat.flood * 100)}%</b>
            {m.raft && <span> · {de ? 'Notfloß' : 'Emergency raft'}</span>}
          </p>
          {recovering ? (
            <>
              <strong>
                {de ? 'Baut euch zurück ins Spiel.' : 'Build your way back.'}
              </strong>
              <p>
                {p?.support !== 'dock'
                  ? de
                    ? 'Zum gelben Steg schwimmen. Der Abschleppdienst kommt nach 12 Sekunden.'
                    : 'Swim to the yellow slip. Harbour rescue arrives after 12 seconds.'
                  : carrying
                    ? de
                      ? 'Trage das Teil zum gelben Rahmen. Halte C zum Befestigen.'
                      : 'Carry your part to the yellow frame. Hold C to attach.'
                    : de
                      ? 'Holz aufnehmen, am Rahmen befestigen, dann Fässer und Paddel.'
                      : 'Collect planks from the rack. Attach both decks, then barrels and a paddle.'}
              </p>
              <div className="reel-build-list">
                {m.components.map((c) => (
                  <span key={c.id} className={c.installed ? 'installed' : ''}>
                    {c.installed ? '✓' : '○'}{' '}
                    {c.id.startsWith('deck')
                      ? de
                        ? 'Deck'
                        : 'Deck'
                      : c.id === 'barrels'
                        ? de
                          ? 'Fässer'
                          : 'Barrels'
                        : de
                          ? 'Paddel'
                          : 'Paddle'}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="reel-mission-hint">
                {w.leak
                  ? de
                    ? 'Leck! Auf die gelbe Stelle gehen und E halten. Oder zum Reparatursteg fahren.'
                    : 'Leak! Stand on the yellow crack and hold E. Or sail to the repair slip.'
                  : carriedCargo(w) >= 3 - m.delivered
                    ? de
                      ? 'Genug gefangen. Zum Café zurückkehren und C zum Abladen halten.'
                      : 'Enough fish! Return to the café and hold C to unload.'
                    : de
                      ? 'Zum Angelplatz fahren. Leert euren Fang am Heimatsteg ab.'
                      : 'Sail to the fishing grounds. Bring your catch home to unload.'}
              </p>
              <nav
                className="reel-courses"
                aria-label={de ? 'Kurs setzen' : 'Set course'}
              >
                {(['fish', 'home', 'repair'] as const).map((destination, i) => (
                  <button
                    key={destination}
                    disabled={disabled}
                    aria-pressed={m.course === destination}
                    onClick={() => action({ type: 'sail', destination })}
                  >
                    {de
                      ? ['Angeln', 'Café', 'Reparatur'][i]
                      : ['Fish', 'Café', 'Repair'][i]}
                  </button>
                ))}
              </nav>
              <small>
                {m.course
                  ? de
                    ? 'Kurs gesetzt · mit P selbst paddeln'
                    : 'Course set · use P to paddle yourself'
                  : de
                    ? 'Wähle ein Ziel; die Crew steuert gemeinsam.'
                    : 'Choose a destination; the crew steers together.'}
              </small>
            </>
          )}
        </>
      )}
      <button
        className={`reel-work${target ? '' : ' unavailable'}`}
        disabled={disabled || !target}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          hold(true);
        }}
        onPointerUp={() => hold(false)}
        onPointerCancel={() => hold(false)}
        onLostPointerCapture={() => hold(false)}
        onKeyDown={(e) => key(e, true)}
        onKeyUp={(e) => key(e, false)}
        onBlur={() => hold(false)}
      >
        <span>{work}</span>
        <small>{de ? 'C / RT halten' : 'Hold C / RT'}</small>
        <progress
          aria-label={de ? 'Fortschritt' : 'Work progress'}
          max={1}
          value={progress}
        />
      </button>
      {(carrying || (p && m.survival?.jobs?.carried[p.id])) && (
        <button
          className="reel-drop"
          disabled={disabled}
          onClick={() => action({ type: 'drop' })}
        >
          {m.survival?.jobs?.carried[p?.id ?? '']
            ? 'Return carried supply'
            : de
              ? 'Bauteil ablegen'
              : 'Put component down'}
        </button>
      )}
    </aside>
  );
}
