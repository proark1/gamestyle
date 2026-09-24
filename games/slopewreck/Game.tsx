'use client';
/* oxlint-disable react/react-compiler -- WebGL, input and simulation controllers intentionally live outside React. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  FlagTriangleRight,
  HelpCircle,
  MountainSnow,
  RotateCcw,
} from 'lucide-react';
import GameToolbar from '../../shared/ui/GameToolbar';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import { TouchControls } from '../../shared/input/TouchControls';
import { TOUCH_CONTROLS_QUERY } from '../../shared/input/gestures';
import { useMediaQuery } from '../../shared/browser/use-media-query';
import { gameActive } from '../../shared/browser/game-lifecycle';
import { useLanguage } from '../../shared/language/useLanguage';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { inPartyMode } from '../../shared/ui/party-mode';
import { partyGoal, partyRound } from '../../shared/ui/party-round';
import { SlopeAudio } from './audio';
import { slopewreckAnalytics, slopewreckPlayState } from './analytics';
import { SlopeControls } from './controls';
import {
  advanceWorld,
  freshWorld,
  raceAction,
  snapshot as makeSnapshot,
} from './simulation';
import {
  FINISH_Z,
  RACE_MS,
  idleInput,
  type RaceInput,
  type Snapshot,
  type World,
} from './types';
import type { SlopeScene } from './scene';
import './style.css';

const tracker = new GameTracker(slopewreckAnalytics);
const subscribeParty = () => () => {};
const serverParty = () => false;
const keys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
  'Space',
  'KeyQ',
  'KeyE',
]);

export default function SlopewreckGame() {
  const { language } = useLanguage();
  const de = language === 'de';
  const say = (en: string, german: string) => (de ? german : en);
  const party = useSyncExternalStore(subscribeParty, inPartyMode, serverParty);
  const touch = useMediaQuery(TOUCH_CONTROLS_QUERY);
  useGameTracker(tracker);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SlopeScene | null>(null);
  const sound = useRef<SlopeAudio | null>(null);
  const local = useRef<World | null>(null);
  const self = useRef('local');
  const latest = useRef<Snapshot | null>(null);
  const controls = useRef(new SlopeControls());
  const blocked = useRef(false);
  const connected = useRef(false);
  const hud = useRef(
    hudPacer<Snapshot>(
      (s) =>
        `${s.world.phase}:${Math.ceil((RACE_MS - (s.world.clock - s.world.started)) / 1000)}:${s.world.nextEvent}`,
    ),
  );
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [help, setHelp] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  const receive = useCallback((s: Snapshot) => {
    latest.current = s;
    scene.current?.render(s);
    sound.current?.update(s.world, self.current);
    if (hud.current.due(s)) {
      setSnap(s);
      tracker.observe(slopewreckPlayState(s));
    }
  }, []);
  const room = usePeerRoom<Snapshot>({
    game: 'slopewreck',
    loadEngine: () => import('./peer'),
    readInput: () =>
      blocked.current || !gameActive() ? idleInput() : controls.current.read(),
    idleInput,
    onAttach: (session) => {
      local.current = null;
      connected.current = true;
      self.current = session.id;
      controls.current.clear();
      sound.current?.resetEvents();
      scene.current?.setLocalPlayer(session.id);
      hud.current.reset();
    },
    onOpen: () => controls.current.clear(),
    receive,
  });
  const disabled =
    !ready ||
    help ||
    room.open ||
    room.busy ||
    (!!room.session && room.status !== 'online');
  useLayoutEffect(() => {
    blocked.current = disabled;
    if (disabled) controls.current.clear();
  }, [disabled]);
  const { send } = room;
  const act = useCallback(
    (type: string) => {
      if (blocked.current || !gameActive()) return;
      sound.current?.unlock();
      tracker.action(type);
      setError('');
      const action = { type };
      if (send(action)) return;
      if (local.current) {
        try {
          raceAction(local.current, self.current, action, true);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not race.');
        }
        hud.current.reset();
        receive(
          makeSnapshot(
            local.current,
            'SOLO',
            self.current,
            self.current,
            local.current.tick,
          ),
        );
      }
    },
    [receive, send],
  );

  useEffect(() => {
    const input = controls.current;
    let cancelled = false,
      frame = 0,
      view: SlopeScene | undefined;
    let previous = performance.now(),
      publish = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(100, now - previous);
      previous = now;
      const w = local.current;
      if (!w || !gameActive()) return;
      const p = w.players.find((q) => q.id === self.current);
      if (p) p.input = blocked.current ? idleInput() : controls.current.read();
      if (!blocked.current) advanceWorld(w, w.clock + dt);
      if (now - publish >= 32) {
        publish = now;
        receive(makeSnapshot(w, 'SOLO', self.current, self.current, w.tick));
      }
    };
    void import('./scene')
      .then(({ SlopeScene: Scene }) => {
        if (cancelled || !host.current) return;
        view = new Scene(host.current);
        scene.current = view;
        sound.current = new SlopeAudio();
        view.setLocalPlayer(self.current);
        if (!connected.current) {
          const w = freshWorld(Date.now());
          Object.assign(w.players[0], { id: 'local', name: 'You', bot: false });
          local.current = w;
          receive(makeSnapshot(w, 'SOLO', 'local', 'local', 0));
        } else if (latest.current) receive(latest.current);
        setReady(true);
        frame = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!cancelled) setError('The mountain could not load. Please reload.');
      });
    const down = (e: globalThis.KeyboardEvent) => {
      if (
        blocked.current ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        !keys.has(e.code) ||
        (e.target as HTMLElement)?.closest?.(
          'input,textarea,select,[contenteditable="true"],dialog',
        ) ||
        (e.code === 'Space' && (e.target as HTMLElement)?.closest?.('button,a'))
      )
        return;
      e.preventDefault();
      controls.current.key(e.code, true);
      if (!e.repeat) {
        sound.current?.unlock();
        if (e.code === 'Space') act('jump');
        else if (e.code === 'KeyQ') act('trick_ramp');
        else if (e.code === 'KeyE') act('trick_rail');
      }
    };
    const up = (e: globalThis.KeyboardEvent) =>
      controls.current.key(e.code, false);
    const clear = () => controls.current.clear();
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      view?.dispose();
      sound.current?.dispose();
      scene.current = null;
      sound.current = null;
      local.current = null;
      input.clear();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [act, receive]);

  const hold = (key: 'tuck' | 'brake') => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      controls.current.patch({ [key]: true } as Partial<RaceInput>);
    },
    onPointerUp: () =>
      controls.current.patch({ [key]: false } as Partial<RaceInput>),
    onPointerCancel: () =>
      controls.current.patch({ [key]: false } as Partial<RaceInput>),
    onLostPointerCapture: () =>
      controls.current.patch({ [key]: false } as Partial<RaceInput>),
    onBlur: () =>
      controls.current.patch({ [key]: false } as Partial<RaceInput>),
  });
  const w = snap?.world,
    me = w?.players.find((p) => p.id === self.current);
  const isHost = !room.session || snap?.host === self.current;
  const ended = w?.phase === 'ended',
    lobby = w?.phase === 'lobby';
  const remaining = w?.started
    ? Math.max(0, Math.ceil((RACE_MS - (w.clock - w.started)) / 1000))
    : 60;
  const ranked = [...(w?.players ?? [])].sort((a, b) =>
    a.finishAt && b.finishAt
      ? a.finishAt - b.finishAt
      : a.finishAt
        ? -1
        : b.finishAt
          ? 1
          : b.z - a.z,
  );
  const place = Math.max(1, ranked.findIndex((p) => p.id === self.current) + 1);
  const progress = Math.min(100, Math.round(((me?.z ?? 0) / FINISH_Z) * 100));

  return (
    <main
      className="slopewreck"
      {...partyRound(
        !!ended,
        ended
          ? partyGoal(
              w?.winner === self.current,
              (me?.z ?? 0) + (me?.style ?? 0) / 10,
            )
          : null,
      )}
    >
      <header className="slopewreck-top">
        <a
          href={party ? '/party' : '/'}
          className="slopewreck-back"
          aria-label={say('Back to games', 'Zurück zu den Spielen')}
        >
          <ArrowLeft size={20} />
        </a>
        <div className="slopewreck-logo">
          <MountainSnow size={23} />
          <span>
            SLOPE<span>WRECK</span>
          </span>
        </div>
        <GameToolbar
          voice={room.voice}
          multiplayer={<PeerRoomControls room={room} />}
          muted={muted}
          onToggleSound={() => {
            const next = !muted;
            setMuted(next);
            if (sound.current) {
              sound.current.enabled = !next;
              sound.current.unlock();
            }
          }}
          onHelp={() => setHelp(true)}
        />
      </header>
      <div className="slopewreck-canvas" ref={host} />
      <div
        className="slopewreck-hud"
        aria-label={say('Race status', 'Rennstand')}
      >
        <div>
          <small>{say('TIME LEFT', 'RESTZEIT')}</small>
          <strong>
            {String(Math.floor(remaining / 60)).padStart(2, '0')}:
            {String(remaining % 60).padStart(2, '0')}
          </strong>
        </div>
        <div>
          <small>{say('POSITION', 'PLATZ')}</small>
          <strong>
            {place}
            <em> / 4</em>
          </strong>
        </div>
        <div>
          <small>{say('SPEED', 'TEMPO')}</small>
          <strong>
            {Math.round((me?.speed ?? 0) * 3.6)}
            <em> km/h</em>
          </strong>
        </div>
      </div>
      <div className="slopewreck-progress">
        <span style={{ width: `${progress}%` }} />
        <b>
          <FlagTriangleRight size={17} />
        </b>
      </div>
      {!ready && !error && (
        <p className="slopewreck-message">
          {say('Loading the mountain…', 'Der Berg wird geladen…')}
        </p>
      )}
      {error && (
        <p className="slopewreck-message slopewreck-error" role="alert">
          {error}
        </p>
      )}
      {(lobby || ended) && w && (
        <section className="slopewreck-card">
          <small>
            {ended
              ? say('RACE COMPLETE', 'RENNEN BEENDET')
              : say(
                  'FOUR RIDERS. ONE MUTATING SLOPE.',
                  'VIER FAHRER. EIN WANDELNDER HANG.',
                )}
          </small>
          <h1>
            {ended ? (
              w.winner === self.current ? (
                say('You owned the mountain.', 'Der Berg gehört dir.')
              ) : (
                say('One more run?', 'Noch eine Abfahrt?')
              )
            ) : (
              <>
                {say('Build the run.', 'Bau die Strecke.')}
                <br />
                <em>{say('Break the race.', 'Spreng das Rennen.')}</em>
              </>
            )}
          </h1>
          <p>
            {ended
              ? say(
                  `You finished ${place}${place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'} with ${me?.style ?? 0} style points.`,
                  `Platz ${place} mit ${me?.style ?? 0} Style-Punkten.`,
                )
              : say(
                  'Jump, throw a trick, and leave a ramp or rail for everyone chasing you. Bad landings can make the best shortcuts.',
                  'Spring, zeig einen Trick und hinterlass deinen Verfolgern eine Rampe oder Schiene. Auch eine Bruchlandung kann die beste Abkürzung bauen.',
                )}
          </p>
          <div className="slopewreck-riders">
            {ranked.map((p, i) => (
              <div key={p.id}>
                <b>{i + 1}</b>
                <span>
                  {p.id === self.current ? say('YOU', 'DU') : p.name}
                  {p.bot ? ' · BOT' : ''}
                </span>
                <small>{Math.round((p.z / FINISH_Z) * 100)}%</small>
              </div>
            ))}
          </div>
          {!party ? (
            <button
              className="slopewreck-primary"
              disabled={disabled || !isHost}
              onClick={() => act(ended ? 'reset' : 'start')}
            >
              {isHost
                ? ended
                  ? say('Race again', 'Noch ein Rennen')
                  : say('Start the race', 'Rennen starten')
                : say('Waiting for host', 'Warte auf Host')}
              {ended ? <RotateCcw size={18} /> : <ArrowRight size={18} />}
            </button>
          ) : (
            <p className="slopewreck-party-note">
              {say(
                'The party host controls the round.',
                'Der Party-Host steuert die Runde.',
              )}
            </p>
          )}
          {!ended && (
            <span className="slopewreck-bots">
              {say(
                '1–4 players · Bots fill empty seats · 60 seconds',
                '1–4 Spieler · Bots füllen freie Plätze · 60 Sekunden',
              )}
            </span>
          )}
        </section>
      )}
      {w?.phase === 'racing' && (
        <>
          <div className="slopewreck-status" aria-live="polite">
            {me && w.clock < me.wipeoutUntil
              ? say('WIPEOUT! KEEP RIDING', 'STURZ! FAHR WEITER')
              : me?.trick
                ? say(
                    `BUILDING ${me.trick.toUpperCase()}`,
                    `BAUE ${me.trick === 'ramp' ? 'RAMPE' : 'SCHIENE'}`,
                  )
                : me && !me.grounded
                  ? say('Q RAMP  ·  E RAIL', 'Q RAMPE  ·  E SCHIENE')
                  : say(
                      'LAND A TRICK. CHANGE THE COURSE.',
                      'LANDE EINEN TRICK. ÄNDERE DIE STRECKE.',
                    )}
          </div>
          {!touch ? (
            <div className="slopewreck-keys">
              <span>
                <kbd>A</kbd>
                <kbd>D</kbd> {say('steer', 'lenken')}
              </span>
              <span>
                <kbd>W</kbd> {say('tuck', 'ducken')}
              </span>
              <span>
                <kbd>S</kbd> {say('brake', 'bremsen')}
              </span>
              <span>
                <kbd>Space</kbd> {say('jump', 'springen')}
              </span>
              <span>
                <kbd>Q</kbd> {say('ramp', 'Rampe')}
              </span>
              <span>
                <kbd>E</kbd> {say('rail', 'Schiene')}
              </span>
            </div>
          ) : (
            <div className="slopewreck-touch">
              <TouchControls
                disabled={disabled}
                move={(v) =>
                  controls.current.patch({
                    steer: v.x,
                    tuck: v.z < -0.35,
                    brake: v.z > 0.35,
                  })
                }
                jump={() => act('jump')}
                moveLabel={say('STEER', 'LENKEN')}
              />
              <div className="slopewreck-touch-actions">
                <button disabled={disabled} onClick={() => act('trick_ramp')}>
                  {say('RAMP', 'RAMPE')}
                </button>
                <button disabled={disabled} onClick={() => act('trick_rail')}>
                  {say('RAIL', 'SCHIENE')}
                </button>
                <button disabled={disabled} {...hold('tuck')}>
                  {say('TUCK', 'DUCKEN')}
                </button>
                <button disabled={disabled} {...hold('brake')}>
                  {say('BRAKE', 'BREMSEN')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {help && (
        <dialog
          open
          className="slopewreck-help"
          aria-modal="true"
          aria-label={say('How to play', 'Spielanleitung')}
        >
          <div>
            <HelpCircle size={27} />
            <h2>{say('Ride. Trick. Rebuild.', 'Fahr. Trickse. Bau um.')}</h2>
            <p>
              {say(
                'Steer around the markers. Hold W to tuck for speed or S to brake. Jump with Space; while airborne press Q for a ramp or E for a rail. Complete your spin before landing. Every trick leaves its feature behind for the other riders. Even a wipeout builds a wilder shortcut.',
                'Lenke zwischen den Markierungen. Halte W für Tempo oder S zum Bremsen. Springe mit Leertaste; drücke in der Luft Q für eine Rampe oder E für eine Schiene. Beende die Drehung vor der Landung. Jeder Trick hinterlässt ein Hindernis für die anderen. Auch ein Sturz baut eine wilde Abkürzung.',
              )}
            </p>
            <button onClick={() => setHelp(false)}>
              {say('Got it', 'Verstanden')}
            </button>
          </div>
        </dialog>
      )}
    </main>
  );
}
