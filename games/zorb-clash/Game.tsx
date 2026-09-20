'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Shield, Zap, Flame, Volleyball } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import GameToolbar from '../../shared/ui/GameToolbar';
import { useMediaQuery } from '../../shared/browser/use-media-query';
import { TOUCH_CONTROLS_QUERY } from '../../shared/input/gestures';
import { ZorbClashScene } from './scene';
import { ZorbClashAudio } from './audio';
import {
  advanceZorbClash,
  freshZorbWorld,
  newZorbPlayer,
  restartZorbMatch,
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
import { TouchControls } from './TouchControls';
import { useLanguage } from '../../shared/language/useLanguage';
import { ZORB_CLASH_TRANSLATIONS } from './translations';
import { hudPacer } from '../../shared/ui/hud-pacer';
import {
  leadingSide,
  partyRound,
  partyVersus,
} from '../../shared/ui/party-round';

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
  label,
}: {
  players: ZorbPlayer[];
  ball: ZorbBall;
  selfId: string;
  label: string;
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
    <div className="zorb-radar" aria-label={label}>
      <div className="zorb-radar-header">
        <span>{label}</span>
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
  const { t } = useLanguage();
  const strings = t(ZORB_CLASH_TRANSLATIONS);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ZorbClashScene | null>(null);
  const audioRef = useRef<ZorbClashAudio | null>(null);
  const physicsRef = useRef<ZorbClashPhysics | null>(null);
  const worldRef = useRef<ZorbClashWorld | null>(null);
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<ZorbClashSnapshot>(
      ({ world: w }) => `${w.status}:${w.score.red}:${w.score.blue}`,
    ),
  );

  const [snapshot, setSnapshot] = useState<ZorbClashSnapshot | null>(null);
  // Decided after hydration: the server snapshot is false, so a touch phone's
  // first client render matches the server's and only then shows the stick.
  const touchActive = useMediaQuery(TOUCH_CONTROLS_QUERY);
  const [selfId] = useState('local-player');
  const [muted, setMuted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const blocked = !started || helpOpen || paused;
  const blockedRef = useRef(true);
  const cancelInput = useCallback(() => {
    const p = worldRef.current?.players.find((pl) => pl.id === selfId);
    if (p) {
      p.dashCharge = 0;
      p.input = { x: 0, z: 0, dash: false, brace: false };
    }
    sceneRef.current?.clearInput();
  }, [selfId]);

  useEffect(() => {
    blockedRef.current = blocked;
    sceneRef.current?.setInputEnabled(!blocked);
    if (blocked) cancelInput();
  }, [blocked, cancelInput]);
  useEffect(() => {
    const pause = () => {
      cancelInput();
      if (started) setPaused(true);
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [started, cancelInput]);

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
    scene.setInputEnabled(false);
    physics.resetPlayers();

    lastFrameTime.current = performance.now();

    // Main animation & simulation tick
    const tick = (timeMs: number) => {
      animId.current = requestAnimationFrame(tick);
      const dt = Math.max(
        0,
        Math.min((timeMs - lastFrameTime.current) / 1000, 0.05),
      );
      lastFrameTime.current = timeMs;

      if (worldRef.current && physicsRef.current) {
        if (!blockedRef.current)
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
          audioRef.current?.setDashCharge(
            blockedRef.current ? 0 : me.dashCharge,
          );
        }

        const snap = zorbClashSnapshot(
          worldRef.current,
          'SOLO',
          selfId,
          selfId,
          1,
        );

        if (hud.current.due(snap)) setSnapshot(snap);
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
    restartZorbMatch(worldRef.current, physicsRef.current);
    cancelInput();
    setPaused(false);
    audioRef.current?.whistle();
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    audioRef.current?.unlock();
    audioRef.current?.setMuted(next);
  };

  const setPlayerInput = useCallback(
    (patch: Partial<PlayerInput>) => {
      if (blockedRef.current) return;
      const world = worldRef.current;
      if (world?.status !== 'playing') return;
      const p = world.players.find((pl) => pl.id === selfId);
      if (p) Object.assign(p.input, patch);
    },
    [selfId],
  );

  const me = snapshot?.world.players.find((p) => p.id === selfId);
  const isTurtle = me?.turtle ?? false;
  const isBraced = me?.braced ?? false;
  const dashCharge = me?.dashCharge ?? 0;
  const lastGoal = snapshot?.world.lastGoal;
  const isGoalScored = snapshot?.world.status === 'goal_scored';
  const isEnded = snapshot?.world.status === 'ended';

  return (
    <main
      className="zorb-container"
      {...partyRound(
        isEnded,
        snapshot
          ? partyVersus(me?.team, leadingSide(snapshot.world.score))
          : null,
      )}
    >
      <div ref={containerRef} tabIndex={-1} className="zorb-canvas-wrapper" />
      <header className="topbar">
        <a href="/" className="wordmark">
          <span className="zorb-mark">
            <Volleyball size={22} />
          </span>{' '}
          ZORB CLASH<span className="title-dot">.</span>
        </a>
        <GameToolbar
          muted={muted}
          onToggleSound={toggleSound}
          onHelp={() => setHelpOpen(true)}
        />
      </header>

      {/* Top Header HUD */}
      <div className="zorb-hud-top house-card">
        <div className="zorb-team-score red">
          <span>{strings.red}</span>
          <span className="zorb-score-num">
            {snapshot?.world.score.red ?? 0}
          </span>
        </div>

        <div className="zorb-timer-box">
          <div className="zorb-timer">
            {formatTime(snapshot?.world.timeRemaining ?? 180)}
          </div>
          <div className="zorb-bonk-count">
            <Flame size={13} /> {snapshot?.world.bonkCount ?? 0} {strings.bonks}
          </div>
        </div>

        <div className="zorb-team-score blue">
          <span className="zorb-score-num">
            {snapshot?.world.score.blue ?? 0}
          </span>
          <span>{strings.blue}</span>
        </div>
      </div>

      {/* Tactical Mini-Radar */}
      {snapshot && (
        <PitchRadar
          players={snapshot.world.players}
          ball={snapshot.world.ball}
          selfId={selfId}
          label={strings.radar}
        />
      )}

      {/* Comical Upside-Down Turtle Alert */}
      {isTurtle && (
        <div className="zorb-turtle-banner">
          {me?.posture === 'recovering' ? strings.recovering : strings.turtled}
          <small>
            {touchActive ? strings.recoveryHint : strings.turtledSub}
          </small>
          <progress
            aria-label={strings.recovering}
            max={1}
            value={
              me?.posture === 'recovering'
                ? 0.6 + (me.recovery ?? 0) * 0.4
                : (me?.wiggleProgress ?? 0) * 0.6
            }
          />
        </div>
      )}

      {/* Goal Banner */}
      {isGoalScored && lastGoal && (
        <div className="zorb-goal-banner">
          <h1 className="zorb-goal-title">{strings.goal}</h1>
          <div className="zorb-goal-subtitle">
            {(lastGoal.ownGoal
              ? strings.ownGoalSub
              : lastGoal.scorerName
                ? strings.goalSub
                : strings.teamGoal
            )
              .replace(
                '{scorer}',
                lastGoal.scorerId === selfId
                  ? strings.you
                  : lastGoal.scorerName,
              )
              .replace(
                '{team}',
                lastGoal.team === 'red' ? strings.red : strings.blue,
              )}
          </div>
        </div>
      )}

      {/* Bottom Controls / Meter HUD */}
      <div className="zorb-hud-bottom">
        <div className="zorb-dock house-card">
          <div className="zorb-dash-container">
            <div className="zorb-dash-label">
              <Zap size={15} />
              <span>{strings.bumperDash}</span>
              <span className="zorb-dash-key house-key">Space</span>
            </div>
            <div className="zorb-dash-bar-bg">
              <div
                className={`zorb-dash-bar-fill ${dashCharge > 0.85 ? 'ready' : ''}`}
                style={{ width: `${Math.round(dashCharge * 100)}%` }}
              />
            </div>
          </div>

          <i className="zorb-dock-divider" aria-hidden="true" />

          <div className={`zorb-brace-badge ${isBraced ? 'active' : ''}`}>
            <Shield size={14} />
            <span>{strings.braceAnchor}</span>
            <span className="zorb-dash-key house-key">Shift</span>
          </div>
        </div>

        {!touchActive && (
          <div className="zorb-controls-hint">
            <span className="zorb-key-tag house-key">W</span>
            <span className="zorb-key-tag house-key">A</span>
            <span className="zorb-key-tag house-key">S</span>
            <span className="zorb-key-tag house-key">D</span>
            <span className="zorb-hint-label">{strings.roll}</span>
          </div>
        )}
      </div>

      {/* Mobile Touch Overlay */}
      {touchActive && !blocked && snapshot?.world.status === 'playing' && (
        <TouchControls
          enabled
          moveLabel={strings.roll}
          braceLabel={strings.brace}
          dashLabel={strings.dash}
          onInput={setPlayerInput}
          onCancel={cancelInput}
        />
      )}

      {me?.posture === 'unstable' && !blocked && (
        <output className="zorb-balance-hint">{strings.unstable}</output>
      )}

      <Dialog open={(!started || (paused && !isEnded)) && !helpOpen}>
        <DialogContent
          className="game-dialog zorb-modal"
          showCloseButton={false}
          finalFocus={containerRef}
        >
          <DialogTitle>{started ? strings.paused : 'Zorb Clash'}</DialogTitle>
          {!started && <p>{strings.intro}</p>}
          <p>{touchActive ? strings.touchHelp : strings.keyboardHelp}</p>
          <button
            type="button"
            className="zorb-btn primary-button"
            onClick={(e) => {
              e.currentTarget.blur();
              cancelInput();
              setStarted(true);
              setPaused(false);
              audioRef.current?.unlock();
            }}
          >
            {started ? strings.resume : strings.start}
          </button>
        </DialogContent>
      </Dialog>

      {/* Match Over Modal */}
      {isEnded && (
        <div className="zorb-modal-overlay">
          <div className="zorb-modal">
            <h2>{strings.matchOver}</h2>
            <p>
              {snapshot?.world.score.red === snapshot?.world.score.blue
                ? strings.explosiveDraw
                : snapshot?.world.score.red! > snapshot?.world.score.blue!
                  ? strings.redTrophy
                  : strings.blueTrophy}
            </p>

            <div className="zorb-stats-grid">
              <div className="zorb-stat-card">
                <strong>{snapshot?.world.bonkCount ?? 0}</strong>
                <span>{strings.explosiveBonks}</span>
              </div>
              <div className="zorb-stat-card">
                <strong>
                  {snapshot?.world.score.red ?? 0} -{' '}
                  {snapshot?.world.score.blue ?? 0}
                </strong>
                <span>{strings.finalScore}</span>
              </div>
            </div>

            <button
              type="button"
              className="zorb-btn primary-button"
              onClick={handleRestart}
            >
              <RotateCcw size={18} />
              {strings.rematch}
            </button>
          </div>
        </div>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="game-dialog" finalFocus={containerRef}>
          <DialogTitle>Zorb Clash</DialogTitle>
          <p>{strings.intro}</p>
          <p>{touchActive ? strings.touchHelp : strings.keyboardHelp}</p>
          <p className="help-note">
            <strong>{strings.turtled}</strong>{' '}
            {touchActive ? strings.recoveryHint : strings.turtledSub}
          </p>
          <p className="help-note">{strings.paused}</p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
