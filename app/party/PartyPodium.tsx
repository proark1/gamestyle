import type { CSSProperties } from 'react';
import type { PartyPlayer, RoundResult } from '@/platform/party/types';
import { COLORS } from '@/shared/rendering/palette';

export default function PartyPodium({
  players,
  result,
  playerId,
}: {
  players: PartyPlayer[];
  result?: RoundResult;
  playerId: string | null;
}) {
  const points = (player: PartyPlayer) =>
    result ? (result.pointsAwarded[player.id] ?? 0) : player.score;
  const sorted = [...players].sort((a, b) => points(b) - points(a));
  const winners = sorted.filter(
    (player) => points(player) === points(sorted[0]),
  );
  const order = [1, 0, 2, 3].filter((index) => sorted[index]);
  return (
    <section
      className="party-celebration"
      aria-label={result ? 'Round podium' : 'Tournament podium'}
    >
      <p className="party-winner-line">
        <span aria-hidden="true">👑 </span>
        {winners.map((player) => player.name).join(' & ')}
        {winners.length > 1 ? ' share first place!' : ' takes first place!'}
      </p>
      <div className="party-round-podium">
        {order.map((index) => {
          const player = sorted[index];
          const rank =
            sorted.filter((other) => points(other) > points(player)).length + 1;
          const shared =
            sorted.filter((other) => points(other) === points(player)).length >
            1;
          return (
            <div
              className="party-podium-seat"
              data-rank={rank}
              key={player.id}
              style={
                {
                  '--seat-color': COLORS[player.color],
                  '--pedestal-height': `${190 - (rank - 1) * 28}px`,
                } as CSSProperties
              }
            >
              <div className="party-podium-contestant" aria-hidden="true">
                {rank === 1 && <span className="party-podium-crown">👑</span>}
                <span className="party-podium-face">•‿•</span>
              </div>
              <strong className="party-podium-name">
                {player.name}
                {player.id === playerId ? ' (You)' : ''}
              </strong>
              <div className="party-podium-block">
                <span className="party-podium-place">
                  {shared ? 'Joint ' : ''}
                  {['', '1st', '2nd', '3rd', '4th'][rank]}
                </span>
                <strong>
                  {result ? '+' : ''}
                  {points(player)} pts
                </strong>
                {result && <small>{player.score} total</small>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
