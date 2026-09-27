import { FISH_DEFINITIONS, FISH_SPECIES } from './content/fish';
import { MISSION_DEFINITIONS, MISSION_KINDS } from './content/missions';
import { emit } from './events';
import { nextRandom, shuffleSeeded } from './random';
import type {
  AdventureWorld,
  FishSpecies,
  MissionKind,
  MissionState,
} from './types';

function speciesFor(kind: MissionKind, state: number) {
  const eligible = FISH_SPECIES.filter((species) => {
    const fish = FISH_DEFINITIONS[species];
    const required = MISSION_DEFINITIONS[kind].requires;
    return (
      required === 'any' ||
      (required === 'school' && fish.school) ||
      (required === 'rare' && species === 'lantern-eel') ||
      (required === 'large' && fish.needsNet) ||
      (required === 'fragile' && fish.fragile)
    );
  });
  const random = nextRandom(state);
  return {
    state: random.state,
    species:
      eligible[Math.floor(random.value * eligible.length)] ?? 'silver-sprat',
  };
}

export function generateMissions(seed: number) {
  const shuffled = shuffleSeeded(seed, MISSION_KINDS);
  let state = shuffled.state;
  const missions: MissionState[] = [];
  for (let index = 0; index < 3; index++) {
    const kind = shuffled.values[index];
    const speciesPick = speciesFor(kind, state);
    state = speciesPick.state;
    const angle = -0.55 + index * 0.58;
    const radius = 42 + index * 34;
    const definition = MISSION_DEFINITIONS[kind];
    missions.push({
      id: `mission-${index}-${kind}`,
      kind,
      label:
        kind === 'weight-quota'
          ? `${definition.name} · ${definition.baseGoal} kg`
          : `${definition.name} · ${FISH_DEFINITIONS[speciesPick.species].name}`,
      species: speciesPick.species,
      goal: definition.baseGoal,
      progress: 0,
      zoneX: Math.sin(angle) * radius,
      zoneZ: Math.cos(angle) * radius,
      radius: kind === 'moving-school' ? 18 : 15,
      complete: false,
    });
  }
  return { missions, state };
}

export function currentMission(world: AdventureWorld) {
  return world.missions[world.activeMission];
}

export function insideMissionZone(
  world: AdventureWorld,
  mission = currentMission(world),
) {
  return (
    !!mission &&
    Math.hypot(world.boat.x - mission.zoneX, world.boat.z - mission.zoneZ) <=
      mission.radius
  );
}

export function recordSecuredFish(
  world: AdventureWorld,
  actor: string,
  species: FishSpecies,
  weight: number,
) {
  const mission = currentMission(world);
  if (!mission || mission.complete) return;
  const fish = FISH_DEFINITIONS[species];
  const matches =
    mission.kind === 'weight-quota' ||
    (mission.kind === 'rare-fish' && fish.rare) ||
    (mission.kind === 'team-fish' && fish.needsNet) ||
    (mission.kind === 'fragile-catch' && fish.fragile) ||
    (mission.kind === 'moving-school' && fish.school) ||
    species === mission.species;
  if (!matches) return;
  mission.progress += mission.kind === 'weight-quota' ? weight : 1;
  if (mission.progress < mission.goal) return;
  mission.progress = mission.goal;
  mission.complete = true;
  emit(world, 'mission-complete', actor, mission.id, {
    x: mission.zoneX,
    z: mission.zoneZ,
  });
  world.activeMission++;
  if (world.activeMission >= world.missions.length) {
    world.phase = world.round.phase = 'returning';
    world.round.returnEndsAt = Math.min(
      world.round.roundEndsAt,
      world.clock + 120_000,
    );
    emit(world, 'return-started', actor, 'Bring the catch home.');
  }
}
