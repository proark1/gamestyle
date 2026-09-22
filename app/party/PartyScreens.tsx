'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useState } from 'react';
import { Check, Copy, LogOut, Pause, Play, Share2, X } from 'lucide-react';
import { COLORS } from '@/shared/rendering/palette';
import { publicGameOrigin } from '@/shared/browser/public-url';
import { createParty, joinParty, stateOf } from '@/platform/party/client';
import { BRIEFING_MIN_MS } from '@/platform/party/flow';
import { getPartyGameInfo } from '@/platform/party/playlist';
import type { PartyAction, PartyRoomState } from '@/platform/party/types';
import type { Identity } from './PartyClient';
import PartyPodium from './PartyPodium';
import PartyPlaza from './PartyPlaza';
import {
  GameBriefing,
  PartyAvatar,
  PartyStandings,
  RoundDetails,
  partyError,
  usePartyText,
} from './PartyDetails';

type ScreenProps = {
  room: PartyRoomState;
  playerId: string;
  token: string;
  busy: boolean;
  act: (action: PartyAction) => Promise<void>;
};
export function PartyEntry({
  initialCode,
  onEnter,
}: {
  initialCode?: string;
  onEnter: (room: PartyRoomState, identity: Identity) => void;
}) {
  const { de, text } = usePartyText();
  const [name, setName] = useState(''),
    [color, setColor] = useState(0);
  const [code, setCode] = useState(initialCode?.toUpperCase() ?? '');
  const [entry, setEntry] = useState<'host' | 'join'>(
    initialCode ? 'join' : 'host',
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    try {
      const prefs = JSON.parse(
        localStorage.getItem('stack-or-sink-prefs-v1') ?? '{}',
      );
      if (typeof prefs.name === 'string') setName(prefs.name);
      if (Number.isInteger(prefs.color))
        setColor(Math.max(0, Math.min(3, prefs.color)));
    } catch {}
  }, []);
  async function enter() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const seat =
        entry === 'host'
          ? await createParty(name.trim() || text('Player', 'Spieler'), color)
          : await joinParty(
              code.trim().toUpperCase(),
              name.trim() || text('Player', 'Spieler'),
              color,
            );
      // Keep the allocated seat even if changing the suggested format fails.
      let fresh = seat.state;
      if (entry === 'host')
        try {
          fresh = await stateOf({
            op: 'format',
            code: seat.state.code,
            hostId: seat.playerId,
            token: seat.token,
            format: 'quick',
          });
        } catch {}
      onEnter(fresh, {
        code: fresh.code,
        playerId: seat.playerId,
        token: seat.token,
      });
    } catch (err) {
      setError(partyError(err, de));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="party-entry">
      <div className="party-entry-heading">
        <PartyAvatar player={{ color }} />
        <p className="party-kicker">
          {text('Bring your crew', 'Bring deine Crew mit')}
        </p>
        <h1 className="party-title" tabIndex={-1}>
          {initialCode && entry === 'join'
            ? text('You’re invited!', 'Du bist eingeladen!')
            : text(
                'A little chaos. Together.',
                'Ein bisschen Chaos. Gemeinsam.',
              )}
        </h1>
        <p className="party-subtitle">
          {text(
            '2–4 friends, one party. Play, vote and cheer each other on. Solo practice is welcome too.',
            '2–4 Freunde, eine Party. Spielen, abstimmen und gemeinsam jubeln. Solo üben geht auch.',
          )}
        </p>
      </div>
      <form
        className="party-card party-entry-form"
        onSubmit={(e) => {
          e.preventDefault();
          void enter();
        }}
      >
        <div
          className="party-segment"
          aria-label={text('Host or join', 'Erstellen oder beitreten')}
        >
          <button
            type="button"
            aria-pressed={entry === 'host'}
            onClick={() => setEntry('host')}
          >
            {text('Host a party', 'Party erstellen')}
          </button>
          <button
            type="button"
            aria-pressed={entry === 'join'}
            onClick={() => setEntry('join')}
          >
            {text('Join friends', 'Freunden beitreten')}
          </button>
        </div>
        <label className="party-field">
          {text('Your name', 'Dein Name')}
          <input
            name="player-name"
            value={name}
            maxLength={18}
            autoComplete="off"
            placeholder={text('Player', 'Spieler')}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <fieldset className="party-colors">
          <legend>{text('Your crew color', 'Deine Crew-Farbe')}</legend>
          {COLORS.map((value, index) => (
            <button
              type="button"
              key={value}
              style={{ background: value }}
              aria-label={
                de
                  ? ['Bernstein', 'Türkis', 'Koralle', 'Pflaume'][index]
                  : ['Amber', 'Teal', 'Coral', 'Plum'][index]
              }
              aria-pressed={color === index}
              onClick={() => setColor(index)}
            >
              {color === index ? <Check size={20} /> : ''}
            </button>
          ))}
        </fieldset>
        {entry === 'join' && (
          <label className="party-field">
            {text('6-character party code', '6-stelliger Partycode')}
            <input
              name="party-code"
              value={code}
              maxLength={6}
              minLength={6}
              pattern="[A-Za-z2-9]{6}"
              autoCapitalize="characters"
              autoComplete="off"
              required
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))
              }
            />
          </label>
        )}
        {error && (
          <p className="party-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="party-btn party-btn-primary"
          type="submit"
          disabled={busy || (entry === 'join' && code.length !== 6)}
        >
          {busy
            ? text('Connecting…', 'Verbinden…')
            : entry === 'host'
              ? text('Create party', 'Party erstellen')
              : text(
                  `Join ${code || 'party'}`,
                  `${code || 'Party'} beitreten`,
                )}{' '}
          <Play size={17} />
        </button>
        <p className="party-muted">
          {text(
            'No account needed. Share one link for the whole session.',
            'Kein Konto nötig. Ein Link für die ganze Spielrunde.',
          )}
        </p>
      </form>
    </div>
  );
}

