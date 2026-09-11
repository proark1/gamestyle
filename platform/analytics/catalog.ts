import type { GameAnalytics } from '../../shared/analytics/protocol';
import { farmAnalytics } from '../../games/act-natural/analytics';
import { chaosAnalytics } from '../../games/chaos/analytics';
import { giantAnalytics } from '../../games/dont-wake-the-giant/analytics';
import { siteAnalytics } from '../../games/first-person/analytics';
import { breakfastAnalytics } from '../../games/four-brain-cells/analytics';
import { loadBearingAnalytics } from '../../games/load-bearing/analytics';
import { buttonAnalytics } from '../../games/one-more-button/analytics';
import { reelAnalytics } from '../../games/reel-problems/analytics';
import { shelfAnalytics } from '../../games/shelf-control/analytics';
import { siegeAnalytics } from '../../games/siege-and-desist/analytics';
import { stackAnalytics } from '../../games/stack-or-sink/analytics';
import { deliveryAnalytics } from '../../games/uphill-delivery/analytics';
import { hotelAnalytics } from '../../games/wrong-floor/analytics';

export type CatalogGame = {
  id: string;
  name: string;
  href: string;
  analytics: GameAnalytics;
  /** The workshop that edits this game's sounds. */
  workshop: {
    kind: 'standard' | 'construction';
    game: string;
    href: string;
  };
  /** Set when the game borrows another game's recordings. */
  soundNote?: string;
};

// Each game's analytics module holds plain definitions and type-only imports,
// so this list stays light enough for the admin page and the report route.
export const GAMES: readonly CatalogGame[] = [
  ['siege-and-desist', 'Siege and Desist', siegeAnalytics],
  ['stack-or-sink', 'Stack or Sink', stackAnalytics],
  ['act-natural', 'Blend Business', farmAnalytics],
  ['uphill-delivery', 'Uphill Delivery', deliveryAnalytics],
  ['dont-wake-the-giant', 'Tiptoe Thieves', giantAnalytics],
  ['chaos', 'Permit Pending', chaosAnalytics],
  ['first-person', 'Brick by Hand', siteAnalytics],
  ['wrong-floor', 'Wrong Floor', hotelAnalytics],
  ['one-more-button', 'One More Button', buttonAnalytics],
  ['four-brain-cells', 'Four Brain Cells', breakfastAnalytics],
  ['reel-problems', 'Reel Problems', reelAnalytics],
  ['shelf-control', 'Shelf Control', shelfAnalytics],
  ['load-bearing', 'Load Bearing', loadBearingAnalytics],
].map(([id, name, analytics]) => {
  const game = id as string;
  const construction = game === 'chaos' || game === 'first-person';
  // Shelf Control plays the farm's material clips through its own mapping.
  const workshopGame = game === 'shelf-control' ? 'act-natural' : game;
  return {
    id: game,
    name: name as string,
    href: `/${game}`,
    analytics: analytics as GameAnalytics,
    workshop: {
      kind: construction ? 'construction' : 'standard',
      game: workshopGame,
      href: `/${workshopGame}/admin`,
    },
    ...(game === 'shelf-control'
      ? { soundNote: 'Plays the Blend Business material sounds.' }
      : {}),
  };
});

export const ANALYTICS_GAMES = GAMES.map((game) => game.analytics);

export function catalogGame(id: string): CatalogGame | undefined {
  return GAMES.find((game) => game.id === id);
}

export function analyticsGame(id: string): GameAnalytics | undefined {
  return catalogGame(id)?.analytics;
}
