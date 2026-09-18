'use client';
/* oxlint-disable react/react-compiler */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Anchor,
  ArrowRight,
  Flag,
  Hand,
  HardHat,
  Link2,
  RotateCcw,
  Timer,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { TouchControls } from '../../shared/input/TouchControls';
import LanguageSwitcher from '../../shared/language/LanguageSwitcher';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { useLanguage } from '../../shared/language/useLanguage';
import { COLORS } from '../../shared/rendering/palette';
import { chainOfFoolsAnalytics, chainPlayState } from './analytics';
import { ChainOfFoolsSound } from './audio';
import { reconcileChainBots, stepChainBot } from './bots';
import {
  ANCHORS,
  CHECKPOINTS,
  FINISH_X,
  PENDULUM,
  nearNet,
  pendulumBall,
  sectionAt,
} from './course';
import { ChainScene, type CameraMode } from './scene';
import {
  advanceChainOfFools,
  chainOfFoolsAction,
  chainSnapshot,
  crewScore,
  freshChainWorld,
  newPlayer,
} from './simulation';
import { CHAIN_TRANSLATIONS } from './translations';
import {
  BRACE_STAMINA_MAX,
  CLIP_REACH,
  HAUL_REACH,
  PLAYER_HEIGHT,
  REVIVE_REACH,
  timeLeft,
  type ChainAction,
  type ChainSnapshot,
  type ChainWorld,
  type Player,
} from './types';
import './style.css';

const tracker = new GameTracker(chainOfFoolsAnalytics);

/** Local practice, by the collection's convention. */
const SESSION = { id: 'me', code: 'PRACTICE', name: 'You', color: 0 };
const TRACK_START = CHECKPOINTS[0].x;

/**
 * What the HUD must show the moment it changes: the phase, a banked
 * checkpoint, a wipe, and anyone going over, getting up, clipping or bracing.
 * Everything else, such as the timer and the track dots, waits for the interval.
 */
const pacer = hudPacer<ChainWorld>(
  (w) =>
    `${w.phase}|${w.checkpoint}|${w.wipes}|${w.players
      .map(
        (p) =>
          `${p.state[0]}${p.anchorId ? 'c' : ''}${p.braced ? 'b' : ''}${p.braceCooldown > 0 ? 'x' : ''}`,
      )
      .join('')}`,
);

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const progress = (x: number) =>
  Math.max(0, Math.min(1, (x - TRACK_START) / (FINISH_X - TRACK_START)));

function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not every browser lets a page buzz.
  }
}

type Prompt = { text: string; tone: 'info' | 'urgent' | 'self' };

/** The one thing most worth telling the local worker right now. */
function promptFor(
  world: ChainWorld,
  me: Player | undefined,
  s: ReturnType<typeof useStrings>,
): Prompt | null {
  if (!me || world.phase !== 'playing' || me.state === 'finished') return null;
  if (me.state === 'dangling') return { text: s.youDangling, tone: 'self' };
  if (me.state === 'limp') return { text: s.youLimp, tone: 'self' };
  if (me.anchorId)
    return { text: `${s.youClipped} · ${s.promptUnclip}`, tone: 'info' };
  if (world.pendulumRider === me.id)
    return { text: s.promptUnclip, tone: 'info' };

  const others = world.players.filter((p) => p.id !== me.id);
  const dangler = others.find(
    (p) =>
      p.state === 'dangling' &&
      Math.hypot(p.x - me.x, p.z - me.z) <= HAUL_REACH * 1.3,
  );
  if (dangler && me.grounded)
    return { text: s.promptHaul(dangler.name), tone: 'urgent' };

  const limp = others.find(
    (p) =>
      p.state === 'limp' &&
      Math.hypot(p.x - me.x, p.y - me.y, p.z - me.z) <= REVIVE_REACH * 1.4,
  );
  if (limp && me.grounded)
    return { text: s.promptRevive(limp.name), tone: 'urgent' };

  if (me.braceCooldown > 0) return { text: s.exhausted, tone: 'self' };

  if (others.some((p) => p.state === 'dangling') && me.grounded && !me.braced)
    return { text: s.promptBrace, tone: 'urgent' };

  if (!me.grounded && nearNet(me.x, me.y, me.z))
    return { text: s.promptNet, tone: 'info' };

  const [bx, by, bz] = pendulumBall(world.pendulumAngle);
  if (
    Math.hypot(me.x - bx, me.y + PLAYER_HEIGHT * 0.6 - by, me.z - bz) <=
    PENDULUM.hookReach + PENDULUM.ballRadius
  )
    return { text: s.promptHook, tone: 'info' };

  if (
    ANCHORS.some(
      (a) => Math.hypot(me.x - a.x, me.y - a.y, me.z - a.z) < CLIP_REACH,
    )
  )
    return { text: s.promptClip, tone: 'info' };

  return null;
}

