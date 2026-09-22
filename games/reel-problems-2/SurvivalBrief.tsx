'use client';
import type { ReelAction, ReelWorld } from './types';
import { roundDuration } from './campaign';
import { surging } from './survival';
export default function SurvivalBrief({
  world: w,
  action,
  disabled,
}: {
  world: ReelWorld;
  action: (a: ReelAction) => void;
  disabled: boolean;
}) {
  const m = w.mission!,
    a = m.survival!,
    seconds = Math.max(
      0,
      Math.ceil((roundDuration(w) - w.clock + w.started) / 1000),
    );
  const recovering = m.status === 'recovering',
    surge = surging(w),
    wave = a.warned && a.waves < 3;
  const stage = recovering
    ? 'BUILD ANYTHING THAT FLOATS'
    : a.stage === 'fight'
      ? 'THAT IS NOT A NORMAL FISH'
      : a.stage === 'choice'
        ? 'HOW BRAVE ARE WE FEELING?'
        : a.stage === 'escape'
          ? 'EVERYBODY. THROUGH THE GATE.'
          : 'KEEP THIS THING TOGETHER';
  return (
    <>
      <div className="reel-storm-clock">
        <span>LAST BOAT HOME</span>
        <b className={seconds < 45 ? 'urgent' : ''}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </b>
      </div>
      <div className="reel-journey" aria-label="Journey progress">
        {['fight', 'choice', 'voyage', 'escape'].map((s, i) => (
          <span key={s} className={a.stage === s ? 'current' : ''}>
            {['HOOK', 'CHOOSE', 'SURVIVE', 'HOME'][i]}
          </span>
        ))}
      </div>
      <h2 className="survival-title">{stage}</h2>
      {recovering ? (
        <>
          <p>
            Climb onto the wreckage. Carry planks to the yellow frame, then
            barrels and a paddle. Hold C to lash them together.
          </p>
          <div className="reel-build-list">
            {m.components.map((c) => (
              <span
                key={
                  c.id.startsWith('deck')
                    ? 'Planks'
                    : c.id === 'barrels'
                      ? 'Barrels'
                      : 'Paddle'
                }
                className={c.installed ? 'installed' : ''}
              >
                {c.installed ? '✓' : '○'} {c.id}
              </span>
            ))}
          </div>
        </>
      ) : a.stage === 'fight' ? (
        <>
          <div className={`reel-danger ${surge ? 'surge' : ''}`}>
            {surge
              ? 'SURGE! RELEASE REEL · HOLD BRACE'
              : 'PULL TOGETHER! HOLD REEL'}
          </div>
          <progress aria-label="Giant catch progress" max={1} value={a.giant} />
          <p>
            Move left/right to steer around the rocks. Reel: E · Brace: Shift.
          </p>
        </>
      ) : a.stage === 'choice' ? (
        <>
          <p>
            The gate closes when the clock runs out. Your crew is worth more
            than the catch.
          </p>
          <div className="reel-route-choice">
            <button
              disabled={disabled}
              onClick={() => action({ type: 'sail', destination: 'home' })}
            >
              <b>Sheltered channel</b>
              <small>Longer trip · gentler waves</small>
            </button>
            <button
              disabled={disabled}
              onClick={() => action({ type: 'sail', destination: 'fish' })}
            >
              <b>Storm shortcut</b>
              <small>Stronger waves · bonus salvage on the right</small>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={`reel-danger ${wave ? 'surge' : ''}`}>
            {wave
              ? `WAVE IN ${Math.max(0, Math.ceil((a.waveAt - w.clock) / 1000))} · HOLD BRACE`
              : a.stage === 'escape'
                ? 'STEER TO THE YELLOW GATE · HOLD C'
                : 'WATCH THE WATER · LOOK AFTER EACH OTHER'}
          </div>
          <p>
            {a.stage === 'escape'
              ? 'Bring every friend aboard. Hold C at the gate to escape.'
              : 'Hold Reel to row. Release and Brace for waves. Move left/right to steer. Hold C to rescue or repair.'}
          </p>
        </>
      )}
      <div className="reel-survival-stats">
        <span>
          WATER <b>{Math.round(w.boat.flood * 100)}%</b>
        </span>
        <span>
          ABOARD{' '}
          <b>
            {w.players.filter((p) => !p.swimming).length}/{w.players.length}
          </b>
        </span>
        <span>
          CATCH <b>{m.cargo.filter((c) => c.location === 'boat').length}</b>
        </span>
      </div>
    </>
  );
}
