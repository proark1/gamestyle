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
      {link && (
        <a href="/stack-or-sink?challenge=verified">
          Play the verified challenge →
        </a>
      )}
    </section>
  );
}
