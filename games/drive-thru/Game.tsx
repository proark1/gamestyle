'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  Car,
  Utensils,
  Coffee,
  User,
  Flame,
  AlertTriangle,
  Zap,
  Hamburger,
} from 'lucide-react';
import { DriveThruScene } from './scene';
import { DriveThruAudio } from './audio';
import {
  advanceDriveThruWorld,
  driveThruAction,
  driveThruSnapshot,
  freshDriveThruWorld,
  newDriveThruPlayer,
} from './simulation';
import { stepDriveThruBot, reconcileDriveThruBots } from './bots';
import type {
  DriveThruAction,
  DriveThruSnapshot,
  DriveThruWorld,
  PlayerInput,
  RoleId,
} from './types';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { driveThruAnalytics } from './analytics';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import GameToolbar from '../../shared/ui/GameToolbar';
import { DRIVE_THRU_TRANSLATIONS } from './translations';
import { hudPacer } from '../../shared/ui/hud-pacer';

const tracker = new GameTracker(driveThruAnalytics);

// "Flip Patty (Space)" reads as a label and a house key cap. Labels without
// a short trailing key in brackets pass through unchanged.
function KeyHint({ text }: { text: string }) {
  const match = /^(.*?)\s*\(([^)]{1,12})\)$/.exec(text.trim());
  if (!match) return <>{text}</>;
  return (
    <>
      <span>{match[1]}</span>
      <kbd className="house-key">{match[2]}</kbd>
    </>
  );
}

