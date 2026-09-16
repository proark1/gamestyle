'use client';
/* eslint-disable next/no-img-element -- Local collection illustration on both hosting targets. */
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token. */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Castle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Flame,
  Hand,
  LoaderCircle,
  Swords,
  Timer,
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
  reconcileClashBots,
  siegeAction,
  siegeSnapshot,
  winders,
} from './simulation';
import {
  AMMO,
  BANNER_DOWN,
  ENGINE_REACH,
  ROUND_MS,
  SLING,
  SLING_RED,
  SLING_BLUE,
  TREBUCHET,
  TREBUCHET_RED,
  TREBUCHET_BLUE,
  idleInput,
  rangeFor,
  type GameMode,
  type SiegeAction,
  type SiegeSession,
  type SiegeSnapshot,
  type SiegeWorld,
} from './types';
import { SiegeSound } from './audio';
import type { SiegeScene } from './scene';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import { SIEGE_AND_DESIST_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { siegeAnalytics, siegePlayState } from './analytics';

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

const tracker = new GameTracker(siegeAnalytics);

const MASCOTS = [
  { icon: '🐓', label: 'Rooster' },
  { icon: '👑', label: 'Keep' },
  { icon: '🧀', label: 'Cheese' },
] as const;

export default function SiegeAndDesist() {
  const { t } = useLanguage();
  const strings = t(SIEGE_AND_DESIST_TRANSLATIONS);
  useGameTracker(tracker);
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
    [selectedMode, setSelectedMode] = useState<GameMode>('clash2v2'),
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
    tracker.observe(siegePlayState(next, activeSession.current));
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
    const urlMode = new URL(location.href).searchParams.get('mode');
    if (urlMode === 'classic' || urlMode === 'clash2v2') {
      queueMicrotask(() => {
        if (!disposed) setSelectedMode(urlMode);
      });
    }
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
      const peerModule = await import('./peer');
      if (op === 'create') {
        peerModule.setConfiguredMode(selectedMode);
      }
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
      const modeParam = selectedMode === 'clash2v2' ? '&mode=clash2v2' : '';
      history.replaceState(
        null,
        '',
        `/siege-and-desist?room=${reply.session.code}${modeParam}`,
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
      world = freshSiege(now, selectedMode),
      s = { code: 'PRACTICE', id: 'practice-crew', token: '' };
    world.players.push(
      newCrew(s.id, name.trim() || 'You', 0, now, 'red', false, selectedMode),
    );
    if (selectedMode === 'clash2v2') {
      reconcileClashBots(world);
    }
    siegeAction(world, s.id, { type: 'start', mode: selectedMode }, s.id);
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
    tracker.action(a.type);
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

  useEffect(() => {
    if (!session) {
      scene.current?.setMode(selectedMode);
    }
  }, [selectedMode, session, ready]);

  async function leave() {
    tracker.observe({ stage: 'menu' });
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
      const modeParam = w?.mode === 'clash2v2' ? '&mode=clash2v2' : '';
      await navigator.clipboard.writeText(
        `${location.origin}/siege-and-desist?room=${session?.code}${modeParam}`,
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
  const is2v2 = w?.mode === 'clash2v2';
  const playerTeam = me?.team ?? 'red';
  const nearRedEngine = at(me, TREBUCHET_RED, ENGINE_REACH);
  const nearBlueEngine = is2v2 && at(me, TREBUCHET_BLUE, ENGINE_REACH);
  const atEngine = is2v2
    ? nearRedEngine || nearBlueEngine
    : at(me, TREBUCHET, ENGINE_REACH);

  const nearRedSling = at(me, SLING_RED, 2.6);
  const nearBlueSling = is2v2 && at(me, SLING_BLUE, 2.6);
  const nearSling = is2v2 ? nearRedSling || nearBlueSling : at(me, SLING, 2.6);

  const activeEngineTeam = nearBlueEngine
    ? 'blue'
    : nearRedEngine
      ? 'red'
      : playerTeam;
  const displayedEngine =
    is2v2 && activeEngineTeam === 'blue' && w?.engineBlue
      ? {
          engine: w.engineBlue,
          label: 'BLUE TREBUCHET (North)',
          color: '#38bdf8',
        }
      : {
          engine: {
            wind: w?.wind ?? 0,
            turn: w?.turn ?? 0,
            loaded: w?.loaded ?? null,
            rider: w?.rider ?? null,
            supply: w?.supply ?? [],
          },
          label: is2v2 ? 'RED TREBUCHET (South)' : 'COUNTERWEIGHT',
          color: '#f87171',
        };

  const lastEvent = w?.events.at(-1);
  const flag = w && banner(w);
  const standing = w
    ? w.blocks.filter((b) => !b.fallen && b.part !== 'banner').length
    : 0;
  const pulling = w ? winders(w, activeEngineTeam) : 0;
  const riding =
    !!me && (w?.rider === me.id || (is2v2 && w?.engineBlue?.rider === me.id));
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
  const idle = disabled || !(atEngine || nearSling || canHelp || riding);

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

      {!session && (
        <section className="sad-welcome">
          <p className="eyebrow">
            <span className="tiny-line" /> THE JUMBLEYARD SIEGE
          </p>
          <h1>
            SIEGE
            <span>
              AND DESIST<span className="sad-dot">.</span>
            </span>
          </h1>
          <div
            className="sad-mode-selector"
            role="radiogroup"
            aria-label="Game mode"
          >
            <button
              type="button"
              className={`sad-mode-btn ${selectedMode === 'clash2v2' ? 'active' : ''}`}
              onClick={() => setSelectedMode('clash2v2')}
            >
              <span className="sad-mode-title">
                <Swords size={16} /> {strings.castleClash}
              </span>
              <span className="sad-mode-desc">
                Two castles · Dual weapons · Rooster, Crown & Sacred Cheese
              </span>
            </button>
            <button
              type="button"
              className={`sad-mode-btn ${selectedMode === 'classic' ? 'active' : ''}`}
              onClick={() => setSelectedMode('classic')}
            >
              <span className="sad-mode-title">
                <Castle size={16} /> {strings.classicSiege}
              </span>
              <span className="sad-mode-desc">
                Co-op crew · Single keep · Topple the royal banner
              </span>
            </button>
          </div>

          <p className="sad-tagline">
            {selectedMode === 'clash2v2' ? (
              <>
                Two castles. Two engines.
                <br />
                <em>Pure medieval chaos.</em>
              </>
            ) : (
              <>
                One trebuchet.
                <br />
                <em>Four opinions.</em>
              </>
            )}
          </p>
          <p className="sad-intro">
            {selectedMode === 'clash2v2'
              ? 'Two opposing camps face off. Defend your Golden Rooster, Keep, and Sacred Cheese Wheel while blasting their towers to rubble. Watch out for mid-air collisions, rolling cheese, and the Goose of War!'
              : 'Wind the counterweight, load the sling, and bring down the keep’s banner before dawn. Somebody will end up in the sling. It will not be an accident.'}
          </p>
          <form
            className="setup-card"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !busy) void enter('create');
            }}
          >
            <label htmlFor="sad-name">YOUR SIEGE NAME</label>
            <input
              id="sad-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={18}
              placeholder="Definitely Not Aiming"
              autoComplete="nickname"
            />
            <button
              type="submit"
              className="primary-button"
              disabled={!ready || busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  <Swords size={18} />{' '}
                  {selectedMode === 'clash2v2'
                    ? 'Raise a 2v2 Clash'
                    : 'Raise a siege'}{' '}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!ready || busy}
              onClick={() => setModal('join')}
            >
              Join a crew <Users size={17} />
            </button>
            <button
              type="button"
              className="practice-link"
              disabled={!ready || busy}
              onClick={startPractice}
            >
              {selectedMode === 'clash2v2' ? 'Try 2v2 vs bots' : 'Try solo'}{' '}
              <ArrowUpRight size={14} />
            </button>
            <p className="start-tip">
              {ready
                ? selectedMode === 'clash2v2'
                  ? 'Opposing castles. Bots automatically fill empty crew slots.'
                  : 'No download. No conquest. One extremely large lever.'
                : 'Preparing the siege field…'}
            </p>
          </form>
          <div className="sad-facts">
            <span>
              <Users size={14} />{' '}
              {selectedMode === 'clash2v2'
                ? '1–4 players (bots fill)'
                : '1–4 players'}
            </span>
            <span>
              <Timer size={14} />{' '}
              {selectedMode === 'clash2v2'
                ? 'First to 3 towers'
                : '4-minute sieges'}
            </span>
          </div>
        </section>
      )}

      {!session && (
        <>
          <aside className="scene-caption">
            <span className="map-badge">LAST WORDS OF A SIEGE CREW</span>
            <span>&ldquo;Wind it a bit more.&rdquo;</span>
          </aside>
          <footer className="start-footer">
            <span>
              <span className="live-dot" /> NO DOWNLOAD. JUST BRING YOUR CREW.
            </span>
            <span>ONE EXTREMELY LARGE LEVER.</span>
          </footer>
        </>
      )}

      {session && (
        <>
          {is2v2 && w?.towers ? (
            <section
              className="sad-scoreboard clash"
              aria-label="Castle clash progress"
            >
              <div
                className={`sad-castle-card red ${playerTeam === 'red' ? 'my-castle' : ''}`}
              >
                <div className="sad-castle-meta">
                  <span className="castle-name">
                    RED CASTLE {playerTeam === 'red' ? '(Yours)' : ''}
                  </span>
                  <small>South Engine</small>
                </div>
                <div className="sad-towers">
                  {w.towers.red.map((standing, index) => (
                    <span
                      key={index}
                      className={`sad-tower-badge ${standing ? 'standing' : 'toppled'}`}
                      title={`${MASCOTS[index].label} Tower (${standing ? 'Standing' : 'Toppled'})`}
                    >
                      <span className="tower-icon">{MASCOTS[index].icon}</span>
                      <span className="tower-label">
                        {MASCOTS[index].label}
                      </span>
                      <span className="tower-status">
                        {standing ? 'OK' : 'DOWN'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="sad-clash-middle">
                <span className="sad-vs">VS</span>
                <div className="sad-clock">
                  <Timer size={14} />
                  <strong>
                    {w.phase === 'lobby'
                      ? '4:00'
                      : time(ROUND_MS - ((w.clock ?? 0) - (w.started ?? 0)))}
                  </strong>
                </div>
              </div>
              <div
                className={`sad-castle-card blue ${playerTeam === 'blue' ? 'my-castle' : ''}`}
              >
                <div className="sad-castle-meta">
                  <span className="castle-name">
                    BLUE CASTLE {playerTeam === 'blue' ? '(Yours)' : ''}
                  </span>
                  <small>North Engine</small>
                </div>
                <div className="sad-towers">
                  {w.towers.blue.map((standing, index) => (
                    <span
                      key={index}
                      className={`sad-tower-badge ${standing ? 'standing' : 'toppled'}`}
                      title={`${MASCOTS[index].label} Tower (${standing ? 'Standing' : 'Toppled'})`}
                    >
                      <span className="tower-icon">{MASCOTS[index].icon}</span>
                      <span className="tower-label">
                        {MASCOTS[index].label}
                      </span>
                      <span className="tower-status">
                        {standing ? 'OK' : 'DOWN'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : (
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
          )}

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
                <span className="sad-crew-name">
                  {p.name}
                  {p.id === session.id ? ' (you)' : ''}
                  {p.bot ? ' [Bot]' : ''}
                  {is2v2 && (
                    <em className={`sad-team-pill ${p.team ?? 'red'}`}>
                      {p.team === 'blue' ? 'BLUE' : 'RED'}
                    </em>
                  )}
                </span>
                <small>
                  {p.flying
                    ? 'AIRBORNE'
                    : p.stunnedUntil > (w?.clock ?? 0)
                      ? 'DOWN'
                      : p.winding
                        ? 'WINDING'
                        : p.pushing
                          ? 'AIMING'
                          : p.bot
                            ? 'BOT'
                            : '—'}
                </small>
              </div>
            ))}
          </aside>

          {w?.phase === 'lobby' && (
            <section className="sad-lobby">
              <span className="sad-kicker">
                {is2v2 ? '2v2 CASTLE CLASH' : 'THE CAMP IS PITCHED'}
              </span>
              <h2>
                {is2v2 ? 'Gather both camps.' : 'Fetch three strong friends.'}
              </h2>
              <button
                className="sad-room-code"
                onClick={() => void copyInvite()}
              >
                {session.code}
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
              <p>
                {is2v2
                  ? 'Red Castle (South) vs Blue Castle (North). Empty slots will be filled with bots.'
                  : 'Share this code with up to three friends. Join before the captain calls the assault.'}
              </p>
              {is2v2 && (
                <div className="sad-lobby-teams">
                  <div
                    className={`sad-team-box red ${playerTeam === 'red' ? 'mine' : ''}`}
                  >
                    <div className="sad-team-box-header">
                      <strong>RED CAMP</strong>
                      <small>South Engine & Castle</small>
                    </div>
                    <div className="sad-team-members">
                      {w.players
                        .filter((p) => (p.team ?? 'red') === 'red')
                        .map((p) => (
                          <div key={p.id} className="sad-member-chip">
                            <i
                              style={{
                                background: [
                                  '#c2472f',
                                  '#2f7d74',
                                  '#d8a13d',
                                  '#7c5aa0',
                                ][p.color % 4],
                              }}
                            />
                            <span>
                              {p.name}
                              {p.id === session.id ? ' (you)' : ''}
                              {p.bot ? ' [Bot]' : ''}
                            </span>
                          </div>
                        ))}
                      {w.players.filter((p) => (p.team ?? 'red') === 'red')
                        .length === 0 && (
                        <span className="empty-hint">No crew yet</span>
                      )}
                    </div>
                  </div>
                  <div className="sad-lobby-vs">VS</div>
                  <div
                    className={`sad-team-box blue ${playerTeam === 'blue' ? 'mine' : ''}`}
                  >
                    <div className="sad-team-box-header">
                      <strong>BLUE CAMP</strong>
                      <small>North Engine & Castle</small>
                    </div>
                    <div className="sad-team-members">
                      {w.players
                        .filter((p) => p.team === 'blue')
                        .map((p) => (
                          <div key={p.id} className="sad-member-chip">
                            <i
                              style={{
                                background: [
                                  '#c2472f',
                                  '#2f7d74',
                                  '#d8a13d',
                                  '#7c5aa0',
                                ][p.color % 4],
                              }}
                            />
                            <span>
                              {p.name}
                              {p.id === session.id ? ' (you)' : ''}
                              {p.bot ? ' [Bot]' : ''}
                            </span>
                          </div>
                        ))}
                      {w.players.filter((p) => p.team === 'blue').length ===
                        0 && <span className="empty-hint">No crew yet</span>}
                    </div>
                  </div>
                </div>
              )}
              {is2v2 && (
                <button
                  type="button"
                  className="sad-switch-team-btn"
                  onClick={() => action({ type: 'switchTeam' })}
                >
                  <Swords size={16} /> Switch to{' '}
                  {playerTeam === 'red' ? 'Blue' : 'Red'} Camp
                </button>
              )}
              <button
                className="sad-primary"
                disabled={!captain || status !== 'online'}
                onClick={() => action({ type: 'start', mode: w.mode })}
              >
                {captain
                  ? is2v2
                    ? 'Begin the Castle Clash'
                    : 'Call the assault'
                  : 'Waiting for the captain…'}
                <ArrowUpRight size={19} />
              </button>
            </section>
          )}

          {playing && w && (
            <>
              <section className="sad-engine" aria-label="Trebuchet state">
                <div className="sad-wind">
                  <span>
                    {displayedEngine.label}
                    {pulling ? ` · ${pulling} winding` : ''}
                  </span>
                  <div className="sad-wind-track">
                    <i
                      style={{
                        width: `${Math.round(displayedEngine.engine.wind * 100)}%`,
                        background: displayedEngine.color,
                      }}
                    />
                  </div>
                  <small>
                    Range {Math.round(rangeFor(displayedEngine.engine.wind))}m
                    <span>
                      {is2v2
                        ? ' · enemy trebuchet 19m · enemy keep 33m'
                        : ' · gate 20m · keep 28m'}
                    </span>
                  </small>
                </div>
                <div className="sad-payload">
                  <span>SLING</span>
                  <strong>
                    {displayedEngine.engine.rider
                      ? (w.players.find(
                          (p) => p.id === displayedEngine.engine.rider,
                        )?.name ?? 'Someone')
                      : displayedEngine.engine.loaded
                        ? AMMO[displayedEngine.engine.loaded].name
                        : 'Empty'}
                  </strong>
                  <small>
                    {displayedEngine.engine.turn === 0
                      ? 'Aimed straight'
                      : `Swung ${displayedEngine.engine.turn > 0 ? (activeEngineTeam === 'blue' ? 'right' : 'left') : activeEngineTeam === 'blue' ? 'left' : 'right'}`}
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

              {/* Only when it has something to say. Standing there being told
                  the banner is still flying is a bar over the playfield for no
                  reason — the banner is right there on the keep. */}
              {(me?.flying ||
                riding ||
                (me && me.stunnedUntil > w.clock) ||
                (!is2v2 && flag && flag.y <= BANNER_DOWN + 1)) && (
                <div className="sad-your-status">
                  {me?.flying ? (
                    'You are airborne. Nothing to do but arrive.'
                  ) : riding ? (
                    'You are in the sling. Someone else has to loose it.'
                  ) : me && me.stunnedUntil > w.clock ? (
                    'Flattened. A crewmate can haul you up with H.'
                  ) : (
                    <>
                      <Flame size={16} /> The banner is going down.
                    </>
                  )}
                </div>
              )}

              <TouchControls
                disabled={disabled}
                move={(v) => scene.current?.move(v)}
                jump={() => action({ type: 'jump' })}
              />

              <nav className="sad-action-dock" aria-label="Siege actions">
                <button
                  className="sad-action wind"
                  disabled={disabled || !atEngine}
                  onPointerDown={() => action({ type: 'wind' })}
                  onPointerUp={() => action({ type: 'stopWind' })}
                  onPointerLeave={() => action({ type: 'stopWind' })}
                  onPointerCancel={() => action({ type: 'stopWind' })}
                >
                  <Crosshair size={21} />
                  <span>
                    Wind<kbd>Hold R</kbd>
                  </span>
                </button>
                {/* Two nudges rather than a rule about which side of the frame
                    you are standing on. */}
                <button
                  className="sad-action nudge"
                  aria-label="Swing the aim left"
                  disabled={disabled || !atEngine}
                  onPointerDown={() => action({ type: 'push', side: 1 })}
                  onPointerUp={() => action({ type: 'stopPush' })}
                  onPointerLeave={() => action({ type: 'stopPush' })}
                  onPointerCancel={() => action({ type: 'stopPush' })}
                >
                  <ChevronLeft size={22} />
                  <span>
                    <kbd>Q</kbd>
                  </span>
                </button>
                <button
                  className="sad-action nudge"
                  aria-label="Swing the aim right"
                  disabled={disabled || !atEngine}
                  onPointerDown={() => action({ type: 'push', side: -1 })}
                  onPointerUp={() => action({ type: 'stopPush' })}
                  onPointerLeave={() => action({ type: 'stopPush' })}
                  onPointerCancel={() => action({ type: 'stopPush' })}
                >
                  <ChevronRight size={22} />
                  <span>
                    <kbd>E</kbd>
                  </span>
                </button>
                <button
                  className="sad-action loose"
                  disabled={
                    disabled ||
                    !atEngine ||
                    riding ||
                    (!displayedEngine.engine.loaded &&
                      !displayedEngine.engine.rider) ||
                    displayedEngine.engine.wind < 0.12
                  }
                  onClick={() => action({ type: 'loose' })}
                >
                  <Swords size={21} />
                  <span>
                    LOOSE<kbd>F</kbd>
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
                    Haul up<kbd>H</kbd>
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
                        : is2v2
                          ? `Walk to the ${playerTeam.toUpperCase()} trebuchet (or infiltrate enemy's).`
                          : 'Walk back to the engine.'}
                  </span>
                )}
              </nav>
              {/* Instructions until the crew has actually thrown something.
                  After that they are a permanent banner of things you know. */}
              {w.volleys === 0 && (
                <span className="sad-movement-hint">
                  {is2v2
                    ? 'WASD to move · hold R to wind, F to loose, Q and E to aim · topple all 3 enemy towers'
                    : 'WASD to move · hold R to wind, F to loose, Q and E to aim · drag the field to look around, scroll to zoom'}
                </span>
              )}
            </>
          )}

          {done && w && (
            <section className="sad-results">
              <Trophy size={34} />
              <span className="sad-kicker">
                {is2v2
                  ? w.winner === playerTeam
                    ? 'VICTORY IN THE CLASH'
                    : w.winner === 'draw'
                      ? 'DRAW AT DAWN'
                      : 'DEFEAT IN THE CLASH'
                  : w.phase === 'won'
                    ? 'THE KEEP IS YOURS'
                    : 'DAWN CAME FIRST'}
              </span>
              <h2>
                {is2v2
                  ? w.winner === playerTeam
                    ? `Team ${playerTeam.toUpperCase()} stands victorious!`
                    : w.winner === 'draw'
                      ? 'Both castles stood their ground.'
                      : `Team ${w.winner ? w.winner.toUpperCase() : 'Enemy'} destroyed your towers.`
                  : w.phase === 'won'
                    ? 'Banner down.'
                    : 'Still standing. Annoyingly.'}
              </h2>
              <p>
                {is2v2 && w.towers ? (
                  <>
                    Red towers toppled:{' '}
                    {w.towers.red.filter((standing) => !standing).length}/3 ·
                    Blue towers toppled:{' '}
                    {w.towers.blue.filter((standing) => !standing).length}/3
                    <br />
                    {w.volleys} volleys fired across the battlefield.
                  </>
                ) : (
                  <>
                    {w.rubble} stones brought down over {w.volleys} volleys.
                    <br />
                    {w.players.reduce((n, p) => n + p.launches, 0)} crewmates
                    were launched on purpose.
                  </>
                )}
              </p>
              <div className="sad-result-list">
                {w.players.map((p) => (
                  <div key={p.id}>
                    <span>
                      {p.name}
                      {is2v2 ? ` (${(p.team ?? 'red').toUpperCase()})` : ''}
                    </span>
                    <b>
                      {p.loaded} loaded · {p.launches} flights
                    </b>
                  </div>
                ))}
              </div>
              <button
                className="sad-primary"
                disabled={!captain || status !== 'online'}
                onClick={() => action({ type: 'restart', mode: w.mode })}
              >
                {captain
                  ? is2v2
                    ? 'Another Clash'
                    : 'Another siege'
                  : 'Waiting for the captain…'}
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
                <strong>Wind it.</strong> Stand at the engine and hold R. Every
                extra pair of hands winds faster. The counterweight sets your
                range: about half a wind reaches the gate, three quarters
                reaches the keep behind it, and a full wind sails clean over.
              </p>
              <p>
                <strong>Loose it.</strong> Press F. That is the whole job — the
                sling restocks itself from the pile, and winding, aiming and
                loosing all work from anywhere beside the frame. Boulders break
                stone. Fire pots set timber alight and burn a course through.
                The beehive clears the battlements so the defenders stop
                throwing clay pots. The cow is the cow.
              </p>
              <p>
                <strong>Aim it.</strong> Q and E swing the frame left and right.
                The gold ring on the ground shows where the current wind will
                land. A clay pot on the frame knocks both the wind and the aim,
                so expect to straighten up under fire.
              </p>
              <p>
                <strong>Ride it.</strong> Press C at the sling to climb in. The
                one thing you cannot do alone is loose a sling you are sitting
                in, so somebody else has to press F. It is a real option and a
                terrible one.
              </p>
              <p>
                <strong>Look around.</strong> Drag the field to swing the camera
                round the siege, scroll or pinch to move in and out, and press V
                to switch between the engine and your own crewmate — which also
                puts the camera back where it started.
              </p>
              <p>
                <strong>Stay upright.</strong> Falling masonry and clay pots
                flatten you; H hauls a crewmate back up. WASD / arrows move and
                Space jumps. On touchscreens use the joystick and the action
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
