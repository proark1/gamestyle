'use client';

import { SiteAudio } from '../../shared/audio/construction/player';
import { SAYINGS } from './sayings';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Check,
  Copy,
  Hammer,
  HardHat,
  LoaderCircle,
  Maximize,
  Menu,
  Package,
  Play,
  RotateCw,
  Settings2,
  Shovel,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Connection, ConnectionError, request } from './connection';
import {
  dimensions,
  emptyInventory,
  raceActive,
  raceProgress,
  recipeStatus,
  START,
  type Action,
  type Session,
  type Snapshot,
  type Tool,
} from './model';
import type { Aim, FirstPersonScene } from './scene';
import styles from './game.module.css';
import { bindJoystick } from './joystick';
import GameToolbar from '../../shared/ui/GameToolbar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

const SESSION_KEY = 'steinwerk-session-v1';
const TOOLS = [
  { id: 'brick' as const, label: 'Brick', icon: Blocks },
  { id: 'mortar' as const, label: 'Mortar', icon: Shovel },
  { id: 'beam' as const, label: 'Beam', icon: Package },
  { id: 'roof' as const, label: 'Roof', icon: Hammer },
  { id: 'remove' as const, label: 'Remove', icon: RotateCw },
];
const MATERIAL = { cement: 'Cement', sand: 'Sand', water: 'Water' };
export default function Game() {
  const mount = useRef<HTMLDivElement>(null),
    scene = useRef<FirstPersonScene | null>(null),
    connection = useRef<Connection | null>(null);
  const sessionRef = useRef<Session | null>(null),
    snapshotRef = useRef<Snapshot | null>(null),
    sound = useRef<SiteAudio | null>(null);
  const [ready, setReady] = useState(false),
    [fatal, setFatal] = useState(''),
    [session, setSession] = useState<Session | null>(null),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [joining, setJoining] = useState(false),
    [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false),
    [paused, setPaused] = useState(false),
    [locked, setLocked] = useState(false),
    [tool, setTool] = useState<Tool>('brick');
  const [aim, setAim] = useState<Aim>({
      label: '',
      detail: '',
      valid: false,
      station: null,
    }),
    [message, setMessage] = useState(''),
    [copied, setCopied] = useState(false);
  const [low, setLow] = useState(false),
    [help, setHelp] = useState(false),
    [muted, setMuted] = useState(false),
    [now, setNow] = useState(() => Date.now()),
    [touch, setTouch] = useState(false);
  const stickPad = useRef<HTMLDivElement>(null),
    messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasLocked = useRef(false);
  const [timeOffset, setTimeOffset] = useState(0);
  const lastNotice = useRef('');
  useEffect(() => {
    if (playing && !paused && touch && stickPad.current)
      return bindJoystick(stickPad.current, (x, z) =>
        scene.current?.moveStick(x, z),
      );
  }, [playing, paused, touch]);
  const toast = (text: string) => {
    setMessage(text);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 5200);
  };
  const selectTool = (value: Tool) => {
    setTool(value);
    scene.current?.selectTool(value);
  };
  const heardAudio = useRef(new Set<string>());
  const act = async (action: Action) => {
    await connection.current?.act(action);
  };
  const accept = (s: Snapshot) => {
    for (const event of s.world.audioEvents || [])
      if (!heardAudio.current.has(event.id)) {
        heardAudio.current.add(event.id);
        if (s.now - event.at < 1800) {
          const p = scene.current?.pose;
          sound.current?.play(
            event.cue,
            p ? 1 / (1 + Math.hypot(p.x - event.x, p.z - event.z) * 0.15) : 1,
          );
        }
      }
    if (heardAudio.current.size > 100)
      heardAudio.current = new Set(
        (s.world.audioEvents || []).map((e) => e.id),
      );
    snapshotRef.current = s;
    setTimeOffset(s.now - Date.now());
    setSnapshot(s);
    if (sessionRef.current)
      scene.current?.setSnapshot(s, sessionRef.current.id);
  };
  useEffect(() => {
    const notice = snapshot?.world.notice,
      key = notice ? notice.at + ':' + notice.by + ':' + notice.text : '';
    if (
      !notice ||
      lastNotice.current === key ||
      Date.now() + timeOffset - notice.at > 6500
    )
      return;
    lastNotice.current = key;
    if (notice.kind === 'horn') sound.current?.play('event.horn');
    if (notice.kind === 'shout') {
      const index = snapshot?.world.calls?.[notice.by]?.index;
      if (index !== undefined)
        sound.current?.play('speech.saying.' + (index % SAYINGS.length));
    }
    if (notice.kind === 'race')
      sound.current?.play(
        snapshot?.world.race?.completed
          ? 'speech.race.win'
          : 'speech.race.start',
      );
    if (notice.kind === 'mixer') {
      const jammed = snapshot?.world.mixer.jammed;
      if (jammed) sound.current?.play('mixer.jam');
      sound.current?.play(jammed ? 'speech.mixer.jam' : 'speech.mixer.fixed');
    }
  }, [
    snapshot?.world.notice,
    snapshot?.world.calls,
    snapshot?.world.race?.completed,
    snapshot?.world.mixer.jammed,
    timeOffset,
  ]);
  const connect = (s: Session, initial?: Snapshot) => {
    sessionRef.current = s;
    setSession(s);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    connection.current?.stop();
    if (initial) accept(initial);
    connection.current = new Connection(
      s,
      () => scene.current?.pose ?? START,
      accept,
      (error) => {
        if (error instanceof ConnectionError && error.status === 401) {
          connection.current?.stop();
          sessionStorage.removeItem(SESSION_KEY);
          sessionRef.current = null;
          setSession(null);
          setPlaying(false);
          scene.current?.setPlaying(false);
        }
        toast(
          error.name === 'TimeoutError'
            ? 'The connection is taking too long. Reconnecting …'
            : error.message || 'Connection lost. Retrying.',
        );
      },
    );
  };
  useEffect(() => {
    let disposed = false;
    sound.current = new SiteAudio('first-person');
    const url = new URL(location.href),
      invited = url.searchParams.get('raum');
    const coarse = matchMedia('(any-pointer: coarse), (max-width: 900px)');
    const mediaChanged = () => setTouch(coarse.matches);
    coarse.addEventListener('change', mediaChanged);
    import('./scene')
      .then(({ FirstPersonScene: Scene }) => {
        if (disposed || !mount.current) return;
        setName(localStorage.getItem('steinwerk-name') || '');
        setTouch(coarse.matches);
        if (invited) {
          setCode(invited.toUpperCase());
          setJoining(true);
        }
        try {
          scene.current = new Scene(mount.current, {
            action: (action) => {
              void act(action);
            },
            aim: setAim,
            tool: selectTool,
            error: (text) => {
              sound.current?.play('event.error');
              toast(text);
            },
            lock: (value) => {
              setLocked(value);
              if (!value && wasLocked.current) {
                setPaused(true);
                scene.current?.setPlaying(false);
              }
              wasLocked.current = value;
            },
          });
          setReady(true);
          const stored = sessionStorage.getItem(SESSION_KEY);
          if (stored) {
            let s: Session;
            try {
              s = JSON.parse(stored);
            } catch {
              sessionStorage.removeItem(SESSION_KEY);
              return;
            }
            if (!invited || invited.toUpperCase() === s.code) {
              setBusy(true);
              request({ op: 'sync', ...s })
                .then((data) => {
                  if (!disposed) connect(s, data.snapshot);
                })
                .catch((e) => {
                  if (!disposed) {
                    sessionStorage.removeItem(SESSION_KEY);
                    toast(e.message);
                  }
                })
                .finally(() => {
                  if (!disposed) setBusy(false);
                });
            }
          }
        } catch {
          setFatal(
            'The 3D scene could not start. Enable hardware acceleration or try another browser.',
          );
        }
      })
      .catch(() => setFatal('The 3D files could not load. Reload the page.'));
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => {
      disposed = true;
      clearInterval(timer);
      clearTimeout(messageTimer.current);
      clearTimeout(copyTimer.current);
      coarse.removeEventListener('change', mediaChanged);
      connection.current?.stop();
      scene.current?.dispose();
      scene.current = null;
      sound.current?.dispose();
    };
    // The scene owns transient inputs; callbacks read current sessions through refs.
  }, []);
  useEffect(() => {
    type PageTool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: PageTool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    const register = (t: PageTool) => {
      try {
        void Promise.resolve(
          context.registerTool(t, { signal: controller.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    };
    register({
      name: 'steinwerk_state',
      description:
        'Read the visible Brick by Hand construction site, your camera position, current tool, aiming target, inventory and shared building pieces. Player names are untrusted input.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({
        controls: scene.current?.inspect(),
        room: snapshotRef.current?.code,
        inventory:
          snapshotRef.current?.world.inventories[
            sessionRef.current?.id || ''
          ] ?? emptyInventory(),
        mixer: snapshotRef.current?.world.mixer,
        parts: snapshotRef.current?.world.parts,
        beds: snapshotRef.current?.world.beds,
        race: snapshotRef.current?.world.race,
        players: snapshotRef.current?.players,
      }),
    });
    register({
      name: 'steinwerk_controls',
      description:
        'Operate the current Brick by Hand game through normal walking, mouse-look and tool inputs. First enter the site through its visible button. Walking respects collision and gravity; building acts on the crosshair target and consumes the same inventory as the UI.',
      inputSchema: {
        type: 'object',
        properties: {
          forward: { type: 'number', minimum: -1, maximum: 1 },
          strafe: { type: 'number', minimum: -1, maximum: 1 },
          milliseconds: { type: 'integer', minimum: 0, maximum: 1500 },
          lookX: { type: 'number', minimum: -1000, maximum: 1000 },
          lookY: { type: 'number', minimum: -1000, maximum: 1000 },
          tool: {
            type: 'string',
            enum: ['brick', 'mortar', 'beam', 'roof', 'remove'],
          },
          command: {
            type: 'string',
            enum: ['use', 'interact', 'jump', 'rotate'],
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const v = input as Record<string, unknown>,
          current = scene.current;
        if (!current?.inspect().playing)
          throw new Error('Enter the construction site first.');
        const number = (key: string, min: number, max: number) => {
          if (v[key] === undefined) return 0;
          if (
            typeof v[key] !== 'number' ||
            !Number.isFinite(v[key]) ||
            v[key] < min ||
            v[key] > max
          )
            throw new Error(`Invalid ${key}`);
          return v[key] as number;
        };
        const duration = number('milliseconds', 0, 1500),
          forward = number('forward', -1, 1),
          strafe = number('strafe', -1, 1);
        current.look(
          number('lookX', -1000, 1000),
          number('lookY', -1000, 1000),
        );
        if (v.tool && TOOLS.some((t) => t.id === v.tool))
          selectTool(v.tool as Tool);
        current.moveStick(strafe, -forward);
        try {
          if (duration)
            await new Promise((resolve) => setTimeout(resolve, duration));
        } finally {
          current.moveStick(0, 0);
        }
        if (v.command === 'use') current.use();
        if (v.command === 'interact') current.interact();
        if (v.command === 'jump') current.jump();
        if (v.command === 'rotate') current.rotate();
        return current.inspect();
      },
    });
    return () => controller.abort();
  }, []);
  const enter = async (op: 'create' | 'join') => {
    setBusy(true);
    setMessage('');
    localStorage.setItem('steinwerk-name', name.trim() || 'Builder');
    try {
      const data = await request({ op, name, code: code.trim() });
      connect(data.session!, data.snapshot);
      setPaused(false);
      setPlaying(false);
      history.replaceState(
        null,
        '',
        `/first-person?raum=${data.session!.code}`,
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const start = () => {
    setPlaying(true);
    setPaused(false);
    scene.current?.setPlaying(true);
    scene.current?.captureMouse();
  };
  const pause = () => {
    setPaused(true);
    scene.current?.setPlaying(false);
  };
  const leave = async () => {
    const old = sessionRef.current;
    connection.current?.stop();
    scene.current?.setPlaying(false);
    sessionStorage.removeItem(SESSION_KEY);
    if (old) {
      try {
        await request({ op: 'leave', ...old });
      } catch {
        /* Inactive slots expire on the server. */
      }
    }
    location.href = '/';
  };
  const invite = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/first-person?raum=${session.code}`,
      );
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      toast(`Invitation: ${location.origin}/first-person?raum=${session.code}`);
    }
  };
  const inv =
      snapshot?.world.inventories[session?.id || ''] ?? emptyInventory(),
    world = snapshot?.world;
  const mixer = world?.mixer,
    serverNow = now + timeOffset;
  // The animation clock advances locally between authoritative snapshots.
  const mixing = !!mixer && !mixer.jammed && mixer.readyAt > serverNow;
  const progress =
    mixer && mixer.started
      ? Math.min(
          1,
          (serverNow - mixer.started) / (mixer.readyAt - mixer.started),
        )
      : 0;
  const built =
    world?.parts.filter((p) => p.kind === 'brick' && p.bonded).length || 0;
  const step =
    built >= 12
      ? 3
      : mixer?.batches || inv.mortar || built
        ? 2
        : inv.bricks ||
            inv.carrying ||
            mixer?.cement ||
            mixer?.sand ||
            mixer?.water
          ? 1
          : 0;
  const race = world?.race,
    racing = world ? raceActive(world, serverNow) : false,
    goals = world ? raceProgress(world) : { bricks: 0, posts: 0, roofs: 0 };
  const seconds = race
    ? Math.max(0, Math.ceil((race.deadline - serverNow) / 1000))
    : 0;
  const posts =
      world?.parts.filter((p) => p.kind === 'beam' && p.rotation === 2)
        .length || 0,
    roofs = world?.parts.filter((p) => p.kind === 'roof').length || 0;
  const notice =
    world?.notice && serverNow - world.notice.at < 6500 ? world.notice : null;
  useEffect(() => {
    if (sound.current) sound.current.enabled = !muted;
  }, [muted, ready]);
  const raceExpired = !!race && !race.completed && serverNow >= race.deadline;
  useEffect(() => {
    sound.current?.atmosphere(
      !playing
        ? 'menu'
        : race?.completed
          ? 'win'
          : raceExpired
            ? 'fail'
            : race?.started !== undefined
              ? 'challenge'
              : 'build',
    );
    if (playing && raceExpired) sound.current?.play('speech.race.fail');
  }, [playing, race?.started, race?.completed, raceExpired, ready]);
  const previousMixing = useRef(false);
  useEffect(() => {
    const running =
      !!snapshot?.world.mixer.readyAt &&
      snapshot.world.mixer.readyAt > serverNow &&
      !snapshot.world.mixer.jammed;
    sound.current?.setLoop('mixer', running && playing ? 'mixer.run' : null);
    if (previousMixing.current && !running && !snapshot?.world.mixer.jammed)
      sound.current?.play('mixer.stop');
    previousMixing.current = running;
  }, [
    snapshot?.world.mixer.readyAt,
    snapshot?.world.mixer.jammed,
    serverNow,
    playing,
  ]);
  useEffect(() => {
    if (!playing || paused) return;
    const timer = setInterval(() => {
      const p = scene.current?.pose;
      if (!p) return;
      const onFoundation = Math.abs(p.x) <= 4 && Math.abs(p.z) <= 3;
      const standing = snapshotRef.current?.world.parts.find((part) => {
        const d = dimensions(part.kind, part.rotation);
        return (
          Math.abs(p.x - part.x) < d.w / 2 + 0.05 &&
          Math.abs(p.z - part.z) < d.d / 2 + 0.05 &&
          Math.abs(p.y - 1.68 - part.y - d.h / 2) < 0.14
        );
      });
      const surface = standing
        ? standing.kind === 'beam'
          ? 'wood'
          : standing.kind
        : onFoundation
          ? 'concrete'
          : 'dirt';
      sound.current?.movement(
        p,
        surface,
        !!standing || Math.abs(p.y - 1.68 - (onFoundation ? 0.12 : 0)) < 0.14,
      );
    }, 120);
    return () => clearInterval(timer);
  }, [playing, paused]);
  return (
    <main className={`${styles.game} ${touch ? styles.touch : ''}`}>
      <div className={styles.viewport} ref={mount} />
      <div className={styles.shade} />
      <header className={styles.header}>
        <a
          className={styles.brand}
          href="/"
          aria-label="Back to game selection"
        >
          <span className={styles.brandIcon}>
            <Blocks size={23} strokeWidth={1.8} />
          </span>{' '}
          BRICK BY HAND<span className={styles.alpha}>ALPHA / 02</span>
        </a>
        {session && playing && (
          <div className={styles.room}>
            <span className={styles.liveDot} />
            <span>
              BUILDING SITE <b>{session.code}</b>
            </span>
            <span className={styles.playerCount}>
              <Users size={14} /> {snapshot?.players.length || 1}/4
            </span>
            <button onClick={() => void invite()} aria-label="Copy invite link">
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </button>
          </div>
        )}
        <div className={styles.headerActions}>
          <GameToolbar
            workshop="/first-person/admin"
            voiceHint="Use your group call to talk with friends. In-game voice is not available in Brick by Hand yet."
            muted={muted}
            onToggleSound={() => setMuted((value) => !value)}
            onHelp={() => {
              if (playing) pause();
              setHelp(true);
            }}
            onLeave={session ? () => void leave() : undefined}
          />
        </div>
        {session && playing && (
          <button
            className={styles.menuButton}
            onClick={pause}
            aria-label="Open game menu"
          >
            <Menu size={20} />
          </button>
        )}
      </header>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogTitle>How to play Brick by Hand</DialogTitle>
          <DialogDescription>
            Build a home with your crew. Mix mortar, lay bricks, then add beams
            and a roof. The building site saves automatically.
          </DialogDescription>
          <p>
            WASD moves, the mouse looks around, Space jumps, and Shift runs.
            Press E to collect supplies or use the mixer. Click or press F to
            place the selected part. Use 1–5 to choose a tool and R to rotate a
            part.
          </p>
          <p>
            On touch screens, move with the left joystick, drag on the right to
            look, and tap the action buttons. Escape releases the mouse; the
            game menu lets you take a break or leave the site.
          </p>
        </DialogContent>
      </Dialog>

      {!playing && (
        <section className={styles.start}>
          <div className={styles.eyebrow}>
            <span /> YOUR PLOT. YOUR CREW.
          </div>
          <h1>
            Build something great.
            <br />
            <em>Brick by brick.</em>
          </h1>
          <p className={styles.intro}>
            Build with your own hands. Mix mortar, lay bricks and create a home
            together.
          </p>
          <div className={styles.features}>
            <span>
              <Users size={15} /> 1–4 builders
            </span>
            <span>
              <Maximize size={14} /> First-person view
            </span>
          </div>
          <div className={styles.setup}>
            {session ? (
              <>
                <div className={styles.welcome}>
                  <HardHat size={25} />
                  <div>
                    <strong>Your building site is ready.</strong>
                    <span>Room {session.code} · Progress is saved</span>
                  </div>
                </div>
                <button
                  className={styles.primary}
                  onClick={start}
                  disabled={!ready || busy}
                >
                  <Play size={17} fill="currentColor" /> Enter building site{' '}
                  <ArrowRight size={18} />
                </button>
                <button
                  className={styles.secondary}
                  onClick={() => void invite()}
                >
                  {copied ? 'Invite link copied' : 'Invite builders'}{' '}
                  <Copy size={14} />
                </button>
              </>
            ) : (
              <>
                <label className={styles.field}>
                  YOUR NAME
                  <input
                    maxLength={18}
                    autoComplete="off"
                    placeholder="What is your name, builder?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  className={styles.primary}
                  disabled={!ready || busy || !!fatal}
                  onClick={() => void enter('create')}
                >
                  {busy ? (
                    <LoaderCircle size={17} className={styles.spin} />
                  ) : (
                    <HardHat size={18} />
                  )}{' '}
                  Open your own site <ArrowRight size={18} />
                </button>
                <button
                  className={styles.secondary}
                  onClick={() => setJoining(!joining)}
                  aria-expanded={joining}
                >
                  <Users size={15} /> Join a building site
                </button>
                {joining && (
                  <form
                    className={styles.join}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void enter('join');
                    }}
                  >
                    <input
                      aria-label="Room code"
                      placeholder="ROOM CODE"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z2-9]/g, ''),
                        )
                      }
                    />
                    <button
                      disabled={code.length !== 6 || busy || !ready}
                      type="submit"
                      aria-label="Join with room code"
                    >
                      <ArrowRight size={19} />
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
          <p className={styles.startHint}>
            WASD to move · Mouse to look · E to interact
            <br />
            {touch
              ? 'Touch controls available · Landscape recommended'
              : 'Play in your browser. No download needed.'}
          </p>
        </section>
      )}

      {!playing && (
        <div className={styles.siteLabel}>
          <span>PLOT 02</span>
          <b>Your dream home belongs here.</b>
          <small>8 × 6 meters · Room for your ideas</small>
        </div>
      )}
      {!ready && !fatal && (
        <div className={styles.loading}>
          <LoaderCircle size={19} className={styles.spin} /> Preparing the
          building site …
        </div>
      )}
      {fatal && (
        <div className={styles.fatal} role="alert">
          {fatal}
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      )}

      {playing && !paused && (
        <>
          <div
            className={`${styles.crosshair} ${aim.valid ? styles.readyCrosshair : aim.status === 'blocked' ? styles.blockedCrosshair : ''}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
            <i />
          </div>
          <aside className={styles.task}>
            <div className={styles.taskHeading}>
              <HardHat size={16} />{' '}
              {race
                ? 'YOUR ROOF-RAISING RACE'
                : step >= 3
                  ? 'FROM WALL TO HOME'
                  : 'YOUR FIRST WALL'}
            </div>
            {race ? (
              <>
                <strong>
                  {race.completed
                    ? 'The roof is up! Teamwork holds.'
                    : racing
                      ? `Time left ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · lends a hand!`
                      : 'Clocking-off time came early.'}
                </strong>
                <p>
                  {race.completed
                    ? 'Your building stays. Start a new round at the sign.'
                    : racing
                      ? 'One mixes, one lays bricks, one builds the roof. Mixer jammed? Nudge it with E!'
                      : 'Your progress stays. Keep building freely or start another round at the sign.'}
                </p>
                <div className={styles.raceGoals}>
                  <span>{Math.min(12, goals.bricks)}/12 bricks</span>
                  <span>{Math.min(2, goals.posts)}/2 posts</span>
                  <span>{Math.min(2, goals.roofs)}/2 roof panels</span>
                </div>
              </>
            ) : (
              <>
                <strong>
                  {step === 0
                    ? 'Collect your building materials.'
                    : step === 1
                      ? 'Head to the mixer.'
                      : step === 2
                        ? 'Time to lay some bricks.'
                        : posts < 2
                          ? 'Time to build upwards.'
                          : roofs < 2
                            ? 'The roof needs beams.'
                            : 'Your first roof-raising!'}
                </strong>
                <p>
                  {step === 0
                    ? 'Bricks are to the left of the foundation. Look at the pallet and press E.'
                    : step === 1
                      ? '1 cement + 2 sand + 1 water. Collect each portion, then use E at the mixer to add it.'
                      : step === 2
                        ? 'Collect mortar. Spread it with [2], then place a brick with [1]. Light joints show the bond.'
                        : posts < 2
                          ? 'Collect beams. Use R / Orientation to select “Upright” and place two posts.'
                          : roofs < 2
                            ? 'Lay beams across the posts. Select roof and aim at the top of a beam. Use the scaffolding to climb up.'
                            : 'Keep building your house. Want a timed challenge? Start the roof-raising race at the sign behind the house.'}
                </p>
                <div className={styles.stepTrack}>
                  {['Material', 'Mix', 'Lay bricks'].map((text, i) => (
                    <span
                      key={text}
                      className={
                        step > i
                          ? styles.complete
                          : step === i
                            ? styles.current
                            : ''
                      }
                    >
                      {step > i ? <Check size={12} /> : <i />}
                      {text}
                    </span>
                  ))}
                </div>
                {step >= 2 && step < 3 && (
                  <div className={styles.brickProgress}>
                    <span>{built} / 12 bonded bricks</span>
                    <progress max={12} value={built} />
                  </div>
                )}
                {step >= 3 && (
                  <div className={styles.raceGoals}>
                    <span>{posts} Posts</span>
                    <span>{roofs} Roof panels</span>
                  </div>
                )}
              </>
            )}
          </aside>
          <div className={styles.team}>
            {snapshot?.players.map((p) => (
              <span key={p.id} title={p.name}>
                <i
                  style={{
                    background: ['#e7a12e', '#53968a', '#c25d48', '#7298bd'][
                      p.color % 4
                    ],
                  }}
                >
                  <HardHat size={13} />
                </i>
                {p.name}
                {p.id === session?.id ? ' (du)' : ''}
              </span>
            ))}
            <button
              className={styles.shout}
              onClick={() => scene.current?.shout()}
            >
              Shout! <kbd>Q</kbd>
            </button>
          </div>
          {notice && (
            <output className={styles.siteNotice}>{notice.text}</output>
          )}
          {aim.station === 'mixer' && mixer && (
            <aside className={styles.mixerPanel}>
              <div className={styles.taskHeading}>
                <RotateCw size={16} className={mixing ? styles.spin : ''} />{' '}
                MORTAR MIXER
              </div>
              <div className={styles.recipe}>
                {[
                  ['Cement', mixer.cement, 1],
                  ['Sand', mixer.sand, 2],
                  ['Water', mixer.water, 1],
                ].map(([label, count, target]) => (
                  <span key={label}>
                    <b>
                      {count}
                      <small> / {target}</small>
                    </b>
                    {label}
                  </span>
                ))}
              </div>
              <p>{recipeStatus(mixer, serverNow)}</p>
              {mixing && <progress max={1} value={progress} />}
              {!!mixer.remaining && !mixing && (
                <strong>{mixer.remaining} Portions ready</strong>
              )}
              <button
                onClick={() => scene.current?.emptyMixer()}
                disabled={mixing || mixer.jammed}
              >
                Empty mixer <kbd>X</kbd>
              </button>
            </aside>
          )}
          <output
            className={`${styles.aim} ${aim.valid ? styles.validAim : aim.status === 'blocked' ? styles.blockedAim : ''}`}
          >
            <small>
              {aim.valid
                ? '● READY'
                : aim.status === 'blocked'
                  ? '! ACTION UNAVAILABLE'
                  : 'AIM AT YOUR BUILDING TARGET'}
            </small>
            <strong>
              {aim.station && <kbd>E</kbd>}
              {aim.label}
            </strong>
            <span>{aim.detail}</span>
          </output>
          {tool === 'beam' && (
            <button
              className={styles.orientation}
              onClick={() => scene.current?.rotate()}
              aria-label="Change beam orientation"
            >
              <RotateCw size={15} /> {aim.orientation ?? 'Lengthwise'}{' '}
              <kbd>R</kbd>
            </button>
          )}
          {inv.carrying && (
            <div className={styles.carry}>
              <Package size={16} />
              <span>
                Carrying <strong>1 × {MATERIAL[inv.carrying]}</strong>
              </span>
              <span>Take to mixer · E to pour in</span>
            </div>
          )}
          <div className={styles.toolbelt}>
            {TOOLS.map(({ id, label, icon: Icon }, i) => (
              <button
                key={id}
                onClick={() => selectTool(id)}
                className={tool === id ? styles.selectedTool : ''}
                aria-pressed={tool === id}
                aria-label={`${label} selected`}
              >
                <kbd>{i + 1}</kbd>
                <Icon size={24} strokeWidth={1.6} />
                <span>{label}</span>
                {id !== 'remove' && (
                  <b>
                    {id === 'brick'
                      ? inv.bricks
                      : id === 'mortar'
                        ? inv.mortar
                        : id === 'beam'
                          ? inv.beams
                          : inv.roofs}
                  </b>
                )}
              </button>
            ))}
          </div>
          <div className={styles.bottomHints}>
            <span>
              {locked
                ? 'ESC releases mouse'
                : touch
                  ? 'Walk on the left · Drag over the game on the right to look around'
                  : 'Click the game to capture mouse · Or drag to look'}
            </span>
            <span>R orientation · Q shout · Space jump · Shift run</span>
          </div>
          {touch && (
            <div className={styles.touchControls}>
              <div
                ref={stickPad}
                className={styles.joystick}
                role="application"
                aria-label="Joystick to move"
              >
                <span />
              </div>
              <div className={styles.touchButtons}>
                <button
                  onClick={() => scene.current?.rotate()}
                  aria-label="Rotate part"
                >
                  <RotateCw size={20} />
                </button>
                <button onClick={() => scene.current?.jump()} aria-label="Jump">
                  ↑
                </button>
                <button
                  className={styles.touchAction}
                  onClick={() => scene.current?.use()}
                >
                  {aim.action || 'Interact'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {playing && paused && (
        <div className={styles.pauseBackdrop}>
          <section className={styles.pausePanel} aria-label="Game menu">
            <span className={styles.eyebrow}>QUICK BUILDING BREAK</span>
            <h2>Back to work in a moment.</h2>
            <p>
              Your crew can keep working. The building site saves automatically.
            </p>
            <button className={styles.primary} onClick={start}>
              <Play size={17} /> Keep building <ArrowRight size={18} />
            </button>
            <button className={styles.option} onClick={() => void invite()}>
              <Copy size={17} />{' '}
              {copied
                ? 'Invite link copied'
                : `Invite builders · ${session?.code}`}
            </button>
            <button
              className={styles.option}
              onClick={() => {
                setLow(!low);
                scene.current?.quality(!low);
              }}
            >
              <Settings2 size={17} /> Graphics: {low ? 'Low' : 'High'}{' '}
              <span>switch</span>
            </button>
            <button
              className={styles.option}
              onClick={() => {
                setMuted(!muted);
              }}
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />} Sound{' '}
              {muted ? 'off' : 'on'}
            </button>
            <a href="/first-person/admin" className={styles.option}>
              <Settings2 size={17} /> Admin · Sound workshop
            </a>
            <div className={styles.controlsInfo}>
              WASD: move · Mouse: look
              <br />
              E: supplies / mixer / sign · Click or F: build
              <br />
              1–5: tool · R: lengthwise / crosswise / upright beam
              <br />
              Q: site shout · Space: jump
              <br />
              Mortar recipe: 1 cement + 2 sand + 1 water
              <br />
              Roof-raising race: start at the sign behind the house
            </div>
            <button className={styles.secondary} onClick={() => void leave()}>
              <ArrowLeft size={15} /> Back to game selection
            </button>
          </section>
        </div>
      )}
      {message && (
        <output className={styles.toast}>
          <span>{message}</span>
          <button onClick={() => setMessage('')} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </output>
      )}
      {!playing && (
        <footer className={styles.footer}>
          <span>A BRICK BY HAND PROTOTYPE</span>
          <span>First the mortar. Then the big plans.</span>
          <a href="/first-person/credits" target="_blank" rel="noreferrer">
            Materials &amp; credits ↗
          </a>
        </footer>
      )}
    </main>
  );
}
