'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Flame,
  Zap,
  CheckSquare,
  Square,
  Pause,
  Settings,
  ListChecks,
  Trophy,
} from 'lucide-react';
import { SampleStampedeScene } from './scene';
import { SampleStampedeSound } from './sound';
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
import { StampedeModal } from './Modal';
import { STAMPEDE_UI, ITEM_NAMES } from './ui-copy';
import { displayedSpeed, neutralInput } from './controls';
import { useLanguage } from '../../shared/language/useLanguage';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import GameToolbar from '../../shared/ui/GameToolbar';
import { SAMPLE_STAMPEDE_TRANSLATIONS } from './translations';
import { hudPacer } from '../../shared/ui/hud-pacer';
import {
  leadingSide,
  partyRound,
  partyVersus,
} from '../../shared/ui/party-round';

const tracker = new GameTracker(sampleStampedeAnalytics);

// "DRIFT [SHIFT]" reads as a label and a house key cap. Labels without a
// trailing bracketed key pass through unchanged.
function KeyHint({ text }: { text: string }) {
  const match = /^(.*?)\s*\[([^\]]{1,12})\]$/.exec(text.trim());
  if (!match) return <>{text}</>;
  return (
    <>
      <span>{match[1]}</span>
      <kbd className="house-key">{match[2]}</kbd>
    </>
  );
}

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
};

function WarehouseRadar({
  snapshot,
  selfCartId,
  label,
  legend,
}: {
  snapshot: SampleStampedeSnapshot;
  selfCartId: string;
  label: string;
  legend: string;
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
    <div className="stampede-radar-box" aria-label={label}>
      <div className="stampede-radar-title">{label}</div>
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
      <div className="stampede-radar-legend">{legend}</div>
    </div>
  );
}

