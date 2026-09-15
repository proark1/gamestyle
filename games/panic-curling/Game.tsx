'use client';
/* oxlint-disable react/react-compiler -- WebGL host syncs scene controllers */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Flame,
  RotateCcw,
  Sparkles,
  Trophy,
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
  STONE_CONFIGS,
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

const tracker = new GameTracker(panicCurlingAnalytics);

export default function PanicCurlingGame() {
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

        // Play events audio
        if (audioRef.current && soundEnabledRef.current) {
          for (const ev of localWorld.current.events) {
            audioRef.current.playEvent(ev);
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

  const handleLaunch = () => {
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
  };

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

  const world = snapshot?.world;
  const isMyTurn = world?.turnTeam === team;
  const isDeliverPhase =
    world?.phase === 'aiming' && role === 'deliverer' && isMyTurn;
  const isSlidePhase = world?.phase === 'sliding';
  const hasStressedIce = world?.iceTiles.some((t) => t.cracked || t.broken);
  const myPlayer = world?.players.find((p) => p.id === sessionRef.current.id);

  return (
    <div className="curling-container">
      <GameToolbar
        muted={!soundEnabled}
        onToggleSound={toggleSound}
        onHelp={() => {}}
      />

      <div ref={containerRef} className="curling-viewport" />

      {/* Top Scoreboard */}
      {world && (
        <div className="curling-scoreboard">
          <div className="curling-team-score">
            <span className="curling-team-badge red" />
            <span className="curling-team-name">{TEAM_NAMES.red}</span>
            <span className="curling-team-points">{world.scores.red}</span>
          </div>

          <div className="curling-round-info">
            <span className="curling-round-title">
              End {world.round} of {world.maxRounds}
            </span>
            <span className="curling-round-turn">
              {world.turnTeam === 'red' ? '🔴 RED THROW' : '🔵 BLUE THROW'}
            </span>
          </div>

          <div className="curling-team-score">
            <span className="curling-team-points">{world.scores.blue}</span>
            <span className="curling-team-name">{TEAM_NAMES.blue}</span>
            <span className="curling-team-badge blue" />
          </div>
        </div>
      )}

      {/* Thin Ice Hazard Warning Alert */}
      {hasStressedIce && (
        <div className="curling-ice-warning">
          ⚠️ DANGER: THIN ICE IS CRACKING! DON&apos;T BUNCH UP!
        </div>
      )}

      {/* Waiting Indicator during Opponent Turn */}
      {world?.phase === 'aiming' && !isMyTurn && (
        <div className="curling-waiting-banner">
          ⏳ Opponent is lining up their throw...
        </div>
      )}

      {/* Deliverer Aim & Power Controls */}
      {isDeliverPhase && (
        <div className="curling-deliver-hud">
          <div className="curling-hud-row">
            <div className="curling-btn-group">
              {(['granite', 'anvil', 'basket'] as StoneKind[]).map((k) => (
                <button
                  key={k}
                  className={`curling-toggle-btn ${stoneKind === k ? 'active' : ''}`}
                  onClick={() => {
                    setStoneKind(k);
                    stoneKindRef.current = k;
                    dispatchAction({ type: 'switchStone', kind: k });
                  }}
                >
                  {STONE_CONFIGS[k].name}
                </button>
              ))}
            </div>

            <div className="curling-btn-group">
              <button
                className={`curling-toggle-btn ${spin < 0 ? 'active' : ''}`}
                onClick={() => {
                  setSpin(-1);
                  spinRef.current = -1;
                }}
              >
                ⟲ Curl Left
              </button>
              <button
                className={`curling-toggle-btn ${spin > 0 ? 'active' : ''}`}
                onClick={() => {
                  setSpin(1);
                  spinRef.current = 1;
                }}
              >
                ⟳ Curl Right
              </button>
            </div>
          </div>

          <div className="curling-power-meter">
            <div className="curling-power-label">
              <span>Launch Power: {Math.round(power * 100)}%</span>
              <span>Aim Angle: {(aimAngle * 57.3).toFixed(1)}°</span>
            </div>
            <div className="curling-power-bar-bg">
              <div
                className="curling-power-bar-fill"
                style={{ width: `${power * 100}%` }}
              />
            </div>
          </div>

          <div className="curling-hud-row">
            <button
              className="curling-toggle-btn"
              onClick={() =>
                setAimAngle((a) => {
                  const next = Math.max(-0.35, a - 0.05);
                  aimAngleRef.current = next;
                  return next;
                })
              }
            >
              ◀ Aim Left
            </button>
            <button
              className="curling-toggle-btn"
              onClick={() => {
                setAimAngle(0);
                aimAngleRef.current = 0;
              }}
            >
              Center
            </button>
            <button
              className="curling-toggle-btn"
              onClick={() =>
                setAimAngle((a) => {
                  const next = Math.min(0.35, a + 0.05);
                  aimAngleRef.current = next;
                  return next;
                })
              }
            >
              Aim Right ▶
            </button>
          </div>

          <button className="curling-launch-btn" onClick={handleLaunch}>
            DELIVER STONE! 🚀
          </button>
        </div>
      )}

      {/* Sweeper Controls (Available to sweepers and the throwing team during slide) */}
      {isSlidePhase && (role === 'sweeper' || isMyTurn) && (
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
            ⇦ Steer Left
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
            <Sparkles size={24} /> SWEEP! HARDER!
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
            Steer Right ⇨
          </button>
        </div>
      )}

      {/* Gadget Switcher Bar */}
      {(role === 'sweeper' || (isSlidePhase && isMyTurn)) && (
        <div
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            zIndex: 25,
          }}
        >
          {(['broom', 'hairdryer', 'blowtorch'] as GadgetId[]).map((g) => (
            <button
              key={g}
              className={`curling-toggle-btn ${activeGadget === g ? 'active' : ''}`}
              style={{ background: 'rgba(18, 38, 52, 0.88)' }}
              onClick={() => {
                setActiveGadget(g);
                activeGadgetRef.current = g;
                dispatchAction({ type: 'switchGadget', gadget: g });
              }}
            >
              {g === 'broom' && <Wind size={15} />}
              {g === 'hairdryer' && <Zap size={15} />}
              {g === 'blowtorch' && <Flame size={15} />}
              {' ' + GADGET_CONFIGS[g].name}
            </button>
          ))}
        </div>
      )}

      {/* Banana Sabotage Button */}
      {myPlayer && myPlayer.bananasLeft > 0 && (
        <button className="curling-banana-btn" onClick={handleTossBanana}>
          🍌 Toss Banana ({myPlayer.bananasLeft} left)
        </button>
      )}

      {/* Role & Team Switcher Bar */}
      <div
        style={{
          position: 'absolute',
          top: '76px',
          left: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 22,
        }}
      >
        <div
          className="curling-btn-group"
          style={{ background: 'rgba(18, 38, 52, 0.85)' }}
        >
          <button
            className={`curling-toggle-btn ${team === 'red' ? 'active' : ''}`}
            onClick={() => handleSwitchTeam('red')}
          >
            Red Team
          </button>
          <button
            className={`curling-toggle-btn ${team === 'blue' ? 'active' : ''}`}
            onClick={() => handleSwitchTeam('blue')}
          >
            Blue Team
          </button>
        </div>

        <div
          className="curling-btn-group"
          style={{ background: 'rgba(18, 38, 52, 0.85)' }}
        >
          <button
            className={`curling-toggle-btn ${role === 'deliverer' ? 'active' : ''}`}
            onClick={() => handleSwitchRole('deliverer')}
          >
            Deliverer
          </button>
          <button
            className={`curling-toggle-btn ${role === 'sweeper' ? 'active' : ''}`}
            onClick={() => handleSwitchRole('sweeper')}
          >
            Sweeper
          </button>
          <button
            className={`curling-toggle-btn ${role === 'defender' ? 'active' : ''}`}
            onClick={() => handleSwitchRole('defender')}
          >
            Defender
          </button>
        </div>
      </div>

      {/* End of End or Match Over Dialog */}
      {world?.phase === 'end_summary' && (
        <div className="curling-modal-overlay">
          <div className="curling-modal-card">
            <h2 className="curling-modal-title">END {world.round} COMPLETE!</h2>
            <p className="curling-modal-desc">
              The stones have settled in the House. Here are the round scores:
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
            <p style={{ color: '#8ed6ff', fontWeight: 700 }}>
              Preparing next end on fresh ice...
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
            <h2 className="curling-modal-title">MATCH FINISHED!</h2>
            <p className="curling-modal-desc">
              {world.scores.red > world.scores.blue
                ? '🏆 RED ROVERS WIN THE TOURNAMENT!'
                : world.scores.blue > world.scores.red
                  ? '🏆 BLUE BLAZERS WIN THE TOURNAMENT!'
                  : '🤝 IT’S A FROZEN DRAW!'}
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
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
