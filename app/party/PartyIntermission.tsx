'use client';
/* oxlint-disable react/react-compiler */
/* oxlint-disable next/no-img-element -- Gameplay WebPs are pre-optimized at 960x540 with explicit dimensions. */
import { useEffect, useState } from 'react';
import { Gamepad2, LogOut } from 'lucide-react';
import type { GameId } from '@/shared/audio/types';
import type { PartyPass, PartyRoomState } from '@/platform/party/types';
import { getPartyGameInfo } from '@/platform/party/playlist';
import {
  highlightedCandidate,
  voteCounts,
} from '@/platform/party/intermission';
import { voteForPartyGame } from '@/platform/party/client';
import PartyPodium from './PartyPodium';
import './party-intermission.css';

export default function PartyIntermission({
  room,
  pass,
  onRoom,
  onLeave,
  connectionError,
}: {
  room: PartyRoomState;
  pass: PartyPass | null;
  onRoom: (room: PartyRoomState) => void;
  onLeave: () => void;
  connectionError: string;
}) {
  const [now, setNow] = useState(room.serverNow ?? Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const start = performance.now();
    const server = room.serverNow ?? Date.now();
    setNow(server);
    const timer = setInterval(
      () => setNow(server + performance.now() - start),
      50,
    );
    return () => clearInterval(timer);
  }, [room.serverNow]);

  const ballot = room.intermission;
  const result = room.roundResults[room.roundResults.length - 1];
  const voting = ballot?.phase === 'voting';
  const podium = !ballot || ballot.phase === 'podium';
  const title = podium
    ? 'Take your places!'
    : voting
      ? 'What are we playing next?'
      : ballot.phase === 'tie-break'
        ? 'A tie! Let luck decide…'
        : 'Next up!';
  const highlight = ballot && highlightedCandidate(ballot, now);
  const counts = ballot ? voteCounts(ballot) : [];
  const seconds = ballot
    ? Math.max(0, Math.ceil((ballot.endsAt - now) / 1000))
    : 0;
  const vote = async (game: GameId) => {
    if (!pass || busy) return;
    setBusy(true);
    setError('');
    try {
      onRoom(await voteForPartyGame(room.code, room.currentRound, pass, game));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Vote could not be saved. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="party-root party-flow-root">
      {ballot?.phase === 'podium' &&
        ballot.candidates.map((id) => (
          <link
            key={id}
            rel="preload"
            as="image"
            href={`/images/party-gameplay/${id}.webp`}
          />
        ))}
      <header className="party-header">
        <span className="party-brand">
          <span className="party-brand-icon">
            <Gamepad2 size={22} />
          </span>
          JUMBLEYARD
        </span>
        <span className="party-badge">
          Round {room.currentRound + 1} of 6 complete
        </span>
      </header>
      <main className="party-main party-intermission-main">
        <div className="party-title-wrap">
          <p className="party-intermission-kicker">
            {podium
              ? getPartyGameInfo(result?.game)?.name
              : `The party decides · Round ${room.currentRound + 2}`}
          </p>
          <h1 className="party-title" aria-live="polite">
            {title}
          </h1>
          <p className="party-subtitle" aria-live="polite">
            {podium
              ? room.currentRound === 5
                ? 'One last celebration before the final standings.'
                : 'Celebrate this round. Then pick your next game.'
              : voting
                ? 'One player, one vote. You can change your mind until time is up.'
                : ballot.phase === 'tie-break'
                  ? 'Only the tied games are in the running.'
                  : `${getPartyGameInfo(ballot.winner!)?.name} wins the vote. Get ready!`}
          </p>
        </div>
        <div className="party-card party-intermission-card">
          {podium ? (
            <PartyPodium
              players={room.players}
              result={result}
              playerId={pass?.id ?? null}
            />
          ) : (
            <>
              <div className="party-vote-heading">
                <strong>
                  {voting
                    ? 'Choose your next game'
                    : ballot.phase === 'tie-break'
                      ? 'Picking a winner…'
                      : 'The choice is made'}
                </strong>
                <span
                  className="party-vote-clock"
                  aria-label={`${seconds} seconds remaining`}
                >
                  {seconds}s
                </span>
              </div>
              <div className="party-vote-cards" data-phase={ballot.phase}>
                {ballot.candidates.map((id, index) => {
                  const info = getPartyGameInfo(id);
                  const selected = !!pass && ballot.votes[pass.id] === id;
                  const tied = ballot.tied.includes(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      className={`party-vote-card${selected ? ' is-selected' : ''}${highlight === id ? ' is-highlighted' : ''}${tied ? ' is-tied' : ''}`}
                      disabled={
                        !voting ||
                        now >= ballot.endsAt ||
                        busy ||
                        !pass ||
                        !room.players.some((p) => p.id === pass.id)
                      }
                      aria-pressed={selected}
                      onClick={() => void vote(id)}
                    >
                      <span className="party-vote-ticket">
                        {info?.teams ? 'Team challenge' : 'Beat the game'}
                      </span>
                      <img
                        className="party-vote-gameplay"
                        src={`/images/party-gameplay/${id}.webp`}
                        alt={`${info?.name ?? id} gameplay`}
                        width={960}
                        height={540}
                        decoding="async"
                      />
                      <strong className="party-vote-name">
                        {info?.name ?? id}
                      </strong>
                      <span className="party-vote-description">
                        {info?.tagline}
                      </span>
                      <span className="party-vote-count">
                        {counts[index]} {counts[index] === 1 ? 'vote' : 'votes'}
                      </span>
                      <span className="party-vote-selection">
                        {ballot.phase === 'reveal' && ballot.winner === id
                          ? '✓ Winner!'
                          : selected
                            ? '✓ Your vote'
                            : voting
                              ? 'Vote for this game'
                              : tied
                                ? 'Tied for the lead'
                                : ' '}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {(error || connectionError) && (
            <p className="party-flow-error" role="alert">
              {error || connectionError}
            </p>
          )}
          <footer className="party-flow-footer">
            <button
              type="button"
              className="party-btn party-btn-ghost"
              onClick={onLeave}
            >
              <LogOut size={16} /> Leave party
            </button>
            <span>
              {podium
                ? room.currentRound === 5
                  ? 'Final standings coming up…'
                  : 'Voting opens shortly…'
                : voting
                  ? 'Most votes wins'
                  : 'Next round starts automatically'}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
