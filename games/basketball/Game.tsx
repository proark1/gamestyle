'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Flame,
  RotateCcw,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import type { PeerGameConnection } from '../../shared/peer/connection';
import { useMediaQuery } from '../../shared/browser/use-media-query';
import { TOUCH_CONTROLS_QUERY } from '../../shared/input/gestures';
import {
  advanceBasketball,
  basketballAction,
  basketballSnapshot,
  canSuperJump,
  freshBasketballWorld,
  newPlayer,
} from './simulation';
import { reconcileBasketballBots, stepBasketballBot } from './bots';
import {
  idleInput,
  type BasketballAction,
  type BasketballSession,
  type BasketballSnapshot,
  type BasketballWorld,
  type PlayerInput,
  type TeamId,
} from './types';
import { BasketballSound } from './audio';
import { BasketballScene } from './scene';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import LanguageSwitcher from '../../shared/language/LanguageSwitcher';
import { BASKETBALL_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { basketballAnalytics } from './analytics';
import { hudPacer } from '../../shared/ui/hud-pacer';

const tracker = new GameTracker(basketballAnalytics);

export default function BasketballGame() {
  useGameTracker(tracker);
  const { t } = useLanguage();
  const strings = t(BASKETBALL_TRANSLATIONS);
  const touchMode = useMediaQuery(TOUCH_CONTROLS_QUERY);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<BasketballScene | null>(null);
  const sound = useRef<BasketballSound | null>(null);
  const network = useRef<PeerGameConnection<BasketballSnapshot> | null>(null);
  const localWorld = useRef<BasketballWorld | null>(null);
  const currentInput = useRef(idleInput());
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<BasketballSnapshot>(
      ({ world: w }) =>
        `${w.phase}:${w.eventId}:${w.scores.orange}:${w.scores.teal}`,
    ),
  );

  const [snapshot, setSnapshot] = useState<BasketballSnapshot | null>(null);
  const [team, setTeam] = useState<TeamId>('orange');
  const [celebrationBanner, setCelebrationBanner] = useState<{
    text: string;
    subtext: string;
    type: string;
    team?: TeamId;
  } | null>(null);

  const lastEventProcessed = useRef(0);

  useEffect(() => {
    if (!celebrationBanner) return;
    const t = setTimeout(() => setCelebrationBanner(null), 1900);
    return () => clearTimeout(t);
  }, [celebrationBanner]);

  const sessionRef = useRef<BasketballSession>({
    id: 'p-local',
    token: 'solo-token',
    code: 'SOLO',
    name: 'Baller',
    team: 'orange',
  });

  const dispatchAction = useCallback((act: BasketballAction) => {
    tracker.action(act.type);
    sound.current?.unlock();
    if (network.current) {
      void network.current.action(act);
    } else if (localWorld.current) {
      basketballAction(localWorld.current, sessionRef.current.id, act, true);
      const snap = basketballSnapshot(
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

    sound.current = new BasketballSound();

    scene.current = new BasketballScene(container.current, {
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
      action: dispatchAction,
    });

    // Initialize local world with bots
    const now = Date.now();
    const w = freshBasketballWorld(now);
    w.players.push(
      newPlayer(sessionRef.current.id, 'Du', 0, 'orange', false, 0),
    );
    reconcileBasketballBots(w);
    localWorld.current = w;

    const initialSnap = basketballSnapshot(
      w,
      'SOLO',
      sessionRef.current.id,
      sessionRef.current.id,
      now,
    );
    setSnapshot(initialSnap);
    scene.current.render(initialSnap);

    // Main animation loop for local game simulation
    let lastTime = performance.now();
    let animId = 0;

    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      if (localWorld.current && !network.current) {
        // Step AI bots
        for (const p of localWorld.current.players) {
          if (p.bot) {
            stepBasketballBot(p, localWorld.current, dt);
          }
        }

        advanceBasketball(localWorld.current, dt);

        // Check for celebration banners from newly emitted events
        for (const ev of localWorld.current.events) {
          if (ev.id <= lastEventProcessed.current) continue;
          lastEventProcessed.current = ev.id;

          if (ev.type === 'superdunk') {
            setCelebrationBanner({
              text: '🔥 MONSTER SLAM!!',
              subtext: 'BOOMSHAKALAKA!',
              type: 'superdunk',
              team: ev.team,
            });
          } else if (ev.type === 'dunk') {
            setCelebrationBanner({
              text: '💥 SLAM DUNK!!',
              subtext: 'COUNT THE BASKET!',
              type: 'dunk',
              team: ev.team,
            });
          } else if (ev.type === 'anklebreaker') {
            setCelebrationBanner({
              text: '⚡ ANKLE BREAKER!!',
              subtext: 'LEFT HIM FROZEN!',
              type: 'anklebreaker',
              team: ev.team,
            });
          } else if (ev.type === 'alleyoop') {
            setCelebrationBanner({
              text: '🚀 ALLEY-OOP SLAM!!',
              subtext: 'AIRBORNE PERFECTION!',
              type: 'alleyoop',
              team: ev.team,
            });
          } else if (ev.type === 'spin') {
            setCelebrationBanner({
              text: '🌪️ 360 SPIN MOVE!',
              subtext: 'DIZZY DEFENSE!',
              type: 'spin',
              team: ev.team,
            });
          } else if (ev.type === 'stepback') {
            setCelebrationBanner({
              text: '🎯 STEP-BACK JUMPER!',
              subtext: 'PURE SEPARATION!',
              type: 'stepback',
              team: ev.team,
            });
          }
        }

        const snap = basketballSnapshot(
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
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      scene.current?.dispose();
      scene.current = null;
      sound.current?.dispose();
      sound.current = null;
    };
  }, [dispatchAction]);

  useEffect(() => {
    sessionRef.current.team = team;
  }, [team]);

  const world = snapshot?.world;
  const localPlayer = snapshot
    ? snapshot.world.players.find((p) => p.id === snapshot.localId)
    : undefined;
  const superReady = localPlayer ? canSuperJump(localPlayer) : false;

  const handleStart = () => {
    dispatchAction({ type: 'start' });
  };

  const handleRestart = () => {
    dispatchAction({ type: 'restart' });
  };

  const handleSwitchTeam = (newTeam: TeamId) => {
    setTeam(newTeam);
    dispatchAction({ type: 'switchTeam' });
  };

  return (
    <div className="bb-game">
      <div ref={container} className="bb-canvas" />
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 20 }}>
        <LanguageSwitcher variant="header" />
      </div>

      {/* Topbar HUD */}
      {world && world.phase !== 'lobby' && (
        <div className="bb-hud">
          {/* Orange Team Score */}
          <div
            className={`bb-team-score orange ${
              world.possession === 'orange' ? 'has-possession' : ''
            }`}
          >
            <div className="bb-score-val">{world.scores.orange}</div>
            <div className="bb-score-meta">
              <span>Orange</span>
              <span>Team</span>
              {world.possession === 'orange' && (
                <span className="bb-poss-dot" />
              )}
            </div>
          </div>

          {/* Center Clock & Clearance Info */}
          <div className="bb-center-clock-group">
            <div
              className={`bb-timer-badge ${
                world.shotClockRemaining <= 5 ? 'danger' : ''
              }`}
            >
              <Timer size={18} />
              <span>{Math.ceil(world.shotClockRemaining)}s</span>
            </div>
            {world.needsClearance && (
              <div className="bb-clearance-badge">
                <AlertCircle
                  size={10}
                  style={{ display: 'inline', marginRight: 4 }}
                />
                {strings.clearBall}
              </div>
            )}
          </div>

          {/* Teal Team Score */}
          <div
            className={`bb-team-score teal ${
              world.possession === 'teal' ? 'has-possession' : ''
            }`}
          >
            <div className="bb-score-meta" style={{ textAlign: 'right' }}>
              <span>Teal</span>
              <span>Team</span>
              {world.possession === 'teal' && (
                <span
                  className="bb-poss-dot"
                  style={{ alignSelf: 'flex-end' }}
                />
              )}
            </div>
            <div className="bb-score-val">{world.scores.teal}</div>
          </div>
        </div>
      )}

      {/* Center Action HUD (Shot Meter & Super Jump indicator) */}
      {localPlayer && world?.phase === 'playing' && (
        <div className="bb-action-hud">
          {localPlayer.chargingShot && (
            <div className="bb-shot-meter-container">
              <div className="bb-shot-meter-box">
                <div className="bb-shot-meter-sweet" />
                <div
                  className={`bb-shot-meter-fill ${
                    localPlayer.shotCharge >= 0.7 &&
                    localPlayer.shotCharge <= 0.85
                      ? 'in-sweet'
                      : ''
                  }`}
                  style={{
                    width: `${Math.round(localPlayer.shotCharge * 100)}%`,
                  }}
                />
              </div>
              <div className="bb-shot-meter-label">
                {localPlayer.shotCharge >= 0.7 && localPlayer.shotCharge <= 0.85
                  ? '🔥 SWEET SPOT! (Loslassen)'
                  : 'Wurf aufladen...'}
              </div>
            </div>
          )}

          {superReady && (
            <div className="bb-combo-badge">
              <Flame
                size={16}
                style={{
                  display: 'inline',
                  verticalAlign: 'middle',
                  marginRight: 4,
                }}
              />
              SUPER JUMP READY! (Space x2)
            </div>
          )}

          {localPlayer.combo >= 80 && (
            <div className="bb-combo-badge fire">
              <Flame
                size={16}
                style={{
                  display: 'inline',
                  verticalAlign: 'middle',
                  marginRight: 4,
                }}
              />
              ON FIRE! (+Speed &amp; Power)
            </div>
          )}
        </div>
      )}

      {/* Mobile Touch Controls Overlay */}
      {touchMode && world?.phase === 'playing' && (
        <div className="bb-touch-controls">
          <div className="bb-touch-buttons">
            <div className="bb-touch-row">
              <button
                type="button"
                className="bb-touch-btn special"
                onClick={() => dispatchAction({ type: 'crossover' })}
              >
                <Zap size={18} />
                <span>Cross</span>
              </button>
              <button
                type="button"
                className="bb-touch-btn special"
                onClick={() => dispatchAction({ type: 'spin' })}
              >
                <span>360°</span>
                <span>Spin</span>
              </button>
            </div>
            <div className="bb-touch-row">
              <button
                type="button"
                className="bb-touch-btn pass"
                onClick={() => {
                  dispatchAction({ type: 'pass' });
                  dispatchAction({ type: 'steal' });
                }}
              >
                <span>Pass</span>
                <span>Steal</span>
              </button>
              <button
                type="button"
                className="bb-touch-btn shoot"
                onPointerDown={() => {
                  if (localWorld.current) {
                    const p = localWorld.current.players.find(
                      (pl) => pl.id === sessionRef.current.id,
                    );
                    if (p) p.input.shoot = true;
                  }
                }}
                onPointerUp={() => {
                  if (localWorld.current) {
                    const p = localWorld.current.players.find(
                      (pl) => pl.id === sessionRef.current.id,
                    );
                    if (p) p.input.shoot = false;
                  }
                }}
              >
                <span>Shoot</span>
                <span>Dunk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spectacular Celebration Banner Overlay */}
      {celebrationBanner && (
        <div
          className={`bb-celebration-banner ${celebrationBanner.type} ${celebrationBanner.team ?? ''}`}
        >
          <div className="bb-celebration-title">{celebrationBanner.text}</div>
          <div className="bb-celebration-subtitle">
            {celebrationBanner.subtext}
          </div>
        </div>
      )}

      {/* Lobby / Welcome Screen */}
      {world?.phase === 'lobby' && (
        <div className="bb-welcome">
          <h1>
            Court <span>Clash</span>
          </h1>
          <div className="bb-tagline">{strings.tagline}</div>
          <div className="bb-desc">{strings.desc}</div>

          <div className="bb-team-selector">
            <button
              type="button"
              className={`bb-btn orange ${team === 'orange' ? 'active' : ''}`}
              onClick={() => handleSwitchTeam('orange')}
            >
              Team Orange
            </button>
            <button
              type="button"
              className={`bb-btn teal ${team === 'teal' ? 'active' : ''}`}
              onClick={() => handleSwitchTeam('teal')}
            >
              Team Teal
            </button>
          </div>

          <button
            type="button"
            className="bb-btn primary"
            onClick={handleStart}
          >
            {strings.startMatch}
          </button>
        </div>
      )}

      {/* Match Ended Banner */}
      {world?.phase === 'ended' && (
        <div className="bb-ended-banner">
          <Trophy size={48} color="#e58e38" style={{ margin: '0 auto 12px' }} />
          <h2>{strings.matchEnded}</h2>
          <div className={`bb-ended-winner ${world.winner ?? 'orange'}`}>
            {strings.teamWins.replace(
              '{team}',
              (world.winner ?? 'orange').toUpperCase(),
            )}
          </div>
          <button
            type="button"
            className="bb-btn primary"
            onClick={handleRestart}
          >
            <RotateCcw size={18} style={{ marginRight: 6 }} />{' '}
            {strings.playRematch}
          </button>
        </div>
      )}

      {/* Controls Hint Bar */}
      <div className="bb-hint-bar">
        <span>
          <span className="bb-hint-key">WASD</span> {strings.hintMove}
        </span>
        <span>
          <span className="bb-hint-key">Space</span> {strings.hintShootDunk}
        </span>
        <span>
          <span className="bb-hint-key">F</span> {strings.hintCrossover}
        </span>
        <span>
          <span className="bb-hint-key">C</span> {strings.hintSpin}
        </span>
        <span>
          <span className="bb-hint-key">S+Space</span> {strings.hintStepBack}
        </span>
        <span>
          <span className="bb-hint-key">E</span> {strings.hintPass}
        </span>
        <span>
          <span className="bb-hint-key">Shift</span> {strings.hintSprint}
        </span>
        <span>
          <span className="bb-hint-key">Space x2</span> {strings.hintSuperJump}
        </span>
        <span>
          <span className="bb-hint-key">V</span> {strings.hintCamera}
        </span>
      </div>
    </div>
  );
}
