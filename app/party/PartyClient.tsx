'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  Gamepad2,
  HelpCircle,
  LogOut,
  MoreHorizontal,
  Pause,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import VoicePanel from '@/shared/voice/VoicePanel';
import LanguageSwitcher from '@/shared/language/LanguageSwitcher';
import {
  applyAudioPreferences,
  loadAudioPreferences,
} from '@/shared/audio/preferences';
import { getPartyGameInfo } from '@/platform/party/playlist';
import {
  partyRequest,
  stateOf,
  leaveParty,
  reportPartyResult,
} from '@/platform/party/client';
import type { PartyAction, PartyRoomState } from '@/platform/party/types';
import type { PeerSession } from '@/shared/peer/types';
import PartyIntermission from './PartyIntermission';
import {
  GameBriefing,
  PartyStandings,
  partyError,
  usePartyText,
} from './PartyDetails';
import {
  PartyEntry,
  PartyLobby,
  PartyBriefing,
  PartyFinale,
  PartyWaiting,
} from './PartyScreens';
import { partyCue, unlockPartyAudio } from './party-audio';
import { useGameTracker } from '@/shared/analytics/game-tracker';
import { partyTracker } from './party-tracker';
import './party.css';
import '@/shared/ui/toolbar.css';

const SESSION_KEY = 'jumbleyard-party-session-v1';
export type Identity = { code: string; playerId: string; token: string };
export default function PartyClient({ initialCode }: { initialCode?: string }) {
  useGameTracker(partyTracker);
  const { de, text } = usePartyText();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [room, setRoom] = useState<PartyRoomState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [launchError, setLaunchError] = useState('');
  const [gameFrame, setGameFrame] = useState('');
  const [gameReady, setGameReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [panel, setPanel] = useState<
    'menu' | 'help' | 'standings' | 'forfeit' | 'leave' | 'close' | null
  >(null);
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const frame = useRef<HTMLIFrameElement>(null);
  const clock = useRef({ server: Date.now(), local: Date.now() });
  const version = useRef({ code: '', revision: -1, stamp: 0 });
  const acceptRoom = useCallback((fresh: PartyRoomState) => {
    const revision = fresh.revision ?? 0,
      stamp = fresh.serverNow ?? fresh.updated;
    if (
      version.current.code === fresh.code &&
      (revision < version.current.revision ||
        (revision === version.current.revision &&
          stamp < version.current.stamp))
    )
      return;
    version.current = { code: fresh.code, revision, stamp };
    clock.current = {
      server: fresh.serverNow ?? Date.now(),
      local: Date.now(),
    };
    setRoom(fresh);
  }, []);
  const forget = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('jumbleyard:party-game');
    setIdentity(null);
    setRoom(null);
    setGameFrame('');
    setPanel(null);
    setConnectionError('');
    setLaunchError('');
    version.current = { code: '', revision: -1, stamp: 0 };
  }, []);
  useEffect(() => {
    setMuted(loadAudioPreferences().volume === 0);
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
      if (
        saved?.code &&
        saved?.playerId &&
        saved?.token &&
        (!initialCode || saved.code === initialCode.toUpperCase())
      )
        setIdentity(saved);
    } catch {
      /* Storage is optional. */
    }
  }, [initialCode]);
  useEffect(() => {
    if (!identity) return;
    let live = true,
      polling = false,
      timer: ReturnType<typeof setTimeout>;
    const pulse = async () => {
      if (polling) return;
      polling = true;
      try {
        const fresh = await stateOf({
          op: 'heartbeat',
          code: identity.code,
          playerId: identity.playerId,
          token: identity.token,
        });
        if (!live) return;
        if (!fresh.players.some((p) => p.id === identity.playerId)) {
          forget();
          setError(
            de
              ? 'Dein Platz ist nicht mehr in dieser Party. Tritt einem anderen Raum bei.'
              : 'Your seat is no longer in that party. You can join another room.',
          );
          return;
        }
        acceptRoom(fresh);
        setConnectionError('');
      } catch (err) {
        if (!live) return;
        if ([401, 404].includes((err as { status?: number }).status ?? 0)) {
          forget();
          setError(partyError(err, de));
          return;
        }
        setConnectionError(
          de
            ? 'Verbindung unterbrochen. Wir verbinden dich erneut; dein Punktestand ist gespeichert.'
            : 'Connection interrupted. Reconnecting automatically; your score is saved.',
        );
      } finally {
        polling = false;
      }
      if (live) timer = setTimeout(pulse, 2000);
    };
    void pulse();
    const online = () => {
      clearTimeout(timer);
      void pulse();
    };
    const offline = () =>
      setConnectionError(
        de
          ? 'Du bist offline. Verbinde dich erneut, um mit deiner Crew weiterzuspielen.'
          : 'You’re offline. Reconnect to continue with your crew.',
      );
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [identity, acceptRoom, forget, de]);
  const playerId = identity?.playerId ?? '',
    token = identity?.token ?? '';
  const me = room?.players.find((p) => p.id === playerId);
  const meName = me?.name,
    meColor = me?.color;
  const isHost = room?.hostId === playerId;
  const humans = room?.players.filter((p) => !p.isBot) ?? [];
  const reported = !!room && room.reports?.[playerId] !== undefined;
  const currentGame = room?.playlist[room.currentRound];
  const partyCode = room?.code,
    partyRound = room?.currentRound,
    partyStatus = room?.status,
    countdownUntil = room?.countdownUntil;
  const runId = room?.runId;
  const priorRoom = useRef<PartyRoomState | null>(null);
  useEffect(() => {
    const prior = priorRoom.current;
    if (
      prior?.intermission?.phase === 'voting' &&
      room?.currentRound !== prior.currentRound &&
      !prior.intermission.votes[playerId]
    )
      partyTracker.action('missed-vote');
    priorRoom.current = room;
    partyTracker.observe({
      stage: !room
        ? 'menu'
        : room.status === 'lobby'
          ? 'lobby'
          : room.status === 'finished'
            ? 'finished'
            : 'playing',
      mode: room?.practice ? 'solo' : isHost ? 'host' : 'join',
      room: room?.code,
      humans: humans.length,
      npcs: room ? 4 - humans.length : 0,
      round: runId,
      milestones:
        room?.status === 'briefing'
          ? ['briefing']
          : room?.status === 'finished'
            ? ['party-complete']
            : [],
      ...(room?.status === 'finished'
        ? {
            result: {
              outcome: 'ended' as const,
              reason: 'completed',
              score: me?.score ?? 0,
            },
          }
        : {}),
    });
  }, [room, playerId, isHost, humans.length, runId, me?.score]);
  useEffect(() => {
    if (gameReady) partyTracker.milestone('first-game');
  }, [gameReady]);
  useEffect(() => {
    if (panel === 'help') partyTracker.action('help');
  }, [panel]);
  useEffect(() => {
    if (!identity || meName === undefined || meColor === undefined) return;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ ...identity, name: meName, color: meColor, isHost }),
      );
      localStorage.setItem(
        'stack-or-sink-prefs-v1',
        JSON.stringify({
          ...JSON.parse(localStorage.getItem('stack-or-sink-prefs-v1') ?? '{}'),
          name: meName,
          color: meColor,
        }),
      );
    } catch {
      /* The current session still works without persistence. */
    }
  }, [identity, meName, meColor, isHost]);
  useEffect(() => {
    window.addEventListener('pointerdown', unlockPartyAudio, { once: true });
    window.addEventListener('keydown', unlockPartyAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockPartyAudio);
      window.removeEventListener('keydown', unlockPartyAudio);
    };
  }, []);
  useEffect(() => {
    const tick = () =>
      setNow(clock.current.server + Date.now() - clock.current.local);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setPanel(null);
    if (partyStatus !== 'countdown' && partyStatus !== 'in_game') {
      setGameFrame('');
      setLaunchError('');
    }
    if (partyStatus === 'intermission') partyCue('result');
    if (partyStatus === 'finished') partyCue('victory');
    const timer = setTimeout(
      () =>
        document
          .querySelector<HTMLElement>('.party-main h1')
          ?.focus({ preventScroll: true }),
      0,
    );
    return () => clearTimeout(timer);
  }, [partyStatus, partyRound]);
  useEffect(() => {
    if (reported) {
      setGameFrame('');
      setLaunchError('');
    }
  }, [reported]);
  useEffect(() => {
    window.dispatchEvent(new Event('game:voice-reset-talk'));
  }, [gameFrame]);
  useEffect(() => {
    if (!gameFrame) {
      setGameReady(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!gameReady)
        setLaunchError(
          de
            ? 'Das Spiel braucht länger als erwartet. Tritt dieser Runde erneut bei oder öffne das Partymenü.'
            : 'The game is taking longer than expected. Rejoin this round or return to the party menu.',
        );
    }, 30000);
    return () => clearTimeout(timer);
  }, [gameFrame, gameReady, de]);
  useEffect(() => {
    const received = (event: MessageEvent) => {
      if (
        !partyCode ||
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.code !== partyCode
      )
        return;
      if (event.data.type === 'party-game-ready') {
        setGameReady(true);
        setLaunchError('');
      }
      if (event.data.type === 'party-open-menu') setPanel('menu');
      if (
        event.data.type === 'party-game-error' &&
        !reported &&
        (partyStatus === 'countdown' || partyStatus === 'in_game')
      )
        setLaunchError(
          de
            ? 'Die Spielverbindung wurde unterbrochen. Tritt der Runde erneut bei.'
            : 'The game connection was interrupted. Rejoin this round to recover.',
        );
      if (event.data.type === 'party-round-finished' && identity) {
        void stateOf({
          op: 'heartbeat',
          code: identity.code,
          playerId: identity.playerId,
          token: identity.token,
        })
          .then(acceptRoom)
          .catch(() => {});
      }
      if (
        event.data.type === 'party-ptt' &&
        ['keydown', 'keyup'].includes(event.data.event) &&
        /^Key[A-Z]$/.test(event.data.keyCode)
      )
        window.dispatchEvent(
          new KeyboardEvent(event.data.event, {
            code: event.data.keyCode,
            key: event.data.keyCode.slice(3),
            bubbles: true,
          }),
        );
      if (event.data.type === 'party-ptt-reset')
        window.dispatchEvent(new Event('game:voice-reset-talk'));
    };
    window.addEventListener('message', received);
    return () => window.removeEventListener('message', received);
  }, [partyCode, partyStatus, reported, identity, acceptRoom, de]);
  useEffect(() => {
    if (
      !partyCode ||
      partyStatus !== 'countdown' ||
      !countdownUntil ||
      reported ||
      gameFrame ||
      !playerId ||
      !token ||
      !currentGame
    )
      return;
    let live = true,
      timer: ReturnType<typeof setTimeout>,
      attempts = 0;
    const launch = async () => {
      const left =
        countdownUntil -
        (clock.current.server + Date.now() - clock.current.local);
      if (left > 0) {
        timer = setTimeout(() => void launch(), Math.min(500, left));
        return;
      }
      try {
        const data = await partyRequest<{ session: PeerSession }>({
          op: 'game_session',
          code: partyCode,
          round: partyRound!,
          playerId,
          token,
        });
        if (!live) return;
        sessionStorage.setItem(
          'jumbleyard:party-game',
          JSON.stringify({
            party: partyCode,
            round: partyRound,
            session: data.session,
          }),
        );
        setGameReady(false);
        setLaunchError('');
        setGameFrame(
          `/${currentGame}?party=${partyCode}&round=${partyRound}&attempt=${retry}`,
        );
      } catch (err) {
        if (!live) return;
        setLaunchError(partyError(err, de));
        if (++attempts < 3) timer = setTimeout(() => void launch(), 2500);
      }
    };
    void launch();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [
    partyCode,
    partyStatus,
    countdownUntil,
    partyRound,
    currentGame,
    reported,
    gameFrame,
    playerId,
    token,
    retry,
    runId,
    de,
  ]);
  const countdown = countdownUntil
    ? Math.max(0, Math.ceil((countdownUntil - now) / 1000))
    : 0;
  useEffect(() => {
    if (partyStatus === 'countdown' && countdown > 0 && countdown <= 3)
      partyCue('countdown');
  }, [partyStatus, countdown]);
  async function act(action: PartyAction) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      acceptRoom(await stateOf(action));
      if (action.op === 'rematch_interest')
        partyTracker.action('rematch-interest');
      if (action.op === 'pause' && action.paused) partyTracker.action('break');
    } catch (err) {
      setError(partyError(err, de));
    } finally {
      setBusy(false);
    }
  }
  async function exit() {
    if (identity)
      try {
        await leaveParty(identity.code, { id: playerId, token });
      } catch {
        /* Local exit remains available offline. */
      }
    forget();
    location.assign('/');
  }
  async function giveUp() {
    if (!room || busy) return;
    setBusy(true);
    setError('');
    try {
      acceptRoom(
        await reportPartyResult(
          room.code,
          room.currentRound,
          { id: playerId, token },
          null,
        ),
      );
      partyTracker.action(`forfeit-${room.playlist[room.currentRound]}`);
      setGameFrame('');
      setPanel(null);
    } catch (err) {
      setError(partyError(err, de));
    } finally {
      setBusy(false);
    }
  }
  const retryGame = () => {
    partyTracker.action('rejoin');
    setLaunchError('');
    setGameReady(false);
    setGameFrame('');
    setRetry((n) => n + 1);
    setPanel(null);
  };
  const paused = room?.pausedAt !== undefined;
  const toggleBreak = () =>
    room &&
    void act({
      op: 'pause',
      code: room.code,
      playerId,
      token,
      paused: !paused,
    });
  const voice =
    room && identity
      ? {
          session: {
            game: 'party' as const,
            code: room.code,
            id: playerId,
            token,
          },
          snapshot: {
            players: humans.map((p) => ({ id: p.id, name: p.name })),
            nearby: false,
          },
        }
      : null;
  const screenProps = room ? { room, playerId, token, busy, act } : null;
  return (
    <div className={`party-root${gameFrame ? ' party-playing' : ''}`}>
      <header className="party-bar">
        <a
          className="party-brand"
          href={room ? undefined : '/'}
          aria-label="Jumbleyard"
        >
          <Gamepad2 size={22} />
          <span>JUMBLEYARD</span>
        </a>
        {room && (
          <span className="party-bar-status">
            {room.status === 'lobby'
              ? `${room.code} · ${humans.length}/4`
              : `${room.practice ? text('Practice', 'Übung') : text('Round', 'Runde')} ${room.currentRound + 1}/${room.playlist.length}`}
          </span>
        )}
        <nav
          className="party-bar-actions"
          aria-label={text('Party controls', 'Partysteuerung')}
        >
          {room && (
            <button
              className="party-icon-btn"
              onClick={() => setPanel('standings')}
              aria-label={text('Standings', 'Gesamtwertung')}
              title={text('Standings', 'Gesamtwertung')}
            >
              <Trophy size={19} />
            </button>
          )}
          {voice && (
            <div className="party-voice game-toolbar">
              <VoicePanel {...voice} />
            </div>
          )}
          {!room && <LanguageSwitcher variant="toolbar" />}
          {room && (
            <button
              className="party-icon-btn"
              onClick={() => setPanel('menu')}
              aria-label={text('Party menu', 'Partymenü')}
            >
              <MoreHorizontal size={23} />
            </button>
          )}
        </nav>
      </header>
      {(error || connectionError || launchError) && (
        <div className="party-error-banner" role="alert">
          <span>{error || launchError || connectionError}</span>
          {(launchError || (gameFrame && connectionError)) && (
            <button
              className="party-btn party-btn-secondary"
              onClick={retryGame}
            >
              {text('Rejoin round', 'Runde erneut beitreten')}
            </button>
          )}
          {room && (
            <button
              className="party-btn party-btn-ghost"
              onClick={() => setPanel('menu')}
            >
              {text('Party menu', 'Partymenü')}
            </button>
          )}
          {!room && (
            <button
              className="party-icon-btn"
              onClick={() => setError('')}
              aria-label={text('Dismiss', 'Schließen')}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
      {paused && (
        <output className="party-break-banner">
          <Pause size={16} />
          {text(
            'Crew break. Take your time; the timer is paused.',
            'Crew-Pause. Lasst euch Zeit; der Timer steht.',
          )}
          <button
            className="party-btn party-btn-secondary"
            disabled={!isHost || busy}
            onClick={toggleBreak}
          >
            {text('Resume together', 'Gemeinsam fortsetzen')}
          </button>
        </output>
      )}
      {gameFrame ? (
        <main className="party-game-shell">
          <iframe
            key={gameFrame}
            ref={frame}
            src={gameFrame}
            className="party-game-frame"
            title={
              getPartyGameInfo(currentGame!)?.name ??
              text('Party game', 'Partyspiel')
            }
            allow="autoplay; microphone; fullscreen; gamepad"
          />
          {!gameReady && (
            <output className="party-loading-badge">
              {text('Connecting the crew…', 'Crew wird verbunden…')}
            </output>
          )}
        </main>
      ) : (
        <main className="party-main">
          {!room || !screenProps ? (
            <PartyEntry
              initialCode={initialCode}
              onEnter={(fresh, id) => {
                setIdentity(id);
                acceptRoom(fresh);
                history.replaceState(null, '', `/party?room=${fresh.code}`);
              }}
            />
          ) : room.status === 'lobby' ? (
            <PartyLobby {...screenProps} />
          ) : room.status === 'briefing' ? (
            <PartyBriefing {...screenProps} now={now} onBreak={toggleBreak} />
          ) : room.status === 'intermission' ? (
            <>
              <PartyIntermission
                room={room}
                pass={{ id: playerId, token }}
                onRoom={acceptRoom}
              />
              <div className="party-between-actions">
                <button
                  className="party-btn party-btn-secondary"
                  disabled={busy || (paused && !isHost)}
                  onClick={toggleBreak}
                >
                  <Pause size={15} />
                  {paused
                    ? text('Resume', 'Fortsetzen')
                    : text('Take a break', 'Pause machen')}
                </button>
              </div>
            </>
          ) : room.status === 'finished' ? (
            <PartyFinale {...screenProps} onExit={() => void exit()} />
          ) : (
            <PartyWaiting
              {...screenProps}
              countdown={countdown}
              onRetry={retryGame}
              onClose={() => setPanel('close')}
              onMenu={() => setPanel('menu')}
            />
          )}
        </main>
      )}
      <Dialog.Root
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="party-dialog-backdrop" />
          <Dialog.Popup className="party-dialog" aria-describedby={undefined}>
            <div className="party-dialog-heading">
              <Dialog.Title>
                {panel === 'standings'
                  ? text('Overall standings', 'Gesamtwertung')
                  : panel === 'help'
                    ? text('How to play', 'So wird gespielt')
                    : panel === 'forfeit'
                      ? text('Give up this round?', 'Diese Runde aufgeben?')
                      : panel === 'leave'
                        ? text('Leave the party?', 'Party verlassen?')
                        : panel === 'close'
                          ? text(
                              'End the shared round?',
                              'Gemeinsame Runde beenden?',
                            )
                          : text('Party menu', 'Partymenü')}
              </Dialog.Title>
              <Dialog.Close
                className="party-icon-btn"
                aria-label={text('Close', 'Schließen')}
              >
                <X size={20} />
              </Dialog.Close>
            </div>
            {room && panel === 'standings' && (
              <PartyStandings room={room} playerId={playerId} />
            )}
            {room && panel === 'help' && (
              <>
                <h3>{getPartyGameInfo(currentGame!)?.name}</h3>
                <GameBriefing room={room} playerId={playerId} />
                <p className="party-muted">
                  {text(
                    'The live game keeps running while this help is open.',
                    'Das laufende Spiel geht weiter, solange diese Hilfe offen ist.',
                  )}
                </p>
              </>
            )}
            {panel === 'forfeit' && (
              <>
                <p>
                  {text(
                    'You’ll receive 0 points for this round. Your crew can finish playing, and you’ll stay for the next vote.',
                    'Du erhältst für diese Runde 0 Punkte. Deine Crew kann weiterspielen; du bleibst für die nächste Abstimmung.',
                  )}
                </p>
                <div className="party-action-row">
                  <Dialog.Close className="party-btn party-btn-primary">
                    {text('Keep playing', 'Weiterspielen')}
                  </Dialog.Close>
                  <button
                    className="party-btn party-btn-danger"
                    disabled={busy}
                    onClick={() => void giveUp()}
                  >
                    {text('Give up · 0 points', 'Aufgeben · 0 Punkte')}
                  </button>
                </div>
              </>
            )}
            {panel === 'leave' && (
              <>
                <p>
                  {text(
                    'Your crew can keep playing. You’ll return to the game collection.',
                    'Deine Crew kann weiterspielen. Du kehrst zur Spielesammlung zurück.',
                  )}
                </p>
                <button
                  className="party-btn party-btn-danger"
                  onClick={() => void exit()}
                >
                  {text('Leave party', 'Party verlassen')}
                </button>
              </>
            )}
            {room && panel === 'close' && (
              <>
                <p>
                  {text(
                    'This ends the round for the entire crew. Anyone without a saved result gets 0 points.',
                    'Das beendet die Runde für alle. Wer kein gespeichertes Ergebnis hat, erhält 0 Punkte.',
                  )}
                </p>
                <button
                  className="party-btn party-btn-danger"
                  disabled={busy}
                  onClick={() => {
                    void act({
                      op: 'close_round',
                      code: room.code,
                      round: room.currentRound,
                      hostId: playerId,
                      token,
                    });
                    setPanel(null);
                  }}
                >
                  {text('End round for everyone', 'Runde für alle beenden')}
                </button>
              </>
            )}
            {panel === 'menu' && (
              <div className="party-menu-actions">
                <LanguageSwitcher variant="toolbar" />
                <button
                  className="party-btn party-btn-secondary"
                  onClick={() => {
                    const prefs = loadAudioPreferences();
                    applyAudioPreferences({ ...prefs, volume: muted ? 1 : 0 });
                    setMuted(!muted);
                  }}
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  {muted
                    ? text('Enable sound', 'Ton einschalten')
                    : text('Mute sound', 'Ton stummschalten')}
                </button>
                {room && room.status !== 'lobby' && (
                  <button
                    className="party-btn party-btn-secondary"
                    onClick={() => setPanel('help')}
                  >
                    <HelpCircle size={18} />
                    {text('Objective & controls', 'Ziel & Steuerung')}
                  </button>
                )}
                {room && ['briefing', 'intermission'].includes(room.status) && (
                  <button
                    className="party-btn party-btn-secondary"
                    disabled={busy || (paused && !isHost)}
                    onClick={toggleBreak}
                  >
                    <Pause size={18} />
                    {paused
                      ? text('Resume party', 'Party fortsetzen')
                      : text('Take a crew break', 'Crew-Pause machen')}
                  </button>
                )}
                {room?.status === 'countdown' && !reported && (
                  <>
                    <button
                      className="party-btn party-btn-secondary"
                      onClick={retryGame}
                    >
                      {text(
                        'Rejoin this round',
                        'Dieser Runde erneut beitreten',
                      )}
                    </button>
                    <button
                      className="party-btn party-btn-danger"
                      onClick={() => setPanel('forfeit')}
                    >
                      {text('Give up round…', 'Runde aufgeben…')}
                    </button>
                  </>
                )}
                <button
                  className="party-btn party-btn-ghost"
                  onClick={() => setPanel('leave')}
                >
                  <LogOut size={17} />
                  {text('Leave party…', 'Party verlassen…')}
                </button>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
