'use client';
/* oxlint-disable react/react-compiler -- WebGL host syncs scene controllers */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Hammer,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import type { PeerGameConnection } from '../../shared/peer/connection';
import GameToolbar from '../../shared/ui/GameToolbar';
import { panicCurlingAnalytics } from './analytics';
import { CurlingAudio } from './audio';
import { reconcileCurlingBots, updateCurlingBots } from './bots';
import { PanicCurlingScene } from './scene';
import {
  advancePanicCurling,
  freshCurlingWorld,
  newCurlingPlayer,
  panicCurlingAction,
  panicCurlingSnapshot,
} from './simulation';
import {
  GADGET_CONFIGS,
  TEAM_NAMES,
  type GadgetId,
  type PanicCurlingAction,
  type PanicCurlingSession,
  type PanicCurlingSnapshot,
  type PanicCurlingWorld,
  type PlayerInput,
  type Role,
  type StoneKind,
  type TeamId,
  idleInput,
} from './types';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import { PANIC_CURLING_TRANSLATIONS } from './translations';

const tracker = new GameTracker(panicCurlingAnalytics);

export default function PanicCurlingGame() {
  const { t } = useLanguage();
  const strings = t(PANIC_CURLING_TRANSLATIONS);
  useGameTracker(tracker);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PanicCurlingScene | null>(null);
  const audioRef = useRef<CurlingAudio | null>(null);
  const networkRef = useRef<PeerGameConnection<PanicCurlingSnapshot> | null>(
    null,
  );
  const localWorld = useRef<PanicCurlingWorld | null>(null);
  const currentInput = useRef<PlayerInput>(idleInput());

  const [snapshot, setSnapshot] = useState<PanicCurlingSnapshot | null>(null);
  const [team, setTeam] = useState<TeamId>('red');
  const [role, setRole] = useState<Role>('deliverer');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Deliverer control state
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0.5);
  const [spin, setSpin] = useState(1);
  const [stoneKind, setStoneKind] = useState<StoneKind>('granite');
  const [powerOscillating, setPowerOscillating] = useState(true);

  // Sweeper control state
  const [activeGadget, setActiveGadget] = useState<GadgetId>('broom');
  const [isSweeping, setIsSweeping] = useState(false);
  const [steerDir, setSteerDir] = useState(0);

  // Tactics & Reaction Toast state
  const [showTactics, setShowTactics] = useState(false);
  const [reactionToast, setReactionToast] = useState<{
    text: string;
    id: number;
  } | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronization refs for 60fps simulation loop without effect tearing
  const aimAngleRef = useRef(0);
  const powerRef = useRef(0.5);
  const spinRef = useRef(1);
  const stoneKindRef = useRef<StoneKind>('granite');
  const activeGadgetRef = useRef<GadgetId>('broom');
  const isSweepingRef = useRef(false);
  const steerDirRef = useRef(0);
  const soundEnabledRef = useRef(true);
  const teamRef = useRef<TeamId>('red');
  const roleRef = useRef<Role>('deliverer');

  const sessionRef = useRef<PanicCurlingSession>({
    id: 'player-local',
    token: 'local-token',
    code: 'SOLO',
    team: 'red',
    role: 'deliverer',
    name: 'Captain Curl',
  });

  const dispatchAction = useCallback((act: PanicCurlingAction) => {
    tracker.action(act.type);
    audioRef.current?.unlock();

    if (networkRef.current) {
      void networkRef.current.action(act);
    } else if (localWorld.current) {
      panicCurlingAction(localWorld.current, sessionRef.current.id, act, true);
      if (act.type === 'switchRole' || act.type === 'switchTeam') {
        reconcileCurlingBots(localWorld.current);
      }
      const snap = panicCurlingSnapshot(
        localWorld.current,
        'SOLO',
        sessionRef.current.id,
        sessionRef.current.id,
        Date.now(),
      );
      setSnapshot(snap);
    }
  }, []);

  // Initialize Scene, Audio, and Local World (runs once)
  useEffect(() => {
    if (!containerRef.current) return;

    audioRef.current = new CurlingAudio();

    sceneRef.current = new PanicCurlingScene(containerRef.current, {
      input: (inp: PlayerInput) => {
        currentInput.current = inp;
        if (localWorld.current) {
          const p = localWorld.current.players.find(
            (pl) => pl.id === sessionRef.current.id,
          );
          if (p) p.input = inp;
        }
      },
    });
    sceneRef.current.setLocalPlayer(sessionRef.current.id);

    // Create solo world
    const now = Date.now();
    const world = freshCurlingWorld(now);
    world.players.push(
      newCurlingPlayer(
        sessionRef.current.id,
        sessionRef.current.name,
        0,
        'red',
        'deliverer',
        false,
      ),
    );
    reconcileCurlingBots(world);
    localWorld.current = world;

    const initialSnap = panicCurlingSnapshot(
      world,
      'SOLO',
      sessionRef.current.id,
      sessionRef.current.id,
      now,
    );
    setSnapshot(initialSnap);

    // Animation & simulation loop
    let lastTime = performance.now();
    let frameId = 0;

    const loop = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      if (localWorld.current) {
        // Feed player input from stable refs
        const me = localWorld.current.players.find(
          (p) => p.id === sessionRef.current.id,
        );
        if (me) {
          me.input = {
            ...currentInput.current,
            aimAngle: aimAngleRef.current,
            power: powerRef.current,
            spin: spinRef.current,
            stoneKind: stoneKindRef.current,
            sweep: isSweepingRef.current,
            steer: steerDirRef.current,
          };
          me.gadget = activeGadgetRef.current;
        }

        // Update Bots
        updateCurlingBots(localWorld.current, dt);

        // Advance simulation
        advancePanicCurling(localWorld.current, Date.now());

        // Play events audio & reaction toast
        if (localWorld.current.events.length > 0) {
          for (const ev of localWorld.current.events) {
            if (audioRef.current && soundEnabledRef.current) {
              audioRef.current.playEvent(ev);
            }
            if (ev.type === 'banana_slip') {
              if (reactionTimerRef.current)
                clearTimeout(reactionTimerRef.current);
              setReactionToast({
                text: '🍌 WHOOPS! SLIPPED ON PEEL!',
                id: Date.now(),
              });
              reactionTimerRef.current = setTimeout(
                () => setReactionToast(null),
                1800,
              );
            } else if (ev.type === 'stone_clack' && ev.volume > 0.35) {
              if (reactionTimerRef.current)
                clearTimeout(reactionTimerRef.current);
              setReactionToast({
                text: '💥 THUNDEROUS TAKEOUT!',
                id: Date.now(),
              });
              reactionTimerRef.current = setTimeout(
                () => setReactionToast(null),
                1800,
              );
            }
          }
        }

        const snap = panicCurlingSnapshot(
          localWorld.current,
          'SOLO',
          sessionRef.current.id,
          sessionRef.current.id,
          Date.now(),
        );
        setSnapshot(snap);
        sceneRef.current?.render(snap);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      sceneRef.current?.dispose();
    };
  }, [dispatchAction]);

  // Power meter oscillation while aiming
  useEffect(() => {
    if (!powerOscillating) return;
    let up = true;
    const interval = setInterval(() => {
      const current = localWorld.current;
      if (
        !current ||
        current.phase !== 'aiming' ||
        current.turnTeam !== teamRef.current
      ) {
        return;
      }
      setPower((prev) => {
        let next = up ? prev + 0.03 : prev - 0.03;
        if (next >= 0.95) {
          up = false;
          next = 0.95;
        } else if (next <= 0.1) {
          up = true;
          next = 0.1;
        }
        powerRef.current = next;
        return next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [powerOscillating]);

  const handleLaunch = useCallback(() => {
    setPowerOscillating(false);
    audioRef.current?.unlock();
    dispatchAction({
      type: 'deliver',
      power: powerRef.current,
      angle: aimAngleRef.current,
      spin: spinRef.current,
      kind: stoneKindRef.current,
    });
    setTimeout(() => setPowerOscillating(true), 2500);
  }, [dispatchAction]);

  const handleSwitchTeam = (newTeam: TeamId) => {
    setTeam(newTeam);
    teamRef.current = newTeam;
    sessionRef.current.team = newTeam;
    dispatchAction({ type: 'switchTeam', team: newTeam });
  };

  const handleSwitchRole = (newRole: Role) => {
    setRole(newRole);
    roleRef.current = newRole;
    sessionRef.current.role = newRole;
    dispatchAction({ type: 'switchRole', role: newRole });
  };

  const handleTossBanana = () => {
    audioRef.current?.unlock();
    dispatchAction({ type: 'throwBanana' });
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEnabledRef.current = next;
      return next;
    });
  };

  // Keyboard shortcuts: Space to deliver or sweep, Arrow keys or A/D to aim or steer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const current = localWorld.current;
        if (
          current?.phase === 'aiming' &&
          role === 'deliverer' &&
          current.turnTeam === teamRef.current
        ) {
          handleLaunch();
        } else if (current?.phase === 'sliding') {
          setIsSweeping(true);
          isSweepingRef.current = true;
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        const current = localWorld.current;
        if (current?.phase === 'aiming') {
          setAimAngle((a) => {
            const next = Math.max(-0.35, a - 0.05);
            aimAngleRef.current = next;
            return next;
          });
        } else if (current?.phase === 'sliding') {
          setSteerDir(-1);
          steerDirRef.current = -1;
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        const current = localWorld.current;
        if (current?.phase === 'aiming') {
          setAimAngle((a) => {
            const next = Math.min(0.35, a + 0.05);
            aimAngleRef.current = next;
            return next;
          });
        } else if (current?.phase === 'sliding') {
          setSteerDir(1);
          steerDirRef.current = 1;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSweeping(false);
        isSweepingRef.current = false;
      } else if (
        e.code === 'ArrowLeft' ||
        e.code === 'KeyA' ||
        e.code === 'ArrowRight' ||
        e.code === 'KeyD'
      ) {
        setSteerDir(0);
        steerDirRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [role, handleLaunch]);

  const world = snapshot?.world;
  const isMyTurn = world?.turnTeam === team;
  const isDeliverPhase =
    world?.phase === 'aiming' && role === 'deliverer' && isMyTurn;
  const isSlidePhase = world?.phase === 'sliding';
  const myPlayer = world?.players.find((p) => p.id === sessionRef.current.id);

  return (
    <div className="curling-container">
      <GameToolbar
        muted={!soundEnabled}
        onToggleSound={toggleSound}
        onHelp={() => {}}
      />

      <div ref={containerRef} className="curling-viewport" />

      {/* Collapsible "Match Tactics" Pill & Menu */}
      <div style={{ position: 'relative', zIndex: 30 }}>
        <button
          className="curling-tactics-pill"
          onClick={() => setShowTactics((prev) => !prev)}
        >
          <Users size={16} />
          <span>
            {team === 'red' ? '🔴 Red Rovers' : '🔵 Blue Blazers'} •{' '}
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </span>
          {showTactics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTactics && (
          <div className="curling-tactics-menu">
            <span className="curling-tactics-section-title">
              {strings.selectTeam}
            </span>
            <div className="curling-btn-group">
              <button
                className={`curling-toggle-btn ${team === 'red' ? 'active' : ''}`}
                onClick={() => {
                  handleSwitchTeam('red');
                  setShowTactics(false);
                }}
              >
                🔴 Red Rovers
              </button>
              <button
                className={`curling-toggle-btn ${team === 'blue' ? 'active' : ''}`}
                onClick={() => {
                  handleSwitchTeam('blue');
                  setShowTactics(false);
                }}
              >
                🔵 Blue Blazers
              </button>
            </div>

            <span className="curling-tactics-section-title">
              {strings.selectRole}
            </span>
            <div className="curling-btn-group">
              <button
                className={`curling-toggle-btn ${role === 'deliverer' ? 'active' : ''}`}
                onClick={() => {
                  handleSwitchRole('deliverer');
                  setShowTactics(false);
                }}
              >
                Deliverer
              </button>
              <button
                className={`curling-toggle-btn ${role === 'sweeper' ? 'active' : ''}`}
                onClick={() => {
                  handleSwitchRole('sweeper');
                  setShowTactics(false);
                }}
              >
                Sweeper
              </button>
              <button
                className={`curling-toggle-btn ${role === 'defender' ? 'active' : ''}`}
                onClick={() => {
                  handleSwitchRole('defender');
                  setShowTactics(false);
                }}
              >
                Defender
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Alpine Tournament Scoreboard */}
      {world && (
        <div className="curling-scoreboard">
          <div className="curling-team-score">
            <span className="curling-team-badge red">🔴</span>
            <span className="curling-team-name">{TEAM_NAMES.red}</span>
            <span className="curling-team-points">{world.scores.red}</span>
          </div>

          <div className="curling-round-info">
            <div className="curling-round-header">
              <span className="curling-round-title">
                End {world.round} of {world.maxRounds}
              </span>
              <div className="curling-end-dots">
                {[1, 2, 3].map((endNum) => (
                  <div
                    key={endNum}
                    className={`curling-end-dot ${
                      endNum < world.round
                        ? 'completed'
                        : endNum === world.round
                          ? 'active'
                          : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            <div
              className={`curling-round-turn ${
                world.turnTeam === 'red' ? 'red-turn' : 'blue-turn'
              }`}
            >
              <span>{world.turnTeam === 'red' ? '🔴 RED' : '🔵 BLUE'}</span>
              <span>•</span>
              <span>
                ROCK {world.throwIndex + 1}/{world.totalThrowsPerEnd}
              </span>
            </div>

            <span className="curling-hammer-badge">
              <Hammer size={12} /> {world.hammerTeam === 'red' ? 'Red' : 'Blue'}{' '}
              Hammer
            </span>
          </div>

          <div className="curling-team-score">
            <span className="curling-team-points">{world.scores.blue}</span>
            <span className="curling-team-name">{TEAM_NAMES.blue}</span>
            <span className="curling-team-badge blue">🔵</span>
          </div>
        </div>
      )}

      {/* Reaction Floater / Toast */}
      {reactionToast && (
        <div key={reactionToast.id} className="curling-reaction-toast">
          {reactionToast.text}
        </div>
      )}

      {/* Waiting Indicator during Opponent Turn */}
      {world?.phase === 'aiming' && !isMyTurn && (
        <div className="curling-waiting-banner">{strings.waitingOpponent}</div>
      )}

      {/* Deliverer Aim & Power Controls */}
      {isDeliverPhase && (
        <div className="curling-deliver-hud">
          {/* Stone Selection 3D Cards */}
          <div className="curling-stone-cards">
            <button
              className={`curling-stone-card ${stoneKind === 'granite' ? 'active' : ''}`}
              onClick={() => {
                setStoneKind('granite');
                stoneKindRef.current = 'granite';
                dispatchAction({ type: 'switchStone', kind: 'granite' });
              }}
            >
              <span className="curling-stone-icon">🪨</span>
              <span className="curling-stone-name">{strings.graniteName}</span>
              <span className="curling-stone-sub">{strings.graniteSub}</span>
            </button>
            <button
              className={`curling-stone-card ${stoneKind === 'anvil' ? 'active' : ''}`}
              onClick={() => {
                setStoneKind('anvil');
                stoneKindRef.current = 'anvil';
                dispatchAction({ type: 'switchStone', kind: 'anvil' });
              }}
            >
              <span className="curling-stone-icon">⚓</span>
              <span className="curling-stone-name">{strings.anvilName}</span>
              <span className="curling-stone-sub">{strings.anvilSub}</span>
            </button>
            <button
              className={`curling-stone-card ${stoneKind === 'basket' ? 'active' : ''}`}
              onClick={() => {
                setStoneKind('basket');
                stoneKindRef.current = 'basket';
                dispatchAction({ type: 'switchStone', kind: 'basket' });
              }}
            >
              <span className="curling-stone-icon">🧺</span>
              <span className="curling-stone-name">{strings.teammateName}</span>
              <span className="curling-stone-sub">{strings.teammateSub}</span>
            </button>
          </div>

          {/* Spin Direction Row */}
          <div className="curling-hud-row">
            <div
              className="curling-btn-group"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <button
                className={`curling-toggle-btn ${spin < 0 ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  setSpin(-1);
                  spinRef.current = -1;
                }}
              >
                {strings.curlLeft}
              </button>
              <button
                className={`curling-toggle-btn ${spin > 0 ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  setSpin(1);
                  spinRef.current = 1;
                }}
              >
                {strings.curlRight}
              </button>
            </div>
          </div>

          {/* Power Meter with Labeled Zones */}
          <div className="curling-power-meter">
            <div className="curling-power-label">
              <span>
                {strings.launchPower}: {Math.round(power * 100)}%
              </span>
              <span className="curling-power-zone-tag">
                {power < 0.35
                  ? strings.guardShot
                  : power < 0.72
                    ? strings.drawToHouse
                    : strings.highTakeout}
              </span>
            </div>
            <div className="curling-power-bar-bg">
              <div
                className="curling-power-bar-fill"
                style={{ width: `${power * 100}%` }}
              />
            </div>
            <div className="curling-power-zones">
              <span className="curling-zone-guard">{strings.zoneGuard}</span>
              <span className="curling-zone-draw">{strings.zoneDraw}</span>
              <span className="curling-zone-takeout">
                {strings.zoneTakeout}
              </span>
            </div>
          </div>

          {/* Aim Rocker Controls */}
          <div className="curling-aim-group">
            <button
              className="curling-aim-btn"
              onClick={() =>
                setAimAngle((a) => {
                  const next = Math.max(-0.35, a - 0.05);
                  aimAngleRef.current = next;
                  return next;
                })
              }
            >
              {strings.aimLeft}
            </button>
            <span className="curling-aim-display">
              {aimAngle === 0
                ? 'Center 0.0°'
                : `${(aimAngle * 57.3).toFixed(1)}° ${aimAngle > 0 ? '▶' : '◀'}`}
            </span>
            <button
              className="curling-aim-btn"
              onClick={() => {
                setAimAngle(0);
                aimAngleRef.current = 0;
              }}
            >
              {strings.reset}
            </button>
            <button
              className="curling-aim-btn"
              onClick={() =>
                setAimAngle((a) => {
                  const next = Math.min(0.35, a + 0.05);
                  aimAngleRef.current = next;
                  return next;
                })
              }
            >
              {strings.aimRight}
            </button>
          </div>

          {/* Juicy Deliver Button */}
          <button className="curling-launch-btn" onClick={handleLaunch}>
            <span>{strings.deliverStone}</span>
            <span className="curling-launch-sub">{strings.releaseAtPeak}</span>
          </button>
        </div>
      )}

      {/* Sweeper Cockpit & Gadget Dock */}
      {isSlidePhase && (role === 'sweeper' || isMyTurn) && (
        <div className="curling-sweeper-cockpit">
          {/* Real-time Slide Telemetry */}
          {(() => {
            const activeStone = world?.stones.find(
              (s) => s.id === world?.activeStoneId,
            );
            if (!activeStone) return null;
            return (
              <div className="curling-slide-telemetry">
                <div className="curling-telemetry-item">
                  <span className="curling-telemetry-label">SPEED</span>
                  <span className="curling-telemetry-val">
                    {Math.hypot(activeStone.vx, activeStone.vz).toFixed(1)} m/s
                  </span>
                </div>
                <div className="curling-telemetry-item">
                  <span className="curling-telemetry-label">TO TEE</span>
                  <span className="curling-telemetry-val">
                    {activeStone.distanceToTee.toFixed(1)} m
                  </span>
                </div>
                <div className="curling-telemetry-item">
                  <span className="curling-telemetry-label">SWEEP STATUS</span>
                  <span
                    className="curling-telemetry-val"
                    style={{ color: isSweeping ? '#ffb703' : '#a8dadc' }}
                  >
                    {isSweeping
                      ? `🔥 SWEEPING (-${Math.round(GADGET_CONFIGS[activeGadget].frictionCut * 100)}%)`
                      : 'HOLD TO EXTEND'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Tactile Gadget Selector */}
          <div className="curling-gadget-dock">
            {(['broom', 'hairdryer', 'blowtorch'] as GadgetId[]).map((g) => (
              <button
                key={g}
                className={`curling-gadget-btn ${activeGadget === g ? 'active' : ''}`}
                onClick={() => {
                  setActiveGadget(g);
                  activeGadgetRef.current = g;
                  dispatchAction({ type: 'switchGadget', gadget: g });
                }}
              >
                {g === 'broom' && <Wind size={15} />}
                {g === 'hairdryer' && <Zap size={15} />}
                {g === 'blowtorch' && <Flame size={15} />}
                <span>{GADGET_CONFIGS[g].name}</span>
              </button>
            ))}
          </div>

          {/* Sweeper Steer & Scrub Controls */}
          <div className="curling-sweeper-hud">
            <button
              className={`curling-steer-btn ${steerDir === -1 ? 'active' : ''}`}
              onMouseDown={() => {
                setSteerDir(-1);
                steerDirRef.current = -1;
              }}
              onMouseUp={() => {
                setSteerDir(0);
                steerDirRef.current = 0;
              }}
              onTouchStart={() => {
                setSteerDir(-1);
                steerDirRef.current = -1;
              }}
              onTouchEnd={() => {
                setSteerDir(0);
                steerDirRef.current = 0;
              }}
            >
              {strings.steerLeft}
            </button>

            <button
              className={`curling-sweep-btn ${isSweeping ? 'active' : ''}`}
              onMouseDown={() => {
                setIsSweeping(true);
                isSweepingRef.current = true;
              }}
              onMouseUp={() => {
                setIsSweeping(false);
                isSweepingRef.current = false;
              }}
              onTouchStart={() => {
                setIsSweeping(true);
                isSweepingRef.current = true;
              }}
              onTouchEnd={() => {
                setIsSweeping(false);
                isSweepingRef.current = false;
              }}
            >
              <Sparkles size={24} /> {strings.sweepHarder}
            </button>

            <button
              className={`curling-steer-btn ${steerDir === 1 ? 'active' : ''}`}
              onMouseDown={() => {
                setSteerDir(1);
                steerDirRef.current = 1;
              }}
              onMouseUp={() => {
                setSteerDir(0);
                steerDirRef.current = 0;
              }}
              onTouchStart={() => {
                setSteerDir(1);
                steerDirRef.current = 1;
              }}
              onTouchEnd={() => {
                setSteerDir(0);
                steerDirRef.current = 0;
              }}
            >
              {strings.steerRight}
            </button>
          </div>
        </div>
      )}

      {/* Banana Sabotage Button */}
      {myPlayer && myPlayer.bananasLeft > 0 && (
        <button className="curling-banana-btn" onClick={handleTossBanana}>
          {strings.tossBanana.replace('{count}', String(myPlayer.bananasLeft))}
        </button>
      )}

      {/* End of End or Match Over Dialog */}
      {world?.phase === 'end_summary' && (
        <div className="curling-modal-overlay">
          <div className="curling-modal-card">
            <h2 className="curling-modal-title">
              {strings.endComplete.replace('{round}', String(world.round))}
            </h2>
            <p className="curling-modal-desc">{strings.endDesc}</p>
            <div className="curling-modal-scores">
              <div className="curling-modal-team-score">
                <span className="curling-modal-team-name">
                  {TEAM_NAMES.red}
                </span>
                <span className="curling-modal-team-val red">
                  {world.scores.red}
                </span>
              </div>
              <div className="curling-modal-team-score">
                <span className="curling-modal-team-name">
                  {TEAM_NAMES.blue}
                </span>
                <span className="curling-modal-team-val blue">
                  {world.scores.blue}
                </span>
              </div>
            </div>
            <p style={{ color: '#8ed6ff', fontWeight: 700 }}>
              {strings.freshIce}
            </p>
          </div>
        </div>
      )}

      {world?.phase === 'match_over' && (
        <div className="curling-modal-overlay">
          <div className="curling-modal-card">
            <Trophy
              size={56}
              color="#f1c40f"
              style={{ margin: '0 auto 14px' }}
            />
            <h2 className="curling-modal-title">{strings.matchFinished}</h2>
            <p className="curling-modal-desc">
              {world.scores.red > world.scores.blue
                ? strings.redWins
                : world.scores.blue > world.scores.red
                  ? strings.blueWins
                  : strings.draw}
            </p>
            <div className="curling-modal-scores">
              <div className="curling-modal-team-score">
                <span className="curling-modal-team-name">
                  {TEAM_NAMES.red}
                </span>
                <span className="curling-modal-team-val red">
                  {world.scores.red}
                </span>
              </div>
              <div className="curling-modal-team-score">
                <span className="curling-modal-team-name">
                  {TEAM_NAMES.blue}
                </span>
                <span className="curling-modal-team-val blue">
                  {world.scores.blue}
                </span>
              </div>
            </div>
            <button
              className="curling-action-btn"
              onClick={() => dispatchAction({ type: 'restart' })}
            >
              <RotateCcw
                size={18}
                style={{ display: 'inline', marginRight: '6px' }}
              />
              {strings.playAgain}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
