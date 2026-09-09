'use client';
/* eslint-disable next/no-img-element -- Local collection illustration on both hosting targets. */
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token. */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  Check,
  CircleDot,
  Coins,
  Copy,
  DoorOpen,
  Hand,
  Heart,
  LoaderCircle,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import GameToolbar from '../../shared/ui/GameToolbar';
import { TouchControls } from '../../shared/input/TouchControls';
import {
  PeerGameConnection,
  enterPeerRoom,
} from '../../shared/peer/connection';
import {
  advanceButton,
  buttonAction,
  buttonSnapshot,
  doorOpen,
  freshButton,
  newContestant,
} from './simulation';
import {
  COLORS,
  EXIT,
  HAZARD_NAMES,
  MAX_PRESSES,
  ROUND_MS,
  idleInput,
  money,
  prizeForPress,
  type ButtonAction,
  type ButtonSession,
  type ButtonSnapshot,
  type ButtonWorld,
} from './types';
import { ButtonSound } from './audio';
import type { ButtonScene } from './scene';
import './style.css';
const SESSION_KEY = 'one-more-button-session-v1';
const time = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export default function OneMoreButton() {
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<ButtonScene | null>(null),
    sound = useRef<ButtonSound | null>(null),
    network = useRef<PeerGameConnection<ButtonSnapshot> | null>(null),
    local = useRef<ButtonWorld | null>(null),
    activeSession = useRef<ButtonSession | null>(null),
    latest = useRef<ButtonSnapshot | null>(null),
    input = useRef(idleInput()),
    actionRef = useRef<(a: ButtonAction) => void>(() => {}),
    hudAt = useRef(0);
  const [snapshot, setSnapshot] = useState<ButtonSnapshot | null>(null),
    [session, setSession] = useState<ButtonSession | null>(null),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [muted, setMuted] = useState(false),
    [notice, setNotice] = useState(''),
    [copied, setCopied] = useState(false),
    [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
      'online',
    ),
    [modal, setModal] = useState<'help' | 'join' | 'invite' | 'leave' | null>(
      null,
    );
  const w = snapshot?.world,
    me = w?.players.find((p) => p.id === session?.id),
    playing = w?.phase === 'playing' || w?.phase === 'escape',
    done = w?.phase === 'won' || w?.phase === 'lost',
    captain = snapshot?.host === session?.id,
    practice = session?.code === 'PRACTICE';
  function accept(next: ButtonSnapshot) {
    if (!activeSession.current) return;
    const previous = latest.current;
    latest.current = next;
    scene.current?.setSnapshot(next);
    sound.current?.update(next.world, activeSession.current.id);
    if (
      !previous ||
      previous.world.phase !== next.world.phase ||
      previous.world.eventId !== next.world.eventId ||
      performance.now() - hudAt.current > 90
    ) {
      hudAt.current = performance.now();
      setSnapshot(next);
    }
  }
  function attach(s: ButtonSession, state?: ButtonSnapshot) {
    network.current?.stop();
    local.current = null;
    activeSession.current = s;
    latest.current = null;
    input.current = idleInput();
    setSession(s);
    setStatus('reconnecting');
    sound.current?.reset();
    scene.current?.setSession(s.id);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* Storage may be disabled. */
    }
    network.current = new PeerGameConnection(
      'one-more-button',
      s,
      () => input.current,
      accept,
      setStatus,
      () => import('./peer'),
    );
    if (state) accept(state);
    network.current.start();
  }
  useEffect(() => {
    let disposed = false;
    const audio = new ButtonSound();
    sound.current = audio;
    try {
      const saved = JSON.parse(
        localStorage.getItem('one-more-button-prefs-v1') || '{}',
      );
      queueMicrotask(() => {
        if (!disposed) {
          setName(typeof saved.name === 'string' ? saved.name : '');
          setMuted(saved.muted === true);
        }
      });
      audio.enabled = saved.muted !== true;
    } catch {
      /* Preferences are optional. */
    }
    const invite = new URL(location.href).searchParams.get('room');
    if (invite && /^[A-Z2-9]{6}$/i.test(invite))
      queueMicrotask(() => {
        if (!disposed) {
          setCode(invite.toUpperCase());
          setModal('join');
        }
      });
    void import('./scene')
      .then(({ ButtonScene }) => {
        if (disposed || !container.current) return;
        try {
          scene.current = new ButtonScene(container.current, {
            input: (next) => {
              input.current = next;
              const p = local.current?.players[0];
              if (p) {
                p.input = next;
                p.seen = local.current!.clock;
              }
            },
            action: (a) => actionRef.current(a),
            failure: () => {
              setReady(false);
              setNotice(
                'The stage display stopped. Reload to rejoin the show.',
              );
            },
            tick: () => {
              const world = local.current,
                s = activeSession.current;
              if (!world || !s) return;
              advanceButton(world, Date.now());
              accept(buttonSnapshot(world, s.code, s.id, s.id, world.clock));
            },
          });
          setReady(true);
          if (!invite)
            try {
              const saved = JSON.parse(
                sessionStorage.getItem(SESSION_KEY) || 'null',
              );
              if (
                saved?.peer === true &&
                /^[A-Z2-9]{6}$/.test(saved.code) &&
                typeof saved.id === 'string' &&
                typeof saved.token === 'string'
              )
                attach(saved);
            } catch {
              /* A new session can always be created. */
            }
        } catch {
          setNotice(
            'The stage could not load. Enable hardware acceleration and reload to play.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The stage could not load. Reload and try again.');
      });
    return () => {
      disposed = true;
      network.current?.stop();
      network.current = null;
      scene.current?.dispose();
      scene.current = null;
      audio.dispose();
      sound.current = null;
    };
  }, []);
  function savePrefs() {
    try {
      localStorage.setItem(
        'one-more-button-prefs-v1',
        JSON.stringify({ name, muted }),
      );
    } catch {
      /* Preferences are optional. */
    }
  }
  async function enter(op: 'create' | 'join') {
    if (busy || !ready) return;
    setBusy(true);
    setNotice('');
    sound.current?.unlock();
    savePrefs();
    try {
      const reply = await enterPeerRoom<ButtonSnapshot>(
        'one-more-button',
        {
          op,
          name: name.trim() || 'Contestant',
          ...(op === 'join' ? { code: code.toUpperCase().trim() } : {}),
        },
        () => import('./peer'),
      );
      if (!reply.session)
        throw new Error('The show could not be joined. Try again.');
      attach(reply.session, reply.snapshot);
      setModal(null);
      history.replaceState(
        null,
        '',
        `/one-more-button?room=${reply.session.code}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not reach the show. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  function startPractice() {
    if (!ready || busy) return;
    network.current?.stop();
    network.current = null;
    input.current = idleInput();
    sound.current?.unlock();
    sound.current?.reset();
    savePrefs();
    const now = Date.now(),
      world = freshButton(now),
      s = { code: 'PRACTICE', id: 'practice-contestant', token: '' };
    world.players.push(newContestant(s.id, name.trim() || 'You', 0, now));
    buttonAction(world, s.id, { type: 'start' }, s.id);
    local.current = world;
    activeSession.current = s;
    setSession(s);
    setStatus('online');
    setNotice('');
    latest.current = null;
    scene.current?.setSession(s.id);
    accept(buttonSnapshot(world, s.code, s.id, s.id, now));
  }
  function action(a: ButtonAction) {
    if (modal || !activeSession.current || status !== 'online') return;
    sound.current?.unlock();
    setNotice('');
    try {
      if (local.current) {
        buttonAction(
          local.current,
          activeSession.current.id,
          a,
          activeSession.current.id,
        );
        accept(
          buttonSnapshot(
            local.current,
            'PRACTICE',
            activeSession.current.id,
            activeSession.current.id,
            local.current.clock,
          ),
        );
      } else
        void network.current
          ?.action(a)
          .catch((error) => setNotice(error.message));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Try that again.');
    }
  }
  useEffect(() => {
    actionRef.current = action;
  });
  useEffect(() => {
    scene.current?.setBlocked(!!modal || status !== 'online');
  }, [modal, status, ready]);
  async function leave() {
    setBusy(true);
    try {
      await network.current?.leave();
    } catch {
      network.current?.stop();
    } finally {
      network.current = null;
      local.current = null;
      activeSession.current = null;
      latest.current = null;
      input.current = idleInput();
      setSession(null);
      setSnapshot(null);
      setModal(null);
      setNotice('');
      scene.current?.setSnapshot(null);
      sound.current?.reset();
      sound.current?.update(null);
      setBusy(false);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* Storage is optional. */
      }
      history.replaceState(null, '', '/one-more-button');
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/one-more-button?room=${session?.code}`,
      );
      setCopied(true);
    } catch {
      setNotice('Copy the room code below and share it with your crew.');
    }
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const disabled =
    !playing ||
    status !== 'online' ||
    !!modal ||
    !me ||
    me.escaped ||
    me.hearts <= 0;
  const nearButton = !!me && Math.hypot(me.x, me.z) <= 2.7;
  const nearExit = !!me && Math.hypot(me.x - EXIT.x, me.z - EXIT.z) <= 2.2;
  const lastEvent = w?.events.at(-1);
  const next = w && w.presses < MAX_PRESSES ? prizeForPress(w.presses) : 0;
  return (
    <main className={`omb-game${session ? ' in-session' : ''}`}>
      <div className="omb-canvas" ref={container} />
      <header className="omb-header">
        <a href="/" className="omb-brand">
          <span>
            <CircleDot size={23} />
          </span>{' '}
          ONE MORE BUTTON<span className="omb-dot">.</span>
        </a>
        <GameToolbar
          muted={muted}
          onToggleSound={() => {
            setMuted(!muted);
            if (sound.current) {
              sound.current.unlock();
              sound.current.enabled = muted;
            }
            try {
              localStorage.setItem(
                'one-more-button-prefs-v1',
                JSON.stringify({ name, muted: !muted }),
              );
            } catch {
              /* Optional. */
            }
          }}
          onHelp={() => setModal('help')}
          onLeave={session ? () => setModal('leave') : undefined}
          workshop="/one-more-button/admin"
          voice={
            session?.peer && w
              ? {
                  session: { ...session, game: 'one-more-button' },
                  snapshot: { players: w.players, nearby: false },
                  onSpeaking: (active) => sound.current?.duck(active),
                }
              : undefined
          }
          voiceHint="Create or join a show with friends to use voice chat."
        />
      </header>
      {!session ? (
        <section className="omb-menu">
          <div className="omb-menu-copy">
            <span className="omb-kicker">
              <span /> THE JUMBLEYARD GAME SHOW
            </span>
            <h1>
              We were rich
              <br />
              until{' '}
              <em>
                you
                <br className="omb-title-break" /> touched it.
              </em>
            </h1>
            <p>
              One big button. Four small chances of agreeing.
              <br />
              More money. More hazards. Know when to leave.
            </p>
            <div className="omb-meta">
              <span>
                <Users size={16} /> 1–4 players
              </span>
              <span>3-minute shows</span>
            </div>
            <label className="omb-name">
              Your contestant name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                placeholder="Definitely Not Greedy"
                autoComplete="nickname"
              />
            </label>
            <button
              className="omb-primary"
              disabled={!ready || busy}
              onClick={() => void enter('create')}
            >
              {busy ? (
                <LoaderCircle className="omb-spin" size={20} />
              ) : (
                <CircleDot size={20} />
              )}{' '}
              Create a show <ArrowUpRight size={20} />
            </button>
            <div className="omb-menu-secondary">
              <button
                disabled={!ready || busy}
                onClick={() => setModal('join')}
              >
                Join friends
              </button>
              <button disabled={!ready || busy} onClick={startPractice}>
                Try solo
              </button>
            </div>
            <small className="omb-menu-note">
              No download. No actual money. Plenty of blame.
            </small>
          </div>
          <figure className="omb-menu-art">
            <img
              src="/images/one-more-button.png"
              alt="One toy contestant presses a huge red button as a giant boxing glove launches their three friends across a teal game-show room."
              width={1536}
              height={1024}
              fetchPriority="high"
            />
            <figcaption>
              <span>THE LAST WORDS OF A RICH TEAM</span>
              <strong>“Okay, but just one more.”</strong>
            </figcaption>
          </figure>
        </section>
      ) : (
        <>
          <section className="omb-scoreboard" aria-label="Prize pot">
            <div>
              <span>SHARED PRIZE POT</span>
              <strong>
                <Coins size={24} />
                {money(w?.pot ?? 0)}
              </strong>
              <small>
                {w?.presses ?? 0}/{MAX_PRESSES} presses ·{' '}
                {w?.hazards.length ?? 0} hazards
              </small>
            </div>
            <div
              className={
                w?.phase === 'escape' ? 'omb-clock urgent' : 'omb-clock'
              }
            >
              <span>{w?.phase === 'escape' ? 'GET OUT!' : 'SHOW TIME'}</span>
              <strong>
                {w?.phase === 'lobby'
                  ? '3:00'
                  : time(
                      w?.phase === 'escape'
                        ? w.escapeAt - w.clock
                        : ROUND_MS - ((w?.clock ?? 0) - (w?.started ?? 0)),
                    )}
              </strong>
            </div>
          </section>
          <aside className="omb-crew" aria-label="Contestants">
            <div className="omb-crew-title">
              <span>
                <Users size={15} /> {w?.players.length ?? 0}/4 ON STAGE
              </span>
              <button
                disabled={practice}
                onClick={() => {
                  setCopied(false);
                  setModal('invite');
                }}
              >
                Invite
              </button>
            </div>
            {w?.players.map((p) => (
              <div className="omb-crew-person" key={p.id}>
                <i style={{ background: COLORS[p.color % 4] }} />
                <span>
                  {p.name}
                  {p.id === session.id ? ' (you)' : ''}
                </span>
                <small
                  aria-label={
                    p.escaped
                      ? `${money(p.winnings)} safe`
                      : `${p.hearts} hearts`
                  }
                >
                  {p.escaped
                    ? money(p.winnings)
                    : p.hearts
                      ? '♥'.repeat(p.hearts)
                      : 'OUT'}
                </small>
              </div>
            ))}
            <div className="omb-banked">
              Banked safely <b>{money(w?.banked ?? 0)}</b>
            </div>
          </aside>
          {w?.phase === 'lobby' && (
            <section className="omb-lobby">
              <span className="omb-kicker">YOU ARE ON THE GUEST LIST</span>
              <h2>
                Invite your
                <br />
                bad influences.
              </h2>
              <button
                className="omb-room-code"
                onClick={() => void copyInvite()}
              >
                {session.code}
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
              <p>
                Share this code with up to three friends. Join before the host
                starts.
              </p>
              <button
                className="omb-primary"
                disabled={!captain || status !== 'online'}
                onClick={() => action({ type: 'start' })}
              >
                {captain ? 'Start the show' : 'Waiting for the host…'}
                <ArrowUpRight size={19} />
              </button>
            </section>
          )}
          {playing && w && (
            <>
              <div className={`omb-door-status${doorOpen(w) ? ' open' : ''}`}>
                <DoorOpen size={18} />
                {!w.presses
                  ? 'First press opens the exit'
                  : doorOpen(w)
                    ? 'EXIT OPEN · back of the room'
                    : `EXIT LOCKED · ${Math.ceil((w.doorUntil - w.clock) / 1000)}s`}
              </div>
              <section className="omb-risk" aria-label="Next press">
                <span>
                  {w.presses >= MAX_PRESSES
                    ? 'JACKPOT. NOW RUN.'
                    : 'ONE MORE WOULD ADD…'}
                </span>
                <strong>{next ? `+${money(next)}` : money(w.pot)}</strong>
                <small>
                  {next
                    ? '+1 hazard · exit locks for 5s'
                    : 'All sixteen hazards are live'}
                </small>
              </section>
              <button
                className="omb-camera"
                onClick={() => scene.current?.changeCamera()}
                aria-label="Change camera"
              >
                <Camera size={19} />
                <span>View · V</span>
              </button>
              <div className="omb-your-status">
                {me?.escaped ? (
                  `Your ${money(me.winnings)} is safe. Cheer on the crew!`
                ) : !me?.hearts ? (
                  'You are out! Watch the crew try to escape.'
                ) : (
                  <>
                    <Heart size={16} /> {me.hearts}/3 chances · Your share:{' '}
                    {money(Math.floor(w.pot / Math.max(1, w.crewSize)))}
                  </>
                )}
              </div>
              <TouchControls
                disabled={disabled}
                move={(v) => scene.current?.move(v)}
                jump={() => action({ type: 'jump' })}
              />
              <nav className="omb-action-dock" aria-label="Show actions">
                <button
                  className="omb-action press"
                  disabled={
                    disabled ||
                    !nearButton ||
                    !next ||
                    w.clock - w.lastPress < 2200
                  }
                  onClick={() => action({ type: 'press' })}
                >
                  <CircleDot size={22} />
                  <span>
                    One more!
                    <kbd>
                      E · {nearButton ? `+${money(next)}` : 'Get closer'}
                    </kbd>
                  </span>
                </button>
                <button
                  className="omb-action"
                  disabled={disabled}
                  onClick={() => action({ type: 'jump' })}
                >
                  <span>
                    Jump<kbd>Space</kbd>
                  </span>
                </button>
                <button
                  className="omb-action"
                  disabled={disabled}
                  onClick={() => action({ type: 'stop' })}
                >
                  <Hand size={19} />
                  <span>
                    STOP!<kbd>Q · warn crew</kbd>
                  </span>
                </button>
                <button
                  className="omb-action"
                  disabled={disabled}
                  onClick={() => action({ type: 'help' })}
                >
                  <span>
                    Help up<kbd>F · nearby friend</kbd>
                  </span>
                </button>
                <button
                  className="omb-action exit"
                  disabled={disabled || !nearExit || !doorOpen(w)}
                  onClick={() => action({ type: 'exit' })}
                >
                  <DoorOpen size={21} />
                  <span>
                    Cash out
                    <kbd>X · {nearExit ? 'Take your share' : 'Reach exit'}</kbd>
                  </span>
                </button>
              </nav>
              <span className="omb-movement-hint">
                WASD / arrows to move · Yellow lanes warn of punches · Jump over
                spinning sofas
              </span>
            </>
          )}
          {done && w && (
            <section className="omb-results">
              <Trophy size={36} />
              <span className="omb-kicker">
                THAT WAS DEFINITELY THE LAST ONE
              </span>
              <h2>{w.banked ? 'Rich enough to leave.' : 'We were rich.'}</h2>
              <p>
                {w.banked
                  ? `${money(w.banked)} escaped the room.`
                  : 'Until someone touched it.'}
                <br />
                {w.presses} presses. {w.hazards.length} terrible ideas.
              </p>
              <div className="omb-result-list">
                {w.players.map((p) => (
                  <div key={p.id}>
                    <span>{p.name}</span>
                    <b>{p.escaped ? money(p.winnings) : 'Nothing'}</b>
                  </div>
                ))}
              </div>
              {w.lastPresser && (
                <p>
                  Last press: <strong>{w.lastPresser}</strong>. We remember.
                </p>
              )}
              <button
                className="omb-primary"
                disabled={!captain || status !== 'online'}
                onClick={() => action({ type: 'restart' })}
              >
                {captain ? 'One more show' : 'Waiting for the host…'}
                <ArrowUpRight size={18} />
              </button>
              <button className="omb-text-button" onClick={() => void leave()}>
                Back to the lobby
              </button>
            </section>
          )}
        </>
      )}
      {(notice ||
        (session && status !== 'online') ||
        (playing && lastEvent && w && w.clock - lastEvent.at < 5000)) && (
        <output className="omb-notice">
          {notice ||
            (status === 'expired'
              ? 'This room expired. Use All games to leave and join a new show.'
              : status === 'reconnecting'
                ? 'Connecting to your crew…'
                : lastEvent?.text)}
        </output>
      )}
      {!ready && !notice && (
        <output className="omb-loading">
          <LoaderCircle className="omb-spin" size={18} /> Setting the stage…
        </output>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="omb-dialog">
          <DialogTitle>
            {modal === 'help'
              ? 'A very questionable game show'
              : modal === 'join'
                ? 'Find your fellow contestants'
                : modal === 'invite'
                  ? 'Invite your bad influences'
                  : 'Leave the show?'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'help'
              ? 'Win together. Know when to stop.'
              : modal === 'leave'
                ? 'Leaving forfeits any prize you have not already carried out.'
                : 'Up to four friends share one room and one prize pot.'}
          </DialogDescription>
          {modal === 'help' && (
            <div className="omb-help">
              <p>
                <strong>Press your luck.</strong> Walk to the red button and
                press E. Every press adds more money and one hazard. The exit
                locks for five seconds, and the button recharges for 2.2
                seconds.
              </p>
              <p>
                <strong>Stay on your feet.</strong> WASD / arrows move, Space
                jumps. Gloves flash a yellow warning lane before punching. Avoid
                soap, fight the conveyors, and jump the spinning sofas. You have
                three chances. F helps a dazed friend.
              </p>
              <p>
                <strong>Take the money and run.</strong> Reach the EXIT at the
                back and press X to bank your share. The first escape starts a
                25-second countdown for everyone else. Another press can lock
                the door again, but cannot extend the countdown.
              </p>
              <p>
                <strong>Use your words.</strong> Q shouts STOP! Voice is
                available with friends. V changes the camera. On touchscreens
                use the joystick and action buttons.
              </p>
              <p>
                Solo uses the same hazards and awards the whole pot. Prize money
                is fictional.
              </p>
              <div className="omb-hazard-list">
                {Object.entries(HAZARD_NAMES).map(([id, text]) => (
                  <span key={id}>{text}</span>
                ))}
              </div>
            </div>
          )}
          {modal === 'join' && (
            <form
              className="omb-join-form"
              onSubmit={(e) => {
                e.preventDefault();
                void enter('join');
              }}
            >
              <label className="omb-name">
                Your contestant name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={18}
                  placeholder="Definitely Not Greedy"
                  autoComplete="nickname"
                />
              </label>
              <label className="omb-name">
                Six-character room code
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z2-9]/g, '')
                        .slice(0, 6),
                    )
                  }
                  maxLength={6}
                  placeholder="ABC234"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  pattern="[A-Z2-9]{6}"
                />
              </label>
              <button
                className="omb-primary"
                disabled={busy || !ready || code.length !== 6}
              >
                {busy ? 'Joining…' : 'Join the show'}
                <ArrowUpRight size={18} />
              </button>
            </form>
          )}
          {modal === 'invite' && (
            <>
              <button
                className="omb-room-code"
                onClick={() => void copyInvite()}
              >
                {session?.code}
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
              <p>
                {copied
                  ? 'Invite link copied.'
                  : 'Click to copy the invite link, or share this room code.'}
              </p>
            </>
          )}
          {modal === 'leave' && (
            <>
              <button
                className="omb-primary"
                disabled={busy}
                onClick={() => void leave().then(() => location.assign('/'))}
              >
                Leave for all games
              </button>
              <button
                className="omb-text-button"
                onClick={() => setModal(null)}
              >
                Stay on the show
              </button>
            </>
          )}
          {notice && <p role="alert">{notice}</p>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
