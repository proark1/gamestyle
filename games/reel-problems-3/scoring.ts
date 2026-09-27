import { FISH_DEFINITIONS } from './content/fish';
import type { AdventurePlayer, AdventureWorld, FishSpecies } from './types';

export function scoreCatch(
  player: AdventurePlayer,
  species: FishSpecies,
  weight: number,
) {
  const definition = FISH_DEFINITIONS[species];
  const value = Math.round(definition.score + weight * 8);
  player.stats.score += value;
  player.stats.catches++;
  player.stats.catchWeight += weight;
  if (definition.rare) player.stats.rareCatches++;
  return value;
}

export function penalize(player: AdventurePlayer, amount: number) {
  player.stats.score = Math.max(0, player.stats.score - Math.max(0, amount));
}

export function safeReturnBonus(world: AdventureWorld) {
  for (const player of world.players)
    player.stats.score += player.bot ? 50 : 100;
}

export function awards(world: AdventureWorld) {
  const categories = [
    ['catchWeight', 'Biggest Catch'],
    ['tangles', 'Line Tangler'],
    ['repairs', 'Deck Medic'],
    ['helmTime', 'Storm Driver'],
    ['overboardMs', 'Most Time Overboard'],
    ['rescues', 'Lifeline'],
  ] as const;
  return categories.flatMap(([key, title]) => {
    let winner: AdventurePlayer | undefined;
    for (const player of world.players)
      if (!winner || player.stats[key] > winner.stats[key]) winner = player;
    return winner && winner.stats[key] > 0
      ? [{ title, player: winner.name, value: winner.stats[key] }]
      : [];
  });
}
