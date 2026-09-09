import { actorLevel, validLevel } from './levels';
import { carryPlacement } from './carry-placement';
import { removalSupportError } from './structure';
import { restoreBuild, type BuildSnapshot } from './build-snapshot';
import { swapEditError } from './swap';
import { setDaily } from './daily';
import { configureInspection, markMoment } from './inspection';
import { mapBounds, onFoundation, type MapId } from './maps';
import {
  craneAction,
  tickCrane,
  cancelCrane,
  roofSupplies,
  type CraneState,
  type CraneAction,
} from './crane';
import { buildReach, inReach, siteProps } from './colliders';
import {
  placementError,
  playerBlocksPlacement,
  snapPlacement,
} from './placement';
export { placementError } from './placement';
import { advancePhysics, throwState } from './physics';
import {
  enableParty,
  missionAction,
  partyAction,
  partyLocked,
  tickParty,
  type Party,
  type PartyPrivate,
  type PartyAction,
  type Mission,
} from './party';
export const PLAYER_COLORS = ['#ffba32', '#62c9c9', '#e97897', '#a2a0e3'];
import { CATALOG, SAYINGS } from './catalog';
import { PROP_USES } from './house-props';
import { validateAppearance, type Appearance } from './appearance';
export { CATALOG, SAYINGS } from './catalog';
export type ItemKind = (typeof CATALOG)[number]['id'];
export type Mode = 'sandbox' | 'job';
export type Vec = { x: number; z: number; level?: number; y?: number };
export type Player = Vec & {
  id: string;
  name: string;
  color: number;
  angle: number;
  seen: number;
  y?: number;
  emote?: number;
  jump?: number;
};
export type BodyState = {
  y: number;
  q: [number, number, number, number];
  v: [number, number, number];
  w: [number, number, number];
  sleep?: boolean;
  restAt?: number;
  thrownAt?: number;
  thrownBy?: string;
};
export type Piece = Vec &
  Appearance & {
    id: string;
    kind: ItemKind;
    rotation: number;
    placed: boolean;
    tried?: boolean;
    usedAt?: number;
    supply?: boolean;
    hoisted?: boolean;
    heldBy?: string;
    physics?: BodyState;
    flight?: { x: number; z: number; at: number };
    color?: number;
  };
export type GameEvent = {
  id: string;
  at: number;
  type:
    | 'build'
    | 'throw'
    | 'bonk'
    | 'join'
    | 'emote'
    | 'wind'
    | 'grab'
    | 'impact'
    | 'remove';
  text: string;
  x: number;
  z: number;
  target?: string;
  speech?: string;
  audioCue?: string;
};
export type World = {
  challengeSetup?: BuildSnapshot;
  sharedFrom?: string;
  roundStart?: Piece[];
  party?: Party;
  partyPrivate?: PartyPrivate;
  map?: MapId;
  cranePark?: { x: number; z: number; hookY: number; at: number };
  crane?: CraneState;
  roofSupplyVersion?: number;
  pieces: Piece[];
  events: GameEvent[];
  started: number;
  mode: Mode;
  throws: number;
  bonks: number;
  builds: number;
  round: number;
  wind: number;
  physicsAt?: number;
  physicalVersion?: number;
  actors?: Record<string, Vec & { y: number }>;
  sayings?: Record<string, number>;
};
export type Snapshot = {
  recordingEnabled?: boolean;
  mission?: Mission;
  actionSeq?: number;
  world: World;
  players: Player[];
  host: string;
  code: string;
  now: number;
  version: number;
};
export type Action =
  | PartyAction
  | CraneAction
  | { type: 'use'; id: string }
  | (Appearance & { type: 'paint'; id: string; wholeHouse?: boolean })
  | (Appearance & {
      type: 'build';
      kind: ItemKind;
      x: number;
      z: number;
      rotation: number;
      level?: number;
    })
  | { type: 'grab' | 'throw' | 'drop' | 'remove'; id?: string }
  | { type: 'emote' }
  | { type: 'reset'; mode: Mode; retry?: boolean };
