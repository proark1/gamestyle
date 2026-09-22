import type { DriveThruAction, DriveThruSnapshot } from './types';
import { FILL_BAND, LAYER_NAMES, orderProblems, SLIDE_BAND } from './rush';

export function HoldControl({
  code,
  label,
  hold,
}: {
  code: string;
  label: string;
  hold: (code: string, down: boolean) => void;
}) {
  return (
    <button
      className="drive-thru-action-btn rush-hold"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        hold(code, true);
      }}
      onPointerUp={() => hold(code, false)}
      onPointerCancel={() => hold(code, false)}
      onLostPointerCapture={() => hold(code, false)}
      onKeyDown={(e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          hold(code, true);
        }
      }}
      onKeyUp={() => hold(code, false)}
      onBlur={() => hold(code, false)}
    >
      {label}
    </button>
  );
}

function Meter({
  value,
  band,
  label,
}: {
  value: number;
  band?: readonly [number, number];
  label: string;
}) {
  return (
    <div className="rush-meter-row">
      <span>{label}</span>
      <meter
        className="rush-native-meter"
        aria-label={label}
        min={0}
        max={1}
        value={Math.max(0, Math.min(1, value))}
      />
      <div className="rush-meter" aria-hidden="true">
        {band && (
          <i
            className="rush-safe-band"
            style={{
              left: `${band[0] * 100}%`,
              width: `${(band[1] - band[0]) * 100}%`,
            }}
          />
        )}
        <b
          className="rush-meter-pointer"
          style={{ left: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function RushPanel({
  snapshot: s,
  action,
}: {
  snapshot: DriveThruSnapshot;
  action: (a: DriveThruAction) => void;
}) {
  const r = s.rush,
    k = s.kitchen,
    role = s.myRole;
  const problems = orderProblems(s.world);
  const stageText = {
    preparing: 'Prepare the ticket',
    charging:
      role === 'barista'
        ? 'Release in the green band'
        : 'Barista is lining up the slide',
    sliding: 'Tray on its way',
    offered: 'Hold reach. Secure the tray.',
    carrying: 'Release reach. Balance as you pull.',
    between: 'Order served!',
  }[r.stage];
  return (
    <aside
      className={`rush-panel rush-role-${role}`}
      aria-label="Lunch rush status"
    >
      <div className="rush-panel-heading">
        <strong>Lunch rush</strong>
        <span>{s.ordersServed}/3 served</span>
      </div>
      <p className="rush-stage">{stageText}</p>
      {role === 'passenger' ? (
        <>
          <Meter label="Reach" value={s.car.passengerReach} />
          <Meter label="Grip" value={r.grip} band={[0.95, 1]} />
          <Meter
            label="Balance · steer toward centre"
            value={(s.car.balanceMeter + 1) / 2}
            band={[0.25, 0.75]}
          />
          <p className="rush-tip">
            Hold Space to reach. Once gripped, release. A/D keeps the tray
            level.
          </p>
        </>
      ) : role === 'barista' ? (
        <>
          <Meter
            label={`Cup ${Math.min(k.sodasPoured + 1, s.ticket?.requestedDrinks ?? 1)} · release in green`}
            value={r.cupFill}
            band={FILL_BAND}
          />
          <Meter
            label="Slide force · release in green"
            value={r.charge}
            band={SLIDE_BAND}
          />
          <p className="rush-tip">
            Hold R to pour. Hold E to charge the slide. Release each in green.
          </p>
        </>
      ) : role === 'grill' ? (
        <>
          <div className="rush-patties">
            {k.patties.map((p, i) => (
              <button
                key={p.id}
                className={p.state === 'cooked' ? 'ready' : ''}
                onClick={() => action({ type: 'selectPatty', id: p.id })}
              >
                Patty {i + 1}: {p.state}
                <small>
                  {r.flipped.includes(p.id) ? 'Flipped' : 'Needs a flip'}
                </small>
              </button>
            ))}
          </div>
          <p className="rush-tip">
            Select a patty, flip it, then stack when cooked. Layers follow the
            ticket.
          </p>
        </>
      ) : (
        <p className="rush-tip">
          <strong>Hold Space / handbrake at pickup.</strong> The bay slopes:
          rolling while the passenger carries the tray spills drinks.
        </p>
      )}
      {role === 'barista' && (
        <Meter
          label="Shake pressure · hold vent before 100%"
          value={k.shakePressure / 100}
          band={[0, 0.65]}
        />
      )}
      {role === 'grill' && s.ticket?.wantsFries && (
        <Meter
          label="Fries · lift in gold"
          value={k.fryerTimer}
          band={[0.5, 0.8]}
        />
      )}
      <div className="rush-recipe">
        {s.ticket?.requestedBurger.map((layer, i) => (
          <span
            key={`${layer}-${i}`}
            className={
              i < k.trayStack.length
                ? 'done'
                : i === k.trayStack.length
                  ? 'next'
                  : ''
            }
          >
            {LAYER_NAMES[layer]}
          </span>
        ))}
      </div>
      <div className="rush-counts">
        <span>
          Cups {k.sodasPoured}/{s.ticket?.requestedDrinks}
        </span>
        <span>
          {s.ticket?.wantsFries
            ? r.friesReady
              ? 'Fries ready'
              : 'Fries cooking'
            : 'No fries'}
        </span>
      </div>
      {r.noticeTime > 0 ? (
        <output className="rush-notice">{r.notice}</output>
      ) : (
        <p className="rush-notice">
          {problems[0] ?? 'Order ready. Slide it to the passenger.'}
        </p>
      )}
    </aside>
  );
}
