'use client';
import { gameInviteUrl } from '../../shared/browser/public-url';

/* eslint-disable next/no-img-element, next/no-html-link-for-pages -- Full game navigation disposes WebGL; artwork is served locally on both targets. */
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token. */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Camera,
  Check,
  Copy,
  DoorOpen,
  Eye,
  Hotel,
  KeyRound,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
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
import { freshHotel, newGuest, hotelAction, hotelSnapshot } from './simulation';
import {
  COLORS,
  STATIONS,
  STOPS,
  INSPECT_MS,
  ESCAPE_MS,
  idleInput,
  type HotelWorld,
  type HotelSnapshot,
  type HotelSession,
  type HotelAction,
} from './types';
import { HotelSound } from './audio';
import type { HotelScene } from './scene';
import type { HotelCameraMode } from './camera';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import { hotelText, hotelError, type HotelText } from './translations';
import { clueText, legacyFinding, stationName } from './evidence';
import { advancePractice } from './practice';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { hotelAnalytics, hotelPlayState } from './analytics';
import {
  ROOM_CODE_PATTERN,
  looksLikeRoomCode,
} from '../../shared/rooms/identity';
import { sessionStore } from '../../shared/rooms/session';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyGoal, partyRound } from '../../shared/ui/party-round';

const sessions = sessionStore('wrong-floor-session-v1');
const PREFS_KEY = 'wrong-floor-prefs-v1';
const countdown = (ms: number) =>
  `${Math.floor(Math.max(0, Math.ceil(ms / 1000)) / 60)}:${String(Math.max(0, Math.ceil(ms / 1000)) % 60).padStart(2, '0')}`;

const tracker = new GameTracker(hotelAnalytics);

