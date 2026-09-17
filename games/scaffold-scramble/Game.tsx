'use client';
/* oxlint-disable react/react-compiler */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Timer,
} from 'lucide-react';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import type { PeerGameConnection } from '../../shared/peer/connection';
import LanguageSwitcher from '../../shared/language/LanguageSwitcher';
import { useLanguage } from '../../shared/language/useLanguage';
import {
  scaffoldScrambleAnalytics,
  scaffoldScramblePlayState,
} from './analytics';
import { ScaffoldScrambleSound } from './audio';
import { reconcileScaffoldBots, stepScaffoldBot } from './bots';
import { ScaffoldScene } from './scene';
import {
  advanceScaffoldScramble,
  freshScaffoldWorld,
  newPlayer,
  scaffoldScrambleAction,
  scaffoldScrambleSnapshot,
} from './simulation';
import { SCAFFOLD_TRANSLATIONS } from './translations';
import {
  ROUND_TIME_MS,
  TILT_SLIP_DEG,
  TILT_WARNING_DEG,
  idleInput,
  timeLeft,
  type PlayerInput,
  type Role,
  type ScaffoldAction,
  type ScaffoldSession,
  type ScaffoldSnapshot,
  type ScaffoldScrambleWorld,
} from './types';
import './style.css';

const tracker = new GameTracker(scaffoldScrambleAnalytics);

