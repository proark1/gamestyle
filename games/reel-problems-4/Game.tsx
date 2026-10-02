'use client';
import { gameInviteUrl } from '../../shared/browser/public-url';

/* eslint-disable next/no-img-element -- The generated illustration is a local asset served by both hosting targets. */
/* eslint-disable jsx-a11y/autocomplete-valid -- nickname is a valid HTML autocomplete token for the angler name. */
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  Anchor,
  ArrowUp,
  ArrowUpRight,
  Camera,
  Check,
  Copy,
  Fish,
  Hand,
  LifeBuoy,
  LoaderCircle,
  Scissors,
  Trophy,
  Users,
  Waves,
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
import { isNpcAction, type NpcAction } from '../../shared/rooms/npc-slots';
import { CrewSlots } from './CrewSlots';
import {
  advanceReel,
  freshReel,
  newAngler,
  reelAction,
  reelSnapshot,
  hookedAnglers,
} from './simulation';
import {
  ANGLER_COLORS,
  CATCHES,
  CRAB_GRAB_REACH,
  idleInput,
  type Angler,
  type ReelAction,
  type ReelSession,
  type ReelSnapshot,
  type ReelWorld,
} from './types';
import { ReelSound } from './audio';
import { handsOnHull } from './hull';
import { paddleSide } from './paddles';
import { WEATHER_LABELS } from './chaos';
import type { ReelScene } from './scene';
import './style.css';
import { useLanguage } from '../../shared/language/useLanguage';
import { REEL_PROBLEMS_TRANSLATIONS } from './translations';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { reelAnalytics, reelPlayState } from './analytics';
import { looksLikeRoomCode } from '../../shared/rooms/identity';
import { sessionStore } from '../../shared/rooms/session';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyGoal, partyRound } from '../../shared/ui/party-round';
import { RECIPES, cargoCapacity, materialCount } from './voyage';

const sessions = sessionStore('reel-problems-4-session-v1');
type Award = {
  icon: string;
  title: string;
  player: string;
  color: string;
  desc: string;
};

