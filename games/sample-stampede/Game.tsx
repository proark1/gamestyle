'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  HelpCircle,
  ShoppingBag,
  Flame,
  Zap,
  CheckSquare,
  Square,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import { SampleStampedeScene } from './scene';
import { SampleStampedeAudio } from './audio';
import {
  advanceSampleStampedeWorld,
  freshSampleStampedeWorld,
  newStampedePlayer,
  sampleStampedeSnapshot,
} from './simulation';
import { SampleStampedePhysics } from './physics';
import { TouchControls } from '../../shared/input/TouchControls';
import {
  ITEM_DEFS,
  type PlayerInput,
  type SampleStampedeSnapshot,
  type SampleStampedeWorld,
  type StampedeEvent,
} from './types';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { sampleStampedeAnalytics } from './analytics';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import LanguageSwitcher from '../../shared/language/LanguageSwitcher';
import { SAMPLE_STAMPEDE_TRANSLATIONS } from './translations';

const tracker = new GameTracker(sampleStampedeAnalytics);

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
};

function WarehouseRadar({
  snapshot,
  selfCartId,
}: {
  snapshot: SampleStampedeSnapshot;
  selfCartId: string;
}) {
  const w = 110;
  const h = 145;
  const pad = 6;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  // World bounds: X [-26, 26], Z [-34, 34]
  const toRadar = (x: number, z: number) => {
    const normX = Math.max(0, Math.min(1, (x + 26) / 52));
    const normZ = Math.max(0, Math.min(1, (z + 34) / 68));
    return {
      x: pad + normX * innerW,
      y: pad + normZ * innerH,
    };
  };

  const { world } = snapshot;

  return (
    <div className="stampede-radar-box" aria-label="Warehouse Floor Radar">
      <div className="stampede-radar-title">AISLE RADAR</div>
      <svg
        className="stampede-radar-svg"
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
      >
        {/* Floor */}
        <rect
          x={pad}
          y={pad}
          width={innerW}
          height={innerH}
          rx={4}
          className="stampede-radar-floor"
        />

        {/* Shelves */}
        {world.shelves.map((s) => {
          const p = toRadar(s.x, s.z);
          const rw = (s.width / 52) * innerW;
          const rl = (s.length / 68) * innerH;
          return (
            <rect
              key={s.id}
              x={p.x - rw / 2}
              y={p.y - rl / 2}
              width={rw}
              height={rl}
              className="stampede-radar-shelf"
            />
          );
        })}

        {/* Exit Gauntlet */}
        {(() => {
          const eg = toRadar(world.exitGauntlet.x, world.exitGauntlet.z);
          const ew = (world.exitGauntlet.width / 52) * innerW;
          const ed = (world.exitGauntlet.depth / 68) * innerH;
          return (
            <rect
              x={eg.x - ew / 2}
              y={eg.y - ed / 2}
              width={ew}
              height={ed}
              className="stampede-radar-exit"
            />
          );
        })()}

        {/* Active Kiosks */}
        {world.kiosks.map((k) => {
          const kp = toRadar(k.x, k.z);
          return (
            <circle
              key={k.id}
              cx={kp.x}
              cy={kp.y}
              r={k.active ? 4.5 : 2.5}
              className={`stampede-radar-kiosk ${k.active ? 'active' : ''}`}
            />
          );
        })}

        {/* Carts */}
        {world.carts.map((c) => {
          const cp = toRadar(c.x, c.z);
          const isSelf = c.id === selfCartId;
          return (
            <circle
              key={c.id}
              cx={cp.x}
              cy={cp.y}
              r={isSelf ? 4.5 : 3.5}
              className={`stampede-radar-cart ${c.team} ${isSelf ? 'self' : ''}`}
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function SampleStampede() {
  useGameTracker(tracker);
  const { t } = useLanguage();
  const strings = t(SAMPLE_STAMPEDE_TRANSLATIONS);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SampleStampedeScene | null>(null);
  const audioRef = useRef<SampleStampedeAudio | null>(null);
  const physicsRef = useRef<SampleStampedePhysics | null>(null);
  const worldRef = useRef<SampleStampedeWorld | null>(null);

  const [snapshot, setSnapshot] = useState<SampleStampedeSnapshot | null>(null);
  const [selfId] = useState('player-local');
  const [selfCartId] = useState('cart-red');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  const [receiptStatus, setReceiptStatus] = useState<
    'approved' | 'rejected' | null
  >(null);
  const receiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const lastFrameTime = useRef(0);
  const animId = useRef(0);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    audioRef.current?.setMuted(!soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!containerRef.current) return;

    const audio = new SampleStampedeAudio();
    audioRef.current = audio;
    audio.setMuted(!soundEnabledRef.current);

    const unlockAudio = () => {
      audio.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // Initialize world
    const world = freshSampleStampedeWorld(Date.now());
    // Add human driver
    world.players.push(
      newStampedePlayer(selfId, 'You', 0, 'red', selfCartId, 'driver', false),
    );
    // Add AI co-pilot in basket
    world.players.push(
      newStampedePlayer(
        'bot-partner',
        'Grabber Gus',
        1,
        'red',
        selfCartId,
        'grabber',
        true,
      ),
    );
    // Add rival cart crew (Blue Team)
    world.players.push(
      newStampedePlayer(
        'bot-rival-driver',
        'Bulk Barry',
        2,
        'blue',
        'cart-blue',
        'driver',
        true,
      ),
    );
    world.players.push(
      newStampedePlayer(
        'bot-rival-grabber',
        'Taquito Tina',
        3,
        'blue',
        'cart-blue',
        'grabber',
        true,
      ),
    );

    worldRef.current = world;

    const physics = new SampleStampedePhysics(world);
    physicsRef.current = physics;

    const scene = new SampleStampedeScene(containerRef.current, {
      input: (inp: PlayerInput) => {
        const p = world.players.find((pl) => pl.id === selfId);
        if (p) {
          p.input = inp;
        }
      },
    });
    sceneRef.current = scene;

    lastFrameTime.current = performance.now();

    const tick = (timeMs: number) => {
      animId.current = requestAnimationFrame(tick);
      const dt = Math.min((timeMs - lastFrameTime.current) / 1000, 0.05);
      lastFrameTime.current = timeMs;

      if (worldRef.current && physicsRef.current) {
        const events: StampedeEvent[] = [];
        advanceSampleStampedeWorld(
          worldRef.current,
          physicsRef.current,
          dt,
          events,
        );

        // Process audio events & squeaky wheel
        const meCart = worldRef.current.carts.find((c) => c.id === selfCartId);
        if (meCart && soundEnabledRef.current) {
          const speed = Math.sqrt(
            meCart.vx * meCart.vx + meCart.vz * meCart.vz,
          );
          audio.updateSqueak(speed, meCart.wobbleIntensity, dt);
        }

        if (soundEnabledRef.current) {
          for (const ev of events) {
            audio.playEvent(ev);
          }
        }

        // Check for receipt approval/rejection events for local player's cart/team
        for (const ev of events) {
          if (
            ev.type === 'receipt_approved' &&
            meCart &&
            ev.team === meCart.team
          ) {
            setReceiptStatus('approved');
            if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current);
            receiptTimerRef.current = setTimeout(
              () => setReceiptStatus(null),
              3200,
            );
          } else if (
            ev.type === 'receipt_rejected' &&
            meCart &&
            ev.team === meCart.team
          ) {
            setReceiptStatus('rejected');
            if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current);
            receiptTimerRef.current = setTimeout(
              () => setReceiptStatus(null),
              3800,
            );
          }
        }

        const snap = sampleStampedeSnapshot(
          worldRef.current,
          'SOLO',
          selfId,
          selfId,
          1,
        );
        setSnapshot(snap);
        scene.render(snap);
      }
    };

    animId.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId.current);
      if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      scene.destroy();
      audio.destroy();
      physics.destroy();
    };
  }, [selfId, selfCartId]);

  const handleRestart = () => {
    if (!worldRef.current || !physicsRef.current) return;
    const now = Date.now();
    const fresh = freshSampleStampedeWorld(now);
    fresh.players = worldRef.current.players;
    worldRef.current = fresh;
    physicsRef.current.destroy();
    physicsRef.current = new SampleStampedePhysics(fresh);
    audioRef.current?.playAnnouncementBell();
  };

  const handleDriftPress = () => {
    sceneRef.current?.setCustomInput({ drift: true });
  };
  const handleDriftRelease = () => {
    sceneRef.current?.setCustomInput({ drift: false });
  };

  const handleGrabberTrigger = () => {
    sceneRef.current?.setCustomInput({ grabberAction: true });
    setTimeout(() => {
      sceneRef.current?.setCustomInput({ grabberAction: false });
    }, 200);
  };

  const myCart = snapshot?.world.carts.find((c) => c.id === selfCartId);
  const myManifest = myCart?.manifest;
  const hasContraband = myCart?.items.some(
    (it) => ITEM_DEFS[it.kind].isContraband,
  );
  const isGameOver = snapshot?.world.status === 'finished';

  const cartSpeedMph = myCart
    ? Math.round(
        Math.sqrt(myCart.vx * myCart.vx + myCart.vz * myCart.vz) * 2.236,
      )
    : 0;
  const wobblePct = myCart
    ? Math.min(100, Math.round(myCart.wobbleIntensity * 100))
    : 0;

  const displayReceiptStamp =
    receiptStatus || (hasContraband ? 'rejected' : null);

  // Counts of carried items
  const carriedCounts: Record<string, number> = {};
  if (myCart) {
    for (const it of myCart.items) {
      carriedCounts[it.kind] = (carriedCounts[it.kind] || 0) + 1;
    }
  }

  return (
    <main className="stampede-container">
      <div ref={containerRef} className="stampede-canvas-wrapper" />

      {/* SPEED LINES OVERLAY (DURING SUGAR RUSH) */}
      {myCart && myCart.sugarRushTimer > 0 && (
        <div className="stampede-speed-lines" aria-hidden="true" />
      )}

      {/* TOP HEADER HUD */}
      <div className="stampede-hud-top">
        <div className="stampede-score-pill red">
          <span>RED TEAM</span>
          <span className="stampede-score-num">
            {snapshot?.world.teamScores.red ?? 0}
          </span>
        </div>

        <div className="stampede-timer-box">
          <div className="stampede-timer">
            {formatTime(snapshot?.world.timeRemaining ?? 180)}
          </div>
          <div className="stampede-timer-label">STORE CLOSING IN</div>
        </div>

        <div className="stampede-score-pill blue">
          <span>BLUE TEAM</span>
          <span className="stampede-score-num">
            {snapshot?.world.teamScores.blue ?? 0}
          </span>
        </div>
      </div>

      {/* PA ANNOUNCEMENT BANNER */}
      {snapshot?.world.activeAnnouncement && (
        <div className="stampede-announcement-banner">
          <Flame size={18} />
          <span>{snapshot.world.activeAnnouncement}</span>
        </div>
      )}

      {/* WHOLESALE PAPER RECEIPT MANIFEST */}
      {myManifest && (
        <div
          className="stampede-manifest-receipt"
          aria-label="Shopping List Receipt"
        >
          <div className="receipt-perforated-top" />
          <div className="receipt-inner">
            <div className="receipt-barcode">||| | |||| | || |||</div>
            <div className="receipt-store-name">WHOLESALE CLUB</div>
            <div className="receipt-subhead">OFFICIAL MANIFEST RECEIPT</div>
            <div className="receipt-divider" />

            <div className="stampede-manifest-items">
              {myManifest.targetItems.map((ti) => {
                const def = ITEM_DEFS[ti.kind];
                const collected = carriedCounts[ti.kind] || 0;
                const isDone = collected >= ti.required;
                return (
                  <div
                    key={ti.kind}
                    className={`stampede-receipt-row ${isDone ? 'complete' : ''}`}
                  >
                    <span
                      className="item-name"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {isDone ? (
                        <CheckSquare size={13} />
                      ) : (
                        <Square size={13} />
                      )}
                      {ti.required}x {def.name}
                    </span>
                    <span className="count">
                      {collected}/{ti.required}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="receipt-divider" />

            {/* Mass / payload readout */}
            {myCart && (
              <div className="receipt-mass-section">
                <div className="receipt-mass-row">
                  <span>CART MASS</span>
                  <span>{myCart.totalMass} KG</span>
                </div>
                <div className="receipt-mass-status">
                  {myCart.totalMass > 140
                    ? 'EXTREME DRIFT'
                    : myCart.totalMass > 80
                      ? 'HEAVY INERTIA'
                      : 'LIGHT RUN'}
                </div>
              </div>
            )}

            {/* Contraband Alert */}
            {hasContraband && (
              <div className="stampede-contraband-alert">
                <AlertTriangle
                  size={12}
                  style={{ display: 'inline', marginRight: '4px' }}
                />
                CONTRABAND: 10-FT GIANT TEDDY!
              </div>
            )}

            {/* Rubber Stamp */}
            {displayReceiptStamp === 'approved' && (
              <div className="receipt-stamp approved">★ APPROVED ★</div>
            )}
            {displayReceiptStamp === 'rejected' && (
              <div className="receipt-stamp rejected">⚠ REJECTED ⚠</div>
            )}
          </div>
          <div className="receipt-perforated-bottom" />
        </div>
      )}

      {/* RETRO COCKPIT HUD (SPEED & WOBBLE HEAT) */}
      {myCart && (
        <div className="stampede-cockpit-hud" aria-label="Cart Cockpit HUD">
          <div className="stampede-speed-dial">
            <span className="speed-val">{cartSpeedMph}</span>
            <span className="speed-unit">{strings.speedUnit}</span>
          </div>

          <div className="stampede-wobble-gauge">
            <div className="wobble-header">
              <span>{strings.casterWobble}</span>
              <span className="wobble-pct">{wobblePct}%</span>
            </div>
            <div className="wobble-bar-bg">
              <div
                className="wobble-bar-fill"
                style={{ width: `${wobblePct}%` }}
              />
            </div>
          </div>

          {myCart.sugarRushTimer > 0 && (
            <div className="stampede-sugar-boost-pill">
              <Zap size={14} /> {strings.nitrous}{' '}
              {myCart.sugarRushTimer.toFixed(1)}s
            </div>
          )}
        </div>
      )}

      {/* AISLE RADAR MINIMAP */}
      {snapshot && (
        <WarehouseRadar snapshot={snapshot} selfCartId={selfCartId} />
      )}

      {/* ACTION CONTROLS */}
      <div className="stampede-controls-overlay">
        <button
          className="stampede-action-btn drift"
          onMouseDown={handleDriftPress}
          onMouseUp={handleDriftRelease}
          onTouchStart={handleDriftPress}
          onTouchEnd={handleDriftRelease}
          aria-label="Drift Handbrake"
        >
          <Zap size={16} /> {strings.drift}
        </button>

        <button
          className="stampede-action-btn grab"
          onClick={handleGrabberTrigger}
          aria-label="Use Grabber Pole"
        >
          <ShoppingBag size={16} /> {strings.grab}
        </button>
      </div>

      {/* MOBILE TOUCH VIRTUAL JOYSTICK */}
      <TouchControls
        disabled={isGameOver || showHelp}
        move={(vector) => {
          const steer = -vector.x;
          const throttle = -vector.z;
          sceneRef.current?.setCustomInput({
            steer,
            throttle,
            x: steer,
            z: throttle,
          });
        }}
        jump={() => {
          handleGrabberTrigger();
        }}
      />

      {/* TOP RIGHT TOOLBAR */}
      <div className="stampede-top-right">
        <LanguageSwitcher variant="header" />
        <button
          className="stampede-icon-btn"
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? strings.muteAudio : strings.unmuteAudio}
          aria-label="Toggle Sound"
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        <button
          className="stampede-icon-btn"
          onClick={() => setShowHelp(true)}
          title={strings.rules}
          aria-label="Show Help"
        >
          <HelpCircle size={18} />
        </button>

        <button
          className="stampede-icon-btn"
          onClick={handleRestart}
          title={strings.restartDerby}
          aria-label="Restart Derby"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* HELP / INSTRUCTIONS MODAL */}
      {showHelp && (
        <dialog
          open
          className="stampede-modal-backdrop"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowHelp(false);
          }}
        >
          <div className="stampede-modal-card">
            <h2>{strings.rulesTitle}</h2>
            <p>
              {strings.rulesWelcome}
              <br />
              <br />
              <strong>{strings.rulesDriftingTitle}</strong>{' '}
              {strings.rulesDriftingDesc}
              <br />
              <br />
              <strong>{strings.rulesSampleTitle}</strong>{' '}
              {strings.rulesSampleDesc}
              <br />
              <br />
              <strong>🧲 Grabber Pole:</strong> Press <strong>SPACE</strong> or{' '}
              <strong>E</strong> to snag items off shelves, swat rival carts, or
              tumble cereal towers!
              <br />
              <br />
              <strong>{strings.rulesReceiptTitle}</strong>{' '}
              {strings.rulesReceiptDesc}
            </p>
            <button
              className="stampede-modal-btn"
              onClick={() => setShowHelp(false)}
            >
              {strings.letsShop}
            </button>
          </div>
        </dialog>
      )}

      {/* GAME OVER MODAL */}
      {isGameOver && (
        <dialog open className="stampede-modal-backdrop">
          <div className="stampede-modal-card">
            <Trophy
              size={48}
              color="#f1c40f"
              style={{ margin: '0 auto 12px auto' }}
            />
            <h2>{strings.storeClosed}</h2>
            <p>
              {snapshot.world.winnerTeam === 'red'
                ? strings.redWinsDerby
                : strings.blueWinsDerby}
            </p>

            <div className="stampede-modal-scores">
              <div className="stampede-modal-team-score">
                <span className="team-name" style={{ color: '#ff7675' }}>
                  {strings.redTeam}
                </span>
                <span className="team-pts">
                  {snapshot.world.teamScores.red}
                </span>
              </div>
              <div className="stampede-modal-team-score">
                <span className="team-name" style={{ color: '#74b9ff' }}>
                  {strings.blueTeam}
                </span>
                <span className="team-pts">
                  {snapshot.world.teamScores.blue}
                </span>
              </div>
            </div>

            <button className="stampede-modal-btn" onClick={handleRestart}>
              {strings.playAgain}
            </button>
          </div>
        </dialog>
      )}
    </main>
  );
}
