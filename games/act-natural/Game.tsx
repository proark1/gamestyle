'use client';
// Full navigation tears down the active WebGL renderer and its input listeners between games.
/* eslint-disable next/no-html-link-for-pages */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  Fence,
  Footprints,
  Gamepad2,
  Hand,
  KeyRound,
  Leaf,
  LoaderCircle,
  LogOut,
  Menu,
  RotateCw,
  Timer,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sound } from './sound';
import GameToolbar from '../../shared/ui/GameToolbar';
import {
  advanceFarm,
  farmAction,
  farmPlayer,
  farmSnapshot,
  freshFarm,
} from './simulation';
import { FarmConnection, requestFarm } from './connection';
import { ModePicker } from './ModePicker';
import { FarmDetails } from './FarmDetails';
import { mobileHud } from './mobile-hud';
import {
  ROUND_MS,
  farmMode,
  type FarmMode,
  type FarmAction,
  type FarmSession,
  type FarmSnapshot,
  type FarmWorld,
} from './types';
import type { FarmHud, FarmScene } from './scene';
import './style.css';
import './mobile.css';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { farmAnalytics, farmPlayState } from './analytics';
const SESSION_KEY = 'act-natural-session-v1';
const clock = (seconds: number) => {
  const whole = Math.ceil(Math.max(0, seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};
const initialHud: FarmHud = {
  hint: 'Wander with the nearby cows. Look innocent.',
  target: '',
  watched: false,
  grazing: false,
};
const tracker = new GameTracker(farmAnalytics);

export default function ActNatural() {
  useGameTracker(tracker);
  const canvas = useRef<HTMLDivElement>(null),
    scene = useRef<FarmScene | null>(null),
    network = useRef<FarmConnection | null>(null),
    local = useRef<FarmWorld | null>(null),
    sessionRef = useRef<FarmSession | null>(null),
    sound = useRef<Sound | null>(null),
    actionRef = useRef<(a: FarmAction) => void>(() => {}),
    lastEvent = useRef(0),
    options = useRef<HTMLDivElement>(null),
    joystickPointer = useRef<number | null>(null);
  const [state, setState] = useState<FarmSnapshot | null>(null),
    [session, setSession] = useState<FarmSession | null>(null),
    [name, setName] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<FarmMode>('computer'),
    [notice, setNotice] = useState('');
  const [modal, setModal] = useState<
      'help' | 'join' | 'invite' | 'leave' | 'plan' | null
    >(null),
    [code, setCode] = useState(''),
    [copied, setCopied] = useState(false),
    [optionsOpen, setOptionsOpen] = useState(false),
    [lobbyBusy, setLobbyBusy] = useState(false),
    [muted, setMuted] = useState(false),
    [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
      'online',
    ),
    [hud, setHud] = useState(initialHud);
  const w = state?.world,
    farmer = state?.you.role === 'farmer',
    me = w?.cows.find((c) => c.id === state?.you.cowId),
    host = state?.host === session?.id,
    practice = session?.code === 'PRACTICE',
    ended = w?.phase === 'farmer-win' || w?.phase === 'cows-win',
    spectating = !!me && (me.captured || me.escaped);
  function accept(next: FarmSnapshot) {
    if (!sessionRef.current) return;
    tracker.observe(farmPlayState(next, sessionRef.current));
    sound.current?.farmSnapshot(next);
    setState(next);
    scene.current?.setSnapshot(next);
    const event = next.world.events.at(-1);
    if (event && event.id > lastEvent.current) {
      lastEvent.current = event.id;
      setNotice(event.text);
    }
  }
  function attach(s: FarmSession, snapshot?: FarmSnapshot) {
    network.current?.stop();
    local.current = null;
    sessionRef.current = s;
    setSession(s);
    setStatus('online');
    lastEvent.current = 0;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {}
    const connection = new FarmConnection(s, accept, setStatus);
    network.current = connection;
    if (snapshot) connection.accept(snapshot);
    void connection.poll();
  }
  useEffect(() => {
    let disposed = false;
    const audio = new Sound();
    sound.current = audio;
    try {
      const prefs = JSON.parse(
        localStorage.getItem('act-natural-prefs-v1') || '{}',
      );
      queueMicrotask(() => {
        if (disposed) return;
        setName(typeof prefs.name === 'string' ? prefs.name : '');
        setMuted(!!prefs.muted);
      });
      audio.enabled = !prefs.muted;
    } catch {}
    const room = new URL(location.href).searchParams.get('room');
    if (room && /^[A-Z2-9]{6}$/i.test(room)) {
      queueMicrotask(() => {
        if (disposed) return;
        setCode(room.toUpperCase());
        setModal('join');
      });
    }
    import('./scene')
      .then(({ FarmScene }) => {
        if (disposed || !canvas.current) return;
        try {
          scene.current = new FarmScene(canvas.current, {
            input: (i) => {
              if (network.current) network.current.input = i;
              const p = local.current?.players[0];
              if (p) {
                p.input = i;
                p.seen = Date.now();
              }
            },
            action: (a) => actionRef.current(a),
            hud: (h) =>
              setHud((old) =>
                JSON.stringify(old) === JSON.stringify(h) ? old : h,
              ),
          });
          setReady(true);
          if (!room)
            try {
              const s = JSON.parse(
                sessionStorage.getItem(SESSION_KEY) || 'null',
              );
              if (s?.code && s?.id && s?.token) attach(s);
            } catch {}
        } catch {
          setNotice(
            'The 3D pasture could not start. Enable hardware acceleration and reload.',
          );
        }
      })
      .catch(() =>
        setNotice('The game could not load. Reload the page to try again.'),
      );
    const timer = setInterval(() => {
      if (!local.current || !sessionRef.current) return;
      const now = Date.now();
      advanceFarm(local.current, now);
      accept(
        farmSnapshot(
          local.current,
          'PRACTICE',
          sessionRef.current.id,
          sessionRef.current.id,
          now,
        ),
      );
    }, 70);
    return () => {
      disposed = true;
      clearInterval(timer);
      network.current?.stop();
      scene.current?.dispose();
      audio.dispose();
    };
  }, []);
  useEffect(() => {
    if (sound.current) sound.current.enabled = !muted;
    try {
      localStorage.setItem(
        'act-natural-prefs-v1',
        JSON.stringify({ name, muted }),
      );
    } catch {}
  }, [name, muted]);
  useEffect(() => {
    scene.current?.setPaused(
      !!modal || optionsOpen || status !== 'online' || !!ended,
    );
  }, [modal, optionsOpen, status, ended]);
  useEffect(() => {
    if (modal) options.current?.hidePopover();
  }, [modal]);
  useEffect(() => {
    if (!optionsOpen) return;
    const mobile = matchMedia('(max-width: 900px), (pointer: coarse)');
    const closeOnDesktop = () => {
      if (!mobile.matches) options.current?.hidePopover();
    };
    mobile.addEventListener('change', closeOnDesktop);
    return () => mobile.removeEventListener('change', closeOnDesktop);
  }, [optionsOpen]);
  useEffect(() => {
    if (!notice || w?.phase !== 'playing' || modal) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice, w?.phase, modal]);
  async function action(a: FarmAction) {
    tracker.action(a.type);
    try {
      setNotice('');
      if (local.current && sessionRef.current) {
        farmAction(
          local.current,
          sessionRef.current.id,
          a,
          sessionRef.current.id,
        );
        accept(
          farmSnapshot(
            local.current,
            'PRACTICE',
            sessionRef.current.id,
            sessionRef.current.id,
            Date.now(),
          ),
        );
      } else await network.current?.action(a);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Try that action again.');
    }
  }
  async function lobbyAction(a: FarmAction) {
    if (lobbyBusy) return;
    setLobbyBusy(true);
    try {
      await action(a);
    } finally {
      setLobbyBusy(false);
    }
  }
  useEffect(() => {
    actionRef.current = (a) => void action(a);
  });
  async function enter(joining: boolean) {
    if (!ready || busy) return;
    setBusy(true);
    setNotice('');
    sound.current?.unlock();
    try {
      const r = await requestFarm(
        joining
          ? { op: 'join', name, code: code.trim().toUpperCase() }
          : { op: 'create', name, mode },
      );
      if (r.session && r.snapshot) {
        attach(r.session, r.snapshot);
        setModal(null);
      }
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : 'Could not open the farm. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  function solo() {
    if (!ready) return;
    sound.current?.unlock();
    network.current?.stop();
    network.current = null;
    lastEvent.current = 0;
    const now = Date.now(),
      id = 'solo-cow',
      s = { code: 'PRACTICE', id, token: '' };
    const farm = freshFarm(
      now,
      crypto.getRandomValues(new Uint32Array(1))[0],
      true,
    );
    farm.players = [farmPlayer(id, name.trim() || 'Farmhand', now)];
    farmAction(farm, id, { type: 'start' }, id);
    local.current = farm;
    sessionRef.current = s;
    setSession(s);
    setStatus('online');
    setNotice('');
    accept(farmSnapshot(farm, s.code, id, id, now));
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }
  function leave() {
    tracker.observe({ stage: 'menu' });
    void network.current?.leave();
    network.current = null;
    local.current = null;
    sessionRef.current = null;
    setSession(null);
    setState(null);
    setModal(null);
    setNotice('');
    setStatus('online');
    sound.current?.menu();
    scene.current?.reset();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }
  async function copy() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/act-natural?room=${session.code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice(`Share this farm code: ${session.code}`);
    }
  }
  const seconds = w?.started
    ? Math.max(0, (ROUND_MS - w.clock + w.started) / 1000)
    : 180;
  const caught = w?.players.filter((p) => p.status === 'caught').length ?? 0,
    escaped = w?.players.filter((p) => p.status === 'escaped').length ?? 0;
  const touchHud = state ? mobileHud(state, hud) : null;
  const inputBlocked =
    spectating || status !== 'online' || !!modal || optionsOpen;
  return (
    <main
      className={`farm-shell ${session ? 'farm-active' : ''} ${w && farmMode(w) === 'human' && w.phase !== 'lobby' ? 'farm-night' : ''} ${w?.phase === 'lobby' ? 'farm-in-lobby' : ''} ${spectating ? 'farm-spectating' : ''}`}
    >
      <div className="farm-canvas" ref={canvas} />
      <header className="farm-topbar">
        <a
          className="farm-wordmark"
          href="/act-natural"
          onClick={(e) => {
            if (session) {
              e.preventDefault();
              setModal('leave');
            }
          }}
        >
          <Leaf size={22} /> BLEND BUSINESS<span>.</span>
        </a>
        {session && w && (
          <div className="farm-mobile-heading">
            <span>
              {farmer ? <Eye size={17} /> : <Leaf size={17} />}
              {w.phase === 'lobby'
                ? 'Your farm'
                : farmer
                  ? 'Farmer'
                  : spectating
                    ? 'Watching'
                    : 'Cow'}
            </span>
            {w.phase === 'lobby' ? (
              <strong>{w.players.length}/4</strong>
            ) : (
              <strong className={seconds < 30 ? 'urgent' : ''}>
                {clock(seconds)}
              </strong>
            )}
          </div>
        )}
        {session && w?.phase === 'playing' && (
          <button
            className="farm-mobile-button farm-plan-button"
            onClick={() => setModal('plan')}
            aria-label="Open game plan and players"
          >
            <Fence size={18} />
            <span>Plan</span>
          </button>
        )}
        <button
          className="farm-mobile-button farm-options-trigger"
          popoverTarget="farm-options"
          aria-label="Open game menu"
          aria-expanded={optionsOpen}
        >
          <Menu size={21} />
        </button>
        <div
          className="farm-toolbar-options"
          id="farm-options"
          ref={options}
          popover="auto"
          onToggle={(event) => setOptionsOpen(event.newState === 'open')}
        >
          <div className="farm-options-heading">
            <strong>Farm menu</strong>
            <button
              className="farm-mobile-button"
              popoverTarget="farm-options"
              popoverTargetAction="hide"
              aria-label="Close game menu"
            >
              <X size={19} />
            </button>
          </div>
          <GameToolbar
            voice={
              session && !practice && state
                ? {
                    session: { ...session, game: 'act-natural' },
                    snapshot: {
                      players: state.world.players.filter(
                        (player) => !player.bot,
                      ),
                      nearby: false,
                    },
                    onSpeaking: (active) => sound.current?.duck(active),
                  }
                : undefined
            }
            voiceHint={
              practice
                ? 'Voice is available in multiplayer. Create or join a room to talk with friends.'
                : undefined
            }
            muted={muted}
            onToggleSound={() => {
              sound.current?.unlock();
              setMuted(!muted);
            }}
            onHelp={() => setModal('help')}
            onLeave={session ? () => setModal('leave') : undefined}
            workshop="/act-natural/admin"
          />
          {session && !practice && (
            <button
              className="farm-options-invite"
              onClick={() => setModal('invite')}
            >
              <Users size={18} />
              <span>
                Invite friends <b>{session.code}</b>
              </span>
            </button>
          )}
        </div>
      </header>
      {session && w?.phase === 'playing' && touchHud && (
        <div
          className={`farm-mobile-status ${touchHud.warning ? 'warning' : ''}`}
        >
          <span>
            {touchHud.warning ? <Eye size={14} /> : <Leaf size={14} />}
            {touchHud.status}
          </span>
          {!farmer && !spectating && (
            <span>
              <KeyRound size={14} />
              {w.keysDelivered}/2 <Zap size={14} />
              {w.powerOff ? 'Off' : 'On'}
            </span>
          )}
        </div>
      )}
      {!session && (
        <>
          <section className="farm-menu">
            <div className="eyebrow">
              <span className="tiny-line" /> A VERY SUSPICIOUS PARTY GAME
            </div>
            <h1>
              ACT
              <br />
              <span>NATURAL.</span>
            </h1>
            <p className="farm-tagline">
              Three of these cows
              <br />
              are your friends.
            </p>
            <p className="farm-intro">
              Blend in. Steal the keys. Make a break for it.
              <br />
              And whatever you do, act like a cow.
            </p>
            <div className="setup-card">
              <label htmlFor="farm-name">YOUR NAME</label>
              <input
                id="farm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                placeholder="Perfectly ordinary farmhand"
              />
              <ModePicker value={mode} onChange={setMode} disabled={busy} />
              <button
                className="primary-button"
                disabled={!ready || busy}
                onClick={() => void enter(false)}
              >
                {busy
                  ? 'Opening the farm…'
                  : ready
                    ? 'Create a farm'
                    : 'Loading the pasture…'}
                {!ready || busy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
              <button
                className="secondary-button"
                disabled={!ready || busy}
                onClick={() => setModal('join')}
              >
                Join with a room code <Users size={17} />
              </button>
              <button
                className="practice-link"
                disabled={!ready || busy}
                onClick={solo}
              >
                Solo practice · outsmart the computer <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="farm-menu-meta">
              <span>
                <Users size={14} /> 1–4 players · private screens
              </span>
              <span>
                <Timer size={14} /> 3-minute rounds
              </span>
            </div>
          </section>
          <aside className="farm-caption">
            <span className="map-badge">NOTHING TO SEE HERE</span>
            <span>That ladder? Probably always been there.</span>
          </aside>
        </>
      )}
      {session && w && (
        <>
          <div className="farm-round-strip">
            <span className={`farm-role ${farmer ? 'role-farmer' : ''}`}>
              {farmer ? <Eye size={17} /> : <Leaf size={17} />}
              <b>
                {w.phase === 'lobby'
                  ? 'GATHER YOUR HERD'
                  : farmer
                    ? 'YOU ARE THE FARMER'
                    : 'YOU ARE A FAKE COW'}
              </b>
            </span>
            <div className={`farm-timer ${seconds < 30 ? 'urgent' : ''}`}>
              <Timer size={16} />
              <strong>{clock(seconds)}</strong>
              <small>ROUND {Math.max(1, w.round)}</small>
            </div>
            <button
              className="farm-room"
              disabled={practice}
              onClick={() => setModal('invite')}
            >
              <span>{practice ? 'SOLO PRACTICE' : session.code}</span>
              {!practice && <Copy size={14} />}
            </button>
          </div>
          <div className="farm-desktop-details">
            {state && (
              <FarmDetails
                snapshot={state}
                watched={hud.watched}
                spectating={spectating}
              />
            )}
          </div>
          {w.phase === 'lobby' && (
            <section className="farm-lobby">
              <div>
                <span className="farm-small-label">
                  {w.players.length}/4 FARMHANDS READY
                </span>
                <h3>
                  {w.players.length < 2 && farmMode(w) === 'human'
                    ? 'Friends or clever impostors?'
                    : 'Everybody looks innocent. For now.'}
                </h3>
                <div
                  className={`farm-lobby-players ${farmMode(w) === 'human' ? 'farm-npc-roster' : ''}`}
                  aria-label="Players in this farm"
                >
                  {w.players.map((player) => (
                    <span key={player.id}>
                      {player.name}
                      {player.id === session.id ? ' (you)' : ''}
                      {player.bot && <small>NPC</small>}
                      {player.bot && host && (
                        <button
                          aria-label={`Remove ${player.name}`}
                          disabled={lobbyBusy || status !== 'online'}
                          onClick={() =>
                            void lobbyAction({
                              type: 'remove-bot',
                              target: player.id,
                            })
                          }
                        >
                          <X size={14} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <p>
                  {farmMode(w) === 'computer'
                    ? 'Everyone is a cow. Escape together while the computer patrols.'
                    : 'One human hunts; the cows hide. Invite friends or fill empty cow slots with NPCs. Farmer duty rotates between humans.'}
                </p>
                <ModePicker
                  value={farmMode(w)}
                  onChange={(mode) => void lobbyAction({ type: 'mode', mode })}
                  disabled={!host || lobbyBusy || status !== 'online'}
                />
                {farmMode(w) === 'human' && host && !session.peer && (
                  <div className="farm-npc-controls">
                    <div>
                      <strong>Fill the cow slots</strong>
                      <small>
                        {w.players.length < 4
                          ? `${4 - w.players.length} empty · friends can replace NPCs before the round`
                          : 'All slots filled · ready to play'}
                      </small>
                    </div>
                    <button
                      disabled={
                        lobbyBusy ||
                        status !== 'online' ||
                        w.players.length >= 4
                      }
                      onClick={() => void lobbyAction({ type: 'add-bot' })}
                    >
                      Add one NPC
                    </button>
                    <button
                      disabled={
                        lobbyBusy ||
                        status !== 'online' ||
                        w.players.length >= 4
                      }
                      onClick={() => void lobbyAction({ type: 'fill-bots' })}
                    >
                      Fill all empty slots
                    </button>
                  </div>
                )}
              </div>
              <div>
                <button
                  className="secondary-button"
                  onClick={() => setModal('invite')}
                >
                  <Users size={17} /> Invite friends
                </button>
                {host ? (
                  <button
                    className="primary-button"
                    disabled={
                      (farmMode(w) === 'human' && w.players.length < 2) ||
                      lobbyBusy ||
                      status !== 'online'
                    }
                    onClick={() => void lobbyAction({ type: 'start' })}
                  >
                    Start the round <ArrowRight size={17} />
                  </button>
                ) : (
                  <span className="waiting-label">Waiting for the host…</span>
                )}
              </div>
            </section>
          )}
          {w.phase === 'playing' && (
            <div className="farm-bottom">
              <div
                className={`farm-hint ${notice || !touchHud?.hint ? 'farm-hint-idle' : ''}`}
                aria-live="polite"
              >
                {spectating ? <Eye size={16} /> : <span className="live-dot" />}
                <span className="farm-desktop-hint">{hud.hint}</span>
                <span className="farm-mobile-hint">{touchHud?.hint}</span>
              </div>
              {!!me?.task && (
                <progress
                  className="sabotage-progress"
                  aria-label="Cutting fence power"
                  value={me.task}
                  max={1}
                />
              )}
              <div className="tool-dock">
                <button
                  className="farm-interact-button"
                  disabled={inputBlocked || !touchHud?.available}
                  onClick={() => scene.current?.interact()}
                >
                  {farmer ? <Eye size={20} /> : <Hand size={20} />}
                  <span className="farm-desktop-hint">
                    {farmer ? 'Inspect cow' : 'Interact'}
                  </span>
                  <span className="farm-mobile-hint">{touchHud?.label}</span>
                  <kbd>E</kbd>
                </button>
                {!farmer && (
                  <>
                    <button
                      disabled={inputBlocked}
                      className={hud.grazing ? 'active' : ''}
                      aria-pressed={hud.grazing}
                      onClick={() => scene.current?.toggleGraze()}
                    >
                      <Leaf size={20} />
                      <span className="farm-desktop-hint">
                        {hud.grazing ? 'Stop grazing' : 'Graze'}
                      </span>
                      <span className="farm-mobile-hint">
                        {hud.grazing ? 'Stand up' : 'Graze'}
                      </span>
                      <kbd>SPACE</kbd>
                    </button>
                    <button
                      className={`farm-drop-button ${me?.carrying ? 'has-item' : ''}`}
                      disabled={inputBlocked || !me?.carrying}
                      onClick={() => void action({ type: 'drop' })}
                    >
                      <ArrowDownIcon />
                      <span>Drop</span>
                      <kbd>Q</kbd>
                    </button>
                  </>
                )}
              </div>
              <div className="farm-controls-note">
                WASD / arrows to move ·{' '}
                {farmer ? 'Click to select a cow' : 'Space toggles grazing'} ·
                Scroll to zoom
              </div>
            </div>
          )}
          {w.phase === 'playing' && !spectating && (
            <div className="farm-touch">
              <fieldset
                className="joystick"
                disabled={inputBlocked}
                aria-label="Move around the pasture"
                onPointerDown={(e) => {
                  if (
                    inputBlocked ||
                    joystickPointer.current !== null ||
                    (e.pointerType === 'mouse' && e.button !== 0)
                  )
                    return;
                  e.preventDefault();
                  joystickPointer.current = e.pointerId;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  if (scene.current)
                    scene.current.touch = moveThumb(
                      e.currentTarget,
                      e.clientX,
                      e.clientY,
                    );
                }}
                onPointerMove={(e) => {
                  if (
                    inputBlocked ||
                    joystickPointer.current !== e.pointerId ||
                    !e.currentTarget.hasPointerCapture(e.pointerId)
                  )
                    return;
                  if (scene.current)
                    scene.current.touch = moveThumb(
                      e.currentTarget,
                      e.clientX,
                      e.clientY,
                    );
                }}
                onPointerUp={(e) => {
                  if (joystickPointer.current !== e.pointerId) return;
                  if (scene.current) scene.current.touch = { x: 0, z: 0 };
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={(e) => {
                  if (joystickPointer.current !== e.pointerId) return;
                  if (scene.current) scene.current.touch = { x: 0, z: 0 };
                }}
                onLostPointerCapture={(e) => {
                  if (joystickPointer.current !== e.pointerId) return;
                  joystickPointer.current = null;
                  e.currentTarget.style.removeProperty('--stick-x');
                  e.currentTarget.style.removeProperty('--stick-y');
                  if (scene.current) scene.current.touch = { x: 0, z: 0 };
                }}
              >
                <span>
                  <Footprints size={23} />
                </span>
              </fieldset>
            </div>
          )}
          {status !== 'online' && (
            <div className="farm-connection">
              <LoaderCircle className="spin" size={20} />
              <strong>
                {status === 'expired'
                  ? 'Your farm pass expired.'
                  : 'Reconnecting to the farm…'}
              </strong>
              <span>
                {status === 'expired'
                  ? 'Return to the menu and rejoin with the room code.'
                  : 'The round keeps running while your connection returns.'}
              </span>
              <button className="secondary-button" onClick={leave}>
                Return to menu
              </button>
            </div>
          )}
        </>
      )}
      {notice && !modal && (
        <output className="farm-notice">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </output>
      )}
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="game-dialog farm-dialog">
          {modal === 'plan' && state && (
            <>
              <DialogTitle>
                {farmer ? 'Watch the herd.' : 'Your escape plan.'}
              </DialogTitle>
              <DialogDescription>
                The round keeps running. Close this to keep moving.
              </DialogDescription>
              <div className="farm-plan">
                <FarmDetails
                  snapshot={state}
                  watched={hud.watched}
                  spectating={spectating}
                />
              </div>
              <button className="primary-button" onClick={() => setModal(null)}>
                Back to the pasture <ArrowRight size={17} />
              </button>
            </>
          )}
          {modal === 'help' && (
            <>
              <div className="dialog-emblem">
                <Leaf size={30} />
              </div>
              <DialogTitle>A good cow takes its time.</DialogTitle>
              <DialogDescription>
                Escape the computer together, or put one friend in charge of
                catching the hidden cows. Each player needs a private screen.
              </DialogDescription>
              <div className="help-steps">
                <div>
                  <Leaf />
                  <p>
                    <strong>Fake cows: blend in, then break out.</strong>
                    <span className="farm-desktop-hint">
                      WASD or arrows move. Space toggles grazing.{' '}
                    </span>
                    <span className="farm-mobile-hint">
                      Use the left joystick to move and the right buttons to
                      graze or interact.{' '}
                    </span>
                    Cows wander, pause, and eat independently, so mix in with
                    nearby animals. Interact picks up a key, unlocks the south
                    gate, or cuts power at the west switch. Stay still for four
                    seconds to finish cutting power. The live fence buzzes as
                    you approach. Touch it and you’ll be shocked, briefly
                    stunned, and exposed for five seconds. Player farmer is a
                    night hunt: the flashlight follows the farmer’s facing, and
                    hay blocks its beam. Keys stay concealed when carried.
                    Shocked cows glow briefly even in the dark. Keep your screen
                    private.
                  </p>
                </div>
                <div>
                  <Fence />
                  <p>
                    <strong>A very conspicuous shortcut.</strong>Carry the
                    ladder to the east fence and choose Place ladder. It
                    bypasses the keys, but the power must still be off. Interact
                    at an open exit escapes; Drop puts down what you are
                    carrying.
                  </p>
                </div>
                <div>
                  <Eye />
                  <p>
                    <strong>Farmer: five inspections. Make them count.</strong>
                    Select a cow, walk within three metres, and choose Inspect.
                    Every inspection costs an attempt. The light on the ground
                    shows where you can see. Cows behind the hay or outside your
                    view stay hidden. Watch for interactions and listen for
                    nearby rattles. Shocked cows are exposed for five seconds.
                  </p>
                </div>
                <div>
                  <Timer />
                  <p>
                    <strong>Three minutes. Then swap roles.</strong>The cows win
                    if at least one escapes. The farmer wins if none escape by
                    the deadline, or all are caught. Caught and escaped players
                    spectate. Player farmer rotates the hunter next round;
                    Escape the computer keeps everyone on the cow team.
                  </p>
                </div>
              </div>
              <button className="primary-button" onClick={() => setModal(null)}>
                Perfectly normal. Got it. <Check size={17} />
              </button>
            </>
          )}
          {modal === 'join' && (
            <>
              <DialogTitle>Join the herd.</DialogTitle>
              <DialogDescription>
                Ask your friends for their six-character Blend Business room
                code.
              </DialogDescription>
              <label className="field-label" htmlFor="join-farm-name">
                Your name
              </label>
              <input
                className="dialog-input"
                id="join-farm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                placeholder="Farmhand"
              />
              <label className="field-label" htmlFor="farm-code">
                Farm code
              </label>
              <input
                className="dialog-input code-input"
                id="farm-code"
                value={code}
                maxLength={6}
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && code.length === 6) void enter(true);
                }}
                placeholder="ABCDEF"
                autoComplete="off"
              />
              {notice && (
                <p className="dialog-error" role="alert">
                  {notice}
                </p>
              )}
              <button
                className="primary-button"
                disabled={!ready || busy || code.length !== 6}
                onClick={() => void enter(true)}
              >
                {busy ? 'Joining…' : 'Join farm'}
                <ArrowRight size={17} />
              </button>
            </>
          )}
          {modal === 'invite' && (
            <>
              <DialogTitle>Bring your suspicious friends.</DialogTitle>
              <DialogDescription>
                Share this code or copy the invite link. Up to four players can
                join before the round starts.
              </DialogDescription>
              <div className="invite-code">{session?.code}</div>
              {notice && <p className="dialog-error">{notice}</p>}
              <button className="primary-button" onClick={() => void copy()}>
                {copied ? 'Link copied' : 'Copy invite link'}
                {copied ? <Check size={17} /> : <Copy size={17} />}
              </button>
            </>
          )}
          {modal === 'leave' && (
            <>
              <DialogTitle>Leave the farm?</DialogTitle>
              <DialogDescription>
                Your friends can keep playing. If you are the farmer, they’ll
                return to the lobby to choose the next farmer.
              </DialogDescription>
              <button className="primary-button" onClick={leave}>
                Back to Blend Business <ArrowRight size={17} />
              </button>
              <a className="secondary-button" href="/" onClick={leave}>
                All games <Gamepad2 size={17} />
              </a>
              <button className="practice-link" onClick={() => setModal(null)}>
                Keep playing
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!ended && !modal} onOpenChange={() => {}}>
        <DialogContent
          className="game-dialog result-dialog farm-result"
          showCloseButton={false}
        >
          <div className="dialog-emblem">
            <Trophy size={30} />
          </div>
          <DialogTitle>
            {w?.phase === 'cows-win'
              ? 'A highly suspicious escape.'
              : 'The farmer had a hunch.'}
          </DialogTitle>
          <DialogDescription>
            {w?.phase === 'cows-win'
              ? 'The cows win! At least one friend made it to freedom.'
              : 'The farmer wins. The pasture kept its secrets—and its cows.'}
          </DialogDescription>
          <div className="result-stats">
            <span>
              <strong>{escaped}</strong>ESCAPED
            </span>
            <span>
              <strong>{caught}</strong>CAUGHT
            </span>
            <span>
              <strong>{w?.inspections}</strong>CHECKS LEFT
            </span>
          </div>
          {host ? (
            <button
              className="primary-button"
              onClick={() => void action({ type: 'restart' })}
            >
              {practice
                ? 'Try another escape'
                : w && farmMode(w) === 'computer'
                  ? 'Next round · escape together'
                  : w && w.players.filter((player) => !player.bot).length === 1
                    ? 'Next round · hunt again'
                    : 'Next round · rotate farmer'}
              <RotateCw size={17} />
            </button>
          ) : (
            <p className="help-note">
              Waiting for the host to start the next round.
            </p>
          )}
          <button className="secondary-button" onClick={leave}>
            Return to menu <ArrowLeft size={17} />
          </button>
          {notice && <output className="help-note">{notice}</output>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
function ArrowDownIcon() {
  return <LogOut size={19} style={{ transform: 'rotate(90deg)' }} />;
}

function moveThumb(
  control: HTMLFieldSetElement,
  clientX: number,
  clientY: number,
) {
  const rect = control.getBoundingClientRect();
  const x = clientX - rect.left - rect.width / 2;
  const y = clientY - rect.top - rect.height / 2;
  const scale = Math.min(1, 24 / Math.max(1, Math.hypot(x, y)));
  control.style.setProperty('--stick-x', `${x * scale}px`);
  control.style.setProperty('--stick-y', `${y * scale}px`);
  return { x: x / 35, z: y / 35 };
}
