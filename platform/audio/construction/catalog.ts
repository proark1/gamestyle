import type { GameId } from '../../../shared/audio/construction/types';
import { getCatalog as chaosCatalog } from '../../../games/chaos/audio/catalog';
import { getCatalog as firstPersonCatalog } from '../../../games/first-person/audio/catalog';
export function getCatalog(game: GameId) {
  return game === 'chaos' ? chaosCatalog() : firstPersonCatalog();
}
