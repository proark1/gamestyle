'use client';
import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from './model';
import type { Session } from './connection';
import { challengeOutcome, formatChallengeTime } from './disaster-challenge';

export function DisasterChallenge({
  snapshot,
  session,
  notify,
  onSaved,
}: {
  snapshot: Snapshot;
  session: Session;
  notify: (text: string) => void;
  onSaved: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState('');
  const saving = useRef<AbortController | null>(null);
  useEffect(() => () => saving.current?.abort(), []);
  const p = snapshot.world.party!,
    benchmark = p.challenge;
  const final = p.phase === 'inspection' || p.phase === 'results';
  const eligible =
    final && p.result?.passed && p.run?.elapsedMs && !p.run.invalidReason;
  if (!benchmark && !eligible && !(final && p.run?.invalidReason)) return null;
  async function save() {
    if (busy) return;
    const abort = new AbortController();
    saving.current = abort;
    setBusy(true);
    try {
      const response = await fetch('/api/handwerker/builds', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...session,
          kind: 'challenge',
          roundId: p.roundId,
          title: `${p.crewName || 'Our crew'}: Beat our disaster!`,
        }),
      });
      const data = (await response.json()) as { id: string; error?: string };
      if (!response.ok)
        throw new Error(data.error || 'The challenge could not be saved.');
      if (abort.signal.aborted) return;
      setSaved(data.id);
      onSaved(data.id);
      notify('Challenge saved. Copy its invitation to challenge another crew.');
    } catch (e) {
      if (!abort.signal.aborted) notify((e as Error).message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  async function copy() {
    const text = `${p.crewName || 'Our crew'} passed in ${formatChallengeTime(p.run!.elapsedMs!)} with ${p.run!.crewSize} builder${p.run!.crewSize === 1 ? '' : 's'}. Can your crew beat our disaster? ${location.origin}/build/${saved}`;
    try {
      await navigator.clipboard.writeText(text);
      notify('Challenge invitation copied.');
    } catch {
      notify('Open your challenge and copy its address to share.');
    }
  }
  return (
    <aside
      className="disaster-challenge"
      aria-label="Beat our disaster challenge"
    >
      <b>BEAT OUR DISASTER</b>
      {benchmark && (
        <p>
          Time to beat:{' '}
          <strong>{formatChallengeTime(benchmark.elapsedMs)}</strong> ·{' '}
          {benchmark.crewName} · {benchmark.crewSize} builder
          {benchmark.crewSize === 1 ? '' : 's'}
        </p>
      )}
      {p.phase === 'lobby' && (
        <p>
          Same starting build and job rules. Bring {benchmark!.crewSize} builder
          {benchmark!.crewSize === 1 ? '' : 's'}. The clock runs from shift
          start to the customer’s verdict, including last call and rescue time.
        </p>
      )}
      {final && benchmark && (
        <output>{challengeOutcome(snapshot.world)}</output>
      )}
      {(!final || !benchmark) && p.run?.invalidReason && (
        <p>{p.run.invalidReason}</p>
      )}
      {eligible && (
        <>
          <p>
            Your server-timed finish:{' '}
            <strong>{formatChallengeTime(p.run!.elapsedMs!)}</strong> ·{' '}
            {p.run!.crewSize} builder{p.run!.crewSize === 1 ? '' : 's'}
          </p>
          <p>
            Share the starting site, your crew name and time. The next crew gets
            its own attempt.
          </p>
          {!saved ? (
            <button disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving challenge…' : 'Challenge another crew'}
            </button>
          ) : (
            <p>
              <button onClick={() => void copy()}>
                Copy challenge invitation
              </button>{' '}
              <a href={`/build/${saved}`} target="_blank" rel="noreferrer">
                Open challenge ↗
              </a>
            </p>
          )}
        </>
      )}
      {benchmark && !saved && (
        <a
          href={`/build/${benchmark.buildId}`}
          target="_blank"
          rel="noreferrer"
        >
          View the original challenge ↗
        </a>
      )}
    </aside>
  );
}
