'use client';
/* eslint-disable next/no-img-element -- The generated illustration is a local asset served by both hosting targets. */
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token for the angler name. */
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  Anchor,
  ArrowUpRight,
  Camera,
  Check,
  Copy,
  Fish,
  LifeBuoy,
  LoaderCircle,
  Scissors,
  Trophy,
  Users,
  Waves,
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
  advanceReel,
  freshReel,
  newAngler,
  reelAction,
  reelSnapshot,
  hookedAnglers,
} from './simulation';
import {
  ANGLER_COLORS,
  CATCHES,
  ROUND_MS,
  idleInput,
  type ReelAction,
  type ReelSession,
  type ReelSnapshot,
  type ReelWorld,
} from './types';
import { ReelSound } from './audio';
import { WEATHER_LABELS } from './chaos';
import type { ReelScene } from './scene';
import './style.css';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { reelAnalytics, reelPlayState } from './analytics';

const SESSION_KEY = 'reel-problems-session-v1';
const time = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function HoldButton({
  children,
  label,
  active,
  hold,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  hold: (held: boolean) => void;
  disabled: boolean;
}) {
  const release = (e: PointerEvent<HTMLButtonElement>) => {
    hold(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <button
      type="button"
      className={`reel-action${active ? ' active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        hold(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => hold(false)}
      onBlur={() => hold(false)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          hold(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') hold(false);
      }}
    >
      {children}
    </button>
  );
}
const tracker = new GameTracker(reelAnalytics);

export default function ReelProblems() {
  useGameTracker(tracker);
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<ReelScene | null>(null),
    sound = useRef<ReelSound | null>(null),
    network = useRef<PeerGameConnection<ReelSnapshot> | null>(null),
    local = useRef<ReelWorld | null>(null),
    activeSession = useRef<ReelSession | null>(null),
    latest = useRef<ReelSnapshot | null>(null),
    input = useRef(idleInput()),
    actionRef = useRef<(a: ReelAction) => void>(() => {}),
    hudAt = useRef(0);
  const [snapshot, setSnapshot] = useState<ReelSnapshot | null>(null),
    [session, setSession] = useState<ReelSession | null>(null),
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
    [modal, setModal] = useState<
      'help' | 'join' | 'invite' | 'leave' | 'restart' | null
    >(null);
  const w = snapshot?.world,
    me = w?.players.find((p) => p.id === session?.id),
    playing = w?.phase === 'playing',
    done = w?.phase === 'won' || w?.phase === 'lost',
    captain = snapshot?.host === session?.id,
    practice = session?.code === 'PRACTICE';
  function accept(next: ReelSnapshot) {
    if (!activeSession.current) return;
    tracker.observe(reelPlayState(next, activeSession.current));
    const previous = latest.current;
    latest.current = next;
    scene.current?.setSnapshot(next);
    sound.current?.update(next.world, activeSession.current?.id);
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
  function attach(s: ReelSession, state?: ReelSnapshot) {
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
      'reel-problems',
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
    const audio = new ReelSound();
    sound.current = audio;
    try {
      const saved = JSON.parse(
        localStorage.getItem('reel-problems-prefs-v1') || '{}',
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
      .then(({ ReelScene }) => {
        if (disposed || !container.current) return;
        try {
          scene.current = new ReelScene(container.current, {
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
                'The lake display lost its connection. Reload to rejoin your boat.',
              );
            },
            tick: () => {
              const world = local.current,
                s = activeSession.current;
              if (!world || !s) return;
              advanceReel(world, Date.now());
              accept(reelSnapshot(world, s.code, s.id, s.id, world.clock));
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
            'The lake could not load. Enable hardware acceleration and reload to play.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The lake could not load. Reload and try again.');
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
        'reel-problems-prefs-v1',
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
      const reply = await enterPeerRoom<ReelSnapshot>(
        'reel-problems',
        {
          op,
          name: name.trim() || 'Angler',
          ...(op === 'join' ? { code: code.toUpperCase().trim() } : {}),
        },
        () => import('./peer'),
      );
      if (!reply.session)
        throw new Error('The boat could not be joined. Try again.');
      attach(reply.session, reply.snapshot);
      setModal(null);
      history.replaceState(
        null,
        '',
        `/reel-problems?room=${reply.session.code}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not reach the lake. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  function startPractice() {
    if (!ready) return;
    network.current?.stop();
    network.current = null;
    input.current = idleInput();
    sound.current?.unlock();
    sound.current?.reset();
    savePrefs();
    const now = Date.now(),
      world = freshReel(now),
      s = { code: 'PRACTICE', id: 'practice-angler', token: '' };
    world.players.push(newAngler(s.id, name.trim() || 'You', 0, now));
    reelAction(world, s.id, { type: 'start' }, s.id);
    local.current = world;
    activeSession.current = s;
    setSession(s);
    setStatus('online');
    setNotice('');
    latest.current = null;
    scene.current?.setSession(s.id);
    accept(reelSnapshot(world, s.code, s.id, s.id, now));
  }
  function action(a: ReelAction) {
    if (modal || !activeSession.current) return;
    tracker.action(a.type);
    sound.current?.unlock();
    setNotice('');
    try {
      if (local.current) {
        reelAction(
          local.current,
          activeSession.current.id,
          a,
          activeSession.current.id,
        );
        accept(
          reelSnapshot(
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
    if (modal) scene.current?.resetInput();
  }, [modal]);
  async function leave() {
    tracker.observe({ stage: 'menu' });
    setBusy(true);
    try {
      await network.current?.leave();
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
      setBusy(false);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* Storage is optional. */
      }
      history.replaceState(null, '', '/reel-problems');
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/reel-problems?room=${session?.code}`,
      );
      setCopied(true);
    } catch {
      setNotice('Copy the room code below and share it with your crew.');
    }
  }
  const fishOn =
    me?.line?.kind === 'fish'
      ? w?.fish.find((f) => f.id === me.line?.target)
      : null;
  const downed = !!me?.swimming && !!w && w.clock < me.downedUntil;
  const lineLabel = me?.swimming
    ? downed
      ? 'Pulled under! The crew is hauling you out'
      : me.clinging
        ? 'Holding on — hold E to climb aboard'
        : 'Overboard! Swim to the hull'
    : me?.line?.tangled
      ? 'Tangled! Press R to loosen'
      : me?.line?.kind === 'player'
        ? 'You hooked a friend'
        : fishOn?.surge
          ? 'Fish surging — ease off E!'
          : fishOn
            ? `${CATCHES[fishOn.kind].name} — reel it in!`
            : me?.line
              ? 'Waiting for a bite…'
              : 'Click the water or press Space to cast';
  const helpers = fishOn && w ? hookedAnglers(w, fishOn.id) : [];
  const seaLife =
    w?.wildlife?.filter((visitor) => visitor.activeUntil > w.clock) ?? [];
  const lastEvent = w?.events.at(-1);
  const uiDisabled = !playing || status !== 'online' || !!modal;
  return (
    <main className={`reel-game${session ? ' in-session' : ''}`}>
      <div className="reel-canvas" ref={container} />
      <header className="reel-header">
        <a href="/" className="reel-brand">
          <span>
            <Fish size={22} />
          </span>{' '}
          REEL PROBLEMS<span className="reel-dot">.</span>
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
                'reel-problems-prefs-v1',
                JSON.stringify({ name, muted: !muted }),
              );
            } catch {
              /* Optional. */
            }
          }}
          onHelp={() => setModal('help')}
          onLeave={session ? () => setModal('leave') : undefined}
          workshop="/reel-problems/admin"
          voice={
            session?.peer && w
              ? {
                  session: { ...session, game: 'reel-problems' },
                  onSpeaking: (active) => sound.current?.duck(active),
                  snapshot: { players: w.players, nearby: false },
                }
              : undefined
          }
          voiceHint="Launch a boat with friends to use voice chat."
        />
      </header>
      {!session ? (
        <section className="reel-menu">
          <div className="reel-menu-copy">
            <span className="reel-kicker">
              <span /> JUMBLEYARD FISHING CLUB
            </span>
            <h1>
              The fish
              <br />
              caught <em>us.</em>
            </h1>
            <p>
              Four friends. One tiny boat.
              <br />A very big problem on the other end.
            </p>
            <div className="reel-meta">
              <span>
                <Users size={15} /> 1–4 anglers
              </span>
              <span>
                <Waves size={16} /> 5-minute tournaments
              </span>
            </div>
            <label className="reel-name">
              Your angler name
              <input
                maxLength={18}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Captain Questionable"
                autoComplete="nickname"
              />
            </label>
            <button
              className="reel-primary"
              disabled={!ready || busy}
              onClick={() => void enter('create')}
            >
              {busy ? (
                <LoaderCircle className="reel-spin" size={19} />
              ) : (
                <Anchor size={19} />
              )}{' '}
              Launch a boat <ArrowUpRight size={19} />
            </button>
            <div className="reel-menu-secondary">
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
            <span className="reel-menu-note">
              No download. Bring friends. Bring a spare hat.
            </span>
          </div>
          <figure className="reel-menu-art">
            <img
              src="/images/reel-problems.png"
              alt="Four toy anglers in a tiny coral boat are pulled across a turquoise lake by an enormous fish, with tangled lines and one friend overboard."
              width={1536}
              height={1024}
            />
            <figcaption>
              <span>THE LAKE MANAGER</span>
              <strong>He would like a word.</strong>
            </figcaption>
          </figure>
        </section>
      ) : (
        <>
          <section className="reel-scoreboard" aria-label="Tournament score">
            <div>
              <span>{practice ? 'SOLO TOURNAMENT' : 'CREW TOURNAMENT'}</span>
              <strong>
                <Fish size={20} /> {w?.score ?? 0}
                <small> / {w?.goal ?? 0} pts</small>
              </strong>
              <progress
                aria-label="Catch target"
                max={w?.goal ?? 100}
                value={w?.score ?? 0}
              />
            </div>
            <div
              className={`reel-clock${w && w.clock - w.started > ROUND_MS - 30000 ? ' urgent' : ''}`}
            >
              <span>LINES IN</span>
              <strong>
                {w?.phase === 'lobby'
                  ? '5:00'
                  : time(ROUND_MS - ((w?.clock ?? 0) - (w?.started ?? 0)))}
              </strong>
            </div>
          </section>
          {playing && w?.weather && (
            <aside
              className={`reel-weather ${w.weather.kind}`}
              aria-label="Lake conditions"
            >
              <Waves size={18} aria-hidden="true" />
              <div>
                <strong>{WEATHER_LABELS[w.weather.kind]}</strong>
                {seaLife.some((v) => v.kind === 'shark') && (
                  <span>Shark circling</span>
                )}
                {seaLife.some((v) => v.kind === 'jellyfish') && (
                  <span>Jellyfish nearby</span>
                )}
              </div>
            </aside>
          )}
          <aside className="reel-crew" aria-label="Boat crew">
            <div className="reel-crew-title">
              <span>
                <Users size={15} /> {w?.players.length ?? 0}/4 ABOARD
              </span>
              <button
                onClick={() => {
                  setCopied(false);
                  setModal('invite');
                }}
                disabled={practice}
              >
                Invite
              </button>
            </div>
            {w?.players.map((p) => (
              <div className="reel-crew-person" key={p.id}>
                <i style={{ background: ANGLER_COLORS[p.color] }} />
                <span>
                  {p.name}
                  {p.id === session.id ? ' (you)' : ''}
                </span>
                <small>
                  {p.swimming
                    ? w && w.clock < p.downedUntil
                      ? 'under!'
                      : p.clinging
                        ? 'climbing'
                        : 'swimming'
                    : p.line?.tangled
                      ? 'tangled'
                      : p.line?.kind === 'fish'
                        ? 'fish on!'
                        : 'aboard'}
                </small>
              </div>
            ))}
            <div className="reel-gear">
              {w?.gear.tire || w?.gear.magnet || w?.gear.boot ? (
                <>
                  {w.gear.tire && <span>Tyre: steadier boat</span>}
                  {w.gear.magnet && <span>Magnet: wider bite zone</span>}
                  {w.gear.boot && <span>Lucky boot: faster catches</span>}
                </>
              ) : (
                <span>Hook junk to upgrade the boat.</span>
              )}
            </div>
          </aside>
          <button
            className="reel-camera"
            onClick={() => scene.current?.changeCamera()}
            aria-label="Switch lake camera"
          >
            <Camera size={19} />
            <span>View</span>
          </button>
          {w?.phase === 'lobby' && (
            <section className="reel-lobby">
              <span className="reel-kicker">YOUR BOAT IS READY</span>
              <h2>All aboard?</h2>
              <p>Share the code. The captain starts when the crew is ready.</p>
              <button
                className="reel-room-code"
                onClick={() => {
                  setCopied(false);
                  setModal('invite');
                }}
              >
                {session.code} <Copy size={19} />
              </button>
              <button
                className="reel-primary"
                disabled={!captain || status !== 'online'}
                onClick={() => action({ type: 'start' })}
              >
                {captain ? 'Start the tournament' : 'Waiting for the captain…'}{' '}
                <ArrowUpRight size={18} />
              </button>
            </section>
          )}
          {playing && (
            <>
              <section
                className="reel-line-panel"
                aria-label="Your fishing line"
              >
                <span
                  className={
                    fishOn?.surge || me?.line?.tangled ? 'warning' : ''
                  }
                >
                  {lineLabel}
                </span>
                {!me?.swimming && (
                  <div className="reel-tension">
                    <small>LINE TENSION</small>
                    <meter
                      aria-label="Line tension"
                      min={0}
                      max={1.2}
                      low={0.65}
                      high={0.92}
                      optimum={0.35}
                      value={me?.line?.tension ?? 0}
                    />
                    <b>{Math.round((me?.line?.tension ?? 0) * 100)}%</b>
                  </div>
                )}
                {me?.swimming && (
                  <div className="reel-fish-stamina">
                    <small>CONDITION</small>
                    <progress
                      aria-label="Your condition in the water"
                      max={1}
                      value={me.health}
                    />
                    <span>
                      {downed
                        ? 'Under'
                        : me.health >= 1
                          ? 'Fine'
                          : me.health > 0.5
                            ? 'Rattled'
                            : 'Barely'}
                    </span>
                  </div>
                )}
                {me?.clinging && (
                  <div className="reel-fish-stamina">
                    <small>CLIMB</small>
                    <progress
                      aria-label="Climb progress"
                      max={1}
                      value={me.climb}
                    />
                    <span>{Math.round(me.climb * 100)}%</span>
                  </div>
                )}
                {fishOn && (
                  <p className="reel-team-pull">
                    {helpers.length > 1
                      ? `${helpers.length} anglers on this fish · ${helpers.filter((p) => p.input.reel).length} reeling`
                      : 'Friends can cast onto this fish to help!'}
                  </p>
                )}
                {fishOn && (
                  <div className="reel-fish-stamina">
                    <small>FISH ENERGY</small>
                    <progress
                      aria-label="Fish energy"
                      max={CATCHES[fishOn.kind].stamina}
                      value={fishOn.stamina}
                    />
                    <span>
                      {fishOn.stamina <= 0
                        ? 'Bring it close!'
                        : fishOn.surge
                          ? 'Surging'
                          : 'Tiring'}
                    </span>
                  </div>
                )}
              </section>
              <TouchControls
                disabled={uiDisabled}
                move={(v) => scene.current?.move(v)}
                jump={() => action({ type: me?.swimming ? 'rescue' : 'cast' })}
              />
              <nav className="reel-action-dock" aria-label="Fishing actions">
                <button
                  className="reel-action"
                  onClick={() => action({ type: 'cast' })}
                  disabled={uiDisabled || !!me?.line || me?.swimming}
                >
                  <Fish size={18} />
                  <span>
                    Cast<kbd>Space</kbd>
                  </span>
                </button>
                <HoldButton
                  label={me?.clinging ? 'Hold to climb' : 'Hold to reel'}
                  active={!!me?.input.reel}
                  hold={(held) => scene.current?.hold('reel', held)}
                  disabled={uiDisabled || (!me?.line && !me?.clinging)}
                >
                  <Anchor size={18} />
                  <span>
                    {me?.clinging ? 'Climb' : 'Reel'}
                    <kbd>Hold E</kbd>
                  </span>
                </HoldButton>
                <HoldButton
                  label="Hold to brace"
                  active={!!me?.input.brace}
                  hold={(held) => scene.current?.hold('brace', held)}
                  disabled={uiDisabled || !!me?.swimming}
                >
                  <Waves size={18} />
                  <span>
                    Brace<kbd>Shift</kbd>
                  </span>
                </HoldButton>
                <button
                  className="reel-action"
                  disabled={uiDisabled || !me?.line?.tangled}
                  onClick={() => action({ type: 'untangle' })}
                >
                  <span>
                    Untangle<kbd>R</kbd>
                  </span>
                </button>
                <button
                  className="reel-action"
                  disabled={uiDisabled || !me?.line}
                  onClick={() => action({ type: 'cut' })}
                >
                  <Scissors size={18} />
                  <span>
                    Cut<kbd>Q</kbd>
                  </span>
                </button>
                <button
                  className="reel-action"
                  disabled={uiDisabled}
                  onClick={() => action({ type: 'rescue' })}
                >
                  <LifeBuoy size={18} />
                  <span>
                    {me?.swimming ? 'Grab on' : 'Rescue'}
                    <kbd>F</kbd>
                  </span>
                </button>
              </nav>
              <span className="reel-movement-hint">
                WASD / arrows · move around the boat · click the water to aim
              </span>
            </>
          )}
          {done && (
            <section className="reel-results">
              <Trophy size={37} />
              <span className="reel-kicker">TOURNAMENT COMPLETE</span>
              <h2>
                {w?.phase === 'won' ? 'Catch of the day.' : 'The lake wins.'}
              </h2>
              <p>
                {w?.score} points · target {w?.goal}
                <br />
                {w?.players.reduce((sum, p) => sum + p.catches, 0)} catches.{' '}
                {w?.players.reduce((sum, p) => sum + p.splashes, 0)} unplanned
                swims.
              </p>
              <div className="reel-haul">
                {Object.entries(w?.haul ?? {}).map(([kind, count]) => (
                  <span key={kind}>
                    {CATCHES[kind as keyof typeof CATCHES].name} <b>×{count}</b>
                  </span>
                ))}
              </div>
              <button
                className="reel-primary"
                disabled={!captain}
                onClick={() => action({ type: 'restart' })}
              >
                {captain ? 'One more tournament' : 'Waiting for the captain…'}
              </button>
              <button className="reel-text-button" onClick={() => void leave()}>
                Back to the dock
              </button>
            </section>
          )}
        </>
      )}
      {(notice ||
        (session && status !== 'online') ||
        (playing && lastEvent && w && w.clock - w.started < ROUND_MS)) && (
        <output className="reel-notice">
          {notice ||
            (status === 'expired'
              ? 'This room expired. Leave the boat and join again.'
              : status === 'reconnecting'
                ? 'Connecting to your crew…'
                : lastEvent?.text)}
        </output>
      )}
      {!ready && !notice && (
        <output className="reel-loading">
          <LoaderCircle className="reel-spin" size={18} /> Getting the boat
          ready…
        </output>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="reel-dialog">
          <DialogTitle>
            {modal === 'help'
              ? 'A quick fishing lesson'
              : modal === 'join'
                ? 'Find your crew'
                : modal === 'invite'
                  ? 'There is room for trouble.'
                  : modal === 'restart'
                    ? 'Start a fresh tournament?'
                    : 'Back to the dock?'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'help'
              ? 'Catch enough points in five minutes. Keep your crew in the boat.'
              : modal === 'join'
                ? 'Ask a friend for their six-character boat code.'
                : modal === 'invite'
                  ? 'Up to four anglers can join before the tournament starts.'
                  : 'Your friends can keep fishing when you leave.'}
          </DialogDescription>
          {modal === 'help' && (
            <div className="reel-help">
              <p>
                <b>Move:</b> WASD / arrows or the joystick. Walk against the
                lean to balance the boat. Steep decks send you sliding
                overboard; hold Shift to brace. Even bracing has limits in
                extreme tilts.
              </p>
              <p>
                <b>Cast:</b> click a fish on the lake, or Space for a nearby
                catch. Your hook can catch friends too.
              </p>
              <p>
                <b>Reel:</b> hold E while the fish is tired. Release during a
                surge or red tension. Shift braces your feet.
              </p>
              <p>
                <b>Team pull:</b> cast onto a friend’s fish to help. Each line
                adds pulling power and tires the fish faster. Everyone attached
                shares catch credit; losing one line leaves the others fishing.
              </p>
              <p>
                <b>Wild water:</b> gusts push and rock the boat, rain makes the
                deck slippery, and thunderstorms bring big waves. Sharks bump
                the hull; glowing jellyfish snag nearby hooks. Brace, balance,
                and use R to free your line.
              </p>
              <p>
                <b>In the water:</b> swim to the hull and you grab hold
                automatically, then hold E for five seconds to climb aboard.
                WASD shimmies you along the side. A shark will leave the boat
                alone and come straight for a swimmer — two bites and you go
                under, costing the crew points. A jellyfish sting shocks your
                hands open and drops you off the hull.
              </p>
              <p>
                <b>Tangles:</b> crossed lines knot together. R loosens nearby
                knots; spread out, or Q cuts free.
              </p>
              <p>
                <b>Rescue:</b> F pulls a nearby friend straight aboard, or
                reaches for the hull when you are the one swimming. You can also
                reel a swimming friend closer. A safety rope returns you after
                twelve seconds.
              </p>
              <p>
                <b>Junk:</b> tyres steady the boat, magnets widen the bite zone,
                and a lucky boot helps tire fish.
              </p>
              <p>
                Touch players: use the joystick and fishing buttons. Hold Reel
                and Brace; tap the other actions.
              </p>
            </div>
          )}
          {modal === 'join' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void enter('join');
              }}
              className="reel-join-form"
            >
              <label>
                Your name
                <input
                  value={name}
                  maxLength={18}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Angler"
                  autoComplete="nickname"
                />
              </label>
              <label>
                Boat code
                <input
                  value={code}
                  maxLength={6}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''),
                    )
                  }
                  placeholder="ABCDEF"
                  autoComplete="off"
                />
              </label>
              <button
                className="reel-primary"
                disabled={busy || code.length !== 6 || !ready}
              >
                {busy ? 'Joining…' : 'Jump aboard'} <ArrowUpRight size={17} />
              </button>
              {notice && <p role="alert">{notice}</p>}
            </form>
          )}
          {modal === 'invite' && (
            <>
              <div className="reel-room-code">{session?.code}</div>
              <button
                className="reel-primary"
                onClick={() => void copyInvite()}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Invite copied' : 'Copy invite link'}
              </button>
              <p className="reel-small">
                Your crew opens the link, enters a name, and joins the boat.
              </p>
            </>
          )}
          {modal === 'leave' && (
            <button
              className="reel-primary"
              disabled={busy}
              onClick={() => void leave()}
            >
              {busy ? 'Leaving…' : 'Leave the boat'}
            </button>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
