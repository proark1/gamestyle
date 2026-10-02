import {
  CATCHES,
  COASTAL_RADIUS,
  OFFSHORE_RADIUS,
  type Angler,
  type CatchKind,
  type MaterialKind,
  type ModuleKind,
  type ReelEvent,
  type ReelWorld,
  type SeaBand,
  type VoyageItem,
  type VoyageState,
} from './types';

export const SEA_STATIONS = {
  trader: { x: 34, z: 12, name: 'Salt & Scale Trader' },
  repair: { x: -42, z: -70, name: 'Breakwater Repair Platform' },
} as const;

export const RECIPES: Record<
  ModuleKind,
  {
    name: string;
    socket: keyof VoyageState['installed'];
    price: number;
    materials: Partial<Record<MaterialKind, number>>;
    detail: string;
  }
> = {
  'reinforced-hull': {
    name: 'Reinforced hull',
    socket: 'hull',
    price: 45,
    materials: { wood: 2, iron: 2 },
    detail: 'Cuts wave force and collision damage.',
  },
  'storm-engine': {
    name: 'Storm engine',
    socket: 'engine',
    price: 65,
    materials: { iron: 1, parts: 2 },
    detail: 'More thrust for offshore currents.',
  },
  'deep-reel': {
    name: 'Deep-sea reel',
    socket: 'reel',
    price: 75,
    materials: { wood: 1, parts: 2 },
    detail: 'Required to hook the legendary fish.',
  },
  'cargo-rack': {
    name: 'Cargo rack',
    socket: 'utility',
    price: 35,
    materials: { wood: 2, iron: 1 },
    detail: 'Adds six shared cargo spaces.',
  },
  'bilge-pump': {
    name: 'Bilge pump',
    socket: 'utility',
    price: 40,
    materials: { iron: 1, parts: 1 },
    detail: 'Slowly drains flooding while powered.',
  },
};

const materialKinds: MaterialKind[] = ['wood', 'iron', 'parts'];
const socketFor = (kind: ModuleKind) => RECIPES[kind].socket;
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

export function seaBandAt(x: number, z: number): SeaBand {
  const radius = Math.hypot(x, z);
  return radius < COASTAL_RADIUS
    ? 'coastal'
    : radius < OFFSHORE_RADIUS
      ? 'offshore'
      : 'deep';
}

export function freshVoyage(): VoyageState {
  return {
    version: 1,
    wallet: 20,
    earned: 0,
    nextItem: 1,
    items: [],
    band: 'coastal',
    helm: { owner: null, throttle: 0, headingHold: null },
    docked: null,
    demand: 'salmon',
    installed: { hull: null, engine: null, reel: null, utility: null },
    wreck: { active: false, raft: false, salvaged: 0 },
    legendary: { revealed: false, phase: 0, caught: false },
  };
}

export function cargoCapacity(w: ReelWorld) {
  return w.voyage.installed.utility === 'cargo-rack' ? 14 : 8;
}

export function inventoryCount(w: ReelWorld, playerId: string) {
  return w.voyage.items.filter(
    (item) => item.location === `personal:${playerId}`,
  ).length;
}

export function materialCount(w: ReelWorld, kind: MaterialKind) {
  return w.voyage.items.filter(
    (item) =>
      item.category === 'material' &&
      item.kind === kind &&
      (item.location === 'cargo' || item.location.startsWith('personal:')),
  ).length;
}

function createItem(w: ReelWorld, data: Omit<VoyageItem, 'id'>) {
  const item = { ...data, id: `voyage-${w.voyage.nextItem++}` };
  w.voyage.items.push(item);
  return item;
}

export function bankVoyageCatch(w: ReelWorld, kind: CatchKind, crew: Angler[]) {
  if (kind === 'monster') {
    w.voyage.legendary.caught = true;
    w.voyage.legendary.phase = 3;
    w.phase = 'won';
    return {
      stored: true,
      text: 'The Midnight Marlin is aboard. Voyage complete!',
    };
  }
  const isMaterial = materialKinds.includes(kind as MaterialKind);
  const location =
    isMaterial && crew[0] && inventoryCount(w, crew[0].id) < 3
      ? `personal:${crew[0].id}`
      : 'cargo';
  const aboard = w.voyage.items.filter(
    (item) => item.location === 'cargo',
  ).length;
  if (location === 'cargo' && aboard >= cargoCapacity(w)) {
    createItem(w, {
      category: isMaterial ? 'material' : 'fish',
      kind,
      name: CATCHES[kind].name,
      value: CATCHES[kind].value,
      location: 'floating',
      x: w.boat.x,
      z: w.boat.z,
    });
    return {
      stored: false,
      text: `${CATCHES[kind].name} is floating beside the full cargo rack.`,
    };
  }
  createItem(w, {
    category: isMaterial ? 'material' : 'fish',
    kind,
    name: CATCHES[kind].name,
    value: CATCHES[kind].value,
    location,
  });
  return {
    stored: true,
    text: `${CATCHES[kind].name} added to ${isMaterial ? 'supplies' : 'cargo'}.`,
  };
}

