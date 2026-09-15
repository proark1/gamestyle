'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Shield, Zap, Flame } from 'lucide-react';
import { ZorbClashScene } from './scene';
import { ZorbClashAudio } from './audio';
import {
  advanceZorbClash,
  freshZorbWorld,
  newZorbPlayer,
  zorbClashSnapshot,
} from './simulation';
import { ZorbClashPhysics } from './physics';
import type { PlayerInput, ZorbClashSnapshot, ZorbClashWorld } from './types';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { zorbClashAnalytics } from './analytics';
import './style.css';

const tracker = new GameTracker(zorbClashAnalytics);

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
};

export default function ZorbClash() {
  useGameTracker(tracker);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ZorbClashScene | null>(null);
  const audioRef = useRef<ZorbClashAudio | null>(null);
  const physicsRef = useRef<ZorbClashPhysics | null>(null);
  const worldRef = useRef<ZorbClashWorld | null>(null);

  const [snapshot, setSnapshot] = useState<ZorbClashSnapshot | null>(null);
  const [touchActive] = useState(
    () =>
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  );
  const [selfId] = useState('local-player');

  const lastFrameTime = useRef(0);
  const animId = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const audio = new ZorbClashAudio();
    audioRef.current = audio;

    const unlockAudio = () => {
      audio.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // Initialize local world & players
    const world = freshZorbWorld(Date.now());
    // Add human player
    world.players.push(newZorbPlayer(selfId, 'You', 0, 'red', false));
    // Add 3 AI bots for hilarious 2v2 action
    world.players.push(
      newZorbPlayer('bot-teammate', 'Bumper Bob', 1, 'red', true),
    );
    world.players.push(newZorbPlayer('bot-opp-1', 'Sumo Sam', 2, 'blue', true));
    world.players.push(
      newZorbPlayer('bot-opp-2', 'Rollin Ron', 3, 'blue', true),
    );

    worldRef.current = world;

    const physics = new ZorbClashPhysics(world);
    physicsRef.current = physics;

    const scene = new ZorbClashScene(containerRef.current, {
      input: (inp: PlayerInput) => {
        const p = world.players.find((pl) => pl.id === selfId);
        if (p) {
          p.input = inp;
          p.seen = world.clock;
        }
      },
    });
    sceneRef.current = scene;

    lastFrameTime.current = performance.now();

    // Main animation & simulation tick
    const tick = (timeMs: number) => {
      animId.current = requestAnimationFrame(tick);
      const dt = Math.min((timeMs - lastFrameTime.current) / 1000, 0.05);
      lastFrameTime.current = timeMs;

      if (worldRef.current && physicsRef.current) {
        advanceZorbClash(
          worldRef.current,
          physicsRef.current,
          dt,
          audioRef.current,
          (x, y, z, intensity) => {
            sceneRef.current?.emitImpactSparks(
              x,
              y,
              z,
              Math.floor(intensity * 25),
            );
          },
          (x, y, z) => {
            sceneRef.current?.emitConfetti(x, y, z);
          },
        );

        // Update sound for local player dash charge
        const me = worldRef.current.players.find((p) => p.id === selfId);
        if (me) {
          audioRef.current?.setDashCharge(me.dashCharge);
        }

        const snap = zorbClashSnapshot(
          worldRef.current,
          'SOLO',
          selfId,
          selfId,
          1,
        );

        setSnapshot(snap);
        sceneRef.current?.render(snap);
      }
    };

    animId.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId.current);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      scene.destroy();
      audio.destroy();
    };
  }, [selfId]);

  const handleRestart = () => {
    if (!worldRef.current || !physicsRef.current) return;
    worldRef.current.score = { red: 0, blue: 0 };
    worldRef.current.timeRemaining = 180;
    worldRef.current.status = 'playing';
    worldRef.current.bonkCount = 0;
    worldRef.current.lastGoal = null;
    physicsRef.current.resetBall();
    physicsRef.current.resetPlayers();
    audioRef.current?.whistle();
  };

  const setPlayerInput = (patch: Partial<PlayerInput>) => {
    const p = worldRef.current?.players.find((pl) => pl.id === selfId);
    if (p) {
      Object.assign(p.input, patch);
    }
  };

  // Touch stick tracking
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartPos.current || !sceneRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;
    const maxDist = 50;
    const normX = Math.max(-1, Math.min(1, dx / maxDist));
    const normZ = Math.max(-1, Math.min(1, -dy / maxDist));

    setPlayerInput({ x: normX, z: normZ });
  };

  const handleTouchEnd = () => {
    touchStartPos.current = null;
    setPlayerInput({ x: 0, z: 0 });
  };

  const me = snapshot?.world.players.find((p) => p.id === selfId);
  const isTurtle = me?.turtle ?? false;
  const isBraced = me?.braced ?? false;
  const dashCharge = me?.dashCharge ?? 0;
  const lastGoal = snapshot?.world.lastGoal;
  const isGoalScored = snapshot?.world.status === 'goal_scored';
  const isEnded = snapshot?.world.status === 'ended';

  return (
    <main className="zorb-container">
      <div ref={containerRef} className="zorb-canvas-wrapper" />

      {/* Top Header HUD */}
      <div className="zorb-hud-top">
        <div className="zorb-team-score red">
          <span>Red</span>
          <span className="zorb-score-num">
            {snapshot?.world.score.red ?? 0}
          </span>
        </div>

        <div className="zorb-timer-box">
          <div className="zorb-timer">
            {formatTime(snapshot?.world.timeRemaining ?? 180)}
          </div>
          <div className="zorb-bonk-count">
            <Flame size={13} /> {snapshot?.world.bonkCount ?? 0} BONKS
          </div>
        </div>

        <div className="zorb-team-score blue">
          <span className="zorb-score-num">
            {snapshot?.world.score.blue ?? 0}
          </span>
          <span>Blue</span>
        </div>
      </div>

      {/* Comical Upside-Down Turtle Alert */}
      {isTurtle && (
        <div className="zorb-turtle-banner">
          TURTLE&apos;D! 🐢
          <small>Wiggle WASD to roll over or get rammed by a teammate!</small>
        </div>
      )}

      {/* Goal Banner */}
      {isGoalScored && lastGoal && (
        <div className="zorb-goal-banner">
          <h1 className="zorb-goal-title">GOOOAL! ⚽</h1>
          <div className="zorb-goal-subtitle">
            {lastGoal.scorerName} scored for {lastGoal.team.toUpperCase()}!
          </div>
          {lastGoal.isTurtleGoal && (
            <div className="zorb-goal-turtle-badge">
              🔥 TURTLE GOAL! BONUS STYLE POINTS! 🔥
            </div>
          )}
        </div>
      )}

      {/* Bottom Controls / Meter HUD */}
      <div className="zorb-hud-bottom">
        <div className="zorb-dash-container">
          <div className="zorb-dash-label">
            <Zap size={15} color="#ffd166" />
            <span>Bumper Dash</span>
            <span className="zorb-dash-key">Space</span>
          </div>
          <div className="zorb-dash-bar-bg">
            <div
              className={`zorb-dash-bar-fill ${dashCharge > 0.85 ? 'ready' : ''}`}
              style={{ width: `${Math.round(dashCharge * 100)}%` }}
            />
          </div>
        </div>

        <div className={`zorb-brace-badge ${isBraced ? 'active' : ''}`}>
          <Shield size={14} />
          <span>Brace Anchor</span>
          <span className="zorb-dash-key">Shift</span>
        </div>
      </div>

      {/* Mobile Touch Overlay */}
      {touchActive && (
        <div className="zorb-touch-controls">
          <div
            className="zorb-touch-stick"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="zorb-touch-thumb" />
          </div>

          <div className="zorb-touch-actions">
            <button
              type="button"
              className="zorb-touch-btn brace"
              onTouchStart={() => setPlayerInput({ brace: true })}
              onTouchEnd={() => setPlayerInput({ brace: false })}
            >
              Brace
            </button>

            <button
              type="button"
              className="zorb-touch-btn dash"
              onTouchStart={() => setPlayerInput({ dash: true })}
              onTouchEnd={() => setPlayerInput({ dash: false })}
            >
              Dash
            </button>
          </div>
        </div>
      )}

      {/* Match Over Modal */}
      {isEnded && (
        <div className="zorb-modal-overlay">
          <div className="zorb-modal">
            <h2>MATCH OVER!</h2>
            <p>
              {snapshot?.world.score.red === snapshot?.world.score.blue
                ? "It's an explosive draw!"
                : snapshot?.world.score.red! > snapshot?.world.score.blue!
                  ? 'Red Team Takes the Trophy! 🏆'
                  : 'Blue Team Takes the Trophy! 🏆'}
            </p>

            <div className="zorb-stats-grid">
              <div className="zorb-stat-card">
                <strong>{snapshot?.world.bonkCount ?? 0}</strong>
                <span>Explosive Bonks</span>
              </div>
              <div className="zorb-stat-card">
                <strong>
                  {snapshot?.world.score.red ?? 0} -{' '}
                  {snapshot?.world.score.blue ?? 0}
                </strong>
                <span>Final Score</span>
              </div>
            </div>

            <button type="button" className="zorb-btn" onClick={handleRestart}>
              <RotateCcw
                size={18}
                style={{ display: 'inline', marginRight: '6px' }}
              />
              Rematch!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