const formatTime = (ms: number) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function ScaffoldScrambleGame() {
  const { t } = useLanguage();
  const strings = t(SCAFFOLD_TRANSLATIONS);
  useGameTracker(tracker);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ScaffoldScene | null>(null);
  const sound = useRef<ScaffoldScrambleSound | null>(null);
  const network = useRef<PeerGameConnection<ScaffoldSnapshot> | null>(null);
  const localWorld = useRef<ScaffoldScrambleWorld | null>(null);
  const currentInput = useRef(idleInput());

  const [snapshot, setSnapshot] = useState<ScaffoldSnapshot | null>(null);
  const [role, setRole] = useState<Role>('cleaner');

  const sessionRef = useRef<ScaffoldSession>({
    id: 'cleaner-local',
    token: 'solo-token',
    code: 'SOLO',
    name: 'Window Cleaner',
    role: 'cleaner',
    color: 0,
  });

  const dispatchAction = useCallback((act: ScaffoldAction) => {
    tracker.action(act.type);
    sound.current?.unlock();
    if (network.current) {
      void network.current.action(act);
    } else if (localWorld.current) {
      scaffoldScrambleAction(localWorld.current, sessionRef.current.id, act);
      const snap = scaffoldScrambleSnapshot(
        localWorld.current,
        'SOLO',
        sessionRef.current.id,
        sessionRef.current.id,
        Date.now(),
      );
      setSnapshot(snap);
      scene.current?.render(snap);
      sound.current?.update(snap.world, sessionRef.current.id);
    }
  }, []);

  // Initialize scene and sound
  useEffect(() => {
    if (!container.current) return;

    sound.current = new ScaffoldScrambleSound();

    scene.current = new ScaffoldScene(container.current, {
      input: (inp: PlayerInput) => {
        currentInput.current = inp;
        if (localWorld.current) {
          const p = localWorld.current.players.find(
            (pl) => pl.id === sessionRef.current.id,
          );
          if (p) {
            p.input = inp;
            p.seen = localWorld.current.clock;
          }
        }
      },
      action: dispatchAction,
    });

    const now = Date.now();
    const initialWorld = freshScaffoldWorld(now);
    initialWorld.players.push(
      newPlayer(
        sessionRef.current.id,
        sessionRef.current.name,
        sessionRef.current.color,
        sessionRef.current.role,
        false,
        0,
      ),
    );
    reconcileScaffoldBots(initialWorld);
    localWorld.current = initialWorld;

    const initialSnap = scaffoldScrambleSnapshot(
      initialWorld,
      'SOLO',
      sessionRef.current.id,
      sessionRef.current.id,
      1,
    );
    setSnapshot(initialSnap);

    // Solo game simulation loop
    let lastTime = performance.now();
    let animId = 0;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      if (!localWorld.current || network.current) return;

      const currentTime = performance.now();
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const world = localWorld.current;
      const stepNow = Date.now();

      // Step AI bot crewmates
      for (const p of world.players) {
        if (p.bot) {
          stepScaffoldBot(p, world, dt);
        }
      }

      advanceScaffoldScramble(world, stepNow, dt);

      const snap = scaffoldScrambleSnapshot(
        world,
        'SOLO',
        sessionRef.current.id,
        sessionRef.current.id,
        stepNow,
      );

      setSnapshot(snap);
      scene.current?.render(snap);
      sound.current?.update(snap.world, sessionRef.current.id);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      scene.current?.destroy();
      scene.current = null;
      sound.current?.reset();
      sound.current = null;
      network.current?.stop();
      network.current = null;
    };
  }, [dispatchAction]);

  // Report analytics state
  useEffect(() => {
    if (snapshot) {
      tracker.observe(scaffoldScramblePlayState(snapshot, sessionRef.current));
    }
  }, [snapshot]);

  // Update role
  useEffect(() => {
    sessionRef.current.role = role;
    scene.current?.setLocalPlayer(sessionRef.current.id, role);
  }, [role]);

  const world = snapshot?.world;
  const isPlaying = world?.phase === 'playing';
  const isEnded = world?.phase === 'ended';

  const tiltDeg = world ? world.cradle.tiltDeg : 0;
  const absTilt = Math.abs(tiltDeg);
  const tiltClass =
    absTilt >= TILT_SLIP_DEG
      ? 'danger'
      : absTilt >= TILT_WARNING_DEG
        ? 'warning'
        : 'safe';

  // Map needle from -45 deg (left 0%) to +45 deg (left 100%)
  const needlePercent = Math.max(0, Math.min(100, 50 - (tiltDeg / 45) * 50));

  const msLeft = world ? timeLeft(world) : ROUND_TIME_MS;
  const currentStory = world
    ? Math.max(1, Math.round(world.cradle.centerHeight / 1.15))
    : 45;

  const localPlayer = world?.players.find(
    (p) => p.id === sessionRef.current.id,
  );
  const activeTool = localPlayer?.tool ?? 'squeegee';

  const handleStart = () => {
    dispatchAction({ type: 'start' });
  };

  const handleRestart = () => {
    dispatchAction({ type: 'restart' });
    dispatchAction({ type: 'start' });
  };

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    dispatchAction({ type: 'switchRole', role: newRole });
  };

  const handleSwitchTool = () => {
    dispatchAction({ type: 'switchTool' });
  };

  return (
    <main className="sc-game">
      <div ref={container} className="sc-canvas" />

      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 30 }}>
        <LanguageSwitcher variant="header" />
      </div>

      {/* Top HUD */}
      <div className="sc-hud">
        {/* Story / Altitude Badge */}
        <div className="sc-hud-badge">
          <Building2 size={22} color="#0284c7" />
          <div>
            <div className="sc-score-val">{currentStory}</div>
            <div className="sc-hud-meta">{strings.hudStory}</div>
          </div>
        </div>

        {/* Center Tilt Gauge */}
        <div className={`sc-hud-badge tilt ${tiltClass}`}>
          <div className="sc-tilt-val">
            {absTilt >= TILT_WARNING_DEG && (
              <AlertTriangle
                size={18}
                color={absTilt >= TILT_SLIP_DEG ? '#ef4444' : '#eab308'}
              />
            )}
            <span>{tiltDeg.toFixed(1)}°</span>
          </div>
          <div className="sc-tilt-meter">
            <div
              className="sc-tilt-needle"
              style={{ left: `${needlePercent}%` }}
            />
          </div>
          <div className="sc-hud-meta">
            {absTilt >= TILT_SLIP_DEG
              ? strings.slipHazard
              : absTilt >= TILT_WARNING_DEG
                ? strings.tiltWarning
                : strings.hudTilt}
          </div>
        </div>

        {/* Windows Cleaned Badge */}
        <div className="sc-hud-badge">
          <Sparkles size={22} color="#16a34a" />
          <div>
            <div className="sc-score-val" style={{ color: '#16a34a' }}>
              {world?.cleanedCount ?? 0} / 30
            </div>
            <div className="sc-hud-meta">{strings.hudCleaned}</div>
          </div>
        </div>

        {/* Helicopter Deadline Timer */}
        <div className="sc-hud-badge">
          <Timer size={22} color="#0f172a" />
          <div>
            <div className="sc-timer-val">{formatTime(msLeft)}</div>
            <div className="sc-hud-meta">{strings.hudDeadline}</div>
          </div>
        </div>
      </div>

      {/* Active Tool Badge */}
      {isPlaying && (
        <button
          type="button"
          className="sc-tool-badge"
          onClick={handleSwitchTool}
          title="Click or press Tab to switch tools"
        >
          <span>
            {activeTool === 'sponge'
              ? strings.activeToolSponge
              : strings.activeToolSqueegee}
          </span>
          <span className="sc-tool-key">Tab</span>
        </button>
      )}

      {/* Welcome / Role Select Overlay */}
      {!isPlaying && !isEnded && (
        <div className="sc-welcome">
          <h1>
            Scaffold <span>Scramble</span>.
          </h1>
          <div className="sc-tagline">{strings.tagline}</div>
          <p className="sc-desc">{strings.desc}</p>

          <div className="sc-role-selector">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#64748b',
              }}
            >
              {strings.roleSelectorTitle}
            </span>
            <div className="sc-role-grid">
              <button
                type="button"
                className={`sc-btn ${role === 'left-winch' ? 'active' : ''}`}
                onClick={() => handleRoleChange('left-winch')}
              >
                {strings.roleLeftWinch}
              </button>
              <button
                type="button"
                className={`sc-btn ${role === 'right-winch' ? 'active' : ''}`}
                onClick={() => handleRoleChange('right-winch')}
              >
                {strings.roleRightWinch}
              </button>
              <button
                type="button"
                className={`sc-btn ${role === 'cleaner' ? 'active' : ''}`}
                onClick={() => handleRoleChange('cleaner')}
              >
                {strings.roleCleaner}
              </button>
              <button
                type="button"
                className={`sc-btn ${role === 'all-rounder' ? 'active' : ''}`}
                onClick={() => handleRoleChange('all-rounder')}
              >
                {strings.roleAllRounder}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="sc-btn primary"
            onClick={handleStart}
          >
            {strings.startShift} <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Match Ended Banner */}
      {isEnded && (
        <div className="sc-ended-banner">
          <h2>{strings.shiftOver}</h2>
          <div className={`sc-ended-status ${world?.winner || ''}`}>
            {world?.winner === 'crew'
              ? strings.ceoImpressed
              : strings.ceoFurious}
          </div>
          <p className="sc-ended-desc">
            {world?.winner === 'crew'
              ? strings.ceoImpressedDesc
              : strings.ceoFuriousDesc}
          </p>
          <button
            type="button"
            className="sc-btn primary"
            onClick={handleRestart}
          >
            <RotateCcw size={18} /> {strings.playAgain}
          </button>
        </div>
      )}

      {/* Bottom Keyboard Controls Hint Bar */}
      <div className="sc-hint-bar">
        <span>
          <span className="sc-hint-key">A/D</span> {strings.hintMove}
        </span>
        <span>
          <span className="sc-hint-key">Q/Z</span> {strings.hintWinchLeft}
        </span>
        <span>
          <span className="sc-hint-key">E/R</span> {strings.hintWinchRight}
        </span>
        <span>
          <span className="sc-hint-key">Space</span> {strings.hintAction}
        </span>
        <span>
          <span className="sc-hint-key">Tab</span> {strings.hintSwitchTool}
        </span>
      </div>

      {/* Mobile Touch Controls */}
      <div className="sc-mobile-controls">
        <div className="sc-touch-group">
          <div className="sc-touch-row">
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() =>
                dispatchAction({ type: 'crank', winch: 'left', dir: 'up' })
              }
            >
              L ▲
            </button>
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() =>
                dispatchAction({ type: 'crank', winch: 'left', dir: 'down' })
              }
            >
              L ▼
            </button>
          </div>
          <div className="sc-touch-row">
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() => {
                if (localWorld.current) {
                  const me = localWorld.current.players.find(
                    (p) => p.id === sessionRef.current.id,
                  );
                  if (me) me.input.x = -1;
                }
              }}
              onPointerUp={() => {
                if (localWorld.current) {
                  const me = localWorld.current.players.find(
                    (p) => p.id === sessionRef.current.id,
                  );
                  if (me) me.input.x = 0;
                }
              }}
            >
              ◀
            </button>
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() => {
                if (localWorld.current) {
                  const me = localWorld.current.players.find(
                    (p) => p.id === sessionRef.current.id,
                  );
                  if (me) me.input.x = 1;
                }
              }}
              onPointerUp={() => {
                if (localWorld.current) {
                  const me = localWorld.current.players.find(
                    (p) => p.id === sessionRef.current.id,
                  );
                  if (me) me.input.x = 0;
                }
              }}
            >
              ▶
            </button>
          </div>
        </div>

        <div className="sc-touch-group">
          <div className="sc-touch-row">
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() =>
                dispatchAction({ type: 'crank', winch: 'right', dir: 'up' })
              }
            >
              R ▲
            </button>
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() =>
                dispatchAction({ type: 'crank', winch: 'right', dir: 'down' })
              }
            >
              R ▼
            </button>
          </div>
          <div className="sc-touch-row">
            <button
              type="button"
              className="sc-touch-btn wide"
              onClick={() => dispatchAction({ type: 'useTool' })}
            >
              Action
            </button>
            <button
              type="button"
              className="sc-touch-btn"
              onClick={handleSwitchTool}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
