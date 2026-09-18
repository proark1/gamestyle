'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Flame, RotateCcw, Trophy, Users, Zap } from 'lucide-react';
import type { PeerGameConnection } from '../../shared/peer/connection';
import {
  advanceBungee,
  bungeeAction,
  bungeeSnapshot,
  freshBungeeWorld,
  newPlayer,
} from './simulation';
import { reconcileBungeeBots, stepBungeeBot } from './bots';
import {
  idleInput,
  type BungeeAction,
  type BungeeSession,
  type BungeeSnapshot,
  type BungeeWorld,
  type PlayerInput,
  type TeamId,
} from './types';
import { BungeeDoublesSound } from './audio';
import { BungeeScene } from './scene';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import LanguageSwitcher from '../../shared/language/LanguageSwitcher';
import { BUNGEE_DOUBLES_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { bungeeDoublesAnalytics } from './analytics';
import { hudPacer } from '../../shared/ui/hud-pacer';

const tracker = new GameTracker(bungeeDoublesAnalytics);

export default function BungeeDoublesGame() {
  const { t } = useLanguage();
  const strings = t(BUNGEE_DOUBLES_TRANSLATIONS);
  useGameTracker(tracker);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<BungeeScene | null>(null);
  const sound = useRef<BungeeDoublesSound | null>(null);
  const network = useRef<PeerGameConnection<BungeeSnapshot> | null>(null);
  const localWorld = useRef<BungeeWorld | null>(null);
  const currentInput = useRef(idleInput());
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<BungeeSnapshot>(
      ({ world: w }) =>
        `${w.phase}:${w.eventId}:${w.scores.red}:${w.scores.blue}`,
    ),
  );

  const [snapshot, setSnapshot] = useState<BungeeSnapshot | null>(null);
  const [team, setTeam] = useState<TeamId>('red');
  const [banner, setBanner] = useState<{
    text: string;
    subtext: string;
    team?: TeamId;
  } | null>(null);

  const sessionRef = useRef<BungeeSession>({
    id: 'p-local',
    token: 'solo-token',
    code: 'SOLO',
    name: 'Player',
    team: 'red',
  });

  const dispatchAction = useCallback((act: BungeeAction) => {
    tracker.action(act.type);
    sound.current?.unlock();
    if (network.current) {
      void network.current.action(act);
    } else if (localWorld.current) {
      bungeeAction(localWorld.current, sessionRef.current.id, act);
      const snap = bungeeSnapshot(
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

    sound.current = new BungeeDoublesSound();

    scene.current = new BungeeScene(container.current, {
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
    const w = freshBungeeWorld(now);
    w.players.push(newPlayer(sessionRef.current.id, 'You', 0, 'red', false, 0));
    reconcileBungeeBots(w);
    localWorld.current = w;

    const initialSnap = bungeeSnapshot(
      w,
      'SOLO',
      sessionRef.current.id,
      sessionRef.current.id,
      now,
    );
    setSnapshot(initialSnap);
    scene.current.render(initialSnap);

    // Solo game simulation loop (60 FPS)
    let lastTick = performance.now();
    let animId = 0;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      if (!localWorld.current || network.current) return;

      const currentTime = performance.now();
      const dt = Math.min((currentTime - lastTick) / 1000, 0.05);
      lastTick = currentTime;

      const world = localWorld.current;
      const stepNow = Date.now();

      // Step bots
      for (const p of world.players) {
        if (p.bot) {
          stepBungeeBot(p, world, dt, stepNow);
        }
      }

      advanceBungee(world, dt, stepNow);

      const snap = bungeeSnapshot(
        world,
        'SOLO',
        sessionRef.current.id,
        sessionRef.current.id,
        stepNow,
      );

      if (hud.current.due(snap)) setSnapshot(snap);
      scene.current?.render(snap);
      sound.current?.update(world, sessionRef.current.id);

      if (world.scoreBanner) {
        setBanner(world.scoreBanner);
        world.scoreBanner = null;
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      scene.current?.destroy();
      scene.current = null;
      sound.current = null;
    };
  }, [dispatchAction]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1800);
    return () => clearTimeout(t);
  }, [banner]);

  const world = snapshot?.world;
  const tether = world?.tethers[team];
  const tensionVal = tether ? Math.round(tether.tension * 100) : 0;
  const tensionClass =
    tensionVal > 80 ? 'danger' : tensionVal > 50 ? 'warning' : 'safe';

  return (
    <div className="bungee-game">
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 30 }}>
        <LanguageSwitcher variant="header" />
      </div>
      <div ref={container} className="bungee-canvas" />

      {/* 360 Camera Orbit Helper Badge */}
      <div className="bungee-camera-hint">
        <Camera size={13} />
        <span>{strings.orbitHint}</span>
        <kbd>Q/R</kbd>
        <kbd>C</kbd>
      </div>

      {/* Top HUD: Scoreboard */}
      <div className="bungee-hud">
        <div
          className={`bungee-team-score red ${world?.serverTeam === 'red' ? 'serving' : ''}`}
        >
          <div className="bungee-score-meta">
            <span>{strings.red}</span>
            <span>{strings.team}</span>
          </div>
          <span className="bungee-score-val">{world?.scores.red ?? 0}</span>
          {world?.serverTeam === 'red' && (
            <span className="bungee-serve-indicator" title={strings.serving} />
          )}
        </div>

        <div className="bungee-center-badge">
          <span className="bungee-center-label">{strings.rally}</span>
          <span className="bungee-rally-val">{world?.rallyCount ?? 0}</span>
          {world && world.rallyCount >= 5 && (
            <span className="bungee-rally-streak">{strings.hotStreak}</span>
          )}
        </div>

        <div
          className={`bungee-team-score blue ${world?.serverTeam === 'blue' ? 'serving' : ''}`}
        >
          {world?.serverTeam === 'blue' && (
            <span className="bungee-serve-indicator" title={strings.serving} />
          )}
          <span className="bungee-score-val">{world?.scores.blue ?? 0}</span>
          <div className="bungee-score-meta">
            <span>{strings.blue}</span>
            <span>{strings.team}</span>
          </div>
        </div>
      </div>

      {/* Bungee Tension Meter */}
      {tether && (
        <div className={`bungee-tension-card ${tensionClass}`}>
          <div className="bungee-tension-header">
            <Zap size={13} className="bungee-zap-icon" />
            <span className="bungee-tension-title">{strings.bungeeStrain}</span>
            <span className="bungee-tension-pct">{tensionVal}%</span>
          </div>
          <div className="bungee-tension-bar">
            <div
              className={`bungee-tension-fill ${tensionClass}`}
              style={{ width: `${tensionVal}%` }}
            />
          </div>
          {tensionVal >= 55 && (
            <span className="bungee-tension-hint">
              {tensionVal >= 80 ? strings.criticalSnap : strings.slingshotReady}
            </span>
          )}
        </div>
      )}

      {/* Point Banner */}
      {banner && (
        <div className="bungee-banner">
          <span className="bungee-banner-pill">{strings.rallyUpdate}</span>
          <h2>{banner.text}</h2>
          <p>{banner.subtext}</p>
        </div>
      )}

      {/* Win Banner */}
      {world?.phase === 'ended' && world.winner && (
        <div className="bungee-banner win">
          <Trophy size={48} color="#f1c40f" />
          <h2>
            {strings[world.winner].toUpperCase()} {strings.wins}
          </h2>
          <p>{strings.matchComplete}</p>
          <button
            className="bungee-btn primary"
            style={{ marginTop: 14 }}
            onClick={() => dispatchAction({ type: 'restart' })}
          >
            {strings.playAgain}
          </button>
        </div>
      )}

      {/* Bottom Action Dock */}
      <div className="bungee-dock">
        <button
          className="bungee-btn primary"
          onClick={() => dispatchAction({ type: 'swing' })}
        >
          <Flame size={14} />
          <span>{strings.volley}</span>
          <kbd className="bungee-kbd">SPACE</kbd>
        </button>
        <button
          className="bungee-btn smash-btn"
          onClick={() => dispatchAction({ type: 'smash' })}
        >
          <Zap size={14} />
          <span>{strings.smash}</span>
          <kbd className="bungee-kbd">E</kbd>
        </button>
        <button
          className="bungee-btn"
          onClick={() => dispatchAction({ type: 'dive' })}
        >
          <span>{strings.dive}</span>
          <kbd className="bungee-kbd">SHIFT</kbd>
        </button>
        <button
          className="bungee-btn"
          onClick={() => {
            const next = team === 'red' ? 'blue' : 'red';
            setTeam(next);
            dispatchAction({ type: 'switchTeam' });
          }}
        >
          <Users size={14} />
          <span>{strings.switchTeam}</span>
        </button>
        <button
          className="bungee-btn"
          onClick={() => scene.current?.cycleCameraView()}
          title="Cycle camera angle (C)"
        >
          <Camera size={14} />
          <span>{strings.camera}</span>
          <kbd className="bungee-kbd">C</kbd>
        </button>
        <button
          className="bungee-btn"
          onClick={() => dispatchAction({ type: 'restart' })}
        >
          <RotateCcw size={14} />
          <span>{strings.reset}</span>
        </button>
      </div>

      {/* Touch Action Dock (for mobile) */}
      <div className="bungee-touch-controls">
        <button
          className="bungee-action-circle cam"
          onTouchStart={(e) => {
            e.preventDefault();
            scene.current?.cycleCameraView();
          }}
          title="Rotate Camera 360°"
        >
          CAM
        </button>
        <button
          className="bungee-action-circle smash"
          onTouchStart={(e) => {
            e.preventDefault();
            dispatchAction({ type: 'smash' });
          }}
        >
          SMASH
        </button>
        <button
          className="bungee-action-circle dive"
          onTouchStart={(e) => {
            e.preventDefault();
            dispatchAction({ type: 'dive' });
          }}
        >
          DIVE
        </button>
        <button
          className="bungee-action-circle"
          onTouchStart={(e) => {
            e.preventDefault();
            dispatchAction({ type: 'swing' });
          }}
        >
          HIT
        </button>
      </div>
    </div>
  );
}
