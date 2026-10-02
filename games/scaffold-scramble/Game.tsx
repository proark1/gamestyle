'use client';
/* oxlint-disable react/react-compiler */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import GameToolbar from '../../shared/ui/GameToolbar';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
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
import { combineInput, type TouchControl } from './controls';
import { scaffoldHint } from './guidance';
import { SCAFFOLD_UI } from './ui-copy';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyGoal, partyRound } from '../../shared/ui/party-round';

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
  const copy = t(SCAFFOLD_UI);
  useGameTracker(tracker);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ScaffoldScene | null>(null);
  const sound = useRef<ScaffoldScrambleSound | null>(null);
  const localWorld = useRef<ScaffoldScrambleWorld | null>(null);
  const currentInput = useRef(idleInput());
  const touchPointers = useRef(new Map<number, TouchControl>());
  const helpRef = useRef(false);
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<ScaffoldSnapshot>(({ world: w }) => `${w.phase}:${w.winner}`),
  );

  const [snapshot, setSnapshot] = useState<ScaffoldSnapshot | null>(null);
  const [role, setRole] = useState<Role>('cleaner');
  const [muted, setMuted] = useState(false);
  const [help, setHelp] = useState(false);

  const sessionRef = useRef<ScaffoldSession>({
    id: 'cleaner-local',
    token: 'solo-token',
    code: 'SOLO',
    name: 'Window Cleaner',
    role: 'cleaner',
    color: 0,
  });

  const room = usePeerRoom<ScaffoldSnapshot>({
    game: 'scaffold-scramble',
    loadEngine: () => import('./peer'),
    readInput: () =>
      combineInput(
        currentInput.current,
        touchPointers.current.values(),
        snapshot?.world.phase === 'playing' && !helpRef.current,
      ),
    idleInput,
    onAttach: (next) => {
      localWorld.current = null;
      currentInput.current = idleInput();
      sessionRef.current = { ...sessionRef.current, ...next };
      hud.current.reset();
    },
    receive: (snap) => {
      if (hud.current.due(snap)) setSnapshot(snap);
      scene.current?.render(snap);
      sound.current?.update(snap.world, sessionRef.current.id);
      const me = snap.world.players.find((p) => p.id === sessionRef.current.id);
      if (me) {
        setRole(me.role);
        sessionRef.current.role = me.role;
        scene.current?.setLocalPlayer(me.id, me.role);
      }
    },
  });
  const { send, active } = room;

  const dispatchAction = useCallback(
    (act: ScaffoldAction) => {
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

      if (send(act)) return;
      if (localWorld.current) {
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
    },
    [send],
  );

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
            p.input = combineInput(
              inp,
              touchPointers.current.values(),
              localWorld.current.phase === 'playing' && !helpRef.current,
            );
            p.seen = localWorld.current.clock;
          }
        }
      },
      action: dispatchAction,
    });

    const clearHeld = () => {
      touchPointers.current.clear();
      currentInput.current = idleInput();
    };
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', clearHeld);
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

      if (!active.current && localWorld.current) {
        const timeNow = Date.now();

        const me = localWorld.current.players.find(
          (p) => p.id === sessionRef.current.id,
        );
        if (me)
          me.input = combineInput(
            currentInput.current,
            touchPointers.current.values(),
            localWorld.current.phase === 'playing' && !helpRef.current,
          );

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
      window.removeEventListener('blur', clearHeld);
      document.removeEventListener('visibilitychange', clearHeld);
      sound.current?.dispose();
      scene.current?.destroy();
    };
  }, [dispatchAction, active]);

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

  const hint = world && localPlayer ? scaffoldHint(world, localPlayer) : 'move';
  const roleDescription = {
    'left-winch': copy.left,
    'right-winch': copy.right,
    cleaner: copy.cleaner,
    'all-rounder': copy.all,
  }[role];
  const setHelpOpen = (open: boolean) => {
    helpRef.current = open;
    touchPointers.current.clear();
    currentInput.current = idleInput();
    scene.current?.setControlsEnabled(!open && isPlaying);
    setHelp(open);
  };
  useEffect(() => {
    scene.current?.setControlsEnabled(isPlaying && !help);
    touchPointers.current.clear();
    currentInput.current = idleInput();
  }, [isPlaying, help]);

  const heldControl = (control: TouchControl) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      touchPointers.current.set(event.pointerId, control);
      sound.current?.unlock();
      triggerHaptic(15);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      touchPointers.current.delete(event.pointerId);
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => {
      touchPointers.current.delete(event.pointerId);
    },
    onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => {
      touchPointers.current.delete(event.pointerId);
    },
  });

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

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    if (sound.current) {
      sound.current.unlock();
      sound.current.setMuted(next);
    }
  };

  // One list feeds the keyboard bar and the help dialog.
  const keyHints = [
    ['A/D', strings.hintMove],
    ['Q/Z', strings.hintWinchLeft],
    ['E/R', strings.hintWinchRight],
    ['Space', strings.hintAction],
    ['T', strings.hintSwitchTool],
  ] as const;

  return (
    <main
      className={`sc-game sc-${world?.phase ?? 'lobby'}`}
      {...partyRound(
        isEnded,
        world
          ? world.winner === 'crew'
            ? // The clock runs on after the whistle; the ribbon keeps the
              // first ended frame, where it still reads the finishing time.
              partyGoal(true, Math.max(0, world.endsAt - world.clock) / 1000)
            : partyGoal(false, world.cleanedCount)
          : null,
      )}
    >
      <div ref={container} className="sc-canvas" />

      <header className="topbar sc-topbar">
        <a href="/" className="wordmark">
          <span className="sc-mark">
            <Building2 size={22} />
          </span>{' '}
          SCAFFOLD SCRAMBLE<span className="title-dot">.</span>
        </a>
        <GameToolbar
          multiplayer={<PeerRoomControls room={room} />}
          voice={room.voice}
          muted={muted}
          onToggleSound={toggleSound}
          onHelp={() => setHelpOpen(true)}
          voiceHint="Use your group call to talk with friends. In-game voice is not available in Scaffold Scramble yet."
        />
      </header>

      {isPlaying && (
        <div className="sc-hud-stack">
          {/* Top HUD Telemetry */}
          <div className="sc-hud">
            {/* Floor Altitude Ticker */}
            <div className="sc-hud-badge altitude">
              <Building2 size={22} />
              <div>
                <div className="sc-score-val flex items-center gap-1">
                  <span>{currentStory}</span>
                  <span className="sc-score-sub">/ 80</span>
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
                    className={
                      absTilt >= TILT_SLIP_DEG
                        ? 'sc-tilt-icon sc-pulse-icon'
                        : 'sc-tilt-icon'
                    }
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
            <div
              className={`sc-hud-badge wind ${windActive ? 'wind-gust' : ''}`}
            >
              <Wind
                size={22}
                style={{
                  transform: `scaleX(${windStrength >= 0 ? 1 : -1})`,
                  transition: 'transform 0.3s',
                }}
              />
              <div>
                <div className="sc-score-val">
                  {windKnots} <span className="sc-unit">kt</span>
                </div>
                <div className="sc-hud-meta">
                  {windActive ? strings.windGust : strings.windCalm}
                </div>
              </div>
            </div>

            {/* Windows Cleaned Badge */}
            <div className="sc-hud-badge cleaned">
              <Sparkles size={22} />
              <div>
                <div className="sc-score-val">
                  <span key={world?.cleanedCount} className="sc-clean-count">
                    {world?.cleanedCount ?? 0}
                  </span>
                  <span className="sc-score-sub"> / 30</span>
                </div>
                <div className="sc-hud-meta">{strings.hudCleaned}</div>
                <progress
                  className="sc-clean-progress"
                  max={30}
                  value={world?.cleanedCount ?? 0}
                  aria-label={strings.hudCleaned}
                />
              </div>
            </div>

            {/* Shift deadline */}
            <div
              className={`sc-hud-badge deadline ${msLeft <= 30000 ? 'urgent' : ''}`}
            >
              <Timer size={22} />
              <div>
                <div className="sc-timer-val">{formatTime(msLeft)}</div>
                <div className="sc-hud-meta">{copy.timeRemaining}</div>
              </div>
            </div>
          </div>

          {/* Active Tool Badge */}
          {isPlaying && (
            <button
              type="button"
              className="sc-tool-badge"
              onClick={handleSwitchTool}
              title={copy.swap}
            >
              <span>
                {activeTool === 'sponge'
                  ? strings.activeToolSponge
                  : strings.activeToolSqueegee}
              </span>
              <span className="sc-tool-key house-key">T</span>
            </button>
          )}
          <output
            className={`sc-guidance ${hint === 'balance' || hint === 'climb' ? 'warning' : ''}`}
          >
            {copy[hint]}
          </output>
          {(world?.cleanedCount ?? 0) > 0 && (
            <output
              className="sc-clean-feedback"
              key={`${world?.started}-${world?.cleanedCount}`}
            >
              <Sparkles size={16} />
              {copy.cleaned} <strong>{world?.cleanedCount} / 30</strong>
            </output>
          )}
        </div>
      )}

      {/* Welcome / Role Select Overlay */}
      {!isPlaying && !isEnded && (
        <div className="sc-welcome">
          <h1>
            {strings.titleMain}
            <span>{strings.titleHighlight}</span>.
          </h1>
          <div className="sc-tagline">{copy.brief}</div>
          <p className="sc-desc">{copy.intro}</p>
          <div className="sc-shift-facts">
            <span>
              <strong>30</strong>
              {copy.goal}
            </span>
            <span>
              <strong>2:30</strong>
              {copy.duration}
            </span>
            <span>
              <strong>3</strong>
              {copy.bots}
            </span>
          </div>
          <ol className="sc-cleaning-steps">
            {copy.steps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <div className="sc-role-selector">
            <span className="sc-role-title">{copy.crew}</span>
            <div className="sc-role-grid">
              <button
                type="button"
                className={`sc-btn ${role === 'left-winch' ? 'active' : ''}`}
                aria-pressed={role === 'left-winch'}
                onClick={() => handleRoleChange('left-winch')}
              >
                {strings.roleLeftWinch}
              </button>
              <button
                type="button"
                className={`sc-btn ${role === 'right-winch' ? 'active' : ''}`}
                aria-pressed={role === 'right-winch'}
                onClick={() => handleRoleChange('right-winch')}
              >
                {strings.roleRightWinch}
              </button>
              <button
                type="button"
                className={`sc-btn ${role === 'cleaner' ? 'active' : ''}`}
                aria-pressed={role === 'cleaner'}
                onClick={() => handleRoleChange('cleaner')}
              >
                {strings.roleCleaner}
              </button>
              <button
                type="button"
                className={`sc-btn ${role === 'all-rounder' ? 'active' : ''}`}
                aria-pressed={role === 'all-rounder'}
                onClick={() => handleRoleChange('all-rounder')}
              >
                {strings.roleAllRounder}
              </button>
            </div>
          </div>

          <p className="sc-role-description" aria-live="polite">
            {roleDescription}
          </p>
          <button
            type="button"
            className="sc-btn primary primary-button"
            onClick={handleStart}
          >
            {copy.start} <ArrowRight size={18} />
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
          <div className="sc-result-stats">
            <span>
              <strong>
                {world?.cleanedCount ?? 0}
                <small> / 30</small>
              </strong>
              {copy.crewTotal}
            </span>
            <span>
              <strong>{localPlayer?.windowsCleaned ?? 0}</strong>
              {copy.personal}
            </span>
            <span>
              <strong>{localPlayer?.slips ?? 0}</strong>
              {copy.slips}
            </span>
          </div>
          {world?.winner !== 'crew' && (
            <p className="sc-retry-tip">{copy.retryTip}</p>
          )}
          <button
            data-party-setup-action=""
            type="button"
            className="sc-btn primary primary-button"
            onClick={handleRestart}
          >
            <RotateCcw size={18} /> {strings.playAgain}
          </button>
        </div>
      )}

      {/* Bottom Keyboard Controls Hint Bar */}
      {isPlaying && (
        <div className="sc-hint-bar tool-dock">
          {keyHints.map(([key, label]) => (
            <span key={key}>
              <span className="sc-hint-key house-key">{key}</span> {label}
            </span>
          ))}
        </div>
      )}

      <Dialog open={help} onOpenChange={setHelpOpen}>
        <DialogContent className="game-dialog">
          <DialogTitle>
            {strings.titleMain}
            {strings.titleHighlight}
          </DialogTitle>
          <DialogDescription>{strings.desc}</DialogDescription>
          <ul className="sc-help">
            {keyHints.map(([key, label]) => (
              <li key={key}>
                <span className="house-key">{key}</span> {label}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {isPlaying && !help && (
        <div className="sc-mobile-controls">
          <div className="sc-touch-group">
            <div className="sc-touch-row">
              <button
                type="button"
                className="sc-touch-btn"
                aria-label={copy.leftUp}
                {...heldControl('crankLeftUp')}
              >
                L ▲
              </button>
              <button
                type="button"
                className="sc-touch-btn"
                aria-label={copy.leftDown}
                {...heldControl('crankLeftDown')}
              >
                L ▼
              </button>
            </div>
            <div className="sc-touch-row">
              <button
                type="button"
                className="sc-touch-btn"
                aria-label={copy.moveLeft}
                {...heldControl('left')}
              >
                ◀
              </button>
              <button
                type="button"
                className="sc-touch-btn"
                aria-label={copy.moveRight}
                {...heldControl('right')}
              >
                ▶
              </button>
            </div>
          </div>
          <div className="sc-touch-group">
            <div className="sc-touch-row">
              <button
                type="button"
                className="sc-touch-btn"
                aria-label={copy.rightUp}
                {...heldControl('crankRightUp')}
              >
                R ▲
              </button>
              <button
                type="button"
                className="sc-touch-btn"
                aria-label={copy.rightDown}
                {...heldControl('crankRightDown')}
              >
                R ▼
              </button>
            </div>
            <div className="sc-touch-row">
              <button
                type="button"
                className="sc-touch-btn wide sc-touch-action"
                {...heldControl('action')}
              >
                {hint === 'climb' ? copy.climbAction : copy.action}
              </button>
              <button
                type="button"
                className="sc-touch-btn"
                onClick={handleSwitchTool}
                aria-label={copy.swap}
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
