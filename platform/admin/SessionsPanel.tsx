import { Fragment, useState } from 'react';
import { Bot, ChevronDown, Monitor, Smartphone, User, X } from 'lucide-react';
import { stepLabel, stepOrder } from '../../shared/analytics/protocol';
import { catalogGame } from '../analytics/catalog';
import type {
  SessionDetail,
  SessionPage,
  SessionRow,
} from '../analytics/types';
import { SERIES, StackBar } from './charts';
import {
  ENTRY_LABELS,
  MODE_LABELS,
  actionLabel,
  clock,
  crewText,
  duration,
  eventText,
  exitLabel,
  resultLabel,
  when,
} from './format';
import { SignedOut, adminFetch, useReport, type Scope } from './request';
import styles from './admin.module.css';

export type SessionFilter = {
  game?: string;
  step?: string;
  crew?: string;
  mode?: string;
  outcome?: string;
  device?: string;
};

const CHOICES: {
  key: 'crew' | 'mode' | 'outcome' | 'device';
  label: string;
  options: [string, string][];
}[] = [
  {
    key: 'crew',
    label: 'Crew',
    options: [
      ['', 'Any crew'],
      ['alone', 'Alone'],
      ['npcs', 'Alone with NPCs'],
      ['friends', 'With real players'],
      ['mixed', 'Real players and NPCs'],
      ['none', 'Never played a round'],
    ],
  },
  {
    key: 'mode',
    label: 'Way in',
    options: [
      ['', 'Any way in'],
      ['solo', 'Solo'],
      ['host', 'Hosted a room'],
      ['join', 'Joined a room'],
      ['none', 'Never chose'],
    ],
  },
  {
    key: 'outcome',
    label: 'Result',
    options: [
      ['', 'Any result'],
      ['won', 'Won a round'],
      ['lost', 'Lost without a win'],
      ['unfinished', 'Played, nothing decided'],
    ],
  },
  {
    key: 'device',
    label: 'Device',
    options: [
      ['', 'Any device'],
      ['touch', 'Touch screen'],
      ['pointer', 'Mouse and keyboard'],
    ],
  },
];

type More = {
  key: string;
  sessions: SessionRow[];
  next: string | null;
  busy: boolean;
  error?: string;
};

