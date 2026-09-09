'use client';
import { useEffect, useEffectEvent, useState } from 'react';
import type { Party } from './party';
import { addMemento, roundMemento, type Memento } from './scrapbook';
const KEY = 'bodge-crew-scrapbook-v1';
export function CrewScrapbook({ party }: { party: Party }) {
  const [entries, setEntries] = useState<Memento[]>([]);
  const [stored, setStored] = useState(true);
  const remember = useEffectEvent(() => {
    const current = roundMemento(party);
    if (!current) return;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      const previous = Array.isArray(raw)
        ? raw.filter(
            (v) =>
              v &&
              typeof v.id === 'string' &&
              typeof v.title === 'string' &&
              typeof v.badge === 'string' &&
              typeof v.crew === 'string' &&
              Number.isFinite(v.at),
          )
        : [];
      const next = addMemento(previous, current);
      localStorage.setItem(KEY, JSON.stringify(next));
      setEntries(next);
    } catch {
      setStored(false);
      setEntries([current]);
    }
  });
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) remember();
    });
    return () => {
      active = false;
    };
  }, [party.roundId, party.phase]);
  return (
    <details className="crew-scrapbook">
      <summary>Crew scrapbook · {entries.length} shifts</summary>
      <small>
        {stored
          ? 'Last 30 shifts, saved only in this browser. Clearing browser data removes these mementos.'
          : 'Browser storage is unavailable. This memento lasts until you leave.'}
      </small>
      {entries.map((entry) => (
        <article key={entry.id}>
          <b>{entry.badge}</b>
          <p>
            {entry.crew} · {entry.title}
          </p>
          <small>
            {new Date(entry.at).toLocaleDateString()}
            {entry.daily ? ` · Daily ${entry.daily}` : ''}
          </small>
        </article>
      ))}
    </details>
  );
}
