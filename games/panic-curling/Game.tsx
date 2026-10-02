'use client';
/* oxlint-disable react/react-compiler -- WebGL host syncs scene controllers */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Hammer,
  RotateCcw,
  Snowflake,
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
import GameToolbar from '../../shared/ui/GameToolbar';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { panicCurlingAnalytics } from './analytics';
import { CurlingAudio } from './audio';
import { reconcileCurlingBots, updateCurlingBots } from './bots';
import { PanicCurlingScene } from './scene';
import {
  advancePanicCurling,
  freshCurlingWorld,
  newCurlingPlayer,
  PARTY_AIM_PATIENCE_S,
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
import { hudPacer } from '../../shared/ui/hud-pacer';
import {
  leadingSide,
  partyRound,
  partyVersus,
} from '../../shared/ui/party-round';
import { inPartyMode } from '../../shared/ui/party-mode';

const tracker = new GameTracker(panicCurlingAnalytics);

function holdControl(change: (held: boolean) => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      change(true);
    },
    onPointerUp: () => change(false),
    onPointerCancel: () => change(false),
    onLostPointerCapture: () => change(false),
    onBlur: () => change(false),
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        change(true);
      }
    },
    onKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        change(false);
      }
    },
  };
}

export default function PanicCurlingGame() {
  const { t } = useLanguage();
  const strings = t(PANIC_CURLING_TRANSLATIONS);
  useGameTracker(tracker);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PanicCurlingScene | null>(null);
  const audioRef = useRef<CurlingAudio | null>(null);
  const onlineWorld = useRef<PanicCurlingWorld | null>(null);
  const localWorld = useRef<PanicCurlingWorld | null>(null);
  const currentInput = useRef<PlayerInput>(idleInput());
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<PanicCurlingSnapshot>(
      ({ world: w }) =>
        `${w.phase}:${w.round}:${Object.values(w.scores).join()}`,
    ),
  );

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

  const room = usePeerRoom<PanicCurlingSnapshot>({
    game: 'panic-curling',
    loadEngine: () => import('./peer'),
    readInput: () => ({
      ...currentInput.current,
      aimAngle: aimAngleRef.current,
      power: powerRef.current,
      spin: spinRef.current,
      stoneKind: stoneKindRef.current,
      sweep: isSweepingRef.current,
      steer: steerDirRef.current,
    }),
    idleInput,
    onAttach: (next) => {
      localWorld.current = null;
      currentInput.current = idleInput();
      sessionRef.current = { ...sessionRef.current, ...next };
      hud.current.reset();
      audioRef.current?.reset();
      sceneRef.current?.setLocalPlayer(next.id);
    },
    receive: (snap) => {
      if (hud.current.due(snap)) setSnapshot(snap);
      sceneRef.current?.render(snap);

      onlineWorld.current = snap.world;
      const me = snap.world.players.find((p) => p.id === sessionRef.current.id);
      if (me) {
        setTeam(me.team);
        setRole(me.role);
        teamRef.current = me.team;
        roleRef.current = me.role;
      }
      audioRef.current?.update(snap.world, sessionRef.current.id);
    },
  });
  const { send } = room;

  const dispatchAction = useCallback(
    (act: PanicCurlingAction) => {
      tracker.action(act.type);
      audioRef.current?.unlock();

      if (send(act)) return;
      if (localWorld.current) {
        panicCurlingAction(
          localWorld.current,
          sessionRef.current.id,
          act,
          true,
        );
        if (act.type === 'switchRole' || act.type === 'switchTeam') {
          reconcileCurlingBots(localWorld.current);
        }
        audioRef.current?.update(localWorld.current, sessionRef.current.id);
        const snap = panicCurlingSnapshot(
          localWorld.current,
          'SOLO',
          sessionRef.current.id,
          sessionRef.current.id,
          Date.now(),
        );
        if (hud.current.due(snap)) setSnapshot(snap);
      }
    },
    [send],
  );

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
    // Bots never throw for you, so an idle party player would stall the end.
    if (inPartyMode()) world.aimPatience = PARTY_AIM_PATIENCE_S;
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

        audioRef.current?.update(localWorld.current, sessionRef.current.id);

        // Update reaction toast
        if (localWorld.current.events.length > 0) {
          for (const ev of localWorld.current.events) {
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
        if (hud.current.due(snap)) setSnapshot(snap);
        sceneRef.current?.render(snap);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      sceneRef.current?.dispose();
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, [dispatchAction]);

  // Power meter oscillation while aiming
  useEffect(() => {
    if (!powerOscillating) return;
    let up = true;
    const interval = setInterval(() => {
      const current = localWorld.current ?? onlineWorld.current;
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
      if (audioRef.current) audioRef.current.enabled = next;
      return next;
    });
  };

  // Keyboard shortcuts: Space to deliver or sweep, Arrow keys or A/D to aim or steer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.defaultPrevented ||
        (e.target instanceof HTMLElement &&
          e.target.closest(
            'button, input, textarea, select, [contenteditable]',
          ))
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        const current = localWorld.current ?? onlineWorld.current;
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
        const current = localWorld.current ?? onlineWorld.current;
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
        const current = localWorld.current ?? onlineWorld.current;
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
  useEffect(() => {
    const release = () => {
      setIsSweeping(false);
      isSweepingRef.current = false;
      setSteerDir(0);
      steerDirRef.current = 0;
    };
    if (!isSlidePhase) release();
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, [isSlidePhase]);
  const myPlayer = world?.players.find((p) => p.id === sessionRef.current.id);

  return (
    <div
      className="curling-container"
      {...partyRound(
        world?.phase === 'match_over',
        world
          ? partyVersus(team, leadingSide(world.scores), world.scores)
          : null,
      )}
    >
      <header className="topbar curling-topbar">
        <a href="/" className="wordmark">
          <span className="curling-mark">
            <Snowflake size={22} />
          </span>{' '}
          PANIC CURLING<span className="title-dot">.</span>
        </a>
        <GameToolbar
          multiplayer={<PeerRoomControls room={room} />}
          voice={room.voice}
          muted={!soundEnabled}
          onToggleSound={toggleSound}
          onHelp={() => {}}
        />
      </header>

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
          <fieldset
            className="curling-tactics-menu"
            disabled={world?.phase !== 'aiming' && world?.phase !== 'warmup'}
          >
            <span className="curling-tactics-section-title">
              {strings.selectTeam}
            </span>
            <div className="curling-btn-group">
              <button
                data-party-setup-action=""
                className={`curling-toggle-btn ${team === 'red' ? 'active' : ''}`}
                onClick={() => {
                  handleSwitchTeam('red');
                  setShowTactics(false);
                }}
              >
                🔴 Red Rovers
              </button>
              <button
                data-party-setup-action=""
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
          </fieldset>
        )}
      </div>

      {/* Top Alpine Tournament Scoreboard */}
      {world && (
        <div className="curling-scoreboard house-card">
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
                ROCK {Math.min(world.throwIndex + 1, world.totalThrowsPerEnd)}/
                {world.totalThrowsPerEnd}
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

      {world && (
        <div className="curling-overview house-card">
          <svg
            viewBox="0 0 64 400"
            // SVG needs its image role for an accessible, dynamic overview.
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="img"
            aria-label={strings.overviewLabel}
          >
            <rect
              x="1"
              y="1"
              width="62"
              height="398"
              rx="8"
              fill="#e5f2f5"
              stroke="#547a82"
            />
            <circle cx="32" cy="58" r="29" fill="#417aa7" />
            <circle cx="32" cy="58" r="20" fill="#fffaf0" />
            <circle cx="32" cy="58" r="11" fill="#b54939" />
            <circle cx="32" cy="58" r="4" fill="#f3c742" />
            <path
              d="M32 5V390 M2 148H62 M2 308H62"
              stroke="#8a9fa3"
              strokeWidth="1"
            />
            {world.stones
              .filter((stone) => !stone.outOfBounds)
              .map((stone) => (
                <circle
                  key={stone.id}
                  cx={32 + stone.x * 9}
                  cy={368 - stone.z * 10}
                  r={stone.id === world.activeStoneId ? 4.5 : 3.5}
                  fill={stone.team === 'red' ? '#b54939' : '#235db7'}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              ))}
          </svg>
          <span>{strings.targetLabel}</span>
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
        <div className="curling-deliver-hud house-card">
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
                {power < 0.4
                  ? strings.guardShot
                  : power < 0.55
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
      {isSlidePhase &&
        isMyTurn &&
        (role === 'sweeper' || role === 'deliverer') && (
          <div className="curling-sweeper-cockpit">
            {/* Real-time Slide Telemetry */}
            {(() => {
              const activeStone = world?.stones.find(
                (s) => s.id === world?.activeStoneId,
              );
              if (!activeStone) return null;
              const sweeper = world?.players.find(
                (p) => p.team === activeStone.team && p.role === 'sweeper',
              );
              const sweeping =
                sweeper?.status === 'sweeping' && sweeper.sweepIntensity > 0;
              return (
                <div className="curling-slide-telemetry">
                  <div className="curling-telemetry-item">
                    <span className="curling-telemetry-label">SPEED</span>
                    <span className="curling-telemetry-val">
                      {Math.hypot(activeStone.vx, activeStone.vz).toFixed(1)}{' '}
                      m/s
                    </span>
                  </div>
                  <div className="curling-telemetry-item">
                    <span className="curling-telemetry-label">TO TEE</span>
                    <span className="curling-telemetry-val">
                      {activeStone.distanceToTee.toFixed(1)} m
                    </span>
                  </div>
                  <div className="curling-telemetry-item">
                    <span className="curling-telemetry-label">
                      SWEEP STATUS
                    </span>
                    <span
                      className={`curling-telemetry-val ${sweeping ? 'is-sweeping' : 'is-idle'}`}
                    >
                      {sweeping
                        ? `🔥 SWEEPING (-${Math.round(GADGET_CONFIGS[sweeper.gadget].frictionCut * 100)}%)`
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
                {...holdControl((held) => {
                  setSteerDir(held ? -1 : 0);
                  steerDirRef.current = held ? -1 : 0;
                })}
              >
                {strings.steerLeft}
              </button>

              <button
                className={`curling-sweep-btn ${isSweeping ? 'active' : ''}`}
                {...holdControl((held) => {
                  setIsSweeping(held);
                  isSweepingRef.current = held;
                })}
              >
                <Sparkles size={24} /> {strings.sweepHarder}
              </button>

              <button
                className={`curling-steer-btn ${steerDir === 1 ? 'active' : ''}`}
                {...holdControl((held) => {
                  setSteerDir(held ? 1 : 0);
                  steerDirRef.current = held ? 1 : 0;
                })}
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
            <p className="curling-modal-note">{strings.freshIce}</p>
          </div>
        </div>
      )}

      {world?.phase === 'match_over' && (
        <div className="curling-modal-overlay">
          <div className="curling-modal-card">
            <Trophy size={56} className="curling-modal-trophy" />
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
              data-party-setup-action=""
              className="curling-action-btn"
              onClick={() => dispatchAction({ type: 'restart' })}
            >
              <RotateCcw size={18} />
              {strings.playAgain}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
