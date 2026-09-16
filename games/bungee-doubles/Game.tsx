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
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { bungeeDoublesAnalytics } from './analytics';

const tracker = new GameTracker(bungeeDoublesAnalytics);

export default function BungeeDoublesGame() {
  useGameTracker(tracker);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<BungeeScene | null>(null);
  const sound = useRef<BungeeDoublesSound | null>(null);
  const network = useRef<PeerGameConnection<BungeeSnapshot> | null>(null);
  const localWorld = useRef<BungeeWorld | null>(null);
  const currentInput = useRef(idleInput());

  const [snapshot, setSnapshot] = useState<BungeeSnapshot | null>(null);
  const [team, setTeam] = useState<TeamId>('orange');
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
    team: 'orange',
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
      setSnapshot(snap);
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
    w.players.push(
      newPlayer(sessionRef.current.id, 'You', 0, 'orange', false, 0),
    );
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

      setSnapshot(snap);
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
      <div ref={container} className="bungee-canvas" />

      {/* 360 Camera Orbit Helper Badge */}
      <div className="bungee-camera-hint">
        <Camera size={13} />
        <span>Drag court to orbit 360°</span>
        <kbd>Q/R</kbd>
        <kbd>C</kbd>
      </div>

      {/* Top HUD: Scoreboard */}
      <div className="bungee-hud">
        <div
          className={`bungee-team-score orange ${world?.serverTeam === 'orange' ? 'serving' : ''}`}
        >
          <div className="bungee-score-meta">
            <span>Orange</span>
            <span>Team</span>
          </div>
          <span className="bungee-score-val">{world?.scores.orange ?? 0}</span>
          {world?.serverTeam === 'orange' && (
            <span className="bungee-serve-indicator" title="Serving" />
          )}
        </div>

        <div className="bungee-center-badge">
          <span className="bungee-center-label">RALLY</span>
          <span className="bungee-rally-val">{world?.rallyCount ?? 0}</span>
          {world && world.rallyCount >= 5 && (
            <span className="bungee-rally-streak">HOT STREAK!</span>
          )}
        </div>

        <div
          className={`bungee-team-score teal ${world?.serverTeam === 'teal' ? 'serving' : ''}`}
        >
          {world?.serverTeam === 'teal' && (
            <span className="bungee-serve-indicator" title="Serving" />
          )}
          <span className="bungee-score-val">{world?.scores.teal ?? 0}</span>
          <div className="bungee-score-meta">
            <span>Teal</span>
            <span>Team</span>
          </div>
        </div>
      </div>

      {/* Bungee Tension Meter */}
      {tether && (
        <div className={`bungee-tension-card ${tensionClass}`}>
          <div className="bungee-tension-header">
            <Zap size={13} className="bungee-zap-icon" />
            <span className="bungee-tension-title">BUNGEE STRAIN</span>
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
              {tensionVal >= 80 ? 'CRITICAL SNAP DANGER!' : 'SLINGSHOT READY'}
            </span>
          )}
        </div>
      )}

      {/* Point Banner */}
      {banner && (
        <div className="bungee-banner">
          <span className="bungee-banner-pill">RALLY UPDATE</span>
          <h2>{banner.text}</h2>
          <p>{banner.subtext}</p>
        </div>
      )}

      {/* Win Banner */}
      {world?.phase === 'ended' && world.winner && (
        <div className="bungee-banner win">
          <Trophy size={48} color="#f1c40f" />
          <h2>{world.winner.toUpperCase()} WINS!</h2>
          <p>Championship Match Complete</p>
          <button
            className="bungee-btn primary"
            style={{ marginTop: 14 }}
            onClick={() => dispatchAction({ type: 'restart' })}
          >
            Play Again
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
          <span>Volley</span>
          <kbd className="bungee-kbd">SPACE</kbd>
        </button>
        <button
          className="bungee-btn smash-btn"
          onClick={() => dispatchAction({ type: 'smash' })}
        >
          <Zap size={14} />
          <span>Smash</span>
          <kbd className="bungee-kbd">E</kbd>
        </button>
        <button
          className="bungee-btn"
          onClick={() => dispatchAction({ type: 'dive' })}
        >
          <span>Dive</span>
          <kbd className="bungee-kbd">SHIFT</kbd>
        </button>
        <button
          className="bungee-btn"
          onClick={() => {
            const next = team === 'orange' ? 'teal' : 'orange';
            setTeam(next);
            dispatchAction({ type: 'switchTeam' });
          }}
        >
          <Users size={14} />
          <span>Switch Team</span>
        </button>
        <button
          className="bungee-btn"
          onClick={() => scene.current?.cycleCameraView()}
          title="Cycle camera angle (C)"
        >
          <Camera size={14} />
          <span>Camera</span>
          <kbd className="bungee-kbd">C</kbd>
        </button>
        <button
          className="bungee-btn"
          onClick={() => dispatchAction({ type: 'restart' })}
        >
          <RotateCcw size={14} />
          <span>Reset</span>
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