export function stationAt(w: ReelWorld) {
  if (distance(w.boat, SEA_STATIONS.trader) < 13) return 'trader' as const;
  if (distance(w.boat, SEA_STATIONS.repair) < 13) return 'repair' as const;
  return null;
}

export function sellCargo(w: ReelWorld) {
  if (stationAt(w) !== 'trader')
    throw new Error('Moor beside the floating trader first.');
  const fish = w.voyage.items.filter(
    (item) => item.location === 'cargo' && item.category === 'fish',
  );
  if (!fish.length)
    throw new Error('There are no fish in shared cargo to sell.');
  let total = 0;
  for (const item of fish) {
    const demanded = item.kind === w.voyage.demand;
    total += Math.round(item.value * (demanded ? 1.5 : 1));
    item.location = 'sold';
  }
  w.voyage.wallet += total;
  w.voyage.earned += total;
  return total;
}

function consumeMaterials(
  w: ReelWorld,
  materials: Partial<Record<MaterialKind, number>>,
) {
  for (const kind of materialKinds) {
    let left = materials[kind] ?? 0;
    for (const item of w.voyage.items) {
      if (!left) break;
      if (
        item.category === 'material' &&
        item.kind === kind &&
        (item.location === 'cargo' || item.location.startsWith('personal:'))
      ) {
        item.location = 'consumed';
        left--;
      }
    }
  }
}

export function craftModule(w: ReelWorld, playerId: string, kind: ModuleKind) {
  if (stationAt(w) !== 'trader')
    throw new Error('Use the workshop at the floating trader.');
  const recipe = RECIPES[kind];
  if (!recipe) throw new Error('Unknown workshop recipe.');
  if (w.voyage.wallet < recipe.price)
    throw new Error(`The crew needs $${recipe.price}.`);
  for (const material of materialKinds) {
    const need = recipe.materials[material] ?? 0;
    if (materialCount(w, material) < need)
      throw new Error(`The crew needs ${need} ${material}.`);
  }
  if (inventoryCount(w, playerId) >= 3)
    throw new Error('Your personal inventory is full.');
  w.voyage.wallet -= recipe.price;
  consumeMaterials(w, recipe.materials);
  return createItem(w, {
    category: 'module',
    kind,
    name: recipe.name,
    value: recipe.price,
    location: `personal:${playerId}`,
  });
}

export function installModule(w: ReelWorld, playerId: string, itemId: string) {
  const item = w.voyage.items.find(
    (candidate) =>
      candidate.id === itemId &&
      candidate.location === `personal:${playerId}` &&
      candidate.category === 'module',
  );
  if (!item) throw new Error('Carry the crafted module before installing it.');
  const kind = item.kind as ModuleKind;
  const socket = socketFor(kind);
  const previous = w.voyage.installed[socket];
  if (previous) {
    const old = w.voyage.items.find(
      (candidate) => candidate.location === `installed:${socket}`,
    );
    if (old) old.location = 'cargo';
  }
  w.voyage.installed[socket] = kind;
  item.location = `installed:${socket}`;
  return RECIPES[kind].name;
}

export function toggleHelm(w: ReelWorld, p: Angler) {
  if (p.swimming || Math.hypot(p.x, p.z - 1.55) > 1.25)
    throw new Error('Stand at the wheel to take the helm.');
  w.voyage.helm.owner = w.voyage.helm.owner === p.id ? null : p.id;
  if (!w.voyage.helm.owner) w.voyage.helm.throttle = 0;
  return w.voyage.helm.owner === p.id;
}

export function toggleHeadingHold(w: ReelWorld, p: Angler) {
  if (w.voyage.helm.owner !== p.id) throw new Error('Take the helm first.');
  w.voyage.helm.headingHold =
    w.voyage.helm.headingHold === null ? w.boat.yaw : null;
  return w.voyage.helm.headingHold !== null;
}

