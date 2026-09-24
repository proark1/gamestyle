import { flipCatalog } from '../../games/flip-happens/catalog';
import { castleCatalog } from '../../games/bouncy-castle-royale/catalog';
import type { Cue, GameId } from '../../shared/audio/types';
import { stackCatalog } from '../../games/stack-or-sink/audio/catalog';
import { farmCatalog } from '../../games/act-natural/audio/catalog';
import { deliveryCatalog } from '../../games/uphill-delivery/audio/catalog';
import { giantCatalog } from '../../games/dont-wake-the-giant/audio/catalog';
import { reelCatalog as reel2Catalog } from '../../games/reel-problems-2/audio';
import { reelCatalog } from '../../games/reel-problems/audio';
import { hotelCatalog } from '../../games/wrong-floor/audio';
import { buttonCatalog } from '../../games/one-more-button/audio';
import { breakfastCatalog } from '../../games/four-brain-cells/audio';
import { loadBearingCatalog } from '../../games/load-bearing/audio';
import { siegeCatalog } from '../../games/siege-and-desist/audio';
import { craneClashCatalog } from '../../games/crane-clash/audio';
import { basketballCatalog } from '../../games/basketball/audio';
import { bungeeDoublesCatalog } from '../../games/bungee-doubles/audio';
import { panicCurlingCatalog } from '../../games/panic-curling/audio';
import { zorbClashCatalog } from '../../games/zorb-clash/audio';
import { carryOnCarnageCatalog } from '../../games/carry-on-carnage/audio';
import { sampleStampedeCatalog } from '../../games/sample-stampede/audio';
import { driveThruCatalog } from '../../games/drive-thru/audio';
import { scaffoldScrambleCatalog } from '../../games/scaffold-scramble/audio';
import { chainOfFoolsCatalog } from '../../games/chain-of-fools/audio';

import {
  cageBundledCatalog,
  cageCatalog,
} from '../../games/cage-clash/audio/catalog';
import { boxingCatalog } from '../../games/on-the-ropes/audio';

const catalogs: Record<GameId, Cue[]> = {
  'flip-happens': flipCatalog,
  'bouncy-castle-royale': castleCatalog,
  'cage-clash': cageCatalog,
  'on-the-ropes': boxingCatalog,
  'wrong-floor': hotelCatalog,
  'stack-or-sink': stackCatalog,
  'act-natural': farmCatalog,
  'uphill-delivery': deliveryCatalog,
  'dont-wake-the-giant': giantCatalog,
  'reel-problems-2': reel2Catalog,
  'reel-problems': reelCatalog,
  'one-more-button': buttonCatalog,
  'four-brain-cells': breakfastCatalog,
  'load-bearing': loadBearingCatalog,
  'siege-and-desist': siegeCatalog,
  'crane-clash': craneClashCatalog,
  basketball: basketballCatalog,
  'bungee-doubles': bungeeDoublesCatalog,
  'panic-curling': panicCurlingCatalog,
  'zorb-clash': zorbClashCatalog,
  'carry-on-carnage': carryOnCarnageCatalog,
  'sample-stampede': sampleStampedeCatalog,
  'drive-thru': driveThruCatalog,
  'scaffold-scramble': scaffoldScrambleCatalog,
  'chain-of-fools': chainOfFoolsCatalog,
};

export function getCatalog(game: GameId): Cue[] {
  return catalogs[game];
}

export function getBundledCatalog(game: GameId): Cue[] {
  return game === 'cage-clash' ? cageBundledCatalog : getCatalog(game);
}
