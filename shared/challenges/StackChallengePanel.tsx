'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Trophy } from 'lucide-react';
import {
  accountSnapshot,
  serverAccountSnapshot,
  subscribeAccount,
  openAccountDialog,
} from '../accounts/client';
import { apiFetch } from '../browser/api-fetch';
import { refreshInventory } from '../commerce/client';
import { STACK_MASTERY, stackWeek, type StackProgress } from './catalog';
import type { RankedBoard } from './server/ranked';
import './challenge.css';

export default function StackChallengePanel({
  finished = false,
  link = false,
}: {
  finished?: boolean;
  link?: boolean;
}) {
  const { account, methods } = useSyncExternalStore(
    subscribeAccount,
    accountSnapshot,
    serverAccountSnapshot,
  );
  const [data, setData] = useState<{
    owner: typeof account;
    value: StackProgress;
  } | null>(null);
  const [error, setError] = useState('');
  const [ranked, setRanked] = useState<{
    owner: typeof account;
    value: {
      attemptsRemaining: number;
      boards: RankedBoard[];
      crewBoards: RankedBoard[];
      previous: {
        week: number;
        finalized: boolean;
        boards: RankedBoard[];
        crewBoards: RankedBoard[];
      };
    };
  } | null>(null);
  const [teamSize, setTeamSize] = useState(1);
  const [scope, setScope] = useState<'players' | 'mates' | 'crews'>('players');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!account) return;
    const controller = new AbortController();
    void apiFetch('/api/challenges/stack-or-sink', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok)
          throw new Error(value.error ?? 'Could not load your challenges.');
        if (active) {
          setError('');
          setData({ owner: account, value });
          if (finished) void refreshInventory();
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load challenges.',
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [account, finished, revision]);
  useEffect(() => {
    if (!account) return;
    let active = true;
    const controller = new AbortController();
    void apiFetch('/api/challenges/stack-or-sink?board', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok)
          throw new Error(value.error ?? 'Could not load rankings.');
        if (active) setRanked({ owner: account, value });
      })
      .catch((reason) => {
        if (
          active &&
          !(reason instanceof Error && reason.name === 'AbortError')
        )
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load rankings.',
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [account, revision]);
  const progress = data?.owner === account ? data.value : null;
  const [week, setWeek] = useState<ReturnType<typeof stackWeek> | null>(null);
  useEffect(() => {
    const update = () => {
      setWeek(stackWeek(Date.now()));
      setRevision((r) => r + 1);
    };
    queueMicrotask(update);
    const timer = setInterval(update, 60000);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  const current = progress?.week ?? week;
  const rankedData = ranked?.owner === account ? ranked.value : null;
  const board = (
    scope === 'crews' ? rankedData?.crewBoards : rankedData?.boards
  )?.find((item) => item.teamSize === teamSize);
  const oldBoard = (
    scope === 'crews'
      ? rankedData?.previous.crewBoards
      : rankedData?.previous.boards
  )?.find((item) => item.teamSize === teamSize);
  return (
    <section className="stack-challenge" aria-label="Stack or Sink challenges">
      <div className="stack-challenge-heading">
        <Trophy size={22} />
        <div>
          <small>VERIFIED CHALLENGE · FREE</small>
          <h3>A little higher, together</h3>
        </div>
      </div>
      <p>
        Build a settled {current?.height ?? '…'} m tower in Stack or Sink and
        finish the round. Up to four signed-in friends can help.
      </p>
      <p>
        <strong>
          {progress?.weeklyComplete
            ? 'Weekly reward earned'
            : '100 coins this week'}
        </strong>
        {current &&
          ` · New target ${new Date(current.end).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })} (00:00 UTC)`}
      </p>
      <ul>
        {STACK_MASTERY.map((m) => (
          <li key={m.id}>
            <span>
              {progress?.milestones.includes(m.id) ? '✓ ' : ''}
              {m.label} ·{' '}
              {m.height === null
                ? 'reach rescue'
                : `${m.height} m settled tower`}
            </span>
            <strong>
              {progress?.milestones.includes(m.id)
                ? 'Earned'
                : `${m.coins} coins`}
            </strong>
          </li>
        ))}
      </ul>
      <p className="stack-challenge-note">
        Mastery rewards are earned once. Weekly rewards are earned once per
        week. Practice and ordinary parties do not count.
      </p>
      {account ? (
        <p>
          {progress
            ? `Your verified best: ${progress.bestHeight.toFixed(1)} m`
            : 'Loading your progress…'}
        </p>
      ) : (
        <p>
          Sign in to save progress and earn coins.
          {(methods.email || methods.google) && (
            <button onClick={() => openAccountDialog()}>Sign in</button>
          )}
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRevision((r) => r + 1)}>Retry</button>
        </p>
      )}
      <div className="stack-ranked" aria-label="Weekly Stack or Sink rankings">
        <h4>Weekly rankings</h4>
        <p>
          Five ranked starts per account each week. A start uses one for every
          teammate; unlimited verified challenges remain free to replay. Finish
          a round with the weekly settled tower target to enter the board.
        </p>
        <p>
          <strong>
            {account
              ? `${rankedData?.attemptsRemaining ?? '…'} ranked starts left this week`
              : 'Sign in for ranked starts'}
          </strong>
        </p>
        <fieldset className="stack-ranked-sizes">
          <legend>Leaderboard</legend>
          <button
            type="button"
            aria-pressed={scope === 'players'}
            onClick={() => setScope('players')}
          >
            Players
          </button>
          <button
            type="button"
            aria-pressed={scope === 'mates'}
            onClick={() => setScope('mates')}
          >
            Crew mates
          </button>
          <button
            type="button"
            aria-pressed={scope === 'crews'}
            onClick={() => setScope('crews')}
          >
            Crews
          </button>
        </fieldset>
        <fieldset className="stack-ranked-sizes">
          <legend>Team size</legend>
          {[1, 2, 3, 4].map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={teamSize === size}
              onClick={() => setTeamSize(size)}
            >
              {size} {size === 1 ? 'player' : 'players'}
            </button>
          ))}
        </fieldset>
        <p className="stack-challenge-note">
          {board?.population ?? 0} eligible{' '}
          {scope === 'crews' ? 'crews' : 'players'} ·{' '}
          {board?.population && board.population >= 100
            ? 'Top 10% wins the Tower Ace Helmet; top 1% also wins the Skyline Crown.'
            : `Prize cosmetics unlock when this board has at least 100 eligible ${scope === 'crews' ? 'crews' : 'players'}.`}{' '}
          Ties at the cutoff share the prize. Results stay provisional until 24
          hours after Monday 00:00 UTC.
        </p>
        {scope === 'crews' && (
          <p className="stack-challenge-note">
            Every teammate must belong to the same persistent crew when the
            ranked run starts. Only that run’s teammates can win its crew
            prizes. You can represent one crew per week.
          </p>
        )}
        {board?.myPlace && (
          <p>
            {scope === 'crews' ? 'Your crew’s best place' : 'Your best place'}:{' '}
            <strong>#{board.myPlace}</strong>
          </p>
        )}
        {(scope === 'mates' ? board?.crewMates : board?.entries)?.length ? (
          <ol className="stack-ranked-list">
            {(scope === 'mates' ? board?.crewMates : board?.entries)?.map(
              (entry) => (
                <li key={entry.tag}>
                  <span>
                    #{entry.place} {entry.tag}
                    {entry.self
                      ? scope === 'crews'
                        ? ' · your crew'
                        : ' · you'
                      : ''}
                  </span>
                  <strong>{(entry.heightCm / 100).toFixed(2)} m</strong>
                </li>
              ),
            )}
          </ol>
        ) : (
          <p>
            {scope === 'mates'
              ? 'No crew mate has a qualified tower yet.'
              : `No qualified ${scope === 'crews' ? 'crew' : 'player'} tower yet. Be first on the board.`}
          </p>
        )}
        {!!oldBoard?.population && (
          <details>
            <summary>
              Last week’s{' '}
              {rankedData?.previous.finalized ? 'final' : 'provisional'} board
            </summary>
            <ol className="stack-ranked-list">
              {(scope === 'mates' ? oldBoard.crewMates : oldBoard.entries)?.map(
                (entry) => (
                  <li key={entry.tag}>
                    <span>
                      #{entry.place} {entry.tag}
                      {entry.self
                        ? scope === 'crews'
                          ? ' · your crew'
                          : ' · you'
                        : ''}
                    </span>
                    <strong>{(entry.heightCm / 100).toFixed(2)} m</strong>
                  </li>
                ),
              )}
            </ol>
          </details>
        )}
        {link && (
          <a href="/stack-or-sink?challenge=ranked">Play a ranked run →</a>
        )}
      </div>
      {link && (
        <a href="/stack-or-sink?challenge=verified">
          Play the verified challenge →
        </a>
      )}
    </section>
  );
}