function useStrings() {
  const { t } = useLanguage();
  return t(CHAIN_TRANSLATIONS);
}

export default function ChainOfFoolsGame() {
  const strings = useStrings();
  useGameTracker(tracker);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ChainScene | null>(null);
  const sound = useRef<ChainOfFoolsSound | null>(null);
  const world = useRef<ChainWorld | null>(null);
  const lastHaptic = useRef(0);

  const [snapshot, setSnapshot] = useState<ChainSnapshot | null>(null);
  const [camera, setCamera] = useState<CameraMode>('crew');
  const [muted, setMuted] = useState(false);

  const publish = useCallback((force = false) => {
    const current = world.current;
    if (!current) return;
    const snap = chainSnapshot(
      current,
      SESSION.code,
      SESSION.id,
      SESSION.id,
      current.clock,
    );
    scene.current?.update(snap);
    sound.current?.update(current, SESSION.id);

    if (pacer.due(current) || force) {
      // A copy, so React sees a new object and the HUD re-renders.
      setSnapshot({
        ...snap,
        world: { ...current, players: current.players.map((p) => ({ ...p })) },
      });
      tracker.observe(chainPlayState(snap, SESSION));
    }
  }, []);

  const dispatch = useCallback(
    (action: ChainAction) => {
      tracker.action(action.type);
      sound.current?.unlock();
      if (!world.current) return;
      chainOfFoolsAction(world.current, SESSION.id, action);
      if (action.type === 'clip') haptic(25);
      publish(true);
    },
    [publish],
  );

  useEffect(() => {
    if (!container.current) return;
    sound.current = new ChainOfFoolsSound();
    scene.current = new ChainScene(container.current, {
      input: (input) => {
        const me = world.current?.players.find((p) => p.id === SESSION.id);
        if (me) {
          me.input = input;
          me.seen = world.current?.clock ?? 0;
        }
      },
      action: dispatch,
    });
    scene.current.setLocal(SESSION.id);

    pacer.reset();
    const start = Date.now();
    const fresh = freshChainWorld(start);
    fresh.players.push(
      newPlayer(SESSION.id, SESSION.name, SESSION.color, 0, false),
    );
    reconcileChainBots(fresh);
    world.current = fresh;
    publish(true);

    let last = performance.now();
    const ticker = setInterval(() => {
      const current = world.current;
      if (!current) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const player of current.players)
        if (player.bot) stepChainBot(player, current, dt);
      advanceChainOfFools(current, current.clock + dt * 1000, dt);
      publish();

      // A buzz when the local worker is yanked or goes over.
      const me = current.players.find((p) => p.id === SESSION.id);
      const recent = current.events[current.events.length - 1];
      if (
        me &&
        recent &&
        recent.id > lastHaptic.current &&
        recent.playerId === me.id &&
        (recent.type === 'dangle' || recent.type === 'chain_yank')
      ) {
        lastHaptic.current = recent.id;
        haptic(recent.type === 'dangle' ? [40, 30, 60] : 30);
      }
    }, 1000 / 60);

    const pageHidden = () => {
      if (document.hidden) last = performance.now();
    };
    document.addEventListener('visibilitychange', pageHidden);

    return () => {
      clearInterval(ticker);
      document.removeEventListener('visibilitychange', pageHidden);
      tracker.flush();
      sound.current?.dispose();
      scene.current?.destroy();
      scene.current = null;
      sound.current = null;
    };
  }, [dispatch, publish]);

  const w = snapshot?.world;
  const me = w?.players.find((p) => p.id === SESSION.id);
  const playing = w?.phase === 'playing';
  const ended = w?.phase === 'ended';

  const myLinks =
    w && me
      ? w.links.filter((link) => link.a === me.id || link.b === me.id)
      : [];
  const lineTension = myLinks.reduce((m, link) => Math.max(m, link.tension), 0);
  const grip = me ? me.stamina / BRACE_STAMINA_MAX : 1;
  const trailingX = w?.players.length
    ? Math.min(...w.players.map((p) => p.x))
    : 0;
  const prompt = w ? promptFor(w, me, strings) : null;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sound.current?.setMuted(next);
  };

  const touchJump = () => {
    sound.current?.unlock();
    scene.current?.hold('jump', true);
    setTimeout(() => scene.current?.hold('jump', false), 160);
  };

  return (
    <main className="cof-game">
      <div ref={container} className="cof-canvas" />

      <div className="cof-corner">
        <button
          type="button"
          className="cof-icon-btn"
          onClick={toggleMute}
          aria-label={muted ? 'Sound on' : 'Sound off'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          type="button"
          className="cof-icon-btn"
          onClick={() => setCamera(scene.current?.cycleCamera() ?? 'crew')}
          aria-label={strings.hintCamera}
          title={`${strings.hintCamera} (V)`}
        >
          <Video size={18} />
          <span>{strings.cameraModes[camera]}</span>
        </button>
        <LanguageSwitcher variant="header" />
      </div>

      {w && (playing || ended) && (
        <section className="cof-hud" aria-live="off">
          <div className="cof-hud-badge">
            <Timer size={18} />
            <div>
              <strong className="cof-timer">
                {formatTime(playing ? timeLeft(w) : 0)}
              </strong>
              <small>{strings.hudTime}</small>
            </div>
          </div>

          <div className="cof-hud-badge cof-track-badge">
            <div className="cof-track">
              <div className="cof-track-rail" />
              {CHECKPOINTS.slice(1).map((point) => (
                <span
                  key={point.index}
                  className={`cof-track-flag ${w.checkpoint >= point.index ? 'banked' : ''}`}
                  style={{ left: `${progress(point.x) * 100}%` }}
                  title={point.label}
                />
              ))}
              <Flag
                size={14}
                className="cof-track-finish"
                style={{ left: '100%' }}
              />
              {w.players.map((p) => (
                <span
                  key={p.id}
                  className={`cof-track-dot ${p.id === SESSION.id ? 'me' : ''} ${p.state}`}
                  style={{
                    left: `${progress(p.x) * 100}%`,
                    background: COLORS[p.color % 4],
                  }}
                />
              ))}
            </div>
            <small>
              {strings.sections[sectionAt(trailingX)] ?? sectionAt(trailingX)}
            </small>
          </div>

          <div className="cof-hud-badge cof-meters">
            <div className={`cof-meter ${lineTension > 0.95 ? 'hot' : ''}`}>
              <Link2 size={14} />
              <span className="cof-meter-bar">
                <span style={{ width: `${lineTension * 100}%` }} />
              </span>
              <small>{strings.hudLine}</small>
            </div>
            <div
              className={`cof-meter grip ${me && me.braceCooldown > 0 ? 'out' : ''} ${me?.braced ? 'on' : ''}`}
            >
              <Hand size={14} />
              <span className="cof-meter-bar">
                <span style={{ width: `${grip * 100}%` }} />
              </span>
              <small>{strings.hudGrip}</small>
            </div>
          </div>

          <div className="cof-hud-badge">
            <HardHat size={18} />
            <div>
              <strong>{w.wipes}</strong>
              <small>{strings.hudWipes}</small>
            </div>
          </div>
        </section>
      )}

      {prompt && (
        <output className={`cof-prompt ${prompt.tone}`}>
          {prompt.tone === 'urgent' ? <Anchor size={16} /> : null}
          {prompt.text}
        </output>
      )}

      {w?.phase === 'lobby' && (
        <section className="cof-welcome">
          <div className="cof-kicker">
            <Link2 size={14} /> {strings.tagline}
          </div>
          <h1>
            {strings.titleMain}
            <span>{strings.titleHighlight}</span>.
          </h1>
          <p className="cof-desc">{strings.desc}</p>
          <ul className="cof-rules">
            {strings.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="cof-crew">
            {w.players.map((p) => (
              <span key={p.id} className="cof-crew-chip">
                <i style={{ background: COLORS[p.color % 4] }} />
                {p.id === SESSION.id ? SESSION.name : p.name}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="cof-btn primary"
            onClick={() => dispatch({ type: 'start' })}
          >
            {strings.startShift} <ArrowRight size={18} />
          </button>
        </section>
      )}

      {ended && w && (
        <section className={`cof-ended-banner ${w.winner ?? ''}`}>
          <h2>{w.winner === 'crew' ? strings.wonTitle : strings.lostTitle}</h2>
          <p>
            {w.winner === 'crew'
              ? strings.wonDesc(
                  Math.round(Math.max(0, w.endsAt - w.clock) / 1000),
                  w.wipes,
                )
              : strings.lostDesc(
                  strings.sections[sectionAt(trailingX)] ??
                    sectionAt(trailingX),
                )}
          </p>
          <div className="cof-score">
            <small>{strings.score}</small>
            <strong>{crewScore(w)}</strong>
          </div>
          <button
            type="button"
            className="cof-btn primary"
            onClick={() => dispatch({ type: 'restart' })}
          >
            <RotateCcw size={18} /> {strings.playAgain}
          </button>
        </section>
      )}

      <div className="cof-hint-bar">
        <span>
          <kbd>WASD</kbd> {strings.hintMove}
        </span>
        <span>
          <kbd>Space</kbd> {strings.hintJump}
        </span>
        <span>
          <kbd>Shift</kbd> {strings.hintBrace}
        </span>
        <span>
          <kbd>F</kbd> {strings.hintHelp}
        </span>
        <span>
          <kbd>E</kbd> {strings.hintClip}
        </span>
        <span>
          <kbd>Q</kbd> {strings.hintCall}
        </span>
        <span>
          <kbd>V</kbd> {strings.hintCamera}
        </span>
      </div>

      <TouchControls
        disabled={!playing}
        move={(v) => scene.current?.move(v)}
        jump={touchJump}
      />
      <nav className="cof-dock" aria-label="Crew actions">
        <button
          type="button"
          className={`cof-dock-btn brace ${me?.braced ? 'on' : ''}`}
          disabled={!playing}
          onPointerDown={() => {
            sound.current?.unlock();
            scene.current?.hold('brace', true);
            haptic(15);
          }}
          onPointerUp={() => scene.current?.hold('brace', false)}
          onPointerCancel={() => scene.current?.hold('brace', false)}
          onPointerLeave={() => scene.current?.hold('brace', false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Hand size={20} />
          {strings.touchBrace}
        </button>
        <button
          type="button"
          className="cof-dock-btn help"
          disabled={!playing}
          onPointerDown={() => {
            sound.current?.unlock();
            scene.current?.hold('haul', true);
            haptic(15);
          }}
          onPointerUp={() => scene.current?.hold('haul', false)}
          onPointerCancel={() => scene.current?.hold('haul', false)}
          onPointerLeave={() => scene.current?.hold('haul', false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Link2 size={20} />
          {strings.touchHelp}
        </button>
        <button
          type="button"
          className={`cof-dock-btn clip ${me?.anchorId ? 'on' : ''}`}
          disabled={!playing}
          onClick={() => dispatch({ type: 'clip' })}
        >
          <Anchor size={20} />
          {strings.touchClip}
        </button>
      </nav>
    </main>
  );
}
