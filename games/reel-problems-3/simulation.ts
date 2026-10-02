import { clamp } from '../../shared/math/clamp';
import {
  LANTERN_SOCKETS,
  SUPPLIES,
  idleInput,
  type AdventureEventKind,
  type AdventurePlayer,
  type AdventureSnapshot,
  type AdventureWorld,
} from './types';

const MOVE_SPEED = 0.0042;
const SPRINT_SPEED = 0.0062;
const WORLD_LIMIT = 17;

const freshStats = () => ({
  supplies: 0,
  beacons: 0,
  repairs: 0,
  rescues: 0,
  helmTurns: 0,
  lanterns: 0,
});

export function newPlayer(seat: number): AdventurePlayer {
  return {
    id: `crew-${seat}`,
    name: ['Milo', 'Lola', 'Nico', 'Pip'][seat] ?? `Crew ${seat + 1}`,
    color: seat,
    seat,
    bot: true,
    seen: 0,
    input: idleInput(),
    x: -1.5 + seat,
    z: 5,
    yaw: 0,
    overboard: false,
    stats: freshStats(),
  };
}

export function freshWorld(now: number): AdventureWorld {
  return {
    clock: now,
    started: 0,
    phaseAt: now,
    tick: 0,
    phase: 'lobby',
    players: [],
    loaded: [],
    beacons: [
      { id: 'cliff', aligned: 0, required: 3, active: false },
      { id: 'cave', aligned: 0, required: 3, active: false },
      { id: 'pines', aligned: 0, required: 3, active: false },
    ],
    beaconIndex: 0,
    routeProgress: 0,
    stormProgress: 0,
    hull: 100,
    water: 0,
    wave: 0,
    lanterns: [],
    toneIndex: 0,
    fishTrust: 0,
    events: [],
    nextEvent: 0,
  };
}

function event(
  world: AdventureWorld,
  kind: AdventureEventKind,
  actor?: string,
  detail?: string,
) {
  world.events.push({
    id: ++world.nextEvent,
    kind,
    at: world.clock,
    ...(actor ? { actor } : {}),
    ...(detail ? { detail } : {}),
  });
  if (world.events.length > 28)
    world.events.splice(0, world.events.length - 28);
}

function resetPositions(world: AdventureWorld) {
  world.players.forEach((player, index) => {
    player.x = -1.5 + index;
    player.z = world.phase === 'search' ? 8 : 5;
    player.yaw = 0;
    player.overboard = false;
    player.input = idleInput();
  });
}

function phase(world: AdventureWorld, next: AdventureWorld['phase']) {
  world.phase = next;
  world.phaseAt = world.clock;
  resetPositions(world);
}

export function startAdventure(world: AdventureWorld) {
  world.started = world.clock;
  world.loaded = [];
  world.beacons.forEach((beacon) => {
    beacon.aligned = 0;
    beacon.required = Math.max(2, Math.min(4, world.players.length + 1));
    beacon.active = false;
  });
  world.beaconIndex = 0;
  world.routeProgress = 0;
  world.stormProgress = 0;
  world.hull = 100;
  world.water = 0;
  world.wave = 0;
  world.lanterns = [];
  world.toneIndex = 0;
  world.fishTrust = 0;
  for (const player of world.players) player.stats = freshStats();
  phase(world, 'harbor');
  event(world, 'departed');
}

export function setInput(
  world: AdventureWorld,
  id: string,
  raw: Record<string, unknown>,
) {
  const player = world.players.find((candidate) => candidate.id === id);
  if (!player) return;
  const yaw =
    typeof raw.yaw === 'number' && Number.isFinite(raw.yaw)
      ? clamp(raw.yaw, -Math.PI * 8, Math.PI * 8)
      : player.yaw;
  player.input = {
    x: clamp(Number(raw.x) || 0, -1, 1),
    z: clamp(Number(raw.z) || 0, -1, 1),
    yaw,
    sprint: raw.sprint === true,
    seq: Number.isSafeInteger(raw.seq) ? Number(raw.seq) : 0,
  };
  player.yaw = yaw;
}

