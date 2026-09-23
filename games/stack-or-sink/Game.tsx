'use client';
import { gameInviteUrl } from '../../shared/browser/public-url';

/* oxlint-disable react/react-compiler -- This uncompiled WebGL host synchronizes mutable scene controllers and saved browser state; hook rules and exhaustive dependencies remain enforced. */
/* oxlint-disable jsx-a11y/autocomplete-valid -- nickname is a standard HTML autocomplete token. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- HUD live regions use styled containers with explicit ARIA semantics. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../../shared/browser/use-media-query';
import {
  ArrowRight,
  Waves,
  Users,
  ArrowUpRight,
  LifeBuoy,
  HardHat,
  Copy,
  Check,
  X,
  Hand,
  RotateCw,
  Construction,
  Mountain,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Flag,
  LogOut,
  Eye,
  Timer,
  PackageOpen,
  Trophy,
  Anchor,
  LoaderCircle,
  Plus,
  Minus,
  Share2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { act, createPlayer, freshWorld, tick } from './simulation';
import { topOf } from './physics';
import { FLOOR } from './geometry';
import { CraneMap } from './CraneMap';
import { Connection, requestRoom } from './connection';
import { COLORS } from '../../shared/rendering/palette';
import {
  GOAL,
  ITEMS,
  type Action,
  type Input,
  type Kind,
  type Snapshot,
  type World,
} from './types';
import { type Session, sessionStore } from '../../shared/rooms/session';
import type { GameScene, Hud } from './scene';
import { Sound } from './sound';
import GameToolbar from '../../shared/ui/GameToolbar';
import { partyGoal, partyRound } from '../../shared/ui/party-round';
import { TouchControls } from '../../shared/input/TouchControls';
import { TOUCH_CONTROLS_QUERY } from '../../shared/input/gestures';
import { triggerHaptic } from '../../shared/browser/haptics';
import './style.css';
import './mobile.css';
import { useLanguage } from '../../shared/language/useLanguage';
import { STACK_OR_SINK_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { stackAnalytics, stackPlayState } from './analytics';
import { looksLikeRoomCode } from '../../shared/rooms/identity';
import { inPartyMode } from '../../shared/ui/party-mode';
import StackChallengePanel from '../../shared/challenges/StackChallengePanel';

const sessions = sessionStore('stack-or-sink-session-v1');

const INITIAL_HUD: Hud = {
  target: '',
  carrying: '',
  placementError: null,
  height: 0,
  crane: false,
  craneAngle: false,
  craneBottom: null,
  supportTop: null,
  destination: null,
};
const clock = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
const tracker = new GameTracker(stackAnalytics);

export default function Game() {
  'use no memo'; // This component bridges an imperative WebGL simulation.
  useGameTracker(tracker);
  const { t } = useLanguage();
  const strings = t(STACK_OR_SINK_TRANSLATIONS);
  const canvas = useRef<HTMLDivElement>(null),
    scene = useRef<GameScene | null>(null),
    network = useRef<Connection | null>(null),
    sound = useRef<Sound | null>(null),
    helpTitle = useRef<HTMLHeadingElement>(null),
    joinError = useRef<HTMLParagraphElement>(null);
  const local = useRef<World | null>(null),
    current = useRef<Snapshot | null>(null),
    sessionRef = useRef<Session | null>(null),
    events = useRef(new Set<string>()),
    actionRef = useRef<(a: Action) => Promise<void>>(async () => {});
  const [state, setState] = useState<Snapshot | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [name, setName] = useState(''),
    [color, setColor] = useState(0),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
      'online',
    ),
    [hud, setHud] = useState<Hud>(INITIAL_HUD),
    [notice, setNotice] = useState(''),
    [help, setHelp] = useState(false),
    [join, setJoin] = useState(false),
    [verifiedJoin, setVerifiedJoin] = useState(false),
    [invite, setInvite] = useState(false),
    [code, setCode] = useState(''),
    [copied, setCopied] = useState(false),
    [muted, setMuted] = useState(false),
    [exitDialog, setExitDialog] = useState(false),
    [overview, setOverview] = useState(false);
  const world = state?.world,
    player = world?.players.find((p) => p.id === session?.id),
    isLocal = session?.code === 'PRACTICE',
    calm = world?.mode === 'practice',
    isHost = state?.host === session?.id;
  const ended = world?.phase === 'won' || world?.phase === 'lost';
  const touchMode = useMediaQuery(TOUCH_CONTROLS_QUERY);
  const [canShare, setCanShare] = useState(false);
  const controlsPaused =
    help || join || invite || exitDialog || status !== 'online' || !!ended;
  const notify = (message: string) => setNotice(message);
  function accept(next: Snapshot, s: Session, render = true) {
    tracker.observe(stackPlayState(next, s));
    sound.current?.stackSnapshot(next, s.id);
    current.current = next;
    setState(next);
    if (render) scene.current?.setSnapshot(next, s.id, s.code === 'PRACTICE');
    for (const e of next.world.events)
      if (!events.current.has(e.id)) {
        events.current.add(e.id);
        if (next.world.clock - e.at < 2000) {
          if (e.kind !== 'info') setNotice(e.text);
        }
      }
  }
  function attach(s: Session, next?: Snapshot) {
    network.current?.stop();
    local.current = null;
    sessionRef.current = s;
    setSession(s);
    setStatus('online');
    events.current.clear();
    try {
      sessions.save(s);
    } catch {}
    if (next) accept(next, s);
    const connection = new Connection(
      s,
      (snapshot) => accept(snapshot, s),
      setStatus,
    );
    network.current = connection;
    connection.start();
  }
  useEffect(() => {
    let disposed = false,
      lastPublish = 0;
    const audio = new Sound();
    sound.current = audio;
    try {
      const saved = JSON.parse(
        localStorage.getItem('stack-or-sink-prefs-v1') || '{}',
      );
      setName(typeof saved.name === 'string' ? saved.name : '');
      setColor(
        Number.isInteger(saved.color)
          ? Math.max(0, Math.min(3, saved.color))
          : 0,
      );
      setMuted(!!saved.muted);
      audio.enabled = !saved.muted;
    } catch {}
    const url = new URL(location.href);
    setVerifiedJoin(
      ['verified', 'ranked'].includes(url.searchParams.get('challenge') ?? ''),
    );
    const room = url.searchParams.get('room');
    if (room && looksLikeRoomCode(room)) {
      setCode(room.toUpperCase());
      setJoin(true);
    }
    import('./scene')
      .then(({ GameScene }) => {
        if (disposed || !canvas.current) return;
        try {
          scene.current = new GameScene(canvas.current, {
            input(input: Input) {
              network.current?.setInput(input);
              const p = local.current?.players[0];
              if (p) {
                p.input = input;
                p.seen = Date.now();
              }
            },
            advance(input: Input) {
              const w = local.current,
                s = sessionRef.current;
              if (!w || !s) return;
              const now = Date.now(),
                p = w.players[0];
              p.input = input;
              p.seen = now;
              tick(w, now);
              const next = {
                code: 'PRACTICE',
                host: s.id,
                world: structuredClone(w),
                version: now,
              };
              scene.current?.setSnapshot(next, s.id, true);
              current.current = next;
              if (now - lastPublish > 120) {
                accept(next, s, false);
                lastPublish = now;
              }
            },
            action: (a) => {
              void actionRef.current(a);
            },
            hud: (h) =>
              setHud((previous) =>
                previous.target === h.target &&
                previous.carrying === h.carrying &&
                previous.placementError === h.placementError &&
                Math.abs(previous.height - h.height) < 0.1 &&
                previous.crane === h.crane &&
                previous.craneAngle === h.craneAngle &&
                previous.craneBottom === h.craneBottom &&
                previous.supportTop === h.supportTop &&
                previous.destination?.x === h.destination?.x &&
                previous.destination?.z === h.destination?.z
                  ? previous
                  : h,
              ),
            error: notify,
          });
          setReady(true);
          const saved = sessions.load();
          if (saved && (!room || saved.code === room.toUpperCase())) {
            attach(saved);
            setJoin(false);
          }
        } catch {
          notify(
            'This browser could not start the 3D view. Enable hardware acceleration and reload.',
          );
        }
      })
      .catch(() =>
        notify('The game could not load. Reload the page to try again.'),
      );
    const audioTimer = setInterval(() => {
      const view = scene.current;
      if (view?.predicted)
        audio.localMovement(view.predicted, view.yaw, !view.paused);
    }, 50);
    return () => {
      disposed = true;
      clearInterval(audioTimer);
      network.current?.stop();
      scene.current?.dispose();
      audio.dispose();
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        'stack-or-sink-prefs-v1',
        JSON.stringify({ name, color, muted }),
      );
    } catch {}
    if (sound.current) sound.current.enabled = !muted;
  }, [name, color, muted]);
  useEffect(() => {
    scene.current?.setPaused(controlsPaused);
  }, [controlsPaused, ready]);
  useEffect(() => {
    setCanShare(typeof navigator.share === 'function');
    const viewport = window.visualViewport;
    const resize = () => {
      document.documentElement.style.setProperty(
        '--sos-dialog-height',
        `${viewport?.height ?? innerHeight}px`,
      );
      document.documentElement.style.setProperty(
        '--sos-dialog-top',
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      document.documentElement.style.removeProperty('--sos-dialog-height');
      document.documentElement.style.removeProperty('--sos-dialog-top');
    };
  }, []);
  useEffect(() => {
    if (!notice || join) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice, join]);
  useEffect(() => {
    if (join && notice) joinError.current?.scrollIntoView({ block: 'nearest' });
  }, [join, notice]);
  async function action(a: Action) {
    tracker.action(a.type);
    try {
      setNotice('');
      if (local.current && sessionRef.current) {
        act(local.current, sessionRef.current.id, a, sessionRef.current.id);
        accept(
          {
            code: 'PRACTICE',
            host: sessionRef.current.id,
            world: structuredClone(local.current),
            version: Date.now(),
          },
          sessionRef.current,
        );
      } else if (network.current) await network.current.action(a);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'That did not work. Try again.');
    }
  }
  const practiceRef = useRef(practice);
  useLayoutEffect(() => {
    actionRef.current = action;
    practiceRef.current = practice;
  });
  async function create(verified = false, ranked = false) {
    if (!ready || busy) return;
    setBusy(true);
    setNotice('');
    sound.current?.unlock();
    try {
      const reply = await requestRoom({
        op: 'create',
        name,
        color,
        verified,
        ranked,
      });
      if (reply.session && reply.snapshot)
        attach(reply.session, reply.snapshot);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : 'Could not create a crew. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function joinCrew() {
    if (!ready || busy) return;
    setBusy(true);
    setNotice('');
    sound.current?.unlock();
    try {
      const reply = await requestRoom({
        op: 'join',
        verified: verifiedJoin,
        code: code.trim().toUpperCase(),
        name,
        color,
      });
      if (reply.session && reply.snapshot) {
        attach(reply.session, reply.snapshot);
        setJoin(false);
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not join that crew.');
    } finally {
      setBusy(false);
    }
  }
  function practice() {
    if (!ready) return;
    sound.current?.unlock();
    network.current?.stop();
    network.current = null;
    setNotice('');
    const now = Date.now(),
      id = 'local-player',
      s = { code: 'PRACTICE', id, token: '' };
    // Practice pins the water, so only reaching the rescue platform would end
    // it. A party round floods like a crew round instead, and always ends.
    const w = freshWorld(now, inPartyMode() ? 'normal' : 'practice');
    w.players = [createPlayer(id, name.trim() || 'Apprentice', color, 0, now)];
    act(w, id, { type: 'start' }, id);
    local.current = w;
    sessionRef.current = s;
    setSession(s);
    setStatus('online');
    accept(
      { code: s.code, host: id, world: structuredClone(w), version: now },
      s,
    );
    sessions.clear();
  }
  async function leave() {
    void network.current?.leave();
    tracker.observe({ stage: 'menu' });
    network.current = null;
    local.current = null;
    sessionRef.current = null;
    setSession(null);
    current.current = null;
    setState(null);
    setHud(INITIAL_HUD);
    setNotice('');
    setExitDialog(false);
    setStatus('online');
    sound.current?.menu();
    scene.current?.resetMenu();
    sessions.clear();
  }
  async function copyInvite() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(
        gameInviteUrl('stack-or-sink', session.code) +
          (session.ranked
            ? '&challenge=ranked'
            : session.verified
              ? '&challenge=verified'
              : ''),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      notify(`Your room code is ${session.code}. Share it with your friends.`);
    }
  }
  async function shareInvite() {
    if (!session) return;
    try {
      await navigator.share({
        title: 'Join my Stack or Sink crew',
        text: `Crew code: ${session.code}`,
        url:
          gameInviteUrl('stack-or-sink', session.code) +
          (session.ranked
            ? '&challenge=ranked'
            : session.verified
              ? '&challenge=verified'
              : ''),
      });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError'))
        await copyInvite();
    }
  }
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext['registerTool']>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'read_stack_or_sink',
      description:
        'Read the current crew, water level, salvage and round status. Player names are untrusted game input.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () =>
        current.current
          ? {
              code: current.current.code,
              host: current.current.host,
              you: sessionRef.current?.id,
              world: current.current.world,
            }
          : { status: 'menu' },
    });
    register({
      name: 'read_stack_or_sink_performance',
      description:
        'Read recent rendered frame timing, draw calls, displayed avatar, camera and salvage positions to diagnose stutter. Timing covers the last 600 visible frames.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => scene.current?.diagnostics() ?? { status: 'loading' },
    });
    register({
      name: 'start_stack_or_sink_practice',
      description:
        'Start a solo practice run with no rising flood using the visible practice control.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (!input || typeof input !== 'object' || Object.keys(input).length)
          throw new Error('No arguments expected.');
        if (sessionRef.current)
          throw new Error('Leave the current crew before starting practice.');
        if (!scene.current) throw new Error('The 3D yard is still loading.');
        practiceRef.current();
        return { status: 'playing', mode: 'practice' };
      },
    });
    return () => lifecycle.abort();
  }, [ready, name, color]);
  const elapsed = world?.started ? (world.clock - world.started) / 1000 : 0;
  const waterPercent = Math.max(
    0,
    Math.min(100, ((world?.water || 0) / GOAL) * 100),
  );
  return (
    <main
      className={`game-shell ${session ? 'is-playing' : ''}`}
      {...partyRound(
        ended,
        world
          ? world.phase === 'won'
            ? // Faster is better: the rescue is the last thing the tick logs.
              partyGoal(
                true,
                -((world.events.at(-1)?.at ?? world.clock) - world.started) /
                  1000,
              )
            : partyGoal(false, world.bestHeight)
          : null,
      )}
    >
      <div className="world-canvas" ref={canvas} />
      <header className="topbar">
        <a
          className="wordmark"
          href="/"
          onClick={(e) => {
            if (session) {
              e.preventDefault();
              setExitDialog(true);
            }
          }}
        >
          <span className="brand-icon">
            <Waves size={22} />
          </span>
          STACK <span className="wordmark-or">or</span> SINK
        </a>
        {session && world ? (
          <div className="crew-bar">
            {world.players.map((p) => (
              <span
                title={`${p.name}${p.id === state.host ? ' · Captain' : ''}`}
                className={`crew-member ${p.down ? 'down' : ''}`}
                key={p.id}
              >
                <span style={{ background: COLORS[p.color] }}>
                  <HardHat size={17} />
                </span>
                <b>{p.name}</b>
                {p.id === state.host && <small>CAPTAIN</small>}
              </span>
            ))}
            {!isLocal && world.players.length < 4 && (
              <button
                className="crew-empty"
                onClick={() => setInvite(true)}
                aria-label="Invite a teammate"
              >
                <Plus size={19} />
              </button>
            )}
          </div>
        ) : (
          <span className="top-note">
            <span className="live-dot" /> A LITTLE TEAMWORK. A LOT OF JUNK.
          </span>
        )}
        <GameToolbar
          voice={
            session && !isLocal && !session.verified && state
              ? {
                  session: { ...session, game: 'stack-or-sink' },
                  snapshot: { players: state.world.players, nearby: false },
                  onSpeaking: (active) => sound.current?.duck(active),
                }
              : undefined
          }
          voiceHint={
            session?.verified
              ? 'Voice is not yet available in verified challenge rooms.'
              : isLocal
                ? 'Voice is available in multiplayer. Create or join a crew to talk with friends.'
                : undefined
          }
          muted={muted}
          onToggleSound={() => {
            sound.current?.unlock();
            setMuted(!muted);
          }}
          onHelp={() => setHelp(true)}
          onLeave={session ? () => setExitDialog(true) : undefined}
          workshop="/stack-or-sink/admin"
        />
      </header>
      {!session && (
        <>
          <section className="start-panel">
            <div className="eyebrow">
              <span className="tiny-line" /> {strings.survivalTagline}
            </div>
            <h1>
              STACK
              <span className="title-middle">
                <i />
                or
                <i />
              </span>
              <span className="sink-title">
                SINK<span className="title-dot">.</span>
              </span>
            </h1>
            <p className="intro">
              The water’s rising.
              <br />
              Your escape plan is a pile of junk.
            </p>
            <div className="setup-card">
              <label htmlFor="player-name">YOUR NAME</label>
              <input
                id="player-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Salvage apprentice"
                maxLength={18}
                autoComplete="nickname"
                autoCapitalize="words"
                enterKeyHint="done"
              />
              <div className="color-row">
                <span>Pick your hard hat</span>
                <div>
                  {COLORS.map((c, i) => (
                    <button
                      aria-label={
                        [
                          'Yellow hard hat',
                          'Teal hard hat',
                          'Coral hard hat',
                          'Purple hard hat',
                        ][i]
                      }
                      aria-pressed={color === i}
                      className={
                        color === i ? 'color-choice selected' : 'color-choice'
                      }
                      style={{ background: c }}
                      key={c}
                      onClick={() => setColor(i)}
                    >
                      <HardHat size={20} />
                    </button>
                  ))}
                </div>
              </div>
              <button
                disabled={!ready || busy}
                className="primary-button"
                onClick={() => void create()}
              >
                {busy
                  ? 'Opening the island…'
                  : ready
                    ? 'Create a crew'
                    : 'Loading the island…'}
                {busy || !ready ? (
                  <LoaderCircle size={20} className="spin" />
                ) : (
                  <ArrowRight size={20} />
                )}
              </button>
              <button
                disabled={!ready || busy}
                className="secondary-button"
                onClick={() => setJoin(true)}
              >
                Join with a room code <Users size={18} />
              </button>
              <button
                disabled={!ready || busy}
                className="secondary-button"
                onClick={() => void create(true)}
              >
                Create verified crew · earn coins <Trophy size={18} />
              </button>
              <button
                disabled={!ready || busy}
                className="secondary-button"
                onClick={() => void create(true, true)}
              >
                Create ranked crew · weekly board <Trophy size={18} />
              </button>
              <button
                disabled={!ready || busy}
                className="practice-link"
                onClick={() => {
                  setVerifiedJoin(true);
                  setJoin(true);
                }}
              >
                Join a verified room
              </button>
              <details className="challenge-details">
                <summary>Weekly target, mastery &amp; rankings</summary>
                <StackChallengePanel />
              </details>
              <button
                disabled={!ready || busy}
                className="practice-link"
                onClick={practice}
              >
                Just me? Try a practice run <ArrowUpRight size={15} />
              </button>
            </div>
            <button className="start-tip" onClick={() => setHelp(true)}>
              <LifeBuoy size={18} />
              <span>Build together. Climb together. Panic together.</span>
            </button>
          </section>
          <aside className="scene-caption">
            <span className="map-badge">SALVAGE ISLAND</span>
            <span>One little island. An entire ocean.</span>
          </aside>
          <footer className="start-footer">
            <span>
              <span className="live-dot" /> NO DOWNLOAD. JUST BRING YOUR CREW.
            </span>
            <span>DON’T GET TOO ATTACHED TO THE SOFA.</span>
          </footer>
        </>
      )}
      {session && world && (
        <>
          <aside className="mission-panel">
            <div className="clipboard-clip" />
            <div className="mission-eyebrow">
              <Flag size={13} />
              {session.verified
                ? 'VERIFIED CHALLENGE'
                : isLocal
                  ? 'LEARN THE ROPES'
                  : 'THE ESCAPE PLAN'}
            </div>
            <h2>
              Higher ground.
              <br />
              Questionable footing.
            </h2>
            <p>
              {world.phase === 'lobby'
                ? 'Gather your crew. The flood starts when the captain is ready.'
                : isLocal
                  ? 'No rising water. Get a feel for the junk.'
                  : 'Get one teammate to the rescue platform to save the whole crew.'}
            </p>
            {state.challenge && (
              <p className="verified-target">
                This attempt: {state.challenge.week.height} m settled tower,
                then finish the round. Weekly reward: 100 coins.
              </p>
            )}
            <div className="mission-progress">
              <span>RESCUE PLATFORM</span>
              <strong>
                {GOAL}
                <small> m</small>
              </strong>
            </div>
            <Progress
              className="height-progress"
              value={Math.min(100, (Math.max(0, hud.height) / GOAL) * 100)}
              aria-label="Your height toward rescue"
            />
            <div className="height-row">
              <span>Your height</span>
              <strong>
                {Math.max(0, hud.height).toFixed(1)} m
                <small className="touch-goal"> / {GOAL} m</small>
              </strong>
            </div>
            <div className="mission-divider" />
            <div className="mission-stat">
              <PackageOpen size={16} />
              <span>Salvage in the yard</span>
              <b>{world.pieces.length}</b>
            </div>
            <div className="mission-stat">
              <Mountain size={16} />
              <span>Best stack</span>
              <b>{world.bestHeight.toFixed(1)} m</b>
            </div>
            <div className="mission-foot">
              <LifeBuoy size={16} />
              {world.phase === 'lobby'
                ? 'Your friends can join using the room code.'
                : 'Jump onto low pieces. Build a way up.'}
            </div>
          </aside>
          <div className="room-panel">
            <button
              className="room-code"
              onClick={() => !isLocal && setInvite(true)}
              disabled={isLocal}
            >
              <span>
                {isLocal
                  ? calm
                    ? 'TAKE YOUR TIME'
                    : 'MIND THE TIDE'
                  : 'YOUR CREW CODE'}
                <strong>{session.code}</strong>
              </span>
              {isLocal ? <Anchor size={21} /> : <Copy size={18} />}
            </button>
            <span
              className={`network-state ${status !== 'online' ? 'offline' : ''}`}
            >
              <span className="live-dot" />
              {isLocal
                ? calm
                  ? 'Solo practice'
                  : 'Solo run'
                : status === 'online'
                  ? 'Everyone in the same boat'
                  : status === 'expired'
                    ? 'Crew pass expired'
                    : 'Reconnecting to your crew…'}
            </span>
          </div>
          <aside className="water-panel">
            <div>
              <Waves size={22} />
              <span>
                WATER LEVEL
                <strong>
                  {Math.max(0, world.water).toFixed(1)}
                  <small> m</small>
                </strong>
              </span>
            </div>
            <div className="water-track">
              <span style={{ height: `${waterPercent}%` }} />
              <i
                style={{
                  bottom: `${Math.min(96, (Math.max(0, hud.height) / GOAL) * 100)}%`,
                }}
              >
                <HardHat size={14} />
              </i>
            </div>
            <span className="water-caption">
              {calm
                ? 'CALM WATERS'
                : world.phase === 'lobby'
                  ? 'WAITING FOR CREW'
                  : elapsed < 60
                    ? `RISING IN ${clock(60 - elapsed)}`
                    : 'RISING STEADILY'}
            </span>
            <span className="round-time">
              <Timer size={13} />
              {clock(elapsed)}
            </span>
          </aside>
          <div className="camera-tools">
            <button
              className={`icon-button ${hud.crane ? (hud.craneAngle ? 'active' : '') : overview ? 'active' : ''}`}
              onClick={() => {
                if (hud.crane) scene.current?.toggleCraneView();
                else {
                  scene.current?.toggleOverview();
                  setOverview(!overview);
                }
              }}
              aria-label={
                hud.crane
                  ? `Switch to ${hud.craneAngle ? 'work' : 'overview'} crane view`
                  : 'Toggle yard overview'
              }
              aria-pressed={hud.crane ? hud.craneAngle : overview}
            >
              <Eye size={19} />
            </button>
            <button
              className="icon-button touch-only"
              onClick={() => scene.current?.zoomBy(-0.15)}
              aria-label="Zoom in"
            >
              <Plus size={20} />
            </button>
            <button
              className="icon-button touch-only"
              onClick={() => scene.current?.zoomBy(0.15)}
              aria-label="Zoom out"
            >
              <Minus size={20} />
            </button>
            <span className={hud.crane ? 'crane-view-label' : ''}>
              {hud.crane ? (
                `${hud.craneAngle ? 'Overview' : 'Work'} view`
              ) : (
                <>
                  View <kbd>V</kbd>
                </>
              )}
            </span>
          </div>
          {hud.crane && world.crane.piece && (
            <div className="crane-survey">
              <CraneMap
                pieces={world.pieces}
                cargo={world.crane.piece}
                position={{ x: world.crane.x, z: world.crane.z }}
                destination={hud.destination}
                onTarget={(point) => scene.current?.setCraneDestination(point)}
              />
              <div
                className="crane-height"
                role="status"
                aria-label="Crane height above support"
              >
                <span className="crane-height-title">HEIGHT</span>
                <strong>
                  {hud.craneBottom === null || hud.supportTop === null
                    ? '—'
                    : `${Math.max(0, hud.craneBottom - hud.supportTop).toFixed(1)} m`}
                </strong>
                <span>clearance</span>
                <div>
                  <span>Load bottom</span>
                  <b>{hud.craneBottom?.toFixed(1) ?? '—'} m</b>
                </div>
                <div>
                  <span>Support top</span>
                  <b>{hud.supportTop?.toFixed(1) ?? '—'} m</b>
                </div>
                <div className="crane-stack-height">
                  <span>Highest box</span>
                  <b>
                    {Math.max(
                      0,
                      ...world.pieces
                        .filter((piece) => !piece.heldBy)
                        .map((piece) => topOf(piece) - FLOOR),
                    ).toFixed(1)}{' '}
                    m
                  </b>
                </div>
              </div>
            </div>
          )}
          {world.phase === 'lobby' && (
            <section className="lobby-banner">
              <div>
                <span className="eyebrow">
                  {world.players.length}/4 HARD HATS READY
                </span>
                <h3>
                  {world.players.length === 1
                    ? 'Better with a few bad builders.'
                    : 'Your crew is coming together.'}
                </h3>
                <p>
                  Invite your friends, explore the yard, then start the flood.
                </p>
              </div>
              <div>
                <button
                  className="secondary-button"
                  onClick={() => setInvite(true)}
                >
                  <Users size={18} />
                  Invite friends
                </button>
                {isHost ? (
                  <button
                    className="primary-button"
                    onClick={() => void action({ type: 'start' })}
                  >
                    Start the flood <ArrowRight size={18} />
                  </button>
                ) : (
                  <span className="waiting-label">
                    Waiting for the captain to start…
                  </span>
                )}
              </div>
            </section>
          )}
          {player?.down && !ended && (
            <div className="rescue-banner">
              <LifeBuoy size={25} />
              <div>
                <strong>You need a hand!</strong>
                <span>
                  {touchMode
                    ? 'A nearby teammate can tap Rescue to pull you out.'
                    : 'A nearby teammate can press F to pull you out.'}
                </span>
              </div>
            </div>
          )}
          {player && player.breath < 6 && !player.down && !ended && (
            <div className="breath-warning">
              <Waves size={18} />
              <strong>Get above the water!</strong>
              <Progress
                value={(player.breath / 8) * 100}
                aria-label="Breath remaining"
              />
            </div>
          )}
          <div className="play-bottom">
            {notice && touchMode && !hud.crane ? (
              <div className="interaction-hint touch-notice" role="status">
                <span>{notice}</span>
                <button
                  onClick={() => setNotice('')}
                  aria-label="Dismiss message"
                >
                  <X size={18} />
                </button>
              </div>
            ) : hud.crane ? (
              <div className="crane-panel">
                <Construction size={29} />
                <div>
                  <strong>Cargo crane</strong>
                  <span>
                    {touchMode
                      ? notice ||
                        'Tap XY map or use joystick · Hold Up / Down · Release below'
                      : 'Click XY map or use WASD / arrows · Q / Z height · V view'}
                  </span>
                </div>
                <button
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    scene.current?.setCraneLift(1);
                    void action({ type: 'crane-move', x: 0, z: 0, y: 0.6 });
                    void triggerHaptic('light');
                  }}
                  onPointerUp={() => scene.current?.setCraneLift(0)}
                  onPointerCancel={() => scene.current?.setCraneLift(0)}
                  onLostPointerCapture={() => scene.current?.setCraneLift(0)}
                  onClick={(event) => {
                    if (event.detail === 0)
                      void action({ type: 'crane-move', x: 0, z: 0, y: 1 });
                  }}
                  aria-label="Raise crane"
                >
                  <ArrowUp size={19} />
                  <b>Up</b>
                </button>
                <button
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    scene.current?.setCraneLift(-1);
                    void action({ type: 'crane-move', x: 0, z: 0, y: -0.6 });
                    void triggerHaptic('light');
                  }}
                  onPointerUp={() => scene.current?.setCraneLift(0)}
                  onPointerCancel={() => scene.current?.setCraneLift(0)}
                  onLostPointerCapture={() => scene.current?.setCraneLift(0)}
                  onClick={(event) => {
                    if (event.detail === 0)
                      void action({ type: 'crane-move', x: 0, z: 0, y: -1 });
                  }}
                  aria-label="Lower crane"
                >
                  <ArrowDown size={19} />
                  <b>Down</b>
                </button>
              </div>
            ) : (
              <div
                className={`interaction-hint ${hud.placementError ? 'invalid' : ''}`}
              >
                <span className="hint-dot" />
                {hud.carrying ? (
                  <>
                    <strong>{ITEMS[hud.carrying as Kind].name}</strong>
                    <span>
                      {hud.placementError ||
                        (touchMode
                          ? 'Tap a surface to aim. Then tap Place.'
                          : 'Aim at a surface. Place it with E.')}
                    </span>
                  </>
                ) : hud.target ? (
                  <>
                    <strong>{hud.target}</strong>
                    <span>
                      {touchMode
                        ? 'Tap Pick up when you are close.'
                        : 'Pick it up. It might be load-bearing.'}
                    </span>
                  </>
                ) : (
                  <span>
                    {touchMode
                      ? 'Move with the joystick. Tap junk, then Pick up.'
                      : 'Walk to some salvage, then press E to pick it up.'}
                  </span>
                )}
              </div>
            )}
            <div className="tool-dock">
              <button
                disabled={
                  controlsPaused || (!!hud.carrying && !!hud.placementError)
                }
                className={hud.carrying ? 'active' : ''}
                onClick={() => {
                  void triggerHaptic('light');
                  scene.current?.interact();
                }}
              >
                <Hand size={19} />
                <span>
                  {hud.crane ? 'Release' : hud.carrying ? 'Place' : 'Pick up'}
                </span>
                <kbd>E</kbd>
              </button>
              <button
                disabled={!hud.carrying && !hud.crane}
                onClick={() => {
                  void triggerHaptic('selection');
                  void action({ type: 'rotate' });
                }}
              >
                <RotateCw size={18} />
                <span>Rotate</span>
                <kbd>R</kbd>
              </button>
              <i />
              <button
                className={hud.crane ? 'active' : ''}
                onClick={() => {
                  void triggerHaptic('light');
                  scene.current?.crane();
                }}
              >
                <Construction size={20} />
                <span>Crane</span>
                <kbd>C</kbd>
              </button>
              <button
                onClick={() => {
                  void triggerHaptic('medium');
                  void action({ type: 'rescue' });
                }}
              >
                <LifeBuoy size={19} />
                <span>Rescue</span>
                <kbd>F</kbd>
              </button>
              <i />
              <button
                onClick={() => {
                  void triggerHaptic('light');
                  void action({ type: 'wave' });
                }}
              >
                <Flag size={18} />
                <span>{touchMode ? 'Wave' : 'Over here!'}</span>
                <kbd>G</kbd>
              </button>
            </div>
            <div className="touch-guide">
              {hud.crane
                ? 'Joystick moves XY · View button changes angle · Pinch to zoom'
                : 'Tap to aim · Drag to orbit · Pinch to zoom'}
            </div>
            <div className="movement-hint">
              {hud.crane ? (
                <>
                  <span>
                    <kbd>W</kbd>
                    <kbd>A</kbd>
                    <kbd>S</kbd>
                    <kbd>D</kbd> XY
                  </span>
                  <span>
                    <kbd>Q</kbd>
                    <kbd>Z</kbd> Height
                  </span>
                  <span>
                    <kbd>V</kbd> View · Scroll to zoom
                  </span>
                </>
              ) : (
                <>
                  <span>
                    <kbd>W</kbd>
                    <kbd>A</kbd>
                    <kbd>S</kbd>
                    <kbd>D</kbd> Move
                  </span>
                  <span>
                    <kbd>SPACE</kbd> Jump
                  </span>
                  <span>Drag to orbit · Scroll to zoom</span>
                </>
              )}
            </div>
          </div>
          <TouchControls
            disabled={controlsPaused || !!player?.down || !!player?.rescued}
            move={(vector) => scene.current?.setTouch(vector)}
            jump={() => scene.current?.jump()}
            showJump={!hud.crane}
            moveLabel={hud.crane ? 'CRANE XY' : 'MOVE'}
            joystickLabel={
              hud.crane
                ? 'Crane XY joystick. Drag toward the target; release to stop.'
                : undefined
            }
          />
        </>
      )}
      {session && !state && (
        <div className="connecting-card">
          <LoaderCircle className="spin" />
          <strong>Finding your crew…</strong>
          <button className="secondary-button" onClick={() => void leave()}>
            Back to the yard
          </button>
        </div>
      )}
      {status === 'expired' && session && (
        <div className="connecting-card">
          <LifeBuoy size={30} />
          <strong>Your crew pass expired.</strong>
          <p>Return to the menu and rejoin with the room code.</p>
          <button className="primary-button" onClick={() => void leave()}>
            Back to menu
          </button>
        </div>
      )}
      {notice && (!session || !touchMode) && (
        <div className="game-notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss message">
            <X size={15} />
          </button>
        </div>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent
          className="game-dialog help-dialog"
          initialFocus={helpTitle}
        >
          <span className="dialog-emblem">
            <LifeBuoy size={27} />
          </span>
          <DialogTitle ref={helpTitle} tabIndex={-1}>
            Some assembly required.
          </DialogTitle>
          <DialogDescription>
            Build a way to the rescue platform before the flood catches your
            crew.
          </DialogDescription>
          <div className="help-steps">
            <div>
              <Hand />
              <p>
                <strong>Salvage something.</strong>
                {touchMode
                  ? 'Move close with the joystick. Tap junk, then Pick up. Tap a surface to move the preview, then Place. Rotate turns it. Green means it fits.'
                  : 'Walk up to junk and press E. Carry it to your tower, aim, then press E again. R turns it.'}
              </p>
            </div>
            <div>
              <Mountain />
              <p>
                <strong>Build yourself a staircase.</strong>
                {touchMode
                  ? 'Use low pieces as steps. Hold the joystick and tap Jump with your other thumb. Removing the bottom makes the top fall.'
                  : 'Use low pieces as steps. WASD moves, Space jumps. Removing the bottom makes the top fall.'}
              </p>
            </div>
            <div>
              <Construction />
              <p>
                <strong>Mind the crane.</strong>
                {touchMode
                  ? 'Tap a piece, then Crane. The joystick moves the load. Use the up and down buttons, then Release. One operator at a time.'
                  : 'Click a piece, then press C. WASD moves the load; Q raises it, Z lowers it, E releases it. Only one operator at a time.'}
              </p>
            </div>
            <div>
              <LifeBuoy />
              <p>
                <strong>Leave no hard hat behind.</strong>
                {touchMode
                  ? 'Move close and tap Rescue to help a fallen teammate. One player reaching the platform saves everyone. If everyone goes under, try again.'
                  : 'F rescues nearby fallen teammates. One player reaching the platform saves everyone. If everyone goes under, try again.'}
              </p>
            </div>
          </div>
          <p className="help-note">
            {touchMode
              ? 'Drag the yard with one finger to look around. Pinch or use + / − to zoom. The eye button shows the whole yard. Play in portrait or landscape.'
              : 'Drag the yard to orbit. Scroll to zoom. V shows the whole yard.'}
          </p>
          <button className="primary-button" onClick={() => setHelp(false)}>
            Got it. Probably. <Check size={18} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={join} onOpenChange={setJoin}>
        <DialogContent className="game-dialog">
          <span className="dialog-emblem">
            <Users size={27} />
          </span>
          <DialogTitle>Find your crew.</DialogTitle>
          <DialogDescription>
            Ask your captain for the six-character room code.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void joinCrew();
            }}
          >
            <label className="field-label" htmlFor="join-name">
              Your name
            </label>
            <input
              id="join-name"
              className="dialog-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Salvage apprentice"
              maxLength={18}
              autoComplete="nickname"
              autoCapitalize="words"
              enterKeyHint="done"
            />
            <label className="field-label" htmlFor="join-code">
              Room code
            </label>
            <label className="verified-room-choice">
              <input
                type="checkbox"
                checked={verifiedJoin}
                onChange={(event) => setVerifiedJoin(event.target.checked)}
              />{' '}
              Verified challenge room · sign-in required
            </label>
            <input
              id="join-code"
              className="dialog-input code-input"
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z2-9]/g, '')
                    .slice(0, 6),
                )
              }
              placeholder="ABC234"
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="go"
              spellCheck={false}
            />
            <button
              className="primary-button"
              disabled={busy || code.length !== 6 || !ready}
            >
              {busy ? 'Joining…' : 'Join the crew'}
              <ArrowRight size={18} />
            </button>
          </form>
          {notice && (
            <p ref={joinError} role="alert" className="dialog-error">
              {notice}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={invite} onOpenChange={setInvite}>
        <DialogContent className="game-dialog">
          <span className="dialog-emblem">
            <HardHat size={27} />
          </span>
          <DialogTitle>Bring three bad builders.</DialogTitle>
          <DialogDescription>
            Share this code or copy an invite link. Friends join before the
            captain starts the flood.
          </DialogDescription>
          <ul className="invite-crew">
            {world?.players.map((p) => (
              <li key={p.id}>
                <span style={{ background: COLORS[p.color] }}>
                  <HardHat size={18} />
                </span>
                <strong>{p.name}</strong>
                <small>{p.id === state?.host ? 'Captain' : 'Builder'}</small>
              </li>
            ))}
          </ul>
          <div className="invite-code">{session?.code}</div>
          {canShare && (
            <button
              className="primary-button"
              onClick={() => void shareInvite()}
            >
              Share with friends <Share2 size={18} />
            </button>
          )}
          <button className="primary-button" onClick={() => void copyInvite()}>
            {copied ? 'Invite copied!' : 'Copy invite link'}
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          <p className="help-note">
            Everyone needs access to this game’s website to join.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={!!ended} onOpenChange={() => {}}>
        <DialogContent
          className="game-dialog result-dialog"
          showCloseButton={false}
        >
          <span className="dialog-emblem">
            {world?.phase === 'won' ? (
              <Trophy size={34} />
            ) : (
              <Anchor size={34} />
            )}
          </span>
          <DialogTitle>
            {world?.phase === 'won'
              ? 'Against all building codes.'
              : 'A magnificent pile of nope.'}
          </DialogTitle>
          <DialogDescription>
            {world?.phase === 'won'
              ? 'You reached the rescue platform. The whole crew made it out!'
              : 'The flood caught the whole crew. Same junk. Better plan?'}
          </DialogDescription>
          <div className="result-stats">
            <span>
              <strong>{clock(elapsed)}</strong>Time survived
            </span>
            <span>
              <strong>{world?.bestHeight.toFixed(1)} m</strong>Best stack
            </span>
          </div>
          {session?.verified && <StackChallengePanel finished />}
          {isHost ? (
            <button
              data-party-setup-action=""
              className="primary-button"
              onClick={() =>
                session?.verified
                  ? void leave()
                  : void action({ type: 'restart' })
              }
            >
              {session?.verified
                ? 'Back to challenge lobby'
                : 'Build it better'}{' '}
              <RotateCw size={18} />
            </button>
          ) : (
            <p className="help-note">
              {session?.verified
                ? 'Leave this room to create or join another verified attempt.'
                : 'Waiting for your captain to start another round.'}
            </p>
          )}
          <button className="secondary-button" onClick={() => void leave()}>
            Back to menu
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={exitDialog} onOpenChange={setExitDialog}>
        <DialogContent className="game-dialog">
          <DialogTitle>Clocking off?</DialogTitle>
          <DialogDescription>
            {isLocal
              ? 'Your practice tower will be cleared when you leave.'
              : 'Your teammates can keep building. You can join the crew again between rounds.'}
          </DialogDescription>
          <button className="primary-button" onClick={() => void leave()}>
            Leave the yard <LogOut size={18} />
          </button>
          <a className="secondary-button" href="/" onClick={() => void leave()}>
            All games <ArrowLeft size={18} />
          </a>
          <button
            className="secondary-button"
            onClick={() => setExitDialog(false)}
          >
            Keep building
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
