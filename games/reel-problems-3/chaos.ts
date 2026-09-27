import { CHAOS_DEFINITIONS, INCIDENT_KINDS } from './content/chaos';
import { emit } from './events';
import { nextRandom } from './random';
import type { AdventureWorld, ChaosIncident, IncidentKind } from './types';

function eligible(world: AdventureWorld, kind: IncidentKind) {
  const definition = CHAOS_DEFINITIONS[kind];
  if (
    !definition.phases.includes(
      world.phase as 'outbound' | 'fishing' | 'returning',
    )
  )
    return false;
  if (
    world.incidents.some(
      (incident) =>
        !incident.resolved && incident.severity === definition.severity,
    )
  )
    return false;
  if (
    definition.requires === 'lines' &&
    !world.players.some((player) => player.line)
  )
    return false;
  if (
    definition.requires === 'catch' &&
    !world.items.some((item) => item.kind === 'fish' && item.state === 'loose')
  )
    return false;
  if (definition.requires === 'net' && world.boat.netTorn) return false;
  return true;
}

export function startIncident(world: AdventureWorld, kind: IncidentKind) {
  if (!eligible(world, kind)) return null;
  const definition = CHAOS_DEFINITIONS[kind];
  const incident: ChaosIncident = {
    id: ++world.incidentId,
    kind,
    severity: definition.severity,
    startedAt: world.clock,
    endsAt: world.clock + definition.durationMs,
    resolved: false,
  };
  world.incidents.push(incident);
  if (kind === 'deck-wave') {
    for (const item of world.items)
      if (item.state === 'loose' && item.space === 'boat') {
        item.vx += item.x < 0 ? -4 : 4;
        item.vz += 1.5;
      }
    const exposed = world.players.find(
      (player) => !player.input.brace && !player.station && !player.overboard,
    );
    if (exposed && Math.abs(exposed.x) > 2.1) {
      exposed.space = 'world';
      exposed.overboard = true;
      exposed.x = world.boat.x + (exposed.x < 0 ? -4.5 : 4.5);
      exposed.z = world.boat.z;
    }
  } else if (kind === 'line-tangle') {
    const anglers = world.players.filter((player) => player.line).slice(0, 2);
    if (anglers.length === 2) {
      anglers[0].line!.state = anglers[1].line!.state = 'tangled';
      anglers[0].line!.tangledWith = anglers[1].id;
      anglers[1].line!.tangledWith = anglers[0].id;
      anglers[0].stats.tangles++;
      anglers[1].stats.tangles++;
      incident.target = anglers.map((player) => player.id).join(',');
      emit(world, 'tangled', anglers[0].id, anglers[1].id);
    }
  } else if (kind === 'fish-pull') {
    const angler = world.players.find((player) => player.line?.fishId);
    if (angler) {
      angler.x = Math.max(
        -3,
        Math.min(3, angler.x + (angler.x < 0 ? -0.9 : 0.9)),
      );
      incident.target = angler.id;
    }
  } else if (kind === 'seabirds') {
    const catchItem = world.items.find(
      (item) => item.kind === 'fish' && item.state === 'loose',
    );
    const bait = world.items.find((item) => item.kind === 'bait-bucket');
    if (catchItem) {
      catchItem.state = 'submerged';
      catchItem.recoverAt = undefined;
      incident.target = catchItem.id;
    } else if (bait) bait.contents = Math.max(0, (bait.contents ?? 0) - 2);
  } else if (kind === 'engine-stall') world.boat.engine = 'stalled';
  else if (kind === 'hull-leak')
    world.boat.water = Math.max(18, world.boat.water);
  else if (kind === 'fog-bank') world.fogUntil = incident.endsAt;
  else if (kind === 'debris-field') {
    world.boat.hull = Math.max(0, world.boat.hull - 9);
    world.boat.speed *= 0.65;
  } else if (kind === 'fish-escape') {
    const fishItem = world.items.find(
      (item) => item.kind === 'fish' && item.state === 'loose',
    );
    if (fishItem) {
      fishItem.state = 'floating';
      fishItem.space = 'world';
      fishItem.x = world.boat.x + 4;
      fishItem.z = world.boat.z;
      incident.target = fishItem.id;
    }
  } else if (kind === 'torn-net') world.boat.netTorn = true;
  emit(world, 'incident-started', undefined, kind);
  return incident;
}

export function resolveIncident(
  world: AdventureWorld,
  kind: IncidentKind,
  actor?: string,
) {
  const incident = world.incidents.find(
    (candidate) => candidate.kind === kind && !candidate.resolved,
  );
  if (!incident) return;
  incident.resolved = true;
  incident.endsAt = world.clock;
  emit(world, 'incident-resolved', actor, kind);
}

export function stepChaos(world: AdventureWorld, dt: number) {
  if (world.boat.water > 0) {
    const leaking = world.incidents.some(
      (incident) => incident.kind === 'hull-leak' && !incident.resolved,
    );
    if (leaking) world.boat.water = Math.min(100, world.boat.water + dt * 1.8);
    if (world.boat.water >= 100) {
      world.boat.water = 65;
      world.boat.hull = Math.max(0, world.boat.hull - 18);
      emit(world, 'damage', undefined, 'The bilge overflowed.');
    }
  }
  for (const incident of world.incidents) {
    if (incident.resolved || world.clock < incident.endsAt) continue;
    incident.resolved = true;
    if (incident.kind === 'engine-stall') {
      world.boat.hull = Math.max(0, world.boat.hull - 4);
      world.boat.engine = 'running';
    }
    if (incident.kind === 'hull-leak')
      world.boat.hull = Math.max(0, world.boat.hull - 8);
    emit(world, 'incident-resolved', undefined, `${incident.kind}:timeout`);
  }
  world.incidents = world.incidents.filter(
    (incident) => !incident.resolved || world.clock - incident.endsAt < 5000,
  );
  if (
    !['outbound', 'fishing', 'returning'].includes(world.phase) ||
    world.clock < world.nextIncidentAt
  )
    return;
  const candidates = INCIDENT_KINDS.filter((kind) => eligible(world, kind));
  if (candidates.length) {
    const random = nextRandom(world.randomState);
    world.randomState = random.state;
    startIncident(
      world,
      candidates[Math.floor(random.value * candidates.length)],
    );
  }
  const delay = nextRandom(world.randomState);
  world.randomState = delay.state;
  world.nextIncidentAt = world.clock + 15_000 + delay.value * 11_000;
}
