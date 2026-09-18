'use client';
/* oxlint-disable react/react-compiler -- WebGL host syncs scene controllers */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Luggage,
  Plane,
  RotateCcw,
  Sparkles,
  Timer,
} from 'lucide-react';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import type { PeerGameConnection } from '../../shared/peer/connection';
import GameToolbar from '../../shared/ui/GameToolbar';
import { carryOnCarnageAnalytics } from './analytics';
import { CarryOnAudio } from './audio';
import { reconcileCarryOnBots, updateCarryOnBots } from './bots';
import { CarryOnScene } from './scene';
import {
  advanceCarryOn,
  carryOnAction,
  carryOnSnapshot,
  freshCarryOnWorld,
  newTraveler,
} from './simulation';
import {
  idleInput,
  timeLeft,
  type CarryOnAction,
  type CarryOnSession,
  type CarryOnSnapshot,
  type CarryOnWorld,
  type PlayerInput,
  type Suitcase,
} from './types';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import { CARRY_ON_TRANSLATIONS } from './translations';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyGoal, partyRound } from '../../shared/ui/party-round';

const tracker = new GameTracker(carryOnCarnageAnalytics);

const formatTime = (ms: number) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function CarryOnCarnageGame() {
  const { t } = useLanguage();
  const strings = t(CARRY_ON_TRANSLATIONS);
  useGameTracker(tracker);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CarryOnScene | null>(null);
  const audioRef = useRef<CarryOnAudio | null>(null);
  const networkRef = useRef<PeerGameConnection<CarryOnSnapshot> | null>(null);
  const localWorld = useRef<CarryOnWorld | null>(null);
  const currentInput = useRef<PlayerInput>(idleInput());
  const eventIdRef = useRef(100);
  const lastEventSeenRef = useRef(0);
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(hudPacer<CarryOnSnapshot>(({ world: w }) => `${w.phase}`));

  const [snapshot, setSnapshot] = useState<CarryOnSnapshot | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionRef = useRef<CarryOnSession>({
    id: 'traveler-solo',
    token: 'solo-token',
    code: 'SOLO',
    name: 'Desperate Traveler',
    color: 0,
  });

  const dispatchAction = useCallback((act: CarryOnAction) => {
    tracker.action(act.type);
    audioRef.current?.unlock();

    if (networkRef.current) {
      void networkRef.current.action(act);
    } else if (localWorld.current) {
      carryOnAction(
        localWorld.current,
        sessionRef.current.id,
        act,
        eventIdRef.current ? eventIdRef : { current: 100 },
      );
    }
  }, []);

  // Initialize scene and synthesized audio
  useEffect(() => {
    if (!containerRef.current) return;

    audioRef.current = new CarryOnAudio();

    sceneRef.current = new CarryOnScene(containerRef.current, {
      input: (inp: PlayerInput) => {
        currentInput.current = inp;
        if (localWorld.current) {
          const p = localWorld.current.players.find(
            (pl) => pl.id === sessionRef.current.id,
          );
          if (p) {
            p.input = inp;
          }
        }
      },
      onInteract: (action: 'grab' | 'compress' | 'zip' | 'drop') => {
        dispatchAction({ type: 'interact', action });
      },
    });

    // Start local solo practice simulation
    const initialWorld = freshCarryOnWorld(Date.now());
    const me = newTraveler(
      sessionRef.current.id,
      sessionRef.current.name,
      0,
      Date.now(),
    );
    initialWorld.players.push(me);
    reconcileCarryOnBots(initialWorld, Date.now());
    localWorld.current = initialWorld;

    const initialSnap = carryOnSnapshot(
      initialWorld,
      'SOLO',
      sessionRef.current.id,
      sessionRef.current.id,
    );
    setSnapshot(initialSnap);

    // 60fps simulation loop
    let lastTime = performance.now();
    let animId: number;

    const loop = (nowTime: number) => {
      const dt = Math.min((nowTime - lastTime) / 1000, 0.1);
      lastTime = nowTime;

      if (localWorld.current) {
        const w = localWorld.current;
        const now = Date.now();

        // Update bots & simulation
        updateCarryOnBots(w, now, eventIdRef);
        advanceCarryOn(w, dt, eventIdRef);

        // Process audio events & visual burst particles
        for (const evt of w.events) {
          if (evt.id > lastEventSeenRef.current) {
            lastEventSeenRef.current = evt.id;
            if (soundEnabled) {
              audioRef.current?.playEvent(evt);
            }

            if (evt.type === 'burst' && evt.pos && sceneRef.current) {
              sceneRef.current.spawnBurstParticles(evt.pos);
            }

            // Show toast message
            setToast({ text: evt.text, id: evt.id });
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => {
              setToast(null);
            }, 3200);
          }
        }

        const snap = carryOnSnapshot(
          w,
          'SOLO',
          sessionRef.current.id,
          sessionRef.current.id,
        );
        if (hud.current.due(snap)) setSnapshot(snap);
        sceneRef.current?.render(snap, sessionRef.current.id);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      sceneRef.current?.dispose();
    };
  }, [dispatchAction, soundEnabled]);

  const world = snapshot?.world;
  const me = world?.players.find((p) => p.id === sessionRef.current.id);
  const remainingMs = world ? timeLeft(world) : 0;
  const isUrgent = remainingMs < 30_000 && remainingMs > 0;

  // Nearby suitcase calculation for HUD
  let nearbySc: Suitcase | undefined;
  if (world && me) {
    nearbySc = world.suitcases.find(
      (sc) => Math.hypot(sc.x - me.x, sc.z - me.z) < 2.0,
    );
  }

  return (
    <div
      className="carryon-container"
      {...partyRound(
        world?.phase === 'flight_departed',
        world
          ? partyGoal(world.approvedCount >= world.targetBags, world.totalScore)
          : null,
      )}
    >
      {/* 3D Canvas */}
      <div ref={containerRef} className="carryon-canvas" />

      {/* Top App Header & Collection Navigation */}
      <header className="topbar carryon-topbar">
        <a href="/" className="wordmark">
          <span className="carryon-mark">
            <Luggage size={22} />
          </span>{' '}
          CARRY-ON CARNAGE<span className="title-dot">.</span>
        </a>
        <GameToolbar
          muted={!soundEnabled}
          onToggleSound={() => setSoundEnabled((v) => !v)}
          onHelp={() => {}}
          workshop="/carry-on-carnage/admin"
        />
      </header>

      {/* Top Left: Target Baggage Quota */}
      {world && (
        <div className="carryon-target-hud house-card">
          <Luggage size={18} />
          <span>{strings.bagsApproved}</span>
          <span className="carryon-target-count">
            {world.approvedCount} / {world.targetBags}
          </span>
        </div>
      )}

      {/* Top Center: Airport FIDS Board */}
      {world && (
        <div className="carryon-fids">
          <div className="carryon-fids-flight">
            <span className="carryon-fids-label">{strings.flightToIbiza}</span>
            <div className="carryon-fids-status-row">
              <span
                className={`carryon-fids-dot ${isUrgent ? 'urgent' : ''}`}
              />
              <span className="carryon-fids-code">
                {isUrgent ? strings.finalCall : strings.nowBoarding}
              </span>
            </div>
          </div>
          <div className={`carryon-fids-timer ${isUrgent ? 'urgent' : ''}`}>
            <Timer size={18} />
            <span className="carryon-fids-clock">
              {formatTime(remainingMs)}
            </span>
          </div>
        </div>
      )}

      {/* Top Right: Score & Fee Meters */}
      {world && (
        <div className="carryon-score-hud">
          <div className="carryon-score-badge">
            <Sparkles size={16} />
            <span>
              {world.totalScore} {strings.pts}
            </span>
          </div>
          {world.feesPaid > 0 && (
            <div className="carryon-fee-badge">
              <AlertTriangle size={14} />
              <span>
                -${world.feesPaid} {strings.gateFees}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Event Toast Notification */}
      {toast && <div className="carryon-toast">{toast.text}</div>}

      {/* Luggage Strain & Compression Gauge HUD */}
      {nearbySc && (
        <div className="carryon-luggage-hud house-card">
          <div className="carryon-luggage-status-pill">
            {nearbySc.approved ? (
              <span className="carryon-status is-good">
                {strings.sizerApproved}
              </span>
            ) : nearbySc.burst ? (
              <span className="carryon-status is-danger">
                {strings.pinataBurst}
              </span>
            ) : nearbySc.zipped >= 0.98 ? (
              <span className="carryon-status is-good">
                {me?.sittingOn === nearbySc.id
                  ? strings.fullyZippedHopOff
                  : strings.fullyZippedCarry}
              </span>
            ) : me?.sittingOn === nearbySc.id ? (
              <span className="carryon-status is-good">
                {strings.sittingCompressing.replace(
                  '{pct}',
                  String(Math.round(nearbySc.compression * 100)),
                )}
              </span>
            ) : nearbySc.bulge > 0.15 ? (
              <span className="carryon-status is-warn">
                {strings.overstuffed}
              </span>
            ) : (
              <span className="carryon-status is-info">{strings.packMore}</span>
            )}
          </div>

          <div className="carryon-gauge-row">
            <span>{strings.luggageBulge}</span>
            <span
              className={`carryon-gauge-value ${nearbySc.strain > 0.7 ? 'is-danger' : ''}`}
            >
              {Math.round(nearbySc.strain * 50)}%
            </span>
          </div>
          <div className="carryon-bar-bg">
            <div
              className={`carryon-bar-fill strain ${nearbySc.strain > 0.7 ? 'danger' : ''}`}
              style={{ width: `${Math.min(100, nearbySc.strain * 50)}%` }}
            />
          </div>

          <div className="carryon-gauge-row">
            <span>{strings.compressionWeight}</span>
            <span className="carryon-gauge-value is-warn">
              {Math.round(nearbySc.compression * 100)}%
              {nearbySc.sittingCount > 0
                ? strings.sittingCount.replace(
                    '{count}',
                    String(nearbySc.sittingCount),
                  )
                : ''}
            </span>
          </div>
          <div className="carryon-bar-bg">
            <div
              className="carryon-bar-fill comp"
              style={{ width: `${Math.round(nearbySc.compression * 100)}%` }}
            />
          </div>

          <div className="carryon-gauge-row">
            <span>{strings.zipperClosure}</span>
            <span className="carryon-gauge-value is-good">
              {Math.round(nearbySc.zipped * 100)}%
            </span>
          </div>
          <div className="carryon-bar-bg">
            <div
              className="carryon-bar-fill zip"
              style={{ width: `${Math.round(nearbySc.zipped * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Controls Prompt Dock */}
      <div className="carryon-dock tool-dock">
        <button
          type="button"
          className={`carryon-dock-btn ${me?.holdingItem || me?.holdingSuitcase ? 'highlight active' : ''}`}
          onClick={() => dispatchAction({ type: 'interact', action: 'grab' })}
        >
          <span>
            {me?.holdingItem
              ? strings.packIntoBag
              : me?.holdingSuitcase
                ? strings.insertInSizer
                : me?.sittingOn === nearbySc?.id
                  ? nearbySc && nearbySc.items.length > 0
                    ? strings.removeItem
                    : strings.hopOffKey
                  : nearbySc && nearbySc.zipped >= 0.95
                    ? strings.pickUpSuitcase
                    : nearbySc && nearbySc.items.length > 0
                      ? strings.removeItem
                      : strings.grabItem}
          </span>
          <span className="carryon-key-badge house-key">E</span>
        </button>

        <button
          type="button"
          className={`carryon-dock-btn ${me?.sittingOn ? 'highlight active' : ''}`}
          onClick={() =>
            dispatchAction({ type: 'interact', action: 'compress' })
          }
        >
          <span>{me?.sittingOn ? strings.hopOff : strings.sitCompress}</span>
          <span className="carryon-key-badge house-key">R</span>
        </button>

        <button
          type="button"
          className="carryon-dock-btn"
          onClick={() => dispatchAction({ type: 'interact', action: 'zip' })}
        >
          <span>{strings.pullZipper}</span>
          <span className="carryon-key-badge house-key">F</span>
        </button>

        <button
          type="button"
          className="carryon-dock-btn"
          onClick={() => dispatchAction({ type: 'interact', action: 'drop' })}
        >
          <span>{strings.dropRelease}</span>
          <span className="carryon-key-badge house-key">Q</span>
        </button>
      </div>

      {/* Round End Modal */}
      {world?.phase === 'flight_departed' && (
        <div className="carryon-end-modal">
          <div className="carryon-end-card">
            <Plane size={48} />
            <h2 className="carryon-end-title">
              {world.approvedCount >= world.targetBags
                ? strings.boardingComplete
                : strings.flightDeparted}
            </h2>
            <p className="carryon-end-desc">
              {world.approvedCount >= world.targetBags
                ? strings.successDesc
                : strings.failDesc}
            </p>

            <div className="carryon-end-stats">
              <div className="carryon-stat-box">
                <span className="carryon-stat-label">
                  {strings.approvedBagsStat}
                </span>
                <span className="carryon-stat-value is-good">
                  {world.approvedCount} / {world.targetBags}
                </span>
              </div>
              <div className="carryon-stat-box">
                <span className="carryon-stat-label">
                  {strings.contrabandStat}
                </span>
                <span className="carryon-stat-value">
                  {world.contrabandCount}
                </span>
              </div>
              <div className="carryon-stat-box">
                <span className="carryon-stat-label">
                  {strings.gateFeesStat}
                </span>
                <span className="carryon-stat-value is-danger">
                  -${world.feesPaid}
                </span>
              </div>
              <div className="carryon-stat-box">
                <span className="carryon-stat-label">
                  {strings.netScoreStat}
                </span>
                <span className="carryon-stat-value is-accent">
                  {world.totalScore} PTS
                </span>
              </div>
            </div>

            <button
              type="button"
              className="carryon-restart-btn"
              onClick={() => dispatchAction({ type: 'restart' })}
            >
              <RotateCcw size={18} />
              <span>{strings.catchNextFlight}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
