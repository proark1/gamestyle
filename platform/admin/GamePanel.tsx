/* eslint-disable next/no-html-link-for-pages -- Games open with a full page load. */
import {
  ArrowUpRight,
  AudioLines,
  CircleCheck,
  CircleMinus,
  CircleX,
  Info,
  ListTree,
  TriangleAlert,
} from 'lucide-react';
import { stepLabel } from '../../shared/analytics/protocol';
import { GAMES, catalogGame } from '../analytics/catalog';
import type { GameReport } from '../analytics/types';
import {
  BarList,
  DayColumns,
  InlineBar,
  SERIES,
  StackBar,
  StatTile,
  crewParts,
  type BarRow,
} from './charts';
import {
  ENTRY_LABELS,
  MODE_LABELS,
  actionLabel,
  count,
  duration,
  hours,
  insights,
  percent,
  resultLabel,
} from './format';
import type { SessionFilter } from './SessionsPanel';
import { useReport, type Scope } from './request';
import styles from './admin.module.css';

type Props = {
  scope: Scope;
  onSessions: (filter: SessionFilter) => void;
  onSound: (game: string) => void;
};

export default function GamePanel({
  game,
  onGame,
  ...props
}: Props & { game: string; onGame: (id: string) => void }) {
  if (!catalogGame(game))
    return (
      <section className={styles.card}>
        <h2>Pick a game</h2>
        <p className={styles.cardNote}>
          Or choose one in the game filter above.
        </p>
        <div className={styles.pickGrid}>
          {GAMES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={styles.pickCard}
              onClick={() => onGame(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>
      </section>
    );
  return <GameReportView key={game} game={game} {...props} />;
}

const OUTCOME_ORDER: Record<string, number> = { won: 0, lost: 1, ended: 2 };
const TONE_ICONS = { warning: TriangleAlert, info: Info, good: CircleCheck };

function GameReportView({
  scope,
  game,
  onSessions,
  onSound,
}: Props & { game: string }) {
  const entry = catalogGame(game)!;
  const definition = entry.analytics;
  const { data, error, loading } = useReport<GameReport>(scope, {
    view: 'game',
    game,
    from: scope.from,
    tz: scope.tz,
  });
  const header = (
    <header className={styles.gameHeader}>
      <h2>{entry.name}</h2>
      <div className={styles.gameLinks}>
        <a
          className={styles.quiet}
          href={entry.href}
          target="_blank"
          rel="noreferrer"
        >
          Open the game <ArrowUpRight size={14} />
        </a>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => onSessions({ game })}
        >
          <ListTree size={14} /> Its sessions
        </button>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => onSound(entry.workshop.game)}
        >
          <AudioLines size={14} /> Sound workshop
        </button>
      </div>
    </header>
  );
  if (!data)
    return (
      <div className={styles.panel}>
        {header}
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : (
          <p className={styles.empty}>Loading {entry.name}…</p>
        )}
      </div>
    );

  const { totals } = data;
  const reached = (step: string) =>
    data.funnel.find((row) => row.step === step)?.sessions ?? 0;
  const opened = reached('opened');
  const started = reached('playing');
  const decided = totals.wins + totals.losses;
  const inRound = new Set([
    ...definition.milestones.map((milestone) => milestone.key),
    'finished',
    'won',
  ]);
  const funnelRows: BarRow[] = data.funnel.map((row) => ({
    key: row.step,
    label: stepLabel(definition, row.step),
    value: row.sessions,
    note:
      row.step === 'lobby'
        ? 'rooms only'
        : inRound.has(row.step) && started
          ? `${percent(row.sessions, started)} of round starts`
          : undefined,
  }));
  const exitTotal = data.exits.reduce((sum, row) => sum + row.sessions, 0);
  const resultTotal = data.results.reduce((sum, row) => sum + row.rounds, 0);
  const resultRows: BarRow[] = [...data.results]
    .sort(
      (a, b) =>
        OUTCOME_ORDER[a.key.split(':')[0]] -
          OUTCOME_ORDER[b.key.split(':')[0]] || b.rounds - a.rounds,
    )
    .map((row) => {
      const outcome = row.key.split(':')[0];
      const Icon =
        outcome === 'won'
          ? CircleCheck
          : outcome === 'lost'
            ? CircleX
            : CircleMinus;
      return {
        key: row.key,
        label: (
          <span className={styles.outcome} data-outcome={outcome}>
            <Icon size={14} aria-hidden="true" />
            {resultLabel(definition, row.key)}
          </span>
        ),
        value: row.rounds,
        tone:
          outcome === 'won'
            ? 'good'
            : outcome === 'lost'
              ? 'critical'
              : 'quiet',
      };
    });
  const used = new Set(data.actions.map((row) => row.action));
  const actionRows = [
    ...data.actions,
    ...Object.keys(definition.actions ?? {})
      .filter((action) => !used.has(action))
      .map((action) => ({ action, total: 0, sessions: 0 })),
  ];
  const pointer = totals.sessions - totals.touch;

  return (
    <div className={styles.panel} data-loading={loading || undefined}>
      {header}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <section className={styles.tiles} aria-label={`${entry.name} totals`}>
        <StatTile
          label="Sessions"
          value={count(totals.sessions)}
          detail={
            totals.live ? (
              <span className={styles.live}>
                <span className={styles.liveDot} />
                {totals.live} here now
              </span>
            ) : (
              'Nobody here now'
            )
          }
        />
        <StatTile
          label={stepLabel(definition, 'playing')}
          value={percent(totals.played, totals.sessions)}
          detail={`${count(totals.played)} of ${count(totals.sessions)} sessions`}
        />
        <StatTile
          label="Rounds"
          value={count(totals.rounds)}
          detail={
            totals.played
              ? `${(totals.rounds / totals.played).toFixed(1)} per session that played`
              : 'None yet'
          }
        />
        <StatTile
          label="Win rate"
          value={decided ? percent(totals.wins, decided) : '—'}
          detail={`${count(totals.wins)} won · ${count(totals.losses)} lost`}
        />
        <StatTile
          label="Median visit"
          value={totals.sessions ? duration(totals.medianElapsed) : '—'}
          detail={`${duration(totals.medianPlaying)} median inside rounds`}
        />
      </section>

      <section className={styles.card}>
        <h3>What to look at</h3>
        <ul className={styles.insights}>
          {insights(data, definition).map((insight) => {
            const Icon = TONE_ICONS[insight.tone];
            return (
              <li key={insight.text} data-tone={insight.tone}>
                <Icon size={16} aria-hidden="true" />
                <span>{insight.text}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className={styles.columns2}>
        <section className={styles.card}>
          <h3>How far people get</h3>
          <p className={styles.cardNote}>
            Sessions that reached each step at least once, as a share of every
            visit.
          </p>
          <BarList caption="Steps reached" rows={funnelRows} total={opened} />
        </section>
        <section className={styles.card}>
          <h3>Where people leave</h3>
          <p className={styles.cardNote}>
            The step each finished visit was on when it ended. Select a step to
            see those sessions.
          </p>
          <BarList
            caption="Last step before leaving"
            rows={data.exits.map((row) => ({
              key: row.step,
              label: stepLabel(definition, row.step),
              value: row.sessions,
            }))}
            total={exitTotal}
            onSelect={(step) => onSessions({ game, step })}
          />
        </section>
      </div>

      <div className={styles.columns2}>
        <section className={styles.card}>
          <h3>How rounds end</h3>
          <p className={styles.cardNote}>
            Every round, including ones players left or restarted.
          </p>
          <BarList
            caption="Round results"
            rows={resultRows}
            total={resultTotal}
            empty="No rounds ended in this period."
          />
        </section>
        <section className={styles.card}>
          <h3>Who they play with</h3>
          <p className={styles.cardNote}>Sessions that started a round.</p>
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
          <BarList
            caption="How sessions got in"
            rows={(['solo', 'host', 'join'] as const).map((mode) => ({
              key: mode,
              label: MODE_LABELS[mode],
              value: totals.modes[mode],
            }))}
            total={totals.sessions}
          />
          {totals.hosted > 0 && (
            <p className={styles.cardNote}>
              {percent(totals.hostedAlone, totals.hosted)} of hosted rooms (
              {count(totals.hostedAlone)} of {count(totals.hosted)}) never got a
              second person.
            </p>
          )}
        </section>
      </div>

      <section className={styles.card}>
        <h3>What players do</h3>
        <p className={styles.cardNote}>
          Actions pressed during the visit. Unused ones are listed at the
          bottom.
        </p>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Sessions that used it</th>
                <th>Times</th>
                <th>Per session that played</th>
              </tr>
            </thead>
            <tbody>
              {actionRows.map((row) => (
                <tr key={row.action} data-unused={row.total === 0 || undefined}>
                  <th scope="row">{actionLabel(definition, row.action)}</th>
                  <td>
                    <InlineBar value={row.sessions} max={totals.sessions}>
                      {percent(row.sessions, totals.sessions)}
                    </InlineBar>
                  </td>
                  <td>{count(row.total)}</td>
                  <td>
                    {totals.played
                      ? (row.total / totals.played).toFixed(1)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.columns2}>
        <section className={styles.card}>
          <h3>How long they stay</h3>
          <p className={styles.cardNote}>
            Visit length, then where the time went.
          </p>
          <BarList
            caption="Visit length"
            rows={data.durations.map((bucket) => ({
              key: bucket.label,
              label: bucket.label,
              value: bucket.sessions,
            }))}
            total={totals.sessions}
          />
          <StackBar
            label="Time spent"
            format={hours}
            parts={[
              {
                key: 'menu',
                label: 'Menu',
                value: totals.time.menu,
                color: SERIES[0],
              },
              {
                key: 'lobby',
                label: 'Lobby',
                value: totals.time.lobby,
                color: SERIES[1],
              },
              {
                key: 'playing',
                label: 'Rounds',
                value: totals.time.playing,
                color: SERIES[2],
              },
              {
                key: 'finished',
                label: 'Results',
                value: totals.time.finished,
                color: SERIES[3],
              },
            ]}
          />
        </section>
        <section className={styles.card}>
          <h3>How they arrive</h3>
          <p className={styles.cardNote}>
            Where the visit came from, and on what.
          </p>
          <BarList
            caption="Arrivals"
            rows={Object.entries(data.entries)
              .sort((a, b) => b[1] - a[1])
              .map(([key, value]) => ({
                key,
                label: ENTRY_LABELS[key] ?? key,
                value,
              }))}
            total={totals.sessions}
          />
          <BarList
            caption="Devices"
            rows={[
              {
                key: 'touch',
                label: 'Touch screen',
                value: totals.touch,
                note: totals.touch
                  ? `${percent(totals.touchPlayed, totals.touch)} played`
                  : undefined,
              },
              {
                key: 'pointer',
                label: 'Mouse and keyboard',
                value: pointer,
                note: pointer
                  ? `${percent(totals.played - totals.touchPlayed, pointer)} played`
                  : undefined,
              },
            ]}
            total={totals.sessions}
          />
        </section>
      </div>

      <section className={styles.card}>
        <h3>Sessions per day</h3>
        <DayColumns days={data.days} />
      </section>
    </div>
  );
}
