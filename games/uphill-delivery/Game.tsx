'use client';
/* eslint-disable next/no-html-link-for-pages */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Camera,
  Check,
  Copy,
  DoorOpen,
  Hand,
  LoaderCircle,
  Mountain,
  RotateCw,
  Sofa,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { TouchControls } from '../../shared/input/TouchControls';
import { COLORS } from '../../shared/rendering/palette';
import GameToolbar from '../../shared/ui/GameToolbar';
import { DeliverySound } from './audio';
import {
  advanceDelivery,
  deliveryAction,
  deliveryPlayer,
  deliverySnapshot,
  freshDelivery,
} from './simulation';
import { DeliveryConnection, requestDelivery } from './connection';
import {
  SOFA_CENTER,
  SUMMIT,
  type DeliveryAction,
  type DeliverySnapshot,
  type DeliverySession,
  type DeliveryWorld,
} from './types';
import { routeStage } from './level';
import type { DeliveryScene } from './scene';
import {
  CAMERA_NAMES,
  DELIVERY_CAMERAS,
  type DeliveryCameraMode,
} from './camera';
import { CrewSlots } from './CrewSlots';
import './style.css';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { deliveryAnalytics, deliveryPlayState } from './analytics';

const SESSION_KEY = 'uphill-delivery-session-v1';
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: () => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
const duration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const tracker = new GameTracker(deliveryAnalytics);

