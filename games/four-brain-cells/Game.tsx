'use client';
/* eslint-disable next/no-img-element -- Collection artwork is a local asset on both hosting targets. */
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bot,
  Camera,
  Check,
  ChefHat,
  Coffee,
  Copy,
  Footprints,
  Hand,
  LoaderCircle,
  RotateCcw,
  Trophy,
  Users,
  Utensils,
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
  addBrain,
  advanceBreakfast,
  breakfastAction,
  breakfastSnapshot,
  freshBreakfast,
  instruction,
} from './simulation';
import {
  idleInput,
  LIMBS,
  ROUND_MS,
  type BrainAction,
  type BrainSession,
  type BrainSnapshot,
  type BrainWorld,
} from './types';
import { BreakfastSound } from './audio';
import type { BreakfastScene } from './scene';
import { isNpcAction, type NpcAction } from '../../shared/rooms/npc-slots';
import { CrewSlots } from './CrewSlots';
import './style.css';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { breakfastAnalytics, breakfastPlayState } from './analytics';

const SESSION_KEY = 'four-brain-cells-session-v1';
const PREFS_KEY = 'four-brain-cells-prefs-v1';
const time = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function Hold({
  children,
  label,
  hold,
  disabled,
}: {
  children: ReactNode;
  label: string;
  hold: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      className="brain-action"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        hold(true);
      }}
      onPointerUp={(e) => {
        hold(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => hold(false)}
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
const tracker = new GameTracker(breakfastAnalytics);

export default function FourBrainCells() {
  useGameTracker(tracker);
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<BreakfastScene | null>(null),
    sound = useRef<BreakfastSound | null>(null),
    network = useRef<PeerGameConnection<BrainSnapshot> | null>(null),
    local = useRef<BrainWorld | null>(null),
    active = useRef<BrainSession | null>(null),
    latest = useRef<BrainSnapshot | null>(null),
    input = useRef(idleInput()),
    actionRef = useRef<(a: BrainAction) => void>(() => {}),
    hudAt = useRef(0);
  const [snapshot, setSnapshot] = useState<BrainSnapshot | null>(null),
    [session, setSession] = useState<BrainSession | null>(null),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [npcBusy, setNpcBusy] = useState(false),
    [muted, setMuted] = useState(false),
    [notice, setNotice] = useState(''),
    [copied, setCopied] = useState(false),
    [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
      'online',
    ),
    [modal, setModal] = useState<'join' | 'help' | 'invite' | 'leave' | null>(
      null,
    );
  const w = snapshot?.world,
    me = w?.players.find((p) => p.id === session?.id),
    practice = session?.code === 'PRACTICE',
    playing = w?.phase === 'playing',
    done = w?.phase === 'won' || w?.phase === 'lost',
    captain = !!session && snapshot?.host === session.id;
  function accept(next: BrainSnapshot) {
    if (!active.current) return;
    tracker.observe(breakfastPlayState(next, active.current));
    const previous = latest.current;
    latest.current = next;
    scene.current?.setSnapshot(next);
    sound.current?.update(next.world);
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
  function attach(s: BrainSession, state?: BrainSnapshot) {
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
      /* Optional session recovery. */
    }
    network.current = new PeerGameConnection(
      'four-brain-cells',
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
    const audio = new BreakfastSound();
    sound.current = audio;
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      audio.enabled = prefs.muted !== true;
      queueMicrotask(() => {
        if (!disposed) {
          setName(typeof prefs.name === 'string' ? prefs.name : '');
          setMuted(prefs.muted === true);
        }
      });
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
      .then(({ BreakfastScene }) => {
        if (disposed || !container.current) return;
        try {
          scene.current = new BreakfastScene(container.current, {
            input: (next) => {
              input.current = next;
              const p = local.current?.players.find(
                (p) => p.id === active.current?.id,
              );
              if (p) {
                p.input = next;
                p.seen = local.current!.clock;
              }
            },
            action: (a) => actionRef.current(a),
            failure: () => {
              setReady(false);
              setNotice(
                'The kitchen display stopped. Reload to rejoin your robot.',
              );
            },
            tick: () => {
              const world = local.current,
                s = active.current;
              if (!world || !s) return;
              advanceBreakfast(world, Date.now());
              accept(breakfastSnapshot(world, s.code, s.id, s.id, world.clock));
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
              /* A fresh kitchen is always available. */
            }
        } catch {
          setNotice(
            'The kitchen could not load. Enable hardware acceleration and reload.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The kitchen could not load. Reload to try again.');
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
  function prefs(nextMuted = muted) {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ name, muted: nextMuted }),
      );
    } catch {
      /* Optional preferences. */
    }
  }
  async function enter(op: 'create' | 'join') {
    if (busy || !ready) return;
    setBusy(true);
    setNotice('');
    sound.current?.unlock();
    prefs();
    try {
      const result = await enterPeerRoom<BrainSnapshot>(
        'four-brain-cells',
        {
          op,
          name: name.trim() || 'Brain cell',
          ...(op === 'join' ? { code: code.trim().toUpperCase() } : {}),
        },
        () => import('./peer'),
      );
      if (!result.session)
        throw new Error('The kitchen could not be joined. Try again.');
      attach(result.session, result.snapshot);
      setModal(null);
      history.replaceState(
        null,
        '',
        `/four-brain-cells?room=${result.session.code}`,
      );
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : 'Could not reach the kitchen. Try again.',
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
    prefs();
    const now = Date.now(),
      world = freshBreakfast(now),
      s = { code: 'PRACTICE', id: 'practice-brain', token: '' };
    addBrain(world, s.id, name.trim() || 'You', 0);
    local.current = world;
    active.current = s;
    latest.current = null;
    setSession(s);
    setStatus('online');
    setNotice('');
    scene.current?.setSession(s.id);
    scene.current?.resetInput();
    scene.current?.focus();
    accept(breakfastSnapshot(world, s.code, s.id, s.id, now));
  }
  function action(a: BrainAction) {
    if (modal || !active.current || npcBusy) return;
    tracker.action(a.type);
    scene.current?.focus();
    sound.current?.unlock();
    setNotice('');
    if (a.type === 'claim') scene.current?.resetInput();
    try {
      if (local.current) {
        breakfastAction(local.current, active.current.id, a, active.current.id);
        accept(
          breakfastSnapshot(
            local.current,
            'PRACTICE',
            active.current.id,
            active.current.id,
            local.current.clock,
          ),
        );
      } else if (isNpcAction(a)) {
        setNpcBusy(true);
        void network.current
          ?.manageNpcs(a as NpcAction)
          .catch((e) => setNotice(e.message))
          .finally(() => setNpcBusy(false));
      } else void network.current?.action(a).catch((e) => setNotice(e.message));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Try again.');
    }
  }
  useEffect(() => {
    actionRef.current = action;
  });
  useEffect(() => {
    scene.current?.setBlocked(!!modal || status !== 'online');
  }, [modal, status, ready]);
  async function leave(allGames = false) {
    tracker.observe({ stage: 'menu' });
    setBusy(true);
    try {
      await network.current?.leave();
    } finally {
      network.current = null;
      local.current = null;
      active.current = null;
      latest.current = null;
      input.current = idleInput();
      setSession(null);
      setSnapshot(null);
      setModal(null);
      setNotice('');
      setStatus('online');
      scene.current?.setSnapshot(null);
      sound.current?.reset();
      setBusy(false);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* Optional session storage. */
      }
      if (allGames) location.href = '/';
      else history.replaceState(null, '', '/four-brain-cells');
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/four-brain-cells?room=${session?.code}`,
      );
      setCopied(true);
    } catch {
      setNotice(
        'Copy the six-character kitchen code and share it with friends.',
      );
    }
  }
  const lastEvent = w?.events.at(-1),
    pan = w?.utensils.find((u) => u.id === 'pan'),
    disabled = !playing || !!modal || status !== 'online',
    arm = (me?.limb ?? 0) < 2;
  return (
    <main className={`brain-game${session ? ' brain-in-session' : ''}`}>
      <div className="brain-canvas" ref={container} />
      <header className="brain-header">
        <a href="/" className="brain-brand">
          <span>
            <Bot size={24} />
          </span>{' '}
          FOUR BRAIN CELLS<span className="brain-dot">.</span>
        </a>
        <GameToolbar
          muted={muted}
          onToggleSound={() => {
            setMuted(!muted);
            prefs(!muted);
            if (sound.current) {
              sound.current.unlock();
              sound.current.enabled = muted;
            }
          }}
          onHelp={() => setModal('help')}
          onLeave={session ? () => setModal('leave') : undefined}
          workshop="/four-brain-cells/admin"
          voice={
            session?.peer && w
              ? {
                  session: { ...session, game: 'four-brain-cells' },
                  onSpeaking: (active) => sound.current?.duck(active),
                  snapshot: {
                    players: w.players.filter((p) => !p.bot),
                    nearby: false,
                  },
                }
              : undefined
          }
          voiceHint="Start a kitchen with friends to use crew voice chat."
        />
      </header>
      {!session ? (
        <section className="brain-menu">
          <div className="brain-menu-copy">
            <span className="brain-kicker">
              <span /> JUMBLEYARD DOMESTIC ROBOTICS
            </span>
            <h1>
              Four brain cells.
              <br />
              <em>One breakfast.</em>
            </h1>
            <p>
              Four players. One functioning adult.
              <br />
              Everyone gets a limb. Nobody gets the blame.
              <br />
              <small>Actually, the limbs are color-coded.</small>
            </p>
            <div className="brain-meta">
              <span>
                <Users size={16} /> 1–4 players
              </span>
              <span>
                <Coffee size={16} /> 6-minute breakfast
              </span>
            </div>
            <label className="brain-name">
              Your brain cell’s name
              <input
                value={name}
                maxLength={18}
                onChange={(e) => setName(e.target.value)}
                placeholder="Head of left hand"
                autoComplete="nickname"
              />
            </label>
            <button
              className="brain-primary"
              disabled={!ready || busy}
              onClick={() => void enter('create')}
            >
              {busy ? (
                <LoaderCircle className="brain-spin" size={20} />
              ) : (
                <ChefHat size={20} />
              )}{' '}
              Start a kitchen <ArrowUpRight size={20} />
            </button>
            <div className="brain-menu-secondary">
              <button
                disabled={!ready || busy}
                onClick={() => setModal('join')}
              >
                Join friends
              </button>
              <button disabled={!ready || busy} onClick={startPractice}>
                Solo / NPCs
              </button>
            </div>
            <span className="brain-menu-note">
              No download. Bring friends. Lower your expectations.
            </span>
          </div>
          <figure className="brain-menu-art">
            <img
              src="/images/four-brain-cells.png"
              alt="A clumsy cream toy robot pours coffee with its teal hand, flips pancakes with its coral hand, and kicks the breakfast table with its mustard foot."
              width={1536}
              height={1024}
              fetchPriority="high"
            />
            <figcaption>
              <span>FIRST ASSIGNMENT</span>
              <strong>How hard can breakfast be?</strong>
              <div>
                {LIMBS.map((l) => (
                  <i key={l.short} style={{ background: l.color }} />
                ))}
              </div>
            </figcaption>
          </figure>
        </section>
      ) : (
        <>
          <section className="brain-order" aria-label="Breakfast order">
            <div>
              <span>
                <Utensils size={15} /> TABLE ONE
              </span>
              <strong>Breakfast, please.</strong>
              <div className="brain-order-items">
                <span className={w?.pancakes === 3 ? 'complete' : ''}>
                  <Check size={15} /> {w?.pancakes ?? 0}/3 pancakes
                </span>
                <span className={(w?.coffee ?? 0) >= 0.98 ? 'complete' : ''}>
                  <Coffee size={15} /> {Math.round((w?.coffee ?? 0) * 100)}%
                  coffee
                </span>
              </div>
            </div>
            <div className="brain-clock">
              <span>BEFORE BRUNCH</span>
              <strong>
                {w?.phase === 'lobby'
                  ? '6:00'
                  : time(ROUND_MS - ((w?.clock ?? 0) - (w?.started ?? 0)))}
              </strong>
            </div>
          </section>
          <aside className="brain-crew" aria-label="Limb ownership">
            <div className="brain-crew-title">
              <span>
                <Users size={16} /> {`${w?.players.length ?? 0}/4 BRAIN CELLS`}
              </span>
              {!practice && (
                <button
                  onClick={() => {
                    setCopied(false);
                    setModal('invite');
                  }}
                >
                  Invite
                </button>
              )}
            </div>
            {LIMBS.map((l, i) => {
              const owner = w?.players.find((p) => p.limb === i);
              return (
                <button
                  key={l.short}
                  className={`brain-limb${me?.limb === i ? ' selected' : ''}`}
                  style={{ '--limb': l.color } as React.CSSProperties}
                  disabled={
                    (!!owner && owner.id !== session.id) ||
                    status !== 'online' ||
                    npcBusy
                  }
                  onClick={() => action({ type: 'claim', limb: i })}
                  aria-pressed={me?.limb === i}
                >
                  <b>{i < 2 ? <Hand size={19} /> : <Footprints size={19} />}</b>
                  <span>
                    <strong>{l.name}</strong>
                    <small>
                      {owner
                        ? `${owner.name}${owner.bot ? ' (NPC)' : owner.id === session.id ? ' (you)' : ''}`
                        : 'Take this limb'}
                    </small>
                  </span>
                  <kbd>{i + 1}</kbd>
                </button>
              );
            })}
            <p>
              {practice
                ? 'Switch limbs with 1–4. The free partner foot follows you.'
                : 'One limb each. Take a free limb when you need a hand.'}
            </p>
          </aside>
          <button
            className="brain-camera"
            onClick={() => scene.current?.changeCamera()}
            aria-label="Switch kitchen camera"
          >
            <Camera size={20} />
            <span>View</span>
          </button>
          {w?.phase === 'lobby' && (
            <section className="brain-lobby">
              <span className="brain-kicker">ASSEMBLE YOUR ADULT</span>
              <h2>Who’s the left foot?</h2>
              <p>
                {practice
                  ? 'Take a limb and add NPC teammates, or try juggling breakfast on your own.'
                  : 'Pick your limbs. Invite friends or add NPCs to the empty slots.'}
              </p>
              {!practice && (
                <button
                  className="brain-room-code"
                  onClick={() => void copyInvite()}
                >
                  {session.code}{' '}
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              )}
              <CrewSlots
                players={w.players}
                host={captain}
                busy={npcBusy || status !== 'online'}
                manage={action}
              />
              <button
                className="brain-primary"
                disabled={!captain || status !== 'online' || npcBusy}
                onClick={() => action({ type: 'start' })}
              >
                {captain ? 'Let’s make breakfast' : 'Waiting for the host…'}
                <ArrowUpRight size={20} />
              </button>
            </section>
          )}
          {playing && (
            <>
              <section className="brain-status">
                <div>
                  <span>ADULT STABILITY</span>
                  <strong>
                    {(w?.robot.wobble ?? 0) > 0.65
                      ? 'Questionable'
                      : 'Surprisingly upright'}
                  </strong>
                </div>
                <meter
                  min={0}
                  max={1}
                  low={0.25}
                  high={0.65}
                  optimum={0}
                  value={w?.robot.wobble ?? 0}
                  aria-label="Robot wobble"
                />
                {pan && pan.fill > 0 && (
                  <div className="brain-cooking">
                    <span>
                      {pan.ready
                        ? 'PANCAKE READY'
                        : pan.flipped
                          ? 'SECOND SIDE'
                          : pan.cook >= 3
                            ? 'FLIP WITH SPACE'
                            : 'FIRST SIDE'}
                    </span>
                    <progress
                      max={3}
                      value={Math.min(3, pan.cook)}
                      aria-label="Pancake cooking"
                    />
                  </div>
                )}
              </section>
              <div
                className="brain-instruction"
                style={{ borderColor: LIMBS[me?.limb ?? 0].color }}
              >
                <b>{LIMBS[me?.limb ?? 0].name}</b>
                <span>{w && instruction(w, session.id)}</span>
              </div>
              <TouchControls
                disabled={disabled}
                move={(v) => scene.current?.move(v)}
                jump={() => action({ type: arm ? 'grab' : 'kick' })}
              />
              <nav className="brain-action-dock" aria-label="Limb actions">
                {arm ? (
                  <>
                    <button
                      className="brain-action"
                      disabled={disabled}
                      onClick={() => action({ type: 'grab' })}
                    >
                      <Hand size={20} />
                      <span>
                        {w?.limbs[me?.limb ?? 0].held ? 'Release' : 'Grab'}
                        <kbd>E</kbd>
                      </span>
                    </button>
                    <Hold
                      label="Hold to cook, flip, serve or pour"
                      disabled={disabled}
                      hold={(v) => scene.current?.hold('use', v)}
                    >
                      <Utensils size={20} />
                      <span>
                        Use<kbd>Space</kbd>
                      </span>
                    </Hold>
                    <Hold
                      label="Raise hand"
                      disabled={disabled}
                      hold={(v) => scene.current?.hold('up', v)}
                    >
                      <ArrowUp size={20} />
                      <span>
                        Raise<kbd>R</kbd>
                      </span>
                    </Hold>
                    <Hold
                      label="Lower hand"
                      disabled={disabled}
                      hold={(v) => scene.current?.hold('down', v)}
                    >
                      <ArrowDown size={20} />
                      <span>
                        Lower<kbd>F</kbd>
                      </span>
                    </Hold>
                  </>
                ) : (
                  <button
                    className="brain-action"
                    disabled={disabled}
                    onClick={() => action({ type: 'kick' })}
                  >
                    <Footprints size={20} />
                    <span>
                      Kick<kbd>Space</kbd>
                    </span>
                  </button>
                )}
                <Hold
                  label="Move carefully"
                  disabled={disabled}
                  hold={(v) => scene.current?.hold('steady', v)}
                >
                  <span>
                    Careful<kbd>Shift</kbd>
                  </span>
                </Hold>
                <button
                  className="brain-action"
                  disabled={disabled}
                  onClick={() => action({ type: 'center' })}
                >
                  <RotateCcw size={18} />
                  <span>
                    Center<kbd>Q</kbd>
                  </span>
                </button>
              </nav>
            </>
          )}
          {done && (
            <section className="brain-results">
              <Trophy size={38} />
              <span className="brain-kicker">BREAKFAST PERFORMANCE REVIEW</span>
              <h2>
                {w?.phase === 'won'
                  ? 'A functioning adult.'
                  : 'Breakfast is now brunch.'}
              </h2>
              <p>
                {w?.pancakes}/3 pancakes. {Math.round((w?.coffee ?? 0) * 100)}%
                coffee.
                <br />
                {w?.falls} robot tumbles. A lot to talk about.
              </p>
              <div className="brain-report">
                {w?.players.map((p) => (
                  <div key={p.id}>
                    <i style={{ background: LIMBS[p.limb].color }} />
                    <span>{p.name}</span>
                    <strong>
                      {p.mishaps} mishaps · {p.served} served
                    </strong>
                  </div>
                ))}
              </div>
              <CrewSlots
                players={w!.players}
                host={captain}
                busy={npcBusy || status !== 'online'}
                manage={action}
              />
              <button
                className="brain-primary"
                disabled={!captain || status !== 'online' || npcBusy}
                onClick={() => action({ type: 'restart' })}
              >
                {captain ? 'One more breakfast' : 'Waiting for the host…'}
                <RotateCcw size={18} />
              </button>
              <button
                className="brain-text-button"
                onClick={() => void leave()}
              >
                Back to the kitchen door
              </button>
            </section>
          )}
        </>
      )}
      {(notice ||
        (session && status !== 'online') ||
        (playing && lastEvent && w && w.clock - lastEvent.at < 5500)) && (
        <output
          className="brain-notice"
          style={
            lastEvent?.limb !== null && lastEvent?.limb !== undefined
              ? { borderLeftColor: LIMBS[lastEvent.limb].color }
              : undefined
          }
        >
          {notice ||
            (status === 'expired'
              ? 'This room expired. Leave and create or join a new kitchen.'
              : status === 'reconnecting'
                ? 'Connecting your brain cells…'
                : lastEvent?.text)}
          {notice && (
            <button onClick={() => setNotice('')} aria-label="Dismiss message">
              ×
            </button>
          )}
        </output>
      )}
      {!ready && !notice && (
        <output className="brain-loading">
          <LoaderCircle className="brain-spin" size={18} /> Warming up the
          kitchen…
        </output>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="brain-dialog">
          <DialogTitle>
            {modal === 'help'
              ? 'A very basic adulting lesson'
              : modal === 'join'
                ? 'Find your brain cells'
                : modal === 'invite'
                  ? 'Some assembly required.'
                  : 'Leave the kitchen?'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'help'
              ? 'Cook three pancakes and fill the coffee cup before the six-minute shift ends.'
              : modal === 'join'
                ? 'Enter a friend’s six-character kitchen code.'
                : modal === 'invite'
                  ? 'Up to four friends can join before breakfast starts.'
                  : 'Your crew can keep playing. An empty limb can be taken over.'}
          </DialogDescription>
          {modal === 'help' && (
            <div className="brain-help">
              <p>
                <b>One robot. Four controls.</b> Pick a free hand or foot with
                1–4 or the colored limb buttons. WASD / arrows moves your limb.
                Hold Shift for smaller, careful movements.
              </p>
              <p>
                <b>Hands:</b> WASD reaches, R raises, F lowers. E grabs or
                releases a nearby pan or pot. Q brings your limb back to its
                resting position.
              </p>
              <p>
                <b>Pancakes:</b> Hold the pan over the orange hob. Space adds
                batter. Cook for three seconds, then Space flips. Cook the
                second side for three seconds. Carry the pan to the plate and
                Space serves. Repeat three times. Keep the first side off the
                hob or flip it before it burns.
              </p>
              <p>
                <b>Coffee:</b> Grab the pot at the coffee machine. Reach over
                the cup and hold Space to pour. Hold Space at the machine to
                refill. Pouring away from the cup makes a slippery mess.
              </p>
              <p>
                <b>Feet:</b> Hold WASD to step. Agree on a direction and
                alternate steps. Space kicks a nearby table. An empty partner
                foot follows you when playing with a smaller crew.
              </p>
              <p>
                <b>Accidents:</b> Wobbling can spill food. Reaching too high
                under the fan launches utensils. The robot stands back up after
                a tumble; utensils dropped on the floor return to their stations
                after five seconds. Served pancakes stay on the plate.
              </p>
              <p>
                <b>NPC teammates:</b> Before a round, the host can add one NPC
                to any empty player slot, fill every empty slot, or remove an
                NPC to make room for a friend. NPC hands handle cooking and
                pouring. NPC feet follow a human foot; if both feet are NPCs,
                they walk between stations to help the hands. Solo / NPCs opens
                a local lobby.
              </p>
              <p>
                <b>Touch:</b> Use the joystick and action buttons. Tap a colored
                limb to switch.
              </p>
            </div>
          )}
          {modal === 'join' && (
            <form
              className="brain-join-form"
              onSubmit={(e) => {
                e.preventDefault();
                void enter('join');
              }}
            >
              <label>
                Your name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={18}
                  placeholder="Brain cell"
                  autoComplete="nickname"
                />
              </label>
              <label>
                Kitchen code
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
                  placeholder="ABC234"
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </label>
              <button
                className="brain-primary"
                disabled={!ready || busy || code.length !== 6}
              >
                {busy ? 'Finding your robot…' : 'Join kitchen'}
                <ArrowUpRight size={18} />
              </button>
            </form>
          )}
          {modal === 'invite' && (
            <>
              <strong className="brain-room-code">{session?.code}</strong>
              <button
                className="brain-primary"
                onClick={() => void copyInvite()}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Invite copied' : 'Copy invite link'}
              </button>
            </>
          )}
          {modal === 'leave' && (
            <>
              <button
                className="brain-primary"
                disabled={busy}
                onClick={() => void leave(true)}
              >
                All games
                <ArrowUpRight size={18} />
              </button>
              <button
                className="brain-text-button"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Keep cooking
              </button>
            </>
          )}
          {notice && modal && (
            <output className="brain-dialog-error">{notice}</output>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
