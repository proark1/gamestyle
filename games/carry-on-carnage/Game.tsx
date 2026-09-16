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

const tracker = new GameTracker(carryOnCarnageAnalytics);

const formatTime = (ms: number) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function CarryOnCarnageGame() {
  useGameTracker(tracker);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CarryOnScene | null>(null);
  const audioRef = useRef<CarryOnAudio | null>(null);
  const networkRef = useRef<PeerGameConnection<CarryOnSnapshot> | null>(null);
  const localWorld = useRef<CarryOnWorld | null>(null);
  const currentInput = useRef<PlayerInput>(idleInput());
  const eventIdRef = useRef(100);
  const lastEventSeenRef = useRef(0);

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
        setSnapshot(snap);
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
    <div className="carryon-container">
      {/* 3D Canvas */}
      <div ref={containerRef} className="carryon-canvas" />

      {/* Top App Header & Collection Navigation */}
      <GameToolbar
        muted={!soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        onHelp={() => {}}
        workshop="/carry-on-carnage/admin"
      />

      {/* Top Left: Target Baggage Quota */}
      {world && (
        <div className="carryon-target-hud">
          <Luggage size={18} className="text-sky-400" />
          <span>Bags Approved:</span>
          <span className="carryon-target-count">
            {world.approvedCount} / {world.targetBags}
          </span>
        </div>
      )}

      {/* Top Center: Airport FIDS Board */}
      {world && (
        <div className="carryon-fids">
          <div className="carryon-fids-flight">
            <span className="carryon-fids-label">BudgetAir · Gate B12</span>
            <span className="carryon-fids-code">FLIGHT 707 TO IBIZA</span>
          </div>
          <div className={`carryon-fids-timer ${isUrgent ? 'urgent' : ''}`}>
            <Timer
              size={16}
              className={isUrgent ? 'text-red-400' : 'text-amber-400'}
            />
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
            <span>{world.totalScore} PTS</span>
          </div>
          {world.feesPaid > 0 && (
            <div className="carryon-fee-badge">
              <AlertTriangle size={14} />
              <span>-${world.feesPaid} GATE FEES</span>
            </div>
          )}
        </div>
      )}

      {/* Event Toast Notification */}
      {toast && <div className="carryon-toast">{toast.text}</div>}

      {/* Luggage Strain & Compression Gauge HUD */}
      {nearbySc && (
        <div className="carryon-luggage-hud">
          <div className="carryon-gauge-row">
            <span>Luggage Bulge & Seam Strain:</span>
            <span>{Math.round(nearbySc.strain * 50)}%</span>
          </div>
          <div className="carryon-bar-bg">
            <div
              className="carryon-bar-fill strain"
              style={{ width: `${Math.min(100, nearbySc.strain * 50)}%` }}
            />
          </div>

          <div className="carryon-gauge-row">
            <span>Compression Weight (Sit/Stomp):</span>
            <span>{Math.round(nearbySc.compression * 100)}%</span>
          </div>
          <div className="carryon-bar-bg">
            <div
              className="carryon-bar-fill comp"
              style={{ width: `${Math.round(nearbySc.compression * 100)}%` }}
            />
          </div>

          <div className="carryon-gauge-row">
            <span>Zipper Closure:</span>
            <span>{Math.round(nearbySc.zipped * 100)}%</span>
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
      <div className="carryon-dock">
        <button
          type="button"
          className={`carryon-dock-btn ${me?.holdingItem || me?.holdingSuitcase ? 'highlight' : ''}`}
          onClick={() => dispatchAction({ type: 'interact', action: 'grab' })}
        >
          <span className="carryon-key-badge">E</span>
          <span>
            {me?.holdingItem
              ? 'Pack into Bag'
              : me?.holdingSuitcase
                ? 'Insert in Sizer'
                : 'Grab / Open'}
          </span>
        </button>

        <button
          type="button"
          className={`carryon-dock-btn ${me?.sittingOn ? 'highlight' : ''}`}
          onClick={() =>
            dispatchAction({ type: 'interact', action: 'compress' })
          }
        >
          <span className="carryon-key-badge">R</span>
          <span>{me?.sittingOn ? 'Hop Off' : 'Sit & Compress'}</span>
        </button>

        <button
          type="button"
          className="carryon-dock-btn"
          onClick={() => dispatchAction({ type: 'interact', action: 'zip' })}
        >
          <span className="carryon-key-badge">F</span>
          <span>Pull Zipper</span>
        </button>

        <button
          type="button"
          className="carryon-dock-btn"
          onClick={() => dispatchAction({ type: 'interact', action: 'drop' })}
        >
          <span className="carryon-key-badge">Q</span>
          <span>Drop / Release</span>
        </button>
      </div>

      {/* Round End Modal */}
      {world?.phase === 'flight_departed' && (
        <div className="carryon-end-modal">
          <div className="carryon-end-card">
            <Plane size={48} className="text-amber-400" />
            <h2 className="carryon-end-title">
              {world.approvedCount >= world.targetBags
                ? 'Boarding Complete!'
                : 'Flight Departed!'}
            </h2>
            <p className="text-slate-300 text-sm">
              {world.approvedCount >= world.targetBags
                ? 'Your crew successfully squeezed and sized all carry-ons into the metal box!'
                : 'The jetway closed! Any unapproved luggage was slapped with a $150 penalty fee.'}
            </p>

            <div className="carryon-end-stats">
              <div className="carryon-stat-box">
                <span className="text-slate-400 text-xs">Approved Bags</span>
                <span className="text-xl font-bold text-emerald-400">
                  {world.approvedCount} / {world.targetBags}
                </span>
              </div>
              <div className="carryon-stat-box">
                <span className="text-slate-400 text-xs">
                  Contraband Smuggled
                </span>
                <span className="text-xl font-bold text-sky-400">
                  {world.contrabandCount}
                </span>
              </div>
              <div className="carryon-stat-box">
                <span className="text-slate-400 text-xs">
                  Gate Fees Charged
                </span>
                <span className="text-xl font-bold text-rose-400">
                  -${world.feesPaid}
                </span>
              </div>
              <div className="carryon-stat-box">
                <span className="text-slate-400 text-xs">Net Score</span>
                <span className="text-xl font-bold text-amber-400">
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
              <span>Catch Next Flight</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
