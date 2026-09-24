'use client';
/* oxlint-disable react/react-compiler -- Transient simulation, input and WebGL state live in refs outside React. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
  type KeyboardEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  RotateCcw,
  Trophy,
  CalendarDays,
  Wine,
  HatGlasses,
  Cone,
  Footprints,
  CookingPot,
  WashingMachine,
  LockKeyhole,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import GameToolbar from '../../shared/ui/GameToolbar';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import { gameActive } from '../../shared/browser/game-lifecycle';
import { useLanguage } from '../../shared/language/useLanguage';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { inPartyMode } from '../../shared/ui/party-mode';
import { partyGoal, partyRound } from '../../shared/ui/party-round';
import { FlipAudio } from './audio';
import { FlipControls } from './controls';
import { flipAnalytics, flipPlayState } from './analytics';
import {
  advanceWorld,
  airborne,
  canBank,
  flipAction,
  freshWorld,
  snapshot as makeSnapshot,
} from './simulation';
import {
  COLORS,
  OBJECTS,
  charge,
  idleInput,
  type Snapshot,
  type World,
} from './types';
import type { FlipScene } from './scene';
import './style.css';

const tracker = new GameTracker(flipAnalytics);
const icons = [Wine, HatGlasses, Cone, Footprints, CookingPot, WashingMachine];
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
  'KeyQ',
  'KeyE',
]);

export default function FlipGame() {
  const { language } = useLanguage(),
    de = language === 'de';
  const say = (en: string, german: string) => (de ? german : en);
  const party = useSyncExternalStore(subscribeParty, inPartyMode, serverParty);
  useGameTracker(tracker);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<FlipScene | null>(null),
    sound = useRef<FlipAudio | null>(null);
  const local = useRef<World | null>(null),
    self = useRef('local'),
    latest = useRef<Snapshot | null>(null);
  const controls = useRef(new FlipControls()),
    blocked = useRef(false),
    connected = useRef(false);
  const hud = useRef(
    hudPacer<Snapshot>(
      (s) =>
        `${s.world.phase}:${s.world.mode}:${s.world.players.map((p) => `${p.score}:${p.pending}:${p.selected}:${p.last}`).join(':')}`,
    ),
  );
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [help, setHelp] = useState(false),
    [muted, setMuted] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [best, setBest] = useState(0);
  const receive = useCallback((s: Snapshot) => {
    latest.current = s;
    scene.current?.render(s);
    sound.current?.update(s.world, self.current);
    if (hud.current.due(s)) {
      setSnap(s);
      tracker.observe(flipPlayState(s));
    }
  }, []);
  const room = usePeerRoom<Snapshot>({
    game: 'flip-happens',
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
    if (disabled) {
      controls.current.clear();
      const p = local.current?.players.find((q) => q.id === self.current);
      if (p) p.chargingAt = null;
    }
  }, [disabled]);
  const { send } = room;
  const act = useCallback(
    (type: string, extra: Record<string, unknown> = {}) => {
      if (blocked.current || !gameActive()) return;
      sound.current?.unlock();
      if (!['charge', 'throw', 'cancel'].includes(type)) tracker.action(type);
      setError('');
      const action = { type, ...extra };
      if (send(action)) return;
      if (local.current) {
        try {
          flipAction(local.current, self.current, action, true);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : 'That action did not work.',
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
      view: FlipScene | undefined,
      previous = performance.now(),
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
      .then(({ FlipScene: Scene }) => {
        if (cancelled || !host.current) return;
        view = new Scene(host.current);
        scene.current = view;
        sound.current = new FlipAudio();
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
          setError('The table could not load. Please reload the page.');
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
        if (e.code === 'Space') act('charge');
        else if (e.code === 'KeyQ') act('bank');
        else if (e.code === 'KeyE') act('select');
      }
    };
    const up = (e: globalThis.KeyboardEvent) => {
      controls.current.key(e.code, false);
      if (
        e.code === 'Space' &&
        !e.defaultPrevented &&
        !(e.target as HTMLElement)?.closest?.(
          'button,a,input,textarea,[role="dialog"]',
        )
      )
        act('throw');
    };
    const clear = () => {
      controls.current.clear();
      act('cancel');
    };
    const visibility = () => {
      if (document.hidden) {
        controls.current.clear();
        const p = local.current?.players.find((q) => q.id === self.current);
        if (p) p.chargingAt = null;
        send({ type: 'cancel' });
      }
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
  }, [act, receive, send]);
  const w = snap?.world,
    me = w?.players.find((p) => p.id === self.current);
  const ended = w?.phase === 'ended',
    lobby = w?.phase === 'lobby',
    daily = w?.mode === 'daily';
  const day = w?.day,
    finalScore = ended && daily ? (me?.score ?? 0) : 0;
  useEffect(() => {
    if (!day) return;
    try {
      const key = `jumbleyard:flip-daily:v1:${day}`,
        saved = Number(localStorage.getItem(key));
      const score = Math.max(
        Number.isFinite(saved) && saved > 0 ? saved : 0,
        finalScore,
      );
      setBest(score);
      if (finalScore) localStorage.setItem(key, String(score));
    } catch {
      setBest(finalScore);
    }
  }, [day, finalScore]);
  const isHost = !room.session || snap?.host === self.current,
    item = OBJECTS[me?.selected ?? 0];
  const inAir = !!(w && me && airborne(w, me)),
    power = w && me ? charge(w, me) : 0;
  const remaining = w
    ? Math.max(
        0,
        Math.ceil(
          (w.duration - (w.phase === 'lobby' ? 0 : w.clock - w.started)) / 1000,
        ),
      )
    : 120;
  const hold = {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      act('charge');
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      act('throw');
    },
    onPointerCancel: () => act('cancel'),
    onLostPointerCapture: () => act('cancel'),
    onBlur: () => act('cancel'),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) act('charge');
      }
    },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        act('throw');
      }
    },
  };
  const aim = (e: PointerEvent<HTMLDivElement>) => {
    if (
      disabled ||
      (e.type === 'pointermove' && e.pointerType === 'touch' && !e.buttons)
    )
      return;
    const point = scene.current?.aim(e.clientX, e.clientY);
    if (point) controls.current.aim(point.x, point.z);
  };
  const activePlayers = w?.players.filter((p) => !daily || !p.bot) ?? [];
  return (
    <main
      className={`flip-game ${lobby || ended ? 'flip-between' : ''}`}
      {...partyRound(!!ended, ended ? partyGoal(true, me?.score ?? 0) : null)}
    >
      <header className="flip-topbar">
        <a
          className="flip-back"
          href={party ? '/party' : '/'}
          aria-label={say('Back to games', 'Zurück zu den Spielen')}
        >
          <ArrowLeft size={19} />
        </a>
        <div className="flip-brand">
          <RotateCcw size={26} />
          <span>
            FLIP<small>HAPPENS</small>
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
      <div
        className="flip-canvas"
        ref={host}
        onPointerDown={aim}
        onPointerMove={aim}
      />
      {!ready && !error && (
        <p className="flip-loading">
          {say('Setting the table…', 'Der Tisch wird gedeckt…')}
        </p>
      )}
      {error && (
        <p className="flip-error" role="alert">
          {error}
        </p>
      )}
      {w && (
        <section
          className="flip-scoreboard"
          aria-label={say('Banked points', 'Gesicherte Punkte')}
        >
          <div className="flip-timer">
            <strong>
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, '0')}
            </strong>
            <small>
              {daily
                ? say('DAILY', 'TÄGLICH')
                : say('BANKED POINTS', 'SICHERE PUNKTE')}
            </small>
          </div>
          {activePlayers.map((p) => (
            <div
              key={p.id}
              className={`flip-score ${p.id === self.current ? 'is-you' : ''}`}
              style={{ '--seat': COLORS[p.seat] } as CSSProperties}
            >
              <span>
                {p.id === self.current ? say('You', 'Du') : p.name}
                <small>{p.bot ? 'BOT' : '●'}</small>
              </span>
              <b>{p.score}</b>
            </div>
          ))}
        </section>
      )}
      {(lobby || ended) && (
        <section className="flip-lobby">
          <span className="flip-eyebrow">
            {ended
              ? say('THE TABLE HAS SPOKEN', 'DER TISCH HAT ENTSCHIEDEN')
              : say(
                  'SMALL OBJECTS. BIG CONSEQUENCES.',
                  'KLEINE DINGE. GROSSE FOLGEN.',
                )}
          </span>
          <h1>
            {ended ? (
              daily ? (
                `${me?.score ?? 0} ${say('points.', 'Punkte.')}`
              ) : w?.winner === 'draw' ? (
                say('Perfectly tied.', 'Perfekt gleichauf.')
              ) : w?.winner === me?.id ? (
                say('Flipping brilliant.', 'Umwerfend gut.')
              ) : (
                say('Flip happens.', 'Dumm gelaufen.')
              )
            ) : (
              <>
                {say('One more flip.', 'Noch ein Wurf.')}
                <br />
                <em>
                  {say('What could go wrong?', 'Was soll schon schiefgehen?')}
                </em>
              </>
            )}
          </h1>
          <p>
            {ended
              ? say(
                  `${me?.lands ?? 0} upright landings. Best combo: ×${me?.bestCombo ?? 0}.`,
                  `${me?.lands ?? 0} saubere Landungen. Beste Kombo: ×${me?.bestCombo ?? 0}.`,
                )
              : say(
                  'Land it. Bank it. Or risk the whole combo with a washing machine.',
                  'Lande. Sichere. Oder riskiere die ganze Kombo mit einer Waschmaschine.',
                )}
          </p>
          {!party && (
            <div
              className="flip-modes"
              aria-label={say('Game mode', 'Spielmodus')}
            >
              <button
                disabled={disabled || !!room.session}
                aria-pressed={!daily}
                onClick={() => act('mode', { mode: 'versus' })}
              >
                <Trophy size={16} />
                {say('Table chaos', 'Tisch-Chaos')}
              </button>
              <button
                disabled={disabled || !!room.session}
                aria-pressed={daily}
                onClick={() => act('mode', { mode: 'daily' })}
              >
                <CalendarDays size={16} />
                {say('Daily flip', 'Tages-Challenge')}
              </button>
            </div>
          )}
          {daily ? (
            <p className="flip-daily-note">
              {day} ·{' '}
              {say(
                '60 seconds · Same objects and table nudges for everyone.',
                '60 Sekunden · Gleiche Gegenstände und Tischstöße für alle.',
              )}
              <strong>
                {say('Best on this device', 'Bestwert auf diesem Gerät')}:{' '}
                {best}
              </strong>
            </p>
          ) : (
            <div className="flip-roster">
              {w?.players.map((p) => (
                <span key={p.id}>
                  <i style={{ background: COLORS[p.seat] }} />
                  {p.id === self.current ? say('You', 'Du') : p.name}
                  <small>{p.bot ? 'BOT' : '●'}</small>
                </span>
              ))}
            </div>
          )}
          {!party ? (
            <button
              className="flip-primary flip-start"
              disabled={disabled || !isHost}
              onClick={() => act(ended ? 'reset' : 'start')}
            >
              {!isHost
                ? say('Waiting for host…', 'Warte auf den Host…')
                : ended
                  ? say('Flip again', 'Nochmal werfen')
                  : say('Start flipping', 'Loswerfen')}
              <ArrowUpRight size={21} />
            </button>
          ) : (
            <p>
              {say(
                'The party host starts the round.',
                'Der Party-Host startet die Runde.',
              )}
            </p>
          )}
          <small className="flip-lobby-tip">
            {daily
              ? say(
                  'Solo · A new challenge every day (UTC)',
                  'Solo · Jeden Tag eine neue Challenge (UTC)',
                )
              : say(
                  '1–4 players · Bots fill empty seats',
                  '1–4 Spieler · Bots füllen freie Plätze',
                )}
          </small>
        </section>
      )}
      {w && me && !lobby && !ended && (
        <>
          <div className={`flip-callout flip-${me.last}`} aria-live="polite">
            {w.clock - me.lastAt < 1700 && me.last !== 'throw' && me.last
              ? me.last === 'land'
                ? say(
                    `LANDED! COMBO ×${me.combo}`,
                    `GELANDET! KOMBO ×${me.combo}`,
                  )
                : me.last === 'bank'
                  ? say('SAFE IN THE BANK.', 'SICHER AUF DEM KONTO.')
                  : say('OOPS. COMBO GONE.', 'UPS. KOMBO WEG.')
              : daily
                ? say(
                    'Same table. One minute. Make it count.',
                    'Gleicher Tisch. Eine Minute. Hol alles raus.',
                  )
                : say(
                    'Heavy landings bounce everybody’s stuff.',
                    'Schwere Landungen lassen alles hüpfen.',
                  )}
          </div>
          <section
            className="flip-console"
            aria-label={say('Flip controls', 'Wurfsteuerung')}
          >
            <div className="flip-inventory">
              {OBJECTS.map((o, i) => {
                const Icon = icons[i];
                return (
                  <button
                    key={o.id}
                    disabled={
                      disabled || daily || inAir || me.chargingAt !== null
                    }
                    aria-pressed={me.selected === i}
                    aria-label={`${de ? o.de : o.en} · ${o.points} ${say('points', 'Punkte')}`}
                    onClick={() => act('select', { object: i })}
                  >
                    <Icon size={22} />
                    <span>{de ? o.de : o.en}</span>
                    <small>
                      {o.points} {say('pts', 'Pkt')}
                    </small>
                  </button>
                );
              })}
            </div>
            <div className="flip-actions">
              <div className="flip-risk">
                <small>
                  {say('AT RISK', 'IM RISIKO')} <b>×{Math.max(1, me.combo)}</b>
                </small>
                <strong>+{me.pending}</strong>
                <button
                  className="flip-bank"
                  disabled={disabled || !canBank(w, me)}
                  onClick={() => act('bank')}
                >
                  <LockKeyhole size={16} />
                  {say('Bank', 'Sichern')} <kbd>Q</kbd>
                </button>
              </div>
              <div className="flip-charge-wrap">
                <div className="flip-charge-title">
                  <strong>{de ? item.de : item.en}</strong>
                  <span>
                    {inAir
                      ? say('In the air…', 'In der Luft…')
                      : me.chargingAt !== null
                        ? say('Release in gold!', 'Bei Gold loslassen!')
                        : say('Hold, then release', 'Halten, dann loslassen')}
                  </span>
                </div>
                <meter
                  className="sr-only"
                  aria-label={say('Throw power', 'Wurfkraft')}
                  min={0}
                  max={100}
                  value={Math.round(power * 100)}
                />
                <div className="flip-meter" aria-hidden="true">
                  <span
                    className="flip-sweet"
                    style={{
                      left: `${(item.ideal - item.tolerance / (Math.PI * 2 * 1.3)) * 100}%`,
                      width: `${(item.tolerance / (Math.PI * 1.3)) * 100}%`,
                    }}
                  />
                  <i style={{ left: `${power * 100}%` }} />
                </div>
                <small>
                  {say(
                    'Aim at the table · Gold means upright on a level table',
                    'Auf den Tisch zielen · Gold landet auf ebenem Tisch aufrecht',
                  )}
                </small>
              </div>
              <button
                className={`flip-primary flip-throw ${me.chargingAt !== null ? 'is-charging' : ''}`}
                disabled={disabled || inAir || w.clock < me.readyAt}
                {...hold}
              >
                <RotateCcw size={24} />
                {inAir
                  ? say('Flying!', 'Fliegt!')
                  : me.chargingAt !== null
                    ? say('Release!', 'Loslassen!')
                    : say('Hold to flip', 'Halten & werfen')}
                <kbd>Space</kbd>
              </button>
            </div>
            <p className="flip-keyboard">
              {say(
                'Mouse / touch or WASD: aim · Space: hold & release · Q: bank · E: next object',
                'Maus / Touch oder WASD: zielen · Leertaste: halten & loslassen · Q: sichern · E: nächstes Objekt',
              )}
              {daily && ` · ${say('Daily best', 'Tagesbestwert')}: ${best}`}
            </p>
          </section>
        </>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="flip-help">
          <DialogTitle>
            {say(
              'A little skill. A lot of chaos.',
              'Etwas Geschick. Viel Chaos.',
            )}
          </DialogTitle>
          <p>
            {say(
              'Aim by pointing or tapping on the table, or use WASD / arrows. Hold Space or “Hold to flip”, then release while the marker is in the gold band. Each object has a different timing. A tilting table makes it harder.',
              'Ziele mit Maus, Touch oder WASD / Pfeilen auf den Tisch. Halte die Leertaste oder „Halten & werfen“ und lasse los, wenn die Markierung im goldenen Bereich ist. Jedes Objekt hat ein anderes Timing. Ein kippender Tisch macht es schwieriger.',
            )}
          </p>
          <p>
            {say(
              'Upright landings add points times your combo (up to ×8). Q / Bank secures them and resets the combo. A failed throw or an unbanked object falling off loses the whole pending combo. Banked points stay safe. You cannot bank during a throw.',
              'Aufrechte Landungen geben Punkte mal Kombo (bis ×8). Q / Sichern rettet die Punkte und setzt die Kombo zurück. Ein Fehlwurf oder ein herunterfallendes ungesichertes Objekt kostet die ganze offene Kombo. Sichere Punkte bleiben. Während eines Wurfs kannst du nicht sichern.',
            )}
          </p>
          <p>
            {say(
              'Click an object or press E to switch. Heavier objects score more and kick nearby props into the air. After two minutes, stable pending points are banked; unfinished throws do not score. Most points wins.',
              'Wähle ein Objekt oder drücke E. Schwere Objekte geben mehr Punkte und schleudern nahe Gegenstände hoch. Nach zwei Minuten werden stabile offene Punkte gesichert; laufende Würfe geben keine Punkte. Die meisten Punkte gewinnen.',
            )}
          </p>
          <p>
            {say(
              'Daily flip is a 60-second solo challenge: the same object order and table nudges each UTC day. Your best is saved on this device. In rooms and parties, everyone plays Table chaos.',
              'Die Tages-Challenge dauert 60 Sekunden solo: dieselbe Objektreihenfolge und dieselben Tischstöße pro UTC-Tag. Der Bestwert bleibt auf diesem Gerät. In Räumen und Partys spielt ihr Tisch-Chaos.',
            )}
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
