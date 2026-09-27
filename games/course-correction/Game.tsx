'use client';
/* oxlint-disable react/react-compiler -- WebGL, transient input and local simulation intentionally live in refs. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { Flag, Lock, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import GameToolbar from '../../shared/ui/GameToolbar';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import { useLanguage } from '../../shared/language/useLanguage';
import { gameActive } from '../../shared/browser/game-lifecycle';
import { inPartyMode } from '../../shared/ui/party-mode';
import { partyGoal, partyRound } from '../../shared/ui/party-round';
import { hudPacer } from '../../shared/ui/hud-pacer';
import {
  advanceWorld,
  courseAction,
  freshWorld,
  setInput,
  snapshot as makeSnapshot,
} from './simulation';
import {
  COLORS,
  idleInput,
  type CourseSnapshot,
  type CourseWorld,
} from './types';
import type { CourseCorrectionScene } from './scene';
import { CourseCorrectionAudio } from './audio';
import {
  CupSequenceTracker,
  courseAwards,
  latestCourseMessage,
  playerStatus,
  type CupCelebration,
} from './presentation';
import './style.css';

type Controls = { x: number; z: number; angle: number; power: number };
const freshControls = (): Controls => ({ x: 0, z: 0, angle: 0, power: 0.58 });
const HOLES = ['Pivot Alley', 'Tipping Point', 'Moving Target'];

export default function CourseCorrectionGame() {
  const { language } = useLanguage();
  const de = language === 'de';
  const say = (en: string, german: string) => (de ? german : en);
  const party = typeof window !== 'undefined' && inPartyMode();
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CourseCorrectionScene | null>(null);
  const sound = useRef<CourseCorrectionAudio | null>(null);
  const local = useRef<CourseWorld | null>(null);
  const self = useRef('local');
  const controls = useRef<Controls>(freshControls());
  const connected = useRef(false);
  const blocked = useRef(false);
  const charging = useRef(0);
  const pointer = useRef<number | null>(null);
  const latest = useRef<CourseSnapshot | null>(null);
  const cupSequence = useRef(new CupSequenceTracker());
  const celebrationHole = useRef(-1);
  const hud = useRef(
    hudPacer<CourseSnapshot>((snapshot) => {
      const world = snapshot.world;
      return `${world.phase}:${world.hole}:${world.players.map((p) => `${p.holeStrokes}:${p.totalStrokes}:${p.assists}:${p.finishedAt}`).join('|')}:${Math.floor(world.clock / 250)}`;
    }),
  );
  const [snapshot, setSnapshot] = useState<CourseSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [help, setHelp] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [celebration, setCelebration] = useState<CupCelebration | null>(null);

  const receive = useCallback((next: CourseSnapshot) => {
    latest.current = next;
    if (celebrationHole.current !== next.world.hole) {
      celebrationHole.current = next.world.hole;
      cupSequence.current.reset();
      setCelebration(null);
    }
    const nextCelebration = cupSequence.current.ingest(next.world.events);
    if (nextCelebration) setCelebration(nextCelebration);
    scene.current?.render(next);
    sound.current?.update(next.world, self.current);
    if (hud.current.due(next)) setSnapshot(next);
  }, []);

  const room = usePeerRoom<CourseSnapshot>({
    game: 'course-correction',
    loadEngine: () => import('./peer'),
    readInput: () =>
      blocked.current || !gameActive() ? idleInput() : controls.current,
    idleInput,
    onAttach: (session) => {
      local.current = null;
      connected.current = true;
      self.current = session.id;
      scene.current?.setLocalPlayer(session.id);
      sound.current?.resetEvents();
      hud.current.reset();
    },
    onOpen: () => Object.assign(controls.current, freshControls()),
    receive,
  });
  const disabled =
    !ready ||
    help ||
    room.open ||
    room.busy ||
    (!!room.session && room.status !== 'online');
  useLayoutEffect(() => {
    blocked.current = disabled;
    if (disabled) controls.current.x = controls.current.z = 0;
  }, [disabled]);

  const { send } = room;
  const act = useCallback(
    (type: string, extra: Record<string, unknown> = {}) => {
      if (blocked.current || !gameActive()) return;
      setError('');
      const action = { type, ...extra };
      if (send(action)) return;
      const world = local.current;
      if (!world) return;
      try {
        courseAction(world, self.current, action, true);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'That shot did not work.',
        );
      }
      hud.current.reset();
      receive(
        makeSnapshot(world, 'SOLO', self.current, self.current, world.tick),
      );
    },
    [receive, send],
  );

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let view: CourseCorrectionScene | undefined;
    let previous = performance.now();
    let published = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const world = local.current;
      if (!world || !gameActive()) return;
      setInput(
        world,
        self.current,
        blocked.current ? idleInput() : controls.current,
      );
      if (!blocked.current)
        advanceWorld(world, world.clock + Math.min(100, now - previous));
      previous = now;
      if (now - published > 32) {
        published = now;
        receive(
          makeSnapshot(world, 'SOLO', self.current, self.current, world.tick),
        );
      }
    };
    void import('./scene')
      .then(({ CourseCorrectionScene: Scene }) => {
        if (cancelled || !host.current) return;
        view = new Scene(host.current);
        scene.current = view;
        sound.current = new CourseCorrectionAudio();
        view.setLocalPlayer(self.current);
        if (!connected.current) {
          const world = freshWorld(Date.now());
          const player = world.players[0];
          const old = player.id;
          Object.assign(player, { id: 'local', name: 'You', bot: false });
          world.balls[0].owner = 'local';
          if (world.balls[0].lastTouch === old)
            world.balls[0].lastTouch = 'local';
          local.current = world;
          receive(makeSnapshot(world, 'SOLO', 'local', 'local', 0));
        } else if (latest.current) receive(latest.current);
        setReady(true);
        window.dispatchEvent(new Event('game:party-ready'));
        frame = requestAnimationFrame(loop);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : 'The course could not load.',
          );
      });

    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target as HTMLElement)?.closest?.(
          'input,textarea,select,button,a,[role="dialog"]',
        )
      )
        return;
      if (
        ['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'Space'].includes(
          event.code,
        )
      )
        event.preventDefault();
      if (event.code === 'KeyA' || event.code === 'ArrowLeft')
        controls.current.x = event.type === 'keydown' ? -1 : 0;
      if (event.code === 'KeyD' || event.code === 'ArrowRight')
        controls.current.x = event.type === 'keydown' ? 1 : 0;
      if (event.code === 'Space' && event.type === 'keydown' && !event.repeat)
        charging.current = performance.now();
      if (
        event.code === 'Space' &&
        event.type === 'keyup' &&
        charging.current
      ) {
        controls.current.power = Math.min(
          1,
          0.2 + (performance.now() - charging.current) / 1150,
        );
        charging.current = 0;
        const opening = latest.current?.world.phase === 'opening';
        act(opening ? 'lock' : 'shoot', {
          angle: controls.current.angle,
          power: controls.current.power,
        });
      }
    };
    const down = (event: KeyboardEvent) => key(event);
    const up = (event: KeyboardEvent) => key(event);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      view?.dispose();
      sound.current?.dispose();
      scene.current = null;
      sound.current = null;
      local.current = null;
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [act, receive]);

  useEffect(() => {
    if (sound.current) sound.current.enabled = !muted;
  }, [muted]);

  const world = snapshot?.world;
  const me = world?.players.find((player) => player.id === self.current);
  const ball = world?.balls.find(
    (candidate) => candidate.owner === self.current,
  );
  const isHost = !room.session || snapshot?.host === self.current;
  const finished = world?.phase === 'match_over';
  const winner = world
    ? [...world.players].sort(
        (a, b) => a.totalStrokes - b.totalStrokes || b.assists - a.assists,
      )[0]
    : undefined;
  const remaining = world
    ? Math.max(
        0,
        Math.ceil(
          ((world.phase === 'opening' ? world.openingEnds : world.holeEnds) -
            world.clock) /
            1000,
        ),
      )
    : 0;
  const partyScore = me
    ? Math.max(0, 1000 - me.totalStrokes * 10 + me.assists)
    : 0;
  const courseMessage = world ? latestCourseMessage(world, de) : null;
  const awards = world ? courseAwards(world) : [];
  const mechanic = [
    say(
      'Hit the orange walls to rotate the route',
      'Triff orange Wände und drehe die Route',
    ),
    say(
      'The yellow bridge tips under moving balls',
      'Die gelbe Brücke kippt unter rollenden Bällen',
    ),
    say(
      'Hard shots can shove the cup sideways',
      'Harte Schläge können das Loch verschieben',
    ),
  ][world?.hole ?? 0];

  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || pointer.current !== event.pointerId) return;
    const point = scene.current?.aim(event.clientX, event.clientY);
    if (!point || !ball) return;
    const dx = point.x - ball.x;
    const dz = point.z - ball.z;
    // Mini-golf pull-back: drag behind the ball, then release toward the opposite direction.
    controls.current.angle = Math.atan2(-dx, -dz);
    controls.current.power = Math.max(
      0.12,
      Math.min(1, Math.hypot(dx, dz) / 5),
    );
  };
  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    updatePointer(event);
    pointer.current = null;
    scene.current?.setAiming(false);
    const opening = world?.phase === 'opening';
    act(opening ? 'lock' : 'shoot', {
      angle: controls.current.angle,
      power: controls.current.power,
    });
  };

  return (
    <main
      className="course-correction"
      {...partyRound(
        !!finished,
        finished ? partyGoal(winner?.id === me?.id, partyScore) : null,
      )}
    >
      <div
        ref={host}
        className="course-stage"
        aria-label={say(
          'Interactive mini-golf course',
          'Interaktiver Minigolfplatz',
        )}
        onPointerDown={(event) => {
          if (disabled || ball?.moving || ball?.holed) return;
          pointer.current = event.pointerId;
          scene.current?.setAiming(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          updatePointer(event);
        }}
        onPointerMove={updatePointer}
        onPointerUp={releasePointer}
        onPointerCancel={() => {
          pointer.current = null;
          scene.current?.setAiming(false);
        }}
      />

      <header className="course-topbar">
        <a href="/" className="course-brand">
          COURSE <span>CORRECTION</span>
        </a>
        <div className="course-hole house-card">
          <small>
            {say('Hole', 'Bahn')} {(world?.hole ?? 0) + 1} / 3
          </small>
          <strong>{HOLES[world?.hole ?? 0]}</strong>
          <time>{remaining}s</time>
          <span className="course-round-markers" aria-hidden="true">
            {HOLES.map((_, index) => (
              <i
                key={index}
                className={
                  index < (world?.hole ?? 0)
                    ? 'is-complete'
                    : index === (world?.hole ?? 0)
                      ? 'is-current'
                      : ''
                }
              />
            ))}
          </span>
        </div>
        <GameToolbar
          voice={room.voice}
          multiplayer={<PeerRoomControls room={room} />}
          muted={muted}
          onToggleSound={() => setMuted((value) => !value)}
          onHelp={() => setHelp(true)}
        />
      </header>

      <section
        className="course-scores"
        aria-label={say('Scoreboard', 'Punktestand')}
      >
        {world?.players.map((player) => {
          const status = playerStatus(world, player.id);
          const latestEvent = world.events.at(-1);
          const justHoled =
            latestEvent?.kind === 'cup' &&
            latestEvent.player === player.id &&
            world.clock - latestEvent.at < 1_000;
          return (
            <article
              key={player.id}
              className={`house-card ${player.id === self.current ? 'is-you' : ''} ${justHoled ? 'just-holed' : ''}`}
              style={{ '--player': COLORS[player.seat] } as React.CSSProperties}
              aria-current={player.id === self.current ? 'true' : undefined}
            >
              <span className="course-ball-dot" />
              <div>
                <strong>{player.name}</strong>
                <small>
                  {status === 'holed'
                    ? say('IN THE CUP', 'EINGELOCHT')
                    : status === 'moving'
                      ? say('ROLLING', 'ROLLT')
                      : status === 'locked'
                        ? say('LOCKED', 'BEREIT')
                        : `${player.holeStrokes} ${say('shots', 'Schläge')}`}
                </small>
              </div>
              <b>{player.totalStrokes || '—'}</b>
              {player.assists > 0 ? <em>★ {player.assists}</em> : null}
            </article>
          );
        })}
      </section>

      <section className="course-shot-panel house-card">
        <div className="course-power">
          <i aria-hidden="true" />
          <span
            style={{ width: `${(me?.power ?? controls.current.power) * 100}%` }}
          />
        </div>
        <strong>
          {ball?.holed
            ? say(
                'Nice one. Watch the chaos.',
                'Gut gespielt. Jetzt Chaos genießen.',
              )
            : ball?.moving
              ? say('Course changing…', 'Der Kurs verändert sich…')
              : world?.phase === 'opening'
                ? me?.openingReady
                  ? say(
                      'Locked. Waiting for the volley.',
                      'Bereit. Warten auf den Abschlag.',
                    )
                  : say(
                      'Aim now — everyone launches together',
                      'Jetzt zielen — alle starten zusammen',
                    )
                : say(
                    'Pull back · release to putt',
                    'Zurückziehen · loslassen zum Putten',
                  )}
        </strong>
        <small>
          A / D · {say('hold Space for power', 'Leertaste für Stärke halten')}
        </small>
      </section>

      {courseMessage && (
        <output className="course-event-toast house-pill">
          <span /> {courseMessage}
        </output>
      )}

      {celebration && world && world.clock - celebration.at < 2_200 && (
        <output className={`course-correction-callout is-${celebration.kind}`}>
          <Sparkles />
          <span>
            <small>{celebration.count} BALL CHAIN</small>
            {celebration.kind === 'everybody'
              ? say('EVERYBODY IN!', 'ALLE DRIN!')
              : 'COURSE CORRECTION!'}
          </span>
        </output>
      )}
      {error && <output className="course-error">{error}</output>}

      {world &&
        world.phase !== 'lobby' &&
        world.phase !== 'match_over' &&
        world.clock - world.phaseAt < 2_100 && (
          <div className="course-mechanic-intro house-card">
            <small>
              {say('Hole mechanic', 'Bahnmechanik')} · 0{world.hole + 1}
            </small>
            <strong>{mechanic}</strong>
          </div>
        )}

      {world?.phase === 'lobby' && (
        <div className="course-overlay">
          <div className="course-card course-intro-card house-card">
            <span className="course-kicker">
              <Flag /> {say('Three-hole sprint', 'Drei-Bahnen-Sprint')}
            </span>
            <h1>
              Every shot
              <br />
              <i>changes the hole.</i>
            </h1>
            <p>
              {say(
                'Walls rotate. Bridges tip. The cup runs away. Four balls launch together, then everyone plays the course they accidentally created.',
                'Wände drehen sich. Brücken kippen. Das Loch läuft weg. Vier Bälle starten zusammen — danach spielt ihr den Kurs, den ihr selbst verändert habt.',
              )}
            </p>
            {isHost ? (
              <button
                className="primary-button"
                onClick={() => act('start')}
                data-party-setup-action=""
              >
                <Flag /> {say('Start the round', 'Runde starten')}
              </button>
            ) : (
              <small>
                {say('Waiting for the host to start…', 'Warten auf den Host…')}
              </small>
            )}
          </div>
        </div>
      )}

      {world?.phase === 'hole_result' && (
        <div className="course-hole-result">
          <span>{say('Hole complete', 'Bahn beendet')}</span>
          <strong>{HOLES[world.hole]}</strong>
        </div>
      )}

      {finished && (
        <div className="course-overlay">
          <div className="course-card course-result-card house-card">
            <Trophy />
            <span className="course-kicker">
              {say('Clubhouse result', 'Clubhaus-Ergebnis')}
            </span>
            <h2>
              {winner?.name} {say('wins', 'gewinnt')}
            </h2>
            <ol>
              {[...(world?.players ?? [])]
                .sort(
                  (a, b) =>
                    a.totalStrokes - b.totalStrokes || b.assists - a.assists,
                )
                .map((player) => (
                  <li key={player.id}>
                    <span>{player.name}</span>
                    <b>{player.totalStrokes}</b>
                    <small>★ {player.assists}</small>
                  </li>
                ))}
            </ol>
            <div className="course-awards">
              {awards.map((award) => (
                <div key={award.key}>
                  <small>
                    {award.key === 'best-bank'
                      ? say('Best Bank', 'Beste Bande')
                      : award.key === 'biggest-assist'
                        ? say('Biggest Assist', 'Größter Assist')
                        : say('Course Changer', 'Kursveränderer')}
                  </small>
                  <strong>{award.player?.name ?? '—'}</strong>
                </div>
              ))}
            </div>
            {isHost && !party && (
              <button className="primary-button" onClick={() => act('restart')}>
                <RotateCcw /> {say('Play again', 'Nochmal spielen')}
              </button>
            )}
          </div>
        </div>
      )}

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="course-help game-dialog">
          <DialogTitle>{say('How to play', 'So wird gespielt')}</DialogTitle>
          <p>
            {say(
              'Aim during the opening countdown. Your first shots launch together. Afterward, shoot whenever your ball is still.',
              'Ziele während des Countdowns. Die ersten Schläge starten gemeinsam. Danach schlägst du, sobald dein Ball stillliegt.',
            )}
          </p>
          <ul>
            <li>
              {say(
                'Hit orange walls to rotate them.',
                'Triff orange Wände, um sie zu drehen.',
              )}
            </li>
            <li>
              {say(
                'Cross the yellow bridge carefully—it tips under impacts.',
                'Überquere die gelbe Brücke vorsichtig — Treffer kippen sie.',
              )}
            </li>
            <li>
              {say(
                'Hard shots move the final cup platform.',
                'Harte Schläge bewegen die letzte Lochplattform.',
              )}
            </li>
            <li>
              {say(
                'Sink another ball to earn an assist star.',
                'Loche einen anderen Ball ein und erhalte einen Assist-Stern.',
              )}
            </li>
          </ul>
          <button className="primary-button" onClick={() => setHelp(false)}>
            <Lock /> {say('Back to the course', 'Zurück zum Kurs')}
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