export function helmForce(w: ReelWorld, dt: number) {
  const owner = w.players.find((player) => player.id === w.voyage.helm.owner);
  if (!owner || owner.swimming || w.boat.sunk) {
    w.voyage.helm.owner = null;
    w.voyage.helm.throttle *= Math.exp(-2 * dt);
    return { x: 0, z: 0, torque: 0 };
  }
  const target = Math.max(-0.4, Math.min(1, -owner.input.z));
  w.voyage.helm.throttle +=
    (target - w.voyage.helm.throttle) * Math.min(1, dt * 2.5);
  const upgraded = w.voyage.installed.engine === 'storm-engine';
  const thrust = (upgraded ? 22 : 12) * w.voyage.helm.throttle;
  let rudder = owner.input.x * (upgraded ? 1.15 : 0.85);
  if (w.voyage.helm.headingHold !== null && Math.abs(owner.input.x) < 0.1) {
    const error = Math.atan2(
      Math.sin(w.voyage.helm.headingHold - w.boat.yaw),
      Math.cos(w.voyage.helm.headingHold - w.boat.yaw),
    );
    rudder = Math.max(-0.7, Math.min(0.7, error * 1.2));
  } else if (Math.abs(owner.input.x) > 0.1) w.voyage.helm.headingHold = null;
  return {
    x: Math.sin(w.boat.yaw) * thrust,
    z: Math.cos(w.boat.yaw) * thrust,
    torque: rudder * Math.max(0.25, Math.abs(w.voyage.helm.throttle)) * 1.8,
  };
}

export function beginWreck(w: ReelWorld) {
  if (w.voyage.wreck.active) return;
  w.voyage.wreck.active = true;
  w.voyage.helm.owner = null;
  for (const item of w.voyage.items) {
    if (item.location === 'cargo' || item.location.startsWith('installed:')) {
      item.location = 'floating';
      item.x = w.boat.x + ((w.voyage.nextItem % 3) - 1) * 2;
      item.z = w.boat.z + ((w.voyage.nextItem % 2) - 0.5) * 3;
    }
  }
  w.voyage.installed = { hull: null, engine: null, reel: null, utility: null };
  for (const kind of ['wood', 'wood', 'parts'] as MaterialKind[])
    createItem(w, {
      category: 'material',
      kind,
      name: CATCHES[kind].name,
      value: CATCHES[kind].value,
      location: 'floating',
      x: w.boat.x + (w.voyage.nextItem % 4),
      z: w.boat.z - (w.voyage.nextItem % 3),
    });
}

export function salvageNearest(w: ReelWorld, p: Angler) {
  const nearest = w.voyage.items
    .filter(
      (item) =>
        item.location === 'floating' &&
        item.x !== undefined &&
        item.z !== undefined,
    )
    .sort(
      (a, b) =>
        distance(p, a as { x: number; z: number }) -
        distance(p, b as { x: number; z: number }),
    )[0];
  if (!nearest || distance(p, nearest as { x: number; z: number }) > 5)
    throw new Error('Swim within reach of floating salvage.');
  if (inventoryCount(w, p.id) >= 3)
    throw new Error('Your personal inventory is full.');
  nearest.location = `personal:${p.id}`;
  delete nearest.x;
  delete nearest.z;
  w.voyage.wreck.salvaged++;
  return nearest.name;
}

export function canBuildRaft(w: ReelWorld) {
  return materialCount(w, 'wood') >= 2 && materialCount(w, 'parts') >= 1;
}

export function consumeRaftKit(w: ReelWorld) {
  if (!w.boat.sunk || !canBuildRaft(w))
    throw new Error('Recover 2 wood and 1 part to lash a raft.');
  consumeMaterials(w, { wood: 2, parts: 1 });
  w.voyage.wreck.raft = true;
  w.voyage.wreck.active = false;
}

export function updateVoyage(w: ReelWorld, dt: number) {
  w.voyage.band = seaBandAt(w.boat.x, w.boat.z);
  w.voyage.docked = stationAt(w);
  if (w.voyage.installed.utility === 'bilge-pump' && !w.boat.sunk)
    w.boat.flood = Math.max(0, w.boat.flood - dt * 0.018);
  const monster = w.fish.find((fish) => fish.kind === 'monster');
  if (
    monster &&
    !w.voyage.legendary.revealed &&
    w.voyage.band === 'deep' &&
    w.voyage.installed.reel === 'deep-reel'
  ) {
    w.voyage.legendary.revealed = true;
    monster.respawnAt = 0;
    monster.x = w.boat.x + Math.sin(w.boat.yaw + 1.4) * 18;
    monster.z = w.boat.z + Math.cos(w.boat.yaw + 1.4) * 18;
  }
  if (monster && w.voyage.legendary.revealed) {
    const ratio = monster.stamina / CATCHES.monster.stamina;
    w.voyage.legendary.phase = ratio > 0.66 ? 1 : ratio > 0.25 ? 2 : 3;
  }
}

export function dangerMultiplier(w: ReelWorld) {
  const band = w.voyage.band;
  const raw = band === 'coastal' ? 1 : band === 'offshore' ? 1.18 : 1.58;
  return w.voyage.installed.hull === 'reinforced-hull' ? raw * 0.68 : raw;
}

export type Announce = (
  w: ReelWorld,
  kind: ReelEvent['kind'],
  text: string,
) => void;
