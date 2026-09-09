'use client';
/* eslint-disable next/no-img-element, next/no-html-link-for-pages -- Full game navigation disposes WebGL; artwork is served locally on both targets. */
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token. */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Camera,
  Check,
  Copy,
  DoorOpen,
  Eye,
  Footprints,
  Hotel,
  KeyRound,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  Timer,
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
  advanceHotel,
  freshHotel,
  newGuest,
  hotelAction,
  hotelSnapshot,
} from './simulation';
import {
  COLORS,
  STATIONS,
  STOPS,
  INSPECT_MS,
  ESCAPE_MS,
  idleInput,
  type HotelWorld,
  type HotelSnapshot,
  type HotelSession,
  type HotelAction,
} from './types';
import { HotelSound } from './audio';
import type { HotelScene } from './scene';
import type { HotelCameraMode } from './camera';
import './style.css';

const SESSION_KEY = 'wrong-floor-session-v1';
const PREFS_KEY = 'wrong-floor-prefs-v1';
const countdown = (ms: number) =>
  `${Math.floor(Math.max(0, Math.ceil(ms / 1000)) / 60)}:${String(Math.max(0, Math.ceil(ms / 1000)) % 60).padStart(2, '0')}`;

export default function WrongFloor() {
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<HotelScene | null>(null),
    sound = useRef<HotelSound | null>(null);
  const network = useRef<PeerGameConnection<HotelSnapshot> | null>(null),
    local = useRef<HotelWorld | null>(null),
    active = useRef<HotelSession | null>(null),
    latest = useRef<HotelSnapshot | null>(null);
  const input = useRef(idleInput()),
    actionRef = useRef<(a: HotelAction) => void>(() => {}),
    hudAt = useRef(0),
    localTick = useRef(0);
  const [snapshot, setSnapshot] = useState<HotelSnapshot | null>(null),
    [session, setSession] = useState<HotelSession | null>(null);
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [muted, setMuted] = useState(false),
    [gentle, setGentle] = useState(false),
    [notice, setNotice] = useState(''),
    [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
    'online',
  );
  const [modal, setModal] = useState<
      'help' | 'join' | 'invite' | 'leave' | null
    >(null),
    [reportsOpen, setReportsOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<HotelCameraMode>('first-person');
  const w = snapshot?.world,
    me = w?.players.find((p) => p.id === session?.id),
    you = snapshot?.you;
  const practice = session?.code === 'PRACTICE',
    host = snapshot?.host === session?.id;
  const inspect = w?.phase === 'playing' && w.stage === 'inspect',
    escape = w?.phase === 'escape',
    travel = w?.phase === 'playing' && w.stage === 'travel';
  const done = w?.phase === 'won' || w?.phase === 'lost',
    station = STATIONS[you?.station ?? 0];
  const nearClue = me
    ? Math.hypot(me.x - station.x, me.z - station.z) < 3
    : false;
  const nearVote = me ? Math.hypot(me.x, me.z + 23.5) < 4 : false;
  const disabled = !!modal || status !== 'online';
  function accept(next: HotelSnapshot) {
    if (!active.current) return;
    const previous = latest.current;
    latest.current = next;
    scene.current?.setSnapshot(next);
    sound.current?.update(next, active.current.id);
    if (
      !previous ||
      next.world.eventId !== previous.world.eventId ||
      next.you.inspected !== previous.you.inspected ||
      performance.now() - hudAt.current > 100
    ) {
      hudAt.current = performance.now();
      setSnapshot(next);
    }
  }
  function attach(s: HotelSession, state?: HotelSnapshot) {
    network.current?.stop();
    local.current = null;
    active.current = s;
    latest.current = null;
    input.current = idleInput();
    setSession(s);
    setStatus('reconnecting');
    sound.current?.reset();
    scene.current?.setSession(s.id);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* Optional storage. */
    }
    network.current = new PeerGameConnection(
      'wrong-floor',
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
    const audio = new HotelSound();
    sound.current = audio;
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      audio.enabled = prefs.muted !== true;
      queueMicrotask(() => {
        if (!disposed) {
          setName(typeof prefs.name === 'string' ? prefs.name : '');
          setMuted(prefs.muted === true);
          setGentle(prefs.gentle === true);
        }
      });
    } catch {
      /* Optional storage. */
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
      .then(({ HotelScene }) => {
        if (disposed || !container.current) return;
        try {
          scene.current = new HotelScene(container.current, {
            input: (next) => {
              input.current = next;
              const p = local.current?.players.find(
                (p) => p.id === active.current?.id,
              );
              if (p) p.input = next;
            },
            action: (a) => actionRef.current(a),
            camera: setCameraMode,
            listen: (position, yaw) => audio.listen(position, yaw),
            failure: () => {
              setReady(false);
              setNotice(
                'The hotel display stopped. Reload to rejoin your crew.',
              );
            },
            tick: () => {
              const realNow = performance.now();
              const delta = Math.min(
                100,
                Math.max(0, realNow - (localTick.current || realNow)),
              );
              localTick.current = realNow;
              if (local.current && active.current) {
                advanceHotel(local.current, local.current.clock + delta);
                accept(
                  hotelSnapshot(
                    local.current,
                    'PRACTICE',
                    active.current.id,
                    active.current.id,
                    local.current.clock,
                  ),
                );
              }
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
              /* Start a new stay if session storage is unavailable. */
            }
        } catch {
          setNotice(
            'The hotel could not load. Enable hardware acceleration and reload.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The hotel could not load. Reload to try again.');
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
  function savePrefs(nextMuted = muted, nextGentle = gentle) {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ name, muted: nextMuted, gentle: nextGentle }),
      );
    } catch {
      /* Optional preferences. */
    }
  }
  async function enter(op: 'create' | 'join') {
    if (!ready || busy) return;
    setBusy(true);
    setNotice('');
    sound.current?.unlock();
    savePrefs();
    try {
      const reply = await enterPeerRoom<HotelSnapshot>(
        'wrong-floor',
        {
          op,
          name: name.trim() || 'Guest',
          ...(op === 'join' ? { code: code.toUpperCase().trim() } : {}),
        },
        () => import('./peer'),
      );
      if (!reply.session)
        throw new Error('The hotel could not be joined. Try again.');
      attach(reply.session, reply.snapshot);
      setModal(null);
      history.replaceState(null, '', `/wrong-floor?room=${reply.session.code}`);
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : 'Could not reach the hotel. Try again.',
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
      world = freshHotel(now),
      s = { id: 'practice-guest', code: 'PRACTICE', token: '' };
    world.players.push(newGuest(s.id, name.trim() || 'You', 0, now));
    hotelAction(world, s.id, { type: 'start' }, s.id);
    local.current = world;
    active.current = s;
    latest.current = null;
    setSession(s);
    setStatus('online');
    setNotice('');
    scene.current?.setSession(s.id);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* Optional storage. */
    }
    history.replaceState(null, '', '/wrong-floor');
    accept(hotelSnapshot(world, s.code, s.id, s.id, now));
  }
  function action(a: HotelAction) {
    if (modal || !active.current || status !== 'online') return;
    setNotice('');
    sound.current?.unlock();
    try {
      if (local.current) {
        hotelAction(local.current, active.current.id, a, active.current.id);
        accept(
          hotelSnapshot(
            local.current,
            'PRACTICE',
            active.current.id,
            active.current.id,
            local.current.clock,
          ),
        );
      } else void network.current?.action(a).catch((e) => setNotice(e.message));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Try that again.');
    }
  }
  useEffect(() => {
    actionRef.current = action;
  });
  useEffect(() => {
    scene.current?.setBlocked(!!modal || status !== 'online');
  }, [modal, status, ready]);
  useEffect(() => {
    scene.current?.setGentle(gentle);
  }, [gentle, ready]);
  async function leave() {
    setBusy(true);
    try {
      await network.current?.leave();
    } catch {
      network.current?.stop();
    } finally {
      network.current = null;
      local.current = null;
      active.current = null;
      latest.current = null;
      input.current = idleInput();
      scene.current?.setSnapshot(null);
      scene.current?.resetInput();
      sound.current?.reset();
      setSession(null);
      setSnapshot(null);
      setModal(null);
      setNotice('');
      setBusy(false);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* Optional storage. */
      }
      history.replaceState(null, '', '/wrong-floor');
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/wrong-floor?room=${session?.code}`,
      );
      setCopied(true);
    } catch {
      setNotice('Copy the room code and share it with your friends.');
    }
  }
  const currentHint = escape
    ? me?.safe
      ? 'Hold the door. Your friends are still out there.'
      : me?.caught
        ? 'The hotel caught you. A friend can still save the stay.'
        : 'RUN TO THE BRASS ELEVATOR. Your camera has turned toward the exit.'
    : you?.inspected
      ? 'Share your finding, then meet at the far-end panel.'
      : `Follow the gold ring to ${station.name.toLowerCase()}. Press E to inspect.`;
  return (
    <main
      className={`hotel-game${session ? ' in-session' : ''}${escape ? ' escaping' : ''}`}
    >
      <div className="hotel-canvas" ref={container} />
      {session && <div className="hotel-vignette" aria-hidden="true" />}
      <header className="hotel-header">
        <a href="/" className="hotel-brand">
          <span>
            <Hotel size={22} />
          </span>{' '}
          WRONG FLOOR<b>.</b>
        </a>
        <GameToolbar
          muted={muted}
          onToggleSound={() => {
            setMuted(!muted);
            if (sound.current) {
              sound.current.unlock();
              sound.current.enabled = muted;
            }
            savePrefs(!muted);
          }}
          onHelp={() => setModal('help')}
          onLeave={session ? () => setModal('leave') : undefined}
          workshop="/wrong-floor/admin"
          voice={
            session?.peer && w
              ? {
                  session: { ...session, game: 'wrong-floor' },
                  onSpeaking: (active) => sound.current?.duck(active),
                  snapshot: {
                    players: w.players.filter((p) => !p.bot),
                    nearby: false,
                  },
                }
              : undefined
          }
          voiceHint="Check in with friends to use voice chat. Computer guests share written findings."
        />
      </header>
      {!session ? (
        <section className="hotel-menu">
          <div className="hotel-menu-copy">
            <span className="hotel-kicker">
              <KeyRound size={15} /> THE HOTEL WOULD LIKE YOU TO STAY
            </span>
            <h1>
              Why can only
              <br />
              <em>you</em> see that?
            </h1>
            <p>
              Four friends. Five elevator stops.
              <br />
              You are not all seeing the same hotel.
            </p>
            <div className="hotel-meta">
              <span>
                <Users size={16} /> 1–4 guests
              </span>
              <span>
                <Timer size={16} /> 5 stops to escape
              </span>
            </div>
            <label className="hotel-field">
              Your guest name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                placeholder="Definitely checking out"
                autoComplete="nickname"
              />
            </label>
            <button
              className="hotel-primary"
              disabled={!ready || busy}
              onClick={() => void enter('create')}
            >
              {busy ? (
                <LoaderCircle className="hotel-spin" size={19} />
              ) : (
                <KeyRound size={19} />
              )}{' '}
              Check in with friends <ArrowUpRight size={20} />
            </button>
            <div className="hotel-secondary">
              <button
                disabled={!ready || busy}
                onClick={() => setModal('join')}
              >
                Join a room
              </button>
              <button disabled={!ready || busy} onClick={startPractice}>
                Try with 3 NPCs
              </button>
            </div>
            <span className="hotel-menu-note">
              Compare clues. Trust your friends. Know when to run.
            </span>
          </div>
          <figure className="hotel-menu-art">
            <img
              src="/images/wrong-floor.png"
              alt="Four toy hotel guests at a brass elevator. Only one sees a tall shadow running down the hallway behind them."
              width={1536}
              height={1024}
              fetchPriority="high"
            />
            <figcaption>
              <span>“THE HALLWAY IS EMPTY.”</span>
              <strong>Three out of four guests agree.</strong>
            </figcaption>
            <span className="hotel-art-key">
              <KeyRound size={21} /> 013
            </span>
          </figure>
          <div className="hotel-menu-rule">
            <Eye size={22} />
            <p>
              <strong>Something impossible? Retreat.</strong>
              <span>
                Everything normal? Advance. A wrong call gives you 12 seconds to
                run.
              </span>
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="hotel-progress" aria-label="Checkout progress">
            <div>
              <span className="hotel-kicker">
                {practice ? 'PRACTICE STAY' : `ROOM ${session.code}`}
              </span>
              <strong>
                {w?.phase === 'won'
                  ? 'Lobby'
                  : `Stop ${Math.min(STOPS, (w?.cleared ?? 0) + 1)}`}
                <small> / {STOPS}</small>
              </strong>
            </div>
            <div
              className="hotel-stop-dots"
              aria-label={`${w?.cleared ?? 0} stops cleared`}
            >
              {Array.from({ length: STOPS }, (_, i) => (
                <span
                  key={i}
                  className={(w?.cleared ?? 0) > i ? 'cleared' : ''}
                >
                  {(w?.cleared ?? 0) > i ? <Check size={13} /> : i + 1}
                </span>
              ))}
            </div>
            <span className="hotel-chances">
              {3 - (w?.mistakes ?? 0)} chances left
            </span>
          </section>
          {w && w.phase !== 'lobby' && !done && (
            <div className={`hotel-timer${escape ? ' urgent' : ''}`}>
              <span>
                {escape
                  ? 'ELEVATOR CLOSES IN'
                  : travel
                    ? 'GOING DOWN'
                    : 'DECIDE IN'}
              </span>
              <strong>
                {travel ? (
                  <DoorOpen size={30} />
                ) : (
                  countdown(
                    escape
                      ? ESCAPE_MS - w.clock + w.escapeAt
                      : INSPECT_MS - w.clock + w.stopAt,
                  )
                )}
              </strong>
            </div>
          )}
          <aside
            className={`hotel-reports${reportsOpen ? ' expanded' : ''}`}
            aria-label="Crew findings"
          >
            <div className="hotel-reports-heading">
              <button
                onClick={() => setReportsOpen(!reportsOpen)}
                aria-expanded={reportsOpen}
              >
                <Users size={16} /> Crew findings{' '}
                <span>{w?.players.filter((p) => p.report).length ?? 0}/4</span>
              </button>
              {!practice && (
                <button
                  className="hotel-invite"
                  onClick={() => {
                    setCopied(false);
                    setModal('invite');
                  }}
                >
                  Invite
                </button>
              )}
            </div>
            <div className="hotel-report-list">
              {w?.players.map((p) => (
                <div className="hotel-report" key={p.id}>
                  <i style={{ background: COLORS[p.color] }} />
                  <div>
                    <strong>
                      {p.name}
                      {p.id === session.id ? ' (you)' : ''}
                      <small>
                        {p.bot
                          ? 'NPC'
                          : p.safe
                            ? 'SAFE'
                            : p.caught
                              ? 'CAUGHT'
                              : p.vote
                                ? p.vote.toUpperCase()
                                : ''}
                      </small>
                    </strong>
                    <p>{p.report || 'Has not shared a finding.'}</p>
                  </div>
                </div>
              ))}
              <p className="hotel-crew-note">
                {practice
                  ? 'NPCs report what they see. You make the call.'
                  : 'Humans decide by majority. A tied vote retreats.'}
              </p>
            </div>
          </aside>
          {w?.phase === 'lobby' && (
            <section className="hotel-center hotel-lobby">
              <KeyRound size={29} />
              <span className="hotel-kicker">YOUR RESERVATION IS READY</span>
              <h2>Everyone checked in?</h2>
              <p>
                Share this code. Empty places become computer guests when the
                host starts.
              </p>
              <button
                className="hotel-room-code"
                onClick={() => void copyInvite()}
              >
                {session.code}
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
              <p>
                {w.players.filter((p) => !p.bot).length}/4 friends checked in
              </p>
              {host ? (
                <button
                  className="hotel-primary"
                  disabled={disabled}
                  onClick={() => action({ type: 'start' })}
                >
                  Enter the elevator <ArrowDown size={19} />
                </button>
              ) : (
                <p>Waiting for the host to enter the elevator…</p>
              )}
            </section>
          )}
          {(inspect || escape) && (
            <>
              <button
                className="hotel-camera"
                aria-label={
                  cameraMode === 'first-person'
                    ? 'Switch to follow camera'
                    : 'Switch to first-person camera'
                }
                title={
                  cameraMode === 'first-person'
                    ? 'First person · V to follow your guest'
                    : 'Follow guest · V for first person'
                }
                onClick={() => scene.current?.changeCamera()}
              >
                <Camera size={17} />
                <span>
                  {cameraMode === 'first-person'
                    ? 'First person'
                    : 'Follow guest'}{' '}
                  <kbd>V</kbd>
                </span>
              </button>
              <section
                className={`hotel-evidence${escape ? ' danger' : ''}`}
                aria-label="Your private evidence"
              >
                <span className="hotel-kicker">
                  {escape ? <DoorOpen size={16} /> : <Eye size={16} />}
                  {escape
                    ? me?.safe
                      ? 'YOU MADE IT'
                      : me?.caught
                        ? 'WAIT FOR YOUR CREW'
                        : 'DO NOT LOOK BACK'
                    : `ONLY YOU / ${station.name.toUpperCase()}`}
                </span>
                <strong>
                  {escape ? currentHint : you?.observation || currentHint}
                </strong>
                {!escape && you?.inspected && (
                  <small>
                    {me?.report
                      ? 'Shared with your crew.'
                      : 'Your friends cannot see this. Tell them.'}
                  </small>
                )}
                {!escape && (
                  <div className="hotel-evidence-actions">
                    <button
                      disabled={disabled || !nearClue || !!you?.inspected}
                      onClick={() => action({ type: 'inspect' })}
                    >
                      <Eye size={17} />
                      {you?.inspected ? 'Inspected' : 'Inspect'}
                      <kbd>E</kbd>
                    </button>
                    <button
                      disabled={disabled || !you?.inspected || !!me?.report}
                      onClick={() => action({ type: 'report' })}
                    >
                      <MessageCircle size={17} />
                      {me?.report ? 'Shared' : 'Share finding'}
                      <kbd>R</kbd>
                    </button>
                  </div>
                )}
                {escape && !me?.safe && !me?.caught && (
                  <small>
                    You sprint automatically. Move toward the gold EXIT sign.
                  </small>
                )}
              </section>
              {inspect && (
                <div className="hotel-voting">
                  <span>
                    {nearVote ? 'MAKE THE CALL' : 'VOTE AT THE FAR-END PANEL'}
                    {me?.vote ? ` / YOU VOTED ${me.vote.toUpperCase()}` : ''}
                  </span>
                  <div>
                    <button
                      className={me?.vote === 'advance' ? 'selected' : ''}
                      aria-pressed={me?.vote === 'advance'}
                      disabled={disabled || !nearVote}
                      onClick={() =>
                        action({ type: 'vote', choice: 'advance' })
                      }
                    >
                      <ArrowDown size={19} />
                      <span>
                        Advance<small>Everything normal</small>
                      </span>
                      <kbd>1</kbd>
                    </button>
                    <button
                      className={
                        me?.vote === 'retreat' ? 'selected retreat' : 'retreat'
                      }
                      aria-pressed={me?.vote === 'retreat'}
                      disabled={disabled || !nearVote}
                      onClick={() =>
                        action({ type: 'vote', choice: 'retreat' })
                      }
                    >
                      <ArrowUp size={19} />
                      <span>
                        Retreat<small>Someone saw something</small>
                      </span>
                      <kbd>2</kbd>
                    </button>
                  </div>
                </div>
              )}
              <TouchControls
                disabled={disabled || !!me?.safe || !!me?.caught}
                move={(v) => scene.current?.move(v)}
                jump={() => {}}
              />
              <div className="hotel-movement">
                WASD / arrows move · Shift sprint · Drag to look up/down · V
                camera
              </div>
            </>
          )}
          {travel && (
            <section className="hotel-center hotel-travel">
              <ShieldCheck size={34} />
              <span className="hotel-kicker">
                {w?.lastDecision?.correct ? 'GOOD CALL' : 'YOU HELD THE DOOR'}
              </span>
              <h2>
                {w?.lastDecision?.correct
                  ? 'Going down.'
                  : 'Still checking out.'}
              </h2>
              <p>{w?.lastDecision?.evidence}</p>
              <small>
                {w?.lastDecision?.correct
                  ? `${w.cleared} of 5 stops cleared.`
                  : 'The crew is back. New evidence on the same stop.'}
              </small>
            </section>
          )}
          {done && (
            <section className="hotel-center hotel-results">
              <DoorOpen size={34} />
              <span className="hotel-kicker">
                {w?.phase === 'won'
                  ? 'RESERVATION CANCELLED'
                  : 'RESERVATION EXTENDED'}
              </span>
              <h2>
                {w?.phase === 'won'
                  ? 'You checked out.'
                  : 'Wrong floor. Again.'}
              </h2>
              <p>
                {w?.phase === 'won'
                  ? 'Five stops. Four guests. One very relieved elevator.'
                  : w?.events.at(-1)?.text}
              </p>
              <div className="hotel-result-stats">
                <span>
                  <strong>{w?.cleared}/5</strong>stops cleared
                </span>
                <span>
                  <strong>{w?.mistakes}</strong>wrong calls
                </span>
              </div>
              {host && (
                <button
                  className="hotel-primary"
                  disabled={disabled}
                  onClick={() => action({ type: 'restart' })}
                >
                  Another stay <KeyRound size={19} />
                </button>
              )}
              <button
                className="hotel-text-button"
                disabled={busy}
                onClick={() => void leave()}
              >
                Back to check-in
              </button>
            </section>
          )}
        </>
      )}
      {status !== 'online' && session && (
        <output className="hotel-connection">
          {status === 'expired'
            ? 'This room has closed.'
            : 'Reconnecting to your crew…'}
          {status === 'expired' && (
            <button onClick={() => void leave()}>Back to check-in</button>
          )}
        </output>
      )}
      {notice && (
        <output className="hotel-notice">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice('')}>
            ×
          </button>
        </output>
      )}
      {!ready && !notice && (
        <div className="hotel-loading">
          <LoaderCircle size={18} className="hotel-spin" /> Opening the hotel…
        </div>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="hotel-dialog">
          <DialogTitle>
            {modal === 'help'
              ? 'How to check out'
              : modal === 'join'
                ? 'Find your friends'
                : modal === 'invite'
                  ? 'Share your reservation'
                  : 'Leave the hotel?'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'help'
              ? 'You share a hallway. You do not share a reality.'
              : modal === 'join'
                ? 'Enter the six-character room code from your host.'
                : modal === 'invite'
                  ? 'Friends can join before the elevator starts.'
                  : 'Your crew can keep playing. A computer guest will take your place.'}
          </DialogDescription>
          {modal === 'help' && (
            <div className="hotel-help">
              <p>
                <Eye size={20} />
                <span>
                  <strong>Inspect your own clue.</strong> Follow the gold ring
                  to your assigned carpet, portrait, door, or clock. The normal
                  hotel has dry carpet, a still unsmiling portrait, a silent
                  room 309, and a clock stopped at 12:00.
                </span>
              </p>
              <p>
                <MessageCircle size={20} />
                <span>
                  <strong>Compare evidence.</strong> Press E to inspect, then R
                  to share. Voice chat is in the toolbar. Computer guests share
                  written findings. No microphone is needed.
                </span>
              </p>
              <p>
                <KeyRound size={20} />
                <span>
                  <strong>Vote at the far-end panel.</strong> Advance if
                  everything is normal. Retreat if anyone has an anomaly.
                  Majority of human votes wins; ties and no votes retreat. You
                  have 90 seconds.
                </span>
              </p>
              <p>
                <Footprints size={20} />
                <span>
                  <strong>A wrong call means run.</strong> Your camera turns
                  toward the brass elevator. Reach it in 12 seconds. One human
                  holding the door brings the whole crew back. Three wrong calls
                  or nobody escaping ends the stay.
                </span>
              </p>
              <p>
                The ventilation hums and the pipes settle on every floor.
                Failing lights and an unfamiliar figure mean something is wrong.
                Listen for your friends’ footsteps and sounds from your clue.
                The brass elevator stays lit during a chase.
              </p>
              <label className="hotel-gentle">
                <input
                  type="checkbox"
                  checked={gentle}
                  onChange={(e) => {
                    setGentle(e.target.checked);
                    savePrefs(muted, e.target.checked);
                  }}
                />
                Steady lights &amp; gentler motion
              </label>
              <p>
                You start in first person, at your guest’s eye level. Drag to
                look up, down or around. WASD / arrows move, Shift sprints, and
                V switches to a close follow camera. On touch screens, use the
                joystick to move and drag the hallway to look. You automatically
                sprint during escapes.
              </p>
            </div>
          )}
          {modal === 'join' && (
            <form
              className="hotel-join"
              onSubmit={(e) => {
                e.preventDefault();
                void enter('join');
              }}
            >
              <label className="hotel-field">
                Guest name
                <input
                  maxLength={18}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="nickname"
                  placeholder="Guest"
                />
              </label>
              <label className="hotel-field">
                Room code
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''),
                    )
                  }
                  maxLength={6}
                  minLength={6}
                  required
                  pattern="[A-Z2-9]{6}"
                  autoCapitalize="characters"
                  placeholder="ABCDEF"
                  autoComplete="off"
                />
              </label>
              <button
                className="hotel-primary"
                disabled={busy || !ready || code.length !== 6}
                type="submit"
              >
                {busy ? 'Checking in…' : 'Join the hotel'}
                <ArrowUpRight size={18} />
              </button>
            </form>
          )}
          {modal === 'invite' && (
            <>
              <button
                className="hotel-room-code"
                onClick={() => void copyInvite()}
              >
                {session?.code}
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
              <p>
                {copied
                  ? 'Invite link copied.'
                  : 'Tap the code to copy the invite link.'}
              </p>
            </>
          )}
          {modal === 'leave' && (
            <div className="hotel-join">
              <button
                className="hotel-primary"
                disabled={busy}
                onClick={() => void leave()}
              >
                Back to check-in
              </button>
              <button
                className="hotel-text-button"
                disabled={busy}
                onClick={() => {
                  void leave().then(() => location.assign('/'));
                }}
              >
                All games
              </button>
            </div>
          )}
          {notice && <output className="hotel-dialog-notice">{notice}</output>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
