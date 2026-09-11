'use client';
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token. */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Hammer,
  HardHat,
  LoaderCircle,
  Music,
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
  advanceSite,
  freshSite,
  newWrecker,
  siteAction,
  siteSnapshot,
  standingParts,
  syncNpcs,
} from './simulation';
import {
  PIANO_INTEGRITY,
  ROUND_MS,
  idleInput,
  timeLeft,
  type LoadAction,
  type LoadSession,
  type LoadSnapshot,
  type LoadWorld,
} from './types';
import { LoadBearingSound } from './audio';
import type { LoadBearingScene } from './scene';
import './style.css';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { loadBearingAnalytics, loadBearingPlayState } from './analytics';

const SESSION_KEY = 'load-bearing-session-v1';
const PREFS_KEY = 'load-bearing-prefs-v1';
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const tracker = new GameTracker(loadBearingAnalytics);

export default function LoadBearing() {
  useGameTracker(tracker);
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<LoadBearingScene | null>(null),
    sound = useRef<LoadBearingSound | null>(null),
    network = useRef<PeerGameConnection<LoadSnapshot> | null>(null),
    localWorld = useRef<LoadWorld | null>(null),
    activeSession = useRef<LoadSession | null>(null),
    latest = useRef<LoadSnapshot | null>(null),
    input = useRef(idleInput()),
    actionRef = useRef<(a: LoadAction) => void>(() => {}),
    hudAt = useRef(0);
  const [snapshot, setSnapshot] = useState<LoadSnapshot | null>(null),
    [session, setSession] = useState<LoadSession | null>(null),
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
    playing = w?.phase === 'playing',
    done = w?.phase === 'won' || w?.phase === 'lost',
    foreman = snapshot?.host === session?.id,
    practice = session?.code === 'PRACTICE',
    onCrane = !!me && w?.crane.owner === me.id;

  function accept(next: LoadSnapshot) {
    if (!activeSession.current) return;
    tracker.observe(loadBearingPlayState(next, activeSession.current));
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

  function attach(s: LoadSession, state?: LoadSnapshot) {
    network.current?.stop();
    localWorld.current = null;
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
      'load-bearing',
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
    const audio = new LoadBearingSound();
    sound.current = audio;
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
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
      .then(({ LoadBearingScene: Scene }) => {
        if (disposed || !container.current) return;
        try {
          scene.current = new Scene(container.current, {
            input: (next) => {
              input.current = next;
              const p = localWorld.current?.players[0];
              if (p) {
                p.input = next;
                p.seen = localWorld.current!.clock;
              }
            },
            action: (a) => actionRef.current(a),
            aim: () => {},
            failure: () => {
              setReady(false);
              setNotice('The site view stopped. Reload to rejoin the crew.');
            },
            tick: () => {
              const world = localWorld.current,
                s = activeSession.current;
              if (!world || !s) return;
              advanceSite(world, Date.now());
              accept(siteSnapshot(world, s.code, s.id, s.id, world.clock));
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
            'The site could not load. Enable hardware acceleration and reload to play.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The site could not load. Reload and try again.');
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

  function savePrefs(nextMuted = muted) {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ name, muted: nextMuted }),
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
      const reply = await enterPeerRoom<LoadSnapshot>(
        'load-bearing',
        {
          op,
          name: name.trim() || 'Wrecker',
          ...(op === 'join' ? { code: code.toUpperCase().trim() } : {}),
        },
        () => import('./peer'),
      );
      if (!reply.session)
        throw new Error('The crew could not be joined. Try again.');
      attach(reply.session, reply.snapshot);
      setModal(null);
      history.replaceState(
        null,
        '',
        `/load-bearing?room=${reply.session.code}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not reach the site. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function startPractice(crew = 1) {
    if (!ready || busy) return;
    network.current?.stop();
    network.current = null;
    input.current = idleInput();
    sound.current?.unlock();
    sound.current?.reset();
    savePrefs();
    const now = Date.now(),
      world = freshSite(now, 'practice'),
      s = { code: 'PRACTICE', id: 'practice-wrecker', token: '' };
    world.players.push(newWrecker(s.id, name.trim() || 'Wrecker', 0, now));
    // Practice NPCs use the same roster shape the networked crew does.
    if (crew > 1)
      syncNpcs(
        world,
        Array.from({ length: crew - 1 }, (_, i) => ({
          id: `practice-npc-${i + 1}`,
          name: ['Mika', 'Jo', 'Nora'][i] ?? `Crew ${i + 2}`,
          color: i + 1,
        })),
      );
    siteAction(world, s.id, { type: 'practice' }, s.id);
    localWorld.current = world;
    activeSession.current = s;
    setSession(s);
    setStatus('online');
    setNotice('');
    latest.current = null;
    scene.current?.setSession(s.id);
    accept(siteSnapshot(world, s.code, s.id, s.id, now));
  }

  function action(a: LoadAction) {
    if (modal || !activeSession.current || status !== 'online') return;
    tracker.action(a.type);
    sound.current?.unlock();
    setNotice('');
    try {
      if (localWorld.current) {
        siteAction(
          localWorld.current,
          activeSession.current.id,
          a,
          activeSession.current.id,
        );
        accept(
          siteSnapshot(
            localWorld.current,
            'PRACTICE',
            activeSession.current.id,
            activeSession.current.id,
            localWorld.current.clock,
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
    tracker.observe({ stage: 'menu' });
    setBusy(true);
    try {
      await network.current?.leave();
    } catch {
      network.current?.stop();
    } finally {
      network.current = null;
      localWorld.current = null;
      activeSession.current = null;
      latest.current = null;
      input.current = idleInput();
      setSession(null);
      setSnapshot(null);
      setModal(null);
      setNotice('');
      sound.current?.reset();
      sound.current?.update(null);
      setBusy(false);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* Storage is optional. */
      }
      history.replaceState(null, '', '/load-bearing');
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/load-bearing?room=${session?.code}`,
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

  const disabled = !playing || status !== 'online' || !!modal || !me;
  const standing = w ? standingParts(w).length : 0;
  const integrity = w ? Math.round(w.piano.integrity) : PIANO_INTEGRITY;
  const remaining = w ? timeLeft(w) : ROUND_MS;
  const urgent = remaining < 30_000 && playing && w?.mode !== 'practice';

  return (
    <main className={`lb-game${session ? ' in-session' : ''}`}>
      <div className="lb-canvas" ref={container} />
      <header className="topbar">
        <a href="/" className="wordmark">
          <span className="lb-mark">
            <Hammer size={22} />
          </span>{' '}
          LOAD BEARING<span className="title-dot">.</span>
        </a>
        <GameToolbar
          muted={muted}
          onToggleSound={() => {
            const next = !muted;
            setMuted(next);
            if (sound.current) {
              sound.current.unlock();
              sound.current.enabled = !next;
            }
            savePrefs(next);
          }}
          onHelp={() => setModal('help')}
          onLeave={session ? () => setModal('leave') : undefined}
          workshop="/load-bearing/admin"
          voice={
            session?.peer && w
              ? {
                  session: { ...session, game: 'load-bearing' },
                  snapshot: { players: w.players, nearby: false },
                  onSpeaking: (active) => sound.current?.duck(active),
                }
              : undefined
          }
          voiceHint="Create or join a crew to use voice chat."
        />
      </header>

      {!session && (
        <section className="lb-welcome">
          <p className="eyebrow">
            <span className="tiny-line" /> A THREE-MINUTE DEMOLITION JOB
          </p>
          <h1>
            LOAD
            <span>BEARING.</span>
          </h1>
          <p className="lb-tagline">
            It all has to come down.
            <br />
            Except the piano.
          </p>
          <p className="lb-intro">
            One condemned house, one wrecking ball, and a client&rsquo;s piano
            on the upper floor.
            <br />
            Cut the wrong support and the storey pancakes onto it.
          </p>
          <form
            className="setup-card"
            onSubmit={(event) => {
              event.preventDefault();
              if (ready && !busy) void enter('create');
            }}
          >
            <label htmlFor="lb-name">YOUR NAME</label>
            <input
              id="lb-name"
              value={name}
              autoComplete="nickname"
              maxLength={18}
              placeholder="Wrecker"
              onChange={(event) => setName(event.target.value)}
            />
            <button className="primary-button" disabled={!ready || busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  Start a crew <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!ready || busy}
              onClick={() => setModal('join')}
            >
              Join with a room code <Users size={17} />
            </button>
            <div className="lb-practice">
              <button
                className="practice-link"
                type="button"
                disabled={!ready || busy}
                onClick={() => startPractice(1)}
              >
                Just me? Try it solo <HardHat size={14} />
              </button>
              <button
                className="practice-link"
                type="button"
                disabled={!ready || busy}
                onClick={() => startPractice(4)}
              >
                Practice with a crew <Users size={14} />
              </button>
            </div>
            <p className="start-tip">
              {ready
                ? 'Invite friends or fill the crew with NPC wreckers.'
                : 'Preparing the site…'}
            </p>
          </form>
          <div className="lb-facts">
            <span>
              <Users size={14} /> 1–4 players + NPCs
            </span>
            <span>
              <Timer size={14} /> 3-minute jobs
            </span>
          </div>
        </section>
      )}

      {!session && (
        <>
          <aside className="scene-caption">
            <span className="map-badge">MIND THE PIANO</span>
            <span>Second floor. Client&rsquo;s. Priceless.</span>
          </aside>
          <footer className="start-footer">
            <span>
              <span className="live-dot" /> NO DOWNLOAD. JUST BRING YOUR CREW.
            </span>
            <span>THE SURVEYOR SAID THAT WALL WAS FINE.</span>
          </footer>
        </>
      )}

      {session && w && (
        <>
          <section className="lb-hud">
            <div className={`lb-stat${urgent ? ' urgent' : ''}`}>
              <Timer size={16} />
              <strong>{w.mode === 'practice' ? '—' : clock(remaining)}</strong>
              <span>left</span>
            </div>
            <div className="lb-stat">
              <HardHat size={16} />
              <strong>{standing}</strong>
              <span>standing</span>
            </div>
            <div
              className={`lb-stat${integrity < 40 ? ' urgent' : ''}`}
              title="The client's piano"
            >
              <Music size={16} />
              <strong>{integrity}%</strong>
              <span>piano</span>
            </div>
            <div className="lb-stat">
              <Users size={16} />
              <strong>{w.players.length}</strong>
              <span>crew</span>
            </div>
          </section>

          <ul className="lb-log">
            {w.events.slice(-4).map((event) => (
              <li key={event.id} className={`lb-event lb-${event.kind}`}>
                {event.text}
              </li>
            ))}
          </ul>

          {w.phase === 'lobby' && (
            <section className="lb-start">
              {foreman ? (
                <button
                  className="primary-button"
                  onClick={() => action({ type: 'start' })}
                >
                  Start the job
                </button>
              ) : (
                <p>Waiting for the foreman to start the job.</p>
              )}
              {!practice && (
                <button
                  className="secondary-button"
                  onClick={() => setModal('invite')}
                >
                  Invite the crew
                </button>
              )}
            </section>
          )}

          {done && (
            <section className="lb-result">
              <h2>{w.phase === 'won' ? 'Signed off' : 'Not signed off'}</h2>
              <p>{w.events.at(-1)?.text}</p>
              {foreman && (
                <button
                  className="primary-button"
                  onClick={() => action({ type: 'restart' })}
                >
                  Another job
                </button>
              )}
            </section>
          )}

          <nav className="tool-dock" aria-label="Site actions">
            <button
              disabled={disabled}
              onClick={() => action({ type: 'swing' })}
            >
              Swing <kbd>E</kbd>
            </button>
            <button
              disabled={disabled}
              onClick={() => action({ type: 'mark' })}
            >
              Mark <kbd>Q</kbd>
            </button>
            <button
              disabled={disabled}
              onClick={() => action({ type: 'help' })}
            >
              Help <kbd>F</kbd>
            </button>
            <button
              disabled={disabled}
              onClick={() => action({ type: 'crane' })}
            >
              {onCrane ? 'Park ball' : 'Take ball'} <kbd>C</kbd>
            </button>
            <button onClick={() => scene.current?.toggleCamera()}>
              View <kbd>V</kbd>
            </button>
          </nav>

          {onCrane && (
            <p className="lb-crane-hint">
              Crane: WASD swings the hoist, <kbd>R</kbd> raises, <kbd>Z</kbd>{' '}
              lowers, <kbd>X</kbd> parks it.
            </p>
          )}

          <TouchControls
            disabled={disabled}
            move={(v) => scene.current?.move(v)}
            jump={() => scene.current?.jump()}
          />
        </>
      )}

      {notice && <p className="lb-notice">{notice}</p>}
      {status === 'reconnecting' && session && (
        <p className="lb-notice">Reconnecting to the crew&hellip;</p>
      )}

      <Dialog open={modal === 'join'} onOpenChange={() => setModal(null)}>
        <DialogContent className="game-dialog">
          <DialogTitle>Join a crew</DialogTitle>
          <DialogDescription>
            Enter the six-character code your foreman shared.
          </DialogDescription>
          <input
            className="dialog-input code-input"
            value={code}
            maxLength={6}
            placeholder="ABC123"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <button
            className="primary-button"
            disabled={busy || code.trim().length !== 6}
            onClick={() => void enter('join')}
          >
            Join the crew
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'invite'} onOpenChange={() => setModal(null)}>
        <DialogContent className="game-dialog">
          <DialogTitle>Invite the crew</DialogTitle>
          <DialogDescription>
            Up to four wreckers. Share this code or the link.
          </DialogDescription>
          <p className="invite-code">{session?.code}</p>
          <button
            className="secondary-button"
            onClick={() => void copyInvite()}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'help'} onOpenChange={() => setModal(null)}>
        <DialogContent className="game-dialog">
          <DialogTitle>How to bring it down</DialogTitle>
          <DialogDescription>
            Destroy every part of the house inside three minutes without
            destroying the piano on the upper floor.
          </DialogDescription>
          <ul className="lb-help help-note">
            <li>
              <kbd>WASD</kbd> move, <kbd>Space</kbd> jump, <kbd>V</kbd> changes
              camera.
            </li>
            <li>
              <kbd>E</kbd> swings the sledgehammer at whatever you are aiming
              at. Walls take three blows, columns five.
            </li>
            <li>
              <kbd>C</kbd> takes the shared wrecking ball. It destroys anything
              it touches and swings on a real cable.
            </li>
            <li>
              <kbd>Q</kbd> sprays a mark so the crew can agree a plan.{' '}
              <kbd>F</kbd> digs out a teammate caught by falling debris.
            </li>
            <li>
              Parts hold each other up. Cut what a floor rests on and everything
              above it comes down at once &mdash; including onto the piano.
            </li>
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'leave'} onOpenChange={() => setModal(null)}>
        <DialogContent className="game-dialog">
          <DialogTitle>Leave the site?</DialogTitle>
          <DialogDescription>
            The rest of the crew keeps working without you.
          </DialogDescription>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void leave()}
          >
            Leave
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
