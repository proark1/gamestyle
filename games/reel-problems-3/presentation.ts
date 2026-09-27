import type { AdventurePhase, AdventureWorld } from './types';

export const PHASE_NAMES: Record<AdventurePhase, string> = {
  lobby: 'The crew gathers',
  harbor: 'Pack the boat',
  search: 'Follow the old beacons',
  storm: 'Stay with the light',
  sanctuary: 'Guide it home',
  homecoming: 'Dawn finds you',
  finished: 'Voyage complete',
};

export function objective(world: AdventureWorld) {
  if (world.phase === 'lobby') return 'Gather your crew and begin the voyage.';
  if (world.phase === 'harbor')
    return `Load rope, lanterns, timber and chart · ${world.loaded.length}/4 aboard`;
  if (world.phase === 'search') {
    const beacon = world.beacons[world.beaconIndex];
    if (!beacon) return 'Return to the helm.';
    if (!beacon.active)
      return beacon.aligned < beacon.required
        ? `Align the ${beacon.id} beacon lens · ${beacon.aligned}/${beacon.required}`
        : 'Ring the beacon bell.';
    return `Take the helm for the next island · ${world.routeProgress}/3`;
  }
  if (world.phase === 'storm') {
    if (world.players.some((player) => player.overboard))
      return 'Friend overboard—work the rescue line!';
    if (world.hull < 34 || world.water > 78)
      return 'Patch the hull and bail before the next wave.';
    return `Keep the glowing fish in sight · ${world.stormProgress}/9 waves`;
  }
  if (world.phase === 'sanctuary')
    return world.lanterns.length < 3
      ? `Place the guiding lanterns · ${world.lanterns.length}/3`
      : `Sound the beacon melody · ${world.toneIndex}/3 tones`;
  if (world.phase === 'homecoming') return 'Watch the sanctuary wake.';
  return 'The legendary fish is safe. Your crew made it home.';
}

export function promptFor(world: AdventureWorld, target: string | null) {
  if (!target) return 'Look around for a warm amber marker.';
  const prompts: Record<string, string> = {
    'supply-rope': 'E · Carry rope aboard',
    'supply-lanterns': 'E · Load the lantern crate',
    'supply-timber': 'E · Stow repair timber',
    'supply-chart': 'E · Take the hand-drawn chart',
    'beacon-crank': 'E · Turn the beacon crank',
    'beacon-bell': 'E · Ring the beacon bell',
    helm: 'E · Hold the wheel through the swell',
    repair: 'E · Patch and bail',
    'rescue-rope': 'E · Haul your friend aboard',
    'lantern-port': 'E · Set the port lantern',
    'lantern-bow': 'E · Set the bow lantern',
    'lantern-starboard': 'E · Set the starboard lantern',
    'tone-0': 'E · Sound the low cliff tone',
    'tone-1': 'E · Sound the clear cave tone',
    'tone-2': 'E · Sound the high pine tone',
  };
  return prompts[target] ?? 'E · Interact';
}

export function crewAwards(world: AdventureWorld) {
  const categories = [
    ['rescues', 'Lifeline', 'rescues'],
    ['repairs', 'Hull Whisperer', 'repairs'],
    ['helmTurns', 'Storm Tamer', 'turns at the helm'],
    ['beacons', 'Beacon Keeper', 'beacons awakened'],
  ] as const;
  return categories.flatMap(([key, title, label]) => {
    let best = world.players[0];
    for (const player of world.players)
      if ((player.stats[key] ?? 0) > (best?.stats[key] ?? 0)) best = player;
    const value = best?.stats[key] ?? 0;
    return best && value > 0
      ? [{ title, player: best.name, detail: `${value} ${label}` }]
      : [];
  });
}
