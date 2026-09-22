'use client';
import { gateOpen, giantAboard } from './deck-jobs';
import type { Angler, ReelAction, ReelWorld } from './types';
import { roundDuration } from './campaign';
import { surging } from './survival';
export default function SurvivalBrief({
  world: w,
  player,
  action,
  disabled,
}: {
  world: ReelWorld;
  player?: Angler;
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
              <span key={c.id} className={c.installed ? 'installed' : ''}>
                {c.installed ? '✓' : '○'}{' '}
                {c.id.startsWith('deck')
                  ? 'Planks'
                  : c.id === 'barrels'
                    ? 'Barrels'
                    : 'Paddle'}
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
            Hold E and move left/right to steer around rocks. Release E to walk
            the deck. Brace: Shift.
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
                ? 'WINCH AT THE BOW · ROW THROUGH TOGETHER'
                : 'WATCH THE WATER · LOOK AFTER EACH OTHER'}
          </div>
          <p>
            {a.stage === 'escape'
              ? 'Bring everyone aboard. Hold C at WINCH; a crewmate rows. Solo: latch it, release C, then row.'
              : 'Hold E to row; move left/right while rowing to steer. Release E to walk. Brace for waves. Carry timber to leaks; bail at the bucket.'}
          </p>
        </>
      )}
      {!recovering &&
        a.jobs &&
        (a.caught || w.leak || w.boat.flood > 0.03 || a.stage === 'escape') && (
          <div className="reel-deck-jobs" aria-label="Crew jobs">
            {player && a.jobs.carried[player.id] ? (
              <strong>
                Carrying {a.jobs.carried[player.id]}.{' '}
                {a.jobs.carried[player.id] === 'rope'
                  ? 'Take it to the fish.'
                  : 'Take it to the yellow leak.'}
              </strong>
            ) : (
              <strong>Walk to a marked station · hold C to work</strong>
            )}
            {giantAboard(w) && (
              <span className={a.jobs.secured ? 'job-done' : ''}>
                {a.jobs.secured
                  ? '✓ Fish tied down'
                  : 'ROPE → FISH · tie it before it flops!'}
              </span>
            )}
            {w.leak && <span>TIMBER → LEAK · a plank stops the water</span>}
            {w.boat.flood > 0.03 && (
              <span>BUCKET · bail while a friend repairs</span>
            )}
            {a.stage === 'escape' && (
              <>
                <span>
                  {gateOpen(w)
                    ? 'GATE OPEN · ROW NOW!'
                    : 'WINCH · crank it open'}
                </span>
                <progress
                  aria-label="Harbour crossing"
                  max={1}
                  value={a.jobs.crossing}
                />
              </>
            )}
          </div>
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