export default function SessionsPanel({
  scope,
  filter,
  onFilter,
}: {
  scope: Scope;
  filter: SessionFilter;
  onFilter: (filter: SessionFilter) => void;
}) {
  const params = {
    view: 'sessions',
    from: scope.from,
    tz: scope.tz,
    limit: 50,
    ...filter,
  };
  const first = useReport<SessionPage>(scope, params);
  const key = `${JSON.stringify(params)}|${scope.revision}`;
  const [more, setMore] = useState<More>({
    key: '',
    sessions: [],
    next: null,
    busy: false,
  });
  const [open, setOpen] = useState<string | null>(null);
  const mine = more.key === key;
  const sessions = [
    ...(first.data?.sessions ?? []),
    ...(mine ? more.sessions : []),
  ];
  const next =
    mine && more.sessions.length ? more.next : (first.data?.next ?? null);
  const stepGame = filter.step && filter.game ? catalogGame(filter.game) : null;

  async function loadMore() {
    if (!next) return;
    setMore({ key, sessions: mine ? more.sessions : [], next, busy: true });
    try {
      const page = await adminFetch<SessionPage>(scope.credential, {
        ...params,
        cursor: next,
      });
      setMore((previous) => ({
        key,
        sessions: [
          ...(previous.key === key ? previous.sessions : []),
          ...page.sessions,
        ],
        next: page.next,
        busy: false,
      }));
    } catch (error) {
      if (error instanceof SignedOut) return scope.signOut();
      setMore((previous) => ({
        ...previous,
        busy: false,
        error:
          error instanceof Error
            ? error.message
            : 'Could not load more sessions.',
      }));
    }
  }

  return (
    <div className={styles.panel} data-loading={first.loading || undefined}>
      <div className={styles.subFilters}>
        {CHOICES.map((choice) => (
          <label key={choice.key}>
            <span className={styles.srOnly}>{choice.label}</span>
            <select
              className={styles.select}
              value={filter[choice.key] ?? ''}
              onChange={(event) =>
                onFilter({
                  ...filter,
                  [choice.key]: event.target.value || undefined,
                })
              }
            >
              {choice.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {stepGame && filter.step && (
          <button
            type="button"
            className={styles.chip}
            onClick={() => onFilter({ ...filter, step: undefined })}
          >
            Left at: {stepLabel(stepGame.analytics, filter.step)}
            <X size={13} aria-hidden="true" />
            <span className={styles.srOnly}>Remove this filter</span>
          </button>
        )}
      </div>
      {first.error && (
        <p role="alert" className={styles.error}>
          {first.error}
        </p>
      )}
      <section className={styles.card}>
        <h2>Sessions</h2>
        <p className={styles.cardNote}>
          One row per visit to a game page, newest first. Select a row to see
          everything that happened in it.
        </p>
        {!first.data ? (
          <p className={styles.empty}>Loading sessions…</p>
        ) : !sessions.length ? (
          <p className={styles.empty}>No sessions match these filters.</p>
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Game</th>
                  <th>Stayed</th>
                  <th>Way in</th>
                  <th>Crew</th>
                  <th>Rounds</th>
                  <th>Got to</th>
                  <th>Left at</th>
                  <th>Ended</th>
                  <th>
                    <span className={styles.srOnly}>Device</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const game = catalogGame(session.game);
                  const label = (step: string) =>
                    game ? stepLabel(game.analytics, step) : step;
                  const expanded = open === session.id;
                  return (
                    <Fragment key={session.id}>
                      <tr data-open={expanded || undefined}>
                        <td>
                          <button
                            type="button"
                            className={styles.rowButton}
                            aria-expanded={expanded}
                            onClick={() =>
                              setOpen(expanded ? null : session.id)
                            }
                          >
                            <ChevronDown size={14} aria-hidden="true" />
                            {when(session.started)}
                          </button>
                        </td>
                        <td>{game?.name ?? session.game}</td>
                        <td>{duration(session.elapsed)}</td>
                        <td>{MODE_LABELS[session.mode] ?? session.mode}</td>
                        <td>
                          <Crew humans={session.humans} npcs={session.npcs} />
                        </td>
                        <td>
                          {session.rounds
                            ? `${session.rounds} · ${session.wins} won, ${session.losses} lost`
                            : '—'}
                        </td>
                        <td>{label(session.furthest)}</td>
                        <td>{label(session.lastStep)}</td>
                        <td>
                          {session.live ? (
                            <span className={styles.live}>
                              <span className={styles.liveDot} />
                              Still here
                            </span>
                          ) : (
                            exitLabel(session)
                          )}
                        </td>
                        <td>
                          {session.device === 'touch' ? (
                            <Smartphone size={15} aria-hidden="true" />
                          ) : (
                            <Monitor size={15} aria-hidden="true" />
                          )}
                          <span className={styles.srOnly}>
                            {session.device === 'touch'
                              ? 'Touch screen'
                              : 'Mouse and keyboard'}
                          </span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className={styles.detailRow}>
                          <td colSpan={10}>
                            <SessionDetailView scope={scope} id={session.id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {next && (
          <button
            type="button"
            className={styles.quiet}
            onClick={() => void loadMore()}
            disabled={mine && more.busy}
          >
            {mine && more.busy ? 'Loading…' : 'Load 50 more'}
          </button>
        )}
        {mine && more.error && (
          <p role="alert" className={styles.error}>
            {more.error}
          </p>
        )}
      </section>
    </div>
  );
}

function Crew({ humans, npcs }: { humans: number; npcs: number }) {
  if (!humans && !npcs) return <>—</>;
  return (
    <span className={styles.crew} title={crewText(humans, npcs)}>
      <User size={13} aria-hidden="true" />
      {humans}
      {npcs > 0 && (
        <>
          <Bot size={13} aria-hidden="true" />
          {npcs}
        </>
      )}
      <span className={styles.srOnly}>{crewText(humans, npcs)}</span>
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SessionDetailView({ scope, id }: { scope: Scope; id: string }) {
  const [shown, setShown] = useState(id);
  const { data, error } = useReport<SessionDetail>(scope, {
    view: 'session',
    id: shown,
  });
  if (error)
    return (
      <p role="alert" className={styles.error}>
        {error}
      </p>
    );
  if (!data || data.session.id !== shown)
    return <p className={styles.empty}>Loading the timeline…</p>;
  const { session } = data;
  const game = catalogGame(session.game);
  if (!game)
    return (
      <p className={styles.empty}>This game is no longer in the collection.</p>
    );
  const definition = game.analytics;
  const actions = Object.entries(session.actions).sort((a, b) => b[1] - a[1]);
  const results = Object.entries(session.results).sort((a, b) => b[1] - a[1]);
  return (
    <div className={styles.detail}>
      {shown !== id && (
        <button
          type="button"
          className={styles.quiet}
          onClick={() => setShown(id)}
        >
          Back to the session in this row
        </button>
      )}
      <dl className={styles.facts}>
        <Fact label="Game" value={game.name} />
        <Fact label="Started" value={when(session.started)} />
        <Fact
          label="Stayed"
          value={`${duration(session.elapsed)} (${duration(session.active)} with the page in view)`}
        />
        <Fact
          label="Arrived"
          value={ENTRY_LABELS[session.entry] ?? session.entry}
        />
        <Fact
          label="Device"
          value={
            session.device === 'touch' ? 'Touch screen' : 'Mouse and keyboard'
          }
        />
        <Fact
          label="Way in"
          value={MODE_LABELS[session.mode] ?? session.mode}
        />
        <Fact
          label="Largest crew"
          value={
            session.humans || session.npcs
              ? crewText(session.humans, session.npcs)
              : 'Never in a room'
          }
        />
        <Fact
          label="Rounds"
          value={
            session.rounds
              ? `${session.rounds} (${session.wins} won, ${session.losses} lost)`
              : 'None'
          }
        />
        <Fact label="Got to" value={stepLabel(definition, session.furthest)} />
        <Fact label="Left at" value={stepLabel(definition, session.lastStep)} />
        <Fact label="Ended" value={exitLabel(session)} />
      </dl>
      <div className={styles.columns2}>
        <div>
          <h4>Where the time went</h4>
          <StackBar
            label="Time spent"
            format={duration}
            parts={[
              {
                key: 'menu',
                label: 'Menu',
                value: session.time.menu,
                color: SERIES[0],
              },
              {
                key: 'lobby',
                label: 'Lobby',
                value: session.time.lobby,
                color: SERIES[1],
              },
              {
                key: 'playing',
                label: 'Rounds',
                value: session.time.playing,
                color: SERIES[2],
              },
              {
                key: 'finished',
                label: 'Results',
                value: session.time.finished,
                color: SERIES[3],
              },
            ]}
          />
        </div>
        <div>
          <h4>Steps reached</h4>
          <ul className={styles.steps}>
            {stepOrder(definition).map((step) => (
              <li
                key={step}
                data-reached={session.reached.includes(step) || undefined}
              >
                {stepLabel(definition, step)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.columns2}>
        <div>
          <h4>What they did</h4>
          {actions.length ? (
            <ul className={styles.chips}>
              {actions.map(([action, times]) => (
                <li key={action}>
                  {actionLabel(definition, action)} <strong>×{times}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No counted actions.</p>
          )}
        </div>
        <div>
          <h4>How their rounds ended</h4>
          {results.length ? (
            <ul className={styles.chips}>
              {results.map(([key, times]) => (
                <li key={key}>
                  {resultLabel(definition, key)} <strong>×{times}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No rounds ended.</p>
          )}
        </div>
      </div>
      <div>
        <h4>Timeline</h4>
        <ol className={styles.timeline}>
          {data.events.map((event) => (
            <li key={event.seq}>
              <time>{clock(event.at)}</time>
              <span>{eventText(definition, event)}</span>
            </li>
          ))}
        </ol>
        {data.events.length >= 400 && (
          <p className={styles.cardNote}>
            The timeline keeps the first 400 events; the totals above include
            everything.
          </p>
        )}
      </div>
      {data.roommates.length > 0 && (
        <div>
          <h4>Other visits in the same room</h4>
          <ul className={styles.chips}>
            {data.roommates.map((mate) => (
              <li key={mate.id}>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => setShown(mate.id)}
                >
                  {when(mate.started)} · {MODE_LABELS[mate.mode] ?? mate.mode} ·{' '}
                  {duration(mate.elapsed)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