function movePlayers(world: AdventureWorld, delta: number) {
  if (world.phase === 'lobby' || world.phase === 'finished') return;
  for (const player of world.players) {
    if (player.bot || player.overboard) continue;
    const { x, z, yaw, sprint } = player.input;
    const length = Math.hypot(x, z);
    if (length < 0.05) continue;
    const nx = x / Math.max(1, length);
    const nz = z / Math.max(1, length);
    const speed = sprint ? SPRINT_SPEED : MOVE_SPEED;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    player.x = clamp(
      player.x + (nx * cos - nz * sin) * speed * delta,
      -WORLD_LIMIT,
      WORLD_LIMIT,
    );
    player.z = clamp(
      player.z + (-nz * cos - nx * sin) * speed * delta,
      -WORLD_LIMIT,
      WORLD_LIMIT,
    );
  }
}

export function advanceWorld(world: AdventureWorld, now: number) {
  const delta = Math.max(0, Math.min(100, now - world.clock));
  world.clock = now;
  world.tick++;
  movePlayers(world, delta);

  if (world.phase === 'storm') {
    world.water = clamp(world.water + delta * 0.0007, 0, 100);
    if (world.water >= 100) {
      world.water = 62;
      world.hull = Math.max(24, world.hull - 12);
      event(world, 'damage', undefined, 'The bilge overflowed');
    }
  }
  if (world.phase === 'homecoming' && world.clock - world.phaseAt >= 8_000) {
    phase(world, 'finished');
    event(world, 'home');
  }
}

function actor(world: AdventureWorld, id: string) {
  const player = world.players.find((candidate) => candidate.id === id);
  if (!player) throw new Error('That crew member is no longer aboard.');
  if (player.overboard)
    throw new Error('Grab the rescue line and wait for a friend.');
  return player;
}

function harborAction(world: AdventureWorld, id: string, target: string) {
  if (!target.startsWith('supply-'))
    throw new Error('Load the marked supplies.');
  const supply = target.slice(7);
  if (!SUPPLIES.includes(supply as (typeof SUPPLIES)[number]))
    throw new Error('That does not belong on the boat.');
  if (world.loaded.includes(supply)) return;
  world.loaded.push(supply);
  actor(world, id).stats.supplies++;
  event(world, 'supply', id, supply);
  if (world.loaded.length === SUPPLIES.length) phase(world, 'search');
}

function searchAction(world: AdventureWorld, id: string, target: string) {
  const beacon = world.beacons[world.beaconIndex];
  if (!beacon) return;
  if (!beacon.active) {
    if (target === 'beacon-crank') {
      beacon.aligned = Math.min(beacon.required, beacon.aligned + 1);
      if (beacon.aligned === beacon.required)
        event(world, 'beacon-aligned', id, beacon.id);
      return;
    }
    if (target === 'beacon-bell') {
      if (beacon.aligned < beacon.required)
        throw new Error('Align the beacon lens first.');
      beacon.active = true;
      actor(world, id).stats.beacons++;
      event(world, 'beacon-lit', id, beacon.id);
      return;
    }
    throw new Error('Find the crank and align this beacon.');
  }
  if (target !== 'helm')
    throw new Error('Return to the helm for the next island.');
  world.routeProgress++;
  actor(world, id).stats.helmTurns++;
  if (world.routeProgress < 3) return;
  world.routeProgress = 0;
  world.beaconIndex++;
  if (world.beaconIndex >= world.beacons.length) {
    phase(world, 'storm');
    event(world, 'fish-seen', id);
  } else {
    phase(world, 'search');
    event(world, 'island-reached', id, world.beacons[world.beaconIndex].id);
  }
}

