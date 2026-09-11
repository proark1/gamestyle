import { useState, type ReactNode } from 'react';
import type { CrewKey, DayCount } from '../analytics/types';
import { CREW_LABELS, count, dayLabel, percent } from './format';
import styles from './admin.module.css';

export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <strong className={styles.tileValue}>{value}</strong>
      {detail && <span className={styles.tileDetail}>{detail}</span>}
    </div>
  );
}

export type BarRow = {
  key: string;
  label: ReactNode;
  value: number;
  note?: ReactNode;
  tone?: 'good' | 'critical' | 'quiet';
};

/** A table whose rows carry a bar: the numbers stay readable without the bars. */
export function BarList({
  caption,
  rows,
  total,
  onSelect,
  empty = 'Nothing recorded in this period.',
}: {
  caption: string;
  rows: BarRow[];
  total?: number;
  onSelect?: (key: string) => void;
  empty?: string;
}) {
  if (!rows.length) return <p className={styles.empty}>{empty}</p>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <table className={styles.barList}>
      <caption className={styles.srOnly}>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">
              {onSelect && row.value > 0 ? (
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => onSelect(row.key)}
                >
                  {row.label}
                </button>
              ) : (
                row.label
              )}
            </th>
            <td className={styles.barCell} aria-hidden="true">
              {row.value > 0 && (
                <span
                  className={styles.bar}
                  data-tone={row.tone}
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              )}
            </td>
            <td className={styles.barValue}>
              {count(row.value)}
              {total !== undefined && (
                <small>{percent(row.value, total)}</small>
              )}
              {row.note && <small>{row.note}</small>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type Part = { key: string; label: string; value: number; color: string };

// Categorical slots in their validated order, so neighbours stay distinct.
export const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
];

export const crewParts = (crew: Record<CrewKey, number>): Part[] =>
  (['alone', 'npcs', 'friends', 'mixed'] as const).map((key, index) => ({
    key,
    label: CREW_LABELS[key],
    value: crew[key],
    color: SERIES[index],
  }));

const describe = (parts: Part[]) => {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return parts
    .map((part) => `${part.label} ${percent(part.value, total)}`)
    .join(', ');
};

/** The coloured track only; every caller also shows its values as text. */
function Track({ parts }: { parts: Part[] }) {
  return (
    <span className={styles.stackTrack} aria-hidden="true">
      {parts
        .filter((part) => part.value > 0)
        .map((part) => (
          <span
            key={part.key}
            style={{ flex: `${part.value} 1 0`, background: part.color }}
          />
        ))}
    </span>
  );
}

export function StackBar({
  label,
  parts,
  format = count,
}: {
  label: string;
  parts: Part[];
  format?: (value: number) => string;
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (!total) return <p className={styles.empty}>Nothing recorded yet.</p>;
  return (
    <figure className={styles.stack}>
      <Track parts={parts} />
      <figcaption>
        <span className={styles.srOnly}>{label}</span>
        <ul className={styles.legend}>
          {parts.map((part) => (
            <li key={part.key}>
              <i style={{ background: part.color }} />
              {part.label}
              <strong>{percent(part.value, total)}</strong>
              <small>{format(part.value)}</small>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** A compact stacked bar for table cells; hovering shows the split. */
export function MiniStack({ label, parts }: { label: string; parts: Part[] }) {
  const text = describe(parts);
  return (
    <span className={styles.mini} title={text}>
      <Track parts={parts} />
      <span className={styles.srOnly}>
        {label}: {text}
      </span>
    </span>
  );
}

export function InlineBar({
  value,
  max,
  children,
}: {
  value: number;
  max: number;
  children: ReactNode;
}) {
  return (
    <span className={styles.inline}>
      <span className={styles.inlineTrack} aria-hidden="true">
        {value > 0 && (
          <span
            style={{ width: `${Math.min(1, value / Math.max(1, max)) * 100}%` }}
          />
        )}
      </span>
      {children}
    </span>
  );
}

function niceTop(max: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, max)));
  for (const step of [1, 2, 2.5, 5, 10])
    if (step * magnitude >= max) return step * magnitude;
  return 10 * magnitude;
}

/** Sessions per day: visits that started a round at the baseline, the rest on top. */
export function DayColumns({ days }: { days: DayCount[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  if (!days.length)
    return <p className={styles.empty}>No sessions in this period.</p>;
  const top = niceTop(Math.max(...days.map((day) => day.sessions)));
  // Sessions come in whole numbers, so skip a middle gridline that would read 0.5.
  const ticks = top % 2 ? [0, top] : [0, top / 2, top];
  const shown = active === null ? undefined : days[active];
  return (
    <figure className={styles.chart}>
      {asTable ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Day</th>
                <th>Sessions</th>
                <th>Started a round</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((day) => (
                <tr key={day.day}>
                  <td>{dayLabel(day.day)}</td>
                  <td>{count(day.sessions)}</td>
                  <td>{count(day.played)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className={styles.plot} onMouseLeave={() => setActive(null)}>
            {ticks.map((tick) => (
              <span
                key={tick}
                className={styles.gridline}
                data-baseline={tick === 0 || undefined}
                style={{ bottom: `${(tick / top) * 100}%` }}
              >
                <em>{count(tick)}</em>
              </span>
            ))}
            {days.map((day, index) => (
              <button
                key={day.day}
                type="button"
                className={styles.column}
                aria-label={`${dayLabel(day.day)}: ${day.sessions} sessions, ${day.played} started a round`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              >
                <span
                  className={styles.columnStack}
                  style={{ height: `${(day.sessions / top) * 100}%` }}
                >
                  {day.sessions > day.played && (
                    <span
                      data-part="visited"
                      style={{ flex: `${day.sessions - day.played} 1 0` }}
                    />
                  )}
                  {day.played > 0 && (
                    <span
                      data-part="played"
                      style={{ flex: `${day.played} 1 0` }}
                    />
                  )}
                </span>
              </button>
            ))}
            {shown && (
              <div
                className={styles.tooltip}
                style={{
                  left: `calc(var(--axis-width) + (100% - var(--axis-width)) * ${
                    (active! + 0.5) / days.length
                  })`,
                }}
              >
                <strong>{count(shown.sessions)} sessions</strong>
                <span>{count(shown.played)} started a round</span>
                <small>{dayLabel(shown.day)}</small>
              </div>
            )}
          </div>
          <div className={styles.axis}>
            <span>{dayLabel(days[0].day)}</span>
            {days.length > 1 && <span>{dayLabel(days.at(-1)!.day)}</span>}
          </div>
        </>
      )}
      <figcaption className={styles.chartFoot}>
        <ul className={styles.legend}>
          <li>
            <i style={{ background: 'var(--series-1)' }} />
            Started a round
          </li>
          <li>
            <i style={{ background: 'var(--quiet)' }} />
            Only visited
          </li>
        </ul>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => setAsTable((value) => !value)}
        >
          {asTable ? 'Show the chart' : 'Show as a table'}
        </button>
      </figcaption>
    </figure>
  );
}
