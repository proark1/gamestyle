import { stepLabel } from '../../shared/analytics/protocol';
import { catalogGame } from '../analytics/catalog';
import type { OverviewReport } from '../analytics/types';
import {
  DayColumns,
  InlineBar,
  MiniStack,
  StackBar,
  StatTile,
  crewParts,
} from './charts';
import { count, duration, hours, percent } from './format';
import { useReport, type Scope } from './request';
import styles from './admin.module.css';

export default function OverviewPanel({
  scope,
  onGame,
}: {
  scope: Scope;
  onGame: (id: string) => void;
}) {
  const { data, error, loading } = useReport<OverviewReport>(scope, {
    view: 'overview',
    from: scope.from,
    tz: scope.tz,
  });
  if (!data)
    return error ? (
      <p role="alert" className={styles.error}>
        {error}
      </p>
    ) : (
      <p className={styles.empty}>Loading the overview…</p>
    );
  const { totals } = data;
  const games = [...data.games].sort(
    (a, b) => b.sessions - a.sessions || b.played - a.played,
  );
  const busiest = Math.max(1, games[0]?.sessions ?? 0);
  return (
    <div className={styles.panel} data-loading={loading || undefined}>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {data.truncated && (
        <p className={styles.notice}>
          This period has more than 100,000 sessions; the newest 100,000 are
          counted.
        </p>
      )}
      <section className={styles.tiles} aria-label="Totals">
        <StatTile
          label="Sessions"
          value={count(totals.sessions)}
          detail={
            totals.live ? (
              <span className={styles.live}>
                <span className={styles.liveDot} />
                {totals.live} on a game page now
              </span>
            ) : (
              'Nobody on a game page now'
            )
          }
        />
        <StatTile
          label="Started a round"
          value={percent(totals.played, totals.sessions)}
          detail={`${count(totals.played)} sessions`}
        />
        <StatTile
          label="Finished a round"
          value={percent(totals.finished, totals.played)}
          detail="of sessions that started one"
        />
        <StatTile
          label="Median visit"
          value={totals.sessions ? duration(totals.medianElapsed) : '—'}
          detail={`${duration(totals.medianPlaying)} median inside rounds`}
        />
        <StatTile
          label="Time in rounds"
          value={hours(totals.time.playing)}
          detail={`${hours(totals.elapsed)} on game pages in total`}
        />
      </section>
      <div className={styles.columns2}>
        <section className={styles.card}>
          <h2>Sessions per day</h2>
          <p className={styles.cardNote}>
            Every visit to a game page, and how many started a round.
          </p>
          <DayColumns days={data.days} />
        </section>
        <section className={styles.card}>
          <h2>Who they play with</h2>
          <p className={styles.cardNote}>
            Sessions that started at least one round, across all games.
          </p>
          <div className={styles.tiles3}>
            <StatTile
              label="Played alone"
              value={percent(totals.crew.alone, totals.played)}
            />
            <StatTile
              label="Had NPCs"
              value={percent(
                totals.crew.npcs + totals.crew.mixed,
                totals.played,
              )}
            />
            <StatTile
              label="Had real players"
              value={percent(
                totals.crew.friends + totals.crew.mixed,
                totals.played,
              )}
            />
          </div>
          <StackBar label="Crew mix" parts={crewParts(totals.crew)} />
        </section>
      </div>
      <section className={styles.card}>
        <h2>All games</h2>
        <p className={styles.cardNote}>
          Select a game for its steps, exits, results and player actions.
        </p>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Game</th>
                <th>Sessions</th>
                <th>Started a round</th>
                <th>Won a round</th>
                <th>Median visit</th>
                <th>Crew mix</th>
                <th>Most often left at</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {games.map((row) => {
                const game = catalogGame(row.game)!;
                return (
                  <tr key={row.game}>
                    <th scope="row">
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => onGame(row.game)}
                      >
                        {game.name}
                      </button>
                    </th>
                    <td>
                      <InlineBar value={row.sessions} max={busiest}>
                        {count(row.sessions)}
                      </InlineBar>
                    </td>
                    <td>{percent(row.played, row.sessions)}</td>
                    <td>{percent(row.won, row.played)}</td>
                    <td>{row.sessions ? duration(row.medianElapsed) : '—'}</td>
                    <td>
                      {row.played ? (
                        <MiniStack
                          label={`${game.name} crew mix`}
                          parts={crewParts(row.crew)}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {row.topExit
                        ? `${stepLabel(game.analytics, row.topExit.step)} · ${percent(row.topExit.sessions, row.sessions)}`
                        : '—'}
                    </td>
                    <td>
                      {row.live > 0 && (
                        <span className={styles.live}>
                          <span className={styles.liveDot} />
                          {row.live}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className={styles.legend}>
          {crewParts(totals.crew).map((part) => (
            <li key={part.key}>
              <i style={{ background: part.color }} />
              {part.label}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
