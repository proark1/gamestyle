'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Flame,
  RotateCcw,
  Timer,
  Trophy,
  Volleyball,
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
import GameToolbar from '../../shared/ui/GameToolbar';
import { BASKETBALL_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { basketballAnalytics } from './analytics';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyRound, partyVersus } from '../../shared/ui/party-round';

const tracker = new GameTracker(basketballAnalytics);
// Below this width the controls card starts hidden; style.css matches it.
const HINTS_HIDDEN_QUERY = '(max-width: 820px)';

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
      ({ world: w, localId }) =>
        `${w.phase}:${w.eventId}:${w.scores.red}:${w.scores.blue}:${
          w.players.find((p) => p.id === localId)?.team
        }`,
    ),
  );

  const [snapshot, setSnapshot] = useState<BasketballSnapshot | null>(null);
  const [muted, setMuted] = useState(false);
  // The toolbar's help button shows or hides the controls card. Until it is
  // pressed the card follows the screen width.
  const [hints, setHints] = useState<boolean | null>(null);
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
    team: 'red',
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
    w.players.push(newPlayer(sessionRef.current.id, 'Du', 0, 'red', false, 0));
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

  const world = snapshot?.world;
  const localPlayer = snapshot
    ? snapshot.world.players.find((p) => p.id === snapshot.localId)
    : undefined;
  // The picker shows the team the world has you on, not the last button
  // pressed, so it cannot disagree with where you actually play.
  const team: TeamId = localPlayer?.team ?? 'red';
  const superReady = localPlayer ? canSuperJump(localPlayer) : false;
  const teamName: Record<TeamId, string> = {
    red: strings.red,
    blue: strings.blue,
  };

  const handleStart = () => {
    dispatchAction({ type: 'start' });
  };

  const handleRestart = () => {
    dispatchAction({ type: 'restart' });
  };

  const handleSwitchTeam = (newTeam: TeamId) => {
    if (newTeam === team) return;
    dispatchAction({ type: 'switchTeam', team: newTeam });
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    if (sound.current) {
      sound.current.unlock();
      sound.current.enabled = !next;
    }
  };

  const toggleHints = () =>
    setHints(
      (shown) => !(shown ?? !window.matchMedia(HINTS_HIDDEN_QUERY).matches),
    );

  return (
    <div
      className="bb-game"
      {...partyRound(
        world?.phase === 'ended',
        partyVersus(localPlayer?.team, world?.winner),
      )}
    >
      <div ref={container} className="bb-canvas" />
      <header className="topbar bb-topbar">
        <a href="/" className="wordmark">
          <span className="bb-mark">
            <Volleyball size={22} />
          </span>
          COURT CLASH<span className="title-dot">.</span>
        </a>
        <GameToolbar
          muted={muted}
          onToggleSound={toggleSound}
          onHelp={toggleHints}
        />
      </header>

      {/* Topbar HUD */}
      {world && world.phase !== 'lobby' && (
        <div className="bb-hud">
          {/* Red Team Score */}
          <div
            className={`bb-team-score red ${
              world.possession === 'red' ? 'has-possession' : ''
            }`}
          >
            <div className="bb-score-val">{world.scores.red}</div>
            <div className="bb-score-meta">
              <span>{teamName.red}</span>
              <span>Team</span>
              {world.possession === 'red' && <span className="bb-poss-dot" />}
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
                <AlertCircle size={12} />
                {strings.clearBall}
              </div>
            )}
          </div>

          {/* Blue Team Score */}
          <div
            className={`bb-team-score blue ${
              world.possession === 'blue' ? 'has-possession' : ''
            }`}
          >
            <div className="bb-score-meta">
              <span>{teamName.blue}</span>
              <span>Team</span>
              {world.possession === 'blue' && <span className="bb-poss-dot" />}
            </div>
            <div className="bb-score-val">{world.scores.blue}</div>
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
                  ? `🔥 ${strings.shotSweetSpot}`
                  : strings.shotCharging}
              </div>
            </div>
          )}

          {superReady && (
            <div className="bb-combo-badge">
              <Flame size={16} />
              SUPER JUMP READY! (Space x2)
            </div>
          )}

          {localPlayer.combo >= 80 && (
            <div className="bb-combo-badge fire">
              <Flame size={16} />
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
              className={`bb-btn red ${team === 'red' ? 'active' : ''}`}
              onClick={() => handleSwitchTeam('red')}
            >
              {strings.teamRed}
            </button>
            <button
              type="button"
              className={`bb-btn blue ${team === 'blue' ? 'active' : ''}`}
              onClick={() => handleSwitchTeam('blue')}
            >
              {strings.teamBlue}
            </button>
          </div>

          <button
            type="button"
            className="bb-btn primary primary-button"
            onClick={handleStart}
          >
            {strings.startMatch}
          </button>
        </div>
      )}

      {/* Match Ended Banner */}
      {world?.phase === 'ended' && (
        <div className="bb-ended-banner game-dialog result-dialog">
          <span className="dialog-emblem">
            <Trophy size={30} />
          </span>
          <h2>{strings.matchEnded}</h2>
          <div className={`bb-ended-winner ${world.winner ?? 'red'}`}>
            {strings.teamWins.replace(
              '{team}',
              teamName[world.winner ?? 'red'].toUpperCase(),
            )}
          </div>
          <button
            type="button"
            className="bb-btn primary primary-button"
            onClick={handleRestart}
          >
            <RotateCcw size={18} />
            {strings.playRematch}
          </button>
        </div>
      )}

      {/* Controls Hint Bar */}
      <div
        className={`bb-hint-bar${
          hints === null ? '' : hints ? ' is-open' : ' is-closed'
        }`}
      >
        <span>
          <span className="bb-hint-key house-key">WASD</span> {strings.hintMove}
        </span>
        <span>
          <span className="bb-hint-key house-key">Space</span>{' '}
          {strings.hintShootDunk}
        </span>
        <span>
          <span className="bb-hint-key house-key">F</span>{' '}
          {strings.hintCrossover}
        </span>
        <span>
          <span className="bb-hint-key house-key">C</span> {strings.hintSpin}
        </span>
        <span>
          <span className="bb-hint-key house-key">S+Space</span>{' '}
          {strings.hintStepBack}
        </span>
        <span>
          <span className="bb-hint-key house-key">E</span> {strings.hintPass}
        </span>
        <span>
          <span className="bb-hint-key house-key">Shift</span>{' '}
          {strings.hintSprint}
        </span>
        <span>
          <span className="bb-hint-key house-key">Space x2</span>{' '}
          {strings.hintSuperJump}
        </span>
        <span>
          <span className="bb-hint-key house-key">V</span> {strings.hintCamera}
        </span>
      </div>
    </div>
  );
}