export default function UphillDelivery() {
  useGameTracker(tracker);
  const canvas = useRef<HTMLDivElement>(null),
    scene = useRef<DeliveryScene | null>(null),
    connection = useRef<DeliveryConnection | null>(null),
    local = useRef<DeliveryWorld | null>(null),
    sessionRef = useRef<DeliverySession | null>(null),
    actionRef = useRef<(a: DeliveryAction) => void>(() => {}),
    audio = useRef<DeliverySound | null>(null),
    latest = useRef<DeliverySnapshot | null>(null);
  const hudAt = useRef(0);
  const audioAt = useRef(0);
  const [snapshot, setSnapshot] = useState<DeliverySnapshot | null>(null),
    [session, setSession] = useState<DeliverySession | null>(null),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [crewBusy, setCrewBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [muted, setMuted] = useState(false),
    [copied, setCopied] = useState(false),
    [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
      'online',
    );
  const [modal, setModal] = useState<
      'help' | 'join' | 'invite' | 'restart' | 'leave' | null
    >(null),
    [camera, setCamera] = useState<DeliveryCameraMode>(DELIVERY_CAMERAS[0]);
  const w = snapshot?.world,
    me = w?.players.find((p) => p.id === session?.id),
    practice = session?.code === 'PRACTICE',
    host = snapshot?.host === session?.id,
    playing = w?.phase === 'playing',
    done = w?.phase === 'delivered';
  const altitude = Math.max(0, (w?.sofa.y ?? SOFA_CENTER) - SOFA_CENTER),
    hands = w?.players.filter((p) => p.grip !== null).length ?? 0;
  function accept(next: DeliverySnapshot) {
    if (!sessionRef.current) return;
    tracker.observe(deliveryPlayState(next, sessionRef.current));
    const prior = latest.current;
    latest.current = next;
    scene.current?.setSnapshot(next);
    const now = performance.now();
    const changed =
      !prior ||
      prior.code !== next.code ||
      prior.world.started !== next.world.started ||
      prior.world.phase !== next.world.phase ||
      prior.world.events.at(-1)?.id !== next.world.events.at(-1)?.id ||
      prior.world.players.length !== next.world.players.length ||
      prior.world.players.some(
        (p, i) =>
          p.id !== next.world.players[i]?.id ||
          p.grip !== next.world.players[i]?.grip,
      );
    // Physics and rendering stay at display rate; the dashboard needs only 10 Hz.
    if (changed || now - hudAt.current >= 100) {
      hudAt.current = now;
      setSnapshot(next);
    }
    if (!changed && now - audioAt.current < 50) return;
    audioAt.current = now;
    const event = next.world.events.at(-1);
    if (event && event.id !== prior?.world.events.at(-1)?.id)
      setNotice(event.text);
    audio.current?.update(next, scene.current?.yaw);
  }

  function attach(s: DeliverySession, state?: DeliverySnapshot) {
    connection.current?.stop();
    local.current = null;
    sessionRef.current = s;
    setSession(s);
    setStatus('online');
    latest.current = null;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {}
    const network = new DeliveryConnection(s, accept, setStatus);
    connection.current = network;
    if (state) network.accept(state);
    void network.poll();
  }
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_uphill_delivery_performance',
            description:
              'Read the last 600 rendered frames, frame work, draw calls, resolution and displayed player, camera and sofa positions to diagnose stutter.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: () =>
              scene.current?.diagnostics() ?? { status: 'loading' },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    let disposed = false;
    const sound = new DeliverySound();
    audio.current = sound;
    try {
      const prefs = JSON.parse(
        localStorage.getItem('uphill-delivery-prefs-v1') || '{}',
      );
      queueMicrotask(() => {
        if (disposed) return;
        setName(typeof prefs.name === 'string' ? prefs.name : '');
        setMuted(!!prefs.muted);
      });
      sound.enabled = !prefs.muted;
    } catch {}
    const invite = new URL(location.href).searchParams.get('room');
    if (invite && /^[A-Z2-9]{6}$/i.test(invite))
      queueMicrotask(() => {
        if (disposed) return;
        setCode(invite.toUpperCase());
        setModal('join');
      });
    import('./scene')
      .then(({ DeliveryScene }) => {
        if (disposed || !canvas.current) return;
        try {
          scene.current = new DeliveryScene(canvas.current, {
            input: (input) => {
              connection.current?.setInput(input);
              const p = local.current?.players[0];
              if (p) {
                p.input = { ...input, jump: input.jump || p.input.jump };
                p.seen = Date.now();
              }
            },
            action: (action) => actionRef.current(action),
            camera: setCamera,
            tick: () => {
              const world = local.current,
                session = sessionRef.current;
              if (!world || !session) return;
              const now = Date.now();
              // Keep a tap until at least one fixed physics step has consumed it.
              const stepped =
                Math.min(300, now - world.clock) / 1000 + world.remainder >=
                1 / 60 - 1e-9;
              advanceDelivery(world, now);
              if (stepped) world.players[0].input.jump = false;
              accept(
                structuredClone(
                  deliverySnapshot(
                    world,
                    'PRACTICE',
                    session.id,
                    session.id,
                    now,
                  ),
                ),
              );
            },
          });
          setReady(true);
          if (!invite)
            try {
              const saved = JSON.parse(
                sessionStorage.getItem(SESSION_KEY) || 'null',
              );
              if (
                saved?.code &&
                saved?.id &&
                saved?.token &&
                saved.code !== 'PRACTICE'
              )
                attach(saved);
            } catch {}
        } catch {
          setNotice(
            'The mountain could not load. Enable hardware acceleration and reload to play.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The game could not load. Reload the page to try again.');
      });
    return () => {
      disposed = true;
      connection.current?.stop();
      scene.current?.dispose();
      sound.dispose();
    };
  }, []);
  useEffect(() => {
    if (audio.current) audio.current.enabled = !muted;
    try {
      localStorage.setItem(
        'uphill-delivery-prefs-v1',
        JSON.stringify({ name, muted }),
      );
    } catch {}
  }, [name, muted]);
  useEffect(() => {
    scene.current?.setPaused(!!modal || status !== 'online' || !!done);
  }, [modal, status, done]);
  async function action(a: DeliveryAction) {
    tracker.action(a.type);
    try {
      setNotice('');
      audio.current?.unlock();
      if (local.current && sessionRef.current) {
        deliveryAction(
          local.current,
          sessionRef.current.id,
          a,
          sessionRef.current.id,
        );
        accept(
          structuredClone(
            deliverySnapshot(
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
  async function crewAction(a: DeliveryAction) {
    if (crewBusy) return;
    setCrewBusy(true);
    try {
      await action(a);
    } finally {
      setCrewBusy(false);
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
      s = { id, code: 'PRACTICE', token: '' },
      world = freshDelivery(now);
    world.players = [deliveryPlayer(id, name.trim() || 'Mover', 0, now)];
    deliveryAction(world, id, { type: 'start' }, id);
    sessionRef.current = s;
    local.current = world;
    latest.current = null;
    setSession(s);
    setModal(null);
    setStatus('online');
    audio.current?.unlock();
    accept(structuredClone(deliverySnapshot(world, s.code, id, id, now)));
  }
  async function room(op: 'create' | 'join') {
    setBusy(true);
    setNotice('');
    audio.current?.unlock();
    try {
      const result = await requestDelivery({
        op,
        name: name.trim() || 'Mover',
        ...(op === 'join' ? { code: code.toUpperCase() } : {}),
      });
      if (!result.session || !result.snapshot)
        throw new Error('The room did not open. Try again.');
      attach(result.session, result.snapshot);
      setModal(null);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not reach the crew.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function leave(destination = '/uphill-delivery') {
    tracker.observe({ stage: 'menu' });
    await connection.current?.leave();
    connection.current = null;
    local.current = null;
    sessionRef.current = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    location.href = destination;
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/uphill-delivery?room=${session?.code}`,
      );
      setCopied(true);
    } catch {
      setNotice('Copy the link below and send it to your friends.');
    }
  }
  return (
    <main className={`delivery-shell ${session ? 'delivery-playing' : ''}`}>
      <div className="delivery-canvas" ref={canvas} />
      <header className="delivery-topbar">
        <a href="/" className="delivery-wordmark">
          <span>
            <Sofa size={24} />
          </span>{' '}
          Uphill Delivery<span className="delivery-dot">.</span>
        </a>
        <GameToolbar
          workshop="/uphill-delivery/admin"
          voice={
            session && !practice && snapshot
              ? {
                  session: { ...session, game: 'uphill-delivery' },
                  snapshot: {
                    players: snapshot.world.players.filter((p) => !p.bot),
                    nearby: false,
                  },
                  onSpeaking: (active) => audio.current?.duck(active),
                }
              : undefined
          }
          voiceHint={
            practice
              ? 'Voice is available in multiplayer. Create or join a crew to talk with friends.'
              : undefined
          }
          muted={muted}
          onToggleSound={() => setMuted(!muted)}
          onHelp={() => setModal('help')}
          onLeave={session ? () => setModal('leave') : undefined}
        />
      </header>
      {!session ? (
        <>
          <section className="delivery-start">
            <div className="delivery-eyebrow">
              <span className="live-dot" /> A CO-OP MOVING DISASTER
            </div>
            <h1>
              Uphill
              <br />
              <span>
                Delivery<span className="delivery-dot">.</span>
              </span>
            </h1>
            <p className="delivery-tagline">
              Four friends. One sofa. No elevator.
            </p>
            <p className="delivery-intro">
              Your customer lives at the top. The sofa would rather be at the
              bottom. Grab a corner and work it out together.
            </p>
            <div className="delivery-setup">
              <label htmlFor="delivery-name">YOUR NAME ON THE VAN</label>
              <input
                id="delivery-name"
                autoComplete="off"
                maxLength={18}
                placeholder="Mover"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="delivery-primary"
                disabled={!ready || busy}
                onClick={() => void room('create')}
              >
                {busy ? (
                  <LoaderCircle className="delivery-spin" size={19} />
                ) : (
                  <Users size={19} />
                )}{' '}
                Get the crew together <ArrowUpRight size={19} />
              </button>
              <div className="delivery-setup-row">
                <button
                  className="delivery-secondary"
                  disabled={!ready || busy}
                  onClick={() => setModal('join')}
                >
                  Join a crew
                </button>
                <button
                  className="delivery-secondary"
                  disabled={!ready || busy}
                  onClick={solo}
                >
                  Try it solo
                </button>
              </div>
              <span className="delivery-setup-note">
                1–4 players · one shared sofa · no checkpoints
              </span>
            </div>
            <p className="delivery-start-tip">
              <Hand size={17} /> It’s cargo. It’s a bridge. It’s your last
              chance to land.
            </p>
          </section>
          <div className="delivery-scene-caption">
            <span>NO. 4, ALL THE WAY UP</span>
            <p>Yes, that’s the address.</p>
          </div>
          <footer className="delivery-start-footer">
            <span>PART OF THE JUMBLEYARD COLLECTION</span>
            <span>THE STAIRS WERE NOT IN THE JOB DESCRIPTION.</span>
          </footer>
        </>
      ) : (
        <>
          <div className="delivery-crew" aria-label="Delivery crew">
            {w?.players.map((p) => (
              <span key={p.id} className="delivery-member">
                <i style={{ background: COLORS[p.color] }}>
                  {p.bot ? (
                    <Bot size={20} aria-label="NPC" />
                  ) : (
                    p.name.charAt(0).toUpperCase()
                  )}
                </i>
                <span>
                  <b>
                    {p.name}
                    {p.bot ? ' · NPC' : ''}
                    {p.id === session.id ? ' (you)' : ''}
                  </b>
                  <small>
                    {p.bot
                      ? (p.task ?? 'Ready to help')
                      : p.grip !== null
                        ? 'Holding a corner'
                        : 'Hands free'}
                  </small>
                </span>
              </span>
            ))}
            {!practice && (w?.players.length ?? 0) < 4 && (
              <button
                onClick={() => {
                  setCopied(false);
                  setModal('invite');
                }}
                aria-label="Invite friends"
              >
                +
              </button>
            )}
          </div>
          <div className="delivery-room">
            {practice ? (
              <span>SOLO · HELPING HAND ON</span>
            ) : (
              <button
                onClick={() => {
                  setCopied(false);
                  setModal('invite');
                }}
              >
                <span>CREW CODE</span>
                <strong>{session.code}</strong>
                <Copy size={16} />
              </button>
            )}
            {status !== 'online' && (
              <output>
                {status === 'expired'
                  ? 'Pass expired. Leave and rejoin your crew.'
                  : 'Reconnecting to the crew…'}
              </output>
            )}
          </div>
          <aside className="delivery-mission">
            <span className="delivery-eyebrow">
              <Mountain size={15} /> DELIVERY PROGRESS
            </span>
            <div>
              <strong>
                {altitude.toFixed(1)}
                <small> m</small>
              </strong>
              <span>/ {SUMMIT} m up</span>
            </div>
            <progress
              aria-label="Sofa altitude"
              max={SUMMIT}
              value={altitude}
            />
            <p>{routeStage(altitude)}</p>
            <div className="delivery-stats">
              <span>
                <Hand size={14} /> {hands} / {w?.players.length} holding
              </span>
              <span>{duration((w?.clock ?? 0) - (w?.started ?? 0))}</span>
            </div>
          </aside>
          <div className="delivery-camera">
            <button
              onClick={() => {
                scene.current?.cycleCamera();
              }}
              aria-label={`Camera: ${CAMERA_NAMES[camera]}. Change camera`}
            >
              <Camera size={18} />
              <span>
                {CAMERA_NAMES[camera]} <kbd>V</kbd>
              </span>
            </button>
            {host && (
              <button
                onClick={() => setModal('restart')}
                aria-label="Restart from the bottom"
              >
                <RotateCw size={18} />
              </button>
            )}
          </div>
          {w && w.phase === 'lobby' && !practice && (
            <section className="delivery-crew-setup" aria-label="Crew setup">
              <CrewSlots
                players={w.players}
                host={host}
                busy={crewBusy || busy || status !== 'online'}
                onAction={(a) => void crewAction(a)}
              />
              <button
                className="delivery-primary"
                disabled={!host || busy || crewBusy || status !== 'online'}
                onClick={() => void crewAction({ type: 'start' })}
              >
                {host ? 'Start the delivery' : 'Waiting for the crew leader'}
              </button>
            </section>
          )}
          {camera === 'first-person' && playing && !modal && (
            <span className="delivery-reticle" aria-hidden="true" />
          )}
          {playing && (
            <TouchControls
              disabled={!playing || !!modal || status !== 'online'}
              move={(vector) => {
                scene.current?.setTouch(vector);
              }}
              jump={() => scene.current?.jumpNow()}
            />
          )}
          {playing && (
            <div className="delivery-bottom">
              <p className="delivery-hint">
                {me?.grip !== null && me?.grip !== undefined
                  ? 'Walk together to carry. Back up to pull. Release before opening a gate.'
                  : 'Walk into the sofa to push. Grab a corner to lift. Jump onto its cushions.'}
              </p>
              <div className="delivery-dock">
                <button
                  disabled={!playing || status !== 'online'}
                  onClick={() => void action({ type: 'grab' })}
                  className="delivery-grab"
                >
                  <Hand size={20} />
                  <span>
                    {me?.grip !== null && me?.grip !== undefined
                      ? 'Release'
                      : 'Grab'}{' '}
                    <kbd>E</kbd>
                  </span>
                </button>
                <button
                  disabled={!playing || me?.grip == null || status !== 'online'}
                  onClick={() => void action({ type: 'rotate' })}
                >
                  <RotateCw size={20} />
                  <span>
                    Turn sofa <kbd>R</kbd>
                  </span>
                </button>
                <button
                  disabled={!playing || status !== 'online'}
                  onClick={() => void action({ type: 'interact' })}
                >
                  <DoorOpen size={20} />
                  <span>
                    Open / close <kbd>F</kbd>
                  </span>
                </button>
                <button
                  disabled={!playing || status !== 'online'}
                  onClick={() => scene.current?.jumpNow()}
                >
                  <ArrowUpRight size={20} />
                  <span>
                    Jump <kbd>SPACE</kbd>
                  </span>
                </button>
              </div>
              <span className="delivery-movement">
                {camera === 'first-person'
                  ? 'WASD / arrows move · click or drag to look · IJKL look · Esc releases mouse'
                  : 'WASD / arrows move · drag to orbit · scroll to zoom'}
              </span>
            </div>
          )}
        </>
      )}
      {notice && (
        <output className="delivery-notice">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss message">
            ×
          </button>
        </output>
      )}
      <Dialog
        open={!!modal || !!done}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="delivery-dialog" showCloseButton={!done}>
          {done ? (
            <>
              <Trophy className="delivery-dialog-icon" size={40} />
              <DialogTitle>Special delivery. Still in one piece.</DialogTitle>
              <DialogDescription>
                The sofa is inside No. 4.{' '}
                {duration((w?.clock ?? 0) - (w?.started ?? 0))} of teamwork,{' '}
                {w?.drops} hands-off moments, and absolutely no elevator.
              </DialogDescription>
              {!practice && w && (
                <CrewSlots
                  players={w.players}
                  host={host}
                  busy={crewBusy || busy || status !== 'online'}
                  onAction={(a) => void crewAction(a)}
                />
              )}
              <button
                className="delivery-primary"
                disabled={!host || crewBusy || busy || status !== 'online'}
                onClick={() => void crewAction({ type: 'restart' })}
              >
                {host ? 'One more delivery' : 'Waiting for your crew leader'}
              </button>
              <button
                className="delivery-secondary"
                onClick={() => void leave()}
              >
                Back to the depot
              </button>
            </>
          ) : modal === 'help' ? (
            <>
              <DialogTitle>Some assembly of friends required.</DialogTitle>
              <DialogDescription>
                Get the whole sofa inside the customer’s room at the summit,
                release it on the rug, and let it settle.
              </DialogDescription>
              <ul className="delivery-help">
                <li>
                  <b>Bring an NPC.</b> The crew leader can add an NPC to an
                  empty slot, fill all free slots, or remove NPCs before setting
                  off. NPCs share the weight and follow the direction of people
                  holding the sofa. Stand still while holding to ask them to
                  wait.
                </li>
                <li>
                  <b>Move & jump.</b> WASD / arrows move with the camera. Space
                  jumps. Touch has a joystick and jump button.
                </li>
                <li>
                  <b>Pick your view.</b> You start outside, with the camera
                  following you. Drag to orbit and scroll to zoom. V cycles
                  follow you, follow sofa, whole mountain and first person. In
                  first person, click the mountain for mouse look or drag to
                  look around; Escape frees the mouse and IJKL also looks
                  around. On touch, use the left joystick and drag the scenery
                  with your other thumb.
                </li>
                <li>
                  <b>Share the weight.</b> E grabs a free corner or releases it.
                  Walk together to lift, backward to pull, or into the sofa to
                  push. R applies a turn.
                </li>
                <li>
                  <b>Make your own way.</b> Lay the sofa across the broken path.
                  Jump from its cushions for extra height, or use it to catch
                  someone falling.
                </li>
                <li>
                  <b>One free hand.</b> Release your corner, stand by the gate
                  or door, and press F. Everyone else keeps holding.
                </li>
                <li>
                  <b>No checkpoints.</b> Dropped cargo stays where gravity takes
                  it. Chase it down. The restart button begins again at the
                  bottom.
                </li>
                <li>
                  <b>At the top…</b> The door opens outward. Give it room before
                  you celebrate.
                </li>
              </ul>
              <a
                className="delivery-secondary"
                href="/uphill-delivery/admin"
                target="_blank"
                rel="noopener"
              >
                Open sound workshop
              </a>
            </>
          ) : modal === 'join' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void room('join');
              }}
            >
              <DialogTitle>Your crew’s expecting you.</DialogTitle>
              <DialogDescription>
                Enter their six-character code. Join before they start climbing.
              </DialogDescription>
              <label htmlFor="delivery-join-name">Your name</label>
              <input
                id="delivery-join-name"
                maxLength={18}
                value={name}
                placeholder="Mover"
                onChange={(e) => setName(e.target.value)}
              />
              <label htmlFor="delivery-code">Crew code</label>
              <input
                id="delivery-code"
                autoComplete="off"
                maxLength={6}
                value={code}
                placeholder="ABC234"
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''),
                  )
                }
              />
              <button
                type="submit"
                className="delivery-primary"
                disabled={code.length !== 6 || busy || !ready}
              >
                {busy ? 'Joining…' : 'Join the delivery'}
              </button>
              {notice && <p role="alert">{notice}</p>}
            </form>
          ) : modal === 'invite' ? (
            <>
              <DialogTitle>Three more pairs of hands.</DialogTitle>
              <DialogDescription>
                Send the link or code to your friends. Everyone joins in their
                own browser.
              </DialogDescription>
              <strong className="delivery-invite-code">{session?.code}</strong>
              <input
                aria-label="Invitation link"
                readOnly
                value={`${typeof location !== 'undefined' ? location.origin : ''}/uphill-delivery?room=${session?.code}`}
                onFocus={(e) => e.target.select()}
              />
              <button
                className="delivery-primary"
                onClick={() => void copyInvite()}
              >
                {copied ? <Check size={19} /> : <Copy size={19} />}
                {copied ? 'Link copied' : 'Copy invite link'}
              </button>
            </>
          ) : modal === 'restart' ? (
            <>
              <DialogTitle>Back to the very bottom?</DialogTitle>
              <DialogDescription>
                This starts a new delivery for the whole crew. You can also keep
                going and retrieve the sofa wherever it fell.
              </DialogDescription>
              <button
                className="delivery-primary"
                onClick={() => {
                  setModal(null);
                  void action({ type: 'restart' });
                }}
              >
                Restart from the depot
              </button>
              <button
                className="delivery-secondary"
                onClick={() => setModal(null)}
              >
                Keep this delivery
              </button>
            </>
          ) : (
            <>
              <DialogTitle>Clocking off?</DialogTitle>
              <DialogDescription>
                Your corner will be released. The rest of the crew can keep
                going.
              </DialogDescription>
              <button className="delivery-primary" onClick={() => void leave()}>
                Leave the delivery
              </button>
              <button
                className="delivery-secondary"
                onClick={() => void leave('/')}
              >
                All games <ArrowLeft size={17} />
              </button>
              <button
                className="delivery-secondary"
                onClick={() => setModal(null)}
              >
                Stay with the sofa
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
