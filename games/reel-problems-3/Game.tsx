'use client';
/* oxlint-disable react/react-compiler -- WebGL and realtime input intentionally live in refs. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Anchor,
  Bot,
  Check,
  Fish,
  HelpCircle,
  LifeBuoy,
  MousePointer2,
  RotateCcw,
  Trophy,
  Users,
  Waves,
} from 'lucide-react';
import GameToolbar from '../../shared/ui/GameToolbar';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import { useLanguage } from '../../shared/language/useLanguage';
import { gameActive } from '../../shared/browser/game-lifecycle';
import { isTouchDevice } from '../../shared/browser/device';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { partyGoal, partyRound } from '../../shared/ui/party-round';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import {
  advanceWorld,
  adventureAction,
  freshWorld,
  setInput,
  snapshot as makeSnapshot,
} from './simulation';
import { createPlayer } from './players';
import {
  idleInput,
  type AdventureInput,
  type AdventureSnapshot,
  type AdventureWorld,
} from './types';
import { crewAwards, objective, PHASE_NAMES, promptFor } from './presentation';
import { reelProblems3Analytics, reelProblems3PlayState } from './analytics';
import { VoyageAudio } from './audio';
import type { ReelProblems3Scene } from './scene';
import './style.css';

const tracker = new GameTracker(reelProblems3Analytics);
const crewColors = ['#ef7057', '#f6b94d', '#47a8a0', '#7d85c9'];

export default function ReelProblems3Game() {
  useGameTracker(tracker);
  const { language } = useLanguage();
  const de = language === 'de';
  const say = (english: string, german: string) => (de ? german : english);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReelProblems3Scene | null>(null);
  const sound = useRef<VoyageAudio | null>(null);
  const local = useRef<AdventureWorld | null>(null);
  const latest = useRef<AdventureSnapshot | null>(null);
  const self = useRef('local');
  const connected = useRef(false);
  const blocked = useRef(true);
  const controls = useRef<AdventureInput>(idleInput());
  const keys = useRef(new Set<string>());
  const touchLook = useRef<{ id: number; x: number; y: number } | null>(null);
  const hud = useRef(
    hudPacer<AdventureSnapshot>((snap) => {
      const world = snap.world;
      const player = world.players.find(
        (candidate) => candidate.id === snap.selfId,
      );
      return `${world.phase}:${world.activeMission}:${world.missions.map((mission) => mission.progress.toFixed(1)).join('|')}:${Math.round(world.boat.hull)}:${Math.round(world.boat.water)}:${Math.round(world.boat.speed)}:${player?.line?.state ?? ''}:${player?.line?.tension.toFixed(1) ?? ''}:${player?.held.join(',') ?? ''}:${world.events.at(-1)?.id ?? 0}:${Math.floor(world.clock / 500)}`;
    }),
  );
  const [snapshot, setSnapshot] = useState<AdventureSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState('');
  const [touch, setTouch] = useState(false);

  useEffect(() => setTouch(isTouchDevice()), []);

  const receive = useCallback((next: AdventureSnapshot) => {
    latest.current = next;
    scene.current?.render(next);
    sound.current?.update(next);
    tracker.observe(reelProblems3PlayState(next));
    if (hud.current.due(next)) setSnapshot(next);
  }, []);

  const room = usePeerRoom<AdventureSnapshot>({
    game: 'reel-problems-3',
    loadEngine: () => import('./peer'),
    readInput: () =>
      blocked.current || !gameActive() ? idleInput() : controls.current,
    idleInput,
    onAttach: (session) => {
      local.current = null;
      connected.current = true;
      self.current = session.id;
      scene.current?.setLocalPlayer(session.id);
      hud.current.reset();
    },
    onOpen: () => {
      keys.current.clear();
      Object.assign(controls.current, idleInput());
      if (document.pointerLockElement) document.exitPointerLock?.();
    },
    receive,
  });

  const world = snapshot?.world;
  const me = world?.players.find((player) => player.id === self.current);
  const menu = !world || world.phase === 'lobby';
  const ended = world ? ['finished', 'failed'].includes(world.phase) : false;
  const isHost = !room.session || snapshot?.host === self.current;
  const disabled =
    !ready ||
    menu ||
    ended ||
    help ||
    room.open ||
    room.busy ||
    (!!room.session && room.status !== 'online');

  useLayoutEffect(() => {
    blocked.current = disabled;
    if (disabled) {
      controls.current.x = 0;
      controls.current.z = 0;
      controls.current.jump = false;
      controls.current.brace = false;
      controls.current.reel = false;
      controls.current.throttle = 0;
      controls.current.steer = 0;
      keys.current.clear();
    }
  }, [disabled]);

  const act = useCallback(
    (type: string, extra: Record<string, unknown> = {}) => {
      if (!ready || !gameActive()) return;
      setError('');
      sound.current?.unlock();
      tracker.action(type);
      const action = { type, ...extra };
      if (room.send(action)) return;
      const active = local.current;
      if (!active) return;
      try {
        adventureAction(active, self.current, action, true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'That did not work.');
      }
      hud.current.reset();
      receive(
        makeSnapshot(active, 'SOLO', self.current, self.current, active.tick),
      );
    },
    [ready, receive, room],
  );

  const interact = useCallback(() => {
    const selected = scene.current?.target() ?? target;
    if (!selected) {
      setError(
        de
          ? 'Schau zuerst auf ein umrandetes Objekt.'
          : 'Look at an outlined object first.',
      );
      return;
    }
    act('interact', { target: selected });
  }, [act, target, de]);

  const fishAction = useCallback(() => {
    const player = latest.current?.world.players.find(
      (candidate) => candidate.id === self.current,
    );
    if (player?.line?.state === 'biting') act('hook');
    else if (player?.line?.state === 'tangled') act('untangle');
    else if (!player?.line) act('cast', { power: 0.72 });
  }, [act]);

  useEffect(() => sound.current?.setEnabled(!muted), [muted]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let view: ReelProblems3Scene | null = null;
    let previous = performance.now();
    let published = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      controls.current.yaw = scene.current?.getYaw() ?? controls.current.yaw;
      const active = local.current;
      if (!active || !gameActive()) {
        previous = now;
        return;
      }
      setInput(
        active,
        self.current,
        blocked.current ? idleInput() : controls.current,
      );
      if (!['lobby', 'finished', 'failed'].includes(active.phase))
        advanceWorld(active, active.clock + Math.min(100, now - previous));
      scene.current?.renderWorld(active);
      previous = now;
      if (now - published > 42) {
        published = now;
        receive(
          makeSnapshot(active, 'SOLO', self.current, self.current, active.tick),
        );
      }
    };
    void import('./scene')
      .then(({ ReelProblems3Scene: Scene }) => {
        if (cancelled || !host.current) return;
        view = new Scene(host.current, setTarget);
        view.setLocalPlayer(self.current);
        scene.current = view;
        sound.current = new VoyageAudio();
        if (!connected.current) {
          const active = freshWorld(Date.now());
          active.players = active.players.filter((player) => player.seat !== 0);
          active.players.push(
            Object.assign(createPlayer(0, active.clock, false, 'local'), {
              name: 'You',
            }),
          );
          active.players.sort((a, b) => a.seat - b.seat);
          local.current = active;
          receive(makeSnapshot(active, 'SOLO', 'local', 'local', 0));
        } else if (latest.current) view.render(latest.current);
        setReady(true);
        window.dispatchEvent(new Event('game:party-ready'));
        frame = requestAnimationFrame(loop);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'The fishing grounds could not load.',
        ),
      );
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      view?.dispose();
      sound.current?.dispose();
      scene.current = null;
      sound.current = null;
      local.current = null;
    };
  }, [receive]);

  useEffect(() => {
    const update = () => {
      controls.current.x =
        (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
        (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0);
      controls.current.z =
        (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
        (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0);
      controls.current.sprint =
        keys.current.has('ShiftLeft') || keys.current.has('ShiftRight');
      controls.current.reel = keys.current.has('KeyR');
      controls.current.jump = keys.current.has('Space');
      controls.current.brace = keys.current.has('KeyB');
      controls.current.throttle = keys.current.has('KeyW')
        ? 1
        : keys.current.has('KeyS')
          ? -0.4
          : 0;
      controls.current.steer = keys.current.has('KeyA')
        ? -1
        : keys.current.has('KeyD')
          ? 1
          : 0;
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target as HTMLElement)?.closest?.(
          'input,textarea,select,button,a,[role="dialog"]',
        )
      )
        return;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyE',
          'KeyF',
          'KeyQ',
          'KeyR',
          'KeyB',
          'Space',
          'ShiftLeft',
          'ShiftRight',
        ].includes(event.code)
      )
        event.preventDefault();
      if (event.type === 'keydown') keys.current.add(event.code);
      else keys.current.delete(event.code);
      update();
      if (event.type === 'keydown' && !event.repeat) {
        if (event.code === 'KeyE') interact();
        if (event.code === 'KeyF') fishAction();
        if (event.code === 'KeyQ') act('drop');
      }
    };
    const down = (event: KeyboardEvent) => key(event);
    const up = (event: KeyboardEvent) => key(event);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [act, fishAction, interact]);

  const touchLookMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const last = touchLook.current;
    if (!last || last.id !== event.pointerId) return;
    scene.current?.look(
      (event.clientX - last.x) * 1.2,
      (event.clientY - last.y) * 1.2,
    );
    touchLook.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };
  const mission = world?.missions[world.activeMission];
  const incident = world?.incidents.find((candidate) => !candidate.resolved);
  const timeLeft =
    world && world.round.roundEndsAt > 0
      ? Math.max(0, world.round.roundEndsAt - world.clock)
      : 0;
  const progress = world
    ? world.activeMission / Math.max(1, world.missions.length) +
      (mission
        ? mission.progress / Math.max(1, mission.goal) / world.missions.length
        : 0)
    : 0;
  const awards = world ? crewAwards(world) : [];

  return (
    <main
      className={`rp3 ${world ? `phase-${world.phase}` : ''} ${touch ? 'is-touch' : ''}`}
      {...partyRound(
        !!room.session && ended,
        world
          ? partyGoal(world.phase === 'finished', me?.stats.score ?? 0)
          : null,
      )}
    >
      <div ref={host} className="rp3-stage" />
      <div className="rp3-vignette" aria-hidden="true" />
      <header className="rp3-topbar">
        <a href="/" className="rp3-brand">
          <span>REEL</span> PROBLEMS <b>3</b>
        </a>
        <GameToolbar
          voice={room.voice}
          multiplayer={<PeerRoomControls room={room} />}
          muted={muted}
          onToggleSound={() => setMuted((value) => !value)}
          onHelp={() => setHelp(true)}
        />
      </header>

      {!menu && !ended && world ? (
        <>
          <section className="rp3-objective">
            <small>
              {PHASE_NAMES[world.phase]} · {Math.ceil(timeLeft / 1000)}s
            </small>
            <strong>{objective(world)}</strong>
            <span>
              <i style={{ width: `${Math.min(100, progress * 100)}%` }} />
            </span>
          </section>
          <section className="rp3-crew">
            {world.players.map((player) => (
              <div
                key={player.id}
                className={`${player.id === self.current ? 'is-you' : ''} ${player.overboard ? 'is-overboard' : ''}`}
              >
                <i
                  style={
                    {
                      '--crew-color': crewColors[player.color % 4],
                    } as CSSProperties
                  }
                />
                <span>{player.name}</span>
                {player.bot ? (
                  <Bot size={13} />
                ) : player.overboard ? (
                  <LifeBuoy size={14} />
                ) : (
                  <b>{player.stats.score}</b>
                )}
              </div>
            ))}
          </section>
          <section className="rp3-contracts">
            {world.missions.map((contract, index) => (
              <article
                key={contract.id}
                className={
                  contract.complete
                    ? 'is-complete'
                    : index === world.activeMission
                      ? 'is-current'
                      : ''
                }
              >
                <span>{contract.complete ? <Check /> : index + 1}</span>
                <div>
                  <small>CONTRACT {index + 1}</small>
                  <strong>{contract.label}</strong>
                </div>
              </article>
            ))}
          </section>
          {incident ? (
            <output className={`rp3-chaos is-${incident.severity}`}>
              <Waves /> DECK CHAOS · {incident.kind.replaceAll('-', ' ')}
            </output>
          ) : null}
          <div className="rp3-crosshair" aria-hidden="true">
            <i />
            <i />
          </div>
          <output className={`rp3-prompt ${target ? 'is-ready' : ''}`}>
            <MousePointer2 size={15} /> {promptFor(world, target)}
          </output>
          <section className="rp3-vitals">
            <div>
              <span>HULL</span>
              <i>
                <b style={{ width: `${world.boat.hull}%` }} />
              </i>
            </div>
            <div>
              <span>BILGE</span>
              <i>
                <b
                  className="water"
                  style={{ width: `${world.boat.water}%` }}
                />
              </i>
            </div>
            {me?.line ? (
              <div
                className={`rp3-tension ${me.line.tension > 0.9 ? 'is-hot' : ''}`}
              >
                <span>LINE</span>
                <i>
                  <b
                    style={{
                      width: `${Math.min(100, me.line.tension * 100)}%`,
                    }}
                  />
                </i>
              </div>
            ) : null}
          </section>
          {me?.held.length ? (
            <div className="rp3-hands">
              HOLDING ·{' '}
              {me.held
                .map((id) => world.items.find((item) => item.id === id)?.kind)
                .join(' + ')}{' '}
              <kbd>Q DROP</kbd>
            </div>
          ) : null}
        </>
      ) : null}

      {menu ? (
        <section className="rp3-opening">
          <div className="rp3-journal">
            <span className="rp3-kicker">
              <Fish /> FIRST-PERSON PARTY FISHING
            </span>
            <h1>
              <span>Catch together.</span>
              <em>Score alone.</em>
            </h1>
            <p>
              {say(
                'Load one shared boat, race between wild fishing grounds, fight physical catches and get home before the harbor bell. Empty crew slots are filled by capable chaos bots.',
                'Beladet ein gemeinsames Boot, rast zwischen wilden Fanggründen, kämpft mit echten Fischen und kommt vor der Hafenglocke zurück. Freie Plätze werden von Chaos-Bots besetzt.',
              )}
            </p>
            <div className="rp3-feature-row">
              <span>
                <Users /> 1–4
              </span>
              <span>
                <Fish /> 3 CONTRACTS
              </span>
              <span>
                <Waves /> 8 MIN
              </span>
            </div>
            {!room.session ? (
              <div className="rp3-opening-actions">
                <button
                  className="rp3-primary"
                  disabled={!ready}
                  onClick={() => act('start')}
                >
                  <Anchor /> START WITH BOTS
                </button>
                <button
                  className="rp3-secondary"
                  onClick={() => room.setOpen(true)}
                >
                  <Users /> INVITE FRIENDS
                </button>
              </div>
            ) : (
              <div className="rp3-lobby">
                <strong>{room.session.code}</strong>
                <p>{room.players.map((player) => player.name).join(' · ')}</p>
                {isHost ? (
                  <button className="rp3-primary" onClick={() => act('start')}>
                    <Anchor /> CAST OFF
                  </button>
                ) : (
                  <output>Waiting for the crew leader.</output>
                )}
              </div>
            )}
            <small className="rp3-opening-note">
              WASD MOVE · E USE · F CAST/HOOK · HOLD R REEL · Q DROP
            </small>
          </div>
        </section>
      ) : null}

      {ended && world ? (
        <section className="rp3-finale">
          <div className="rp3-finale-copy">
            <span className="rp3-kicker">
              {world.phase === 'finished' ? <Trophy /> : <Waves />}{' '}
              {world.phase === 'finished' ? 'CATCH DELIVERED' : 'ROUND LOST'}
            </span>
            <h2>
              {world.phase === 'finished'
                ? 'The harbor bell rang for you.'
                : objective(world)}
            </h2>
            <div className="rp3-awards">
              {awards.slice(0, 4).map((award) => (
                <article key={award.title}>
                  <small>{award.title}</small>
                  <strong>{award.player}</strong>
                  <span>{award.detail}</span>
                </article>
              ))}
            </div>
            {isHost ? (
              <button className="rp3-primary" onClick={() => act('restart')}>
                <RotateCcw /> PLAY AGAIN
              </button>
            ) : (
              <output>Waiting for the crew leader.</output>
            )}
          </div>
        </section>
      ) : null}

      {error ? (
        <output className="rp3-error" onAnimationEnd={() => setError('')}>
          {error}
        </output>
      ) : null}
      {help ? (
        <dialog open className="rp3-help">
          <article>
            <button onClick={() => setHelp(false)}>×</button>
            <HelpCircle />
            <h2>Deck guide</h2>
            <p>
              Load real equipment into its matching rack. One player takes the
              helm; everyone else fishes, stores catches, repairs damage, and
              rescues friends. Fish bite briefly—press F, then hold R only while
              tension is safe.
            </p>
            <small>
              WASD move · E interact · F cast/hook · R reel · Space jump · B
              brace · Q drop
            </small>
          </article>
        </dialog>
      ) : null}
      {touch && !disabled ? (
        <div className="rp3-touch">
          <div
            className="rp3-touch-look"
            onPointerDown={(event) => {
              touchLook.current = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              };
            }}
            onPointerMove={touchLookMove}
            onPointerUp={() => {
              touchLook.current = null;
            }}
          />
          <div className="rp3-touch-actions">
            <button
              onPointerDown={() => {
                controls.current.z = 1;
              }}
              onPointerUp={() => {
                controls.current.z = 0;
              }}
            >
              ▲
            </button>
            <button onClick={interact}>USE</button>
            <button onClick={fishAction}>FISH</button>
            <button
              aria-label="Jump"
              onPointerDown={() => {
                controls.current.jump = true;
              }}
              onPointerUp={() => {
                controls.current.jump = false;
              }}
              onPointerCancel={() => {
                controls.current.jump = false;
              }}
            >
              JUMP
            </button>
            <button
              aria-label="Brace"
              onPointerDown={() => {
                controls.current.brace = true;
              }}
              onPointerUp={() => {
                controls.current.brace = false;
              }}
              onPointerCancel={() => {
                controls.current.brace = false;
              }}
            >
              BRACE
            </button>
            <button
              onPointerDown={() => {
                controls.current.reel = true;
              }}
              onPointerUp={() => {
                controls.current.reel = false;
              }}
            >
              REEL
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