function stormAction(world: AdventureWorld, id: string, target: string) {
  const player = actor(world, id);
  if (target === 'repair') {
    if (world.hull >= 98 && world.water < 8)
      throw new Error('The hull is holding. Stay on course.');
    world.hull = Math.min(100, world.hull + 24);
    world.water = Math.max(0, world.water - 30);
    player.stats.repairs++;
    event(world, 'repair', id);
    return;
  }
  if (target === 'rescue-rope') {
    const swimmer = world.players.find((candidate) => candidate.overboard);
    if (!swimmer) throw new Error('Everyone is aboard.');
    swimmer.overboard = false;
    swimmer.x = 0;
    swimmer.z = 4.5;
    player.stats.rescues++;
    event(world, 'rescue', id, swimmer.id);
    return;
  }
  if (target !== 'helm')
    throw new Error('Hold the wheel, patch the hull, or work the rescue line.');
  if (world.players.some((candidate) => candidate.overboard))
    throw new Error('A friend is overboard—throw the rescue line.');
  if (world.hull < 34 || world.water > 78)
    throw new Error(
      'The boat cannot take another wave. Repair and bail first.',
    );
  world.stormProgress++;
  world.wave++;
  player.stats.helmTurns++;
  event(world, 'wave', id, String(world.wave));
  if (world.stormProgress % 2 === 0) {
    world.hull = Math.max(0, world.hull - 21);
    world.water = Math.min(100, world.water + 18);
    event(world, 'damage', id, 'A wave split the gunwale');
  }
  if (world.players.length > 1 && world.stormProgress === 5) {
    const swimmer = world.players.find((candidate) => candidate.id !== id);
    if (swimmer) {
      swimmer.overboard = true;
      event(world, 'overboard', swimmer.id);
    }
  }
  if (world.stormProgress >= 9) {
    phase(world, 'sanctuary');
    event(world, 'sanctuary', id);
  }
}

function sanctuaryAction(world: AdventureWorld, id: string, target: string) {
  const socket = target.startsWith('lantern-') ? target.slice(8) : '';
  if (LANTERN_SOCKETS.includes(socket as (typeof LANTERN_SOCKETS)[number])) {
    if (!world.lanterns.includes(socket)) {
      world.lanterns.push(socket);
      world.fishTrust += 12;
      actor(world, id).stats.lanterns++;
      event(world, 'lantern', id, socket);
    }
    return;
  }
  if (world.lanterns.length < LANTERN_SOCKETS.length)
    throw new Error('Place all three guiding lanterns first.');
  if (!target.startsWith('tone-'))
    throw new Error('Sound the beacon tones in chart order.');
  const tone = Number(target.slice(5));
  if (tone !== world.toneIndex) {
    world.toneIndex = 0;
    throw new Error('The melody slipped away. Begin with the low cliff tone.');
  }
  world.toneIndex++;
  world.fishTrust += 21;
  event(world, 'tone', id, String(tone));
  if (world.toneIndex >= 3) {
    world.fishTrust = 100;
    phase(world, 'homecoming');
    event(world, 'fish-home', id);
  }
}

export function adventureAction(
  world: AdventureWorld,
  id: string,
  raw: Record<string, unknown>,
  isHost: boolean,
) {
  const type = String(raw.type);
  if (type === 'start') {
    if (!isHost) throw new Error('Only the crew leader can launch the voyage.');
    if (world.phase !== 'lobby' && world.phase !== 'finished')
      throw new Error('The voyage is already underway.');
    startAdventure(world);
    return;
  }
  if (type === 'restart') {
    if (!isHost)
      throw new Error('Only the crew leader can start another voyage.');
    startAdventure(world);
    return;
  }
  if (type !== 'interact') throw new Error('That action is not available.');
  const target = typeof raw.target === 'string' ? raw.target : '';
  if (world.phase === 'harbor') harborAction(world, id, target);
  else if (world.phase === 'search') searchAction(world, id, target);
  else if (world.phase === 'storm') stormAction(world, id, target);
  else if (world.phase === 'sanctuary') sanctuaryAction(world, id, target);
  else throw new Error('There is nothing to use here yet.');
}

export function replaceOwner(
  world: AdventureWorld,
  previous: string,
  next: string,
) {
  for (const eventItem of world.events)
    if (eventItem.actor === previous) eventItem.actor = next;
}

export function snapshot(
  world: AdventureWorld,
  code: string,
  host: string,
  selfId: string,
  version: number,
): AdventureSnapshot {
  return {
    code,
    host,
    selfId,
    version,
    world: structuredClone(world),
  };
}
