import type { GameId } from '../../shared/audio/types';
import type { EngineCheckpoint } from '../../shared/peer/engine';
import { createEngine as stack } from '../../games/stack-or-sink/peer';
import { createEngine as farm } from '../../games/act-natural/peer';
import { createEngine as delivery } from '../../games/uphill-delivery/peer';
import { createEngine as giant } from '../../games/dont-wake-the-giant/peer';
import { createEngine as reel } from '../../games/reel-problems/peer';
import { createEngine as button } from '../../games/one-more-button/peer';
import { createEngine as hotel } from '../../games/wrong-floor/peer';
import { createEngine as breakfast } from '../../games/four-brain-cells/peer';
import { createEngine as demolition } from '../../games/load-bearing/peer';
import { createEngine as siege } from '../../games/siege-and-desist/peer';
// Server-side and integration-test composition. Browser connections load only their own adapter.
const engines = {
  'wrong-floor': hotel,
  'stack-or-sink': stack,
  'act-natural': farm,
  'uphill-delivery': delivery,
  'dont-wake-the-giant': giant,
  'reel-problems': reel,
  'one-more-button': button,
  'four-brain-cells': breakfast,
  'load-bearing': demolition,
  'siege-and-desist': siege,
};
export function createPeerEngine(
  game: GameId,
  now: number,
  checkpoint?: EngineCheckpoint,
) {
  return engines[game](now, checkpoint);
}
