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
import { DriveThruSound } from './audio';
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
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { idleInput } from './types';
import { DRIVE_THRU_TRANSLATIONS } from './translations';
import { computeWindowReachGap } from './physics';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyGoal, partyRound } from '../../shared/ui/party-round';

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
  const audioRef = useRef<DriveThruSound | null>(null);
  const worldRef = useRef<DriveThruWorld>(freshDriveThruWorld());
  const localPlayerIdRef = useRef<string>('player-human');

  // This loop runs on every animation frame, so without pacing the HUD would
  // rebuild at the frame rate. The order, the score and a fail are immediate.
  const hud = useRef(
    hudPacer<DriveThruSnapshot>(
      (s) => `${s.phase}:${s.score}:${s.failState}:${s.ticket?.id ?? ''}`,
    ),
  );
  const currentInput = useRef(idleInput());
  const [snapshot, setSnapshot] = useState<DriveThruSnapshot | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(true);
  const paused = useRef(true);
  const [selectedRole, setSelectedRole] = useState<RoleId>('driver');

  const room = usePeerRoom<DriveThruSnapshot>({
    game: 'drive-thru',
    onOpen: () => {
      setHelpOpen(false);
      paused.current = false;
    },
    loadEngine: () => import('./peer'),
    idleInput,
    readInput: () => (paused.current ? idleInput() : currentInput.current),
    onAttach: (next) => {
      localPlayerIdRef.current = next.id;
      currentInput.current = idleInput();
      setHelpOpen(false);
      paused.current = false;
      hud.current.reset();
    },
    receive: (snap) => {
      if (hud.current.due(snap)) setSnapshot(snap);
      setSelectedRole(snap.myRole);
      sceneRef.current?.setEnabled(
        !paused.current &&
          snap.phase !== 'meltdown' &&
          snap.phase !== 'completed',
      );
      sceneRef.current?.update(snap);
      audioRef.current?.update(snap.world, localPlayerIdRef.current);
    },
  });
  const { send, active } = room;

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
    const audio = new DriveThruSound();
    audioRef.current = audio;

    // Initialize Scene
    const scene = new DriveThruScene(containerRef.current, {
      input: (inp: PlayerInput) => {
        currentInput.current = inp;
        const p = worldRef.current.players.find(
          (item) => item.id === localPlayerIdRef.current,
        );
        if (p) p.input = inp;
      },
      action: (act: DriveThruAction) => {
        if (!send(act))
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

      if (active.current) {
        animId = requestAnimationFrame(loop);
        return;
      }
      const currentWorld = worldRef.current;

      // 1. Run bot decisions
      if (!paused.current && !document.hidden) {
        for (const p of currentWorld.players) {
          if (p.bot) {
            stepDriveThruBot(p, currentWorld, dt);
          }
        }

        // 2. Advance world physics & simulation
        advanceDriveThruWorld(currentWorld, dt, Date.now());
      }
      scene.setEnabled(
        !paused.current &&
          currentWorld.phase !== 'meltdown' &&
          currentWorld.phase !== 'completed',
      );

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
      audio.update(currentWorld, localPlayerIdRef.current);

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
  }, [send, active]);

  const handleRoleChange = (newRole: RoleId) => {
    sceneRef.current?.resetInput();
    setSelectedRole(newRole);
    if (send({ type: 'switchRole', role: newRole })) return;
    const w = worldRef.current;
    const human = w.players.find((p) => p.id === localPlayerIdRef.current);
    if (human) {
      human.role = newRole;
      reconcileDriveThruBots(w);
    }
  };

  const handleAction = (act: DriveThruAction) => {
    if (send(act)) return;
    driveThruAction(worldRef.current, localPlayerIdRef.current, act);
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    if (audioRef.current) {
      audioRef.current.setMuted(!next);
    }
  };

  const handleRestart = () => {
    if (send({ type: 'restart' })) return;
    sceneRef.current?.resetInput();
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
    <div
      className="drive-thru-container"
      {...partyRound(
        snapshot?.phase === 'meltdown' || snapshot?.phase === 'completed',
        snapshot
          ? partyGoal(snapshot.phase === 'completed', snapshot.score)
          : null,
      )}
    >
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
          multiplayer={<PeerRoomControls room={room} />}
          voice={room.voice}
          muted={!audioEnabled}
          onToggleSound={handleToggleAudio}
          onHelp={() => {
            paused.current = true;
            sceneRef.current?.setEnabled(false);
            setHelpOpen(true);
          }}
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
              {strings.timeLeft}{' '}
              <strong>{Math.max(0, Math.ceil(snapshot.phaseTimer))}s</strong>
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

      {selectedRole === 'driver' && snapshot && (
        <div className="drive-thru-driving-status">
          <strong>
            {Math.round(Math.abs(snapshot.car.speed) * 3.6)} <small>km/h</small>
          </strong>
          <span>
            {Math.abs(snapshot.car.speed) < 0.1
              ? 'PARKED'
              : snapshot.car.speed < 0
                ? 'REVERSE'
                : 'DRIVE'}
          </span>
          <p>
            {computeWindowReachGap(snapshot.car).canReach
              ? 'At the window — stop for pickup'
              : snapshot.car.z < -2
                ? 'Reverse toward the pickup bay'
                : 'Follow the lane to the striped pickup bay'}
          </p>
          <small>WASD / arrows · S to brake & reverse</small>
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
            {(
              [
                ['ArrowLeft', '←', 'Steer left'],
                ['ArrowRight', '→', 'Steer right'],
                ['ArrowDown', '↓', 'Brake / reverse'],
                ['ArrowUp', '↑', 'Accelerate'],
              ] as const
            ).map(([code, icon, title]) => (
              <button
                key={code}
                className="drive-thru-action-btn drive-thru-pedal"
                aria-label={title}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sceneRef.current?.holdControl(code, true);
                }}
                onPointerUp={() => sceneRef.current?.holdControl(code, false)}
                onPointerCancel={() =>
                  sceneRef.current?.holdControl(code, false)
                }
                onLostPointerCapture={() =>
                  sceneRef.current?.holdControl(code, false)
                }
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    sceneRef.current?.holdControl(code, true);
                  }
                }}
                onKeyUp={() => sceneRef.current?.holdControl(code, false)}
                onBlur={() => sceneRef.current?.holdControl(code, false)}
              >
                <b>{icon}</b>
                <span>{title}</span>
              </button>
            ))}
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
              onClick={() => handleAction({ type: 'pourDrink' })}
            >
              <KeyHint text="Pour drink (R)" />
            </button>
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

      {helpOpen && (
        <div className="drive-thru-modal-backdrop">
          <dialog
            className="drive-thru-modal"
            ref={(element) => {
              if (element && !element.open) element.showModal();
            }}
            onCancel={() => {
              paused.current = false;
              setHelpOpen(false);
              sceneRef.current?.setEnabled(true);
            }}
            aria-labelledby="drive-help-title"
          >
            <div className="drive-thru-help-badge">WELCOME TO JUMBLE DINER</div>
            <button
              onClick={() => {
                setHelpOpen(false);
                paused.current = false;
                room.setOpen(true);
              }}
            >
              Multiplayer
            </button>
            <h1 id="drive-help-title">
              One car. Four jobs.
              <br />
              Lunch is on the line.
            </h1>
            <p>
              Drive to the striped pickup bay, stop beside the window and let
              your passenger collect the order. Bots handle the other jobs until
              you take over.
            </p>
            <dl className="drive-thru-help-controls">
              <dt>Driver</dt>
              <dd>
                W / ↑ accelerate · S / ↓ brake & reverse · A / D steer · H honk
              </dd>
              <dt>Passenger</dt>
              <dd>Space reach · R swat toy · E wipers</dd>
              <dt>Grill</dt>
              <dd>Arrows move spatula · Space flip · R lift fryer · E stack</dd>
              <dt>Barista</dt>
              <dd>Space vent · R pour drinks · E send tray</dd>
            </dl>
            <button
              autoFocus
              className="drive-thru-btn-restart"
              onClick={() => {
                paused.current = false;
                setHelpOpen(false);
                sceneRef.current?.setEnabled(true);
              }}
            >
              Let&apos;s drive
            </button>
          </dialog>
        </div>
      )}
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
                ? `Order delivered! Final score: ${snapshot.score}`
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
