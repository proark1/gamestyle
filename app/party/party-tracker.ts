import { GameTracker } from '@/shared/analytics/game-tracker';
import { partyAnalytics } from '@/platform/party/analytics';

// Uses the existing anonymous, in-memory visit tracker; no names or raw room codes.
export const partyTracker = new GameTracker(partyAnalytics);