export default function DriveThruGame() {
  const { t } = useLanguage();
  const strings = t(DRIVE_THRU_TRANSLATIONS);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DriveThruScene | null>(null);
  const audioRef = useRef<DriveThruAudio | null>(null);
  const worldRef = useRef<DriveThruWorld>(freshDriveThruWorld());
  const localPlayerIdRef = useRef<string>('player-human');

  // This loop runs on every animation frame, so without pacing the HUD would
  // rebuild at the frame rate. The order, the score and a fail are immediate.
  const hud = useRef(
    hudPacer<DriveThruSnapshot>(
      (s) => `${s.phase}:${s.score}:${s.failState}:${s.ticket?.id ?? ''}`,
    ),
  );
  const [snapshot, setSnapshot] = useState<DriveThruSnapshot | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleId>('driver');

  useGameTracker(tracker);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize local world with human player in selectedRole
    const w = freshDriveThruWorld();
    const human = newDriveThruPlayer(
      localPlayerIdRef.current,
      'You',
      0,
      'driver',
      false,
    );
    w.players = [human];
    reconcileDriveThruBots(w);
    worldRef.current = w;

    // Initialize Audio
    const audio = new DriveThruAudio();
    audioRef.current = audio;

    // Initialize Scene
    const scene = new DriveThruScene(containerRef.current, {
      input: (inp: PlayerInput) => {
        const p = worldRef.current.players.find(
          (item) => item.id === localPlayerIdRef.current,
        );
        if (p) p.input = inp;
      },
      action: (act: DriveThruAction) => {
        driveThruAction(worldRef.current, localPlayerIdRef.current, act);
      },
    });
    sceneRef.current = scene;

    // Unlock audio on first user gesture
    const handleGesture = () => {
      audio.unlock();
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
    window.addEventListener('pointerdown', handleGesture);
    window.addEventListener('keydown', handleGesture);

    // Simulation & Render Loop
    let lastTime = performance.now();
    let animId = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const currentWorld = worldRef.current;

      // 1. Run bot decisions
      for (const p of currentWorld.players) {
        if (p.bot) {
          stepDriveThruBot(p, currentWorld, dt);
        }
      }

      // 2. Advance world physics & simulation
      advanceDriveThruWorld(currentWorld, dt, Date.now());

      // 3. Take snapshot
      const snap = driveThruSnapshot(
        currentWorld,
        'drive-thru-local',
        localPlayerIdRef.current,
        localPlayerIdRef.current,
        1,
      );

      if (hud.current.due(snap)) setSnapshot(snap);
      scene.update(snap);
      audio.update(currentWorld);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      scene.dispose();
      audio.dispose();
    };
  }, []);

  const handleRoleChange = (newRole: RoleId) => {
    setSelectedRole(newRole);
    const w = worldRef.current;
    const human = w.players.find((p) => p.id === localPlayerIdRef.current);
    if (human) {
      human.role = newRole;
      reconcileDriveThruBots(w);
    }
  };

  const handleAction = (act: DriveThruAction) => {
    driveThruAction(worldRef.current, localPlayerIdRef.current, act);
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    if (audioRef.current) {
      audioRef.current.enabled = next;
    }
  };

  const handleRestart = () => {
    const w = freshDriveThruWorld();
    const human = newDriveThruPlayer(
      localPlayerIdRef.current,
      'You',
      0,
      selectedRole,
      false,
    );
    w.players = [human];
    reconcileDriveThruBots(w);
    worldRef.current = w;
  };

  return (
    <div className="drive-thru-container">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="drive-thru-canvas-wrapper" />

      {/* House top bar: wordmark + shared toolbar (sound, language, help) */}
      <header className="topbar drive-thru-topbar">
        <a href="/" className="wordmark">
          <span className="drive-thru-mark">
            <Hamburger size={22} />
          </span>{' '}
          DRIVE-THRU STATIC<span className="drive-thru-title-dot">.</span>
        </a>
        <GameToolbar
          muted={!audioEnabled}
          onToggleSound={handleToggleAudio}
          // Drive-Thru has no rules panel yet; the role bar and the action
          // dock already show every control.
          onHelp={() => {}}
          voiceHint="Use your group call to talk with friends. In-game voice is not available in Drive-Thru Static yet."
        />
      </header>

      {/* Top Order Ticket Banner */}
      {snapshot?.ticket && (
        <div className="drive-thru-ticket-banner">
          <div className="drive-thru-ticket-header">
            <span className="drive-thru-ticket-order-num">
              {strings.orderNumber}
              {snapshot.ticket.orderNumber}
            </span>
            <span>
              {strings.timeLeft} <strong>{snapshot.phaseTimer}s</strong>
            </span>
            <span>
              {strings.score} <strong>{snapshot.score}</strong>
            </span>
          </div>
          <div className="drive-thru-ticket-scramble">
            {strings.intercomLabel} {snapshot.ticket.scrambledText}
          </div>
          <div className="drive-thru-ticket-clear">
            {strings.decodedLabel} {snapshot.ticket.clearText}
          </div>
        </div>
      )}

      {/* Role Switcher Tabs */}
      <div className="drive-thru-role-bar">
        <button
          className={`drive-thru-role-btn ${selectedRole === 'driver' ? 'active' : ''}`}
          onClick={() => handleRoleChange('driver')}
        >
          <Car size={16} /> {strings.driverRole}
        </button>
        <button
          className={`drive-thru-role-btn ${selectedRole === 'passenger' ? 'active' : ''}`}
          onClick={() => handleRoleChange('passenger')}
        >
          <User size={16} /> {strings.passengerRole}
        </button>
        <button
          className={`drive-thru-role-btn ${selectedRole === 'grill' ? 'active' : ''}`}
          onClick={() => handleRoleChange('grill')}
        >
          <Utensils size={16} /> Grill Cook (Burgers)
        </button>
        <button
          className={`drive-thru-role-btn ${selectedRole === 'barista' ? 'active' : ''}`}
          onClick={() => handleRoleChange('barista')}
        >
          <Coffee size={16} /> Barista (Shakes)
        </button>
      </div>

      {/* HUD Gauges */}
      <div className="drive-thru-hud-gauges">
        <div className="drive-thru-gauge-card">
          <div className="drive-thru-gauge-label">
            <span>Milkshake PSI</span>
            <span>{Math.round(snapshot?.kitchen.shakePressure ?? 0)}%</span>
          </div>
          <div className="drive-thru-progress-bar">
            <div
              className="drive-thru-progress-fill-shake"
              style={{
                width: `${Math.min(100, snapshot?.kitchen.shakePressure ?? 0)}%`,
              }}
            />
          </div>
        </div>

        <div className="drive-thru-gauge-card">
          <div className="drive-thru-gauge-label">
            <span>{strings.fryerTemp}</span>
            <span>
              {Math.round((snapshot?.kitchen.fryerTimer ?? 0) * 100)}%
            </span>
          </div>
          <div className="drive-thru-progress-bar">
            <div
              className="drive-thru-progress-fill-fryer"
              style={{
                width: `${Math.min(100, (snapshot?.kitchen.fryerTimer ?? 0) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Short Stop Reach Alert */}
      {snapshot?.phase === 'reaching' && (
        <div className="drive-thru-reach-panel">{strings.shortStopReach}</div>
      )}

      {/* Windshield Milkshake Splat Effect */}
      {snapshot?.car && snapshot.car.windshieldSplat > 0.1 && (
        <div
          className="drive-thru-splat-overlay"
          style={{ opacity: snapshot.car.windshieldSplat }}
        />
      )}

      {/* Contextual Action Buttons */}
      <div className="drive-thru-controls-bar">
        {selectedRole === 'driver' && (
          <>
            <button
              className="drive-thru-action-btn"
              onClick={() => handleAction({ type: 'honk' })}
            >
              <Zap size={17} /> <KeyHint text={strings.honkHorn} />
            </button>
          </>
        )}

        {selectedRole === 'passenger' && (
          <>
            <button
              className="drive-thru-action-btn"
              onClick={() => handleAction({ type: 'reachTray' })}
            >
              <KeyHint text="Reach for Tray (Space)" />
            </button>
            <button
              className="drive-thru-action-btn"
              onClick={() => handleAction({ type: 'swatDistraction' })}
            >
              <KeyHint text="Swat Toddler Toy (R)" />
            </button>
            <button
              className="drive-thru-action-btn"
              onClick={() => handleAction({ type: 'toggleWipers' })}
            >
              <KeyHint text="Wipers (E)" />
            </button>
          </>
        )}

        {selectedRole === 'grill' && (
          <>
            <button
              className="drive-thru-action-btn"
              onClick={() => handleAction({ type: 'flipPatty' })}
            >
              <Utensils size={17} /> <KeyHint text={strings.flipPatty} />
            </button>
            <button
              className="drive-thru-action-btn"
              onClick={() => handleAction({ type: 'liftFryer' })}
            >
              <Flame size={17} /> <KeyHint text="Pull Fryer (R)" />
            </button>
            <button
              className="drive-thru-action-btn"
              onClick={() =>
                handleAction({ type: 'stackIngredient', layer: 'patty' })
              }
            >
              <KeyHint text="Stack Patty (E)" />
            </button>
          </>
        )}

        {selectedRole === 'barista' && (
          <>
            <button
              className="drive-thru-action-btn"
              onClick={() => handleAction({ type: 'ventMilkshake' })}
            >
              <AlertTriangle size={17} />{' '}
              <KeyHint text="Vent Shake Valve (Space)" />
            </button>
            <button
              className="drive-thru-action-btn"
              onClick={() => handleAction({ type: 'pushTray' })}
            >
              <KeyHint text="Push Tray to Window (E)" />
            </button>
          </>
        )}
      </div>

      {/* Game Over / Meltdown / Victory Modal */}
      {(snapshot?.phase === 'meltdown' || snapshot?.phase === 'completed') && (
        <div className="drive-thru-modal-backdrop">
          <div className="drive-thru-modal">
            <div
              className={`drive-thru-modal-title ${
                snapshot.phase === 'completed'
                  ? 'drive-thru-modal-win'
                  : 'drive-thru-modal-fail'
              }`}
            >
              {snapshot.phase === 'completed'
                ? 'ORDER SERVED!'
                : 'INTERCOM MELTDOWN!'}
            </div>
            <div className="drive-thru-modal-body">
              {snapshot.phase === 'completed'
                ? `Order fulfilled successfully with crisp buns and four drinks intact! Final Score: ${snapshot.score}`
                : snapshot.failReason ||
                  'The shift ended in catastrophic fast-food disaster!'}
            </div>
            <button className="drive-thru-btn-restart" onClick={handleRestart}>
              <RotateCcw size={18} />
              Start New Shift
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