export function PartyLobby({
  room,
  playerId,
  token,
  busy,
  act,
  onPresence,
}: ScreenProps & { onPresence: (room: PartyRoomState) => void }) {
  const { text } = usePartyText();
  const [copied, setCopied] = useState(false),
    [fallback, setFallback] = useState(false);
  const humans = room.players.filter((p) => !p.isBot),
    me = humans.find((p) => p.id === playerId),
    host = room.hostId === playerId;
  const invite = `${publicGameOrigin()}/party?room=${room.code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
    } catch {
      setFallback(true);
    }
  }
  async function share() {
    if (navigator.share)
      try {
        await navigator.share({ title: 'Jumbleyard Party', url: invite });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    await copy();
  }
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="party-lobby">
      <div className="party-section-heading">
        <div>
          <p className="party-kicker">
            {text('Your crew is gathering', 'Deine Crew kommt zusammen')}
          </p>
          <h1 className="party-title" tabIndex={-1}>
            {text('Make room for mayhem', 'Platz fürs Chaos')}
          </h1>
        </div>
        <span className="party-code">{room.code}</span>
      </div>
      <div className="party-invite">
        <span>
          {text(
            'One link keeps the crew together.',
            'Ein Link hält die Crew zusammen.',
          )}
        </span>
        <button
          className="party-btn party-btn-secondary"
          onClick={() => void copy()}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied
            ? text('Copied', 'Kopiert')
            : text('Copy invite', 'Link kopieren')}
        </button>
        <button
          className="party-icon-btn"
          onClick={() => void share()}
          aria-label={text('Share invitation', 'Einladung teilen')}
        >
          <Share2 size={18} />
        </button>
      </div>
      {fallback && (
        <label className="party-field">
          {text('Copy this invitation', 'Diese Einladung kopieren')}
          <input readOnly value={invite} onFocus={(e) => e.target.select()} />
        </label>
      )}
      <PartyPlaza
        room={room}
        playerId={playerId}
        token={token}
        onPresence={onPresence}
      />
      <div className="party-roster">
        {humans.map((p) => (
          <div className="party-roster-row" key={p.id}>
            <PartyAvatar player={p} />
            <span className="party-player-name">
              <strong>
                {p.name}
                {p.id === playerId ? text(' (You)', ' (Du)') : ''}
              </strong>
              <small>
                {p.isHost ? text('Host', 'Gastgeber') : text('Crew', 'Crew')}
              </small>
            </span>
            <span
              className={`party-ready-state ${p.ready && p.connected !== false ? 'is-ready' : ''}`}
            >
              {p.connected === false
                ? text('Reconnecting', 'Verbindet…')
                : p.browsing
                  ? text('Trying on outfits', 'Probiert Kleidung an')
                  : p.ready
                    ? text('Ready ✓', 'Bereit ✓')
                    : text('Getting ready', 'Macht sich bereit')}
            </span>
            {host && p.id !== playerId && (
              <button
                className="party-icon-btn"
                disabled={busy}
                aria-label={text(`Remove ${p.name}`, `${p.name} entfernen`)}
                onClick={() =>
                  void act({
                    op: 'remove_player',
                    code: room.code,
                    hostId: playerId,
                    token,
                    targetId: p.id,
                  })
                }
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
        {humans.length < 4 && (
          <p className="party-helper-note">
            ✦{' '}
            {text(
              `${4 - humans.length} game helper${humans.length === 3 ? '' : 's'} fill empty seats automatically. Helpers do not vote or earn tournament points.`,
              `${4 - humans.length} Spielhelfer füllen freie Plätze automatisch. Helfer stimmen nicht ab und sammeln keine Turnierpunkte.`,
            )}
          </p>
        )}
      </div>
      <fieldset className="party-formats">
        <legend>{text('Pick the pace', 'Wählt euer Tempo')}</legend>
        {(['quick', 'classic'] as const).map((format) => (
          <button
            type="button"
            key={format}
            disabled={!host || busy}
            aria-pressed={room.format === format}
            onClick={() =>
              void act({
                op: 'format',
                code: room.code,
                hostId: playerId,
                token,
                format,
              })
            }
          >
            <strong>
              {format === 'quick' ? 'Quick Party' : 'Classic Party'}
            </strong>
            <span>
              {format === 'quick'
                ? text(
                    '3 short games · about 10–15 min',
                    '3 kurze Spiele · etwa 10–15 Min.',
                  )
                : text(
                    '6 games · about 25–40 min',
                    '6 Spiele · etwa 25–40 Min.',
                  )}
            </span>
          </button>
        ))}
      </fieldset>
      <p className="party-up-next">
        <span>{text('First up', 'Zum Auftakt')}</span>
        <strong>{getPartyGameInfo(room.playlist[0])?.name}</strong>
        <small>
          {text(
            'After each round, your crew chooses the next game.',
            'Nach jeder Runde wählt eure Crew das nächste Spiel.',
          )}
        </small>
      </p>
      <footer className="party-primary-footer" id="party-ready-controls">
        <p>
          {humans.length === 1
            ? text(
                'Solo practice — invite a friend to compete.',
                'Solo-Übung — lade Freunde für ein Turnier ein.',
              )
            : humans.every((p) => p.ready && p.connected !== false)
              ? text(
                  'Everyone is ready. Let’s play!',
                  'Alle sind bereit. Los geht’s!',
                )
              : text(
                  'Start when every friend is connected and ready.',
                  'Los geht’s, wenn alle verbunden und bereit sind.',
                )}
        </p>
        {host ? (
          <button
            className="party-btn party-btn-primary"
            disabled={
              busy ||
              humans.some(
                (p) => !p.ready || p.connected === false || p.browsing,
              )
            }
            onClick={() =>
              void act({
                op: 'start',
                code: room.code,
                hostId: playerId,
                token,
              })
            }
          >
            <Play size={18} />
            {humans.length === 1
              ? text(
                  'Start practice + 3 helpers',
                  'Übung mit 3 Helfern starten',
                )
              : text(
                  `Start with ${humans.length} players${humans.length < 4 ? ` + ${4 - humans.length} helpers` : ''}`,
                  `Mit ${humans.length} Spielern${humans.length < 4 ? ` + ${4 - humans.length} Helfern` : ''} starten`,
                )}
          </button>
        ) : (
          <button
            className="party-btn party-btn-primary"
            disabled={busy}
            aria-pressed={me?.ready}
            onClick={() =>
              void act({
                op: 'ready',
                code: room.code,
                playerId,
                token,
                ready: !me?.ready,
              })
            }
          >
            {me?.ready
              ? text('Ready ✓ · Undo', 'Bereit ✓ · Zurücknehmen')
              : text('I’m ready', 'Ich bin bereit')}
          </button>
        )}
      </footer>
    </div>
  );
}
export function PartyBriefing({
  room,
  playerId,
  token,
  busy,
  act,
  now,
  onBreak,
}: ScreenProps & { now: number; onBreak: () => void }) {
  const { text } = usePartyText();
  const humans = room.players.filter((p) => !p.isBot && p.connected !== false),
    paused = room.pausedAt !== undefined;
  return (
    <div className="party-briefing">
      <p className="party-kicker">
        {room.currentRound === 0
          ? text('Your first game', 'Euer erstes Spiel')
          : text('Your crew chose', 'Eure Crew hat gewählt')}{' '}
        · {room.currentRound + 1}/{room.playlist.length}
      </p>
      <h1 className="party-title" tabIndex={-1}>
        {getPartyGameInfo(room.playlist[room.currentRound])?.name}
      </h1>
      <GameBriefing room={room} playerId={playerId} />
      <footer className="party-primary-footer">
        <output>
          {text(
            `${room.briefing?.ready.filter((id) => humans.some((p) => p.id === id)).length ?? 0}/${humans.length} ready · The game clock starts after everyone connects.`,
            `${room.briefing?.ready.filter((id) => humans.some((p) => p.id === id)).length ?? 0}/${humans.length} bereit · Die Spielzeit beginnt, wenn alle verbunden sind.`,
          )}
        </output>
        <div className="party-action-row">
          <button
            className="party-btn party-btn-secondary"
            disabled={busy || (paused && room.hostId !== playerId)}
            onClick={onBreak}
          >
            <Pause size={15} />
            {paused
              ? text('Resume', 'Fortsetzen')
              : text('Take a break', 'Pause machen')}
          </button>
          <button
            className="party-btn party-btn-primary"
            disabled={
              busy ||
              paused ||
              room.briefing?.ready.includes(playerId) ||
              now < (room.briefing?.startedAt ?? now) + BRIEFING_MIN_MS
            }
            onClick={() =>
              void act({
                op: 'briefing_ready',
                code: room.code,
                playerId,
                token,
                round: room.currentRound,
              })
            }
          >
            {room.briefing?.ready.includes(playerId)
              ? text(
                  'Ready ✓ · Waiting for crew',
                  'Bereit ✓ · Warte auf die Crew',
                )
              : text('Got it — I’m ready', 'Verstanden — ich bin bereit')}
          </button>
        </div>
      </footer>
    </div>
  );
}
export function PartyFinale({
  room,
  playerId,
  token,
  busy,
  act,
  onExit,
}: ScreenProps & { onExit: () => void }) {
  const { text } = usePartyText();
  const humans = room.players.filter((p) => !p.isBot);
  const completed = room.roundResults.filter(
    (r) =>
      r.reports?.[playerId] !== null && r.reports?.[playerId] !== undefined,
  ).length;
  return (
    <div className="party-finale">
      <p className="party-kicker">
        {text('That’s a wrap, crew', 'Geschafft, Crew')}
      </p>
      <h1 className="party-title" tabIndex={-1}>
        {room.practice
          ? text('Good practice!', 'Gut geübt!')
          : text('The final standings', 'Die Gesamtwertung')}
      </h1>
      <PartyPodium
        players={room.players}
        playerId={playerId}
        practice={room.practice}
      />
      <PartyStandings room={room} playerId={playerId} />
      {completed > 0 && (
        <p className="party-highlight">
          {text(
            `You finished ${completed} of ${room.playlist.length} rounds with your crew.`,
            `Du hast ${completed} von ${room.playlist.length} Runden mit deiner Crew abgeschlossen.`,
          )}
        </p>
      )}
      <div className="party-recap-list">
        <h2>
          {text('Your party, round by round', 'Eure Party, Runde für Runde')}
        </h2>
        {room.roundResults.map((result) => (
          <details className="party-recap" key={result.round}>
            <summary>
              {result.round + 1}. {getPartyGameInfo(result.game)?.name}{' '}
              <span>+{result.pointsAwarded[playerId] ?? 0}</span>
            </summary>
            <RoundDetails room={room} result={result} playerId={playerId} />
          </details>
        ))}
      </div>
      <footer className="party-primary-footer">
        <output>
          {text(
            `${room.rematchVotes?.length ?? 0}/${humans.length} want another party`,
            `${room.rematchVotes?.length ?? 0}/${humans.length} möchten noch eine Party`,
          )}
        </output>
        <div className="party-action-row">
          <button
            className="party-btn party-btn-secondary"
            disabled={busy || room.rematchVotes?.includes(playerId)}
            onClick={() =>
              void act({
                op: 'rematch_interest',
                code: room.code,
                playerId,
                token,
              })
            }
          >
            {room.rematchVotes?.includes(playerId)
              ? text('Count me in ✓', 'Bin dabei ✓')
              : text('I’m in for another!', 'Ich bin wieder dabei!')}
          </button>
          {room.hostId === playerId && (
            <button
              className="party-btn party-btn-primary"
              disabled={busy}
              onClick={() =>
                void act({
                  op: 'rematch',
                  code: room.code,
                  hostId: playerId,
                  token,
                })
              }
            >
              {text(
                'Back to lobby for a rematch',
                'Für Revanche zurück zur Lobby',
              )}
            </button>
          )}
        </div>
        <button className="party-btn party-btn-ghost" onClick={onExit}>
          <LogOut size={16} />
          {text('Exit to collection', 'Zur Spielesammlung')}
        </button>
      </footer>
    </div>
  );
}
export function PartyWaiting({
  room,
  playerId,
  countdown,
  onRetry,
  onClose,
  onMenu,
}: ScreenProps & {
  countdown: number;
  onRetry: () => void;
  onClose: () => void;
  onMenu: () => void;
}) {
  const { text } = usePartyText();
  const reported = room.reports?.[playerId] !== undefined;
  return (
    <div className="party-waiting">
      <p className="party-kicker">
        {getPartyGameInfo(room.playlist[room.currentRound])?.name}
      </p>
      <h1 className="party-title" tabIndex={-1}>
        {reported
          ? text('Your result is saved', 'Dein Ergebnis ist gespeichert')
          : countdown > 0
            ? text('Here we go!', 'Los geht’s!')
            : text('Connecting the crew', 'Crew wird verbunden')}
      </h1>
      {!reported && countdown > 0 && (
        <strong className="party-countdown" role="timer">
          {countdown}
        </strong>
      )}
      <p className="party-subtitle">
        {reported
          ? text(
              'Stay for the shared result. Your friends are still playing.',
              'Bleib für das gemeinsame Ergebnis. Deine Freunde spielen noch.',
            )
          : text(
              'The match waits for everyone to connect. Voice stays with you.',
              'Das Spiel wartet, bis alle verbunden sind. Euer Sprachchat bleibt dabei.',
            )}
      </p>
      <PartyStandings room={room} playerId={playerId} />
      {reported && (
        <ul className="party-wait-list">
          {room.players
            .filter((p) => !p.isBot)
            .map((p) => (
              <li key={p.id}>
                {p.name}
                <span>
                  {room.reports?.[p.id] !== undefined
                    ? text('Finished', 'Fertig')
                    : p.connected === false
                      ? text('Reconnecting · 60s grace', 'Verbindet · 60s Zeit')
                      : text('Playing', 'Spielt')}
                </span>
              </li>
            ))}
        </ul>
      )}
      <div className="party-action-row">
        {!reported && (
          <button className="party-btn party-btn-secondary" onClick={onRetry}>
            {text('Retry connection', 'Verbindung erneut versuchen')}
          </button>
        )}
        {reported && room.hostId === playerId && (
          <button className="party-btn party-btn-secondary" onClick={onClose}>
            {text('End round for everyone', 'Runde für alle beenden')}
          </button>
        )}
        <button className="party-btn party-btn-ghost" onClick={onMenu}>
          {text('Party menu', 'Partymenü')}
        </button>
      </div>
    </div>
  );
}
