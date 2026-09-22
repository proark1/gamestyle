'use client';
/* oxlint-disable react/react-compiler -- Imperative simulation and WebGL controllers live in refs. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import {
  ArrowLeft,
  Hand,
  Shield,
  Shuffle,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import GameToolbar from '../../shared/ui/GameToolbar';
import PeerRoomControls from '../../shared/peer/PeerRoomControls';
import { usePeerRoom } from '../../shared/peer/usePeerRoom';
import { TouchControls } from '../../shared/input/TouchControls';
import { useMediaQuery } from '../../shared/browser/use-media-query';
import { TOUCH_CONTROLS_QUERY } from '../../shared/input/gestures';
import { gameActive } from '../../shared/browser/game-lifecycle';
import { useLanguage } from '../../shared/language/useLanguage';
import {
  GameTracker,
  useGameTracker,
} from '../../shared/analytics/game-tracker';
import { partyRound, partyVersus } from '../../shared/ui/party-round';
import { hudPacer } from '../../shared/ui/hud-pacer';
import { BoxingScene } from './scene';
import { BoxingAudio } from './audio';
import { BoxingControls } from './controls';
import { boxingAnalytics, boxingPlayState } from './analytics';
import {
  advanceWorld,
  boxingAction,
  freshWorld,
  snapshot as makeSnapshot,
  tagReason,
} from './simulation';
import { idleInput, type Snapshot, type World } from './types';
import './style.css';

const tracker = new GameTracker(boxingAnalytics);
const cancelledInput = () => ({ ...idleInput(), cancel: true });
const reasons = {
  ready: ['Hold together — tagging!', 'Gemeinsam halten — Wechsel!'],
  corner: [
    'Meet at your coloured corner',
    'Trefft euch in eurer farbigen Ecke',
  ],
  fighting: [
    'Break away from the fight first',
    'Löse dich zuerst aus dem Kampf',
  ],
  recovering: ['Wait for the bell', 'Warte auf die Glocke'],
  cooldown: ['Tag is recharging', 'Wechsel lädt auf'],
  partner: ['Both teammates hold TAG', 'Beide halten WECHSEL'],
};
export default function BoxingGame() {
  const { language } = useLanguage(),
    de = language === 'de';
  const say = (en: string, german: string) => (de ? german : en);
  useGameTracker(tracker);
  const touch = useMediaQuery(TOUCH_CONTROLS_QUERY);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<BoxingScene | null>(null),
    sound = useRef<BoxingAudio | null>(null);
  const local = useRef<World | null>(null),
    self = useRef('local'),
    controls = useRef(new BoxingControls());
  const blocked = useRef(false),
    connected = useRef(false);
  const hud = useRef(
    hudPacer<Snapshot>(
      (s) =>
        `${s.world.phase}:${s.world.teams.red.score}:${s.world.teams.blue.score}:${s.world.players.find((p) => p.id === s.selfId)?.active}`,
    ),
  );
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [help, setHelp] = useState(false),
    [muted, setMuted] = useState(false),
    [error, setError] = useState('');
  const receive = useCallback((s: Snapshot) => {
    scene.current?.render(s);
    sound.current?.update(s.world);
    if (hud.current.due(s)) {
      setSnap(s);
      tracker.observe(boxingPlayState(s));
    }
  }, []);
  const room = usePeerRoom<Snapshot>({
    game: 'on-the-ropes',
    loadEngine: () => import('./peer'),
    readInput: () =>
      blocked.current ? cancelledInput() : controls.current.read(),
    idleInput: cancelledInput,
    onAttach: (s) => {
      local.current = null;
      connected.current = true;
      sound.current?.resetEvents();
      self.current = s.id;
      controls.current.clear();
      scene.current?.setLocalPlayer(s.id);
      hud.current.reset();
    },
    onOpen: () => controls.current.clear(),
    receive,
  });
  const disabled =
    help ||
    room.open ||
    room.busy ||
    (!!room.session && room.status !== 'online');
  useLayoutEffect(() => {
    blocked.current = disabled;
    if (disabled) controls.current.clear();
  }, [disabled]);
  const { send } = room;
  const act = (type: string) => {
    controls.current.clear();
    sound.current?.unlock();
    tracker.action(type);
    setError('');
    if (send({ type })) return;
    if (local.current) {
      try {
        boxingAction(local.current, self.current, { type }, true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start.');
      }
      hud.current.reset();
      receive(
        makeSnapshot(
          local.current,
          'SOLO',
          self.current,
          self.current,
          local.current.tick,
        ),
      );
    }
  };
  useEffect(() => {
    if (!host.current) return;
    let view: BoxingScene;
    try {
      view = new BoxingScene(host.current);
    } catch {
      setError(
        'The ring could not start. Reload the page or try another browser.',
      );
      return;
    }
    scene.current = view;
    sound.current = new BoxingAudio();
    if (!connected.current) {
      const w = freshWorld(Date.now());
      Object.assign(w.players[0], { id: 'local', name: 'You', bot: false });
      local.current = w;
      view.setLocalPlayer(self.current);
      receive(makeSnapshot(w, 'SOLO', 'local', 'local', 0));
    }
    let frame = 0,
      previous = performance.now(),
      publish = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(100, now - previous);
      previous = now;
      const w = local.current;
      if (!w || !gameActive()) return;
      const p = w.players.find((q) => q.id === self.current);
      if (p)
        p.input = blocked.current ? cancelledInput() : controls.current.read();
      if (!blocked.current) advanceWorld(w, w.clock + dt);
      if (now - publish >= 32) {
        publish = now;
        receive(makeSnapshot(w, 'SOLO', self.current, self.current, w.tick));
      }
    };
    frame = requestAnimationFrame(loop);
    const keys = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'ShiftLeft',
      'ShiftRight',
      'KeyQ',
      'KeyE',
      'KeyF',
    ]);
    const keyDown = (e: KeyboardEvent) => {
      if (
        blocked.current ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target as HTMLElement)?.closest?.(
          'input,textarea,select,[contenteditable="true"],[role="dialog"]',
        )
      )
        return;
      if (!keys.has(e.code)) return;
      // Space and Enter retain their normal meaning on focused UI controls.
      if (
        e.code === 'Space' &&
        (e.target as HTMLElement)?.closest?.('button,a')
      )
        return;
      e.preventDefault();
      if (!e.repeat) controls.current.key(e.code, true);
    };
    const keyUp = (e: KeyboardEvent) => controls.current.key(e.code, false);
    const clear = () => controls.current.clear();
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      view.dispose();
      sound.current?.dispose();
      scene.current = null;
      sound.current = null;
      local.current = null;
    };
  }, [receive]);
  const hold = (key: 'punch' | 'guard' | 'dodge' | 'tag' | 'assist') => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || disabled) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      controls.current.patch({ [key]: true });
      sound.current?.unlock();
    },
    onPointerUp: () => controls.current.patch({ [key]: false }),
    onPointerCancel: () => controls.current.clear(),
    onLostPointerCapture: () => controls.current.patch({ [key]: false }),
    onBlur: () => controls.current.patch({ [key]: false }),
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) controls.current.patch({ [key]: true });
      }
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        controls.current.patch({ [key]: false });
      }
    },
  });
  const w = snap?.world,
    me = w?.players.find((p) => p.id === self.current),
    team = me?.team ?? 'red';
  const mate = w?.players.find((p) => p.team === team && p.id !== me?.id);
  const inLobby = w?.phase === 'lobby',
    ended = w?.phase === 'ended',
    isHost = !room.session || snap?.host === self.current;
  const reason = w && me ? tagReason(w, me) : 'recovering';
  const transitioning = (me?.tagTransition ?? 0) > 0;
  const tagRequested = !!(me?.active ? mate?.tagRequested : me?.tagRequested);
  const clock = w
    ? `${Math.floor(Math.ceil(w.time) / 60)}:${String(Math.ceil(w.time) % 60).padStart(2, '0')}`
    : '3:00';
  return (
    <main
      className="boxing-game"
      {...partyRound(
        !!ended,
        w
          ? partyVersus(
              me?.team,
              w.winner,
              { red: w.teams.red.score, blue: w.teams.blue.score },
              'knockdowns',
            )
          : null,
      )}
    >
      <div className="boxing-canvas" ref={host} />
      <header className="topbar boxing-topbar">
        <a href="/" className="wordmark">
          <ArrowLeft size={18} />
          <span>
            ON THE ROPES<span className="title-dot">.</span>
          </span>
        </a>
        <GameToolbar
          multiplayer={<PeerRoomControls room={room} />}
          voice={room.voice}
          muted={muted}
          onToggleSound={() => {
            setMuted(!muted);
            sound.current?.setMuted(!muted);
          }}
          onHelp={() => setHelp(true)}
        />
      </header>
      <section
        className="boxing-score"
        aria-label={say('Match score', 'Spielstand')}
      >
        <div className="boxing-team red">
          <span>{say('RED CORNER', 'ROTE ECKE')}</span>
          <b>{w?.teams.red.score ?? 0}</b>
        </div>
        <div className="boxing-clock">
          <span>
            {w?.overtime
              ? say('SUDDEN DEATH', 'VERLÄNGERUNG')
              : say('FIRST TO THREE', 'ZUERST DREI')}
          </span>
          <strong>{clock}</strong>
          <small>{say('TAG TEAM BOXING', 'TAG-TEAM-BOXEN')}</small>
        </div>
        <div className="boxing-team blue">
          <b>{w?.teams.blue.score ?? 0}</b>
          <span>{say('BLUE CORNER', 'BLAUE ECKE')}</span>
        </div>
      </section>
      {error && (
        <output className="boxing-error" role="alert">
          {error}
        </output>
      )}
      {inLobby && (
        <section className="boxing-intro">
          <span className="boxing-eyebrow">
            {say('GLOVES ON. FRIENDSHIPS OFF.', 'HANDSCHUHE AN. CHAOS LOS.')}
          </span>
          <h1>
            On the <em>Ropes.</em>
          </h1>
          <p>
            {say(
              'Two in the ring. Two in the corners. One very bad idea to throw another punch.',
              'Zwei im Ring. Zwei in den Ecken. Noch ein Schlag? Keine gute Idee.',
            )}
          </p>
          <div className="boxing-pills">
            <span>
              {say(
                '2 vs 2 · bots fill empty seats',
                '2 gegen 2 · Bots füllen freie Plätze',
              )}
            </span>
            <span>{say('3-minute bouts', '3-Minuten-Kämpfe')}</span>
          </div>
          <button
            className="boxing-primary"
            disabled={!isHost || disabled}
            onClick={() => {
              act('ready');
              host.current?.querySelector('canvas')?.focus();
            }}
          >
            <Hand size={19} />
            {isHost
              ? say('Gloves up — let’s go', 'Handschuhe hoch — los!')
              : say('Waiting for host', 'Warte auf den Host')}
          </button>
          <div className="boxing-intro-links">
            <button onClick={() => room.setOpen(true)}>
              {say('Invite your corner crew', 'Lade dein Team ein')}
            </button>
            <button
              data-party-setup-action=""
              onClick={() => act('switch_team')}
            >
              {say('Switch team', 'Team wechseln')}
            </button>
            <button onClick={() => setHelp(true)}>
              {say('How to box', 'So wird geboxt')}
            </button>
            {mate?.bot && (
              <button onClick={() => act('switch_role')}>
                {me?.active
                  ? say('Start in the corner', 'In der Ecke starten')
                  : say('Start in the ring', 'Im Ring starten')}
              </button>
            )}
          </div>
          <small>
            {say(
              'Move WASD · tap / hold Space to punch · Shift guard · Q dodge',
              'WASD bewegen · Leertaste tippen / halten: Schlag · Shift blockt · Q weicht aus',
            )}
          </small>
        </section>
      )}
      {(w?.phase === 'countdown' || w?.phase === 'stoppage') && (
        <output className="boxing-announcement">
          <strong>
            {w.phase === 'countdown'
              ? Math.max(1, Math.ceil(w.phaseTime))
              : say('DOWN!', 'AM BODEN!')}
          </strong>
          <span>
            {w.phase === 'countdown'
              ? say(
                  'Find your feet. Keep your guard.',
                  'Finde deinen Stand. Deckung hoch.',
                )
              : say(
                  'Catch your breath. Partners take over at the bell.',
                  'Durchatmen. Nach der Glocke wechseln die Partner.',
                )}
          </span>
        </output>
      )}
      {ended && (
        <section className="boxing-intro boxing-result">
          <Trophy size={36} />
          <span className="boxing-eyebrow">
            {say('THE BELL HAS SPOKEN', 'DIE GLOCKE HAT ENTSCHIEDEN')}
          </span>
          <h1>
            {w.winner === 'draw'
              ? say('A glorious draw.', 'Ein wildes Remis.')
              : w.winner === team
                ? say('Your corner wins!', 'Eure Ecke gewinnt!')
                : say('Down, not out.', 'Nächste Runde?')}
          </h1>
          <p>
            {w.teams.red.score} – {w.teams.blue.score} ·{' '}
            {say('knockdowns', 'Niederschläge')}
          </p>
          <button
            className="boxing-primary"
            disabled={!isHost}
            onClick={() => act('reset')}
          >
            {isHost
              ? say('One more round', 'Noch eine Runde')
              : say('Waiting for host', 'Warte auf den Host')}
          </button>
        </section>
      )}
      {me && !inLobby && !ended && (
        <>
          <section className={`boxing-status ${team}`}>
            <div className="boxing-role">
              <span className="boxing-dot" />
              {me.active
                ? say('YOU’RE IN THE RING', 'DU BIST IM RING')
                : say('YOU’RE THE CORNER CREW', 'DU BIST DAS ECKEN-TEAM')}
              <small>
                {tagRequested && me.active
                  ? say('TAG REQUESTED', 'WECHSEL GEWÜNSCHT')
                  : mate?.name}
              </small>
            </div>
            <div className="boxing-meters">
              <label>
                {say('Stamina', 'Ausdauer')}
                <meter min={0} max={100} value={me.stamina} />
              </label>
              <label>
                {say('Balance', 'Gleichgewicht')}
                <meter
                  min={0}
                  max={100}
                  value={100 - me.balance}
                  low={30}
                  high={60}
                  optimum={100}
                />
              </label>
            </div>
            <p>
              {transitioning
                ? say(
                    'Tag complete — changing places!',
                    'Wechsel klappt — Plätze tauschen!',
                  )
                : me.active
                  ? reasons[reason][de ? 1 : 0]
                  : me.tagRequested
                    ? (w?.teams[team].tagCooldown ?? 0) > 0
                      ? say(
                          'Call queued. Your partner is coming; waiting for the tag cooldown.',
                          'Ruf vorgemerkt. Dein Partner kommt; Wechsel lädt noch auf.',
                        )
                      : mate?.bot
                        ? say(
                            'Partner coming! Stay ready. Tap E again to cancel.',
                            'Dein Partner kommt! Halte dich bereit. E erneut zum Abbrechen.',
                          )
                        : say(
                            'Partner called. Waiting at your corner. Tap E to cancel.',
                            'Partner gerufen. Warte an deiner Ecke. E zum Abbrechen.',
                          )
                    : say(
                        'Tap E to call your partner and tag in. Hold F for a towel; charge and release for a rope launch.',
                        'Tippe E, um deinen Partner zu rufen und einzuwechseln. Halte F fürs Handtuch; aufladen und loslassen zum Anschieben.',
                      )}
            </p>
            <div className="boxing-team-readout">
              <span>
                {mate?.name} ·{' '}
                {mate?.active
                  ? say('IN RING', 'IM RING')
                  : say('CORNER', 'ECKE')}
              </span>
              <span>
                {Math.round(mate?.stamina ?? 0)}% {say('stamina', 'Ausdauer')}
              </span>
            </div>
            {me.active && !transitioning && (
              <div className="boxing-combat-readout">
                {me.counter > 0
                  ? say('COUNTER WINDOW — PUNCH!', 'KONTERFENSTER — SCHLAG!')
                  : me.attack > 0
                    ? me.heavy
                      ? say('HEAVY HOOK', 'SCHWERER HAKEN')
                      : me.combo === 2
                        ? say('CROSS', 'GERADE')
                        : 'JAB'
                    : me.cooldown > 0
                      ? say('Recovering your stance…', 'Stand wiederfinden…')
                      : me.combo === 1 && me.comboTime > 0
                        ? say(
                            'Follow with a cross',
                            'Mit einer Geraden nachsetzen',
                          )
                        : say(
                            'Time your guard. Punish a miss.',
                            'Deckung timen. Fehlschläge kontern.',
                          )}
              </div>
            )}
            {!me.active && (
              <div className="boxing-assist-status">
                <span>
                  {say('Towel', 'Handtuch')}:{' '}
                  {(w?.teams[team].towelCooldown ?? 0) > 0
                    ? Math.ceil(w!.teams[team].towelCooldown) + 's'
                    : say('ready', 'bereit')}
                </span>
                <span>
                  {say('Rope', 'Seil')}:{' '}
                  {(w?.teams[team].ropeCooldown ?? 0) > 0
                    ? Math.ceil(w!.teams[team].ropeCooldown) + 's'
                    : say('ready', 'bereit')}
                </span>
              </div>
            )}
            <div className="boxing-tag-track">
              <i
                style={{
                  width: `${Math.min(100, ((w?.teams[team].tagProgress ?? 0) / 0.45) * 100)}%`,
                }}
              />
            </div>
          </section>
          {touch && (
            <TouchControls
              disabled={disabled || w?.phase !== 'playing'}
              showJump={false}
              moveLabel={say('MOVE', 'BEWEGEN')}
              move={(vector) => controls.current.patch(vector)}
              jump={() => {}}
            />
          )}
          <div
            className="boxing-actions"
            aria-label={say('Boxing controls', 'Boxsteuerung')}
          >
            {me.active ? (
              <>
                <button
                  disabled={disabled}
                  className="boxing-punch"
                  {...hold('punch')}
                >
                  <Hand />
                  <span>
                    {me.charge >= 0.45
                      ? say('HOOK', 'HAKEN')
                      : me.combo === 1 && me.comboTime > 0 && me.attack === 0
                        ? say('CROSS', 'GERADE')
                        : say('PUNCH', 'SCHLAG')}
                  </span>
                  <kbd>{say('Space', 'Leertaste')}</kbd>
                  <i style={{ width: `${me.charge * 100}%` }} />
                </button>
                <button disabled={disabled} {...hold('guard')}>
                  <Shield />
                  <span>{say('GUARD', 'DECKUNG')}</span>
                  <kbd>Shift</kbd>
                </button>
                <button disabled={disabled} {...hold('dodge')}>
                  <Zap />
                  <span>{say('DODGE', 'AUSWEICHEN')}</span>
                  <kbd>Q</kbd>
                </button>
              </>
            ) : (
              <button
                disabled={disabled}
                className="boxing-punch"
                {...hold('assist')}
              >
                <Sparkles />
                <span>{say('ASSIST', 'HELFEN')}</span>
                <kbd>F</kbd>
                <i
                  style={{ width: `${Math.min(100, me.assistCharge * 100)}%` }}
                />
              </button>
            )}
            <button
              disabled={disabled || transitioning || w?.phase !== 'playing'}
              className="boxing-tag"
              aria-pressed={!me.active ? me.tagRequested : undefined}
              {...hold('tag')}
            >
              <Shuffle />
              <span>
                {me.active
                  ? say('TAG', 'WECHSEL')
                  : me.tagRequested
                    ? say('CANCEL', 'ABBRECHEN')
                    : say('CALL / TAG', 'RUF / WECHSEL')}
              </span>
              <kbd>
                {(w?.teams[team].tagCooldown ?? 0) > 0
                  ? `${Math.ceil(w!.teams[team].tagCooldown)}s`
                  : 'E'}
              </kbd>
            </button>
          </div>
          {!touch && (
            <div className="boxing-movement">
              W A S D{' '}
              <span>
                {say(
                  'move · release punch to swing',
                  'bewegen · Schlag loslassen zum Schwingen',
                )}
              </span>
            </div>
          )}
        </>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="boxing-help">
          <DialogTitle>
            {say(
              'Your corner has your back.',
              'Deine Ecke hält dir den Rücken frei.',
            )}
          </DialogTitle>
          <p>
            {say(
              'Win three knockdowns as a team. Empty seats are played by bots; friends can join through Multiplayer.',
              'Gewinnt als Team drei Niederschläge. Bots übernehmen freie Plätze; Freunde kommen über Mehrspieler dazu.',
            )}
          </p>
          <ol>
            <li>
              {say(
                'Move with WASD or the joystick. You face your opponent automatically.',
                'Bewege dich mit WASD oder Joystick. Du schaust automatisch zum Gegner.',
              )}
            </li>
            <li>
              {say(
                'Tap Space for a jab, then tap again as you recover for a cross. Hold and release for a heavy hook. Heavy misses have longer recovery. Guard cancels a charge to feint.',
                'Tippe die Leertaste für einen Jab, dann nach der Erholung erneut für eine Gerade. Halten und loslassen: schwerer Haken. Fehlschläge brauchen länger. Deckung bricht das Aufladen als Finte ab.',
              )}
            </li>
            <li>
              {say(
                'Hold Shift to guard. Raise it just before contact to parry and counter. A successful Q dodge also opens a counter. Low-stamina guards can break.',
                'Halte Shift für Deckung. Kurz vor dem Treffer hochziehen: Parade und Konter. Erfolgreiches Ausweichen mit Q öffnet ebenfalls ein Konterfenster. Bei wenig Ausdauer bricht die Deckung.',
              )}
            </li>
            <li>
              {say(
                'Outside: tap E once to call your partner and accept a tag; tap again to cancel. Your NPC returns automatically. Inside: retreat to your coloured corner and hold E. Tags wait until you are upright and clear of the fight.',
                'Draußen: E einmal tippen, um den Partner zu rufen und den Wechsel anzunehmen; erneut tippen zum Abbrechen. Dein NPC kommt automatisch. Im Ring: zur eigenen Ecke zurück und E halten. Wechsel warten, bis du stehst und aus dem Kampf bist.',
              )}
            </li>
            <li>
              {say(
                'Outside: move along your apron, recover stamina and hold F beside your partner for a towel. Charge for a second and release to launch them off the ropes. Watch the cooldowns.',
                'Draußen: Bewege dich an deiner Ecke, erhole dich und halte F beim Partner fürs Handtuch. Eine Sekunde aufladen und loslassen, um ihn von den Seilen abzustoßen. Beachte die Abklingzeiten.',
              )}
            </li>
            <li>
              {say(
                'Knockdowns stop the fight and rotate partners. A tie at the time limit gets 45 seconds of sudden death, then a draw.',
                'Niederschläge stoppen den Kampf und wechseln die Partner. Bei Gleichstand gibt es 45 Sekunden Verlängerung, danach ein Remis.',
              )}
            </li>
          </ol>
          <button className="boxing-primary" onClick={() => setHelp(false)}>
            {say('Got it. Gloves up.', 'Verstanden. Handschuhe hoch.')}
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
