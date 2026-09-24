import { createEngine as flip } from '../../games/flip-happens/peer';
import { createEngine as castle } from '../../games/bouncy-castle-royale/peer';
import type { GameId } from '../../shared/audio/types';
import type { EngineCheckpoint } from '../../shared/peer/engine';
import { createEngine as stack } from '../../games/stack-or-sink/peer';
import { createEngine as farm } from '../../games/act-natural/peer';
import { createEngine as delivery } from '../../games/uphill-delivery/peer';
import { createEngine as giant } from '../../games/dont-wake-the-giant/peer';
import { createEngine as reel2 } from '../../games/reel-problems-2/peer';
import { createEngine as reel } from '../../games/reel-problems/peer';
import { createEngine as button } from '../../games/one-more-button/peer';
import { createEngine as hotel } from '../../games/wrong-floor/peer';
import { createEngine as breakfast } from '../../games/four-brain-cells/peer';
import { createEngine as demolition } from '../../games/load-bearing/peer';
import { createEngine as siege } from '../../games/siege-and-desist/peer';
import { createEngine as craneClash } from '../../games/crane-clash/peer';
import { createEngine as basketball } from '../../games/basketball/peer';
import { createEngine as bungeeDoubles } from '../../games/bungee-doubles/peer';
import { createEngine as panicCurling } from '../../games/panic-curling/peer';
import { createEngine as zorbClash } from '../../games/zorb-clash/peer';
import { createEngine as carryOnCarnage } from '../../games/carry-on-carnage/peer';
import { createEngine as sampleStampede } from '../../games/sample-stampede/peer';
import { createEngine as driveThru } from '../../games/drive-thru/peer';
import { createEngine as scaffoldScramble } from '../../games/scaffold-scramble/peer';
import { createEngine as chainOfFools } from '../../games/chain-of-fools/peer';
// Server-side and integration-test composition. Browser connections load only their own adapter.
import { createEngine as cage } from '../../games/cage-clash/peer';
import { createEngine as boxing } from '../../games/on-the-ropes/peer';
const engines = {
  'flip-happens': flip,
  'bouncy-castle-royale': castle,
  'cage-clash': cage,
  'on-the-ropes': boxing,
  'wrong-floor': hotel,
  'stack-or-sink': stack,
  'act-natural': farm,
  'uphill-delivery': delivery,
  'dont-wake-the-giant': giant,
  'reel-problems-2': reel2,
  'reel-problems': reel,
  'one-more-button': button,
  'four-brain-cells': breakfast,
  'load-bearing': demolition,
  'siege-and-desist': siege,
  'crane-clash': craneClash,
  basketball,
  'bungee-doubles': bungeeDoubles,
  'panic-curling': panicCurling,
  'zorb-clash': zorbClash,
  'carry-on-carnage': carryOnCarnage,
  'sample-stampede': sampleStampede,
  'drive-thru': driveThru,
  'scaffold-scramble': scaffoldScramble,
  'chain-of-fools': chainOfFools,
};
export function createPeerEngine(
  game: GameId,
  now: number,
  checkpoint?: EngineCheckpoint,
) {
  return engines[game](now, checkpoint);
}
