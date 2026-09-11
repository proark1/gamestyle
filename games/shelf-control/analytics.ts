import type { GameAnalytics, PlayState } from '../../shared/analytics/protocol';
import type { Session, Snapshot } from './types';

export const shelfAnalytics: GameAnalytics = {
  game: 'shelf-control',
  milestones: [
    { key: 'hunt', label: 'The hunt began' },
    { key: 'first-catch', label: 'The guard caught a mannequin' },
    { key: 'first-key', label: 'A mannequin found a key' },
    { key: 'power-off', label: 'Security was switched off' },
    { key: 'first-escape', label: 'A mannequin escaped' },
  ],
  reasons: {
    escaped: 'A mannequin escaped',
    'guard-mistakes': 'The guard used up every inspection',
    'all-caught': 'The guard caught every mannequin',
    'time-up': 'Time ran out with nobody out',
  },
  actions: {
    pose: 'Struck a pose',
    interact: 'Used a key, switch, ladder or door',
    drop: 'Dropped an item',
    inspect: 'Inspected a figure',
    'add-bot': 'Added an NPC',
    'remove-bot': 'Removed an NPC',
    'fill-start': 'Filled seats with NPCs and started',
    start: 'Started a round',
    restart: 'Started another round',
  },
};

/**
 * Snapshots hide every role once a round ends, so the reader remembers the
 * last role this player had to tell whether their side won.
 */
export function shelfStateReader() {
  let role: 'guard' | 'mannequin' = 'mannequin';
  return (snapshot: Snapshot, session: Session): PlayState => {
    const bots = snapshot.players.filter((player) => player.bot).length;
    const base = {
      mode:
        snapshot.host === session.id ? ('host' as const) : ('join' as const),
      room: session.code,
      humans: snapshot.players.length - bots,
      npcs: bots,
      round: snapshot.round,
    };
    if (snapshot.phase === 'lobby') return { stage: 'lobby', ...base };
    if (snapshot.you.role !== 'waiting') role = snapshot.you.role;
    const milestones: string[] = [];
    if (snapshot.phase !== 'hiding') milestones.push('hunt');
    if (snapshot.caught > 0) milestones.push('first-catch');
    if ((snapshot.objectives?.keys ?? 0) > 0) milestones.push('first-key');
    if (snapshot.objectives?.powerOff) milestones.push('power-off');
    if (snapshot.escaped > 0) milestones.push('first-escape');
    if (snapshot.phase === 'hiding' || snapshot.phase === 'playing')
      return { stage: 'playing', ...base, milestones };
    const mannequinsWon = snapshot.phase === 'mannequins-win';
    return {
      stage: 'finished',
      ...base,
      milestones,
      result: {
        outcome: mannequinsWon === (role === 'mannequin') ? 'won' : 'lost',
        reason: mannequinsWon
          ? snapshot.mistakes <= 0
            ? 'guard-mistakes'
            : 'escaped'
          : snapshot.caught >= 3
            ? 'all-caught'
            : 'time-up',
        score: snapshot.escaped,
      },
    };
  };
}
