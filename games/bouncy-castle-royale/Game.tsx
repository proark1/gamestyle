'use client';
/* oxlint-disable react/react-compiler -- The simulation, input and WebGL controllers deliberately live outside React. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type KeyboardEvent,
} from 'react';
import { ArrowLeft, ArrowUp, Castle, Hand, Shield, Wind } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
import { partyRound, partyVersus } from '../../shared/ui/party-round';
import { CastleAudio } from './audio';
import { CastleControls } from './controls';
import { castleAnalytics, castlePlayState } from './analytics';
import {
  advanceWorld,
  castleAction,
  freshWorld,
  nearPump,
  snapshot as makeSnapshot,
} from './simulation';
import {
  MATCH_MS,
  PRESETS,
  TARGET,
  idleInput,
  type Snapshot,
  type World,
} from './types';
import type { CastleScene } from './scene';
import './style.css';

const tracker = new GameTracker(castleAnalytics);
const subscribeParty = () => () => {};
const serverParty = () => false;
const keys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyF',
  'KeyQ',
  'KeyE',
  'ShiftLeft',
  'ShiftRight',
]);

export default function CastleGame() {
  const { language } = useLanguage(),
    de = language === 'de';
  const say = (en: string, german: string) => (de ? german : en);
  const party = useSyncExternalStore(subscribeParty, inPartyMode, serverParty);
  const touch = useMediaQuery(TOUCH_CONTROLS_QUERY);
  useGameTracker(tracker);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<CastleScene | null>(null),
    sound = useRef<CastleAudio | null>(null);
  const local = useRef<World | null>(null),
    self = useRef('local'),
    latest = useRef<Snapshot | null>(null);
  const controls = useRef(new CastleControls()),
    blocked = useRef(false),
    connected = useRef(false);
  const hud = useRef(
    hudPacer<Snapshot>(
      (s) =>
        `${s.world.phase}:${s.world.scores.red}:${s.world.scores.blue}:${s.world.air.red.preset}:${s.world.air.blue.preset}`,
    ),
  );
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [help, setHelp] = useState(false),
    [muted, setMuted] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false);
  const receive = useCallback((s: Snapshot) => {
    latest.current = s;
    scene.current?.render(s);
    sound.current?.update(s.world, self.current);
    if (hud.current.due(s)) {
      setSnap(s);
      tracker.observe(castlePlayState(s));
    }
  }, []);
  const room = usePeerRoom<Snapshot>({
    game: 'bouncy-castle-royale',
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
    (type: string, preset?: string) => {
      if (blocked.current || !gameActive()) return;
      sound.current?.unlock();
      tracker.action(type);
      setError('');
      const action = { type, ...(preset ? { preset } : {}) };
      if (send(action)) return;
      if (local.current) {
        try {
          castleAction(local.current, self.current, action, true);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : 'Could not perform that action.',
          );
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
      view: CastleScene | undefined;
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
      .then(({ CastleScene: Scene }) => {
        if (cancelled || !host.current) return;
        view = new Scene(host.current);
        scene.current = view;
        sound.current = new CastleAudio();
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
        if (!cancelled)
          setError('The castle could not load. Please reload the page.');
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
          'input,textarea,select,[contenteditable="true"],[role="dialog"]',
        ) ||
        (e.code === 'Space' && (e.target as HTMLElement)?.closest?.('button,a'))
      )
        return;
      e.preventDefault();
      controls.current.key(e.code, true);
      if (!e.repeat) {
        sound.current?.unlock();
        if (e.code === 'Space') act('jump');
        else if (e.code === 'KeyF') act('slap');
        else if (e.code === 'KeyQ') act('air');
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

  const hold = (key: 'brace' | 'pump') => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      controls.current.patch({ [key]: true });
      sound.current?.unlock();
    },
    onPointerUp: () => controls.current.patch({ [key]: false }),
    onPointerCancel: () => controls.current.patch({ [key]: false }),
    onLostPointerCapture: () => controls.current.patch({ [key]: false }),
    onBlur: () => controls.current.patch({ [key]: false }),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) controls.current.patch({ [key]: true });
      }
    },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter')
        controls.current.patch({ [key]: false });
    },
  });
  const w = snap?.world,
    me = w?.players.find((p) => p.id === self.current),
    team = me?.team ?? 'red',
    air = w?.air[team];
  const ended = w?.phase === 'ended',
    lobby = w?.phase === 'lobby';
  const isHost = !room.session || snap?.host === self.current;
  const remaining = w
    ? Math.max(
        0,
        Math.ceil((MATCH_MS - (w.started ? w.clock - w.started : 0)) / 1000),
      )
    : 180;
  const reason =
    w?.message === 'out'
      ? say('OUT!', 'AUS!')
      : w?.message === 'double'
        ? say('DOUBLE TOUCH', 'DOPPELBERÜHRUNG')
        : w?.message === 'four'
          ? say('FOUR TOUCHES', 'VIER BERÜHRUNGEN')
          : say('FLOOR HIT!', 'BODENTREFFER!');
  return (
    <main
      className="castle-game"
      {...partyRound(
        !!ended,
        ended ? partyVersus(team, w?.winner, w?.scores) : null,
      )}
    >
      <header className="castle-topbar">
        <a
          className="castle-back"
          href={party ? '/party' : '/'}
          aria-label={say('Back to games', 'Zurück zu den Spielen')}
        >
          <ArrowLeft size={19} />
        </a>
        <div className="castle-brand">
          <Castle size={23} />
          <span>
            BOUNCY CASTLE<small>ROYALE</small>
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
      <div className="castle-canvas" ref={host} />
      <section
        className="castle-scoreboard"
        aria-label={say('Match score', 'Spielstand')}
      >
        <span className="castle-red">
          {say('RED', 'ROT')} <b>{w?.scores.red ?? 0}</b>
        </span>
        <span className="castle-clock">
          <strong>
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, '0')}
          </strong>
          <small>{say(`FIRST TO ${TARGET}`, `BIS ${TARGET} PUNKTE`)}</small>
        </span>
        <span className="castle-blue">
          <b>{w?.scores.blue ?? 0}</b> {say('BLUE', 'BLAU')}
        </span>
      </section>
      {!ready && !error && (
        <p className="castle-loading">
          {say('Inflating the castle…', 'Die Burg wird aufgepumpt…')}
        </p>
      )}
      {error && (
        <p className="castle-error" role="alert">
          {error}
        </p>
      )}
      {w && !lobby && !ended && (
        <div className="castle-callout" aria-live="polite">
          {w.phase === 'serve'
            ? `${w.serving === 'red' ? say('RED SERVES', 'ROT SCHLÄGT AUF') : say('BLUE SERVES', 'BLAU SCHLÄGT AUF')} · ${Math.max(1, Math.ceil((w.until - w.clock) / 1000))}`
            : w.phase === 'point'
              ? reason
              : w.rally >= 3
                ? `${w.rally} ${say('HIT RALLY', 'BALLWECHSEL')}`
                : say(
                    'Jump. Volley. Cause a ripple.',
                    'Springen. Schlagen. Wellen machen.',
                  )}
        </div>
      )}
      {(lobby || ended) && (
        <section className="castle-lobby">
          <span className="castle-eyebrow">
            {ended
              ? say('FINAL WHISTLE', 'ABPFIFF')
              : say(
                  '2 vs 2 · INFLATABLE VOLLEYBALL',
                  '2 gegen 2 · HÜPFBURG-VOLLEYBALL',
                )}
          </span>
          <h1>
            {ended ? (
              w?.winner === 'draw' ? (
                say('Evenly bounced.', 'Gleichauf gehüpft.')
              ) : w?.winner === team ? (
                say('Reign of bounce.', 'Hüpfsieg!')
              ) : (
                say('Royal tumble.', 'Königlich gepurzelt.')
              )
            ) : (
              <>
                {say('Big bounce.', 'Große Sprünge.')}
                <br />
                <em>{say('Little control.', 'Kleine Kontrolle.')}</em>
              </>
            )}
          </h1>
          <p>
            {ended
              ? say(
                  `Best rally: ${w?.bestRally} hits. Ready for a rematch?`,
                  `Längster Ballwechsel: ${w?.bestRally} Schläge. Noch eine Runde?`,
                )
              : say(
                  'Land a jump. Launch your friends. Keep the ball off your half of the castle.',
                  'Lande einen Sprung. Schleudere deine Freunde hoch. Halte den Ball von deiner Burghälfte fern.',
                )}
          </p>
          <div className="castle-roster">
            {(['red', 'blue'] as const).map((t) => (
              <div key={t} className={`castle-${t}`}>
                <strong>
                  {t === 'red'
                    ? say('RED TEAM', 'TEAM ROT')
                    : say('BLUE TEAM', 'TEAM BLAU')}
                </strong>
                {w?.players
                  .filter((p) => p.team === t)
                  .map((p) => (
                    <span key={p.id}>
                      {p.id === self.current ? say('You', 'Du') : p.name}
                      <small>
                        {p.bot ? 'BOT' : p.id === self.current ? '★' : '●'}
                      </small>
                    </span>
                  ))}
              </div>
            ))}
          </div>
          {!party && (
            <div className="castle-lobby-actions">
              <button
                className="castle-primary"
                disabled={disabled || !isHost}
                onClick={() => act(ended ? 'reset' : 'start')}
              >
                {isHost
                  ? ended
                    ? say('Bounce again', 'Nochmal hüpfen')
                    : say('Let’s bounce', 'Los geht’s')
                  : say('Waiting for host…', 'Warte auf den Host…')}{' '}
                <ArrowUp size={18} />
              </button>
              <button
                className="castle-secondary"
                disabled={disabled}
                onClick={() => act('switch_team')}
              >
                {say('Switch team', 'Team wechseln')}
              </button>
            </div>
          )}
          {party && (
            <p>
              {say(
                'The party host controls the round.',
                'Der Party-Host steuert die Runde.',
              )}
            </p>
          )}
          {!ended && (
            <small className="castle-lobby-tip">
              {say(
                '1–4 players · Bots fill empty seats · No download',
                '1–4 Spieler · Bots füllen freie Plätze · Ohne Download',
              )}
            </small>
          )}
        </section>
      )}
      {w && !lobby && !ended && (
        <>
          <section
            className="castle-air"
            aria-label={say('Your team air supply', 'Luftvorrat deines Teams')}
          >
            <div className="castle-air-title">
              <Wind size={17} />
              <strong>{say('TEAM AIR', 'TEAM-LUFT')}</strong>
              <span>{Math.round((air?.pressure ?? 1) * 100)}%</span>
            </div>
            <meter
              min={0}
              max={1}
              value={air?.pressure ?? 1}
              aria-label={say('Air pressure', 'Luftdruck')}
            />
            <div className="castle-presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  disabled={disabled}
                  aria-pressed={air?.preset === preset}
                  onClick={() => act('air', preset)}
                >
                  {preset === 'floor'
                    ? say('Floor ↑', 'Boden ↑')
                    : preset === 'walls'
                      ? say('Walls ↑', 'Wände ↑')
                      : say('Bumpers ↑', 'Puffer ↑')}
                </button>
              ))}
            </div>
            <small>
              {air?.preset === 'floor'
                ? say(
                    'Bigger jumps · Lower walls',
                    'Höhere Sprünge · Niedrige Wände',
                  )
                : air?.preset === 'walls'
                  ? say(
                      'Safer walls · Smaller jumps',
                      'Sichere Wände · Kleinere Sprünge',
                    )
                  : say(
                      'Springy edges · Smaller jumps',
                      'Federnde Ränder · Kleinere Sprünge',
                    )}
            </small>
          </section>
          <div className="castle-pump-hint">
            {me && nearPump(me)
              ? say(
                  'Hold E / Pump to refill team air',
                  'E / Pumpe halten: Team-Luft auffüllen',
                )
              : (air?.pressure ?? 1) < 0.55
                ? say(
                    'Air is low! Find your gold pump.',
                    'Wenig Luft! Finde deine goldene Pumpe.',
                  )
                : `${say('YOU ARE', 'DU BIST')} ${team === 'red' ? say('RED', 'ROT') : say('BLUE', 'BLAU')}`}
          </div>
          {!touch && (
            <div className="castle-keyboard">
              <span>
                <kbd>WASD</kbd> {say('move', 'bewegen')}
              </span>
              <span>
                <kbd>Space</kbd> {say('jump', 'springen')}
              </span>
              <span>
                <kbd>F</kbd> {say('volley', 'schlagen')}
              </span>
              <span>
                <kbd>Shift</kbd> {say('brace', 'abfedern')}
              </span>
              <span>
                <kbd>E</kbd> {say('pump', 'pumpen')}
              </span>
              <span>
                <kbd>Q</kbd> {say('air', 'Luft')}
              </span>
            </div>
          )}
          {touch && (
            <div className="castle-touch">
              <TouchControls
                disabled={disabled}
                move={(v) => controls.current.patch(v)}
                jump={() => act('jump')}
                moveLabel={say('MOVE', 'BEWEGEN')}
              />
              <div className="castle-touch-actions">
                <button
                  disabled={disabled}
                  className="castle-volley"
                  onClick={() => act('slap')}
                >
                  <Hand size={23} />
                  {say('VOLLEY', 'SCHLAG')}
                </button>
                <button disabled={disabled} {...hold('brace')}>
                  <Shield size={18} />
                  {say('BRACE', 'ABFEDERN')}
                </button>
                <button disabled={disabled} {...hold('pump')}>
                  <Wind size={18} />
                  {say('PUMP', 'PUMPE')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="castle-help">
          <DialogTitle>{say('How to bounce', 'So wird gehüpft')}</DialogTitle>
          <p>
            {say(
              'First to 7 points, or lead when the 3-minute clock runs out. The ball hitting your floor gives the other team a point. Serves are automatic.',
              'Zuerst 7 Punkte erreichen oder nach 3 Minuten führen. Landet der Ball auf deinem Boden, punktet das andere Team. Aufschläge sind automatisch.',
            )}
          </p>
          <p>
            {say(
              'WASD / arrows move. Space jumps. F volleys a nearby ball; aim sideways with your movement. Hit while airborne for a smash. No consecutive hits by the same player; at most 3 team touches.',
              'WASD / Pfeile bewegen. Leertaste springt. F schlägt einen nahen Ball; mit der Bewegung seitlich zielen. In der Luft schmettern. Keine zwei Schläge desselben Spielers hintereinander; höchstens 3 Teamkontakte.',
            )}
          </p>
          <p>
            {say(
              'Landings send waves through the floor. Hold Shift to brace and soften waves. Q cycles the shared team air: floor for height, walls for protection, bumpers for powerful rebounds.',
              'Landungen schicken Wellen durch den Boden. Halte Shift zum Abfedern. Q verteilt die gemeinsame Team-Luft: Boden für Höhe, Wände zum Schutz, Puffer für starke Rückstöße.',
            )}
          </p>
          <p>
            {say(
              'Air slowly leaks during rallies. Hold E beside your gold pump to refill it. Touch buttons and the shared gamepad controls also work.',
              'Bei Ballwechseln entweicht Luft. Halte E neben deiner goldenen Pumpe zum Nachfüllen. Touch-Tasten und die gemeinsame Gamepad-Steuerung funktionieren ebenfalls.',
            )}
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