function getAwards(players: Angler[]): Award[] {
  if (!players || players.length === 0) return [];
  const awards: Award[] = [];

  // 1. Lake Legend (highest score contribution)
  const topScorer = [...players].sort(
    (a, b) =>
      (b.stats?.scoreContributed ?? b.catches * 25) -
      (a.stats?.scoreContributed ?? a.catches * 25),
  )[0];
  if (
    topScorer &&
    ((topScorer.stats?.scoreContributed ?? 0) > 0 || topScorer.catches > 0)
  ) {
    awards.push({
      icon: '🏆',
      title: 'Lake Legend',
      player: topScorer.name,
      color: ANGLER_COLORS[topScorer.color],
      desc: `${topScorer.stats?.scoreContributed ?? topScorer.catches * 25} pts landed`,
    });
  }

  // 2. Salmon Magnet (slapped most by flying fish)
  const topSlapped = [...players].sort(
    (a, b) => (b.stats?.slapsTaken ?? 0) - (a.stats?.slapsTaken ?? 0),
  )[0];
  if (topSlapped && (topSlapped.stats?.slapsTaken ?? 0) > 0) {
    awards.push({
      icon: '🐟',
      title: 'Salmon Magnet',
      player: topSlapped.name,
      color: ANGLER_COLORS[topSlapped.color],
      desc: `${topSlapped.stats.slapsTaken} fish to the face`,
    });
  }

  // 3. Sea-Floor Inspector (spent the most time swimming)
  const topSwimmer = [...players].sort(
    (a, b) =>
      (b.stats?.swimTimeMs ?? b.splashes * 5000) -
      (a.stats?.swimTimeMs ?? a.splashes * 5000),
  )[0];
  const swimSec = Math.round(
    ((topSwimmer?.stats?.swimTimeMs ?? topSwimmer?.splashes * 5000) || 0) /
      1000,
  );
  if (topSwimmer && (swimSec >= 3 || topSwimmer.splashes > 0)) {
    awards.push({
      icon: '🤿',
      title: 'Sea-Floor Inspector',
      player: topSwimmer.name,
      color: ANGLER_COLORS[topSwimmer.color],
      desc: `${swimSec}s inspecting the bottom`,
    });
  }

  // 4. The Human Anchor (hooked teammates)
  const topHooker = [...players].sort(
    (a, b) => (b.stats?.friendsHooked ?? 0) - (a.stats?.friendsHooked ?? 0),
  )[0];
  if (topHooker && (topHooker.stats?.friendsHooked ?? 0) > 0) {
    awards.push({
      icon: '🪝',
      title: 'The Human Anchor',
      player: topHooker.name,
      color: ANGLER_COLORS[topHooker.color],
      desc: `Hooked crew ${topHooker.stats.friendsHooked} times`,
    });
  }

  // 5. Deck-Slider (slipped on fish)
  const topSlider = [...players].sort(
    (a, b) => (b.stats?.fishSlipped ?? 0) - (a.stats?.fishSlipped ?? 0),
  )[0];
  if (topSlider && (topSlider.stats?.fishSlipped ?? 0) > 0) {
    awards.push({
      icon: '🍌',
      title: 'Deck-Slider',
      player: topSlider.name,
      color: ANGLER_COLORS[topSlider.color],
      desc: `${topSlider.stats.fishSlipped} banana-peel slips`,
    });
  }

  // 6. Master Patcher (leak repairs)
  const topPatcher = [...players].sort(
    (a, b) => (b.stats?.leaksRepaired ?? 0) - (a.stats?.leaksRepaired ?? 0),
  )[0];
  if (topPatcher && (topPatcher.stats?.leaksRepaired ?? 0) >= 1) {
    awards.push({
      icon: '🔨',
      title: 'Master Patcher',
      player: topPatcher.name,
      color: ANGLER_COLORS[topPatcher.color],
      desc: `${Math.round(topPatcher.stats.leaksRepaired)}s repairing hull leaks`,
    });
  }

  return awards;
}
function HoldButton({
  children,
  label,
  active,
  hold,
  disabled,
  progress,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  hold: (held: boolean) => void;
  disabled: boolean;
  progress?: number;
}) {
  const release = (e: PointerEvent<HTMLButtonElement>) => {
    hold(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const hasProgress = typeof progress === 'number' && progress > 0;
  const almostUp = typeof progress === 'number' && progress >= 0.75;
  return (
    <button
      type="button"
      className={`reel-action${active ? ' active' : ''}${hasProgress ? ' has-progress' : ''}${almostUp ? ' almost-up' : ''}`}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        hold(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
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
      {hasProgress && (
        <span
          className="reel-action-fill"
          style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
const tracker = new GameTracker(reelAnalytics);

export default function ReelProblems() {
  const { t } = useLanguage();
  const strings = t(REEL_PROBLEMS_TRANSLATIONS);
  useGameTracker(tracker);
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<ReelScene | null>(null),
    sound = useRef<ReelSound | null>(null),
    network = useRef<PeerGameConnection<ReelSnapshot> | null>(null),
    local = useRef<ReelWorld | null>(null),
    activeSession = useRef<ReelSession | null>(null),
    latest = useRef<ReelSnapshot | null>(null),
    input = useRef(idleInput()),
    actionRef = useRef<(a: ReelAction) => void>(() => {}),
    // The scene is handed every snapshot directly; the HUD is paced.
    hud = useRef(
      hudPacer<ReelSnapshot>(
        (snapshot) => `${snapshot.world.phase}:${snapshot.world.eventId}`,
      ),
    );
  const [snapshot, setSnapshot] = useState<ReelSnapshot | null>(null),
    [session, setSession] = useState<ReelSession | null>(null),
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
    [modal, setModal] = useState<
      'help' | 'join' | 'invite' | 'leave' | 'restart' | null
    >(null);
  const w = snapshot?.world,
    me = w?.players.find((p) => p.id === session?.id),
    playing = w?.phase === 'playing',
    done = w?.phase === 'won' || w?.phase === 'lost',
    captain = snapshot?.host === session?.id,
    practice = session?.code === 'PRACTICE',
    crabCarrier = w?.crab?.carrier
      ? w.players.find((player) => player.id === w.crab?.carrier)
      : undefined,
    carryingCrab = !!me && w?.crab?.carrier === me.id,
    crabNearby = !!(
      me &&
      w?.crab &&
      !w.crab.carrier &&
      !me.swimming &&
      Math.hypot(me.x - w.crab.x, me.z - w.crab.z) <= CRAB_GRAB_REACH
    ),
    canWork = !!(
      carryingCrab ||
      crabNearby ||
      w?.voyage.docked === 'trader' ||
      (w?.voyage.docked === 'repair' && w.voyage.wreck.raft)
    ),
    workLabel = carryingCrab
      ? 'Throw crab'
      : crabNearby
        ? 'Pick up crab'
        : w?.voyage.docked === 'trader'
          ? 'Use trader'
          : w?.voyage.docked === 'repair' && w.voyage.wreck.raft
            ? 'Rebuild boat'
            : 'Interact';
  function accept(next: ReelSnapshot) {
    if (!activeSession.current) return;
    tracker.observe(reelPlayState(next, activeSession.current));
    latest.current = next;
    scene.current?.setSnapshot(next);
    sound.current?.update(next.world, activeSession.current?.id);
    if (hud.current.due(next)) setSnapshot(next);
  }
  function attach(s: ReelSession, state?: ReelSnapshot) {
    network.current?.stop();
    local.current = null;
    activeSession.current = s;
    latest.current = null;
    input.current = idleInput();
    setSession(s);
    setStatus('reconnecting');
    sound.current?.reset();
    scene.current?.setSession(s.id);
    sessions.save(s);
    network.current = new PeerGameConnection(
      'reel-problems-4',
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
    const audio = new ReelSound();
    sound.current = audio;
    try {
      const saved = JSON.parse(
        localStorage.getItem('reel-problems-4-prefs-v1') || '{}',
      );
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
    if (invite && looksLikeRoomCode(invite))
      queueMicrotask(() => {
        if (!disposed) {
          setCode(invite.toUpperCase());
          setModal('join');
        }
      });
    void import('./scene')
      .then(({ ReelScene }) => {
        if (disposed || !container.current) return;
        try {
          scene.current = new ReelScene(container.current, {
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
                'The lake display lost its connection. Reload to rejoin your boat.',
              );
            },
            tick: () => {
              const world = local.current,
                s = activeSession.current;
              if (!world || !s) return;
              advanceReel(world, Date.now());
              accept(reelSnapshot(world, s.code, s.id, s.id, world.clock));
            },
          });
          setReady(true);
          if (!invite) {
            const saved = sessions.loadPeer();
            if (saved) attach(saved);
          }
        } catch {
          setNotice(
            'The lake could not load. Enable hardware acceleration and reload to play.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setNotice('The lake could not load. Reload and try again.');
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
  function savePrefs() {
    try {
      localStorage.setItem(
        'reel-problems-4-prefs-v1',
        JSON.stringify({ name, muted }),
      );
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
      const reply = await enterPeerRoom<ReelSnapshot>(
        'reel-problems-4',
        {
          op,
          name: name.trim() || 'Angler',
          ...(op === 'join' ? { code: code.toUpperCase().trim() } : {}),
        },
        () => import('./peer'),
      );
      if (!reply.session)
        throw new Error('The boat could not be joined. Try again.');
      attach(reply.session, reply.snapshot);
      setModal(null);
      history.replaceState(
        null,
        '',
        `/reel-problems-4?room=${reply.session.code}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not reach the lake. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  function startPractice() {
    if (!ready) return;
    network.current?.stop();
    network.current = null;
    input.current = idleInput();
    sound.current?.unlock();
    sound.current?.reset();
    savePrefs();
    const now = Date.now(),
      world = freshReel(now),
      s = { code: 'PRACTICE', id: 'practice-angler', token: '' };
    world.players.push(newAngler(s.id, name.trim() || 'You', 0, now));
    reelAction(world, s.id, { type: 'start' }, s.id);
    local.current = world;
    activeSession.current = s;
    setSession(s);
    setStatus('online');
    setNotice('');
    latest.current = null;
    scene.current?.setSession(s.id);
    accept(reelSnapshot(world, s.code, s.id, s.id, now));
  }
  function action(a: ReelAction) {
    if (modal || !activeSession.current) return;
    tracker.action(a.type);
    sound.current?.unlock();
    setNotice('');
    try {
      if (local.current) {
        reelAction(
          local.current,
          activeSession.current.id,
          a,
          activeSession.current.id,
        );
        accept(
          reelSnapshot(
            local.current,
            'PRACTICE',
            activeSession.current.id,
            activeSession.current.id,
            local.current.clock,
          ),
        );
      } else if (isNpcAction(a)) {
        setNpcBusy(true);
        void network.current
          ?.manageNpcs(a as NpcAction)
          .catch((error) => setNotice(error.message))
          .finally(() => setNpcBusy(false));
      } else
        void network.current
          ?.action(a)
          .catch((error) => setNotice(error.message));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Try that again.');
    }
  }
  useEffect(() => {
    actionRef.current = action;
  });
  useEffect(() => {
    if (modal) scene.current?.resetInput();
  }, [modal]);
  async function leave() {
    tracker.observe({ stage: 'menu' });
    setBusy(true);
    try {
      await network.current?.leave();
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
      setBusy(false);
      try {
        sessions.clear();
      } catch {
        /* Storage is optional. */
      }
      history.replaceState(null, '', '/reel-problems-4');
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        gameInviteUrl('reel-problems-4', session?.code),
      );
      setCopied(true);
    } catch {
      setNotice('Copy the room code below and share it with your crew.');
    }
  }
  const fishOn =
    me?.line?.kind === 'fish'
      ? w?.fish.find((f) => f.id === me.line?.target)
      : null;
  const downed = !!me?.swimming && !!w && w.clock < me.downedUntil;
  const sunk = !!w?.boat.sunk;
  const hands = me && w ? handsOnHull(w, me) : null;
  const lineLabel = me?.swimming
    ? downed
      ? sunk
        ? 'Pulled under! You come round when a new boat is out'
        : 'Pulled under! The crew is hauling you out'
      : sunk
        ? 'Wrecked! Follow the arrow, recover 2 wood + 1 part, then lash a raft'
        : me.clinging
          ? me.input.reel
            ? me.climb >= 0.75
              ? 'Almost aboard! Pulling onto deck…'
              : 'Climbing aboard… hold on!'
            : me.climb > 0
              ? 'Slipping down! Hold E to keep climbing'
              : 'Holding on — hold E to climb aboard'
          : 'Overboard! Swim to the hull'
    : w?.voyage.helm.owner === me?.id
      ? `At helm · throttle ${Math.round((w?.voyage.helm.throttle ?? 0) * 100)}% · W/S power · A/D steer`
      : me?.paddle
        ? `${paddleSide(me.paddle) === 'port' ? 'Port' : 'Starboard'} paddle: W strokes forward, S back · P puts it down`
        : w?.pending
          ? 'A seagull is diving for the catch — jump!'
          : hands === 'patch'
            ? 'On the leak — hold E to patch it!'
            : w?.leak
              ? 'LEAK! Get to the spray and hold E'
              : hands === 'bail'
                ? 'Water aboard — hold E to bail'
                : me?.line?.tangled
                  ? 'Tangled! Press R to loosen'
                  : me?.line?.kind === 'player'
                    ? 'You hooked a friend'
                    : fishOn?.surge
                      ? 'Fish surging — ease off E!'
                      : fishOn
                        ? `${CATCHES[fishOn.kind].name} — reel it in!`
                        : me?.line
                          ? 'Waiting for a bite…'
                          : 'Click the water or press Space to cast';
  const helpers = fishOn && w ? hookedAnglers(w, fishOn.id) : [];
  const seaLife =
    w?.wildlife?.filter((visitor) => visitor.activeUntil > w.clock) ?? [];
  const lastEvent = w?.events.at(-1);
  const monsterFish = w?.fish.find((f) => f.kind === 'monster');
  const monsterHooked = !!(
    monsterFish &&
    !monsterFish.respawnAt &&
    w?.players.some(
      (p) => p.line?.kind === 'fish' && p.line.target === monsterFish.id,
    )
  );
  const uiDisabled = !playing || status !== 'online' || !!modal;
  const personalItems =
    w?.voyage.items.filter(
      (item) => item.location === `personal:${session?.id}`,
    ) ?? [];
  const cargoItems =
    w?.voyage.items.filter((item) => item.location === 'cargo') ?? [];
  return (
    <main
      className={`reel-game${session ? ' in-session' : ''}`}
      {...partyRound(
        !!session && done,
        w ? partyGoal(w.phase === 'won', w.score) : null,
      )}
    >
      <div className="reel-canvas" ref={container} />
      {playing && (me?.line?.tension ?? 0) > 0.85 && (
        <div
          className="reel-tension-vignette"
          style={{
            opacity: Math.min(1, ((me?.line?.tension ?? 0) - 0.85) / 0.25),
          }}
        />
      )}
      {playing && monsterHooked && monsterFish && (
        <output className="reel-boss-hud" aria-label="Boss showdown">
          <div className="reel-boss-badge">⚠️ BOSS SHOWDOWN</div>
          <div className="reel-boss-title">
            <strong>THE MIDNIGHT MARLIN</strong>
            <span>
              PHASE {w?.voyage.legendary.phase || 1} · CREW LINES RECOMMENDED
            </span>
          </div>
          <div className="reel-boss-stamina">
            <progress
              max={CATCHES.monster.stamina}
              value={monsterFish.stamina}
              aria-label="Midnight Marlin stamina"
            />
            <span>
              {monsterFish.stamina <= 0
                ? '💀 EXHAUSTED - PULL TOGETHER!'
                : monsterFish.surge
                  ? '⚡ THRASHING!'
                  : `${Math.round((monsterFish.stamina / CATCHES.monster.stamina) * 100)}%`}
            </span>
          </div>
        </output>
      )}
      {playing && w?.players.some((p) => (p.trophyUntil ?? 0) > w.clock) && (
        <output className="reel-trophy-banner">
          <Trophy size={28} className="reel-trophy-banner-icon" />
          <div className="reel-trophy-banner-text">
            <strong>RECORD CATCH!</strong>
            <span>THE MIDNIGHT MARLIN HAS BEEN LANDED!</span>
          </div>
        </output>
      )}
      {playing && me && (me.shockedUntil ?? 0) > (w?.clock ?? 0) && (
        <div className="reel-shock-alert">
          <span>⚡ ZAPPED! ROD CONDUCTED LIGHTNING! ⚡</span>
        </div>
      )}
      {playing && me && (me.tumbleUntil ?? 0) > (w?.clock ?? 0) && (
        <div className="reel-slap-alert">
          <span>
            {lastEvent?.kind === 'slip'
              ? '🍌 SLIPPED ON A FLOPPING FISH!'
              : '💫 SMACKED FLAT ON DECK!'}
          </span>
        </div>
      )}
      <header className="reel-header">
        <a href="/" className="reel-brand">
          <span>
            <Fish size={22} />
          </span>{' '}
          REEL PROBLEMS 4<span className="reel-dot">.</span>
        </a>
        <GameToolbar
          muted={muted}
          onToggleSound={() => {
            setMuted(!muted);
            if (sound.current) {
              sound.current.unlock();
              sound.current.enabled = muted;
            }
            try {
              localStorage.setItem(
                'reel-problems-4-prefs-v1',
                JSON.stringify({ name, muted: !muted }),
              );
            } catch {
              /* Optional. */
            }
          }}
          onHelp={() => setModal('help')}
          onLeave={session ? () => setModal('leave') : undefined}
          workshop="/reel-problems-4/admin"
          voice={
            session?.peer && w
              ? {
                  session: { ...session, game: 'reel-problems-4' },
                  onSpeaking: (active) => sound.current?.duck(active),
                  snapshot: { players: w.players, nearby: false },
                }
              : undefined
          }
          voiceHint="Launch a boat with friends to use voice chat."
        />
      </header>
      {!session ? (
        <section className="reel-menu">
          <div className="reel-menu-copy">
            <span className="reel-kicker">
              <span /> JUMBLEYARD FISHING CLUB
            </span>
            <h1>
              The sea
              <br />
              keeps <em>everything.</em>
            </h1>
            <p>
              Fish. Trade. Build. Go deeper.
              <br />
              Then bring home a legend.
            </p>
            <div className="reel-meta">
              <span>
                <Users size={15} /> 1–4 anglers
              </span>
              <span>
                <Waves size={16} /> Open-sea voyage · 20–30 minutes
              </span>
            </div>
            <label className="reel-name">
              Your angler name
              <input
                maxLength={18}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Captain Questionable"
                autoComplete="nickname"
              />
            </label>
            <button
              className="reel-primary"
              disabled={!ready || busy}
              onClick={() => void enter('create')}
            >
              {busy ? (
                <LoaderCircle className="reel-spin" size={19} />
              ) : (
                <Anchor size={19} />
              )}{' '}
              {strings.launchBoat} <ArrowUpRight size={19} />
            </button>
            <div className="reel-menu-secondary">
              <button
                disabled={!ready || busy}
                onClick={() => setModal('join')}
              >
                Join friends
              </button>
              <button disabled={!ready || busy} onClick={startPractice}>
                Try solo
              </button>
            </div>
            <span className="reel-menu-note">
              One session. No hard timer. Every sinking is recoverable.
            </span>
          </div>
          <figure className="reel-menu-art">
            <img
              src="/images/reel-problems-4.webp"
              alt="Four toy anglers in a tiny coral boat are pulled across the open sea by an enormous fish."
              width={1536}
              height={1024}
            />
            <figcaption>
              <span>THE MIDNIGHT MARLIN</span>
              <strong>It waits beyond the storm line.</strong>
            </figcaption>
          </figure>
        </section>
      ) : (
        <>
          <section className="reel-scoreboard" aria-label="Voyage progress">
            <div>
              <span>{practice ? 'SOLO VOYAGE' : 'CREW VOYAGE'}</span>
              <strong>
                ${w?.voyage.wallet ?? 0}
                <small>
                  {cargoItems.length} / {w ? cargoCapacity(w) : 8} cargo
                </small>
              </strong>
              <small>earned ${w?.voyage.earned ?? 0}</small>
            </div>
            <div
              className={`reel-clock reel-band-${w?.voyage.band ?? 'coastal'}`}
            >
              <span>SEA BAND</span>
              <strong>{(w?.voyage.band ?? 'coastal').toUpperCase()}</strong>
            </div>
          </section>
          {playing && w && (
            <aside
              className={`reel-voyage-panel ${w.voyage.band}`}
              aria-label="Voyage equipment and cargo"
            >
              <div className="reel-voyage-heading">
                <span>VOYAGE LOG</span>
                <b>
                  {w.voyage.docked
                    ? `MOORED: ${w.voyage.docked.toUpperCase()}`
                    : 'AT SEA'}
                </b>
              </div>
              <div
                className="reel-voyage-route"
                aria-label="Ocean danger bands"
              >
                {(['coastal', 'offshore', 'deep'] as const).map((band) => (
                  <i
                    key={band}
                    className={w.voyage.band === band ? 'active' : ''}
                  >
                    {band}
                  </i>
                ))}
              </div>
              <p>
                Wood {materialCount(w, 'wood')} · Iron{' '}
                {materialCount(w, 'iron')} · Parts {materialCount(w, 'parts')}
              </p>
              <p>
                Personal: {personalItems.length}/3 · Demand:{' '}
                {CATCHES[w.voyage.demand].name}
              </p>
              <div className="reel-sockets">
                {Object.entries(w.voyage.installed).map(([socket, module]) => (
                  <span key={socket}>
                    <small>{socket}</small>
                    {module ? RECIPES[module].name : 'empty socket'}
                  </span>
                ))}
              </div>
              {w.voyage.docked === 'trader' && (
                <div className="reel-workshop">
                  <button onClick={() => action({ type: 'sell' })}>
                    Sell fish cargo
                  </button>
                  {Object.entries(RECIPES).map(([recipe, spec]) => (
                    <button
                      key={recipe}
                      onClick={() =>
                        action({
                          type: 'craft',
                          recipe: recipe as keyof typeof RECIPES,
                        })
                      }
                    >
                      Build {spec.name} · ${spec.price}
                    </button>
                  ))}
                </div>
              )}
              {personalItems
                .filter((item) => item.category === 'module')
                .map((item) => (
                  <button
                    className="reel-install"
                    key={item.id}
                    onClick={() => action({ type: 'install', itemId: item.id })}
                  >
                    Install {item.name}
                  </button>
                ))}
              {w.boat.sunk && (
                <div className="reel-workshop danger">
                  <button onClick={() => action({ type: 'salvage' })}>
                    Recover nearest salvage
                  </button>
                  <button onClick={() => action({ type: 'build-raft' })}>
                    Lash salvage raft
                  </button>
                </div>
              )}
              {w.voyage.wreck.raft && w.voyage.docked === 'repair' && (
                <button
                  className="reel-install"
                  onClick={() => action({ type: 'rebuild' })}
                >
                  Rebuild boat · $20
                </button>
              )}
            </aside>
          )}
          {playing && w?.weather && (
            <aside
              className={`reel-weather ${w.weather.kind}`}
              aria-label="Sea conditions"
            >
              <Waves size={18} aria-hidden="true" />
              <div>
                <strong>{WEATHER_LABELS[w.weather.kind]}</strong>
                {seaLife.some((v) => v.kind === 'shark') && (
                  <span>Shark circling</span>
                )}
                {seaLife.some((v) => v.kind === 'jellyfish') && (
                  <span>Jellyfish nearby</span>
                )}
                {seaLife.some((v) => v.kind === 'gull') && (
                  <span>Seagulls overhead</span>
                )}
                {w.crab && (
                  <span>
                    {crabCarrier
                      ? `${crabCarrier.name} has the crab`
                      : 'Crab aboard!'}
                  </span>
                )}
                {w.leak && <span>LEAK!</span>}
              </div>
            </aside>
          )}
          <aside className="reel-crew" aria-label="Boat crew">
            <div className="reel-crew-title">
              <span>
                <Users size={15} /> {w?.players.length ?? 0}/4 ABOARD
              </span>
              <button
                onClick={() => {
                  setCopied(false);
                  setModal('invite');
                }}
                disabled={practice}
              >
                Invite
              </button>
            </div>
            {w?.players.map((p) => (
              <div className="reel-crew-person" key={p.id}>
                <i style={{ background: ANGLER_COLORS[p.color] }} />
                <span>
                  {p.name}
                  {p.id === session.id ? ' (you)' : p.bot ? ' (NPC)' : ''}
                </span>
                <small>
                  {p.swimming
                    ? w && w.clock < p.downedUntil
                      ? 'under!'
                      : p.clinging
                        ? p.climb > 0
                          ? `climbing ${Math.round(p.climb * 100)}%`
                          : 'climbing'
                        : 'swimming'
                    : w?.crab?.carrier === p.id
                      ? 'carrying crab'
                      : p.paddle
                        ? 'paddling'
                        : p.input.reel && w && handsOnHull(w, p) === 'patch'
                          ? 'patching'
                          : p.input.reel && w && handsOnHull(w, p) === 'bail'
                            ? 'bailing'
                            : p.line?.tangled
                              ? 'tangled'
                              : p.line?.kind === 'fish'
                                ? 'fish on!'
                                : 'aboard'}
                </small>
              </div>
            ))}
            <div className="reel-gear">
              {w?.gear.tire || w?.gear.magnet || w?.gear.boot ? (
                <>
                  {w.gear.tire && <span>Tyre: steadier boat</span>}
                  {w.gear.magnet && <span>Magnet: wider bite zone</span>}
                  {w.gear.boot && <span>Lucky boot: faster catches</span>}
                </>
              ) : (
                <span>Hook junk to upgrade the boat.</span>
              )}
            </div>
          </aside>
          <button
            className="reel-camera"
            onClick={() => scene.current?.changeCamera()}
            aria-label="Switch sea camera"
          >
            <Camera size={19} />
            <span>View</span>
          </button>
          {w?.phase === 'lobby' && (
            <section className="reel-lobby">
              <span className="reel-kicker">YOUR BOAT IS READY</span>
              <h2>All aboard?</h2>
              <p>Share the code. The captain starts when the crew is ready.</p>
              <button
                className="reel-room-code"
                onClick={() => {
                  setCopied(false);
                  setModal('invite');
                }}
              >
                {session.code} <Copy size={19} />
              </button>
              <CrewSlots
                players={w.players}
                host={captain}
                busy={npcBusy || busy || status !== 'online'}
                onAction={(a) => action(a)}
              />
              <button
                className="reel-primary"
                disabled={!captain || busy || npcBusy || status !== 'online'}
                onClick={() => action({ type: 'start' })}
              >
                {captain ? 'Begin open-sea voyage' : 'Waiting for the captain…'}{' '}
                <ArrowUpRight size={18} />
              </button>
            </section>
          )}
          {playing && (
            <>
              <section
                className="reel-line-panel"
                aria-label="Your fishing line"
              >
                <span
                  className={
                    fishOn?.surge || me?.line?.tangled
                      ? 'warning'
                      : me?.clinging && me.climb >= 0.75
                        ? 'almost-up'
                        : ''
                  }
                >
                  {lineLabel}
                </span>
                {!me?.swimming && (
                  <div className="reel-tension">
                    <small>LINE TENSION</small>
                    <meter
                      aria-label="Line tension"
                      min={0}
                      max={1.2}
                      low={0.65}
                      high={0.92}
                      optimum={0.35}
                      value={me?.line?.tension ?? 0}
                    />
                    <b>{Math.round((me?.line?.tension ?? 0) * 100)}%</b>
                  </div>
                )}
                {me?.swimming && (
                  <div className="reel-fish-stamina">
                    <small>CONDITION</small>
                    <progress
                      aria-label="Your condition in the water"
                      max={1}
                      value={me.health}
                    />
                    <span>
                      {downed
                        ? 'Under'
                        : me.health >= 1
                          ? 'Fine'
                          : me.health > 0.5
                            ? 'Rattled'
                            : 'Barely'}
                    </span>
                  </div>
                )}
                {!!w && (!!w.leak || w.boat.flood > 0.01) && (
                  <div className="reel-fish-stamina">
                    <small>WATER</small>
                    <progress
                      aria-label="Water in the boat"
                      max={1}
                      value={w.boat.flood}
                    />
                    <span>{Math.round(w.boat.flood * 100)}%</span>
                  </div>
                )}
                {w?.leak && (
                  <div className="reel-fish-stamina">
                    <small>PATCH</small>
                    <progress
                      aria-label="Leak patch progress"
                      max={1}
                      value={w.leak.patch}
                    />
                    <span>{Math.round(w.leak.patch * 100)}%</span>
                  </div>
                )}
                {me?.clinging && (
                  <div
                    className={`reel-climb-progress${me.climb >= 0.75 ? ' almost-up' : ''}${me.input.reel ? ' active' : ''}`}
                  >
                    <div className="reel-climb-header">
                      <small>
                        {me.climb >= 0.75
                          ? 'ALMOST ABOARD'
                          : me.input.reel
                            ? 'CLIMBING ABOARD'
                            : 'CLIMB ABOARD'}
                      </small>
                      <span className="reel-climb-pct">
                        {Math.round(me.climb * 100)}%
                      </span>
                    </div>
                    <progress
                      className="reel-climb-progress-bar"
                      aria-label="Climb progress"
                      max={1}
                      value={me.climb}
                    />
                  </div>
                )}
                {fishOn && (
                  <p className="reel-team-pull">
                    {helpers.length > 1
                      ? `${helpers.length} anglers on this fish · ${helpers.filter((p) => p.input.reel).length} reeling`
                      : 'Friends can cast onto this fish to help!'}
                  </p>
                )}
                {fishOn && (
                  <div className="reel-fish-stamina">
                    <small>FISH ENERGY</small>
                    <progress
                      aria-label="Fish energy"
                      max={CATCHES[fishOn.kind].stamina}
                      value={fishOn.stamina}
                    />
                    <span>
                      {fishOn.stamina <= 0
                        ? 'Bring it close!'
                        : fishOn.surge
                          ? 'Surging'
                          : 'Tiring'}
                    </span>
                  </div>
                )}
              </section>
              <TouchControls
                disabled={uiDisabled}
                move={(v) => scene.current?.move(v)}
                jump={() => action({ type: me?.swimming ? 'rescue' : 'jump' })}
              />
              <nav className="reel-action-dock" aria-label="Fishing actions">
                <button
                  className={`reel-action${w?.voyage.helm.owner === me?.id ? ' active' : ''}`}
                  onClick={() => action({ type: 'helm' })}
                  disabled={uiDisabled || me?.swimming}
                >
                  <Anchor size={18} />
                  <span>
                    {w?.voyage.helm.owner === me?.id
                      ? 'Leave helm'
                      : 'Take helm'}
                    <kbd>H</kbd>
                  </span>
                </button>
                {w?.voyage.helm.owner === me?.id && (
                  <button
                    className="reel-action"
                    onClick={() => action({ type: 'heading' })}
                    disabled={uiDisabled}
                  >
                    <span>
                      {w.voyage.helm.headingHold === null
                        ? 'Hold heading'
                        : 'Free steer'}
                    </span>
                  </button>
                )}
                <button
                  className={`reel-action${carryingCrab ? ' active' : ''}`}
                  onClick={() => action({ type: 'work' })}
                  disabled={uiDisabled || me?.swimming || !canWork}
                >
                  <Hand size={18} />
                  <span>
                    {workLabel}
                    <kbd>C</kbd>
                  </span>
                </button>
                <button
                  className="reel-action"
                  onClick={() => action({ type: 'cast' })}
                  disabled={uiDisabled || !!me?.line || me?.swimming}
                >
                  <Fish size={18} />
                  <span>
                    Cast<kbd>Space</kbd>
                  </span>
                </button>
                <HoldButton
                  label={
                    me?.clinging
                      ? me.climb >= 0.75
                        ? 'Almost aboard! Keep holding'
                        : me.climb > 0
                          ? `Climbing: ${Math.round(me.climb * 100)}%`
                          : 'Hold to climb'
                      : hands === 'patch'
                        ? 'Hold to patch the leak'
                        : hands === 'bail'
                          ? 'Hold to bail'
                          : 'Hold to reel'
                  }
                  active={!!me?.input.reel}
                  hold={(held) => scene.current?.hold('reel', held)}
                  disabled={
                    uiDisabled || (!me?.line && !me?.clinging && !hands)
                  }
                  progress={
                    me?.clinging
                      ? me.climb
                      : hands === 'patch' && w?.leak
                        ? w.leak.patch
                        : undefined
                  }
                >
                  <Anchor size={18} />
                  <span>
                    {me?.clinging
                      ? me.climb >= 0.75
                        ? 'Almost up!'
                        : me.climb > 0
                          ? `Climb ${Math.round(me.climb * 100)}%`
                          : 'Climb'
                      : hands === 'patch'
                        ? 'Patch'
                        : hands === 'bail'
                          ? 'Bail'
                          : 'Reel'}
                    <kbd>Hold E</kbd>
                  </span>
                </HoldButton>
                <HoldButton
                  label="Hold to brace"
                  active={!!me?.input.brace}
                  hold={(held) => scene.current?.hold('brace', held)}
                  disabled={uiDisabled || !!me?.swimming}
                >
                  <Waves size={18} />
                  <span>
                    Brace<kbd>Shift</kbd>
                  </span>
                </HoldButton>
                <button
                  className="reel-action reel-jump-action"
                  disabled={uiDisabled || me?.swimming}
                  onClick={() => action({ type: 'jump' })}
                >
                  <ArrowUp size={18} />
                  <span>
                    Jump<kbd>J</kbd>
                  </span>
                </button>
                <button
                  className="reel-action"
                  disabled={
                    uiDisabled || me?.swimming || (!me?.paddle && !!me?.line)
                  }
                  onClick={() => action({ type: 'paddle' })}
                >
                  <span>
                    {me?.paddle ? 'Stow' : 'Paddle'}
                    <kbd>P</kbd>
                  </span>
                </button>
                <button
                  className="reel-action"
                  disabled={uiDisabled || !me?.line?.tangled}
                  onClick={() => action({ type: 'untangle' })}
                >
                  <span>
                    Untangle<kbd>R</kbd>
                  </span>
                </button>
                <button
                  className="reel-action"
                  disabled={uiDisabled || !me?.line}
                  onClick={() => action({ type: 'cut' })}
                >
                  <Scissors size={18} />
                  <span>
                    Cut<kbd>Q</kbd>
                  </span>
                </button>
                <button
                  className="reel-action"
                  disabled={uiDisabled}
                  onClick={() => action({ type: 'rescue' })}
                >
                  <LifeBuoy size={18} />
                  <span>
                    {me?.swimming ? 'Grab on' : 'Rescue'}
                    <kbd>F</kbd>
                  </span>
                </button>
              </nav>
              <span className="reel-movement-hint">
                WASD / arrows · move or steer/throttle at helm · H helm · C
                interact or throw · E reel, patch or bail
              </span>
            </>
          )}
          {done && (
            <section className="reel-results">
              <Trophy size={37} />
              <span className="reel-kicker">VOYAGE COMPLETE</span>
              <h2>The legend is aboard.</h2>
              <p>
                The crew landed the Midnight Marlin and earned $
                {w?.voyage.earned}.
                <br />
                {w?.players.reduce((sum, p) => sum + p.catches, 0)} catches.{' '}
                {w?.players.reduce((sum, p) => sum + p.splashes, 0)} unplanned
                swims.
                {w?.sinks
                  ? ` ${w.sinks} ${w.sinks === 1 ? 'boat' : 'boats'} sunk.`
                  : ''}
              </p>
              <div className="reel-haul">
                {Object.entries(w?.haul ?? {}).map(([kind, count]) => (
                  <span key={kind}>
                    {CATCHES[kind as keyof typeof CATCHES].name} <b>×{count}</b>
                  </span>
                ))}
              </div>
              {w && (
                <div
                  className="reel-awards"
                  aria-label="Tournament Superlatives"
                >
                  <h3>🏆 Hall of Fame & Shame</h3>
                  <div className="reel-awards-grid">
                    {getAwards(w.players).map((award) => (
                      <div className="reel-award-card" key={award.title}>
                        <span className="reel-award-icon">{award.icon}</span>
                        <div className="reel-award-info">
                          <strong>{award.title}</strong>
                          <span
                            className="reel-award-winner"
                            style={{ color: award.color }}
                          >
                            {award.player}
                          </span>
                          <small>{award.desc}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!practice && w && (
                <CrewSlots
                  players={w.players}
                  host={captain}
                  busy={npcBusy || busy || status !== 'online'}
                  onAction={(a) => action(a)}
                />
              )}
              <button
                data-party-setup-action=""
                className="reel-primary"
                disabled={!captain || busy || npcBusy || status !== 'online'}
                onClick={() => action({ type: 'restart' })}
              >
                {captain ? 'Start another voyage' : 'Waiting for the captain…'}
              </button>
              <button className="reel-text-button" onClick={() => void leave()}>
                Back to the dock
              </button>
            </section>
          )}
        </>
      )}
      {(notice ||
        (session && status !== 'online') ||
        (playing && lastEvent)) && (
        <output className="reel-notice">
          {notice ||
            (status === 'expired'
              ? 'This room expired. Leave the boat and join again.'
              : status === 'reconnecting'
                ? 'Connecting to your crew…'
                : lastEvent?.text)}
        </output>
      )}
      {!ready && !notice && (
        <output className="reel-loading">
          <LoaderCircle className="reel-spin" size={18} /> Getting the boat
          ready…
        </output>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="reel-dialog">
          <DialogTitle>
            {modal === 'help'
              ? 'A quick fishing lesson'
              : modal === 'join'
                ? 'Find your crew'
                : modal === 'invite'
                  ? 'There is room for trouble.'
                  : modal === 'restart'
                    ? 'Start a fresh tournament?'
                    : 'Back to the dock?'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'help'
              ? 'Catch enough points in five minutes. Keep your crew in the boat.'
              : modal === 'join'
                ? 'Ask a friend for their six-character boat code.'
                : modal === 'invite'
                  ? 'Up to four anglers can join before the tournament starts.'
                  : 'Your friends can keep fishing when you leave.'}
          </DialogDescription>
          {modal === 'help' && (
            <div className="reel-help">
              <p>
                <b>Move:</b> WASD / arrows or the joystick. Walk against the
                lean to balance the boat. Steep decks send you sliding
                overboard; hold Shift to brace. Even bracing has limits in
                extreme tilts.
              </p>
              <p>
                <b>Jump:</b> J or the Jump button. Landing rocks the boat. Jump
                at the rail while moving toward the water to dive in — sharks go
                for swimmers, so have a way back.
              </p>
              <p>
                <b>Paddle:</b> stand at a rail and press P. W strokes forward
                and S back. A lone paddler also swings the bow away from their
                side, so paddle on both rails to go straight. No fishing with a
                paddle in hand.
              </p>
              <p>
                <b>Leaks:</b> a cracked plank sprays water. Stand on it and hold
                E for five seconds, faster with a friend. After ten seconds the
                water pours in; hold E at the bucket to bail and buy time. If
                the boat fills it sinks with all your gear, and you swim for a
                new one at the dock while the sharks close in. Driftwood, shark
                bumps, thunder waves and two anglers landing jumps together can
                all crack a plank.
              </p>
              <p>
                <b>Critters:</b> seagulls dive for fresh catches, so jump while
                one swoops or it steals the fish. Crabs climb out of the live
                well and pinch; land a jump on one to punt it overboard.
                Cannonball in beside small fish to stun them, and the next cast
                bites at once.
              </p>
              <p>
                <b>Cast:</b> click a fish on the lake, or Space for a nearby
                catch. Your hook can catch friends too.
              </p>
              <p>
                <b>Reel:</b> hold E while the fish is tired. Release during a
                surge or red tension. Shift braces your feet.
              </p>
              <p>
                <b>Team pull:</b> cast onto a friend’s fish to help. Each line
                adds pulling power and tires the fish faster. Everyone attached
                shares catch credit; losing one line leaves the others fishing.
              </p>
              <p>
                <b>Wild water:</b> gusts push and rock the boat, rain makes the
                deck slippery, and thunderstorms bring big waves. Sharks bump
                the hull; glowing jellyfish snag nearby hooks. Brace, balance,
                and use R to free your line.
              </p>
              <p>
                <b>In the water:</b> swim to the hull and you grab hold
                automatically, then hold E for five seconds to climb aboard.
                WASD shimmies you along the side. A shark will leave the boat
                alone and come straight for a swimmer — two bites and you go
                under, costing the crew points. A jellyfish sting shocks your
                hands open and drops you off the hull.
              </p>
              <p>
                <b>Tangles:</b> crossed lines knot together. R loosens nearby
                knots; spread out, or Q cuts free.
              </p>
              <p>
                <b>Rescue:</b> F pulls a nearby friend straight aboard, or
                reaches for the hull when you are the one swimming. You can also
                reel a swimming friend closer. A safety rope returns you after
                twelve seconds.
              </p>
              <p>
                <b>Junk:</b> tyres steady the boat, magnets widen the bite zone,
                and a lucky boot helps tire fish.
              </p>
              <p>
                Touch players: use the joystick, the Jump button above it, and
                the fishing buttons. Hold Reel and Brace; tap the other actions.
              </p>
            </div>
          )}
          {modal === 'join' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void enter('join');
              }}
              className="reel-join-form"
            >
              <label>
                Your name
                <input
                  value={name}
                  maxLength={18}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Angler"
                  autoComplete="nickname"
                />
              </label>
              <label>
                Boat code
                <input
                  value={code}
                  maxLength={6}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''),
                    )
                  }
                  placeholder="ABCDEF"
                  autoComplete="off"
                />
              </label>
              <button
                className="reel-primary"
                disabled={busy || code.length !== 6 || !ready}
              >
                {busy ? 'Joining…' : 'Jump aboard'} <ArrowUpRight size={17} />
              </button>
              {notice && <p role="alert">{notice}</p>}
            </form>
          )}
          {modal === 'invite' && (
            <>
              <div className="reel-room-code">{session?.code}</div>
              <button
                className="reel-primary"
                onClick={() => void copyInvite()}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Invite copied' : 'Copy invite link'}
              </button>
              <p className="reel-small">
                Your crew opens the link, enters a name, and joins the boat.
              </p>
            </>
          )}
          {modal === 'leave' && (
            <button
              className="reel-primary"
              disabled={busy}
              onClick={() => void leave()}
            >
              {busy ? 'Leaving…' : 'Leave the boat'}
            </button>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
