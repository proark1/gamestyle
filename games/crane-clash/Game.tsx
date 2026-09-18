'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Timer } from 'lucide-react';
import type { PeerGameConnection } from '../../shared/peer/connection';
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
import LanguageSwitcher from '../../shared/language/LanguageSwitcher';
import { CRANE_CLASH_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { craneClashAnalytics, craneClashPlayState } from './analytics';
import { hudPacer } from '../../shared/ui/hud-pacer';

const tracker = new GameTracker(craneClashAnalytics);

const formatTime = (ms: number) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function CraneClash() {
  useGameTracker(tracker);
  const { t } = useLanguage();
  const strings = t(CRANE_CLASH_TRANSLATIONS);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<CraneClashScene | null>(null);
  const sound = useRef<CraneClashSound | null>(null);
  const network = useRef<PeerGameConnection<CraneClashSnapshot> | null>(null);
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

  const sessionRef = useRef<CraneClashSession>({
    id: 'p-local',
    token: 'solo-token',
    code: 'SOLO',
    team: 'red',
    role: 'swinger',
    name: 'Bauarbeiter',
  });

  const dispatchAction = useCallback((act: CraneClashAction) => {
    tracker.action(act.type);
    sound.current?.unlock();
    if (network.current) {
      void network.current.action(act);
    } else if (localWorld.current) {
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
  }, []);

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
      network.current?.stop();
      network.current = null;
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

  return (
    <main className="cc-game">
      <div ref={container} className="cc-canvas" />
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 20 }}>
        <LanguageSwitcher variant="header" />
      </div>

      {/* Top HUD with Scores & Timer */}
      <div className="cc-hud">
        <div className="cc-team-score red">
          <div className="cc-score-val">{redScore.toFixed(1)}m</div>
          <div className="cc-score-meta">
            <span>{strings.teamRed}</span>
            <span>
              {world?.scores.red.crates || 0} {strings.crates}
            </span>
          </div>
        </div>

        <div className="cc-timer-badge">
          <Timer size={18} />
          <span>{formatTime(msLeft)}</span>
        </div>

        <div className="cc-team-score blue">
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
        <div className="cc-welcome">
          <h1>
            Crane <span>Clash</span>.
          </h1>
          <div className="cc-tagline">{strings.tagline}</div>
          <p className="cc-desc">{strings.desc}</p>

          <div className="cc-role-selector">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#777',
              }}
            >
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
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: isSolo ? `var(--team-${team}-deep)` : '#777',
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
            className="cc-btn primary"
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
          <p style={{ margin: '0 0 20px', color: '#666' }}>
            {strings.red}: {redScore.toFixed(1)}m | {strings.blue}:{' '}
            {blueScore.toFixed(1)}m
          </p>
          <button
            type="button"
            className="cc-btn primary"
            onClick={handleRestart}
          >
            <RotateCcw size={18} /> {strings.playAgain}
          </button>
        </div>
      )}

      {/* Controls Bar at bottom */}
      <div className="cc-hint-bar">
        {isSolo ? (
          <>
            <span>
              <span className="cc-hint-key">WASD</span> {strings.hintSwing}
            </span>
            <span>
              <span className="cc-hint-key">{strings.keyArrows}</span>{' '}
              {strings.hintCraneRotate}
            </span>
            <span>
              <span className="cc-hint-key">Q</span> /{' '}
              <span className="cc-hint-key">Z</span> {strings.hintHoist}
            </span>
            <span>
              <span className="cc-hint-key">Space</span> /{' '}
              <span className="cc-hint-key">E</span> {strings.hintGrabRelease}
            </span>
            <span>
              <span className="cc-hint-key">Tab</span> {strings.hintSwapKeys}
            </span>
            <span>
              <span className="cc-hint-key">V</span> {strings.hintCamera}
            </span>
          </>
        ) : role === 'swinger' ? (
          <>
            <span>
              <span className="cc-hint-key">{strings.keyWasdArrows}</span>{' '}
              {strings.hintSwingMomentum}
            </span>
            <span>
              <span className="cc-hint-key">Space / E</span>{' '}
              {strings.hintGrabTossCrate}
            </span>
            <span>
              <span className="cc-hint-key">V</span> {strings.hintCamera}
            </span>
          </>
        ) : (
          <>
            <span>
              <span className="cc-hint-key">{strings.keyWasdArrows}</span>{' '}
              {strings.hintCraneControl}
            </span>
            <span>
              <span className="cc-hint-key">Q / Z</span> {strings.hintWinch}
            </span>
            <span>
              <span className="cc-hint-key">V</span> {strings.hintCamera}
            </span>
          </>
        )}
      </div>
    </main>
  );
}
