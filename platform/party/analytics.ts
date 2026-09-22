import type { GameAnalytics } from '../../shared/analytics/protocol';
import { PARTY_GAMES } from './playlist';

export const partyAnalytics: GameAnalytics = {
  game: 'party',
  milestones: [
    { key: 'briefing', label: 'Reached the first briefing' },
    { key: 'first-game', label: 'Connected to the first game' },
    { key: 'voted', label: 'Voted for a game' },
    { key: 'party-complete', label: 'Completed the party' },
  ],
  labels: {
    playing: 'Started the party',
    finished: 'Finished the party',
    again: 'Started another party',
  },
  actions: {
    vote: 'Cast or changed a vote',
    'missed-vote': 'Missed a voting window',
    'rematch-interest': 'Wanted another party',
    help: 'Opened the round briefing again',
    rejoin: 'Retried joining a game',
    break: 'Took a crew break',
    ...Object.fromEntries(
      PARTY_GAMES.map((g) => [`forfeit-${g.id}`, `Gave up ${g.name}`]),
    ),
  },
  reasons: { completed: 'All rounds finished' },
};
