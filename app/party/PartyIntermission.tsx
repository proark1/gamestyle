'use client';
/* oxlint-disable next/no-img-element -- Existing optimized gameplay WebPs. */
import { useEffect, useState } from 'react';
import type { GameId } from '@/shared/audio/types';
import type { PartyPass, PartyRoomState } from '@/platform/party/types';
import { getPartyGameInfo } from '@/platform/party/playlist';
import { getPartyGuide } from '@/platform/party/guides';
import { voteCounts } from '@/platform/party/intermission';
import { stateOf, voteForPartyGame } from '@/platform/party/client';
import PartyPodium from './PartyPodium';
import {
  PartyStandings,
  RoundDetails,
  partyError,
  usePartyText,
} from './PartyDetails';
import { partyCue } from './party-audio';
import { partyTracker } from './party-tracker';

export default function PartyIntermission({
  room,
  pass,
  onRoom,
}: {
  room: PartyRoomState;
  pass: PartyPass;
  onRoom: (room: PartyRoomState) => void;
}) {
  const { de, text } = usePartyText();
  const [now, setNow] = useState(room.serverNow ?? room.updated);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const start = performance.now(),
      server = room.serverNow ?? Date.now();
    const update = () =>
      setNow(room.pausedAt ?? server + performance.now() - start);
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [room.serverNow, room.pausedAt]);
  const ballot = room.intermission;
  const result = room.roundResults.at(-1);
  const voting = ballot?.phase === 'voting';
  const podium = !ballot || ballot.phase === 'podium';
  const counts = ballot ? voteCounts(ballot) : [];
  const seconds = ballot
    ? Math.max(0, Math.ceil((ballot.endsAt - now) / 1000))
    : 0;
  async function vote(game: GameId) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onRoom(await voteForPartyGame(room.code, room.currentRound, pass, game));
      partyCue('vote');
      partyTracker.action('vote');
      partyTracker.milestone('voted');
    } catch (err) {
      setError(partyError(err, de));
    } finally {
      setBusy(false);
    }
  }
  async function lock() {
    setBusy(true);
    setError('');
    try {
      onRoom(
        await stateOf({
          op: 'vote_lock',
          code: room.code,
          playerId: pass.id,
          token: pass.token,
          round: room.currentRound,
        }),
      );
    } catch (err) {
      setError(partyError(err, de));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="party-intermission-main">
      <div className="party-section-heading">
        <div>
          <p className="party-kicker">
            {text(
              `Round ${room.currentRound + 1} of ${room.playlist.length} complete`,
              `Runde ${room.currentRound + 1} von ${room.playlist.length} beendet`,
            )}
          </p>
          <h1 className="party-title" tabIndex={-1}>
            {podium
              ? getPartyGameInfo(result?.game as GameId)?.name
              : text('What’s next?', 'Was spielen wir als Nächstes?')}
          </h1>
        </div>
        {voting && (
          <strong
            className="party-vote-clock"
            aria-label={text(
              `${seconds} seconds left`,
              `${seconds} Sekunden verbleibend`,
            )}
          >
            {room.pausedAt !== undefined ? 'Ⅱ' : `${seconds}s`}
          </strong>
        )}
      </div>
      {podium && result ? (
        <>
          <PartyPodium
            players={room.players}
            result={result}
            playerId={pass.id}
            practice={room.practice}
          />
          <RoundDetails room={room} result={result} playerId={pass.id} />
          <output className="party-muted">
            {room.currentRound === room.playlist.length - 1
              ? text(
                  'Final standings coming up…',
                  'Gleich folgt die Gesamtwertung…',
                )
              : text(
                  'Voting opens shortly. Take a break to keep these results on screen.',
                  'Gleich beginnt die Abstimmung. Mit Pause bleiben die Ergebnisse sichtbar.',
                )}
          </output>
        </>
      ) : (
        ballot && (
          <>
            <p className="party-subtitle">
              {text(
                'One human, one vote. Change your mind until the timer ends.',
                'Eine Stimme pro Person. Du kannst bis zum Ablauf der Zeit umwählen.',
              )}
            </p>
            <PartyStandings room={room} playerId={pass.id} compact />
            <div className="party-vote-cards">
              {ballot.candidates.map((id, index) => {
                const info = getPartyGameInfo(id),
                  guide = getPartyGuide(id),
                  selected = ballot.votes[pass.id] === id;
                return (
                  <button
                    type="button"
                    key={id}
                    className="party-vote-card"
                    aria-label={info?.name ?? id}
                    aria-pressed={selected}
                    disabled={
                      !voting ||
                      busy ||
                      now >= ballot.endsAt ||
                      room.pausedAt !== undefined
                    }
                    onClick={() => void vote(id)}
                  >
                    <span className="party-vote-image">
                      <img src={info?.image} alt="" width={960} height={540} />
                    </span>
                    <span className="party-vote-copy">
                      <strong>{info?.name}</strong>
                      <span className="party-vote-meta">
                        {info?.scoring === 'cooperative'
                          ? text('Co-op', 'Gemeinsam')
                          : info?.scoring === 'team'
                            ? text('Teams', 'Teams')
                            : text('Individual', 'Einzel')}{' '}
                        · ~{info?.minutes} {text('min', 'Min.')} ·{' '}
                        {info?.complexity === 'easy'
                          ? text('Easy', 'Einfach')
                          : info?.complexity === 'tricky'
                            ? text('Tricky', 'Knifflig')
                            : text('Medium', 'Mittel')}
                      </span>
                      <span className="party-vote-description">
                        {guide?.objective[de ? 1 : 0]}
                      </span>
                      <span className="party-vote-selection">
                        {selected
                          ? text('✓ Your vote', '✓ Deine Wahl')
                          : text('Choose game', 'Spiel wählen')}{' '}
                        <b>
                          {counts[index]}{' '}
                          {text(
                            counts[index] === 1 ? 'vote' : 'votes',
                            counts[index] === 1 ? 'Stimme' : 'Stimmen',
                          )}
                        </b>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="party-vote-lock">
              <button
                className="party-btn party-btn-secondary"
                disabled={
                  busy ||
                  !voting ||
                  !ballot.votes[pass.id] ||
                  ballot.locked?.includes(pass.id) ||
                  now < ballot.startedAt + 5000 ||
                  room.pausedAt !== undefined
                }
                onClick={() => void lock()}
              >
                {ballot.locked?.includes(pass.id)
                  ? text('Vote locked ✓', 'Wahl bestätigt ✓')
                  : text('Lock my vote', 'Wahl bestätigen')}
              </button>
              <small>
                {text(
                  'Continue early when everyone locks in. Choosing again unlocks your vote.',
                  'Wenn alle bestätigen, geht es früher weiter. Umwählen hebt die Bestätigung auf.',
                )}
              </small>
            </div>
            <details className="party-recap">
              <summary>
                {text(
                  'Last round: result & points',
                  'Letzte Runde: Ergebnis & Punkte',
                )}
              </summary>
              {result && (
                <RoundDetails room={room} result={result} playerId={pass.id} />
              )}
            </details>
          </>
        )
      )}
      {error && (
        <p className="party-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
