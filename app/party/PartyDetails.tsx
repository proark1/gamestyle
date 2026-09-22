'use client';
/* oxlint-disable next/no-img-element -- Existing optimized character portraits and gameplay WebPs. */
import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useLanguage } from '@/shared/language/useLanguage';
import { COLORS } from '@/shared/rendering/palette';
import { getPartyGameInfo } from '@/platform/party/playlist';
import { getPartyGuide } from '@/platform/party/guides';
import { roundAssignments, partyRole } from '@/platform/party/flow';
import type {
  PartyPlayer,
  PartyRoomState,
  RoundResult,
} from '@/platform/party/types';

export function usePartyText() {
  const { language } = useLanguage();
  const de = language === 'de';
  return { de, text: (en: string, german: string) => (de ? german : en) };
}

type InputKind = 'keyboard' | 'touch' | 'gamepad';
const inputSnapshot = (): InputKind =>
  navigator.getGamepads?.().some(Boolean)
    ? 'gamepad'
    : matchMedia('(pointer: coarse)').matches
      ? 'touch'
      : 'keyboard';
const subscribeInput = (notify: () => void) => {
  const query = matchMedia('(pointer: coarse)');
  query.addEventListener('change', notify);
  window.addEventListener('gamepadconnected', notify);
  window.addEventListener('gamepaddisconnected', notify);
  return () => {
    query.removeEventListener('change', notify);
    window.removeEventListener('gamepadconnected', notify);
    window.removeEventListener('gamepaddisconnected', notify);
  };
};

export function PartyAvatar({
  player,
}: {
  player: Pick<PartyPlayer, 'color' | 'isBot'>;
}) {
  return (
    <span
      className="party-avatar"
      style={
        { '--avatar-color': COLORS[player.color] ?? COLORS[0] } as CSSProperties
      }
      aria-hidden="true"
    >
      <img
        src={`/images/clubhouse/${['wave', 'point', 'cheer', 'mail'][player.color] ?? 'wave'}.webp`}
        alt=""
        width={56}
        height={84}
      />
      {player.isBot && <span>✦</span>}
    </span>
  );
}

export function scoringLabel(scoring: string | undefined, de: boolean) {
  return scoring === 'team'
    ? de
      ? 'Teams · Sieg +10 / Unentschieden +6 / Niederlage +3'
      : 'Teams · Win +10 / Draw +6 / Loss +3'
    : scoring === 'individual'
      ? de
        ? 'Einzelwertung · Erfolgreiche Abschlüsse: 10 / 6 / 3 / 1'
        : 'Individual · Successful finishes: 10 / 6 / 3 / 1'
      : de
        ? 'Gemeinsam · Ziel geschafft +6 pro Person, sonst 0'
        : 'Co-op · Goal completed +6 each, otherwise 0';
}

