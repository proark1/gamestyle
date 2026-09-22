'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Construction, RotateCcw, Timer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import GameToolbar from '../../shared/ui/GameToolbar';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import {
  advanceCraneClash,
  craneClashAction,
  craneClashSnapshot,
  freshClashWorld,
  newPlayer,
} from './simulation';
import { reconcileClashBots } from './bots';
import {
  ROUND_MS,
  idleInput,
  timeLeft,
  type CraneClashAction,
  type CraneClashSession,
  type CraneClashSnapshot,
  type CraneClashWorld,
  type PlayerInput,
  type Role,
  type TeamId,
} from './types';
import { CraneClashSound } from './audio';
import { CraneClashScene } from './scene';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import { CRANE_CLASH_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { craneClashAnalytics, craneClashPlayState } from './analytics';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyRound, partyVersus } from '../../shared/ui/party-round';
import CraneTouchControls from './TouchControls';

const tracker = new GameTracker(craneClashAnalytics);

const formatTime = (ms: number) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function CraneClash() {
  useGameTracker(tracker);
  const { t, language } = useLanguage();
  const strings = t(CRANE_CLASH_TRANSLATIONS);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<CraneClashScene | null>(null);
  const sound = useRef<CraneClashSound | null>(null);
  const localWorld = useRef<CraneClashWorld | null>(null);
  const currentInput = useRef(idleInput());
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<CraneClashSnapshot>(
      ({ world: w }) => `${w.phase}:${w.eventId}:${w.winner}`,
    ),
  );

  const [snapshot, setSnapshot] = useState<CraneClashSnapshot | null>(null);
  const [team, setTeam] = useState<TeamId>('red');
  const [role, setRole] = useState<Role>('swinger');
  const [muted, setMuted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const sessionRef = useRef<CraneClashSession>({
    id: 'p-local',
    token: 'solo-token',
    code: 'SOLO',
    team: 'red',
    role: 'swinger',
    name: 'Bauarbeiter',
  });

  const room = usePeerRoom<CraneClashSnapshot>({
    game: 'crane-clash',
    loadEngine: () => import('./peer'),
    readInput: () => currentInput.current,
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
        setTeam(me.team);
        setRole(me.role);
        scene.current?.setLocalPlayer(me.id, me.team, me.role);
      }
    },
  });
  const { send } = room;

  const dispatchAction = useCallback(
    (act: CraneClashAction) => {
      tracker.action(act.type);
      sound.current?.unlock();
      if (send(act)) return;
      if (localWorld.current) {
        craneClashAction(localWorld.current, sessionRef.current.id, act, true);
        const snap = craneClashSnapshot(
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

    sound.current = new CraneClashSound();

    scene.current = new CraneClashScene(container.current, {
      input: (inp: PlayerInput) => {
        currentInput.current = inp;
        if (localWorld.current) {
          const p = localWorld.current.players.find(
            (pl) => pl.id === sessionRef.current.id,
          );
          if (p) {
            p.input = inp;
            p.seen = localWorld.current.clock;
          }
        }
      },
      action: (act: CraneClashAction) => {
        dispatchAction(act);
      },
    });

    const initialWorld = freshClashWorld(Date.now());
    initialWorld.players.push(
      newPlayer(
        sessionRef.current.id,
        'Bauarbeiter',
        0,
        sessionRef.current.team,
        sessionRef.current.role,
        false,
      ),
    );
    reconcileClashBots(initialWorld);

    localWorld.current = initialWorld;

    const initialSnap = craneClashSnapshot(
      initialWorld,
      'SOLO',
      sessionRef.current.id,
      sessionRef.current.id,
      1,
    );
    setSnapshot(initialSnap);

    const timer = setInterval(() => {
      if (!localWorld.current) return;
      advanceCraneClash(localWorld.current, Date.now());
      const snap = craneClashSnapshot(
        localWorld.current,
        'SOLO',
        sessionRef.current.id,
        sessionRef.current.id,
        Date.now(),
      );
      if (hud.current.due(snap)) setSnapshot(snap);
      scene.current?.render(snap);
      sound.current?.update(snap.world, sessionRef.current.id);
    }, 16);

    return () => {
      clearInterval(timer);
      scene.current?.destroy();
      scene.current = null;
      sound.current?.reset();
      sound.current = null;
    };
  }, [dispatchAction]);

  // Report analytics state
  useEffect(() => {
    if (snapshot) {
      tracker.observe(craneClashPlayState(snapshot, sessionRef.current));
    }
  }, [snapshot]);

  // Update scene when team/role changes
  useEffect(() => {
    sessionRef.current.team = team;
    sessionRef.current.role = role;
    scene.current?.setLocalPlayer(sessionRef.current.id, team, role);
  }, [team, role]);

  const world = snapshot?.world;
  const isPlaying = world?.phase === 'playing';
  const isEnded = world?.phase === 'ended';
  const humansOnMyTeam =
    world?.players.filter((p) => !p.bot && p.team === team).length ?? 1;
  const isSolo = humansOnMyTeam <= 1;

  const redScore = world?.scores.red.height ?? 0;
  const blueScore = world?.scores.blue.height ?? 0;
  const msLeft = world ? timeLeft(world) : ROUND_MS;

  const handleStart = () => {
    dispatchAction({ type: 'start' });
  };

  const handleRestart = () => {
    dispatchAction({ type: 'restart' });
    dispatchAction({ type: 'start' });
  };

  const handleTeamChange = (newTeam: TeamId) => {
    setTeam(newTeam);
    dispatchAction({ type: 'switchTeam', team: newTeam });
  };

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    dispatchAction({ type: 'switchRole', role: newRole });
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    if (sound.current) {
      sound.current.unlock();
      sound.current.enabled = !next;
    }
  };

  // One list feeds the hint bar and the help dialog, so they never disagree.
  const hints: { keys: string[]; label: string }[] = isSolo
    ? [
        { keys: ['WASD'], label: strings.hintSwing },
        { keys: [strings.keyArrows], label: strings.hintCraneRotate },
        { keys: ['Q', 'Z'], label: strings.hintHoist },
        { keys: ['Space', 'E'], label: strings.hintGrabRelease },
        { keys: ['Tab'], label: strings.hintSwapKeys },
        { keys: ['V'], label: strings.hintCamera },
      ]
    : role === 'swinger'
      ? [
          { keys: [strings.keyWasdArrows], label: strings.hintSwingMomentum },
          { keys: ['Space', 'E'], label: strings.hintGrabTossCrate },
          { keys: ['V'], label: strings.hintCamera },
        ]
      : [
          { keys: [strings.keyWasdArrows], label: strings.hintCraneControl },
          { keys: ['Q', 'Z'], label: strings.hintWinch },
          { keys: ['V'], label: strings.hintCamera },
        ];
  const hintKeys = (keys: string[]) =>
    keys.map((key, index) => (
      <Fragment key={key}>
        {index > 0 && ' / '}
        <span className="cc-hint-key house-key">{key}</span>
      </Fragment>
    ));

  return (
    <main
      className="cc-game"
      {...partyRound(isEnded, partyVersus(team, world?.winner))}
    >
      <div ref={container} className="cc-canvas" />
      <header className="topbar">
        <a href="/" className="wordmark">
          <span className="cc-mark">
            <Construction size={22} />
          </span>{' '}
          CRANE CLASH<span className="title-dot">.</span>
        </a>
        <GameToolbar
          multiplayer={<PeerRoomControls room={room} />}
          voice={room.voice}
          muted={muted}
          onToggleSound={toggleSound}
          onHelp={() => setHelpOpen(true)}
        />
      </header>

      {/* Top HUD with Scores & Timer */}
      <div className="cc-hud">
        <div className="cc-team-score red house-card">
          <div className="cc-score-val">{redScore.toFixed(1)}m</div>
          <div className="cc-score-meta">
            <span>{strings.teamRed}</span>
            <span>
              {world?.scores.red.crates || 0} {strings.crates}
            </span>
          </div>
        </div>

        <div className="cc-timer-badge house-card">
          <Timer size={18} />
          <span>{formatTime(msLeft)}</span>
        </div>

        <div className="cc-team-score blue house-card">
          <div className="cc-score-meta" style={{ textAlign: 'right' }}>
            <span>{strings.teamBlue}</span>
            <span>
              {world?.scores.blue.crates || 0} {strings.crates}
            </span>
          </div>
          <div className="cc-score-val">{blueScore.toFixed(1)}m</div>
        </div>
      </div>

      {/* Lobby / Team Choice Overlay */}
      {!isPlaying && !isEnded && (
        <div className="cc-welcome setup-card">
          <p className="cc-tagline house-label">
            <span className="tiny-line" /> {strings.tagline}
          </p>
          <h1>
            Crane <span>Clash.</span>
          </h1>
          <p className="cc-desc">{strings.desc}</p>

          <div className="cc-role-selector">
            <span className="cc-choice-label house-label">
              {strings.yourTeam}
            </span>
            <div className="cc-role-row">
              <button
                type="button"
                className={`cc-btn red ${team === 'red' ? 'active' : ''}`}
                onClick={() => handleTeamChange('red')}
              >
                {strings.teamRed}
              </button>
              <button
                type="button"
                className={`cc-btn blue ${team === 'blue' ? 'active' : ''}`}
                onClick={() => handleTeamChange('blue')}
              >
                {strings.teamBlue}
              </button>
            </div>

            <span
              className="cc-choice-label house-label"
              style={{
                color: isSolo ? `var(--team-${team}-deep)` : undefined,
                marginTop: 4,
              }}
            >
              {isSolo ? strings.soloPrompt : strings.yourRole}
            </span>
            <div className="cc-role-row">
              <button
                type="button"
                className={`cc-btn ${role === 'swinger' ? 'active' : ''}`}
                onClick={() => handleRoleChange('swinger')}
              >
                {isSolo ? strings.swingerSolo : strings.swingerRole}
              </button>
              <button
                type="button"
                className={`cc-btn ${role === 'operator' ? 'active' : ''}`}
                onClick={() => handleRoleChange('operator')}
              >
                {isSolo ? strings.operatorSolo : strings.operatorRole}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="cc-btn primary primary-button"
            onClick={handleStart}
          >
            {strings.startMatch} <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Match Ended Announcement */}
      {isEnded && (
        <div className="cc-ended-banner">
          <h2>{strings.matchOver}</h2>
          <div className={`cc-ended-winner ${world?.winner || ''}`}>
            {world?.winner === 'red'
              ? strings.redWins
              : world?.winner === 'blue'
                ? strings.blueWins
                : strings.draw}
          </div>
          <p className="cc-ended-scores">
            {strings.red}: {redScore.toFixed(1)}m | {strings.blue}:{' '}
            {blueScore.toFixed(1)}m
          </p>
          <button
            type="button"
            className="cc-btn primary primary-button"
            onClick={handleRestart}
          >
            <RotateCcw size={18} /> {strings.playAgain}
          </button>
        </div>
      )}

      {isPlaying && (
        <CraneTouchControls
          solo={isSolo}
          role={role}
          de={language === 'de'}
          disabled={helpOpen || room.open}
          move={(nextRole, vector) =>
            scene.current?.setTouchMove(nextRole, vector)
          }
          hoist={(direction) => scene.current?.setTouchHoist(direction)}
          grab={() => dispatchAction({ type: 'grab' })}
        />
      )}
      {/* Controls Bar at bottom */}
      <div className="cc-hint-bar">
        {hints.map((hint) => (
          <span key={hint.label}>
            {hintKeys(hint.keys)} {hint.label}
          </span>
        ))}
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="game-dialog">
          <DialogTitle>Crane Clash</DialogTitle>
          <DialogDescription>{strings.desc}</DialogDescription>
          <ul className="cc-help">
            {hints.map((hint) => (
              <li key={hint.label}>
                <span>{hintKeys(hint.keys)}</span> {hint.label}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </main>
  );
}
