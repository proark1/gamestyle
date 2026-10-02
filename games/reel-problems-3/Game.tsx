'use client';
/* oxlint-disable react/react-compiler -- WebGL, input, and local simulation intentionally live in refs. */
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
  Check,
  Compass,
  Fish,
  Footprints,
  HelpCircle,
  LifeBuoy,
  MousePointer2,
  RotateCcw,
  Sparkles,
  Users,
  Waves,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import GameToolbar from '../../shared/ui/GameToolbar';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import { useLanguage } from '../../shared/language/useLanguage';
import { gameActive } from '../../shared/browser/game-lifecycle';
import {
  isTouchDevice,
  prefersReducedMotion,
} from '../../shared/browser/device';
import { hudPacer } from '../../shared/ui/hud-pacer';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import {
  advanceWorld,
  adventureAction,
  freshWorld,
  newPlayer,
  setInput,
  snapshot as makeSnapshot,
} from './simulation';
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

type Controls = AdventureInput;
const freshControls = (): Controls => ({ x: 0, z: 0, yaw: 0, sprint: false });

export default function ReelProblems3Game() {
  useGameTracker(tracker);
  const { language } = useLanguage();
  const de = language === 'de';
  const say = (en: string, german: string) => (de ? german : en);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReelProblems3Scene | null>(null);
  const sound = useRef<VoyageAudio | null>(null);
  const local = useRef<AdventureWorld | null>(null);
  const latest = useRef<AdventureSnapshot | null>(null);
  const self = useRef('local');
  const connected = useRef(false);
  const blocked = useRef(true);
  const controls = useRef<Controls>(freshControls());
  const keys = useRef(new Set<string>());
  const touchLook = useRef<{ id: number; x: number; y: number } | null>(null);
  const hud = useRef(
    hudPacer<AdventureSnapshot>((snap) => {
      const world = snap.world;
      return `${world.phase}:${world.beaconIndex}:${world.loaded.length}:${world.beacons.map((beacon) => `${beacon.aligned}-${beacon.active}`).join('|')}:${world.routeProgress}:${world.stormProgress}:${Math.round(world.hull)}:${Math.round(world.water)}:${world.lanterns.length}:${world.toneIndex}:${world.events.at(-1)?.id ?? 0}:${Math.floor(world.clock / 500)}`;
    }),
  );
  const [snapshot, setSnapshot] = useState<AdventureSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [touch] = useState(() =>
    typeof window === 'undefined' ? false : isTouchDevice(),
  );

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
      Object.assign(controls.current, freshControls());
      if (document.pointerLockElement) document.exitPointerLock?.();
    },
    receive,
  });

  const world = snapshot?.world;
  const menu = !world || world.phase === 'lobby';
  const finished = world?.phase === 'finished';
  const isHost = !room.session || snapshot?.host === self.current;
  const disabled =
    !ready ||
    menu ||
    finished ||
    world?.phase === 'homecoming' ||
    help ||
    room.open ||
    room.busy ||
    (!!room.session && room.status !== 'online');

  useLayoutEffect(() => {
    blocked.current = !!disabled;
    if (disabled) {
      controls.current.x = 0;
      controls.current.z = 0;
      controls.current.sprint = false;
      keys.current.clear();
    }
  }, [disabled]);

  const act = useCallback(
    (type: string, extra: Record<string, unknown> = {}) => {
      if (!ready || !gameActive()) return;
      if (type === 'interact' && blocked.current) return;
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
          ? 'Schau zuerst auf eine leuchtende orange Markierung.'
          : 'Face a glowing amber marker first.',
      );
      return;
    }
    act('interact', { target: selected });
  }, [act, target, de]);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  useEffect(() => {
    scene.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    sound.current?.setEnabled(!muted);
  }, [muted]);

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
      if (!['lobby', 'finished'].includes(active.phase))
        advanceWorld(active, active.clock + Math.min(100, now - previous));
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
          const player = newPlayer(0);
          Object.assign(player, {
            id: 'local',
            name: 'You',
            bot: false,
            seen: active.clock,
          });
          active.players.push(player);
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
            : 'The archipelago could not load.',
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
    const updateControls = () => {
      controls.current.x =
        (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
        (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0);
      controls.current.z =
        (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
        (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0);
      controls.current.sprint =
        keys.current.has('ShiftLeft') || keys.current.has('ShiftRight');
    };
    const key = (event: KeyboardEvent) => {
      if (event.type === 'keyup') {
        keys.current.delete(event.code);
        updateControls();
        return;
      }
      if (
        blocked.current ||
        !gameActive() ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target as HTMLElement)?.closest?.(
          'input,textarea,select,button,a,[contenteditable],[role="dialog"]',
        )
      )
        return;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'KeyE',
          'ShiftLeft',
          'ShiftRight',
        ].includes(event.code)
      )
        event.preventDefault();
      if (event.type === 'keydown') keys.current.add(event.code);
      else keys.current.delete(event.code);
      updateControls();
      if (event.code === 'KeyE' && event.type === 'keydown' && !event.repeat)
        interact();
    };
    const down = (event: KeyboardEvent) => key(event);
    const up = (event: KeyboardEvent) => key(event);
    const clear = () => {
      keys.current.clear();
      updateControls();
      touchLook.current = null;
    };
    const hidden = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [interact]);

  const setTouchMove = (axis: 'x' | 'z', value: number) => {
    controls.current[axis] = value;
  };
  const moveButton = (axis: 'x' | 'z', value: number) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setTouchMove(axis, value);
    },
    onPointerUp: () => setTouchMove(axis, 0),
    onPointerCancel: () => setTouchMove(axis, 0),
  });
  const touchLookMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previousLook = touchLook.current;
    if (!previousLook || previousLook.id !== event.pointerId) return;
    scene.current?.look(
      (event.clientX - previousLook.x) * 1.2,
      (event.clientY - previousLook.y) * 1.2,
    );
    touchLook.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const awards = world ? crewAwards(world) : [];
  const progress = world
    ? world.phase === 'harbor'
      ? world.loaded.length / 4
      : world.phase === 'search'
        ? (world.beaconIndex +
            (world.beacons[world.beaconIndex]?.active ? 0.75 : 0.25)) /
          3
        : world.phase === 'storm'
          ? world.stormProgress / 9
          : world.phase === 'sanctuary'
            ? (world.lanterns.length + world.toneIndex) / 6
            : ['homecoming', 'finished'].includes(world.phase)
              ? 1
              : 0
    : 0;

  return (
    <main
      className={`rp3 ${world ? `phase-${world.phase}` : ''} ${touch ? 'is-touch' : ''}`}
    >
      <div ref={host} className="rp3-stage" />
      <div className="rp3-vignette" aria-hidden="true" />

      <header className="rp3-topbar">
        <a
          href="/"
          className="rp3-brand"
          aria-label={say('Return to Jumbleyard', 'Zurück zu Jumbleyard')}
        >
          <span>REEL</span> PROBLEMS <b>3</b>
        </a>
        <GameToolbar
          voice={room.voice}
          multiplayer={<PeerRoomControls room={room} />}
          muted={muted}
          onToggleSound={() => {
            sound.current?.unlock();
            setMuted((value) => !value);
          }}
          onHelp={() => {
            if (document.pointerLockElement) document.exitPointerLock?.();
            setHelp(true);
          }}
        />
      </header>

      {!menu && !finished && world ? (
        <>
          <section className="rp3-objective" aria-live="polite">
            <small>{PHASE_NAMES[world.phase]}</small>
            <strong>{objective(world)}</strong>
            <span>
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          </section>
          <section
            className="rp3-crew"
            aria-label={say('Crew status', 'Crewstatus')}
          >
            {world.players.map((player) => (
              <div
                key={player.id}
                className={`${player.id === self.current ? 'is-you' : ''} ${player.overboard ? 'is-overboard' : ''}`}
              >
                <i
                  style={
                    {
                      '--crew-color': [
                        '#d96f56',
                        '#f0ad55',
                        '#4d928d',
                        '#6576a8',
                      ][player.color % 4],
                    } as CSSProperties
                  }
                />
                <span>{player.name}</span>
                {player.overboard ? (
                  <LifeBuoy size={14} />
                ) : (
                  <Check size={13} />
                )}
              </div>
            ))}
          </section>
          <section
            className="rp3-chart"
            aria-label={say('Voyage chart', 'Reisekarte')}
          >
            <div className="rp3-chart-route" aria-hidden="true">
              <i className="is-home">
                <Anchor />
              </i>
              {world.beacons.map((beacon, index) => (
                <i
                  key={beacon.id}
                  className={
                    beacon.active
                      ? 'is-complete'
                      : index === world.beaconIndex
                        ? 'is-current'
                        : ''
                  }
                >
                  <span>{index + 1}</span>
                </i>
              ))}
              <i
                className={
                  ['sanctuary', 'homecoming', 'finished'].includes(world.phase)
                    ? 'is-complete'
                    : ''
                }
              >
                <Fish />
              </i>
            </div>
            <small>
              {say('THE OLD KEEPER’S CHART', 'KARTE DES ALTEN WÄCHTERS')}
            </small>
          </section>
          <div className="rp3-crosshair" aria-hidden="true">
            <i />
            <i />
          </div>
          <output className={`rp3-prompt ${target ? 'is-ready' : ''}`}>
            <MousePointer2 size={15} /> {promptFor(world, target)}
          </output>
          <div
            className="rp3-compass"
            style={
              {
                '--heading': `${-(scene.current?.getYaw() ?? 0)}rad`,
              } as CSSProperties
            }
            aria-label={say('Wrist compass', 'Handgelenkkompass')}
          >
            <Compass />
            <i />
            <span>N</span>
          </div>
          <div
            className="rp3-vitals"
            aria-label={say('Boat condition', 'Bootszustand')}
          >
            <div>
              <span>{say('Hull', 'Rumpf')}</span>
              <i>
                <b style={{ width: `${world.hull}%` }} />
              </i>
            </div>
            <div>
              <span>{say('Bilge', 'Bilge')}</span>
              <i>
                <b className="water" style={{ width: `${world.water}%` }} />
              </i>
            </div>
          </div>
        </>
      ) : null}

      {menu ? (
        <section className="rp3-opening">
          <div className="rp3-journal">
            <span className="rp3-kicker">
              <Sparkles />{' '}
              {say(
                'A FIRST-PERSON CREW ADVENTURE',
                'EIN CREW-ABENTEUER IN ICH-PERSPEKTIVE',
              )}
            </span>
            <h1>
              <span>Follow the</span>
              <em>light below.</em>
            </h1>
            <p>
              {say(
                'Leave the clay harbor, wake three forgotten beacons, and guide a legendary fish through the storm. Everyone gets home—or nobody does.',
                'Verlasst den Lehmhafen, erweckt drei vergessene Leuchtfeuer und führt einen legendären Fisch durch den Sturm. Alle kommen heim – oder niemand.',
              )}
            </p>
            <div className="rp3-feature-row">
              <span>
                <Users /> 1–4 {say('friends', 'Freunde')}
              </span>
              <span>
                <Footprints /> {say('First person', 'Ich-Perspektive')}
              </span>
              <span>
                <Waves /> 15–20 {say('minutes', 'Minuten')}
              </span>
            </div>
            {!room.session ? (
              <div className="rp3-opening-actions">
                <button
                  className="rp3-primary"
                  disabled={!ready}
                  onClick={() => act('start')}
                >
                  <Anchor /> {say('Begin solo voyage', 'Solo-Reise beginnen')}
                </button>
                <button
                  className="rp3-secondary"
                  onClick={() => room.setOpen(true)}
                >
                  <Users /> {say('Gather a crew', 'Crew zusammenrufen')}
                </button>
              </div>
            ) : (
              <div className="rp3-lobby">
                <div>
                  <small>{say('ROOM', 'RAUM')}</small>
                  <strong>{room.session.code}</strong>
                </div>
                <p>
                  {room.players.map((player) => player.name).join(' · ') ||
                    say('Waiting for crew…', 'Warte auf Crew…')}
                </p>
                {isHost ? (
                  <button
                    className="rp3-primary"
                    disabled={!ready || room.status !== 'online'}
                    onClick={() => act('start')}
                  >
                    <Anchor /> {say('Cast off together', 'Gemeinsam ablegen')}
                  </button>
                ) : (
                  <output>
                    {say(
                      'The crew leader will cast off.',
                      'Der Crewleiter legt gleich ab.',
                    )}
                  </output>
                )}
                <button
                  className="rp3-secondary"
                  onClick={() => room.setOpen(true)}
                >
                  <Users />{' '}
                  {say('Invite or manage crew', 'Crew einladen oder verwalten')}
                </button>
              </div>
            )}
            <small className="rp3-opening-note">
              <MousePointer2 />{' '}
              {say(
                'Click the world to look around · WASD to move · E to use',
                'In die Welt klicken zum Umsehen · WASD bewegen · E benutzen',
              )}
            </small>
          </div>
          <aside className="rp3-route-note" aria-hidden="true">
            <b>HARBOR</b>
            <i /> <b>3 BEACONS</b>
            <i /> <b>STORM</b>
            <i /> <b>SANCTUARY</b>
          </aside>
        </section>
      ) : null}

      {finished && world ? (
        <section className="rp3-finale">
          <div className="rp3-photo">
            <div className="rp3-photo-scene">
              <span className="rp3-moon" />
              <Fish className="rp3-photo-fish" />
              <div className="rp3-photo-crew">
                {world.players.map((player) => (
                  <i
                    key={player.id}
                    style={
                      {
                        '--crew-color': [
                          '#d96f56',
                          '#f0ad55',
                          '#4d928d',
                          '#6576a8',
                        ][player.color % 4],
                      } as CSSProperties
                    }
                  >
                    <span />
                  </i>
                ))}
              </div>
            </div>
            <small>
              {say(
                'HARBOR SUNRISE · THE WHOLE CREW',
                'HAFEN BEI SONNENAUFGANG · DIE GANZE CREW',
              )}
            </small>
          </div>
          <div className="rp3-finale-copy">
            <span className="rp3-kicker">
              <Sparkles /> {say('VOYAGE COMPLETE', 'REISE BEENDET')}
            </span>
            <h2>
              {say(
                'The light found its way home.',
                'Das Licht hat heimgefunden.',
              )}
            </h2>
            <p>
              {say(
                'You finished the journey together. The sanctuary will remember every beacon you woke and every friend you pulled from the sea.',
                'Ihr habt die Reise gemeinsam beendet. Das Schutzgebiet erinnert sich an jedes Leuchtfeuer und jeden Freund, den ihr aus dem Meer gezogen habt.',
              )}
            </p>
            {awards.length ? (
              <div className="rp3-awards">
                {awards.slice(0, 3).map((award) => (
                  <article key={award.title}>
                    <small>{award.title}</small>
                    <strong>{award.player}</strong>
                    <span>{award.detail}</span>
                  </article>
                ))}
              </div>
            ) : null}
            {isHost ? (
              <button className="rp3-primary" onClick={() => act('restart')}>
                <RotateCcw /> {say('Sail again', 'Noch einmal segeln')}
              </button>
            ) : (
              <output>
                {say(
                  'Waiting for the crew leader.',
                  'Warte auf den Crewleiter.',
                )}
              </output>
            )}
          </div>
        </section>
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
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={touchLookMove}
            onPointerUp={() => {
              touchLook.current = null;
            }}
            onPointerCancel={() => {
              touchLook.current = null;
            }}
            aria-label={say('Drag to look', 'Ziehen zum Umsehen')}
          />
          <div className="rp3-touch-move">
            <button
              {...moveButton('z', 1)}
              aria-label={say('Move forward', 'Vorwärts')}
            >
              ▲
            </button>
            <button
              {...moveButton('x', -1)}
              aria-label={say('Move left', 'Links')}
            >
              ◀
            </button>
            <button
              {...moveButton('z', -1)}
              aria-label={say('Move backward', 'Rückwärts')}
            >
              ▼
            </button>
            <button
              {...moveButton('x', 1)}
              aria-label={say('Move right', 'Rechts')}
            >
              ▶
            </button>
          </div>
          <button className="rp3-touch-action" onClick={interact}>
            <span>E</span>
            {say('USE', 'NUTZEN')}
          </button>
        </div>
      ) : null}

      {error ? (
        <output className="rp3-error" role="alert">
          {error}
        </output>
      ) : null}
      {!ready ? (
        <div className="rp3-loading">
          <Fish />
          <span>
            {say('Charting the archipelago…', 'Archipel wird kartiert…')}
          </span>
        </div>
      ) : null}

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="rp3-help game-dialog">
          <DialogTitle>{say('Crew field guide', 'Crew-Handbuch')}</DialogTitle>
          <p>
            {say(
              'This is one continuous first-person voyage. Face an amber marker and press E. The world—not a checklist—shows where to go next.',
              'Dies ist eine durchgehende Reise in Ich-Perspektive. Schau auf eine orange Markierung und drücke E. Die Welt zeigt den nächsten Weg.',
            )}
          </p>
          <div className="rp3-help-grid">
            <div>
              <Footprints />
              <strong>WASD</strong>
              <span>
                {say('Move · Shift to hurry', 'Bewegen · Shift zum Laufen')}
              </span>
            </div>
            <div>
              <MousePointer2 />
              <strong>{say('Mouse', 'Maus')}</strong>
              <span>
                {say('Click, then look around', 'Klicken, dann umsehen')}
              </span>
            </div>
            <div>
              <Anchor />
              <strong>E</strong>
              <span>
                {say(
                  'Use, carry, repair, rescue',
                  'Nutzen, tragen, reparieren, retten',
                )}
              </span>
            </div>
            <div>
              <HelpCircle />
              <strong>Esc</strong>
              <span>{say('Release the cursor', 'Mauszeiger freigeben')}</span>
            </div>
          </div>
          <label className="rp3-motion-setting">
            <input
              type="checkbox"
              aria-label={say('Reduce sea motion', 'Meeresbewegung reduzieren')}
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            <span>
              <strong>
                {say('Reduce sea motion', 'Meeresbewegung reduzieren')}
              </strong>
              <small>
                {say(
                  'Calms hand bob, waves, rain, and ambient movement.',
                  'Beruhigt Hände, Wellen, Regen und Umgebungsbewegung.',
                )}
              </small>
            </span>
          </label>
          <button className="rp3-primary" onClick={() => setHelp(false)}>
            {say('Return to the voyage', 'Zurück zur Reise')}
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
