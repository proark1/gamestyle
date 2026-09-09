import type { Party } from './party';
export type Memento = {
  id: string;
  at: number;
  crew: string;
  title: string;
  badge: string;
  daily?: string;
};
export function roundMemento(party: Party): Memento | null {
  if (party.phase !== 'results' || !party.result) return null;
  const badge = party.result.passed
    ? party.swap
      ? 'Puzzle champions'
      : party.inspection?.firstCheck
        ? 'Rescue crew'
        : 'Customer approved'
    : 'Built with friends';
  return {
    id: party.roundId,
    at: party.result.at,
    crew: party.crewName || 'Our questionable crew',
    title: party.result.title,
    badge,
    ...(party.daily ? { daily: party.daily.date } : {}),
  };
}
export function addMemento(entries: Memento[], entry: Memento) {
  return [entry, ...entries.filter((v) => v.id !== entry.id)].slice(0, 30);
}
