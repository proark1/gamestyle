'use client';
import type { PartyPlayer, RoundResult } from '@/platform/party/types';
import { PartyAvatar, usePartyText } from './PartyDetails';

export default function PartyPodium({
  players,
  result,
  playerId,
  practice = false,
}: {
  players: PartyPlayer[];
  result?: RoundResult;
  playerId: string | null;
  practice?: boolean;
}) {
  const { text } = usePartyText();
  const points = (p: PartyPlayer) =>
    result ? (result.pointsAwarded[p.id] ?? 0) : p.score;
  const sorted = players
    .filter((p) => !p.isBot)
    .sort((a, b) => points(b) - points(a));
  const top = sorted[0] ? points(sorted[0]) : 0;
  const winners = sorted.filter((p) => top > 0 && points(p) === top);
  const shared = result?.scoring === 'cooperative';
  const title = practice
    ? text('Practice complete', 'Übung abgeschlossen')
    : result?.outcome === 'skipped'
      ? text('Round skipped · no points', 'Runde übersprungen · keine Punkte')
      : top === 0
        ? text('No points this time', 'Diesmal keine Punkte')
        : shared
          ? text('A bonus for the crew!', 'Ein Bonus für die Crew!')
          : `${winners.map((p) => p.name).join(' & ')} ${text(winners.length > 1 ? 'share first!' : 'takes first!', winners.length > 1 ? 'teilen Platz 1!' : 'holt Platz 1!')}`;
  return (
    <section
      className="party-celebration"
      aria-label={text('Results', 'Ergebnisse')}
    >
      <h2 className="party-winner-line">
        {top > 0 && !shared && !practice ? '♛ ' : ''}
        {title}
      </h2>
      <div className="party-podium-crew">
        {sorted.map((p) => (
          <div
            className="party-podium-seat"
            key={p.id}
            data-leading={top > 0 && points(p) === top}
          >
            <PartyAvatar player={p} />
            <strong>
              {p.name}
              {p.id === playerId ? text(' (You)', ' (Du)') : ''}
            </strong>
            <span>
              {result ? '+' : ''}
              {points(p)} {text('pts', 'Pkt.')}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
