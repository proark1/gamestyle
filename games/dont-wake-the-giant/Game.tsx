'use client';
/* eslint-disable next/no-html-link-for-pages */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Coins,
  Copy,
  DoorOpen,
  Feather,
  Hand,
  LoaderCircle,
  Moon,
  RotateCw,
  ShieldCheck,
  Sunrise,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { TouchControls } from '../../shared/input/TouchControls';
import GameToolbar from '../../shared/ui/GameToolbar';
import { COLORS } from '../../shared/rendering/palette';
import { GiantConnection, requestGiant } from './connection';
import {
  advanceGiant,
  freshGiant,
  giantAction,
  giantHint,
  giantPlayer,
  giantSnapshot,
  heldItem,
} from './simulation';
import { atDoor } from './level';
import { handoffTarget } from './handoff';
import {
  ITEM_NAMES,
  type GiantAction,
  type GiantSession,
  type GiantSnapshot,
  type GiantWorld,
} from './types';
import type { GiantScene } from './scene';
import { GiantSound } from './sound';
import { escapeWarning, GIANT_SHOUT, untilGiantWakes } from './urgency';
import { wakePose } from './giant-motion';
import './style.css';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { giantAnalytics, giantPlayState } from './analytics';

const SESSION_KEY = 'dont-wake-the-giant-session-v1';
const duration = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const tracker = new GameTracker(giantAnalytics);

