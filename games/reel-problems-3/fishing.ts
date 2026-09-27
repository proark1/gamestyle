import { FISH_DEFINITIONS, FISH_SPECIES } from './content/fish';
import { toBoatSpace, toWorldSpace } from './boat';
import { emit } from './events';
import { createFishItem } from './items';
import { currentMission, insideMissionZone } from './missions';
import { nextRandom } from './random';
import type {
  AdventurePlayer,
  AdventureWorld,
  FishSpecies,
  FishState,
} from './types';

function heldRod(world: AdventureWorld, player: AdventurePlayer) {
  return player.held.some(
    (id) => world.items.find((item) => item.id === id)?.kind === 'rod',
  );
}

function bait(world: AdventureWorld) {
  return world.items.find(
    (item) => item.kind === 'bait-bucket' && (item.contents ?? 0) > 0,
  );
}

function weightFor(world: AdventureWorld, species: FishSpecies) {
  const definition = FISH_DEFINITIONS[species];
  const random = nextRandom(world.randomState);
  world.randomState = random.state;
  return (
    definition.minWeight +
    random.value * (definition.maxWeight - definition.minWeight)
  );
}

export function ensureMissionFish(world: AdventureWorld) {
  const mission = currentMission(world);
  if (!mission || mission.complete || !insideMissionZone(world, mission))
    return;
  const live = world.fish.filter(
    (fish) => fish.zoneId === mission.id && fish.state !== 'secured',
  );
  if (live.length >= 8) return;
  const count = 10 - live.length;
  for (let index = 0; index < count; index++) {
    let random = nextRandom(world.randomState);
    world.randomState = random.state;
    const angle = random.value * Math.PI * 2;
    random = nextRandom(world.randomState);
    world.randomState = random.state;
    const radius = 3 + random.value * Math.max(4, mission.radius - 3);
    const species =
      index < 6 && mission.species
        ? mission.species
        : FISH_SPECIES[Math.floor(random.value * FISH_SPECIES.length)];
    world.fish.push({
      id: `${mission.id}-fish-${world.fish.length}-${index}`,
      species,
      x: mission.zoneX + Math.sin(angle) * radius,
      z: mission.zoneZ + Math.cos(angle) * radius,
      vx: 0,
      vz: 0,
      weight: weightFor(world, species),
      stamina: FISH_DEFINITIONS[species].stamina,
      state: 'swimming',
      hookedBy: [],
      zoneId: mission.id,
      respawnAt: 0,
    });
  }
}

export function castLine(
  world: AdventureWorld,
  player: AdventurePlayer,
  power = 0.65,
) {
  if (!heldRod(world, player)) throw new Error('Pick up a fishing rod first.');
  if (player.line) throw new Error('Your line is already in the water.');
  const baitBucket = bait(world);
  if (!baitBucket) throw new Error('The bait bucket is empty.');
  if (!insideMissionZone(world))
    throw new Error('Steer into the marked fishing ground.');
  baitBucket.contents = Math.max(0, (baitBucket.contents ?? 0) - 1);
  const origin = toWorldSpace(world, player);
  const yaw = world.boat.yaw + player.yaw;
  const length = 8 + Math.max(0, Math.min(1, power)) * 13;
  player.line = {
    state: 'casting',
    x: origin.x + Math.sin(yaw) * length,
    z: origin.z + Math.cos(yaw) * length,
    length,
    tension: 0,
    strain: 0,
    biteAt: world.clock + 1400 + player.seat * 260,
  };
  player.stats.casts++;
  emit(world, 'cast', player.id, undefined, {
    x: player.line.x,
    z: player.line.z,
  });
}

