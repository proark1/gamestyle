import { ITEM_DEFINITIONS } from './content/items';
import { awards } from './scoring';
import type { AdventureWorld, RoundPhase } from './types';

export const PHASE_NAMES: Record<RoundPhase, string> = {
  lobby: 'Crew call',
  preparing: 'Load the boat',
  outbound: 'Run to the grounds',
  fishing: 'Lines in',
  returning: 'Race the harbor bell',
  docking: 'Bring her alongside',
  finished: 'Catch delivered',
  failed: 'Round lost',
};

export function objective(world: AdventureWorld) {
  if (world.phase === 'lobby')
    return 'Build a crew. Empty seats are filled by deckhand bots.';
  if (world.phase === 'preparing') {
    const loaded = world.items.filter(
      (item) => item.station && ITEM_DEFINITIONS[item.kind].essential,
    ).length;
    return `Load rods, bait, safety gear and the ice box · ${Math.min(10, loaded)}/10 ready`;
  }
  if (world.phase === 'outbound')
    return 'Follow the chart marker to the first fishing ground.';
  if (world.phase === 'fishing') {
    const mission = world.missions[world.activeMission];
    return mission
      ? `${mission.label} · ${Math.floor(mission.progress)}/${mission.goal}`
      : 'Secure the catch.';
  }
  if (world.phase === 'returning')
    return 'All missions complete—race the catch back to harbor.';
  if (world.phase === 'docking')
    return 'Slow below 1.7 knots and dock inside the harbor markers.';
  if (world.phase === 'failed')
    return world.round.result === 'sunk'
      ? 'The boat went down.'
      : 'The harbor bell beat you.';
  return 'Catch landed. Scores and crew awards are ready.';
}

export function promptFor(world: AdventureWorld, target: string | null) {
  if (!target)
    return world.phase === 'fishing'
      ? 'Click to cast · hold R to reel'
      : 'Look at an object to interact';
  if (target === 'depart') return 'E · Cast off';
  if (target.startsWith('station:')) {
    const name = target.slice(8).replaceAll('-', ' ');
    if (world.phase === 'docking' && name === 'helm')
      return 'E · Secure the boat at the dock';
    return `E · Use ${name}`;
  }
  const item = world.items.find((candidate) => candidate.id === target);
  return item
    ? `E · Pick up ${ITEM_DEFINITIONS[item.kind].name}`
    : 'E · Interact';
}

export function crewAwards(world: AdventureWorld) {
  return awards(world).map((award) => ({
    title: award.title,
    player: award.player,
    detail: String(award.value),
  }));
}
