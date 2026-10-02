import { useState } from 'react';
import {
  ERROR_KINDS,
  PLATFORMS,
  ENGINES,
} from '../../shared/diagnostics/protocol';
import { catalogGame } from '../analytics/catalog';
import type { HealthReport } from '../analytics/health';
import { StatTile } from './charts';
import { count, percent } from './format';
import { useReport, type Scope } from './request';
import styles from './admin.module.css';

const ERROR_LABELS = {
  javascript: 'JavaScript errors',
  resource: 'Failed downloads',
  rejection: 'Unhandled promises',
  'graphics-lost': 'Graphics interruptions',
  offline: 'Connection interruptions',
  'start-timeout': 'No rendered frame within 45 seconds',
};
const milliseconds = (value: number | null) =>
  value === null ? '—' : `${count(value)} ms`;
export default function HealthPanel({
  scope,
  game,
}: {
  scope: Scope;
  game: string;
}) {
  const [platform, setPlatform] = useState('');
  const [engine, setEngine] = useState('');
  const [release, setRelease] = useState('');
  const { data, error, loading } = useReport<HealthReport>(scope, {
    view: 'health',
    from: scope.from,
    game,
    platform,
    engine,
    release,
  });
  return (
    <div className={styles.panel} data-loading={loading || undefined}>
      <div className={styles.filters}>
        <label>
          Platform{' '}
          <select
            aria-label="Platform"
            className={styles.select}
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            <option value="">All platforms</option>
            {PLATFORMS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Browser engine{' '}
          <select
            aria-label="Browser engine"
            className={styles.select}
            value={engine}
            onChange={(event) => setEngine(event.target.value)}
          >
            <option value="">All engines</option>
            {ENGINES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Build{' '}
          <input
            aria-label="Build"
            className={styles.select}
            value={release}
            maxLength={64}
            placeholder="All builds"
            onChange={(event) =>
              setRelease(event.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))
            }
          />
        </label>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!data ? (
        <p className={styles.empty}>Loading game health…</p>
      ) : (
        <>
          {data.truncated && (
            <p className={styles.notice}>
              This report includes the newest 10,000 visits in the selected
              period.
            </p>
          )}
          <section className={styles.tiles} aria-label="Game health totals">
            <StatTile
              label="Reported visits"
              value={count(data.totals.visits)}
              detail={`${count(data.totals.sampledVisits)} with frame samples`}
            />
            <StatTile
              label="Visits with issues"
              value={count(data.totals.issueVisits)}
              detail={percent(data.totals.issueVisits, data.totals.visits)}
            />
            <StatTile
              label="Median time to first frame report"
              value={milliseconds(data.totals.medianReadyMs)}
              detail={`${count(data.totals.readyVisits)} rendered visits`}
            />
            <StatTile
              label="Average sampled FPS"
              value={
                data.totals.averageFps === null
                  ? '—'
                  : count(data.totals.averageFps)
              }
              detail={`${count(data.totals.samples)} visible-page samples`}
            />
          </section>
          <section className={styles.card}>
            <h2>Health by game</h2>
            <p className={styles.cardNote}>
              Readiness is measured when the first renderer diagnostic becomes
              available. Frame timings are averages of sampled p95 values.
              Visits without frame samples are excluded from performance
              averages.
            </p>
            {!data.games.length ? (
              <p className={styles.empty}>
                No diagnostic reports in this period. Reports appear after
                players open a game.
              </p>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <caption className={styles.srOnly}>
                    Game loading, performance and errors
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Game</th>
                      <th scope="col">Visits</th>
                      <th scope="col">Issues</th>
                      <th scope="col">First frame</th>
                      <th scope="col">FPS</th>
                      <th scope="col">p95 frame</th>
                      <th scope="col">p95 work</th>
                      <th scope="col">Peak geometries / textures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.games.map((row) => (
                      <tr key={row.game}>
                        <th scope="row">
                          {catalogGame(row.game)?.name ?? row.game}
                        </th>
                        <td>{count(row.visits)}</td>
                        <td>{count(row.issueVisits)}</td>
                        <td>{milliseconds(row.medianReadyMs)}</td>
                        <td>{row.averageFps ?? '—'}</td>
                        <td>{milliseconds(row.averageP95FrameMs)}</td>
                        <td>{milliseconds(row.averageP95WorkMs)}</td>
                        <td>
                          {count(row.maxGeometries)} / {count(row.maxTextures)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className={styles.card}>
            <h2>Recorded issues</h2>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>
                  Counts of technical interruptions
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_KINDS.map((kind) => (
                    <tr key={kind}>
                      <th scope="row">{ERROR_LABELS[kind]}</th>
                      <td>{count(data.totals.errors[kind] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className={styles.card}>
            <h2>Reported builds</h2>
            {data.releases.length ? (
              <ul>
                {data.releases.map((row) => (
                  <li key={row.release}>
                    <code>{row.release}</code> · {count(row.visits)} visits
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No builds recorded.</p>
            )}
            <p className={styles.cardNote}>
              Anonymous, capped summaries. No error messages, URLs, player names
              or persistent identifiers. Do Not Track and Global Privacy Control
              are respected.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
