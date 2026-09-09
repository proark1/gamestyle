'use client';
/* eslint-disable next/no-img-element -- Local collection illustration on both hosting targets. */
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token. */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  Castle,
  Check,
  Copy,
  Crosshair,
  Flame,
  Hand,
  LoaderCircle,
  Package,
  Swords,
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
  advanceSiege,
  banner,
  freshSiege,
  hydrateSiege,
  newCrew,
  siegeAction,
  siegeSnapshot,
  winders,
} from './simulation';
import {
  AMMO,
  CRANK,
  LEVER,
  PILE,
  ROUND_MS,
  SLING,
  TREBUCHET,
  idleInput,
  rangeFor,
  type SiegeAction,
  type SiegeSession,
  type SiegeSnapshot,
  type SiegeWorld,
} from './types';
import { SiegeSound } from './audio';
import type { SiegeScene } from './scene';
import './style.css';

const SESSION_KEY = 'siege-and-desist-session-v1';
const PREFS_KEY = 'siege-and-desist-prefs-v1';
const time = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const at = (
  p: { x: number; z: number } | undefined,
  spot: { x: number; z: number },
  r: number,
) => !!p && Math.hypot(p.x - spot.x, p.z - spot.z) <= r;

export default function SiegeAndDesist() {
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<SiegeScene | null>(null),
    sound = useRef<SiegeSound | null>(null),
    network = useRef<PeerGameConnection<SiegeSnapshot> | null>(null),
    local = useRef<SiegeWorld | null>(null),
    activeSession = useRef<SiegeSession | null>(null),
    latest = useRef<SiegeSnapshot | null>(null),
    input = useRef(idleInput()),
    actionRef = useRef<(a: SiegeAction) => void>(() => {}),
    hudAt = useRef(0);
  const [snapshot, setSnapshot] = useState<SiegeSnapshot | null>(null),
    [session, setSession] = useState<SiegeSession | null>(null),
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
    playing = w?.phase === 'playing' || w?.phase === 'relief',
    done = w?.phase === 'won' || w?.phase === 'lost',
    captain = snapshot?.host === session?.id,
    practice = session?.code === 'PRACTICE';

  function accept(next: SiegeSnapshot) {
    if (!activeSession.current) return;
    hydrateSiege(next.world);
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

  function attach(s: SiegeSession, state?: SiegeSnapshot) {
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
      'siege-and-desist',
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
    const audio = new SiegeSound();
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
      .then(({ SiegeScene }) => {
        if (disposed || !container.current) return;
        try {
          scene.current = new SiegeScene(container.current, {
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
                'The siege field display stopped. Reload to rejoin your crew.',
              );
            },
            tick: () => {
              const world = local.current,
                s = activeSession.current;
              if (!world || !s) return;
              advanceSiege(world, Date.now());
              accept(siegeSnapshot(world, s.code, s.id, s.id, world.clock));
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
            'The siege field could not load. Enable hardware acceleration and reload to play.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The siege field could not load. Reload and try again.');
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

  function savePrefs(next = muted) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ name, muted: next }));
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
      const reply = await enterPeerRoom<SiegeSnapshot>(
        'siege-and-desist',
        {
          op,
          name: name.trim() || 'Siege hand',
          ...(op === 'join' ? { code: code.toUpperCase().trim() } : {}),
        },
        () => import('./peer'),
      );
      if (!reply.session)
        throw new Error('The siege camp could not be joined. Try again.');
      attach(reply.session, reply.snapshot);
      setModal(null);
      history.replaceState(
        null,
        '',
        `/siege-and-desist?room=${reply.session.code}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not reach the camp. Try again.',
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
      world = freshSiege(now),
      s = { code: 'PRACTICE', id: 'practice-crew', token: '' };
    world.players.push(newCrew(s.id, name.trim() || 'You', 0, now));
    siegeAction(world, s.id, { type: 'start' }, s.id);
    local.current = world;
    activeSession.current = s;
    setSession(s);
    setStatus('online');
    setNotice('');
    latest.current = null;
    scene.current?.setSession(s.id);
    accept(siegeSnapshot(world, s.code, s.id, s.id, now));
  }

  function action(a: SiegeAction) {
    if (modal || !activeSession.current || status !== 'online') return;
    sound.current?.unlock();
    // Holds release constantly; a stale hold must never spam the notice line.
    const quiet = a.type === 'stopWind' || a.type === 'stopPush';
    if (!quiet) setNotice('');
    try {
      if (local.current) {
        siegeAction(
          local.current,
          activeSession.current.id,
          a,
          activeSession.current.id,
        );
        accept(
          siegeSnapshot(
            local.current,
            'PRACTICE',
            activeSession.current.id,
            activeSession.current.id,
            local.current.clock,
          ),
        );
      } else
        void network.current?.action(a).catch((error) => {
          if (!quiet) setNotice(error.message);
        });
    } catch (error) {
      if (!quiet)
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
      history.replaceState(null, '', '/siege-and-desist');
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/siege-and-desist?room=${session?.code}`,
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
    !playing || status !== 'online' || !!modal || !me || me.flying;
  const nearPile = at(me, PILE, 3);
  const nearSling = at(me, SLING, 2.6);
  const nearCrank = at(me, CRANK, 2.6);
  const nearLever = at(me, LEVER, 2.6);
  const canPush =
    at(me, TREBUCHET, 5.2) && !!me && Math.abs(me.x - TREBUCHET.x) >= 0.7;
  const lastEvent = w?.events.at(-1);
  const flag = w && banner(w);
  const standing = w
    ? w.blocks.filter((b) => !b.fallen && b.part !== 'banner').length
    : 0;
  const pulling = w ? winders(w) : 0;
  const riding = !!me && w?.rider === me.id;
  // Mirrors the reach the simulation enforces for `help`, so the button is lit
  // only when there is actually somebody to haul up. The compact layout hides
  // whatever is unavailable, and a permanently lit button would never hide.
  const canHelp =
    !!me &&
    !!w &&
    w.players.some(
      (f) =>
        f.id !== me.id &&
        f.stunnedUntil > w.clock &&
        !f.flying &&
        Math.hypot(me.x - f.x, me.z - f.z) < 2.5,
    );
  const idle =
    disabled ||
    !(
      nearCrank ||
      nearPile ||
      nearSling ||
      nearLever ||
      canPush ||
      canHelp ||
      riding
    );

  return (
    <main className={`sad-game${session ? ' in-session' : ''}`}>
      <div className="sad-canvas" ref={container} />
      <header className="sad-header">
        <a href="/" className="sad-brand">
          <span>
            <Castle size={22} />
          </span>{' '}
          SIEGE <em>and</em> DESIST<span className="sad-dot">.</span>
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
          workshop="/siege-and-desist/admin"
          voice={
            session?.peer && w
              ? {
                  session: { ...session, game: 'siege-and-desist' },
                  snapshot: { players: w.players, nearby: false },
                  onSpeaking: (active) => sound.current?.duck(active),
                }
              : undefined
          }
          voiceHint="Create or join a siege with friends to use voice chat."
        />
      </header>

      {!session ? (
        <section className="sad-menu">
          <div className="sad-menu-copy">
            <span className="sad-kicker">
              <span /> THE JUMBLEYARD SIEGE
            </span>
            <h1>
              One trebuchet.
              <br />
              <em>Four opinions.</em>
            </h1>
            <p>
              Wind the counterweight, load the sling, and bring down the
              keep&rsquo;s banner before dawn. Somebody will end up in the
              sling. It will not be an accident.
            </p>
            <div className="sad-meta">
              <span>
                <Users size={16} /> 1–4 players
              </span>
              <span>4-minute sieges</span>
            </div>
            <label className="sad-name">
              Your siege name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                placeholder="Definitely Not Aiming"
                autoComplete="nickname"
              />
            </label>
            <button
              className="sad-primary"
              disabled={!ready || busy}
              onClick={() => void enter('create')}
            >
              {busy ? (
                <LoaderCircle className="sad-spin" size={20} />
              ) : (
                <Swords size={20} />
              )}{' '}
              Raise a siege <ArrowUpRight size={20} />
            </button>
            <div className="sad-menu-secondary">
              <button
                disabled={!ready || busy}
                onClick={() => setModal('join')}
              >
                Join a crew
              </button>
              <button disabled={!ready || busy} onClick={startPractice}>
                Try solo
              </button>
            </div>
            <small className="sad-menu-note">
              No download. No conquest. One extremely large lever.
            </small>
          </div>
          <figure className="sad-menu-art">
            <div className="sad-menu-art-fallback" aria-hidden="true">
              <Castle size={72} />
              <Crosshair size={40} />
            </div>
            <figcaption>
              <span>LAST WORDS OF A SIEGE CREW</span>
              <strong>&ldquo;Wind it a bit more.&rdquo;</strong>
            </figcaption>
          </figure>
        </section>
      ) : (
        <>
          <section className="sad-scoreboard" aria-label="Siege progress">
            <div>
              <span>THE KEEP</span>
              <strong>
                <Castle size={22} />
                {standing}
              </strong>
              <small>
                stones standing · {w?.rubble ?? 0} down · {w?.volleys ?? 0}{' '}
                volleys
              </small>
            </div>
            <div
              className={
                w?.phase === 'relief' ? 'sad-clock urgent' : 'sad-clock'
              }
            >
              <span>
                {w?.phase === 'relief' ? 'RELIEF COMING' : 'UNTIL DAWN'}
              </span>
              <strong>
                {w?.phase === 'lobby'
                  ? '4:00'
                  : time(
                      w?.phase === 'relief'
                        ? w.reliefAt - w.clock
                        : ROUND_MS - ((w?.clock ?? 0) - (w?.started ?? 0)),
                    )}
              </strong>
            </div>
          </section>

          <aside className="sad-crew" aria-label="Siege crew">
            <div className="sad-crew-title">
              <span>
                <Users size={15} /> {w?.players.length ?? 0}/4 IN CAMP
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
              <div className="sad-crew-person" key={p.id}>
                <i
                  style={{
                    background: ['#c2472f', '#2f7d74', '#d8a13d', '#7c5aa0'][
                      p.color % 4
                    ],
                  }}
                />
                <span>
                  {p.name}
                  {p.id === session.id ? ' (you)' : ''}
                </span>
                <small>
                  {p.flying
                    ? 'AIRBORNE'
                    : p.stunnedUntil > (w?.clock ?? 0)
                      ? 'DOWN'
                      : p.winding
                        ? 'WINDING'
                        : p.carrying
                          ? AMMO[p.carrying].name
                          : '—'}
                </small>
              </div>
            ))}
          </aside>

          {w?.phase === 'lobby' && (
            <section className="sad-lobby">
              <span className="sad-kicker">THE CAMP IS PITCHED</span>
              <h2>
                Fetch three
                <br />
                strong friends.
              </h2>
              <button
                className="sad-room-code"
                onClick={() => void copyInvite()}
              >
                {session.code}
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
              <p>
                Share this code with up to three friends. Join before the
                captain calls the assault.
              </p>
              <button
                className="sad-primary"
                disabled={!captain || status !== 'online'}
                onClick={() => action({ type: 'start' })}
              >
                {captain ? 'Call the assault' : 'Waiting for the captain…'}
                <ArrowUpRight size={19} />
              </button>
            </section>
          )}

          {playing && w && (
            <>
              <section className="sad-engine" aria-label="Trebuchet state">
                <div className="sad-wind">
                  <span>
                    COUNTERWEIGHT{pulling ? ` · ${pulling} winding` : ''}
                  </span>
                  <div className="sad-wind-track">
                    <i style={{ width: `${Math.round(w.wind * 100)}%` }} />
                  </div>
                  <small>
                    Range {Math.round(rangeFor(w.wind))}m
                    <span> · gate 20m · keep 28m</span>
                  </small>
                </div>
                <div className="sad-payload">
                  <span>SLING</span>
                  <strong>
                    {w.rider
                      ? (w.players.find((p) => p.id === w.rider)?.name ??
                        'Someone')
                      : w.loaded
                        ? AMMO[w.loaded].name
                        : 'Empty'}
                  </strong>
                  <small>
                    {w.turn === 0
                      ? 'Aimed straight'
                      : `Swung ${w.turn > 0 ? 'left' : 'right'}`}
                  </small>
                </div>
              </section>

              <button
                className="sad-camera"
                onClick={() => scene.current?.changeCamera()}
                aria-label="Change camera"
              >
                <Camera size={19} />
                <span>View · V</span>
              </button>

              <div className="sad-your-status">
                {me?.flying ? (
                  'You are airborne. Nothing to do but arrive.'
                ) : riding ? (
                  'You are in the sling. Someone still has to pull the lever.'
                ) : me && me.stunnedUntil > w.clock ? (
                  'Flattened. A crewmate can haul you up with H.'
                ) : me?.carrying ? (
                  <>
                    <Package size={16} /> Carrying {AMMO[me.carrying].name} ·
                    take it to the sling
                  </>
                ) : (
                  <>
                    <Flame size={16} />{' '}
                    {flag && flag.y > 3.2
                      ? 'Banner still flying'
                      : 'Banner falling!'}{' '}
                    ·{' '}
                    {w.beesUntil > w.clock
                      ? 'defenders scattered'
                      : 'mind the clay pots'}
                  </>
                )}
              </div>

              <TouchControls
                disabled={disabled}
                move={(v) => scene.current?.move(v)}
                jump={() => action({ type: 'jump' })}
              />

              <nav className="sad-action-dock" aria-label="Siege actions">
                <button
                  className="sad-action wind"
                  disabled={disabled || !nearCrank}
                  onPointerDown={() => action({ type: 'wind' })}
                  onPointerUp={() => action({ type: 'stopWind' })}
                  onPointerLeave={() => action({ type: 'stopWind' })}
                  onPointerCancel={() => action({ type: 'stopWind' })}
                >
                  <Crosshair size={21} />
                  <span>
                    Wind
                    <kbd>
                      R · {nearCrank ? 'hold the winch' : 'go to the winch'}
                    </kbd>
                  </span>
                </button>
                <button
                  className="sad-action"
                  disabled={disabled || (!nearPile && !nearSling)}
                  onClick={() => action({ type: 'grab' })}
                >
                  <Package size={20} />
                  <span>
                    {me?.carrying && nearSling ? 'Load sling' : 'Fetch'}
                    <kbd>
                      E ·{' '}
                      {me?.carrying
                        ? nearSling
                          ? 'into the sling'
                          : 'carry to sling'
                        : 'from the pile'}
                    </kbd>
                  </span>
                </button>
                <button
                  className="sad-action"
                  disabled={disabled || !canPush}
                  onPointerDown={() => action({ type: 'push' })}
                  onPointerUp={() => action({ type: 'stopPush' })}
                  onPointerLeave={() => action({ type: 'stopPush' })}
                  onPointerCancel={() => action({ type: 'stopPush' })}
                >
                  <span>
                    Swing aim<kbd>Q · push the frame</kbd>
                  </span>
                </button>
                <button
                  className="sad-action ride"
                  disabled={disabled || (!nearSling && !riding)}
                  onClick={() => action({ type: 'ride' })}
                >
                  <span>
                    {riding ? 'Climb out' : 'Ride it'}
                    <kbd>C · a genuinely bad idea</kbd>
                  </span>
                </button>
                <button
                  className="sad-action"
                  disabled={disabled || !canHelp}
                  onClick={() => action({ type: 'help' })}
                >
                  <Hand size={19} />
                  <span>
                    Haul up<kbd>H · nearby crewmate</kbd>
                  </span>
                </button>
                <button
                  className="sad-action loose"
                  disabled={
                    disabled ||
                    !nearLever ||
                    (!w.loaded && !w.rider) ||
                    w.wind < 0.12
                  }
                  onClick={() => action({ type: 'loose' })}
                >
                  <Swords size={21} />
                  <span>
                    LOOSE
                    <kbd>
                      F · {nearLever ? 'pull the pin' : 'reach the lever'}
                    </kbd>
                  </span>
                </button>
                {/* The compact layout shows only the actions you can take, so
                    standing in open ground would otherwise leave a bare dock. */}
                {idle && (
                  <span className="sad-dock-hint">
                    {me?.flying
                      ? 'Airborne. Nothing to do but arrive.'
                      : me && w && me.stunnedUntil > w.clock
                        ? 'Flattened. A crewmate can haul you up.'
                        : 'Walk to the winch, the pile or the lever.'}
                  </span>
                )}
              </nav>
              <span className="sad-movement-hint">
                WASD / arrows to move · The gold ring shows where this wind
                lands · Fire pots burn timber, the hive clears the walls
              </span>
            </>
          )}

          {done && w && (
            <section className="sad-results">
              <Trophy size={34} />
              <span className="sad-kicker">
                {w.phase === 'won' ? 'THE KEEP IS YOURS' : 'DAWN CAME FIRST'}
              </span>
              <h2>
                {w.phase === 'won'
                  ? 'Banner down.'
                  : 'Still standing. Annoyingly.'}
              </h2>
              <p>
                {w.rubble} stones brought down over {w.volleys} volleys.
                <br />
                {w.players.reduce((n, p) => n + p.launches, 0)} crewmates were
                launched on purpose.
              </p>
              <div className="sad-result-list">
                {w.players.map((p) => (
                  <div key={p.id}>
                    <span>{p.name}</span>
                    <b>
                      {p.loaded} loaded · {p.launches} flights
                    </b>
                  </div>
                ))}
              </div>
              <button
                className="sad-primary"
                disabled={!captain || status !== 'online'}
                onClick={() => action({ type: 'restart' })}
              >
                {captain ? 'Another siege' : 'Waiting for the captain…'}
                <ArrowUpRight size={18} />
              </button>
              <button className="sad-text-button" onClick={() => void leave()}>
                Back to camp
              </button>
            </section>
          )}
        </>
      )}

      {(notice ||
        (session && status !== 'online') ||
        (playing && lastEvent && w && w.clock - lastEvent.at < 5000)) && (
        <output className="sad-notice">
          {notice ||
            (status === 'expired'
              ? 'This siege expired. Use All games to leave and raise a new one.'
              : status === 'reconnecting'
                ? 'Reaching your crew…'
                : lastEvent?.text)}
        </output>
      )}
      {!ready && !notice && (
        <output className="sad-loading">
          <LoaderCircle className="sad-spin" size={18} /> Pitching the camp…
        </output>
      )}

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="sad-dialog">
          <DialogTitle>
            {modal === 'help'
              ? 'One trebuchet, shared badly'
              : modal === 'join'
                ? 'Find your siege crew'
                : modal === 'invite'
                  ? 'Summon three strong friends'
                  : 'Leave the siege?'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'help'
              ? 'Bring the banner down before dawn.'
              : modal === 'leave'
                ? 'Your crew keeps going without you.'
                : 'Up to four friends share one camp and one very large lever.'}
          </DialogDescription>
          {modal === 'help' && (
            <div className="sad-help">
              <p>
                <strong>Wind it.</strong> Stand at the winch behind the frame
                and hold R. Every extra pair of hands winds faster. The
                counterweight sets your range: about half a wind reaches the
                gate, three quarters reaches the keep behind it, and a full wind
                sails clean over.
              </p>
              <p>
                <strong>Load it.</strong> Press E at the supply pile to pick
                something up, carry it to the sling, and press E again. Boulders
                break stone. Fire pots set timber alight and burn a course
                through. The beehive clears the battlements so the defenders
                stop throwing clay pots. The cow is the cow.
              </p>
              <p>
                <strong>Aim it.</strong> Stand at either side of the frame and
                hold Q to lean on it. Pushing from the left swings the throw
                right. The gold ring on the ground shows where the current wind
                will land.
              </p>
              <p>
                <strong>Loose it.</strong> Someone has to be at the release
                lever on the right and press F. That someone is not the person
                in the sling. Press C to climb into the sling yourself, which is
                a real option and a terrible one.
              </p>
              <p>
                <strong>Stay upright.</strong> Falling masonry and clay pots
                flatten you; H hauls a crewmate back up. WASD / arrows move,
                Space jumps, V changes the camera, and the camera rides the shot
                by default. On touchscreens use the joystick and the action
                dock.
              </p>
              <p>
                Solo runs the same siege with the same castle. The keep is a
                real rigid-body stack, so no two collapses are the same.
              </p>
              <div className="sad-ammo-list">
                {Object.entries(AMMO)
                  .filter(([id]) => id !== 'crew')
                  .map(([id, spec]) => (
                    <span key={id}>{spec.name}</span>
                  ))}
              </div>
            </div>
          )}
          {modal === 'join' && (
            <form
              className="sad-join-form"
              onSubmit={(e) => {
                e.preventDefault();
                void enter('join');
              }}
            >
              <label className="sad-name">
                Your siege name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={18}
                  placeholder="Definitely Not Aiming"
                  autoComplete="nickname"
                />
              </label>
              <label className="sad-name">
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
                className="sad-primary"
                disabled={busy || !ready || code.length !== 6}
              >
                {busy ? 'Joining…' : 'Join the crew'}
                <ArrowUpRight size={18} />
              </button>
            </form>
          )}
          {modal === 'invite' && (
            <>
              <button
                className="sad-room-code"
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
                className="sad-primary"
                disabled={busy}
                onClick={() => void leave().then(() => location.assign('/'))}
              >
                Leave for all games
              </button>
              <button
                className="sad-text-button"
                onClick={() => setModal(null)}
              >
                Stay at the siege
              </button>
            </>
          )}
          {notice && <p role="alert">{notice}</p>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