export default function WrongFloor() {
  const { language } = useLanguage();
  const say = (text: HotelText) => hotelText(text, language);
  useGameTracker(tracker);
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<HotelScene | null>(null),
    sound = useRef<HotelSound | null>(null);
  const network = useRef<PeerGameConnection<HotelSnapshot> | null>(null),
    local = useRef<HotelWorld | null>(null),
    active = useRef<HotelSession | null>(null),
    latest = useRef<HotelSnapshot | null>(null);
  const input = useRef(idleInput()),
    actionRef = useRef<(a: HotelAction) => void>(() => {}),
    // The scene is handed every snapshot directly; the HUD is paced.
    hud = useRef(
      hudPacer<HotelSnapshot>(
        (snapshot) => `${snapshot.world.eventId}:${snapshot.you.inspected}`,
      ),
    ),
    localTick = useRef(0);
  const [snapshot, setSnapshot] = useState<HotelSnapshot | null>(null),
    [session, setSession] = useState<HotelSession | null>(null);
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [muted, setMuted] = useState(false),
    [gentle, setGentle] = useState(false),
    [notice, setNotice] = useState(''),
    [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'online' | 'reconnecting' | 'expired'>(
    'online',
  );
  const [modal, setModal] = useState<
      'help' | 'intro' | 'join' | 'invite' | 'leave' | null
    >(null),
    [reportsOpen, setReportsOpen] = useState(false);
  const paused = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readStop, setReadStop] = useState<number | null>(null);
  const [cameraMode, setCameraMode] = useState<HotelCameraMode>('first-person');
  const w = snapshot?.world,
    me = w?.players.find((p) => p.id === session?.id),
    you = snapshot?.you;
  const practice = session?.code === 'PRACTICE',
    host = snapshot?.host === session?.id;
  const inspect = w?.phase === 'playing' && w.stage === 'inspect',
    escape = w?.phase === 'escape',
    travel = w?.phase === 'playing' && w.stage === 'travel';
  const done = w?.phase === 'won' || w?.phase === 'lost',
    station = STATIONS[you?.station ?? 0];
  const nearClue = me
    ? Math.hypot(me.x - station.x, me.z - station.z) < 3
    : false;
  const nearVote = me ? Math.hypot(me.x, me.z + 23.5) < 4 : false;
  const disabled = !!modal || settingsOpen || status !== 'online';
  function accept(next: HotelSnapshot) {
    if (!active.current) return;
    tracker.observe(hotelPlayState(next, active.current));
    latest.current = next;
    scene.current?.setSnapshot(next);
    sound.current?.update(next, active.current.id);
    if (hud.current.due(next)) setSnapshot(next);
  }
  function attach(s: HotelSession, state?: HotelSnapshot) {
    network.current?.stop();
    local.current = null;
    active.current = s;
    latest.current = null;
    input.current = idleInput();
    setSession(s);
    setStatus('reconnecting');
    sound.current?.reset();
    scene.current?.setSession(s.id);
    sessions.save(s);
    network.current = new PeerGameConnection(
      'wrong-floor',
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
    const audio = new HotelSound();
    sound.current = audio;
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      audio.enabled = prefs.muted !== true;
      queueMicrotask(() => {
        if (!disposed) {
          setName(typeof prefs.name === 'string' ? prefs.name : '');
          setMuted(prefs.muted === true);
          setGentle(prefs.gentle === true);
        }
      });
    } catch {
      /* Optional storage. */
    }
    const invite = new URL(location.href).searchParams.get('room');
    if (invite && looksLikeRoomCode(invite))
      queueMicrotask(() => {
        if (!disposed) {
          setCode(invite.toUpperCase());
          setModal('join');
        }
      });
    void import('./scene')
      .then(({ HotelScene }) => {
        if (disposed || !container.current) return;
        try {
          scene.current = new HotelScene(container.current, {
            input: (next) => {
              input.current = next;
              const p = local.current?.players.find(
                (p) => p.id === active.current?.id,
              );
              if (p) p.input = next;
            },
            action: (a) => actionRef.current(a),
            camera: setCameraMode,
            listen: (position, yaw) => audio.listen(position, yaw),
            failure: () => {
              setReady(false);
              setNotice(
                'The hotel display stopped. Reload to rejoin your crew.',
              );
            },
            tick: () => {
              const realNow = performance.now();
              const delta = Math.min(
                100,
                Math.max(0, realNow - (localTick.current || realNow)),
              );
              localTick.current = realNow;
              if (local.current && active.current) {
                advancePractice(local.current, delta, paused.current);
                accept(
                  hotelSnapshot(
                    local.current,
                    'PRACTICE',
                    active.current.id,
                    active.current.id,
                    local.current.clock,
                  ),
                );
              }
            },
          });
          setReady(true);
          if (!invite) {
            const saved = sessions.loadPeer();
            if (saved) attach(saved);
          }
        } catch {
          setNotice(
            'The hotel could not load. Enable hardware acceleration and reload.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The hotel could not load. Reload to try again.');
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
  function savePrefs(nextMuted = muted, nextGentle = gentle) {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ name, muted: nextMuted, gentle: nextGentle }),
      );
    } catch {
      /* Optional preferences. */
    }
  }
  async function enter(op: 'create' | 'join') {
    if (!ready || busy) return;
    setBusy(true);
    setNotice('');
    sound.current?.unlock();
    savePrefs();
    try {
      const reply = await enterPeerRoom<HotelSnapshot>(
        'wrong-floor',
        {
          op,
          name: name.trim() || say('Guest'),
          ...(op === 'join' ? { code: code.toUpperCase().trim() } : {}),
        },
        () => import('./peer'),
      );
      if (!reply.session)
        throw new Error('The hotel could not be joined. Try again.');
      attach(reply.session, reply.snapshot);
      setModal(null);
      history.replaceState(null, '', `/wrong-floor?room=${reply.session.code}`);
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : 'Could not reach the hotel. Try again.',
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
      world = freshHotel(now),
      s = { id: 'practice-guest', code: 'PRACTICE', token: '' };
    world.players.push(newGuest(s.id, name.trim() || say('You'), 0, now));
    hotelAction(world, s.id, { type: 'start' }, s.id);
    world.training = true;
    paused.current = true;
    setModal('intro');
    setReadStop(null);
    setReportsOpen(false);
    local.current = world;
    active.current = s;
    latest.current = null;
    setSession(s);
    setStatus('online');
    setNotice('');
    scene.current?.setSession(s.id);
    try {
      sessions.clear();
    } catch {
      /* Optional storage. */
    }
    history.replaceState(null, '', '/wrong-floor');
    accept(hotelSnapshot(world, s.code, s.id, s.id, now));
  }
  function action(a: HotelAction) {
    if (modal || settingsOpen || !active.current || status !== 'online') return;
    tracker.action(a.type);
    setNotice('');
    sound.current?.unlock();
    try {
      if (local.current) {
        hotelAction(local.current, active.current.id, a, active.current.id);
        if (a.type === 'restart') {
          local.current.training = true;
          setReadStop(null);
          setReportsOpen(false);
        }
        accept(
          hotelSnapshot(
            local.current,
            'PRACTICE',
            active.current.id,
            active.current.id,
            local.current.clock,
          ),
        );
      } else void network.current?.action(a).catch((e) => setNotice(e.message));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Try that again.');
    }
  }
  useEffect(() => {
    actionRef.current = action;
  });
  useEffect(() => {
    paused.current = !!modal || settingsOpen;
    scene.current?.setBlocked(!!modal || settingsOpen || status !== 'online');
  }, [modal, settingsOpen, status, ready]);
  useEffect(() => {
    scene.current?.setLanguage(language);
  }, [language, ready]);
  useEffect(() => {
    scene.current?.setGentle(gentle);
  }, [gentle, ready]);
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
      active.current = null;
      latest.current = null;
      input.current = idleInput();
      scene.current?.setSnapshot(null);
      scene.current?.resetInput();
      sound.current?.reset();
      setSession(null);
      setSnapshot(null);
      setModal(null);
      setNotice('');
      setBusy(false);
      try {
        sessions.clear();
      } catch {
        /* Optional storage. */
      }
      history.replaceState(null, '', '/wrong-floor');
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        gameInviteUrl('wrong-floor', session?.code),
      );
      setCopied(true);
    } catch {
      setNotice('Copy the room code and share it with your friends.');
    }
  }
  const reports = w?.players.filter((p) => p.report).length ?? 0;
  const readReports = readStop === w?.stopAt;
  const targetName = stationName(you?.station ?? 0, language);
  const normalClue = clueText(
    { station: you?.station ?? 0, odd: false, variant: 0 },
    language,
  );
  const ownClue = you?.inspected
    ? clueText(
        { station: you.station, odd: you.anomaly, variant: you.variant ?? 0 },
        language,
      )
    : '';
  const nextStep = !you?.inspected
    ? say('Find your clue')
    : !me?.report
      ? say('Share finding')
      : !readReports
        ? say('Read the crew findings')
        : say('Go to the voting panel');
  const showReports = () => {
    setReportsOpen(!reportsOpen);
    if (!reportsOpen && w) setReadStop(w.stopAt);
  };
  const decisionClues = w?.lastDecision?.clues;
  return (
    <main
      className={`hotel-game${session ? ' in-session' : ''}${escape ? ' escaping' : ''}${gentle ? ' gentle' : ''}${inspect && nearVote ? ' at-panel' : ''}`}
      lang={language}
      {...partyRound(
        !!session && done,
        w
          ? w.phase === 'won'
            ? partyGoal(true, -w.mistakes)
            : partyGoal(false, w.cleared)
          : null,
      )}
    >
      <div className="hotel-canvas" ref={container} />
      {session && <div className="hotel-vignette" aria-hidden="true" />}
      <header className="hotel-header">
        <a href="/" className="hotel-brand">
          <span>
            <Hotel size={20} />
          </span>{' '}
          WRONG FLOOR<b>.</b>
        </a>
        <div className="hotel-tools">
          <button
            onClick={() => setModal('help')}
            aria-label={say('How to play')}
          >
            <Eye size={17} />
            <span>{say('How to play')}</span>
          </button>
          {session && (
            <button
              data-party-setup-action=""
              onClick={() => setModal('leave')}
            >
              {say('Leave')}
            </button>
          )}
          <details
            className="hotel-settings"
            onToggle={(e) => setSettingsOpen(e.currentTarget.open)}
          >
            <summary>{say('Settings')}</summary>
            <div className="hotel-settings-panel">
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
                voice={
                  session?.peer && w
                    ? {
                        session: { ...session, game: 'wrong-floor' },
                        onSpeaking: (active) => sound.current?.duck(active),
                        snapshot: {
                          players: w.players.filter((p) => !p.bot),
                          nearby: false,
                        },
                      }
                    : undefined
                }
                voiceHint={say(
                  'Check in with friends to use voice chat. Computer guests share written findings.',
                )}
              />
              {session && (
                <p>
                  {say(
                    practice
                      ? 'Practice is paused while this window is open.'
                      : 'The online round continues while this window is open.',
                  )}
                </p>
              )}
            </div>
          </details>
        </div>
      </header>
      {!session ? (
        <section className="hotel-menu">
          <div className="hotel-menu-copy">
            <span className="hotel-kicker">
              <KeyRound size={15} />
              {say('THE HOTEL WOULD LIKE YOU TO STAY')}
            </span>
            <h1>{say('Something is wrong on this floor.')}</h1>
            <p>{say('Four guests. Five stops. Only you can see your clue.')}</p>
            <div className="hotel-rule">
              <strong>{say('Inspect. Share. Decide together.')}</strong>
              <p>
                {say('Anything unusual? Retreat. Everything normal? Advance.')}
              </p>
              <small>
                {say('A wrong call means 12 seconds to reach the elevator.')}
              </small>
            </div>
            <div className="hotel-meta">
              <Users size={16} />
              {say('1–4 guests · 5 stops to escape')}
            </div>
            <label className="hotel-field">
              {say('Your guest name')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                placeholder={say('Guest')}
                autoComplete="nickname"
              />
            </label>
            <button
              className="hotel-primary"
              disabled={!ready || busy}
              onClick={startPractice}
            >
              <Eye size={18} />
              {say('Learn with 3 NPCs')}
              <ArrowUpRight size={18} />
            </button>
            <div className="hotel-secondary">
              <button
                disabled={!ready || busy}
                onClick={() => void enter('create')}
              >
                {busy ? say('Checking in…') : say('Create a room')}
              </button>
              <button
                disabled={!ready || busy}
                onClick={() => setModal('join')}
              >
                {say('Join a room')}
              </button>
            </div>
            <p className="hotel-menu-note">
              {say(
                'Friends can join with your room code. Empty places become NPCs.',
              )}
            </p>
          </div>
          <figure className="hotel-menu-art">
            <img
              src="/images/wrong-floor.png"
              alt={say(
                'Four hotel guests at a brass elevator. A shadow waits behind them.',
              )}
              width={1536}
              height={1024}
              fetchPriority="high"
            />
            <figcaption>
              <span>{say('“THE HALLWAY IS EMPTY.”')}</span>
              <strong>{say('Three out of four guests agree.')}</strong>
            </figcaption>
            <span className="hotel-art-key">
              <KeyRound size={20} />
              013
            </span>
          </figure>
        </section>
      ) : (
        <>
          <section className="hotel-progress" aria-label={say('Stops cleared')}>
            <span className="hotel-kicker">
              {practice ? say('PRACTICE') : `${say('Room')} ${session.code}`}
            </span>
            <strong>
              {say('Stop')} {Math.min(STOPS, (w?.cleared ?? 0) + 1)}
              <small> / {STOPS}</small>
            </strong>
            <div
              className="hotel-stop-dots"
              aria-label={`${w?.cleared ?? 0}/5`}
            >
              {Array.from({ length: STOPS }, (_, i) => (
                <span
                  key={i}
                  className={(w?.cleared ?? 0) > i ? 'cleared' : ''}
                >
                  {(w?.cleared ?? 0) > i ? <Check size={12} /> : i + 1}
                </span>
              ))}
            </div>
            <small>
              {Math.max(0, 3 - (w?.mistakes ?? 0))} {say('chances left')}
            </small>
          </section>
          {w && (inspect || escape) && (
            <div className={`hotel-timer${escape ? ' urgent' : ''}`}>
              <span>
                {say(
                  escape
                    ? 'ELEVATOR CLOSES IN'
                    : w.training
                      ? 'LEARN AT YOUR PACE'
                      : 'DECIDE IN',
                )}
              </span>
              <strong>
                {w.training && !escape ? (
                  <span className="hotel-untimed">{say('No time limit')}</span>
                ) : (
                  countdown(
                    escape
                      ? ESCAPE_MS - w.clock + w.escapeAt
                      : INSPECT_MS - w.clock + w.stopAt,
                  )
                )}
              </strong>
            </div>
          )}
          {!done && !escape && (
            <aside
              className={`hotel-reports${reportsOpen ? ' expanded' : ''}`}
              aria-label={say('Crew findings')}
            >
              <div className="hotel-reports-heading">
                <button
                  onClick={showReports}
                  aria-expanded={reportsOpen}
                  aria-controls="hotel-findings"
                >
                  <Users size={16} />
                  {say('Crew findings')}
                  <span aria-live="polite">{reports}/4</span>
                </button>
                {!practice && (
                  <button
                    className="hotel-invite"
                    onClick={() => {
                      setCopied(false);
                      setModal('invite');
                    }}
                  >
                    {say('Invite')}
                  </button>
                )}
              </div>
              {reportsOpen && (
                <div id="hotel-findings" className="hotel-report-list">
                  {w?.players.map((p) => (
                    <div className="hotel-report" key={p.id}>
                      <i style={{ background: COLORS[p.color] }} />
                      <div>
                        <strong>
                          {p.name} {p.id === session.id ? say('(you)') : ''}
                          <small>
                            {p.bot
                              ? 'NPC'
                              : p.vote
                                ? say(
                                    p.vote === 'advance'
                                      ? 'Advance'
                                      : 'Retreat',
                                  )
                                : ''}
                          </small>
                        </strong>
                        <p>
                          {p.reportClue
                            ? clueText(p.reportClue, language)
                            : p.report
                              ? legacyFinding(p.report, language)
                              : say('Has not shared a finding.')}
                        </p>
                      </div>
                    </div>
                  ))}
                  <p className="hotel-crew-note">
                    {say(
                      practice
                        ? 'NPCs share clues. You decide.'
                        : 'Human votes decide. A tie retreats. No votes ends the stay.',
                    )}
                  </p>
                </div>
              )}
            </aside>
          )}
          {w?.phase === 'lobby' && (
            <section className="hotel-center hotel-lobby">
              <KeyRound size={28} />
              <h2>{say('Everyone checked in?')}</h2>
              <p>
                {say(
                  'Friends can join with your room code. Empty places become NPCs.',
                )}
              </p>
              <button
                className="hotel-room-code"
                onClick={() => void copyInvite()}
                aria-label={say('Copy invite link')}
              >
                {session.code}
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
              {copied && <output>{say('Copied')}</output>}
              <p>
                {w.players.filter((p) => !p.bot).length}/4{' '}
                {say('guests checked in')}
              </p>
              <div className="hotel-rule">
                <strong>{say('Inspect. Share. Decide together.')}</strong>
                <p>
                  {say(
                    'Anything unusual? Retreat. Everything normal? Advance.',
                  )}
                </p>
                <small>
                  {say('A wrong call means 12 seconds to reach the elevator.')}
                </small>
              </div>
              {host ? (
                <button
                  className="hotel-primary"
                  disabled={disabled}
                  onClick={() => action({ type: 'start' })}
                >
                  {say('Enter the elevator')}
                  <ArrowDown size={19} />
                </button>
              ) : (
                <p>{say('Waiting for the host…')}</p>
              )}
            </section>
          )}
          {(inspect || escape) && (
            <>
              <button
                className="hotel-camera"
                aria-label={say('Switch camera')}
                title={say('Switch camera')}
                onClick={() => scene.current?.changeCamera()}
              >
                <Camera size={17} />
                <span>
                  {say(
                    cameraMode === 'first-person'
                      ? 'First person'
                      : 'Follow guest',
                  )}{' '}
                  <kbd>V</kbd>
                </span>
              </button>
              <section
                className={`hotel-evidence${escape ? ' danger' : ''}`}
                aria-label={say('YOUR NEXT STEP')}
              >
                {escape ? (
                  <>
                    <span className="hotel-kicker">
                      <DoorOpen size={17} />
                      {say(
                        me?.safe
                          ? 'YOU MADE IT'
                          : me?.caught
                            ? 'WAIT FOR YOUR CREW'
                            : 'RUN TO THE ELEVATOR',
                      )}
                    </span>
                    <strong>
                      {say(
                        me?.safe
                          ? 'Hold the door. A single survivor saves the crew.'
                          : me?.caught
                            ? 'The hotel caught you. A friend can still save everyone.'
                            : 'Follow the gold EXIT sign. Hold forward; you sprint automatically.',
                      )}
                    </strong>
                  </>
                ) : (
                  <>
                    <span className="hotel-kicker">
                      <Eye size={16} />
                      {targetName}
                    </span>
                    <strong>{nextStep}</strong>
                    {!you?.inspected ? (
                      <>
                        <p>
                          {say('Follow the gold ring. Move closer to inspect.')}
                        </p>
                        <small>
                          {say('Normally:')} {normalClue}
                        </small>
                        <div className="hotel-evidence-actions">
                          <button
                            disabled={disabled || !nearClue}
                            onClick={() => action({ type: 'inspect' })}
                          >
                            <Eye size={16} />
                            {say('Inspect')}
                            <kbd>E</kbd>
                          </button>
                        </div>
                      </>
                    ) : !me?.report ? (
                      <>
                        <p>{ownClue}</p>
                        <small>
                          {say(
                            'Share this with your crew. They cannot see your clue.',
                          )}
                        </small>
                        <div className="hotel-evidence-actions">
                          <button
                            disabled={disabled}
                            onClick={() => action({ type: 'report' })}
                          >
                            <MessageCircle size={16} />
                            {say('Share finding')}
                            <kbd>R</kbd>
                          </button>
                        </div>
                      </>
                    ) : !readReports ? (
                      <>
                        <p>
                          {say(
                            'Compare all four reports. One unusual clue is enough to retreat.',
                          )}
                        </p>
                        <div className="hotel-evidence-actions">
                          <button onClick={showReports}>
                            <Users size={16} />
                            {say('Crew findings')} {reports}/4
                          </button>
                        </div>
                      </>
                    ) : (
                      <p>
                        {say(
                          'Follow the gold ring to the far end of the hall.',
                        )}
                      </p>
                    )}
                  </>
                )}
              </section>
              {inspect && nearVote && (
                <div className="hotel-voting">
                  <span>
                    {say('MAKE THE CALL')}
                    {me?.vote
                      ? ` / ${say('You voted:')} ${say(me.vote === 'advance' ? 'Advance' : 'Retreat')}`
                      : ''}
                  </span>
                  <div>
                    <button
                      className={me?.vote === 'advance' ? 'selected' : ''}
                      aria-pressed={me?.vote === 'advance'}
                      disabled={disabled}
                      onClick={() =>
                        action({ type: 'vote', choice: 'advance' })
                      }
                    >
                      <ArrowDown size={19} />
                      <span>
                        {say('Advance')}
                        <small>{say('Everything normal')}</small>
                      </span>
                      <kbd>1</kbd>
                    </button>
                    <button
                      className={
                        me?.vote === 'retreat' ? 'selected retreat' : 'retreat'
                      }
                      aria-pressed={me?.vote === 'retreat'}
                      disabled={disabled}
                      onClick={() =>
                        action({ type: 'vote', choice: 'retreat' })
                      }
                    >
                      <ArrowUp size={19} />
                      <span>
                        {say('Retreat')}
                        <small>{say('Something unusual')}</small>
                      </span>
                      <kbd>2</kbd>
                    </button>
                  </div>
                </div>
              )}
              <TouchControls
                disabled={disabled || !!me?.safe || !!me?.caught}
                move={(v) => scene.current?.move(v)}
                jump={() => {}}
              />
              <div className="hotel-movement">
                <span className="hotel-desktop-hint">
                  {say(
                    'WASD / arrows: move · Drag: look · Shift: sprint · V: camera',
                  )}
                </span>
                <span className="hotel-touch-hint">
                  {say('Joystick: move · Drag the hallway: look')}
                </span>
              </div>
            </>
          )}
          {travel && (
            <section className="hotel-center hotel-travel">
              <ShieldCheck size={30} />
              <span className="hotel-kicker">
                {say(
                  w?.lastDecision?.correct ? 'GOOD CALL' : 'YOU HELD THE DOOR',
                )}
              </span>
              <h2>
                {say(
                  w?.lastDecision?.correct
                    ? 'Going down.'
                    : 'The crew is back.',
                )}
              </h2>
              <p>
                {decisionClues
                  ? decisionClues
                      .filter((c) => !decisionClues.some((d) => d.odd) || c.odd)
                      .map((c) => clueText(c, language))
                      .join(' ')
                  : legacyFinding(w?.lastDecision?.evidence ?? '', language)}
              </p>
              <small>
                {w?.lastDecision?.correct
                  ? `${w.cleared}/5 ${say('Stops cleared')}`
                  : say('New clues. Same stop.')}
              </small>
            </section>
          )}
          {done && (
            <section className="hotel-center hotel-results">
              <DoorOpen size={30} />
              <h2>
                {say(
                  w?.phase === 'won'
                    ? 'You checked out.'
                    : 'The hotel is keeping you.',
                )}
              </h2>
              <p>
                {say(
                  w?.phase === 'won'
                    ? 'Five stops. Four guests. One way out.'
                    : w?.endedBy === 'timeout'
                      ? 'Nobody voted in time. Reach the far-end panel and make a choice.'
                      : (w?.mistakes ?? 0) >= 3
                        ? 'Three wrong calls. Your reservation has been extended.'
                        : 'Nobody reached the elevator. Follow the exit sign and keep running.',
                )}
              </p>
              <div className="hotel-result-stats">
                <span>
                  <strong>{w?.cleared}/5</strong>
                  {say('Stops cleared')}
                </span>
                <span>
                  <strong>{w?.mistakes}</strong>
                  {say('wrong calls')}
                </span>
              </div>
              {host && (
                <button
                  data-party-setup-action=""
                  className="hotel-primary"
                  disabled={disabled}
                  onClick={() => action({ type: 'restart' })}
                >
                  {say('Another stay')}
                  <KeyRound size={18} />
                </button>
              )}
              <button
                className="hotel-text-button"
                disabled={busy}
                onClick={() => void leave()}
              >
                {say('Back to check-in')}
              </button>
            </section>
          )}
        </>
      )}
      {status !== 'online' && session && (
        <output className="hotel-connection">
          {say(
            status === 'expired'
              ? 'This room has closed.'
              : 'Reconnecting to your crew…',
          )}
          {status === 'expired' && (
            <button onClick={() => void leave()}>
              {say('Back to check-in')}
            </button>
          )}
        </output>
      )}
      {notice && (
        <output className="hotel-notice">
          {hotelError(notice, language)}
          <button
            aria-label={say('Dismiss message')}
            onClick={() => setNotice('')}
          >
            ×
          </button>
        </output>
      )}
      {!ready && !notice && (
        <div className="hotel-loading">
          <LoaderCircle size={18} className="hotel-spin" />
          {say('Opening the hotel…')}
        </div>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="hotel-dialog" showCloseButton={false}>
          <button
            className="hotel-dialog-close"
            aria-label={say('Close')}
            onClick={() => setModal(null)}
          >
            ×
          </button>
          <DialogTitle>
            {say(
              modal === 'intro'
                ? 'Before the doors open'
                : modal === 'help'
                  ? 'How to check out'
                  : modal === 'join'
                    ? 'Find your friends'
                    : modal === 'invite'
                      ? 'Share your reservation'
                      : 'Leave the hotel?',
            )}
          </DialogTitle>
          <DialogDescription>
            {say(
              modal === 'intro' || modal === 'help'
                ? 'You share a hallway. You do not share a reality.'
                : modal === 'join'
                  ? 'Enter the six-character room code from your host.'
                  : modal === 'invite'
                    ? 'Friends can join before the elevator starts.'
                    : 'Your crew can continue with an NPC in your place.',
            )}
          </DialogDescription>
          {(modal === 'help' || modal === 'intro') && (
            <div className="hotel-help">
              <ol>
                <li>
                  <strong>{say('Inspect your own clue.')}</strong>
                  <p>
                    {say(
                      'Follow the gold ring. Use E or the Inspect button near your object.',
                    )}
                  </p>
                </li>
                <li>
                  <strong>{say('Know the normal hotel.')}</strong>
                  <p>
                    {say(
                      'Dry carpet. Still, unsmiling portrait. Silent room 309. Clock stopped at 12:00.',
                    )}
                  </p>
                </li>
                <li>
                  <strong>{say('Share and compare.')}</strong>
                  <p>
                    {say(
                      'Use R or Share finding. Read all four crew reports. NPCs report automatically; no microphone is needed.',
                    )}
                  </p>
                </li>
                <li>
                  <strong>{say('Vote at the far-end panel.')}</strong>
                  <p>
                    {say(
                      'One anomaly means Retreat. All normal means Advance. Reach five stops to escape.',
                    )}
                  </p>
                </li>
              </ol>
              <p>
                <strong>{say('A wrong call means run.')}</strong>{' '}
                {say(
                  'The camera turns to the exit. Run forward to the brass elevator within 12 seconds. One survivor saves everyone. Three wrong calls end the stay.',
                )}
              </p>
              <p>
                {say(
                  'Human votes decide. A tie retreats. No votes ends the stay.',
                )}
              </p>
              {practice && (
                <p>
                  {say(
                    'Your first practice stop has no timer. The next stops give you 90 seconds.',
                  )}
                </p>
              )}
              {session && (
                <output className="hotel-pause-note">
                  {say(
                    practice
                      ? 'Practice is paused while this window is open.'
                      : 'The online round continues while this window is open.',
                  )}
                </output>
              )}
              <label className="hotel-gentle">
                <input
                  type="checkbox"
                  checked={gentle}
                  onChange={(e) => {
                    setGentle(e.target.checked);
                    savePrefs(muted, e.target.checked);
                  }}
                />
                {say('Steady lights & gentler motion')}
              </label>
              <p className="hotel-desktop-hint">
                {say(
                  'WASD / arrows: move · Drag: look · Shift: sprint · V: camera',
                )}
              </p>
              <p className="hotel-touch-hint">
                {say('Joystick: move · Drag the hallway: look')}
              </p>
              <button className="hotel-primary" onClick={() => setModal(null)}>
                {say(modal === 'intro' ? 'Start exploring' : 'Close')}
              </button>
            </div>
          )}
          {modal === 'join' && (
            <form
              className="hotel-join"
              onSubmit={(e) => {
                e.preventDefault();
                void enter('join');
              }}
            >
              <label className="hotel-field">
                {say('Your guest name')}
                <input
                  maxLength={18}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="nickname"
                  placeholder={say('Guest')}
                />
              </label>
              <label className="hotel-field">
                {say('Room code')}
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
                  pattern={ROOM_CODE_PATTERN}
                  autoCapitalize="characters"
                  placeholder="ABCDEF"
                  autoComplete="off"
                />
              </label>
              <button
                className="hotel-primary"
                disabled={busy || !ready || code.length !== 6}
                type="submit"
              >
                {say(busy ? 'Checking in…' : 'Join the hotel')}
                <ArrowUpRight size={18} />
              </button>
            </form>
          )}
          {modal === 'invite' && (
            <>
              <button
                className="hotel-room-code"
                onClick={() => void copyInvite()}
              >
                {session?.code}
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
              <p>{say(copied ? 'Invite link copied.' : 'Copy invite link')}</p>
            </>
          )}
          {modal === 'leave' && (
            <button
              className="hotel-primary"
              disabled={busy}
              onClick={() => void leave()}
            >
              {say('Back to check-in')}
            </button>
          )}
          {notice && (
            <output className="hotel-dialog-notice">
              {hotelError(notice, language)}
            </output>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
