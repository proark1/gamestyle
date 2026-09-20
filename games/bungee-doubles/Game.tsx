'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Flame,
  Link2,
  RotateCcw,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { Dialog } from '@base-ui/react/dialog';
import { TouchControls } from '../../shared/input/TouchControls';
import { gameActive } from '../../shared/browser/game-lifecycle';
import { createBungeeRunner } from './runner';
import {
  prepareServe,
  bungeeAction,
  bungeeSnapshot,
  freshBungeeWorld,
  newPlayer,
} from './simulation';
import { reconcileBungeeBots } from './bots';
import {
  type BungeeAction,
  type BungeeSession,
  type BungeeSnapshot,
  type BungeeWorld,
  type PlayerInput,
} from './types';
import { BungeeDoublesSound } from './audio';
import { BungeeScene } from './scene';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import GameToolbar from '../../shared/ui/GameToolbar';
import { inPartyMode } from '../../shared/ui/party-mode';
import { BUNGEE_DOUBLES_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { bungeeDoublesAnalytics } from './analytics';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyRound, partyVersus } from '../../shared/ui/party-round';

const tracker = new GameTracker(bungeeDoublesAnalytics);

export default function BungeeDoublesGame() {
  const { t } = useLanguage();
  const strings = t(BUNGEE_DOUBLES_TRANSLATIONS);
  useGameTracker(tracker);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<BungeeScene | null>(null);
  const sound = useRef<BungeeDoublesSound | null>(null);
  const localWorld = useRef<BungeeWorld | null>(null);
  // The scene is handed every snapshot directly; the HUD is paced, so a
  // 20Hz feed does not rebuild it twenty times a second.
  const hud = useRef(
    hudPacer<BungeeSnapshot>(
      ({ world: w }) =>
        `${w.phase}:${w.eventId}:${w.scores.red}:${w.scores.blue}`,
    ),
  );

  const [snapshot, setSnapshot] = useState<BungeeSnapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const paused = useRef(false);

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
    if (paused.current) return;
    if (localWorld.current) {
      bungeeAction(
        localWorld.current,
        sessionRef.current.id,
        act,
        localWorld.current.clock,
      );
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
    prepareServe(w, 'red');
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

    // You are red's named server, so an idle party player would hold the
    // match at the serve forever. A party round serves after five seconds.
    const run = createBungeeRunner(inPartyMode() ? 5000 : undefined);

    // Solo game simulation loop (60 FPS)
    let lastTick = performance.now();
    let animId = 0;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      if (!localWorld.current) return;

      const currentTime = performance.now();
      const dt = Math.min((currentTime - lastTick) / 1000, 0.1);
      lastTick = currentTime;

      if (paused.current || !gameActive()) return;
      const world = localWorld.current;
      const stepNow = world.clock + dt * 1000;
      run(world, dt);

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
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      scene.current?.destroy();
      scene.current = null;
      sound.current?.dispose();
      sound.current = null;
      localWorld.current = null;
    };
  }, [dispatchAction]);

  useEffect(() => {
    paused.current = helpOpen;
    scene.current?.setInputEnabled(!helpOpen);
  }, [helpOpen]);

  const world = snapshot?.world;
  const team =
    world?.players.find((p) => p.id === snapshot?.localId)?.team ?? 'red';
  const banner = world?.phase === 'scored' ? world.scoreBanner : null;
  const blocked =
    !world || !['serving', 'rally'].includes(world.phase) || helpOpen;
  const tether = world?.tethers[team];
  const tensionVal = tether ? Math.round(tether.tension * 100) : 0;
  const tensionClass =
    tensionVal > 80 ? 'danger' : tensionVal > 50 ? 'warning' : 'safe';

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    if (sound.current) {
      sound.current.unlock();
      sound.current.enabled = !next;
    }
  };

  return (
    <div
      className="bungee-game"
      {...partyRound(
        world?.phase === 'ended',
        partyVersus(team, world?.winner),
      )}
    >
      <div ref={container} className="bungee-canvas" />
      <header className="topbar bungee-topbar">
        <a href="/" className="wordmark">
          <span className="bungee-mark">
            <Link2 size={22} />
          </span>
          BUNGEE DOUBLES<span className="title-dot">.</span>
        </a>
        <GameToolbar
          muted={muted}
          onToggleSound={toggleSound}
          onHelp={() => setHelpOpen(true)}
        />
      </header>

      {/* 360 Camera Orbit Helper Badge */}
      {!helpOpen && (
        <div className="bungee-camera-hint">
          <Camera size={13} />
          <span>{strings.orbitHint}</span>
          <kbd className="house-key">Q/R</kbd>
          <kbd className="house-key">C</kbd>
        </div>
      )}

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
        <div className="bungee-banner win game-dialog result-dialog">
          <span className="dialog-emblem">
            <Trophy size={30} />
          </span>
          <h2>
            {strings[world.winner].toUpperCase()} {strings.wins}
          </h2>
          <p>{strings.matchComplete}</p>
          <button
            className="bungee-btn primary primary-button"
            onClick={() => dispatchAction({ type: 'restart' })}
          >
            {strings.playAgain}
          </button>
        </div>
      )}

      {/* Bottom Action Dock */}
      <div className="bungee-dock" aria-label={strings.controls}>
        <button
          className="bungee-btn primary bungee-play-action"
          disabled={blocked}
          onClick={() => dispatchAction({ type: 'swing' })}
        >
          <Flame size={14} />
          <span>{strings.volley}</span>
          <kbd className="bungee-kbd house-key">SPACE</kbd>
        </button>
        <button
          className="bungee-btn smash-btn bungee-play-action"
          disabled={blocked}
          onClick={() => dispatchAction({ type: 'smash' })}
        >
          <Zap size={14} />
          <span>{strings.smash}</span>
          <kbd className="bungee-kbd house-key">E</kbd>
        </button>
        <button
          className="bungee-btn bungee-play-action"
          disabled={blocked}
          onClick={() => dispatchAction({ type: 'dive' })}
        >
          <span>{strings.dive}</span>
          <kbd className="bungee-kbd house-key">SHIFT</kbd>
        </button>
        <button
          className="bungee-btn bungee-play-action"
          disabled={blocked}
          onClick={() => dispatchAction({ type: 'jump' })}
        >
          <span>{strings.jump}</span>
          <kbd className="bungee-kbd house-key">J</kbd>
        </button>
        <button
          className="bungee-btn"
          onClick={() => dispatchAction({ type: 'switchTeam' })}
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
          <kbd className="bungee-kbd house-key">C</kbd>
        </button>
        <button
          className="bungee-btn"
          onClick={() => dispatchAction({ type: 'restart' })}
        >
          <RotateCcw size={14} />
          <span>{strings.reset}</span>
        </button>
      </div>

      <div className="bungee-mobile-input">
        <TouchControls
          disabled={blocked}
          showJump={false}
          jump={() => dispatchAction({ type: 'jump' })}
          moveLabel={strings.move}
          joystickLabel={strings.joystick}
          move={(vector) => scene.current?.setTouchMovement(vector)}
        />
        <div className="bungee-touch-controls" aria-label={strings.controls}>
          {(['jump', 'smash', 'dive', 'swing'] as const).map((action) => (
            <button
              key={action}
              type="button"
              className={
                'bungee-action-circle ' + (action === 'swing' ? 'hit' : action)
              }
              disabled={blocked}
              onClick={() => dispatchAction({ type: action })}
            >
              {action === 'swing'
                ? strings.touchHit
                : action === 'jump'
                  ? strings.jump
                  : action === 'smash'
                    ? strings.touchSmash
                    : strings.touchDive}
            </button>
          ))}
        </div>
      </div>
      <div className="bungee-player-label">
        {strings.you}: {strings[team]} · {strings.playerRing}
      </div>
      <Dialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="bungee-help-backdrop" />
          <Dialog.Popup className="bungee-help" aria-describedby={undefined}>
            <Dialog.Title>{strings.helpTitle}</Dialog.Title>
            <p>{strings.helpMove}</p>
            <p>{strings.helpActions}</p>
            <p>{strings.helpRules}</p>
            <p>{strings.helpBungee}</p>
            <p>{strings.helpCamera}</p>
            <p>{strings.helpSwitch}</p>
            <Dialog.Close className="primary-button">
              {strings.close}
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
