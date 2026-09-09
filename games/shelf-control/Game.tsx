'use client';
/* eslint-disable next/no-html-link-for-pages, next/no-img-element -- Full navigation releases WebGL; local artwork is served on both runtimes. */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  DoorOpen,
  KeyRound,
  LampDesk,
  LoaderCircle,
  Shield,
  Users,
  X,
} from 'lucide-react';
import GameToolbar from '../../shared/ui/GameToolbar';
import { ShelfConnection, requestShelf } from './connection';
import { DOOR, HATCH, SWITCH, clearSight } from './layout';
import {
  distance,
  type Action,
  type Point,
  type Session,
  type Snapshot,
  type SnapshotTiming,
} from './types';
import type { ShelfScene } from './scene';
import type { ShelfAudio } from './audio';
import './shelf-control.css';

const SESSION_KEY = 'jumbleyard:shelf-control';
const prettyTime = (ms: number) =>
  `${Math.floor(Math.ceil(ms / 1000) / 60)}:${String(Math.ceil(ms / 1000) % 60).padStart(2, '0')}`;
function hint(s: Snapshot) {
  const body = s.you.body;
  if (!body) return '';
  if (s.you.status !== 'active')
    return s.you.status === 'escaped'
      ? 'You made it outside. Keep your teammates’ hiding places secret.'
      : 'Caught! Keep the other mannequins’ hiding places secret.';
  if (s.you.role === 'guard')
    return 'Move to look around. Click a mannequin to select it. Inspect from close by.';
  if (s.phase === 'hiding')
    return 'Find your spot. Space changes your pose. The guard cannot see the showroom yet.';
  const near = (p: Point) => distance(body, p) < 1.65 && clearSight(body, p);
  if (s.you.task) return 'Hold still while you switch security off…';
  if (near(SWITCH) && !s.objectives?.powerOff)
    return 'E · Switch off security. Stay still for 3.5 seconds.';
  if (near(DOOR))
    return s.you.carrying === 'key'
      ? 'E · Unlock the loading door'
      : !s.objectives?.powerOff
        ? 'Security is still on. Find the switch in Lighting.'
        : (s.objectives?.keys ?? 0) < 2
          ? 'The loading door needs two keys.'
          : 'E · Escape through the loading door';
  if (near(HATCH))
    return s.you.carrying === 'ladder'
      ? 'E · Place the ladder'
      : !s.objectives?.powerOff
        ? 'Security is still on. Find the switch in Lighting.'
        : !s.objectives?.ladder
          ? 'Bring the ladder to this hatch.'
          : 'E · Climb out through the service hatch';
  if (s.you.carrying)
    return `Carrying ${s.you.carrying === 'prop' ? 'a display box' : `the ${s.you.carrying}`}. Q · Put it down`;
  const item = s.items.find((i) => !i.holder && near(i));
  return item
    ? `E · Pick up ${item.kind === 'prop' ? 'display box' : item.kind}`
    : 'Blend in. Find the security switch, then unlock a door or bring the ladder to the hatch.';
}
function Joystick({ move }: { move: (p: Point) => void }) {
  const [point, setPoint] = useState({ x: 0, z: 0 });
  const pointer = useRef<number | null>(null);
  const update = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 38,
      z = (e.clientY - rect.top - rect.height / 2) / 38,
      length = Math.max(1, Math.hypot(x, z));
    const next = { x: x / length, z: z / length };
    setPoint(next);
    move(next);
  };
  const stop = () => {
    pointer.current = null;
    setPoint({ x: 0, z: 0 });
    move({ x: 0, z: 0 });
  };
  return (
    <div
      className="shelf-stick"
      aria-label="Drag to move"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={update}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <span
        style={{ transform: `translate(${point.x * 32}px,${point.z * 32}px)` }}
      />
      <small>MOVE</small>
    </div>
  );
}
export default function ShelfControl() {
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [session, setSession] = useState<Session | null>(null),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
      'online',
    ),
    [help, setHelp] = useState(false),
    [briefing, setBriefing] = useState<'create' | 'join' | null>(null),
    [briefed, setBriefed] = useState(false),
    [joining, setJoining] = useState(false),
    [muted, setMuted] = useState(false),
    [copied, setCopied] = useState(false),
    [sceneError, setSceneError] = useState('');
  const container = useRef<HTMLDivElement>(null),
    connection = useRef<ShelfConnection | null>(null),
    scene = useRef<ShelfScene | null>(null),
    audio = useRef<ShelfAudio | null>(null),
    latest = useRef<Snapshot | null>(null),
    errorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settings = useRef({ muted: false, paused: false });
  const report = useCallback((message: string) => {
    setError(message);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(''), 6500);
  }, []);
  const receive = useCallback((s: Snapshot, timing?: SnapshotTiming) => {
    latest.current = s;
    setSnapshot(s);
    scene.current?.update(s, timing);
    audio.current?.update(s);
  }, []);
  useEffect(() => {
    // Restore browser storage after hydration, before the next visible frame.
    const restore = requestAnimationFrame(() => {
      const invite =
        new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
      if (/^[A-Z2-9]{6}$/.test(invite)) {
        setCode(invite);
        setJoining(true);
      }
      try {
        setName(localStorage.getItem('jumbleyard:shelf-name') ?? '');
        const saved = JSON.parse(
          sessionStorage.getItem(SESSION_KEY) ?? 'null',
        ) as Session | null;
        if (
          saved?.id &&
          saved.token &&
          /^[A-Z2-9]{6}$/.test(saved.code) &&
          (!invite || saved.code === invite)
        )
          setSession(saved);
      } catch {
        /* Storage is optional. */
      }
    });
    return () => {
      cancelAnimationFrame(restore);
      clearTimeout(errorTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const client = new ShelfConnection(session, receive, setStatus);
    connection.current = client;
    void client.poll();
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* Private browsers can still play. */
    }
    return () => {
      client.stop();
      if (connection.current === client) connection.current = null;
    };
  }, [session, receive]);
  const act = useCallback(
    (action: Action) => {
      if (settings.current.paused) return;
      const client = connection.current;
      if (!client) return;
      const seatAction = [
        'start',
        'restart',
        'fill-start',
        'add-bot',
        'remove-bot',
      ].includes(action.type);
      if (seatAction) setBusy(true);
      audio.current?.unlock();
      if (
        action.type === 'pose' ||
        action.type === 'interact' ||
        action.type === 'inspect'
      )
        scene.current?.clearInput();
      void client
        .action(action)
        .catch((e) =>
          report(e instanceof Error ? e.message : 'Try that again.'),
        )
        .finally(() => {
          if (seatAction) setBusy(false);
        });
    },
    [report],
  );
  const active = snapshot?.phase === 'hiding' || snapshot?.phase === 'playing';
  useEffect(() => {
    let cancelled = false;
    void import('./audio')
      .then(({ ShelfAudio }) => {
        if (cancelled) return;
        audio.current = new ShelfAudio();
        audio.current.mute(settings.current.muted);
        if (latest.current) audio.current.update(latest.current);
        // Resume immediately if the player already interacted while this loaded.
        if (navigator.userActivation?.hasBeenActive) audio.current.unlock();
      })
      .catch(() => {
        /* The showroom can still run if audio cannot load. */
      });
    return () => {
      cancelled = true;
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    void import('./scene')
      .then((visual) => {
        if (cancelled || !container.current) return;
        setSceneError('');
        try {
          scene.current = new visual.ShelfScene(
            container.current,
            (p) => connection.current?.move(p),
            act,
            !active,
          );
          scene.current.setPaused(!active || settings.current.paused);
          if (active && latest.current) {
            scene.current.update(latest.current);
            audio.current?.update(latest.current);
          }
        } catch {
          setSceneError(
            'This browser could not start the 3D showroom. Try a browser with WebGL enabled.',
          );
          scene.current?.dispose();
          scene.current = null;
        }
      })
      .catch(() => {
        if (!cancelled)
          setSceneError(
            'The showroom could not load. Refresh to reconnect to your shift.',
          );
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [active, act]);
  useEffect(() => {
    settings.current = {
      muted,
      paused: help || joining || briefing !== null || status !== 'online',
    };
    audio.current?.mute(muted);
    // Freeze the menu preview without disabling host actions in the lobby.
    scene.current?.setPaused(!active || settings.current.paused);
  }, [muted, help, joining, briefing, active, status]);
  function prepareEnter(join: boolean) {
    if (briefed) void enter(join);
    else {
      setJoining(false);
      setBriefing(join ? 'join' : 'create');
    }
  }
  async function enter(join: boolean) {
    setBusy(true);
    setError('');
    try {
      const reply = await requestShelf({
        op: join ? 'join' : 'create',
        name: name.trim() || 'Shopper',
        ...(join ? { code } : {}),
      });
      if (!reply.session || !reply.snapshot)
        throw new Error('The shop did not return a room. Try again.');
      receive(reply.snapshot);
      setSession(reply.session);
      setJoining(false);
      setStatus('online');
      try {
        localStorage.setItem('jumbleyard:shelf-name', name);
      } catch {
        /* Optional. */
      }
    } catch (e) {
      if (join) setJoining(true);
      report(e instanceof Error ? e.message : 'Could not open the shop.');
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    const client = connection.current;
    connection.current = null;
    scene.current?.clearInput();
    audio.current?.reset();
    setSession(null);
    setSnapshot(null);
    latest.current = null;
    setStatus('online');
    setError('');
    setHelp(false);
    setJoining(false);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* Optional. */
    }
    await client?.leave();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/shelf-control?room=${session?.code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      report(`Share room code ${session?.code}.`);
    }
  }
  const guard = snapshot?.you.role === 'guard',
    finished =
      snapshot?.phase === 'guard-win' || snapshot?.phase === 'mannequins-win';
  const host = snapshot?.host === session?.id;
  return (
    <main
      className={`shelf-game ${active ? 'shelf-active' : ''}`}
      onPointerDown={() => audio.current?.unlock()}
    >
      <div className="shelf-canvas" ref={container} />
      <header className="shelf-header">
        <a
          className="shelf-brand"
          href="/shelf-control"
          onClick={
            session
              ? (e) => {
                  e.preventDefault();
                  void leave();
                }
              : undefined
          }
        >
          <LampDesk size={24} />
          SHELF CONTROL<span>.</span>
        </a>
        <div className="shelf-header-actions">
          {session && (
            <span className="shelf-room-label">
              ROOM <b>{session.code}</b>
            </span>
          )}
          <GameToolbar
            workshop="/act-natural/admin"
            voiceHint="Use your group call to talk with friends. In-game voice is not available in Shelf Control yet."
            muted={muted}
            onToggleSound={() => setMuted((v) => !v)}
            onHelp={() => {
              scene.current?.clearInput();
              setHelp(true);
            }}
            onLeave={
              session
                ? () => void leave().finally(() => location.assign('/'))
                : undefined
            }
          />
        </div>
      </header>
      {!session ? (
        <section className="shelf-welcome">
          <div className="shelf-pitch">
            <p className="eyebrow">
              <span className="tiny-line" /> A VERY SUSPICIOUS NIGHT SHIFT
            </p>
            <h1>
              SHELF
              <br />
              <span>CONTROL.</span>
            </h1>
            <p className="shelf-tagline">
              Everything must stay.
              <br />
              Especially you.
            </p>
            <p className="shelf-intro">
              Blend in. Borrow a ladder. Sneak out.
              <br />
              Try not to look like escaping furniture.
            </p>
          </div>
          <form
            className="setup-card shelf-entry"
            onSubmit={(e) => {
              e.preventDefault();
              prepareEnter(false);
            }}
          >
            <label htmlFor="shelf-name">YOUR NAME</label>
            <input
              id="shelf-name"
              maxLength={18}
              autoComplete="off"
              placeholder="Definitely a normal shopper"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="primary-button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="shelf-spin" size={18} />
              ) : (
                <>
                  Create a room <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={() => setJoining(true)}
            >
              Join with a room code <Users size={17} />
            </button>
            <p className="shelf-small">
              Invite friends or fill the room with NPCs. Everyone takes a turn
              as the guard.
            </p>
          </form>
          <div className="shelf-facts">
            <span>
              <Users size={14} /> 1–4 players + NPCs
            </span>
            <span>
              <Shield size={14} /> 1 vs. 3 · 3 minutes
            </span>
          </div>
          <aside className="shelf-caption">
            <span className="map-badge">NOTHING TO SEE HERE</span>
            <span>That ladder? Part of the display.</span>
          </aside>
        </section>
      ) : !snapshot ? (
        <div className="shelf-loading">
          <LoaderCircle className="shelf-spin" /> Reopening your shop…
        </div>
      ) : active ? (
        <>
          <div className="shelf-hud">
            <div className="shelf-role">
              <span className="shelf-eyebrow">SHIFT {snapshot.round}</span>
              <h2>{guard ? 'Night guard' : 'Living mannequin'}</h2>
              <p>
                {guard
                  ? 'Trust your eyes. They all look innocent.'
                  : 'You are the one with the ring at your feet.'}
              </p>
            </div>
            <div className="shelf-clock">
              <small>
                {snapshot.phase === 'hiding' ? 'HIDING TIME' : 'BEFORE OPENING'}
              </small>
              <strong>{prettyTime(snapshot.remaining)}</strong>
            </div>
            <div className="shelf-progress">
              {guard ? (
                <>
                  <span className="shelf-eyebrow">WRONG GUESSES LEFT</span>
                  <strong>
                    {'●'.repeat(snapshot.mistakes)}
                    <span>{'○'.repeat(5 - snapshot.mistakes)}</span>
                  </strong>
                  <small>
                    {snapshot.caught}/3 caught · {snapshot.escaped}/3 escaped
                  </small>
                </>
              ) : (
                <>
                  <span className="shelf-eyebrow">YOUR ESCAPE PLAN</span>
                  <span className={snapshot.objectives?.powerOff ? 'done' : ''}>
                    <Check size={14} /> Switch off security
                  </span>
                  <small>
                    <KeyRound size={13} /> {snapshot.objectives?.keys}/2 keys ·
                    OR ·{' '}
                    {snapshot.objectives?.ladder
                      ? 'Ladder placed'
                      : 'Bring ladder to hatch'}
                  </small>
                </>
              )}
            </div>
          </div>
          <div className="shelf-instruction" aria-live="polite">
            {hint(snapshot)}
            {snapshot.you.task > 0 && (
              <progress max={1} value={snapshot.you.task} />
            )}
          </div>
          {snapshot.you.status === 'active' && (
            <div className="shelf-controls">
              <Joystick move={(p) => scene.current?.joystickMove(p)} />
              <div className="shelf-keyboard">
                <kbd>W A S D</kbd> move · <kbd>E</kbd>{' '}
                {guard ? 'inspect' : 'interact'}
                {!guard && (
                  <>
                    {' '}
                    · <kbd>Space</kbd> pose · <kbd>Q</kbd> drop
                  </>
                )}
              </div>
              <div className="shelf-actions">
                {!guard && (
                  <button onClick={() => act({ type: 'pose' })}>
                    Pose <kbd>SPACE</kbd>
                  </button>
                )}
                <button
                  className="shelf-action-main"
                  disabled={
                    guard &&
                    (snapshot.inspectCooldown > 0 ||
                      snapshot.phase === 'hiding')
                  }
                  onClick={() => scene.current?.interact()}
                >
                  {guard
                    ? snapshot.inspectCooldown > 0
                      ? `Wait ${(snapshot.inspectCooldown / 1000).toFixed(1)}s`
                      : 'Inspect'
                    : 'Interact'}{' '}
                  <kbd>E</kbd>
                </button>
                {!guard && (
                  <button onClick={() => act({ type: 'drop' })}>
                    Drop <kbd>Q</kbd>
                  </button>
                )}
              </div>
            </div>
          )}
          {guard && snapshot.phase === 'hiding' && (
            <div className="shelf-private-cover">
              <Shield size={40} />
              <p className="shelf-eyebrow">YOUR SHIFT STARTS IN</p>
              <strong>{Math.ceil(snapshot.remaining / 1000)}</strong>
              <h2>Please remain in the office.</h2>
              <p>
                The other three are finding their hiding spots.
                <br />
                You cannot see or hear their activity.
              </p>
            </div>
          )}
          {snapshot.you.status !== 'active' && (
            <div className="shelf-out">
              <DoorOpen size={30} />
              <h2>
                {snapshot.you.status === 'escaped'
                  ? 'Out of stock. Out of here.'
                  : 'Your disguise was… wooden.'}
              </h2>
              <p>
                {snapshot.you.status === 'escaped'
                  ? 'You escaped. Your crew is still playing.'
                  : 'You were caught. The shift is still running.'}
                <br />
                The next round rotates the guard.
              </p>
            </div>
          )}
          {sceneError && (
            <div className="shelf-out">
              <p>{sceneError}</p>
              <button className="secondary-button" onClick={() => void leave()}>
                Return to entrance
              </button>
            </div>
          )}
        </>
      ) : (
        <section className="shelf-lobby">
          <div className="shelf-lobby-panel setup-card">
            <p className="shelf-eyebrow">
              {finished ? `SHIFT ${snapshot.round} · CLOSED` : 'STAFF ASSEMBLY'}
            </p>
            <h1>
              {finished
                ? snapshot.phase === 'mannequins-win'
                  ? 'The furniture wins.'
                  : 'All stock accounted for.'
                : 'Four on the floor.'}
            </h1>
            <p>
              {finished
                ? `${snapshot.escaped} escaped · ${snapshot.caught} caught. ${snapshot.mistakes === 0 ? 'Five false alarms. Management has relieved the guard.' : 'The guard changes next round.'}`
                : 'Invite friends or add NPCs to fill the four places. One guards the shop; the other three plan their escape.'}
            </p>
            <button
              className="shelf-invite"
              onClick={() => void copy()}
              aria-label={`Copy invite link for room ${session.code}`}
            >
              <span>
                <small>ROOM CODE</small>
                <b>{session.code}</b>
              </span>
              {copied ? <Check /> : <Copy />}
            </button>
            <ul className="shelf-roster">
              {Array.from({ length: 4 }, (_, i) => {
                const p = snapshot.players[i];
                return (
                  <li key={p?.id ?? i}>
                    <span className={p ? 'present' : ''}>
                      {p ? <Check size={16} /> : i + 1}
                    </span>
                    <b>{p?.name ?? 'Open place'}</b>
                    <small>
                      {p?.id === snapshot.host
                        ? 'HOST'
                        : p?.bot
                          ? 'NPC'
                          : p
                            ? 'READY'
                            : ''}
                    </small>
                    {host && (!p || p.bot) && (
                      <button
                        className="shelf-seat-button"
                        disabled={busy || status !== 'online'}
                        aria-label={
                          p ? `Remove ${p.name}` : 'Add an NPC to the room'
                        }
                        onClick={() =>
                          act(
                            p
                              ? { type: 'remove-bot', target: p.id }
                              : { type: 'add-bot' },
                          )
                        }
                      >
                        {p ? <X size={14} /> : 'Add NPC'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {snapshot.message && (
              <p className="shelf-small">{snapshot.message}</p>
            )}
            <button
              className="primary-button"
              disabled={!host || busy || status !== 'online'}
              onClick={() =>
                act({
                  type:
                    snapshot.players.length < 4
                      ? 'fill-start'
                      : finished
                        ? 'restart'
                        : 'start',
                })
              }
            >
              {host
                ? snapshot.players.length === 4
                  ? finished
                    ? 'Next shift · rotate guard'
                    : 'Start the night shift'
                  : 'Fill with NPCs & start'
                : 'Waiting for the host'}
              <ArrowRight size={18} />
            </button>
            <p className="shelf-small">
              15 seconds to hide. Then 3 minutes to escape.
              <br />
              NPCs work on escapes, patrol as guard, and follow the same sight
              rules.
            </p>
          </div>
        </section>
      )}
      {status !== 'online' && session && (
        <output className="shelf-connection">
          {status === 'expired' ? (
            <>
              Your shop pass expired.{' '}
              <button onClick={() => void leave()}>Return to entrance</button>
            </>
          ) : (
            <>
              <LoaderCircle className="shelf-spin" size={17} /> Reconnecting…
              Movement paused.
            </>
          )}
        </output>
      )}
      {error && (
        <div className="shelf-toast" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}
      {(help || briefing) && (
        <RulesModal
          close={() => {
            setHelp(false);
            if (briefing === 'join') setJoining(true);
            setBriefing(null);
          }}
        >
          <button
            className="shelf-help-close"
            onClick={() => {
              setHelp(false);
              if (briefing === 'join') setJoining(true);
              setBriefing(null);
            }}
            aria-label="Close instructions"
          >
            <X />
          </button>
          <p className="shelf-eyebrow">
            15 SECONDS TO HIDE · 3 MINUTES TO ESCAPE
          </p>
          <h2 id="shelf-help-title" tabIndex={-1}>
            {briefing ? 'Before your first shift.' : 'How to play.'}
          </h2>
          <p className="shelf-help-intro">
            One night guard. Three living mannequins hiding among the displays.
            The mannequins work together to get at least one teammate out; the
            guard tries to stop every escape.
          </p>
          <div className="shelf-help-columns">
            <article>
              <h3>
                <Shield size={21} /> The guard
              </h3>
              <p>
                Stay in the office for the 15-second hiding phase. Then look for
                three escaping players among 18 identical mannequins.
              </p>
              <p>
                Shelves block your view. NPCs move and carry boxes too. Face a
                suspicious figure or click it to select it, get close, and press
                E to inspect. Five wrong guesses lose the shift.
              </p>
            </article>
            <article>
              <h3>
                <LampDesk size={21} /> The mannequins
              </h3>
              <p>
                Blend in with the displays and move while the guard looks away.
                Strike a pose to look like an ordinary mannequin.
              </p>
              <p>
                Switch security off in the Lighting aisle. Then bring two keys
                to the loading door at the back, or carry the ladder to the
                orange hatch at the front right. Press E at a ready exit to
                escape.
              </p>
            </article>
          </div>
          <p className="shelf-help-controls">
            <kbd>WASD / arrows</kbd> move · <kbd>E</kbd> interact / inspect
            <br />
            Mannequins: <kbd>Space</kbd> stop and pose · <kbd>Q</kbd> drop
            <br />
            On touchscreens, use the movement stick and action buttons.
          </p>
          <p className="shelf-help-note">
            The team wins if at least one mannequin has escaped by the end, or
            the guard makes five wrong guesses. The guard wins if time runs out
            with nobody out. Each new shift rotates the guard.
          </p>
          <p className="shelf-small">
            Streaming together? Show only your own game view during the round.
            Tell your friends when you are ready, but keep hiding places off the
            shared call.
          </p>
          {briefing && (
            <button
              className="primary-button shelf-briefing-start"
              onClick={() => {
                const join = briefing === 'join';
                setBriefed(true);
                setBriefing(null);
                void enter(join);
              }}
            >
              Got it · {briefing === 'join' ? 'join the room' : 'create a room'}
              <ArrowRight size={18} />
            </button>
          )}
        </RulesModal>
      )}
      {joining && !session && (
        <RulesModal close={() => setJoining(false)} titleId="shelf-join-title">
          <button
            className="shelf-help-close"
            onClick={() => setJoining(false)}
            aria-label="Close join room"
          >
            <X />
          </button>
          <p className="shelf-eyebrow">CLOCK IN WITH YOUR CREW</p>
          <h2 id="shelf-join-title">Join the shift.</h2>
          <p className="shelf-small">
            Enter your friend’s six-character room code.
          </p>
          <form
            className="setup-card shelf-join-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6 && !busy) prepareEnter(true);
            }}
          >
            <label htmlFor="shelf-join-name">YOUR NAME</label>
            <input
              id="shelf-join-name"
              maxLength={18}
              autoComplete="off"
              placeholder="Definitely a normal shopper"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="shelf-code">ROOM CODE</label>
            <input
              id="shelf-code"
              className="shelf-code-input"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABC234"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))
              }
            />
            {error && (
              <p className="shelf-join-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary-button"
              disabled={busy || code.length !== 6}
            >
              {busy ? 'Joining…' : 'Join the shift'}
              <ArrowRight size={18} />
            </button>
          </form>
        </RulesModal>
      )}
    </main>
  );
}

function RulesModal({
  close,
  children,
  titleId = 'shelf-help-title',
}: {
  close: () => void;
  children: ReactNode;
  titleId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    node?.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="shelf-help"
      onCancel={close}
      aria-labelledby={titleId}
    >
      {children}
    </dialog>
  );
}