export function hookLine(world: AdventureWorld, player: AdventurePlayer) {
  const line = player.line;
  if (!line || line.state !== 'biting')
    throw new Error('Wait for the rod tip to dip before you hook.');
  const fish = world.fish
    .filter((candidate) => candidate.state === 'swimming')
    .map((candidate) => ({
      fish: candidate,
      distance: Math.hypot(candidate.x - line.x, candidate.z - line.z),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.fish;
  if (!fish) {
    player.line = null;
    throw new Error('The fish slipped away. Cast again.');
  }
  line.state = 'hooked';
  line.fishId = fish.id;
  line.biteUntil = undefined;
  fish.state = 'hooked';
  fish.hookedBy.push(player.id);
  emit(world, 'hooked', player.id, fish.species, { x: fish.x, z: fish.z });
}

export function untangleLine(world: AdventureWorld, player: AdventurePlayer) {
  if (!player.line || player.line.state !== 'tangled')
    throw new Error('Your line is clear.');
  const other = world.players.find(
    (candidate) => candidate.id === player.line?.tangledWith,
  );
  if (other?.line) {
    other.line.state = other.line.fishId ? 'hooked' : 'waiting';
    other.line.tangledWith = undefined;
  }
  player.line.state = player.line.fishId ? 'hooked' : 'waiting';
  player.line.tangledWith = undefined;
  emit(world, 'untangled', player.id);
}

function landFish(
  world: AdventureWorld,
  player: AdventurePlayer,
  fish: FishState,
) {
  const definition = FISH_DEFINITIONS[fish.species];
  if (
    definition.needsNet &&
    !world.players.some(
      (candidate) =>
        candidate.id !== player.id &&
        (candidate.station === 'net-rack' ||
          candidate.held.some(
            (id) =>
              world.items.find((item) => item.id === id)?.kind ===
              'landing-net',
          )),
    )
  )
    return false;
  if (definition.needsNet) {
    const helper = world.players.find(
      (candidate) =>
        candidate.id !== player.id && candidate.station === 'net-rack',
    );
    if (helper) {
      helper.stats.netAssists++;
      helper.stats.score += 45;
    }
  }
  fish.state = 'landed';
  const local = toBoatSpace(world, fish);
  createFishItem(world, fish.species, fish.weight, {
    x: Math.max(-2.4, Math.min(2.4, local.x)),
    z: Math.max(-3.1, Math.min(3.1, local.z)),
  });
  player.line = null;
  emit(world, 'fish-landed', player.id, fish.species, { x: fish.x, z: fish.z });
  return true;
}

export function stepFishing(world: AdventureWorld, dt: number) {
  ensureMissionFish(world);
  const mission = currentMission(world);
  for (const fish of world.fish) {
    if (fish.state !== 'swimming' && fish.state !== 'hooked') continue;
    const definition = FISH_DEFINITIONS[fish.species];
    const phase = world.clock / (820 + definition.pull * 340) + fish.weight;
    const speed = definition.school ? 1.4 : 0.85;
    fish.vx = Math.sin(phase * 1.7) * speed;
    fish.vz = Math.cos(phase * 1.25) * speed;
    fish.x += fish.vx * dt;
    fish.z += fish.vz * dt;
    if (mission) {
      const gap = Math.hypot(fish.x - mission.zoneX, fish.z - mission.zoneZ);
      if (gap > mission.radius) {
        fish.x += ((mission.zoneX - fish.x) / gap) * dt * 2;
        fish.z += ((mission.zoneZ - fish.z) / gap) * dt * 2;
      }
    }
  }
  for (const player of world.players) {
    const line = player.line;
    if (!line) continue;
    if (line.state === 'casting') line.state = 'waiting';
    if (line.state === 'waiting' && line.biteAt && world.clock >= line.biteAt) {
      line.state = 'biting';
      line.biteUntil = world.clock + 1550;
      emit(world, 'bite', player.id);
    }
    if (
      line.state === 'biting' &&
      line.biteUntil &&
      world.clock > line.biteUntil
    ) {
      player.line = null;
      continue;
    }
    if (line.state !== 'hooked' || !line.fishId) continue;
    const fish = world.fish.find((candidate) => candidate.id === line.fishId);
    if (!fish) {
      player.line = null;
      continue;
    }
    const definition = FISH_DEFINITIONS[fish.species];
    const origin = toWorldSpace(world, player);
    const dx = fish.x - origin.x;
    const dz = fish.z - origin.z;
    const distance = Math.max(0.1, Math.hypot(dx, dz));
    if (player.input.reel) line.length = Math.max(2.8, line.length - dt * 3.4);
    else line.length = Math.min(26, line.length + dt * 0.85);
    line.tension = Math.max(
      0,
      Math.min(
        1.35,
        distance / Math.max(1, line.length) + definition.pull * 0.16,
      ),
    );
    if (player.input.reel && line.tension <= definition.safeTension) {
      fish.stamina = Math.max(
        0,
        fish.stamina -
          dt * (10 + (1 - line.tension) * 9) * (player.bot ? 1.65 : 1),
      );
      fish.x -=
        (dx / distance) *
        dt *
        (1.6 + (1 - fish.stamina / definition.stamina) * 2.2);
      fish.z -=
        (dz / distance) *
        dt *
        (1.6 + (1 - fish.stamina / definition.stamina) * 2.2);
    }
    line.strain = Math.max(
      0,
      line.strain +
        dt *
          (line.tension > definition.safeTension + (player.bot ? 0.14 : 0)
            ? 1.25
            : -1.7),
    );
    line.x = fish.x;
    line.z = fish.z;
    if (line.strain >= 1) {
      fish.state = 'swimming';
      fish.hookedBy = fish.hookedBy.filter((id) => id !== player.id);
      player.line = null;
      player.stats.score = Math.max(0, player.stats.score - 15);
      emit(world, 'line-snapped', player.id, fish.species);
      continue;
    }
    if (fish.stamina <= 0 && distance <= 4.2) landFish(world, player, fish);
  }
}