export default function GiantGame() {
  useGameTracker(tracker);
  const canvas = useRef<HTMLDivElement>(null),
    scene = useRef<GiantScene | null>(null),
    connection = useRef<GiantConnection | null>(null);
  const local = useRef<GiantWorld | null>(null),
    sessionRef = useRef<GiantSession | null>(null),
    latest = useRef<GiantSnapshot | null>(null);
  const actionRef = useRef<(a: GiantAction) => void>(() => {}),
    sound = useRef<GiantSound | null>(null);
  const [snapshot, setSnapshot] = useState<GiantSnapshot | null>(null),
    [session, setSession] = useState<GiantSession | null>(null);
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(''),
    [muted, setMuted] = useState(false),
    [copied, setCopied] = useState(false),
    [creep, setCreep] = useState(false);
  const [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
    'online',
  );
  const [modal, setModal] = useState<
    'help' | 'join' | 'invite' | 'leave' | null
  >(null);
  const w = snapshot?.world,
    me = w?.players.find((p) => p.id === session?.id),
    practice = session?.code === 'PRACTICE',
    host = snapshot?.host === session?.id;
  const active = w?.phase === 'playing' || w?.phase === 'escape',
    done = w?.phase === 'ended',
    item = w && session ? heldItem(w, session.id) : undefined;
  const inRoom = !!session;
  function accept(next: GiantSnapshot) {
    if (!sessionRef.current) return;
    tracker.observe(giantPlayState(next, sessionRef.current));
    latest.current = next;
    setSnapshot(next);
    scene.current?.setSnapshot(next);
    sound.current?.update(next, scene.current?.yaw);
  }
  function attach(s: GiantSession, next?: GiantSnapshot) {
    connection.current?.stop();
    local.current = null;
    sessionRef.current = s;
    setSession(s);
    setStatus('online');
    latest.current = null;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {}
    const c = new GiantConnection(s, accept, setStatus);
    connection.current = c;
    if (next) c.accept(next);
    void c.poll();
  }
  useEffect(() => {
    let disposed = false;
    const audio = new GiantSound();
    sound.current = audio;
    try {
      const prefs = JSON.parse(localStorage.getItem('giant-prefs-v1') || '{}');
      audio.enabled = !prefs.muted;
      queueMicrotask(() => {
        if (!disposed) {
          setName(typeof prefs.name === 'string' ? prefs.name : '');
          setMuted(!!prefs.muted);
        }
      });
    } catch {}
    const invite = new URL(location.href).searchParams.get('room');
    if (invite && /^[A-Z2-9]{6}$/i.test(invite))
      queueMicrotask(() => {
        if (!disposed) {
          setCode(invite.toUpperCase());
          setModal('join');
        }
      });
    import('./scene')
      .then(({ GiantScene }) => {
        if (disposed || !canvas.current) return;
        try {
          scene.current = new GiantScene(canvas.current, {
            input: (input) => {
              if (connection.current)
                connection.current.input = {
                  ...input,
                  jump: input.jump || connection.current.input.jump,
                };
              const p = local.current?.players[0];
              if (p) {
                p.input = { ...input, jump: input.jump || p.input.jump };
                p.seen = Date.now();
              }
            },
            action: (a) => actionRef.current(a),
          });
          setReady(true);
          if (!invite)
            try {
              const saved = JSON.parse(
                sessionStorage.getItem(SESSION_KEY) || 'null',
              );
              if (saved?.code && saved?.id && saved?.token) attach(saved);
            } catch {}
        } catch {
          setNotice(
            'The cottage could not load. Enable hardware acceleration and reload to play.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice(
            'The cottage could not load. Reload the page to try again.',
          );
      });
    const timer = setInterval(() => {
      const w = local.current,
        s = sessionRef.current;
      if (!w || !s) return;
      advanceGiant(w, Date.now());
      accept(structuredClone(giantSnapshot(w, s.code, s.id, s.id, Date.now())));
    }, 33);
    return () => {
      disposed = true;
      clearInterval(timer);
      connection.current?.stop();
      scene.current?.dispose();
      scene.current = null;
      audio.dispose();
    };
  }, []);
  useEffect(() => {
    if (sound.current) sound.current.enabled = !muted;
    try {
      localStorage.setItem('giant-prefs-v1', JSON.stringify({ name, muted }));
    } catch {}
  }, [name, muted]);
  useEffect(() => {
    scene.current?.setPaused(
      !!modal ||
        status !== 'online' ||
        !!done ||
        !active ||
        !!me?.escaped ||
        !!me?.caught,
    );
  }, [modal, status, done, active, me?.escaped, me?.caught, ready]);
  useEffect(() => {
    if (scene.current) scene.current.creep = creep;
  }, [creep, ready]);
  useEffect(() => {
    if (!inRoom) return;
    document.documentElement.classList.add('giant-page-playing');
    return () =>
      document.documentElement.classList.remove('giant-page-playing');
  }, [inRoom]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  async function action(a: GiantAction) {
    if (busy) return;
    tracker.action(a.type);
    try {
      setNotice('');
      sound.current?.unlock();
      if (local.current && sessionRef.current) {
        giantAction(
          local.current,
          sessionRef.current.id,
          a,
          sessionRef.current.id,
        );
        accept(
          structuredClone(
            giantSnapshot(
              local.current,
              'PRACTICE',
              sessionRef.current.id,
              sessionRef.current.id,
              Date.now(),
            ),
          ),
        );
      } else await connection.current?.action(a);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Try that action again.',
      );
    }
  }
  useEffect(() => {
    actionRef.current = (a) => void action(a);
  });
  function solo() {
    connection.current?.stop();
    connection.current = null;
    const now = Date.now(),
      id = crypto.randomUUID(),
      s = { code: 'PRACTICE', id, token: '' },
      world = freshGiant(now);
    world.players = [giantPlayer(id, name.trim() || 'Tiny thief', 0, now)];
    giantAction(world, id, { type: 'start' }, id);
    local.current = world;
    sessionRef.current = s;
    setSession(s);
    setModal(null);
    setStatus('online');
    setNotice('');
    sound.current?.unlock();
    accept(structuredClone(giantSnapshot(world, s.code, id, id, now)));
  }
  async function enter(op: 'create' | 'join') {
    if (busy) return;
    setBusy(true);
    setNotice('');
    sound.current?.unlock();
    try {
      const reply = await requestGiant({
        op,
        name: name.trim() || 'Tiny thief',
        ...(op === 'join' ? { code: code.toUpperCase() } : {}),
      });
      if (!reply.session || !reply.snapshot)
        throw new Error('The cottage did not open. Try again.');
      attach(reply.session, reply.snapshot);
      setModal(op === 'create' ? 'invite' : null);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not reach the cottage.',
      );
    } finally {
      setBusy(false);
    }
  }
  function leave() {
    const previous = connection.current;
    tracker.observe({ stage: 'menu' });
    connection.current = null;
    void previous?.leave();
    local.current = null;
    sessionRef.current = null;
    latest.current = null;
    setSession(null);
    setSnapshot(null);
    setModal(null);
    setStatus('online');
    setNotice('');
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    scene.current?.menu();
    sound.current?.menu();
  }
  async function copy() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/dont-wake-the-giant?room=${session.code}`,
      );
      setCopied(true);
    } catch {
      setNotice('Copy the six-character room code shown here.');
    }
  }
  const escaped = w?.players.filter((p) => p.escaped).length ?? 0;
  const receiver = w && me ? handoffTarget(w, me) : undefined;
  const lastNoise = w?.events.findLast(
    (e) => e.kind === 'noise' && e.strength >= 3 && w.clock - e.at < 3500,
  );
  const lastEvent = w?.events
    .filter((e) => !e.text.includes('footsteps') && e.kind !== 'noise')
    .at(-1);
  return (
    <main
      className={`giant-game ${session ? 'giant-in-game' : ''} ${w?.phase === 'escape' ? 'giant-escape' : ''}`}
    >
      <div className="giant-canvas" ref={canvas} />
      <header className="giant-topbar">
        <a href="/" className="giant-brand" aria-label="Back to all games">
          <ArrowLeft size={17} />
          <span>
            JUMBLEYARD<span className="giant-brand-dot">.</span>
          </span>
        </a>
        <span className="giant-game-name">
          <Moon size={17} /> Tiptoe Thieves
        </span>
        <GameToolbar
          workshop="/dont-wake-the-giant/admin"
          voice={
            session && !practice && w
              ? {
                  session: { ...session, game: 'dont-wake-the-giant' },
                  snapshot: { players: w.players, nearby: false },
                  onSpeaking: (active) => sound.current?.duck(active),
                }
              : undefined
          }
          voiceHint={
            practice
              ? 'Voice is available in multiplayer. Create or join a crew to talk with friends.'
              : undefined
          }
          muted={muted}
          onToggleSound={() => {
            sound.current?.unlock();
            setMuted(!muted);
          }}
          onHelp={() => setModal('help')}
          onLeave={session ? () => setModal('leave') : undefined}
        />
      </header>
      {!session && (
        <section className="giant-start">
          <div className="giant-eyebrow">
            <span /> A VERY LITTLE HEIST
          </div>
          <h1>
            Don’t Wake
            <br />
            <em>
              the Giant<span>.</span>
            </em>
          </h1>
          <p className="giant-tagline">
            Four tiny thieves.
            <br />
            One enormous nap.
          </p>
          <p className="giant-intro">
            Climb a breathing giant. Pocket the gold.
            <br />
            Try to leave before he notices.
          </p>
          <div className="giant-setup">
            <label htmlFor="giant-name">Your thief’s name</label>
            <input
              id="giant-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 18))}
              placeholder="Tiny thief"
              maxLength={18}
              autoComplete="off"
            />
            <button
              className="giant-primary"
              disabled={!ready || busy}
              onClick={() => void enter('create')}
            >
              {busy ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Users size={18} />
              )}{' '}
              Create a crew <ArrowRight size={18} />
            </button>
            <button
              className="giant-secondary"
              disabled={!ready || busy}
              onClick={() => {
                setCopied(false);
                setModal('join');
              }}
            >
              Join with a code
            </button>
            <button
              className="giant-text-button"
              disabled={!ready || busy}
              onClick={solo}
            >
              Sneak in solo <ArrowRight size={15} />
            </button>
          </div>
          <div className="giant-start-meta">
            <span>
              <Users size={15} /> 2–4 friends
            </span>
            <span>
              <Moon size={15} /> Solo practice
            </span>
          </div>
          {!ready && !notice && (
            <p className="giant-loading">
              <LoaderCircle size={15} className="animate-spin" /> Opening the
              cottage…
            </p>
          )}
        </section>
      )}
      {!session && (
        <div className="giant-scene-caption">
          <span>SHHH…</span> Even the floorboards have opinions.
        </div>
      )}
      {session && w && (
        <>
          <aside className="giant-mission" aria-label="Heist progress">
            <div className="giant-eyebrow">
              <Coins size={16} /> THE NIGHT’S TAKINGS
            </div>
            <div className="giant-gold">
              <strong>{w.banked}</strong>
              <span>/ {w.target} gold</span>
            </div>
            <progress
              className="giant-meter"
              aria-label="Treasure secured"
              value={Math.min(w.banked, w.target)}
              max={w.target}
            />
            <p>
              <ShieldCheck size={15} /> Banked safely outside
            </p>
            <div className="giant-carried">
              <Hand size={16} />
              <span>
                {item ? ITEM_NAMES[item.kind] : 'Your hands are empty'}
              </span>
              {item?.value ? <b>+{item.value}</b> : null}
            </div>
            <div className="giant-clock">
              {w.phase === 'escape' ? (
                <DoorOpen size={18} />
              ) : (
                <Sunrise size={18} />
              )}
              <span>{w.phase === 'escape' ? 'GET OUT IN' : 'SUNRISE IN'}</span>
              <strong>
                {duration(
                  w.phase === 'escape'
                    ? w.escapeAt - w.clock
                    : w.deadline - w.clock,
                )}
              </strong>
            </div>
          </aside>
          <aside className="giant-sleep" aria-label="Giant wakefulness">
            <div>
              <Moon size={18} />
              <strong>
                {w.phase === 'escape'
                  ? 'WIDE AWAKE'
                  : w.wakefulness > 75
                    ? 'VERY RESTLESS'
                    : w.wakefulness > 35
                      ? 'STIRRING'
                      : 'FAST ASLEEP'}
              </strong>
              <span>{Math.round(w.wakefulness)}%</span>
            </div>
            <progress
              className="giant-meter giant-noise"
              aria-label="Wakefulness"
              value={w.wakefulness}
              max={100}
            />
            <p>
              {w.phase === 'escape'
                ? 'He is up. Grab your loot and run!'
                : lastNoise
                  ? `+${Math.round(lastNoise.strength)} · ${lastNoise.text}`
                  : item
                    ? 'Carrying loot? Pass it down before jumping.'
                    : 'Soft landings. Quiet feet.'}
            </p>
          </aside>
          <div className="giant-crew">
            {w.players.map((p) => (
              <span
                key={p.id}
                title={p.name}
                className={p.escaped ? 'giant-safe' : ''}
              >
                <i style={{ backgroundColor: COLORS[p.color] }}>
                  {p.escaped ? (
                    <Check size={13} />
                  ) : (
                    p.name.slice(0, 1).toUpperCase()
                  )}
                </i>
                {p.name}
                {p.id === session.id && <small>YOU</small>}
              </span>
            ))}
            <button
              disabled={practice}
              onClick={() => {
                setCopied(false);
                setModal('invite');
              }}
            >
              {practice ? 'SOLO' : session.code}
              {!practice && <Copy size={13} />}
            </button>
          </div>
          {w.phase === 'escape' && wakePose(w).elapsed < 8500 ? (
            <div className="giant-warning giant-shout" role="alert">
              <strong>The giant</strong>
              <span>“{GIANT_SHOUT}”</span>
            </div>
          ) : escapeWarning(w) ? (
            <div className="giant-warning" role="alert">
              <strong>Shupias, time to leave!</strong>
              <span>He’s about to wake up. Get to the glowing door!</span>
              <b>{Math.max(1, Math.ceil(untilGiantWakes(w) / 1000))}</b>
            </div>
          ) : (
            w.pending && (
              <div className="giant-warning" role="alert">
                <strong>
                  {w.pending.kind === 'roll'
                    ? 'Watch his arm!'
                    : w.pending.kind === 'sneeze'
                      ? 'A sneeze is coming!'
                      : 'He’s waking up!'}
                </strong>
                <span>
                  {w.pending.kind === 'wake'
                    ? 'Get ready to run for the door.'
                    : w.pending.kind === 'roll'
                      ? 'The bedside crossing is about to shift.'
                      : 'Hold on. The chandelier is above his belly.'}
                </span>
                <b>{Math.max(1, Math.ceil((w.pending.at - w.clock) / 1000))}</b>
              </div>
            )
          )}
          {w.phase === 'lobby' && (
            <section className="giant-lobby">
              <div>
                <div className="giant-eyebrow">THE CREW IS ASSEMBLING</div>
                <h2>Keep your voices down.</h2>
                <p>
                  {w.players.length}/4 thieves inside. Invite friends before
                  starting.
                </p>
              </div>
              <button
                className="giant-primary"
                disabled={!host || busy}
                onClick={() => void action({ type: 'start' })}
              >
                {host ? 'Start the heist' : 'Waiting for the host'}
                <ArrowRight size={18} />
              </button>
            </section>
          )}
          {active && (
            <div className="giant-controls">
              <p className="giant-hint" aria-live="polite">
                {giantHint(w, session.id)}
              </p>
              <div className="giant-dock">
                <button
                  disabled={status !== 'online' || me?.escaped || me?.caught}
                  aria-label={
                    receiver ? `Pass quietly to ${receiver.name}` : undefined
                  }
                  onClick={() =>
                    void action({
                      type:
                        receiver && !(item?.value && me && atDoor(me))
                          ? 'pass'
                          : 'interact',
                    })
                  }
                >
                  <Hand size={19} />
                  <span>
                    {item?.value && me && atDoor(me)
                      ? 'Bank gold'
                      : receiver
                        ? 'Pass'
                        : item
                          ? 'Place'
                          : 'Grab / help'}
                  </span>
                  <kbd>E</kbd>
                </button>
                <button
                  disabled={!item || status !== 'online' || me?.escaped}
                  onClick={() => void action({ type: 'drop' })}
                >
                  <ArrowRight size={18} className="giant-down" />
                  <span>Place</span>
                  <kbd>Q</kbd>
                </button>
                {item?.kind === 'spoon' ? (
                  <button onClick={() => void action({ type: 'rotate' })}>
                    <RotateCw size={18} />
                    <span>Turn</span>
                    <kbd>R</kbd>
                  </button>
                ) : (
                  <button
                    disabled={
                      w.phase !== 'playing' ||
                      status !== 'online' ||
                      me?.escaped
                    }
                    onClick={() => void action({ type: 'tickle' })}
                  >
                    <Feather size={18} />
                    <span>Tickle</span>
                    <kbd>F</kbd>
                  </button>
                )}
                <button
                  className={creep ? 'selected' : ''}
                  aria-pressed={creep}
                  onClick={() => setCreep(!creep)}
                >
                  <Moon size={18} />
                  <span>Creep</span>
                  <kbd>Shift</kbd>
                </button>
                <button onClick={() => scene.current?.cycleCamera()}>
                  <Camera size={18} />
                  <span>View</span>
                  <kbd>V</kbd>
                </button>
                {me && atDoor(me) && !me.escaped && (
                  <button
                    className="giant-exit-button"
                    onClick={() => void action({ type: 'exit' })}
                  >
                    <DoorOpen size={18} />
                    <span>Escape</span>
                    <kbd>X</kbd>
                  </button>
                )}
              </div>
              <div className="giant-keyboard-note">
                WASD / arrows · Move <span>Space · Jump</span>
                <span>Drag · Look around</span>
              </div>
            </div>
          )}
          <TouchControls
            disabled={
              !active ||
              !!modal ||
              status !== 'online' ||
              !!me?.escaped ||
              !!me?.caught
            }
            move={(v) => {
              scene.current?.setTouch(v);
            }}
            jump={() => scene.current?.jumpNow()}
          />
          {lastEvent &&
            !w.pending &&
            active &&
            w.clock - lastEvent.at < 4200 && (
              <div className="giant-event" aria-live="polite">
                {lastEvent.text}
              </div>
            )}
        </>
      )}
      {session && status !== 'online' && (
        <div className="giant-connection" role="alert">
          <strong>
            {status === 'expired'
              ? 'Your room pass expired.'
              : 'Reconnecting to your crew…'}
          </strong>
          <span>Movement is paused.</span>
          {status === 'expired' && (
            <button onClick={leave}>Return to menu</button>
          )}
        </div>
      )}
      {notice && (
        <div className="giant-notice" role="alert">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="game-dialog giant-dialog">
          {modal === 'help' && (
            <>
              <DialogTitle>A little courage. Very quiet shoes.</DialogTitle>
              <DialogDescription>
                Steal 120 gold before sunrise. Carry one thing at a time and
                bank valuables at the glowing door.
              </DialogDescription>
              <ol className="giant-help">
                <li>
                  <strong>Climb the cottage.</strong> Books and the stool lead
                  to the bed. Jump from his knees onto his breathing belly. The
                  necklace is on his chest. Find gems, coin pouches and 22
                  treasures throughout the cottage. His crown is on his head.
                </li>
                <li>
                  <strong>Plan your landings.</strong> Shift or Creep slows your
                  steps and softens your landing. Higher falls are louder,
                  especially while carrying a cup, crown or metal spoon. Place
                  pillows with Q to cushion a fall. Turn a carried teaspoon with
                  R to make a crossing.
                </li>
                <li>
                  <strong>Pass it down.</strong> Stand at the edge above an
                  empty-handed friend and press E when “Pass” appears. Both
                  thieves need steady footing. Chain handoffs down the ledges;
                  dropping an item from height makes a crash when it lands.
                </li>
                <li>
                  <strong>Expect a reaction.</strong> Noise wakes the giant.
                  Every arm shift and sneeze gives a warning. F near his bare
                  foot deliberately provokes a sneeze.
                </li>
                <li>
                  <strong>Help, then escape.</strong> E or H beside a dazed
                  friend helps them up. X at the door leaves early. Once he
                  wakes, he sits up, stands on the bed and throws loose treasure
                  off his body. You have 25 seconds to get out. Banked gold is
                  always safe.
                </li>
              </ol>
              <p>Voice chat never affects the noise meter.</p>
              <button className="giant-primary" onClick={() => setModal(null)}>
                Understood. Shhh. <Check size={17} />
              </button>
            </>
          )}
          {modal === 'join' && (
            <>
              <DialogTitle>Join the little heist.</DialogTitle>
              <DialogDescription>
                Enter your crew’s six-character code before they start.
              </DialogDescription>
              <label htmlFor="giant-join-name">Your name</label>
              <input
                id="giant-join-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 18))}
                maxLength={18}
                placeholder="Tiny thief"
              />
              <label htmlFor="giant-code">Room code</label>
              <input
                id="giant-code"
                className="giant-code-input"
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
                placeholder="ABC123"
                autoCapitalize="characters"
              />
              <button
                className="giant-primary"
                disabled={!ready || busy || code.length !== 6}
                onClick={() => void enter('join')}
              >
                {busy ? 'Joining…' : 'Join crew'}
                <ArrowRight size={18} />
              </button>
            </>
          )}
          {modal === 'invite' && (
            <>
              <DialogTitle>Four is a questionable crowd.</DialogTitle>
              <DialogDescription>
                Share this code or send the invite link. Friends can join until
                the heist starts.
              </DialogDescription>
              <div className="giant-room-code">{session?.code}</div>
              <button className="giant-primary" onClick={() => void copy()}>
                {copied ? 'Link copied' : 'Copy invite link'}
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <button
                className="giant-secondary"
                onClick={() => setModal(null)}
              >
                Back to the cottage
              </button>
            </>
          )}
          {modal === 'leave' && (
            <>
              <DialogTitle>Leave the crew?</DialogTitle>
              <DialogDescription>
                Your carried object stays in the cottage. Your friends can
                continue the heist.
              </DialogDescription>
              <button className="giant-primary" onClick={leave}>
                Return to menu <ArrowLeft size={17} />
              </button>
              <a className="giant-secondary" href="/" onClick={leave}>
                All games <ArrowLeft size={17} />
              </a>
              <button
                className="giant-secondary"
                onClick={() => setModal(null)}
              >
                Stay with the crew
              </button>
            </>
          )}
          {notice && (
            <p className="dialog-error" role="alert">
              {notice}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!done && !modal} onOpenChange={() => {}}>
        <DialogContent
          className="game-dialog giant-dialog giant-result"
          showCloseButton={false}
        >
          <Coins size={38} />
          <DialogTitle>
            {w && w.banked >= w.target
              ? 'A giant little payday.'
              : 'Small thieves. Big ambitions.'}
          </DialogTitle>
          <DialogDescription>
            {w && w.banked >= w.target
              ? 'The crew hit its target. Every banked coin is yours to keep.'
              : 'You kept the treasure that made it outside. The 120-gold target is still waiting.'}
          </DialogDescription>
          <div className="giant-result-stats">
            <span>
              <strong>{w?.banked ?? 0}</strong>GOLD SECURED
            </span>
            <span>
              <strong>
                {escaped}/{w?.players.length}
              </strong>
              THIEVES ESCAPED
            </span>
          </div>
          <button
            className="giant-primary"
            disabled={!host}
            onClick={() => void action({ type: 'restart' })}
          >
            {host ? 'One more little heist' : 'Waiting for the host'}
            <RotateCw size={18} />
          </button>
          <button className="giant-secondary" onClick={leave}>
            Back to menu
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