export const ROUND_SECONDS = 240;
export const JOBS: {
  name: string;
  client: string;
  quote: string;
  needs: Partial<Record<ItemKind, number>>;
}[] = [
  {
    name: 'A little house, please!',
    client: 'Mrs. Fixit',
    quote: '“Small and cozy. And please put the toilet indoors.”',
    needs: {
      wall: 4,
      window: 2,
      door: 1,
      roof: 2,
      sofa: 1,
      toilet: 1,
      plant: 1,
    },
  },
  {
    name: 'Clocking off at last',
    client: 'Mr. Clockoff',
    quote: '“A bed. A table. And absolutely no more work.”',
    needs: { wall: 4, window: 2, door: 1, roof: 2, bed: 1, table: 1, chair: 2 },
  },
  {
    name: 'The sofa safari',
    client: 'The Cushion family',
    quote: '“There are six of us. We like to sit down.”',
    needs: { wall: 4, window: 2, door: 1, roof: 2, sofa: 3, lamp: 2, plant: 2 },
  },
  {
    name: 'Dinner at ours',
    client: 'Chef Pepper',
    quote: '“A working kitchen. The smoke is optional.”',
    needs: {
      wall: 3,
      window: 1,
      door: 1,
      roof: 2,
      floor: 3,
      fridge: 1,
      counter: 1,
      sink: 1,
      stove: 1,
      table: 1,
    },
  },
  {
    name: 'The very lazy Sunday',
    client: 'The Slipper family',
    quote: '“A bath, a book, and nowhere to be.”',
    needs: {
      wall: 3,
      window: 1,
      door: 1,
      roof: 2,
      bed: 1,
      wardrobe: 1,
      bookshelf: 1,
      bathtub: 1,
      lamp: 1,
    },
  },
  {
    name: 'Opening night',
    client: 'Miss Encore',
    quote: '“A music room with room for an audience.”',
    needs: {
      wall: 3,
      window: 2,
      door: 1,
      roof: 2,
      piano: 1,
      chair: 2,
      easel: 1,
      aquarium: 1,
    },
  },
];
export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export function freshWorld(
  mode: Mode = 'sandbox',
  now = Date.now(),
  round = 0,
  map: MapId = 'small',
): World {
  return {
    map,
    mode,
    started: now,
    round,
    throws: 0,
    bonks: 0,
    builds: 0,
    wind: 0,
    physicsAt: now,
    physicalVersion: 1,
    roofSupplyVersion: 1,
    events: [],
    pieces: [
      {
        id: 'starter-wall-1',
        kind: 'wall',
        x: -3,
        z: -4,
        rotation: 0,
        placed: true,
      },
      {
        id: 'starter-window',
        kind: 'window',
        x: -1,
        z: -4,
        rotation: 0,
        placed: true,
      },
      {
        id: 'starter-wall-2',
        kind: 'wall',
        x: -4,
        z: -3,
        rotation: 1,
        placed: true,
      },
      {
        id: 'starter-sofa',
        kind: 'sofa',
        x: 5.5,
        z: 2,
        rotation: 0,
        placed: false,
      },
      {
        id: 'starter-plant',
        kind: 'plant',
        x: 6.5,
        z: 4,
        rotation: 0,
        placed: false,
      },
      {
        id: 'starter-toilet',
        kind: 'toilet',
        x: -6,
        z: 3,
        rotation: 0,
        placed: false,
      },
      ...siteProps(map),
      ...roofSupplies(map),
    ],
  };
}
export function jobProgress(world: World) {
  const job = JOBS[world.round % JOBS.length];
  const counts: Partial<Record<ItemKind, number>> = {};
  for (const p of world.pieces)
    if (p.placed && onFoundation(p, world.map, 0.2))
      counts[p.kind] = (counts[p.kind] || 0) + 1;
  const total = Object.values(job.needs).reduce((a, b) => a + b, 0);
  const done = Object.entries(job.needs).reduce(
    (a, [kind, n]) => a + Math.min(counts[kind as ItemKind] || 0, n),
    0,
  );
  return { job, counts, total, done, ratio: done / total };
}
export function event(
  world: World,
  type: GameEvent['type'],
  text: string,
  at: number,
  pos: Vec,
  target?: string,
  audioCue?: string,
) {
  world.events.push({
    id: crypto.randomUUID(),
    type,
    text,
    at,
    x: pos.x,
    z: pos.z,
    target,
    audioCue,
  });
  world.events = world.events.slice(-12);
}
export function applyAction(
  world: World,
  action: Action,
  player: Player,
  players: Player[],
  host: string,
  now = Date.now(),
): World {
  if (action.type === 'reset') {
    if (player.id !== host)
      throw new Error('Only the site manager can start a new job.');
    const next = freshWorld(
      action.mode,
      now,
      action.retry ? world.round : world.round + 1,
      world.map,
    );
    if (world.party) {
      enableParty(
        next,
        now,
        action.retry ? world.party.seed : (world.party.seed + 0x9e3779b9) >>> 0,
        world.party.job,
        world.party.roomId,
      );
      next.party!.voiceMode = world.party.voiceMode;
      next.party!.audioConsent = world.party.audioConsent;
      next.party!.recording = world.party.recording;
      next.party!.format = world.party.format;
      next.party!.crewName = world.party.crewName;
      configureInspection(next);
      if (action.retry && world.party.daily)
        setDaily(next, world.party.daily.date, now);
    }
    if (action.retry && world.roundStart) {
      next.pieces = structuredClone(world.roundStart);
      next.sharedFrom = world.sharedFrom;
      if (next.party && world.party?.inspection && !world.party.daily) {
        next.party.inspection = {
          ...next.party.inspection!,
          target: { ...world.party.inspection.target },
        };
        next.party.task.target = { ...world.party.inspection.target };
      }
    }
    if (action.retry && world.party?.swap && next.party) {
      next.party.swap = { ...structuredClone(world.party.swap), retry: true };
      delete next.party.swap.pausedAt;
    }
    if (
      action.retry &&
      action.mode === 'job' &&
      world.party?.challenge &&
      world.challengeSetup
    )
      restoreBuild(
        next,
        { ...world.challengeSetup, challenge: world.party.challenge },
        world.party.challenge.buildId,
        'try',
      );
    return next;
  }
  const swapError = swapEditError(world, action, player);
  if (swapError) throw new Error(swapError);
  if (action.type === 'party') {
    partyAction(world, action, player, players, host, now);
    missionAction(world, action, player);
    return world;
  }
  if (partyLocked(world))
    throw new Error(
      'Wait for the site manager to start the next building shift.',
    );
  if (world.party?.task.roles.includes(player.id))
    throw new Error('Release your crew role before using other tools.');
  if (action.type === 'crane-cancel') {
    craneAction(world, action, player, now);
    return world;
  }
  if (
    !world.party &&
    world.mode === 'job' &&
    (now - world.started >= ROUND_SECONDS * 1000 ||
      jobProgress(world).ratio >= 1)
  )
    throw new Error(
      'Time to clock off! The site manager can start the next round.',
    );
  if (action.type === 'crane-pick' || action.type === 'crane-place') {
    craneAction(world, action, player, now);
    return world;
  }
  const held = world.pieces.find((p) => p.heldBy === player.id);
  if (action.type === 'paint') {
    if (
      action.wholeHouse !== undefined &&
      typeof action.wholeHouse !== 'boolean'
    )
      throw new Error('Choose individual parts or the whole house.');
    const piece = world.pieces.find((p) => p.id === action.id);
    if (
      !piece ||
      !piece.placed ||
      piece.heldBy ||
      piece.hoisted ||
      piece.supply ||
      !inReach(world, player, piece, piece.id)
    )
      throw new Error('Walk up to a placed part to paint it.');
    if (held)
      throw new Error('Put down what you are carrying before painting.');
    const appearance = validateAppearance(piece.kind, action);
    const walls = ['wall', 'window', 'door'];
    if (
      action.wholeHouse &&
      (!walls.includes(piece.kind) || !onFoundation(piece, world.map))
    )
      throw new Error(
        'Choose a house wall, window or doorway to repaint the exterior.',
      );
    if (action.wholeHouse && world.party?.swap)
      throw new Error('Paint individual parts during Build & Swap.');
    const targets = action.wholeHouse
      ? world.pieces.filter(
          (p) =>
            walls.includes(p.kind) &&
            p.placed &&
            !p.heldBy &&
            !p.hoisted &&
            onFoundation(p, world.map),
        )
      : [piece];
    for (const target of targets) Object.assign(target, appearance);
    event(
      world,
      'build',
      `${player.name} repainted ${action.wholeHouse ? 'the house' : CATALOG.find((i) => i.id === piece.kind)!.name}.`,
      now,
      piece,
    );
    return world;
  }
  if (action.type === 'use') {
    const piece = world.pieces.find((p) => p.id === action.id),
      use = piece && PROP_USES[piece.kind];
    if (
      !piece ||
      !use ||
      piece.heldBy ||
      piece.hoisted ||
      !inReach(world, player, piece, piece.id)
    )
      throw new Error('Walk to an available house prop first.');
    if (held) throw new Error('Put down what you are carrying first.');
    if (piece.physics && Math.hypot(...piece.physics.v) > 0.5)
      throw new Error('Wait for the prop to settle.');
    if (
      piece.usedAt !== undefined &&
      now - piece.usedAt < Math.max(1500, use.duration)
    )
      throw new Error('Let the prop finish its performance first.');
    if (
      world.events.some(
        (e) =>
          e.target === player.id &&
          e.audioCue?.startsWith('prop.') &&
          now - e.at < 1000,
      )
    )
      throw new Error('One performance at a time.');
    piece.usedAt = now;
    if (world.party?.inspection && piece.kind === 'washer') {
      let nudged = 0;
      for (const loose of world.pieces)
        if (
          !loose.placed &&
          !loose.heldBy &&
          !loose.hoisted &&
          !loose.supply &&
          distance(loose, piece) < 3 &&
          loose.id !== piece.id
        ) {
          const dx = loose.x - piece.x,
            dz = loose.z - piece.z,
            length = Math.max(0.2, Math.hypot(dx, dz));
          loose.physics ||= {
            y: 0.43,
            q: [0, 0, 0, 1],
            v: [0, 0, 0],
            w: [0, 0, 0],
          };
          loose.physics.v[0] += (dx / length) * 2.5;
          loose.physics.v[2] += (dz / length) * 2.5;
          loose.physics.v[1] += 0.6;
          loose.physics.sleep = false;
          nudged++;
        }
      if (nudged)
        markMoment(
          world,
          'The spin cycle rearranged the loose furniture.',
          now,
          piece,
        );
    }
    event(
      world,
      'build',
      `${player.name}: ${use.label}.`,
      now,
      piece,
      player.id,
      use.cue,
    );
    return world;
  }
  if (action.type === 'build') {
    if (!validLevel(action.level ?? 0))
      throw new Error('Choose Floor 1, 2 or 3.');
    if (action.kind === 'roof')
      throw new Error(
        'Use the crane: pick up a roof module beside the house, then choose its location.',
      );
    if (
      !CATALOG.some((i) => i.id === action.kind) ||
      !Number.isFinite(action.x) ||
      !Number.isFinite(action.z) ||
      !Number.isInteger(action.rotation)
    )
      throw new Error('This part does not fit the building plan.');
    if (world.pieces.length >= 160)
      throw new Error('The site is full. Remove a few parts first.');
    const pos = snapPlacement(
      world,
      action.kind,
      action,
      ((action.rotation % 4) + 4) % 4,
    );
    const error = placementError(
      world,
      action.kind,
      pos,
      undefined,
      pos.rotation,
    );
    if (error) throw new Error(error);
    if (!buildReach(world, player, pos, action.kind))
      throw new Error(
        'Walk to the building location. You can only build within reach.',
      );
    if (held)
      throw new Error(
        'Put down what you are carrying first. Building needs free hands.',
      );
    if (
      players.some((p) =>
        playerBlocksPlacement(action.kind, pos, pos.rotation, p),
      )
    )
      throw new Error('Someone is standing here. Leave room to work.');
    world.pieces.push({
      id: crypto.randomUUID(),
      kind: action.kind,
      ...validateAppearance(action.kind, action),
      x: pos.x,
      z: pos.z,
      ...(pos.level ? { level: pos.level } : {}),
      rotation: pos.rotation,
      placed: true,
    });
    if (world.party?.swap)
      world.party.swap.owners[world.pieces.at(-1)!.id] =
        world.party.swap.teams.findIndex((team) => team.includes(player.id));
    world.builds++;
    event(
      world,
      'build',
      `${player.name} built ${CATALOG.find((i) => i.id === action.kind)!.name}.`,
      now,
      pos,
      undefined,
      `material.${action.kind}.place`,
    );
  } else if (action.type === 'grab') {
    if (held)
      throw new Error('Your hands are full. Put it down or throw it first!');
    const piece = world.pieces.find((p) => p.id === action.id);
    if (piece) {
      const support = removalSupportError(world, piece, players);
      if (support) throw new Error(support);
    }
    if (piece?.kind === 'roof')
      throw new Error('Use the crane to lift and move roof modules.');
    if (
      !piece ||
      piece.hoisted ||
      piece.supply ||
      piece.heldBy ||
      !inReach(world, player, piece, piece.id)
    )
      throw new Error('Move closer. You need a clear view of the part.');
    if (piece.physics && Math.hypot(...piece.physics.v) > 4)
      throw new Error('The part is still flying. Wait for it to land.');
    piece.heldBy = player.id;
    piece.placed = false;
    delete piece.flight;
    delete piece.physics;
    event(
      world,
      'grab',
      `${player.name} is now carrying ${CATALOG.find((i) => i.id === piece.kind)!.name}.`,
      now,
      player,
      undefined,
      `material.${piece.kind}.grab`,
    );
  } else if (action.type === 'throw' || action.type === 'drop') {
    if (!held)
      throw new Error(
        'Your hands are empty. Walk to a highlighted object and choose Pick up.',
      );
    const length = action.type === 'throw' ? 1 : 1.8;
    const bounds = mapBounds(world.map);
    const landing = {
      level: actorLevel(player, world.map),
      x: Math.round(
        clamp(
          player.x + Math.sin(player.angle) * length,
          -Math.floor(bounds.buildX),
          Math.floor(bounds.buildX),
        ),
      ),
      z: Math.round(
        clamp(
          player.z + Math.cos(player.angle) * length,
          -Math.floor(bounds.buildZ),
          Math.floor(bounds.buildZ),
        ),
      ),
    };
    if (action.type === 'drop') {
      const target = carryPlacement(world, player, held, players);
      if (target.error) throw new Error(target.error);
      Object.assign(landing, { x: target.x, z: target.z, level: target.level });
    }
    delete held.heldBy;
    held.x = landing.x;
    held.z = landing.z;
    held.level = landing.level;
    held.placed = action.type === 'drop';
    if (action.type === 'throw') {
      held.x = player.x + Math.sin(player.angle);
      held.z = player.z + Math.cos(player.angle);
      held.physics = throwState(held, player, now);
      delete held.flight;
      world.throws++;
      event(
        world,
        'throw',
        `${player.name}: “Catch!”`,
        now,
        player,
        undefined,
        `material.${held.kind}.throw`,
      );
    } else {
      delete held.flight;
      delete held.physics;
      held.rotation = ((Math.round(player.angle / (Math.PI / 2)) % 4) + 4) % 4;
      world.builds++;
      event(
        world,
        'build',
        `${player.name}: “Fits. Wobbles. Plenty of ventilation.”`,
        now,
        held,
        undefined,
        `material.${held.kind}.drop`,
      );
    }
  } else if (action.type === 'remove') {
    const piece = world.pieces.find((p) => p.id === action.id);
    if (!piece || piece.hoisted || piece.supply || piece.heldBy)
      throw new Error('This part cannot be removed right now.');
    if (!inReach(world, player, piece, piece.id))
      throw new Error(
        'Walk to the part. You can only remove parts within reach.',
      );
    const support = removalSupportError(world, piece, players);
    if (support) throw new Error(support);
    world.pieces = world.pieces.filter((p) => p.id !== piece.id);
    event(
      world,
      'remove',
      `${player.name} removed a part.`,
      now,
      piece,
      undefined,
      `material.${piece.kind}.remove`,
    );
  } else if (action.type === 'emote') {
    world.sayings ||= {};
    const index =
      world.sayings[player.id] ?? Math.floor(Math.random() * SAYINGS.length);
    const speech = SAYINGS[index % SAYINGS.length];
    world.sayings[player.id] = (index + 1) % SAYINGS.length;
    event(
      world,
      'emote',
      `${player.name}: „${speech}“`,
      now,
      player,
      player.id,
    );
    world.events[world.events.length - 1].speech = speech;
  }
  missionAction(world, action, player, held?.id);
  return world;
}
export function tickWorld(world: World, players: Player[], now: number) {
  tickParty(world, players, now, jobProgress(world).ratio);
  if (partyLocked(world)) {
    if (world.party?.phase === 'inspection') cancelCrane(world, now);
    world.physicsAt = now;
    return world;
  }
  if (!world.roofSupplyVersion) {
    for (const supply of roofSupplies(world.map))
      if (!world.pieces.some((p) => p.id === supply.id))
        world.pieces.push(supply);
    world.roofSupplyVersion = 1;
  }
  if (
    world.mode === 'job' &&
    !world.party?.inspection &&
    now - world.started >= ROUND_SECONDS * 1000
  )
    cancelCrane(world, now);
  else tickCrane(world, players, now);
  if (!world.physicalVersion) {
    for (const prop of siteProps(world.map))
      if (!world.pieces.some((p) => p.id === prop.id)) world.pieces.push(prop);
    world.physicalVersion = 1;
    world.physicsAt = now;
    for (const piece of world.pieces) delete piece.flight;
  }
  for (const piece of world.pieces) {
    const holder = players.find((p) => p.id === piece.heldBy);
    if (holder) {
      piece.x = holder.x;
      piece.z = holder.z;
    }
    if (piece.heldBy && !players.some((p) => p.id === piece.heldBy)) {
      delete piece.heldBy;
      piece.placed = false;
      delete piece.physics;
    }
  }
  for (const impact of advancePhysics(world, players, now)) {
    const p = world.pieces.find((p) => p.id === impact.piece),
      target = players.find((p) => p.id === impact.target);
    if (
      p &&
      !p.placed &&
      !world.events.some(
        (e) => e.type === 'impact' && e.target === p.id && now - e.at < 400,
      )
    )
      event(world, 'impact', '', now, p, p.id, `material.${p.kind}.impact`);
    if (
      !p?.physics?.thrownAt ||
      now - p.physics.thrownAt > 3500 ||
      p.physics.thrownBy === impact.target ||
      !target ||
      world.events.some(
        (e) => e.type === 'bonk' && e.target === target.id && now - e.at < 1200,
      )
    )
      continue;
    world.bonks++;
    event(
      world,
      'bonk',
      `${target.name} was professionally knocked over.`,
      now,
      target,
      target.id,
    );
  }
  const wind = Math.floor((now - world.started) / 55000);
  if (
    wind > world.wind &&
    (world.mode !== 'job' || now - world.started < ROUND_SECONDS * 1000)
  ) {
    world.wind = wind;
    for (const piece of world.pieces)
      if (!piece.placed && !piece.heldBy && !piece.hoisted && !piece.supply) {
        piece.physics ||= {
          y: 0.43,
          q: [0, 0, 0, 1],
          v: [0, 0, 0],
          w: [0, 0, 0],
        };
        piece.physics.v[0] += 3.3;
        piece.physics.v[1] += 1.4;
        piece.physics.v[2] -= 1.5;
        piece.physics.sleep = false;
      }
    event(
      world,
      'wind',
      'BODGE-FORCE 8 GUSTS! Loose furniture is flying.',
      now,
      { x: 0, z: 0 },
    );
  }
  return world;
}
