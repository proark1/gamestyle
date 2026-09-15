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
import type {
  PlayerInput,
  ZorbBall,
  ZorbClashSnapshot,
  ZorbClashWorld,
  ZorbPlayer,
} from './types';
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

function PitchRadar({
  players,
  ball,
  selfId,
}: {
  players: ZorbPlayer[];
  ball: ZorbBall;
  selfId: string;
}) {
  const radarW = 110;
  const radarH = 170;
  const pad = 8;
  const innerW = radarW - pad * 2;
  const innerH = radarH - pad * 2;

  // World pitch bounds: X [-17, 17], Z [-27, 27]
  // Camera faces +Z (North): Screen-left is +X, Screen-top is +Z (Blue goal)
  const toRadar = (x: number, z: number) => {
    const normX = Math.max(0, Math.min(1, (17 - x) / 34));
    const normY = Math.max(0, Math.min(1, (27 - z) / 54));
    return {
      x: pad + normX * innerW,
      y: pad + normY * innerH,
    };
  };

  const ballPos = toRadar(ball.x, ball.z);

  return (
    <div className="zorb-radar" aria-label="Pitch Mini-Radar">
      <div className="zorb-radar-header">
        <span>RADAR</span>
      </div>
      <svg
        className="zorb-radar-svg"
        viewBox={`0 0 ${radarW} ${radarH}`}
        width={radarW}
        height={radarH}
      >
        {/* Pitch Turf Background */}
        <rect
          x={pad}
          y={pad}
          width={innerW}
          height={innerH}
          rx={6}
          className="zorb-radar-pitch"
        />

        {/* Halfway Line */}
        <line
          x1={pad}
          y1={pad + innerH / 2}
          x2={pad + innerW}
          y2={pad + innerH / 2}
          className="zorb-radar-line"
        />

        {/* Center Circle */}
        <circle
          cx={pad + innerW / 2}
          cy={pad + innerH / 2}
          r={14}
          className="zorb-radar-line"
          fill="none"
        />
        <circle
          cx={pad + innerW / 2}
          cy={pad + innerH / 2}
          r={1.5}
          className="zorb-radar-center-dot"
        />

        {/* Blue Goal Box (Top) */}
        <rect
          x={pad + innerW / 2 - 16}
          y={pad}
          width={32}
          height={14}
          className="zorb-radar-box blue"
        />

        {/* Red Goal Box (Bottom) */}
        <rect
          x={pad + innerW / 2 - 16}
          y={pad + innerH - 14}
          width={32}
          height={14}
          className="zorb-radar-box red"
        />

        {/* Ball */}
        <circle
          cx={ballPos.x}
          cy={ballPos.y}
          r={4}
          className="zorb-radar-ball"
        />

        {/* Players */}
        {players.map((p) => {
          const pos = toRadar(p.x, p.z);
          const isSelf = p.id === selfId;
          const isTurtle = p.turtle;
          return (
            <g
              key={p.id}
              transform={`translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`}
            >
              {isSelf && <circle r={7} className="zorb-radar-self-ring" />}
              <circle
                r={isSelf ? 4.5 : 3.5}
                className={`zorb-radar-player ${p.team} ${isTurtle ? 'turtle' : ''} ${isSelf ? 'self' : ''}`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

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

    // Screen-relative mapping: right is world -X, left is world +X
    setPlayerInput({ x: -normX, z: normZ });
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

      {/* Tactical Mini-Radar */}
      {snapshot && (
        <PitchRadar
          players={snapshot.world.players}
          ball={snapshot.world.ball}
          selfId={selfId}
        />
      )}

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
        {!touchActive && (
          <div className="zorb-controls-hint">
            <span className="zorb-key-tag">W</span>
            <span className="zorb-key-tag">A</span>
            <span className="zorb-key-tag">S</span>
            <span className="zorb-key-tag">D</span>
            <span className="zorb-hint-label">Roll</span>
          </div>
        )}

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
