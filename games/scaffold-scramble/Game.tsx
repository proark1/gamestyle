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
  Wind,
} from 'lucide-react';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import type { PeerGameConnection } from '../../shared/peer/connection';
import LanguageSwitcher from '../../shared/language/LanguageSwitcher';
import { useLanguage } from '../../shared/language/useLanguage';
import { scaffoldScrambleAnalytics } from './analytics';
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
import { hudPacer } from '../../shared/ui/hud-pacer';

const tracker = new GameTracker(scaffoldScrambleAnalytics);

const formatTime = (ms: number) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const triggerHaptic = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
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
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<ScaffoldSnapshot>(({ world: w }) => `${w.phase}:${w.winner}`),
  );

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

    // Haptic feedback
    if (act.type === 'crank') {
      triggerHaptic(15);
    } else if (act.type === 'useTool') {
      triggerHaptic(35);
    } else if (act.type === 'switchTool') {
      triggerHaptic(20);
    }

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
      if (hud.current.due(snap)) setSnapshot(snap);
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
      now,
    );
    setSnapshot(initialSnap);
    scene.current.render(initialSnap);

    let lastTick = performance.now();
    const ticker = setInterval(() => {
      const currentTick = performance.now();
      const dt = Math.min(0.1, (currentTick - lastTick) * 0.001);
      lastTick = currentTick;

      if (!network.current && localWorld.current) {
        const timeNow = Date.now();

        // Step bots
        for (const p of localWorld.current.players) {
          if (p.bot) {
            stepScaffoldBot(p, localWorld.current, dt);
          }
        }

        // Advance simulation
        advanceScaffoldScramble(localWorld.current, timeNow, dt);

        const snap = scaffoldScrambleSnapshot(
          localWorld.current,
          'SOLO',
          sessionRef.current.id,
          sessionRef.current.id,
          timeNow,
        );
        if (hud.current.due(snap)) setSnapshot(snap);
        scene.current?.render(snap);
        sound.current?.update(snap.world, sessionRef.current.id);
      }
    }, 1000 / 60);

    return () => {
      clearInterval(ticker);
      sound.current?.dispose();
      scene.current?.destroy();
    };
  }, [dispatchAction]);

  const world = snapshot?.world;
  const isPlaying = world?.phase === 'playing';
  const isEnded = world?.phase === 'ended';

  const currentStory = Math.max(
    1,
    Math.min(
      80,
      Math.round(((world?.cradle.centerHeight ?? 50) - 10) / 1.05) + 10,
    ),
  );

  const tiltDeg = world?.cradle.tiltDeg ?? 0;
  const absTilt = Math.abs(tiltDeg);
  let tiltClass = 'safe';
  if (absTilt >= TILT_SLIP_DEG) {
    tiltClass = 'danger';
  } else if (absTilt >= TILT_WARNING_DEG) {
    tiltClass = 'warning';
  }

  // Bubble position inside the spirit level: 0 deg = 50%
  // Bubble moves towards the higher side (opposite of downhill slide)
  const bubblePercent = Math.max(8, Math.min(92, 50 - tiltDeg * 1.5));

  const msLeft = isPlaying && world ? timeLeft(world) : ROUND_TIME_MS;

  const localPlayer = world?.players.find(
    (p) => p.id === sessionRef.current.id,
  );
  const activeTool = localPlayer?.tool ?? 'sponge';

  const windStrength = world?.wind.strength ?? 0;
  const windKnots = Math.round(Math.abs(windStrength) * 28);
  const windActive = world?.wind.active;

  // Helicopter descent progress toward roof (0% = sky, 100% = touched down)
  const heliProgress = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (1.0 - Math.max(0, (world?.helicopter.y ?? 130) - 95.0) / 35.0) * 100,
      ),
    ),
  );

  const handleStart = () => {
    dispatchAction({ type: 'start' });
  };

  const handleRestart = () => {
    dispatchAction({ type: 'restart' });
  };

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    sessionRef.current.role = newRole;
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

      {/* Top HUD Telemetry */}
      <div className="sc-hud">
        {/* Floor Altitude Ticker */}
        <div className="sc-hud-badge">
          <Building2 size={22} color="#0284c7" />
          <div>
            <div className="sc-score-val flex items-center gap-1">
              <span>{currentStory}</span>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>/ 80</span>
            </div>
            <div className="sc-hud-meta">{strings.hudStory}</div>
          </div>
        </div>

        {/* Industrial Spirit Level Attitude Indicator */}
        <div className={`sc-hud-badge tilt ${tiltClass}`}>
          <div className="sc-tilt-val">
            {absTilt >= TILT_WARNING_DEG && (
              <AlertTriangle
                size={18}
                color={absTilt >= TILT_SLIP_DEG ? '#ef4444' : '#eab308'}
                className={absTilt >= TILT_SLIP_DEG ? 'sc-pulse-icon' : ''}
              />
            )}
            <span>{tiltDeg.toFixed(1)}°</span>
          </div>

          {/* Curved Glass Spirit Level Capsule */}
          <div className="sc-spirit-level">
            <div className="sc-spirit-tick neg20" />
            <div className="sc-spirit-tick neg15" />
            <div className="sc-spirit-tick zero" />
            <div className="sc-spirit-tick pos15" />
            <div className="sc-spirit-tick pos20" />
            <div
              className="sc-spirit-bubble"
              style={{ left: `${bubblePercent}%` }}
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

        {/* Live Wind Telemetry Widget */}
        <div className={`sc-hud-badge ${windActive ? 'wind-gust' : ''}`}>
          <Wind
            size={22}
            color={windActive ? '#f59e0b' : '#38bdf8'}
            style={{
              transform: `scaleX(${windStrength >= 0 ? 1 : -1})`,
              transition: 'transform 0.3s',
            }}
          />
          <div>
            <div
              className="sc-score-val"
              style={{ color: windActive ? '#d97706' : '#0284c7' }}
            >
              {windKnots} <span style={{ fontSize: 12 }}>kt</span>
            </div>
            <div className="sc-hud-meta">
              {windActive ? strings.windGust : strings.windCalm}
            </div>
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

        {/* Helicopter Deadline Timer with Descent Radar */}
        <div className="sc-hud-badge">
          <Timer size={22} color="#0f172a" />
          <div>
            <div className="sc-timer-val">{formatTime(msLeft)}</div>
            <div className="sc-hud-meta">
              {strings.hudDeadline} ({heliProgress}%)
            </div>
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
          {/* Left Winch Rocker */}
          <div className="sc-touch-row">
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() =>
                dispatchAction({ type: 'crank', winch: 'left', dir: 'up' })
              }
            >
              L ▲ (Q)
            </button>
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() =>
                dispatchAction({ type: 'crank', winch: 'left', dir: 'down' })
              }
            >
              L ▼ (Z)
            </button>
          </div>
          {/* Move Deck */}
          <div className="sc-touch-row">
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() => {
                triggerHaptic(15);
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
              ◀ A
            </button>
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() => {
                triggerHaptic(15);
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
              D ▶
            </button>
          </div>
        </div>

        <div className="sc-touch-group">
          {/* Right Winch Rocker */}
          <div className="sc-touch-row">
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() =>
                dispatchAction({ type: 'crank', winch: 'right', dir: 'up' })
              }
            >
              R ▲ (E)
            </button>
            <button
              type="button"
              className="sc-touch-btn"
              onPointerDown={() =>
                dispatchAction({ type: 'crank', winch: 'right', dir: 'down' })
              }
            >
              R ▼ (R)
            </button>
          </div>
          {/* Action & Tool Switch */}
          <div className="sc-touch-row">
            <button
              type="button"
              className="sc-touch-btn wide"
              onClick={() => dispatchAction({ type: 'useTool' })}
            >
              Clean / Space
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
