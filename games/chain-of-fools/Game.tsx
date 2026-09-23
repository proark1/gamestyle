'use client';
/* oxlint-disable react/react-compiler */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
import { TOUCH_QUERY } from '../../shared/browser/device';
import { TouchControls } from '../../shared/input/TouchControls';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import GameToolbar from '../../shared/ui/GameToolbar';
import { idleInput } from './types';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyGoal, partyRound } from '../../shared/ui/party-round';
import { useLanguage } from '../../shared/language/useLanguage';
import { COLORS } from '../../shared/rendering/palette';
import { chainOfFoolsAnalytics, chainPlayState } from './analytics';
import { ChainOfFoolsSound } from './audio';
import { reconcileChainBots, stepChainBot } from './bots';
import {
  ANCHORS,
  PENDULUM,
  SWITCHYARD,
  checkpointsFor,
  finishXFor,
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
import { CHAIN_TRANSLATIONS, type KeyLabels } from './translations';
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
const SOLO_SESSION = { id: 'me', code: 'PRACTICE', name: 'You', color: 0 };

/**
 * What the HUD must show the moment it changes: the phase, a banked
 * checkpoint, a wipe, and anyone going over, getting up, clipping or bracing.
 * Everything else, such as the timer and the track dots, waits for the interval.
 */
const pacer = hudPacer<ChainWorld>(
  (w) =>
    `${w.mapId}|${w.phase}|${w.checkpoint}|${w.gatesOpen.join('')}|${w.plateActive.join('')}|${w.relayStep}|${w.wipes}|${w.players
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

const progress = (x: number, world: ChainWorld) => {
  const start = checkpointsFor(world.mapId)[0].x;
  return Math.max(
    0,
    Math.min(1, (x - start) / (finishXFor(world.mapId) - start)),
  );
};

function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not every browser lets a page buzz.
  }
}

type Prompt = {
  text: string;
  tone: 'info' | 'urgent' | 'self';
  /** The control the prompt is about, lit up on touch devices. */
  focus?: 'help' | 'brace' | 'clip' | 'jump';
};

/** The one thing most worth telling the local worker right now. */
function promptFor(
  world: ChainWorld,
  me: Player | undefined,
  s: ReturnType<typeof useStrings>,
  k: KeyLabels,
  touch: boolean,
): Prompt | null {
  if (!me || world.phase !== 'playing' || me.state === 'finished') return null;
  if (me.state === 'dangling')
    return { text: s.youDangling(k), tone: 'self', focus: 'jump' };
  if (me.state === 'limp') return { text: s.youLimp, tone: 'self' };
  if (me.anchorId)
    return {
      text: `${s.youClipped} · ${s.promptUnclip(k)}`,
      tone: 'info',
      focus: 'clip',
    };
  if (world.pendulumRider === me.id)
    return { text: s.promptUnclip(k), tone: 'info', focus: 'clip' };

  const others = world.players.filter((p) => p.id !== me.id);
  const dangler = others.find(
    (p) =>
      p.state === 'dangling' &&
      Math.hypot(p.x - me.x, p.z - me.z) <= HAUL_REACH * 1.3,
  );
  if (dangler && me.grounded)
    return {
      text: s.promptHaul(dangler.name, k),
      tone: 'urgent',
      focus: 'help',
    };

  const limp = others.find(
    (p) =>
      p.state === 'limp' &&
      Math.hypot(p.x - me.x, p.y - me.y, p.z - me.z) <= REVIVE_REACH * 1.4,
  );
  if (limp && me.grounded)
    return {
      text: s.promptRevive(limp.name, k),
      tone: 'urgent',
      focus: 'help',
    };

  if (me.braceCooldown > 0) return { text: s.exhausted, tone: 'self' };

  if (others.some((p) => p.state === 'dangling') && me.grounded && !me.braced)
    return { text: s.promptBrace(k), tone: 'urgent', focus: 'brace' };

  if (world.mapId === 'switchyard') {
    const gateIndex = world.gatesOpen.findIndex((open) => !open);
    const gate = SWITCHYARD.gates[gateIndex];
    if (gate && me.x > gate.x - 18 && me.x < gate.x) {
      if (gate.mode === 'relay')
        return {
          text: s.switchRelayPrompt(world.relayStep, gate.order.length),
          tone: 'info',
        };
      const offset = SWITCHYARD.gates
        .slice(0, gateIndex)
        .reduce((sum, previous) => sum + previous.plates.length, 0);
      const active = world.plateActive
        .slice(offset, offset + gate.plates.length)
        .filter(Boolean).length;
      return { text: s.switchPrompt(active, gate.plates.length), tone: 'info' };
    }
  }

  if (!me.grounded && nearNet(me.x, me.y, me.z))
    return { text: s.promptNet(touch), tone: 'info' };

  const [bx, by, bz] = pendulumBall(world.pendulumAngle);
  if (
    Math.hypot(me.x - bx, me.y + PLAYER_HEIGHT * 0.6 - by, me.z - bz) <=
    PENDULUM.hookReach + PENDULUM.ballRadius
  )
    return { text: s.promptHook(k), tone: 'info', focus: 'clip' };

  if (
    ANCHORS.some(
      (a) => Math.hypot(me.x - a.x, me.y - a.y, me.z - a.z) < CLIP_REACH,
    )
  )
    return { text: s.promptClip(k), tone: 'info', focus: 'clip' };

  const hint = s.routeHints[sectionAt(me.x, world.mapId)];
  return hint ? { text: hint, tone: 'info' } : null;
}

function useStrings() {
  const { t } = useLanguage();
  return t(CHAIN_TRANSLATIONS);
}

function subscribeTouch(change: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}

/**
 * Whether the touch layout is showing, using the collection's one touch query
 * so the prompts name the same controls the stylesheet puts on screen.
 */
function useTouchLayout() {
  return useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia?.(TOUCH_QUERY).matches ?? false,
    () => false,
  );
}

/**
 * A button held down for as long as the finger stays on it. Capturing the
 * pointer means sliding a thumb a little off the button mid-hold does not
 * drop whoever the player is holding on the line.
 */
function holdHandlers(on: () => void, off: () => void) {
  return {
    onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
      if (event.button !== 0) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Without capture the hold still works; it just ends if the thumb slips.
      }
      on();
    },
    onPointerUp: off,
    onPointerCancel: off,
    onLostPointerCapture: off,
    onContextMenu(event: { preventDefault(): void }) {
      event.preventDefault();
    },
  };
}

export default function ChainOfFoolsGame() {
  const strings = useStrings();
  const touch = useTouchLayout();
  const keys = touch ? strings.keys.touch : strings.keys.desktop;
  useGameTracker(tracker);

  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ChainScene | null>(null);
  const sound = useRef<ChainOfFoolsSound | null>(null);
  const world = useRef<ChainWorld | null>(null);
  const sessionRef = useRef(SOLO_SESSION);
  const currentInput = useRef(idleInput());
  const lastHaptic = useRef(0);

  const [snapshot, setSnapshot] = useState<ChainSnapshot | null>(null);
  const [camera, setCamera] = useState<CameraMode>('crew');
  const [muted, setMuted] = useState(false);
  const [help, setHelp] = useState(false);

  const room = usePeerRoom<ChainSnapshot>({
    game: 'chain-of-fools',
    loadEngine: () => import('./peer'),
    idleInput,
    readInput: () => currentInput.current,
    onAttach: (next) => {
      world.current = null;
      sessionRef.current = { ...sessionRef.current, ...next };
      currentInput.current = idleInput();
      scene.current?.setLocal(next.id);
      pacer.reset();
    },
    receive: (snap) => {
      scene.current?.update(snap);
      sound.current?.update(
        snap.world,
        sessionRef.current.id,
        scene.current?.listenerYaw(),
      );
      if (pacer.due(snap.world)) setSnapshot(snap);
    },
  });
  const { send } = room;

  const publish = useCallback((force = false) => {
    const current = world.current;
    if (!current) return;
    const snap = chainSnapshot(
      current,
      sessionRef.current.code,
      sessionRef.current.id,
      sessionRef.current.id,
      current.clock,
    );
    scene.current?.update(snap);
    sound.current?.update(
      current,
      sessionRef.current.id,
      scene.current?.listenerYaw(),
    );

    if (pacer.due(current) || force) {
      // A copy, so React sees a new object and the HUD re-renders.
      setSnapshot({
        ...snap,
        world: { ...current, players: current.players.map((p) => ({ ...p })) },
      });
      tracker.observe(chainPlayState(snap, sessionRef.current));
    }
  }, []);

  const dispatch = useCallback(
    (action: ChainAction) => {
      tracker.action(action.type);
      sound.current?.unlock();
      if (send(action) || !world.current) return;
      chainOfFoolsAction(world.current, sessionRef.current.id, action);
      if (action.type === 'clip') haptic(25);
      publish(true);
    },
    [publish, send],
  );

  useEffect(() => {
    if (!container.current) return;
    sound.current = new ChainOfFoolsSound();
    scene.current = new ChainScene(container.current, {
      input: (input) => {
        currentInput.current = input;
        const me = world.current?.players.find(
          (p) => p.id === sessionRef.current.id,
        );
        if (me) {
          me.input = input;
          me.seen = world.current?.clock ?? 0;
        }
      },
      action: dispatch,
      camera: setCamera,
    });
    scene.current.setLocal(sessionRef.current.id);

    pacer.reset();
    const start = Date.now();
    const fresh = freshChainWorld(start);
    fresh.players.push(
      newPlayer(
        sessionRef.current.id,
        sessionRef.current.name,
        sessionRef.current.color,
        0,
        false,
      ),
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
      const me = current.players.find((p) => p.id === sessionRef.current.id);
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
  const description =
    w?.mapId === 'switchyard' ? strings.switchDesc : strings.desc;
  const rules = w?.mapId === 'switchyard' ? strings.switchRules : strings.rules;
  const me = w?.players.find((p) => p.id === sessionRef.current.id);
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
  const prompt = w ? promptFor(w, me, strings, keys, touch) : null;
  const lit = (control: NonNullable<Prompt['focus']>) =>
    prompt?.focus === control ? `lit ${prompt.tone}` : '';

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sound.current?.setMuted(next);
  };

  // One list feeds the keyboard bar and the help dialog.
  const keyHints = [
    ['WASD', strings.hintMove],
    ['Space', strings.hintJump],
    ['Shift', strings.hintBrace],
    ['F', strings.hintHelp],
    ['E', strings.hintClip],
    ['Q', strings.hintCall],
    ['V', strings.hintCamera],
  ] as const;

  const touchJump = () => {
    sound.current?.unlock();
    scene.current?.hold('jump', true);
    setTimeout(() => scene.current?.hold('jump', false), 160);
  };

  return (
    <main
      className="cof-game"
      {...partyRound(
        ended,
        w ? partyGoal(w.winner === 'crew', crewScore(w)) : null,
      )}
    >
      <div ref={container} className="cof-canvas" />

      <header className="topbar cof-topbar">
        <a href="/" className="wordmark">
          <span className="cof-mark">
            <Link2 size={22} />
          </span>{' '}
          CHAIN OF FOOLS<span className="title-dot">.</span>
        </a>
        <GameToolbar
          multiplayer={<PeerRoomControls room={room} />}
          voice={room.voice}
          muted={muted}
          onToggleSound={toggleMute}
          onHelp={() => {
            scene.current?.resetInput();
            setHelp(true);
          }}
        />
      </header>

      <div className="cof-corner">
        <button
          type="button"
          className="cof-icon-btn"
          onClick={() => setCamera(scene.current?.cycleCamera() ?? 'crew')}
          aria-label={strings.hintCamera}
          title={`${strings.hintCamera} (V)`}
        >
          <Video size={18} />
          <span>{strings.cameraModes[camera]}</span>
          <kbd className="house-key">V</kbd>
        </button>
      </div>

      {w && (playing || ended) && (
        <section className="cof-hud" aria-live="off">
          <div className="cof-hud-badge cof-badge-timer">
            <Timer size={18} />
            <div>
              <strong className="cof-timer">{formatTime(timeLeft(w))}</strong>
              <small>{strings.hudTime}</small>
            </div>
          </div>

          <div className="cof-hud-badge cof-track-badge">
            <div className="cof-track">
              <div className="cof-track-rail" />
              {checkpointsFor(w.mapId)
                .slice(1)
                .map((point) => (
                  <span
                    key={point.index}
                    className={`cof-track-flag ${w.checkpoint >= point.index ? 'banked' : ''}`}
                    style={{ left: `${progress(point.x, w) * 100}%` }}
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
                  className={`cof-track-dot ${p.id === sessionRef.current.id ? 'me' : ''} ${p.state}`}
                  style={{
                    left: `${progress(p.x, w) * 100}%`,
                    background: COLORS[p.color % 4],
                  }}
                />
              ))}
            </div>
            <div className="cof-route-summary">
              <small>
                {strings.sections[sectionAt(trailingX, w.mapId)] ??
                  sectionAt(trailingX, w.mapId)}
              </small>
              <span>
                {strings.distanceLeft(
                  Math.ceil(Math.max(0, finishXFor(w.mapId) - trailingX)),
                )}
              </span>
            </div>
            <span className="cof-checkpoint-count">
              {strings.sectionProgress(
                w.checkpoint,
                checkpointsFor(w.mapId).length - 1,
              )}
              <span className="cof-best">
                {strings.bestDistance(
                  Math.round(
                    Math.max(
                      0,
                      Math.min(finishXFor(w.mapId), w.bestX) -
                        (w.mapId === 'switchyard' ? SWITCHYARD.startX : 0),
                    ),
                  ),
                )}
              </span>
            </span>
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

          <div className="cof-hud-badge cof-badge-wipes">
            <HardHat size={18} />
            <div>
              <strong>{w.wipes + 1}</strong>
              <small>{strings.hudWipes}</small>
            </div>
          </div>
        </section>
      )}

      {w && playing && me && me.respawnAt > w.clock && w.wipes > 0 && (
        <output className="cof-reset-notice" aria-live="polite">
          {strings.resetNotice}
        </output>
      )}

      {prompt && (
        <output className={`cof-prompt ${prompt.tone}`}>
          {prompt.tone === 'urgent' ? <Anchor size={16} /> : null}
          {prompt.text}
        </output>
      )}

      {w?.phase === 'lobby' && (
        <section className="cof-welcome">
          <div className="cof-welcome-body">
            <div className="cof-kicker">
              <Link2 size={14} /> {strings.tagline}
            </div>
            <h1>
              {strings.titleMain}
              <span>{strings.titleHighlight}</span>.
            </h1>
            <div className="cof-map-picker" aria-label={strings.mapLabel}>
              <button
                type="button"
                className={`cof-map-choice ${w.mapId === 'demolition' ? 'selected' : ''}`}
                aria-pressed={w.mapId === 'demolition'}
                onClick={() =>
                  dispatch({ type: 'select_map', mapId: 'demolition' })
                }
              >
                <strong>{strings.mapClassicName}</strong>
                <span>{strings.mapClassicDesc}</span>
              </button>
              <button
                type="button"
                className={`cof-map-choice ${w.mapId === 'switchyard' ? 'selected' : ''}`}
                aria-pressed={w.mapId === 'switchyard'}
                onClick={() =>
                  dispatch({ type: 'select_map', mapId: 'switchyard' })
                }
              >
                <strong>{strings.mapSwitchName}</strong>
                <span>{strings.mapSwitchDesc}</span>
              </button>
            </div>
            <p className="cof-desc">{description}</p>
            <ul className="cof-rules">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="cof-crew">
              {w.players.map((p) => (
                <span key={p.id} className="cof-crew-chip">
                  <i style={{ background: COLORS[p.color % 4] }} />
                  {p.id === sessionRef.current.id
                    ? sessionRef.current.name
                    : p.name}
                </span>
              ))}
            </div>
          </div>
          <div className="cof-welcome-foot">
            <button
              type="button"
              className="cof-btn primary primary-button"
              onClick={() => dispatch({ type: 'start' })}
            >
              {strings.startShift} <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}

      {ended && w && (
        <section className={`cof-ended-banner ${w.winner ?? ''}`}>
          <h2>{w.winner === 'crew' ? strings.wonTitle : strings.lostTitle}</h2>
          <p>
            {w.winner === 'crew'
              ? strings.wonDesc(Math.round(timeLeft(w) / 1000), w.wipes)
              : strings.lostDesc(
                  strings.sections[sectionAt(trailingX, w.mapId)] ??
                    sectionAt(trailingX, w.mapId),
                )}
          </p>
          <div className="cof-score">
            <small>{strings.score}</small>
            <strong>{crewScore(w)}</strong>
          </div>
          <button
            data-party-setup-action=""
            type="button"
            className="cof-btn primary primary-button"
            onClick={() => dispatch({ type: 'restart' })}
          >
            <RotateCcw size={18} /> {strings.playAgain}
          </button>
        </section>
      )}

      {!touch && (
        <div className="cof-hint-bar tool-dock">
          {keyHints.map(([key, label]) => (
            <span key={key}>
              <kbd className="house-key">{key}</kbd> {label}
            </span>
          ))}
        </div>
      )}

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="game-dialog">
          <DialogTitle>
            {strings.titleMain}
            {strings.titleHighlight}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <ul className="cof-rules">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {/* Keyboard keys mean nothing on a phone; its prompts name the buttons. */}
          {!touch && (
            <ul className="cof-help-keys">
              {keyHints.map(([key, label]) => (
                <li key={key}>
                  <kbd className="house-key">{key}</kbd> {label}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {playing && (
        <>
          <div className={`cof-stick ${lit('jump') ? 'jump-lit' : ''}`}>
            <TouchControls
              disabled={!playing}
              move={(v) => scene.current?.move(v)}
              jump={touchJump}
            />
          </div>
          <nav className="cof-dock" aria-label="Crew actions">
            <button
              type="button"
              className={`cof-dock-btn brace ${me?.braced ? 'on' : ''} ${me && me.braceCooldown > 0 ? 'out' : ''} ${lit('brace')}`}
              style={{ '--grip': grip } as CSSProperties}
              {...holdHandlers(
                () => {
                  sound.current?.unlock();
                  scene.current?.hold('brace', true);
                  haptic(15);
                },
                () => scene.current?.hold('brace', false),
              )}
            >
              <Hand size={20} />
              {strings.touchBrace}
            </button>
            <button
              type="button"
              className={`cof-dock-btn help ${lit('help')}`}
              {...holdHandlers(
                () => {
                  sound.current?.unlock();
                  scene.current?.hold('haul', true);
                  haptic(15);
                },
                () => scene.current?.hold('haul', false),
              )}
            >
              <Link2 size={20} />
              {strings.touchHelp}
            </button>
            <button
              type="button"
              className={`cof-dock-btn clip ${me?.anchorId ? 'on' : ''} ${lit('clip')}`}
              onClick={() => dispatch({ type: 'clip' })}
            >
              <Anchor size={20} />
              {strings.touchClip}
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