export function GameBriefing({
  room,
  playerId,
}: {
  room: PartyRoomState;
  playerId: string;
}) {
  const { de, text } = usePartyText();
  const [inputChoice, setInput] = useState<InputKind | null>(null);
  const detected = useSyncExternalStore(
    subscribeInput,
    inputSnapshot,
    (): InputKind => 'keyboard',
  );
  const input = inputChoice ?? detected;
  const id = room.playlist[room.currentRound],
    info = getPartyGameInfo(id),
    guide = getPartyGuide(id);
  const teams = roundAssignments(room);
  return (
    <div className="party-briefing-content">
      <img
        className="party-briefing-image"
        src={info?.image}
        alt=""
        width={960}
        height={540}
      />
      <p className="party-objective">{guide?.objective[de ? 1 : 0]}</p>
      <p className="party-meta">
        ~{info?.minutes} {text('min', 'Min.')} ·{' '}
        {text(
          info?.complexity === 'easy'
            ? 'Easy to learn'
            : info?.complexity === 'tricky'
              ? 'Crew coordination'
              : 'A little practice',
          info?.complexity === 'easy'
            ? 'Leicht zu lernen'
            : info?.complexity === 'tricky'
              ? 'Crew-Abstimmung'
              : 'Etwas Übung',
        )}
      </p>
      <p className="party-scoring">
        {scoringLabel(info?.scoring, de)}
        <br />
        <small>
          {text(
            'Giving up always earns 0 points. Helpers do not compete.',
            'Aufgeben gibt immer 0 Punkte. Helfer stehen nicht in der Wertung.',
          )}
        </small>
      </p>
      {info?.teams && (
        <div className="party-teams">
          {teams.map((ids, i) => (
            <p key={i}>
              <strong>
                {i === 0
                  ? text('Red crew', 'Rotes Team')
                  : text('Blue crew', 'Blaues Team')}
              </strong>
              <span>
                {ids
                  .map((pid) => room.players.find((p) => p.id === pid)?.name)
                  .join(' + ')}
                {ids.length < 2 ? text(' + game helper', ' + Spielhelfer') : ''}
                {ids.includes(playerId) ? text(' · You', ' · Du') : ''}
              </span>
            </p>
          ))}
        </div>
      )}
      <p className="party-meta">
        <strong>
          {text('Your role', 'Deine Rolle')}: {partyRole(room, playerId, de)}
        </strong>
        <br />
        {text(
          'Roles rotate between rounds. Watch the game’s prompts if you swap jobs.',
          'Rollen wechseln zwischen Runden. Beachte beim Aufgabentausch die Hinweise im Spiel.',
        )}
      </p>
      <fieldset className="party-input-choice">
        <legend>{text('Your controls', 'Deine Steuerung')}</legend>
        {(['keyboard', 'touch', 'gamepad'] as const).map((value, i) => (
          <button
            type="button"
            key={value}
            aria-pressed={input === value}
            onClick={() => setInput(value)}
          >
            {de
              ? ['Tastatur', 'Touch', 'Controller'][i]
              : ['Keyboard', 'Touch', 'Gamepad'][i]}
          </button>
        ))}
      </fieldset>
      <p className="party-controls-copy">
        {input === 'keyboard'
          ? guide?.keyboard[de ? 1 : 0]
          : input === 'touch'
            ? text(
                'Use the on-screen movement controls and labeled action buttons. You can move and act together. Turn your phone sideways for more room.',
                'Nutze die Bewegungssteuerung und beschrifteten Aktionsknöpfe auf dem Bildschirm. Bewegen und Handeln geht gleichzeitig. Querformat bietet mehr Platz.',
              )
            : text(
                'Press Start to switch between play and the controller menu. The left stick maps to WASD. Default actions: A / Cross = Space, X / Square = E, B / Circle = Q, Y / Triangle = F, LB / L1 = Shift. Open the controller menu to check or change this game’s bindings.',
                'Start wechselt zwischen Spiel und Controller-Menü. Der linke Stick entspricht WASD. Standardaktionen: A / Kreuz = Leertaste, X / Quadrat = E, B / Kreis = Q, Y / Dreieck = F, LB / L1 = Shift. Im Controller-Menü kannst du die Belegung für dieses Spiel prüfen und ändern.',
              )}
      </p>
    </div>
  );
}

export function PartyStandings({
  room,
  playerId,
  compact = false,
}: {
  room: PartyRoomState;
  playerId: string;
  compact?: boolean;
}) {
  const { text } = usePartyText();
  const players = room.players
    .filter((p) => !p.isBot)
    .sort((a, b) => b.score - a.score);
  return (
    <ol
      className={`party-standings-list${compact ? ' party-standings-compact' : ''}`}
      aria-label={text('Overall standings', 'Gesamtwertung')}
    >
      {players.map((p) => (
        <li key={p.id}>
          <span>
            {players.filter((other) => other.score > p.score).length + 1}
          </span>
          {!compact && <PartyAvatar player={p} />}
          <span className="party-player-name">
            {p.name}
            {p.id === playerId ? text(' (You)', ' (Du)') : ''}
          </span>
          <strong>
            {p.score} {text('pts', 'Pkt.')}
          </strong>
        </li>
      ))}
    </ol>
  );
}

