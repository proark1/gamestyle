'use client';
/* oxlint-disable react/react-compiler -- Imperative simulation and WebGL controllers live in refs. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import {
  ArrowLeft,
  Hand,
  Shield,
  Zap,
  LockKeyhole,
  Footprints,
  Grip,
  Trophy,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import GameToolbar from '../../shared/ui/GameToolbar';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import { TouchControls } from '../../shared/input/TouchControls';
import { useMediaQuery } from '../../shared/browser/use-media-query';
import { TOUCH_CONTROLS_QUERY } from '../../shared/input/gestures';
import { gameActive } from '../../shared/browser/game-lifecycle';
import { useLanguage } from '../../shared/language/useLanguage';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { hudPacer } from '../../shared/ui/hud-pacer';
import type { CageScene } from './scene';
import { CageAudio } from './audio';
import { CageControls } from './controls';
import { GrappleReadout } from './GrappleReadout';
import { cageAnalytics, cagePlayState } from './analytics';
import {
  advanceWorld,
  fightAction,
  freshWorld,
  snapshot as makeSnapshot,
} from './simulation';
import { commitment, newNonce, resetSelection } from './selection';
import { STYLES, STYLE_IDS, isStyle, score } from './styles';
import {
  idleInput,
  type Snapshot,
  type World,
  type Style,
  type Input,
} from './types';
import './style.css';
const tracker = new GameTracker(cageAnalytics);
const cancelledInput = () => ({ ...idleInput(), cancel: true });
type Secret = { style: Style; nonce: string };
export default function CageGame() {
  const { language } = useLanguage(),
    de = language === 'de';
  const say = (en: string, german: string) => (de ? german : en);
  useGameTracker(tracker);
  const touch = useMediaQuery(TOUCH_CONTROLS_QUERY);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<CageScene | null>(null),
    sound = useRef<CageAudio | null>(null);
  const local = useRef<World | null>(null),
    self = useRef('local'),
    controls = useRef(new CageControls());
  const blocked = useRef(false),
    connected = useRef(false),
    latest = useRef<Snapshot | null>(null);
  const secrets = useRef(new Map<string, Secret>()),
    revealAt = useRef(0);
  const hud = useRef(
    hudPacer<Snapshot>(
      (s) =>
        `${s.world.phase}:${s.world.selection}:${s.world.players.map((p) => !!p.commitment).join()}:${s.world.grapple?.mode}`,
    ),
  );
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [help, setHelp] = useState(false),
    [muted, setMuted] = useState(false),
    [error, setError] = useState(''),
    [chosen, setChosen] = useState<Style>('mma');
  const receive = useCallback((s: Snapshot) => {
    latest.current = s;
    scene.current?.render(s);
    sound.current?.update(s.world, s.selfId);
    if (hud.current.due(s)) {
      setSnap(s);
      tracker.observe(cagePlayState(s));
    }
  }, []);
  const room = usePeerRoom<Snapshot>({
    game: 'cage-clash',
    loadEngine: () => import('./peer'),
    readInput: () =>
      blocked.current ? cancelledInput() : controls.current.read(),
    idleInput: cancelledInput,
    onAttach: (s) => {
      local.current = null;
      connected.current = true;
      self.current = s.id;
      sound.current?.resetEvents();
      controls.current.clear();
      scene.current?.setLocalPlayer(s.id);
      hud.current.reset();
    },
    onOpen: () => controls.current.clear(),
    receive,
  });
  const disabled =
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
    (action: Record<string, unknown>) => {
      setError('');
      if (send(action)) return;
      const w = local.current;
      if (!w) return;
      try {
        fightAction(w, self.current, action, true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not complete that action.',
        );
      }
      hud.current.reset();
      receive(makeSnapshot(w, 'SOLO', self.current, self.current, w.tick));
    },
    [send, receive],
  );
  const secretKey = (s: Snapshot) =>
    `cage-choice:${s.code}:${s.selfId}:${s.world.selection}`;
  function lockStyle() {
    const s = latest.current;
    if (!s || disabled) return;
    sound.current?.unlock();
    controls.current.clear();
    const key = secretKey(s),
      secret = secrets.current.get(key) ?? { style: chosen, nonce: newNonce() };
    setChosen(secret.style);
    secrets.current.set(key, secret);
    try {
      sessionStorage.setItem(key, JSON.stringify(secret));
    } catch {
      /* In-memory secret still supports this match. */
    }
    act({
      type: 'commit',
      selection: s.world.selection,
      commitment: commitment(
        s.world.selection,
        s.selfId,
        secret.style,
        secret.nonce,
      ),
    });
    tracker.action('commit');
  }
  useEffect(() => {
    if (
      !snap ||
      disabled ||
      snap.world.phase !== 'selection' ||
      !snap.world.players.every((p) => p.commitment)
    )
      return;
    const me = snap.world.players.find((p) => p.id === snap.selfId);
    if (!me || me.revealed || Date.now() - revealAt.current < 900) return;
    const key = secretKey(snap);
    let secret = secrets.current.get(key);
    if (!secret)
      try {
        const saved = JSON.parse(
          sessionStorage.getItem(key) ?? 'null',
        ) as Secret | null;
        if (saved && isStyle(saved.style) && typeof saved.nonce === 'string')
          secret = saved;
      } catch {
        /* An expired local secret is handled by the selection timeout. */
      }
    if (!secret) {
      setError(
        de
          ? 'Deine gespeicherte Wahl fehlt. Die Auswahl wird gleich zurückgesetzt.'
          : 'Your saved choice is unavailable. The selection will reset shortly.',
      );
      return;
    }
    revealAt.current = Date.now();
    act({ type: 'reveal', selection: snap.world.selection, ...secret });
  }, [snap, disabled, act, de]);
  useEffect(() => {
    let cancelled = false,
      frame = 0,
      view: CageScene | undefined;
    const clear = () => controls.current.clear();
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
      'ShiftLeft',
      'ShiftRight',
      'KeyQ',
      'KeyE',
      'KeyF',
    ]);
    const keyDown = (e: KeyboardEvent) => {
      if (
        blocked.current ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target as HTMLElement)?.closest?.(
          'input,textarea,select,[contenteditable="true"],[role="dialog"]',
        )
      )
        return;
      if (
        !keys.has(e.code) ||
        (e.code === 'Space' && (e.target as HTMLElement)?.closest?.('button,a'))
      )
        return;
      e.preventDefault();
      sound.current?.unlock();
      if (!e.repeat) controls.current.key(e.code, true);
    };
    const keyUp = (e: KeyboardEvent) => controls.current.key(e.code, false);
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    void import('./scene')
      .then(({ CageScene: Scene }) => {
        if (cancelled || !host.current) return;
        view = new Scene(host.current);
        scene.current = view;
        sound.current = new CageAudio();
        view.setLocalPlayer(self.current);
        if (!connected.current) {
          const w = freshWorld(Date.now());
          Object.assign(w.players[0], { id: 'local', name: 'You', bot: false });
          resetSelection(w);
          local.current = w;
          receive(makeSnapshot(w, 'SOLO', 'local', 'local', 0));
        } else if (latest.current) view.render(latest.current);
        let previous = performance.now(),
          publish = 0;
        const loop = (now: number) => {
          frame = requestAnimationFrame(loop);
          const dt = Math.min(100, now - previous);
          previous = now;
          const w = local.current;
          if (!w || !gameActive()) return;
          const p = w.players.find((p) => p.id === self.current);
          if (p)
            p.input = blocked.current
              ? cancelledInput()
              : controls.current.read();
          if (!blocked.current) advanceWorld(w, w.clock + dt);
          if (now - publish >= 32) {
            publish = now;
            receive(
              makeSnapshot(w, 'SOLO', self.current, self.current, w.tick),
            );
          }
        };
        frame = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'The cage could not start. Reload the page or try another browser.',
          );
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      view?.dispose();
      sound.current?.dispose();
      scene.current = null;
      sound.current = null;
      local.current = null;
    };
  }, [receive]);
  const w = snap?.world,
    me = w?.players.find((p) => p.id === self.current),
    foe = w?.players.find((p) => p.id !== self.current);
  const selecting = w?.phase === 'selection',
    ended = w?.phase === 'ended',
    g = w?.grapple,
    ground = !!g && g.mode !== 'clinch',
    top = g?.top === me?.id,
    submitting = !!g?.submissionBy,
    attackingSubmission = !!g && g.submissionBy === me?.id,
    pulse = !!g && g.age % 1.4 < 0.45;
  const hold = (
    key: keyof Pick<Input, 'punch' | 'kick' | 'grapple' | 'guard' | 'dodge'>,
  ) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || disabled || w?.phase !== 'playing') return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      controls.current.patch({ [key]: true });
      sound.current?.unlock();
    },
    onPointerUp: () => controls.current.patch({ [key]: false }),
    onPointerCancel: () => controls.current.clear(),
    onLostPointerCapture: () => controls.current.patch({ [key]: false }),
    onBlur: () => controls.current.patch({ [key]: false }),
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && w?.phase === 'playing')
          controls.current.patch({ [key]: true });
      }
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        controls.current.patch({ [key]: false });
      }
    },
  });
  const context = g?.submissionBy
    ? attackingSubmission
      ? pulse
        ? say(
            'SQUEEZE NOW — hold E. Release between gold pulses.',
            'JETZT ZIEHEN — E halten. Zwischen goldenen Pulsen loslassen.',
          )
        : say(
            'Wait for gold. Save stamina for the next squeeze.',
            'Warte auf Gold. Spare Ausdauer für den nächsten Zug.',
          )
      : pulse
        ? say(
            'DEFEND NOW — hold Shift, or hold Q to escape.',
            'JETZT ABWEHREN — Shift halten oder Q zur Flucht halten.',
          )
        : say(
            'Hold Q to escape. Hold Shift on gold to stop the submission.',
            'Q zum Entkommen halten. Shift im goldenen Fenster stoppt den Griff.',
          )
    : ground
      ? top
        ? say(
            'F: improve position · E: submission · Q: stand up',
            'F: Position verbessern · E: Aufgabegriff · Q: aufstehen',
          )
        : g?.mode === 'mount'
          ? say(
              'Hold F or Q to recover guard. Shift blocks strikes.',
              'F oder Q halten für Guard. Shift blockt Schläge.',
            )
          : say(
              'Hold F to reverse · Q to escape · E for submission',
              'F halten zum Umdrehen · Q zur Flucht · E für Aufgabegriff',
            )
      : g
        ? top
          ? say(
              'Hold E to drive a takedown. Shift defends; Q breaks away.',
              'E halten für Takedown. Shift verteidigt; Q löst den Griff.',
            )
          : say(
              'Hold Shift to resist. Hold Q to break free; tap E when they rest to reverse.',
              'Shift halten zur Abwehr. Q halten zum Lösen; E tippen, wenn der Gegner pausiert, zum Umdrehen.',
            )
        : me?.charge
          ? me.charge >= 0.4
            ? say(
                'HOOK READY — release Punch. Guard cancels.',
                'HAKEN BEREIT — Schlag loslassen. Deckung bricht ab.',
              )
            : say(
                'Hold Punch to load a hook. Release for a quick strike.',
                'Schlag halten für einen Haken. Kurz loslassen für einen schnellen Schlag.',
              )
          : me?.queuedMove
            ? say(
                'NEXT STRIKE QUEUED — guard or dodge to cancel.',
                'NÄCHSTER ANGRIFF VORGEMERKT — Deckung oder Ausweichen bricht ab.',
              )
            : me && me.stamina < 19
              ? say(
                  'LOW STAMINA — create space and recover.',
                  'WENIG AUSDAUER — Abstand schaffen und erholen.',
                )
              : say(
                  'Tap Punch for jab–cross. Queue your next strike as you recover.',
                  'Schlag tippen für Jab–Cross. Folgeangriff kurz vor der Erholung eingeben.',
                );
  return (
    <main className="cage-game">
      <div className="cage-canvas" ref={host} />
      <header className="topbar cage-topbar">
        <a href="/" className="wordmark">
          <ArrowLeft size={18} />
          <span>
            CAGE CLASH<span className="title-dot">.</span>
          </span>
        </a>
        <GameToolbar
          multiplayer={<PeerRoomControls room={room} />}
          voice={room.voice}
          muted={muted}
          onToggleSound={() => {
            setMuted(!muted);
            sound.current?.setMuted(!muted);
          }}
          onHelp={() => setHelp(true)}
        />
      </header>
      {error && (
        <output className="cage-error" role="alert">
          {error}
        </output>
      )}
      {!w && !error && (
        <output className="cage-loading">
          {say('Opening the cage…', 'Der Käfig öffnet sich…')}
        </output>
      )}
      {selecting && (
        <section className="cage-selection">
          <div className="cage-intro-copy">
            <span className="cage-eyebrow">
              {say('FOUR STYLES. ONE CAGE.', 'VIER STILE. EIN KÄFIG.')}
            </span>
            <h1>
              Cage <em>Clash.</em>
            </h1>
            <p>
              {say(
                'Pick your discipline. Keep them guessing.',
                'Wähle deinen Stil. Lass deinen Gegner rätseln.',
              )}
            </p>
            <span className="cage-format">
              {say(
                '1v1 · solo or with a friend · 3 × 60 seconds',
                '1 gegen 1 · solo oder mit Freund · 3 × 60 Sekunden',
              )}
            </span>
          </div>
          <div
            className="cage-style-grid"
            aria-label={say('Fighting style', 'Kampfstil')}
          >
            {STYLE_IDS.map((id, index) => (
              <button
                key={id}
                className={`cage-style ${chosen === id ? 'selected' : ''}`}
                aria-pressed={chosen === id}
                disabled={!!me?.commitment || disabled}
                onClick={() => setChosen(id)}
              >
                <span className="cage-style-number">0{index + 1}</span>
                <strong>{de ? STYLES[id].de : STYLES[id].name}</strong>
                <span>{de ? STYLES[id].german : STYLES[id].detail}</span>
                <div className="cage-style-bars">
                  {(
                    [
                      ['HANDS', 'punch'],
                      ['LEGS', 'kick'],
                      ['GROUND', 'ground'],
                    ] as const
                  ).map(([name, key]) => (
                    <label key={key}>
                      {de
                        ? { HANDS: 'HÄNDE', LEGS: 'BEINE', GROUND: 'BODEN' }[
                            name
                          ]
                        : name}
                      <i
                        style={{ width: `${(STYLES[id][key] / 1.4) * 100}%` }}
                      />
                    </label>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className="cage-lock-row">
            <div>
              <LockKeyhole size={16} />
              <span>
                {foe?.commitment
                  ? say(
                      'Opponent locked in. Their style is hidden.',
                      'Gegner hat gewählt. Sein Stil bleibt geheim.',
                    )
                  : say(
                      'Your opponent cannot see your choice.',
                      'Dein Gegner kann deine Wahl nicht sehen.',
                    )}
              </span>
            </div>
            <button
              className="cage-primary"
              disabled={!!me?.commitment || disabled}
              onClick={lockStyle}
            >
              {me?.commitment
                ? say(
                    'Locked — waiting for reveal…',
                    'Gewählt — warte auf Aufdeckung…',
                  )
                : say(
                    `Lock in ${STYLES[chosen].name}`,
                    `${STYLES[chosen].de} wählen`,
                  )}
            </button>
          </div>
          <div className="cage-intro-links">
            <button onClick={() => room.setOpen(true)}>
              {say('Invite a challenger', 'Gegner einladen')}
            </button>
            <button onClick={() => setHelp(true)}>
              {say('Learn the moves', 'Steuerung lernen')}
            </button>
            {!!me?.commitment && (
              <small>
                {say('Selection resets in', 'Auswahl wird zurückgesetzt in')}{' '}
                {Math.max(0, Math.ceil(30 - (w?.selectionTime ?? 0)))}s
              </small>
            )}
          </div>
        </section>
      )}
      {w && !selecting && (
        <section
          className="cage-score"
          aria-label={say('Fight status', 'Kampfstatus')}
        >
          {w.players.map((p) => (
            <div key={p.id} className={`cage-fighter-score ${p.team}`}>
              <span>{p.id === self.current ? say('YOU', 'DU') : p.name}</span>
              <strong>
                {p.style
                  ? de
                    ? STYLES[p.style].de
                    : STYLES[p.style].name
                  : '—'}
              </strong>
              <meter
                aria-label={`${p.name} health`}
                min={0}
                max={100}
                value={p.health}
              />
              <small>
                {Math.ceil(p.health)} HP · {score(p)} {say('pts', 'Pkt')}
              </small>
            </div>
          ))}
          <div className="cage-clock">
            <span>
              {say('ROUND', 'RUNDE')} {w.round}/3
            </span>
            <strong>
              {Math.floor(Math.ceil(w.time) / 60)}:
              {String(Math.ceil(w.time) % 60).padStart(2, '0')}
            </strong>
          </div>
        </section>
      )}
      {(w?.phase === 'countdown' || w?.phase === 'break') && (
        <output className="cage-announcement">
          <strong>{Math.max(1, Math.ceil(w.phaseTime))}</strong>
          <span>
            {w.phase === 'break'
              ? say('Breathe. Next round.', 'Durchatmen. Nächste Runde.')
              : say(
                  'Styles revealed. Find your distance.',
                  'Stile aufgedeckt. Finde deine Distanz.',
                )}
          </span>
        </output>
      )}
      {ended && (
        <section className="cage-result">
          <Trophy size={32} />
          <span className="cage-eyebrow">{w.finish}</span>
          <h1>
            {w.winner === 'draw'
              ? say('Evenly matched.', 'Unentschieden.')
              : w.winner === me?.team
                ? say('Your cage.', 'Dein Käfig.')
                : say('Next time.', 'Nächstes Mal.')}
          </h1>
          <p>
            {say(
              'Points = damage + 8 per takedown + 5 per position advance.',
              'Punkte = Schaden + 8 pro Takedown + 5 pro Positionsverbesserung.',
            )}
          </p>
          <div className="cage-result-scores">
            {w.players.map((p) => (
              <div key={p.id}>
                <strong>
                  {p.name}: {score(p)}
                </strong>
                <span>
                  {Math.round(p.damage)} {say('damage', 'Schaden')} ·{' '}
                  {p.takedowns} {say('takedowns', 'Takedowns')} · {p.advances}{' '}
                  {say('advances', 'Verbesserungen')}
                </span>
              </div>
            ))}
          </div>
          <button
            className="cage-primary"
            disabled={!!room.session && snap?.host !== self.current}
            onClick={() => {
              act({ type: 'reset' });
              tracker.action('reset');
            }}
          >
            {say('Rematch · choose again', 'Revanche · neu wählen')}
          </button>
        </section>
      )}
      {me && !selecting && !ended && (
        <>
          <section className="cage-status">
            <div>
              <strong>
                {g?.submissionBy
                  ? attackingSubmission
                    ? say('FINISH THE HOLD', 'GRIFF VOLLENDEN')
                    : say('ESCAPE THE HOLD', 'GRIFF LÖSEN')
                  : g
                    ? g.mode === 'clinch'
                      ? top
                        ? say('CLINCH · IN CONTROL', 'CLINCH · KONTROLLE')
                        : say('CLINCH · DEFENDING', 'CLINCH · ABWEHR')
                      : `${g.mode.toUpperCase()} · ${top ? say('YOU ON TOP', 'DU BIST OBEN') : say('YOU UNDERNEATH', 'DU BIST UNTEN')}`
                    : me.down
                      ? say('DOWN — COVER UP', 'AM BODEN')
                      : me.guarding
                        ? say('GUARD UP', 'DECKUNG OBEN')
                        : me.attack || me.cooldown
                          ? say('RECOVERING', 'ERHOLUNG')
                          : say('READY', 'BEREIT')}
              </strong>
              <span>
                {Math.round(me.stamina)}% {say('stamina', 'Ausdauer')}
              </span>
            </div>
            <meter
              aria-label={say('Stamina', 'Ausdauer')}
              min={0}
              max={100}
              value={me.stamina}
            />
            <p>{context}</p>
            {!g && me.charge > 0 && (
              <meter
                aria-label={say('Hook charge', 'Haken laden')}
                min={0}
                max={0.4}
                value={Math.min(0.4, me.charge)}
              />
            )}
            {g && <GrappleReadout grapple={g} player={me.id} de={de} />}
          </section>
          {touch && (
            <TouchControls
              disabled={disabled || w?.phase !== 'playing'}
              showJump={false}
              moveLabel={say('MOVE', 'BEWEGEN')}
              move={(vector) => controls.current.patch(vector)}
              jump={() => {}}
            />
          )}
          <div
            className="cage-actions"
            aria-label={say('Fight controls', 'Kampfsteuerung')}
          >
            <button
              className="cage-strike"
              disabled={disabled || w?.phase !== 'playing' || submitting}
              data-active={
                me.input.punch ||
                (!!me.attack && ['jab', 'cross', 'hook'].includes(me.move))
              }
              {...hold('punch')}
            >
              <Hand />
              <span>
                {me.charge >= 0.4
                  ? say('HOOK', 'HAKEN')
                  : say('PUNCH', 'SCHLAG')}
              </span>
              <kbd>Space</kbd>
            </button>
            <button
              disabled={
                disabled ||
                w?.phase !== 'playing' ||
                g?.mode === 'clinch' ||
                submitting
              }
              data-active={me.input.kick || (!!me.attack && me.move === 'kick')}
              {...hold('kick')}
            >
              <Footprints />
              <span>
                {ground
                  ? top
                    ? say('ADVANCE', 'VORRÜCKEN')
                    : g?.mode === 'mount'
                      ? say('RECOVER', 'BEFREIEN')
                      : say('REVERSE', 'UMDREHEN')
                  : say('KICK', 'TRITT')}
              </span>
              <kbd>F</kbd>
            </button>
            <button
              disabled={
                disabled ||
                w?.phase !== 'playing' ||
                (submitting && !attackingSubmission) ||
                (g?.mode === 'mount' && !top)
              }
              data-active={me.input.grapple}
              {...hold('grapple')}
            >
              <Grip />
              <span>
                {attackingSubmission
                  ? say('SQUEEZE', 'ZIEHEN')
                  : ground
                    ? say('SUBMIT', 'AUFGABE')
                    : g
                      ? say('TAKEDOWN', 'TAKEDOWN')
                      : say('GRAPPLE', 'GREIFEN')}
              </span>
              <kbd>E</kbd>
            </button>
            <button
              disabled={disabled || w?.phase !== 'playing'}
              data-active={me.guarding}
              {...hold('guard')}
            >
              <Shield />
              <span>
                {submitting && !attackingSubmission
                  ? say('DEFEND', 'ABWEHR')
                  : g?.mode === 'clinch' && !top
                    ? say('RESIST', 'ABWEHR')
                    : say('GUARD', 'DECKUNG')}
              </span>
              <kbd>Shift</kbd>
            </button>
            <button
              disabled={disabled || w?.phase !== 'playing'}
              data-active={!!me.dodge || (g && me.input.dodge)}
              {...hold('dodge')}
            >
              <Zap />
              <span>
                {g
                  ? ground && top && !submitting
                    ? say('STAND UP', 'AUFSTEHEN')
                    : say('ESCAPE', 'FLUCHT')
                  : say('DODGE', 'AUSWEICHEN')}
              </span>
              <kbd>Q</kbd>
            </button>
          </div>
          {!touch && (
            <div className="cage-movement">
              W A S D{' '}
              <span>
                {say(
                  'move · keep some stamina in reserve',
                  'bewegen · teile deine Ausdauer ein',
                )}
              </span>
            </div>
          )}
        </>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="cage-help">
          <DialogTitle>
            {say(
              'Win the exchange. Change the fight.',
              'Gewinne den Schlagabtausch.',
            )}
          </DialogTitle>
          <ol>
            <li>
              {say(
                'Choose a style privately. Both fighters lock before either style is revealed. Every style can use every move.',
                'Wähle geheim. Beide wählen verbindlich, bevor die Stile erscheinen. Jeder Stil kann alle Aktionen nutzen.',
              )}
            </li>
            <li>
              {say(
                'WASD or joystick moves; you face your opponent. Tap and release Space for a jab, then a cross. Hold and release for a hook. F kicks.',
                'WASD oder Joystick bewegt; du schaust zum Gegner. Leertaste tippen und loslassen: Jab, dann Gerade. Halten und loslassen: Haken. F tritt.',
              )}
            </li>
            <li>
              {say(
                'Shift guards. Raise it just before contact to parry. Q dodges. Heavy misses and low stamina leave openings.',
                'Shift blockt. Kurz vor Kontakt hochziehen: Parade. Q weicht aus. Schwere Fehlschläge und wenig Ausdauer öffnen die Deckung.',
              )}
            </li>
            <li>
              {say(
                'E grabs at close range; keep holding to drive a takedown. The defender guards or holds Q to escape. Tap E while the attacker rests to reverse the clinch.',
                'E greift aus der Nähe; halten für einen Takedown. Der Verteidiger blockt oder hält Q zur Flucht. E tippen, wenn der Angreifer pausiert, dreht den Clinch um.',
              )}
            </li>
            <li>
              {say(
                'On the ground: Space strikes. Hold F to gain mount from top, or reverse from below. Q escapes; escaping mount first returns to guard. A top fighter can stand up with Q.',
                'Am Boden: Leertaste schlägt. F halten verbessert oben die Position oder dreht sie unten um. Q befreit; aus Mount geht es zuerst zurück in Guard. Oben kannst du mit Q aufstehen.',
              )}
            </li>
            <li>
              {say(
                'Tap E for a submission, then hold E during the gold pulse. Defenders time Shift or hold Q. Submissions cost stamina and can fail. Bottom submissions require guard.',
                'E startet einen Aufgabegriff; halte E im goldenen Zeitfenster. Verteidiger timen Shift oder halten Q. Griffe kosten Ausdauer und können scheitern. Unten sind sie nur aus Guard möglich.',
              )}
            </li>
            <li>
              {say(
                'Three 60-second rounds. Win by KO, submission or points: damage dealt + 8 per takedown + 5 per positional advance. Knockdowns allow a brief E follow-up.',
                'Drei Runden à 60 Sekunden. Sieg durch KO, Aufgabe oder Punkte: Schaden + 8 pro Takedown + 5 pro Positionsverbesserung. Nach Niederschlägen kannst du kurz mit E folgen.',
              )}
            </li>
          </ol>
          <button className="cage-primary" onClick={() => setHelp(false)}>
            {say('Enter the cage', 'In den Käfig')}
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