export default function SampleStampede() {
  useGameTracker(tracker);
  const { t, language } = useLanguage();
  const copy = t(STAMPEDE_UI);
  const names = ITEM_NAMES[language] ?? ITEM_NAMES.en;
  const languageRef = useRef(language);
  const strings = t(SAMPLE_STAMPEDE_TRANSLATIONS);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SampleStampedeScene | null>(null);
  const audioRef = useRef<SampleStampedeSound | null>(null);
  const physicsRef = useRef<SampleStampedePhysics | null>(null);
  const worldRef = useRef<SampleStampedeWorld | null>(null);
  useLayoutEffect(() => {
    languageRef.current = language;
    sceneRef.current?.setLanguage(language);
  }, [language]);
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<SampleStampedeSnapshot>(
      ({ world: w }) => `${w.status}:${w.phase}`,
    ),
  );

  const currentInput = useRef(neutralInput());
  const [snapshot, setSnapshot] = useState<SampleStampedeSnapshot | null>(null);
  const [selfId] = useState('player-local');
  const [selfCartId] = useState('cart-red');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  const [receiptStatus, setReceiptStatus] = useState<
    'approved' | 'rejected' | null
  >(null);
  const receiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [screen, setScreen] = useState<
    'ready' | 'playing' | 'paused' | 'help' | 'settings' | 'restart'
  >('ready');
  const [renderError, setRenderError] = useState(false);
  const playingRef = useRef(false);
  const grabTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => {
    playingRef.current = screen === 'playing';
    sceneRef.current?.setInputEnabled(playingRef.current);
    audioRef.current?.setMuted(!soundEnabled || !playingRef.current);
  }, [screen, soundEnabled]);
  useEffect(() => {
    const pause = () =>
      setScreen((current) => (current === 'playing' ? 'paused' : current));
    const hidden = () => {
      if (document.hidden) pause();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && playingRef.current) {
        event.preventDefault();
        pause();
      }
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('keydown', keyboard);
    };
  }, []);

  const room = usePeerRoom<SampleStampedeSnapshot>({
    game: 'sample-stampede',
    onOpen: () => setScreen('playing'),
    loadEngine: () => import('./peer'),
    idleInput: neutralInput,
    readInput: () =>
      playingRef.current ? currentInput.current : neutralInput(),
    onAttach: () => {
      currentInput.current = neutralInput();
      setScreen('playing');
      hud.current.reset();
      sceneRef.current?.resetRound();
      audioRef.current?.reset();
    },
    receive: (snap) => {
      if (hud.current.due(snap)) setSnapshot(snap);
      sceneRef.current?.render(snap, snap.world.events);
      if (playingRef.current) audioRef.current?.update(snap, snap.world.events);
    },
  });
  const { send, active } = room;

  const lastFrameTime = useRef(0);
  const animId = useRef(0);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    audioRef.current?.setMuted(!soundEnabled || !playingRef.current);
  }, [soundEnabled]);

  useEffect(() => {
    if (!containerRef.current) return;

    const audio = new SampleStampedeSound();
    audioRef.current = audio;
    audio.setMuted(true);

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

    let scene: SampleStampedeScene;
    try {
      scene = new SampleStampedeScene(containerRef.current, {
        input: (inp: PlayerInput) => {
          currentInput.current = inp;
          const p = worldRef.current?.players.find((pl) => pl.id === selfId);
          if (p) {
            p.input = inp;
          }
        },
      });
    } catch {
      queueMicrotask(() => setRenderError(true));
      audio.dispose();
      physics.destroy();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      return;
    }
    sceneRef.current = scene;
    scene.setLanguage(languageRef.current);
    const contextLost = (event: Event) => {
      event.preventDefault();
      playingRef.current = false;
      scene.setInputEnabled(false);
      setScreen('paused');
      setRenderError(true);
      audio.setMuted(true);
    };
    scene.renderer.domElement.addEventListener('webglcontextlost', contextLost);
    scene.setInputEnabled(playingRef.current);

    lastFrameTime.current = performance.now();

    const tick = (timeMs: number) => {
      animId.current = requestAnimationFrame(tick);
      const dt = Math.max(
        0,
        Math.min((timeMs - lastFrameTime.current) / 1000, 0.05),
      );
      lastFrameTime.current = timeMs;

      if (!active.current && worldRef.current && physicsRef.current) {
        const events: StampedeEvent[] = [];
        if (playingRef.current)
          advanceSampleStampedeWorld(
            worldRef.current,
            physicsRef.current,
            dt,
            events,
          );

        const meCart = worldRef.current.carts.find((c) => c.id === selfCartId);

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
        // The solo world does not keep its events, so sound gets this frame's.
        if (playingRef.current) audio.update(snap, events);
        if (snap.world.status === 'finished') scene.setInputEnabled(false);
        if (hud.current.due(snap)) setSnapshot(snap);
        // The solo world keeps no events, so the scene gets this frame's.
        scene.render(snap, events);
      }
    };

    animId.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId.current);
      if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      if (grabTimer.current) clearTimeout(grabTimer.current);
      scene.renderer.domElement.removeEventListener(
        'webglcontextlost',
        contextLost,
      );
      scene.destroy();
      audio.dispose();
      physics.destroy();
    };
  }, [selfId, selfCartId, active]);

  const handleRestart = () => {
    if (send({ type: 'reset' })) {
      setScreen('playing');
      return;
    }
    if (!worldRef.current || !physicsRef.current) return;
    const now = Date.now();
    const fresh = freshSampleStampedeWorld(now);
    fresh.players = worldRef.current.players.map((player) => ({
      ...player,
      input: neutralInput(),
    }));
    sceneRef.current?.resetRound();
    audioRef.current?.reset();
    if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current);
    if (grabTimer.current) clearTimeout(grabTimer.current);
    setReceiptStatus(null);
    setScreen('playing');
    worldRef.current = fresh;
    physicsRef.current.destroy();
    physicsRef.current = new SampleStampedePhysics(fresh);
    playingRef.current = true;
    sceneRef.current?.setInputEnabled(true);
    audioRef.current?.setMuted(!soundEnabledRef.current);
    hud.current.reset();
    setSnapshot(sampleStampedeSnapshot(fresh, 'SOLO', selfId, selfId, 1));
  };

  const handleDriftPress = () => {
    if (playingRef.current) sceneRef.current?.setCustomInput({ drift: true });
  };
  const handleDriftRelease = () => {
    sceneRef.current?.setCustomInput({ drift: false });
  };

  const handleGrabberTrigger = () => {
    if (!playingRef.current) return;
    if (grabTimer.current) clearTimeout(grabTimer.current);
    sceneRef.current?.setCustomInput({ grabberAction: true });
    grabTimer.current = setTimeout(() => {
      sceneRef.current?.setCustomInput({ grabberAction: false });
    }, 200);
  };

  const playerCartId =
    snapshot?.world.players.find((p) => p.id === (room.session?.id ?? selfId))
      ?.cartId ?? selfCartId;
  const myCart = snapshot?.world.carts.find((c) => c.id === playerCartId);
  const myManifest = myCart?.manifest;
  const hasContraband = myCart?.items.some(
    (it) => ITEM_DEFS[it.kind].isContraband,
  );
  const isGameOver = snapshot?.world.status === 'finished';

  const cartSpeedMph = myCart
    ? displayedSpeed(myCart.vx, myCart.vz, language)
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

  const completed =
    myManifest?.targetItems.filter(
      (item) => (carriedCounts[item.kind] ?? 0) >= item.required,
    ).length ?? 0;
  const activeKiosk = snapshot?.world.kiosks.find((kiosk) => kiosk.active);
  const resume = () => {
    audioRef.current?.unlock();
    setScreen('playing');
  };
  const instructions = screen === 'ready' || screen === 'help';
  const shoppingList = (
    <ul className="stampede-paused-list">
      {myManifest?.targetItems.map((item) => (
        <li key={item.kind}>
          <span>{names[item.kind]}</span>
          <strong>
            {carriedCounts[item.kind] ?? 0}/{item.required}
          </strong>
        </li>
      ))}
    </ul>
  );
  return (
    <main
      className="stampede-container"
      {...partyRound(
        !!isGameOver,
        snapshot
          ? partyVersus(
              snapshot.myTeam,
              leadingSide(snapshot.world.teamScores),
              snapshot.world.teamScores,
            )
          : null,
      )}
    >
      <div ref={containerRef} className="stampede-canvas-wrapper" />
      {myCart && myCart.sugarRushTimer > 0 && (
        <div className="stampede-speed-lines" aria-hidden="true" />
      )}
      <header className="stampede-topbar">
        <a href="/" className="stampede-home" aria-label={copy.returnToStore}>
          <ShoppingCart size={22} />
          <span>Sample Stampede</span>
        </a>
        <div className="stampede-tools">
          <PeerRoomControls room={room} withVoice />
          <button
            className="stampede-icon-btn"
            onClick={() => setScreen('paused')}
            aria-label={copy.pause}
          >
            <Pause size={20} />
          </button>
          <button
            className="stampede-icon-btn"
            onClick={() => setScreen('help')}
            aria-label={copy.help}
          >
            ?
          </button>
          <button
            className="stampede-icon-btn"
            onClick={() => setScreen('settings')}
            aria-label={copy.settings}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>
      <div className="stampede-hud-top">
        <div className="stampede-score-pill red">
          <span>{copy.red}</span>
          <span className="stampede-score-num">
            {snapshot?.world.teamScores.red ?? 0}
          </span>
        </div>
        <div className="stampede-timer-box">
          <div className="stampede-timer">
            {formatTime(snapshot?.world.timeRemaining ?? 180)}
          </div>
          <div className="stampede-timer-label">{copy.closing}</div>
        </div>
        <div className="stampede-score-pill blue">
          <span>{copy.blue}</span>
          <span className="stampede-score-num">
            {snapshot?.world.teamScores.blue ?? 0}
          </span>
        </div>
      </div>
      {snapshot?.world.activeAnnouncement && activeKiosk && (
        <div className="stampede-announcement-banner">
          <Flame size={16} />
          <span>
            {copy.stand} {snapshot.world.kiosks.indexOf(activeKiosk) + 1}:{' '}
            {names[activeKiosk.sampleKind]}
          </span>
        </div>
      )}
      <button
        className="stampede-list-toggle"
        onClick={() => setScreen('paused')}
      >
        <ListChecks size={18} />
        {copy.list}{' '}
        <strong>
          {completed}/{myManifest?.targetItems.length ?? 4}
        </strong>
      </button>
      {myManifest && (
        <section className="stampede-manifest-receipt" aria-label={copy.list}>
          <div className="receipt-perforated-top" />
          <div className="receipt-inner">
            <div className="receipt-store-name">{copy.list}</div>
            <div className="receipt-divider" />
            <div className="stampede-manifest-items">
              {myManifest.targetItems.map((item) => {
                const count = carriedCounts[item.kind] ?? 0,
                  done = count >= item.required;
                return (
                  <div
                    key={item.kind}
                    className={`stampede-receipt-row${done ? ' complete' : ''}`}
                  >
                    <span className="item-name">
                      {done ? <CheckSquare size={14} /> : <Square size={14} />}{' '}
                      {names[item.kind]}
                    </span>
                    <span className="count">
                      {count}/{item.required}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="receipt-divider" />
            <div className="receipt-mass-row">
              <span>{copy.mass}</span>
              <span>{myCart?.totalMass ?? 45} kg</span>
            </div>
            {hasContraband && (
              <p className="stampede-contraband-alert">{copy.contraband}</p>
            )}
            <p className="stampede-checkout-hint">{copy.checkout} ↓</p>
          </div>
          <div className="receipt-perforated-bottom" />
        </section>
      )}
      <output className="stampede-feedback" aria-live="polite">
        {displayReceiptStamp
          ? displayReceiptStamp === 'approved'
            ? copy.approved
            : copy.rejected
          : ''}
      </output>
      {myCart && (
        <div className="stampede-cockpit-hud" aria-label={strings.casterWobble}>
          <div className="stampede-speed-dial">
            <span className="speed-val">{cartSpeedMph}</span>
            <span className="speed-unit">{strings.speedUnit}</span>
          </div>
          <div className="stampede-wobble-gauge">
            <div className="wobble-header">
              <span>{strings.casterWobble}</span>
              <span>{wobblePct}%</span>
            </div>
            <div className="wobble-bar-bg">
              <div
                className="wobble-bar-fill"
                style={{ width: `${wobblePct}%` }}
              />
            </div>
          </div>
          {myCart.sugarRushTimer > 0 && (
            <span className="stampede-sugar-boost-pill">
              <Zap size={14} />
              {myCart.sugarRushTimer.toFixed(1)}s
            </span>
          )}
        </div>
      )}
      {snapshot && (
        <WarehouseRadar
          snapshot={snapshot}
          selfCartId={playerCartId}
          label={strings.aisleRadar}
          legend={`${copy.you} ● · ${copy.checkout} ▧`}
        />
      )}
      <div className="stampede-controls-overlay">
        <button
          className="stampede-action-btn drift"
          disabled={screen !== 'playing' || isGameOver}
          aria-label={strings.drift.replace(/\s*\[.*\]/, '')}
          onPointerDown={(event) => {
            event.preventDefault();
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            handleDriftPress();
          }}
          onPointerUp={handleDriftRelease}
          onPointerCancel={handleDriftRelease}
          onLostPointerCapture={handleDriftRelease}
          onBlur={handleDriftRelease}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              handleDriftPress();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              handleDriftRelease();
            }
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <Zap size={17} />
          <KeyHint text={strings.drift} />
        </button>
        <button
          className="stampede-action-btn grab"
          disabled={screen !== 'playing' || isGameOver}
          onClick={handleGrabberTrigger}
          aria-label={strings.grab.replace(/\s*\[.*\]/, '')}
        >
          <ShoppingBag size={17} />
          <KeyHint text={strings.grab} />
        </button>
      </div>
      <TouchControls
        joystickLabel={
          language === 'de'
            ? 'Lenkstick. Ziehen oder Pfeiltasten verwenden; zum Stoppen loslassen.'
            : undefined
        }
        moveLabel={language === 'de' ? 'FAHREN' : 'MOVE'}
        disabled={screen !== 'playing' || !!isGameOver}
        move={(vector) =>
          sceneRef.current?.setCustomInput({
            steer: -vector.x,
            throttle: -vector.z,
          })
        }
        jump={handleGrabberTrigger}
      />
      {renderError ? (
        <StampedeModal title={copy.error}>
          <p>{copy.errorHelp}</p>
          <button
            className="stampede-modal-btn"
            onClick={() => window.location.reload()}
          >
            {copy.reload}
          </button>
        </StampedeModal>
      ) : isGameOver ? (
        <StampedeModal title={strings.storeClosed}>
          <Trophy size={36} />
          <p>
            {snapshot.world.winnerTeam === null
              ? copy.draw
              : snapshot.world.winnerTeam === 'red'
                ? strings.redWinsDerby
                : strings.blueWinsDerby}
          </p>
          <div className="stampede-modal-scores">
            <span>
              {strings.redTeam}
              <strong>{snapshot.world.teamScores.red}</strong>
            </span>
            <span>
              {strings.blueTeam}
              <strong>{snapshot.world.teamScores.blue}</strong>
            </span>
          </div>
          <button
            data-party-setup-action=""
            className="stampede-modal-btn"
            onClick={handleRestart}
          >
            {strings.playAgain}
          </button>
          <a href="/">{copy.returnToStore}</a>
        </StampedeModal>
      ) : (
        screen !== 'playing' && (
          <StampedeModal
            title={
              instructions
                ? copy.ready
                : screen === 'restart'
                  ? copy.restartTitle
                  : screen === 'settings'
                    ? copy.settings
                    : copy.paused
            }
            close={screen === 'ready' ? undefined : resume}
          >
            {screen === 'ready' && (
              <button
                className="stampede-modal-btn"
                onClick={() => {
                  setScreen('playing');
                  room.setOpen(true);
                }}
              >
                Multiplayer
              </button>
            )}
            {instructions && (
              <>
                <p>{copy.objective}</p>
                <p className="stampede-desktop-help">{copy.keyboard}</p>
                <p className="stampede-touch-help">{copy.touch}</p>
                <p>{copy.tips}</p>
              </>
            )}
            {screen === 'paused' && (
              <>
                <p>{copy.objective}</p>
                {shoppingList}
                {hasContraband && <p>{copy.contraband}</p>}
              </>
            )}
            {screen === 'settings' && (
              <div className="stampede-settings">
                <GameToolbar
                  labels={
                    language === 'de'
                      ? {
                          controls: 'Spielsteuerung',
                          soundOn: 'Ton einschalten',
                          soundOff: 'Ton ausschalten',
                          musicOn: 'Musik einschalten',
                          musicOff: 'Musik ausschalten',
                          volume: 'Lautstärke',
                          help: 'Spielanleitung',
                        }
                      : undefined
                  }
                  muted={!soundEnabled}
                  onToggleSound={() => setSoundEnabled((value) => !value)}
                  onHelp={() => setScreen('help')}
                  voice={room.voice}
                />
              </div>
            )}
            {screen === 'restart' && <p>{copy.restartText}</p>}
            <button
              className="stampede-modal-btn"
              onClick={screen === 'restart' ? handleRestart : resume}
            >
              {screen === 'ready'
                ? copy.start
                : screen === 'restart'
                  ? copy.restart
                  : copy.resume}
            </button>
            {screen !== 'ready' && screen !== 'restart' && (
              <button
                data-party-setup-action=""
                className="stampede-secondary"
                onClick={() => setScreen('restart')}
              >
                <RotateCcw size={16} />
                {copy.restart}
              </button>
            )}
            {screen === 'restart' && (
              <button className="stampede-secondary" onClick={resume}>
                {copy.resume}
              </button>
            )}
          </StampedeModal>
        )
      )}
    </main>
  );
}