export function resultDescription(
  result: RoundResult,
  id: string,
  de: boolean,
) {
  const report = result.reports?.[id];
  if (!report) return de ? 'Aufgegeben · 0 Punkte' : 'Forfeit · 0 points';
  if (report.kind === 'versus') {
    const outcome = de
      ? { won: 'Gewonnen', draw: 'Unentschieden', lost: 'Verloren' }[
          report.outcome
        ]
      : { won: 'Won', draw: 'Draw', lost: 'Lost' }[report.outcome];
    if (!report.scores) return outcome;
    const metric =
      report.metric === 'height'
        ? 'm'
        : report.metric === 'towers'
          ? de
            ? 'Türme'
            : 'towers'
          : report.metric === 'knockdowns'
            ? de
              ? 'Niederschläge'
              : 'knockdowns'
            : de
              ? 'Punkte'
              : 'points';
    const value = (n: number) => Math.round(n * 10) / 10;
    return `${outcome} · ${de ? 'Rot' : 'Red'} ${value(report.scores.red)} – ${value(report.scores.blue)} ${de ? 'Blau' : 'Blue'} ${metric}`;
  }
  return `${report.cleared ? (de ? 'Ziel geschafft' : 'Goal completed') : de ? 'Ziel verfehlt' : 'Goal missed'} · ${de ? 'Ergebnis' : 'Score'} ${Math.round(report.score * 100) / 100}`;
}

export function RoundDetails({
  room,
  result,
  playerId,
}: {
  room: PartyRoomState;
  result: RoundResult;
  playerId: string;
}) {
  const { de, text } = usePartyText();
  const humans = room.players.filter((p) => !p.isBot);
  const before = (id: string) =>
    room.roundResults
      .filter((r) => r.round < result.round)
      .reduce((n, r) => n + (r.pointsAwarded[id] ?? 0), 0);
  const after = (id: string) => before(id) + (result.pointsAwarded[id] ?? 0);
  const rank = (id: string, score: (id: string) => number) =>
    humans.filter((p) => score(p.id) > score(id)).length + 1;
  return (
    <div className="party-result-details">
      <p>{scoringLabel(result.scoring, de)}</p>
      {humans.map((p) => {
        const movement = rank(p.id, before) - rank(p.id, after);
        return (
          <div className="party-result-row" key={p.id}>
            <PartyAvatar player={p} />
            <span>
              <strong>
                {p.name}
                {p.id === playerId ? text(' (You)', ' (Du)') : ''}
              </strong>
              <small>
                {resultDescription(result, p.id, de)}
                {result.teams
                  ? ` · ${result.teams[0].includes(p.id) ? text('Red', 'Rot') : text('Blue', 'Blau')}`
                  : ''}
              </small>
            </span>
            <span>
              <strong>+{result.pointsAwarded[p.id] ?? 0}</strong>
              <small>
                {after(p.id)} {text('total', 'gesamt')} ·{' '}
                {movement > 0
                  ? `↑${movement}`
                  : movement < 0
                    ? `↓${-movement}`
                    : '—'}
              </small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function partyError(error: unknown, de: boolean) {
  const message = error instanceof Error ? error.message : String(error);
  if (!de) return message;
  if (/ready|connected/i.test(message))
    return 'Alle Spieler müssen verbunden und bereit sein.';
  if (/full|four players/i.test(message))
    return 'Diese Party ist voll. Bitte nutze eine andere Einladung.';
  if (/not found|not.*available|already started/i.test(message))
    return 'Diese Party ist nicht verfügbar oder bereits gestartet. Prüfe den Code.';
  if (/host/i.test(message))
    return 'Diese Aktion ist nur für den aktuellen Gastgeber verfügbar.';
  if (/seat|Rejoin|recognise|pass|expired/i.test(message))
    return 'Dein Platz ist nicht mehr verfügbar. Tritt der Party erneut bei.';
  if (/vote|Voting|Choose/i.test(message))
    return 'Die Abstimmung hat sich geändert. Bitte wähle erneut.';
  return 'Die Verbindung wurde unterbrochen. Versuche es erneut; dein gespeicherter Spielstand bleibt erhalten.';
}
