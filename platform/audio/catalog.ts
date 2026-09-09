import type { Cue, GameId } from '../../shared/audio/types';
import { stackCatalog } from '../../games/stack-or-sink/audio/catalog';
import { farmCatalog } from '../../games/act-natural/audio/catalog';
import { deliveryCatalog } from '../../games/uphill-delivery/audio/catalog';
import { giantCatalog } from '../../games/dont-wake-the-giant/audio/catalog';
import { reelCatalog } from '../../games/reel-problems/audio';
import { hotelCatalog } from '../../games/wrong-floor/audio';
import { buttonCatalog } from '../../games/one-more-button/audio';
import { breakfastCatalog } from '../../games/four-brain-cells/audio';
import { loadBearingCatalog } from '../../games/load-bearing/audio';
const catalogs: Record<GameId, Cue[]> = {
  'wrong-floor': hotelCatalog,
  'stack-or-sink': stackCatalog,
  'act-natural': farmCatalog,
  'uphill-delivery': deliveryCatalog,
  'dont-wake-the-giant': giantCatalog,
  'reel-problems': reelCatalog,
  'one-more-button': buttonCatalog,
  'four-brain-cells': breakfastCatalog,
  'load-bearing': loadBearingCatalog,
};
export function getCatalog(game: GameId): Cue[] {
  return catalogs[game];
}
