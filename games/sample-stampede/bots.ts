import {
  ITEM_DEFS,
  type ItemKind,
  type PlayerInput,
  type SampleStampedeWorld,
  type ShoppingCart,
} from './types';
import { GRAB_RADIUS, GRAB_REACH, WAREHOUSE_BOUNDS } from './physics';

// Planning grid: 1 m cells. A cart's centre keeps this far from racks and
// walls, which leaves cells 2.5 m from the stock on a rack's middle line
// (cell centres sit on half metres). Straight runs keep a wider berth.
const CELL = 1;
const CLEARANCE = 0.85;
const SIGHT_CLEARANCE = 1;
// Bots drive no faster than this and slow down for turns, so they rarely
// crash hard enough to lose stock.
const TOP_SPEED = 7;
// The driver parks this close to an item; the rider takes it from there.
const PARK_RADIUS = 3;
// A rider swings at stock whose distance lets the claw close on it.
const POLE_MIN = GRAB_REACH - GRAB_RADIUS + 0.1;
const POLE_MAX = GRAB_REACH + GRAB_RADIUS - 0.1;
const SWAT_RANGE = 2.2;
const REPLAN_MS = 300;
// Stock the rider cannot get at after this long is skipped for a while.
const PARK_PATIENCE_MS = 3000;
const SKIP_MS = 15000;

type Point = { x: number; z: number };

type Grid = { cols: number; rows: number; free: Uint8Array };

type Plan = {
  key: string;
  madeAt: number;
  path: Point[];
  // Where the path ends up: the item, exit or cart it leads to.
  target: Point & { id?: string };
  arrived: boolean;
};

type DriverMemory = {
  plan: Plan | null;
  lastClock: number;
  stuckMs: number;
  reverseUntil: number;
  reverseSteer: number;
  parked: { id: string; since: number } | null;
  skip: Map<string, number>;
};

const grids = new WeakMap<SampleStampedeWorld, Grid>();
const memories = new WeakMap<SampleStampedeWorld, Map<string, DriverMemory>>();

export function updateSampleStampedeBots(
  world: SampleStampedeWorld,
  _dt: number,
): Map<string, PlayerInput> {
  const inputs = new Map<string, PlayerInput>();

  for (const player of world.players) {
    if (!player.bot) {
      inputs.set(player.id, player.input);
      continue;
    }

    const cart = world.carts.find((c) => c.id === player.cartId);
    if (!cart) continue;

    if (player.role === 'driver') {
      inputs.set(
        player.id,
        computeDriverBotInput(world, cart, memoryOf(world, player.id)),
      );
    } else {
      inputs.set(player.id, computeGrabberBotInput(world, cart));
    }
  }

  return inputs;
}

function memoryOf(world: SampleStampedeWorld, id: string): DriverMemory {
  let all = memories.get(world);
  if (!all) {
    all = new Map();
    memories.set(world, all);
  }
  let memory = all.get(id);
  if (!memory) {
    memory = {
      plan: null,
      lastClock: world.clock,
      stuckMs: 0,
      reverseUntil: 0,
      reverseSteer: 1,
      parked: null,
      skip: new Map(),
    };
    all.set(id, memory);
  }
  return memory;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** An angle folded into -PI..PI. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** How far the cart must turn to face a point; positive is a left turn. */
function turnTo(cart: ShoppingCart, p: Point) {
  return wrap(Math.atan2(-(p.z - cart.z), p.x - cart.x) - cart.rotY);
}

/** Needed kinds the basket does not hold enough of yet. */
function wantedKinds(cart: ShoppingCart): Set<ItemKind> {
  const counts = new Map<ItemKind, number>();
  for (const it of cart.items)
    counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
  return new Set(
    cart.manifest.targetItems
      .filter((ti) => (counts.get(ti.kind) ?? 0) < ti.required)
      .map((ti) => ti.kind),
  );
}

const carriesContraband = (cart: ShoppingCart) =>
  cart.items.some((it) => ITEM_DEFS[it.kind].isContraband);

/** A cart centre here keeps `clearance` from every rack and wall. */
function clearAt(
  world: SampleStampedeWorld,
  x: number,
  z: number,
  clearance = CLEARANCE,
) {
  const { minX, maxX, minZ, maxZ } = WAREHOUSE_BOUNDS;
  if (
    x < minX + clearance ||
    x > maxX - clearance ||
    z < minZ + clearance ||
    z > maxZ - clearance
  )
    return false;
  for (const s of world.shelves) {
    const dx = Math.max(Math.abs(x - s.x) - s.width / 2, 0);
    const dz = Math.max(Math.abs(z - s.z) - s.length / 2, 0);
    if (dx * dx + dz * dz < clearance * clearance) return false;
  }
  return true;
}

function gridOf(world: SampleStampedeWorld): Grid {
  let grid = grids.get(world);
  if (!grid) {
    const { minX, maxX, minZ, maxZ } = WAREHOUSE_BOUNDS;
    const cols = Math.round((maxX - minX) / CELL);
    const rows = Math.round((maxZ - minZ) / CELL);
    const free = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        free[r * cols + c] = clearAt(world, cellX(c), cellZ(r)) ? 1 : 0;
    grid = { cols, rows, free };
    grids.set(world, grid);
  }
  return grid;
}

const cellX = (c: number) => WAREHOUSE_BOUNDS.minX + (c + 0.5) * CELL;
const cellZ = (r: number) => WAREHOUSE_BOUNDS.minZ + (r + 0.5) * CELL;

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * The shortest route over free cells to the nearest cell within `radius` of
 * one of `targets`, as cell centres from the cart's cell onwards.
 */
function findPath(
  world: SampleStampedeWorld,
  from: Point,
  targets: (Point & { id?: string })[],
  radius: number,
): { path: Point[]; target: Point & { id?: string } } | null {
  if (!targets.length) return null;
  const { cols, rows, free } = gridOf(world);
  // Which target each goal cell serves.
  const goalOf = new Int16Array(cols * rows).fill(-1);
  const reach = Math.ceil(radius / CELL);
  targets.forEach((t, i) => {
    const tc = Math.floor((t.x - WAREHOUSE_BOUNDS.minX) / CELL);
    const tr = Math.floor((t.z - WAREHOUSE_BOUNDS.minZ) / CELL);
    for (let r = tr - reach; r <= tr + reach; r++)
      for (let c = tc - reach; c <= tc + reach; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        const n = r * cols + c;
        if (
          free[n] &&
          goalOf[n] < 0 &&
          Math.hypot(cellX(c) - t.x, cellZ(r) - t.z) <= radius
        )
          goalOf[n] = i;
      }
  });

  const startC = clamp(
    Math.floor((from.x - WAREHOUSE_BOUNDS.minX) / CELL),
    0,
    cols - 1,
  );
  const startR = clamp(
    Math.floor((from.z - WAREHOUSE_BOUNDS.minZ) / CELL),
    0,
    rows - 1,
  );
  const start = startR * cols + startC;
  const parent = new Int32Array(cols * rows).fill(-1);
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  parent[start] = start;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++];
    if (goalOf[cur] >= 0) {
      const path: Point[] = [];
      for (let n = cur; ; n = parent[n]) {
        path.push({ x: cellX(n % cols), z: cellZ(Math.floor(n / cols)) });
        if (n === start) break;
      }
      path.reverse();
      return { path, target: targets[goalOf[cur]] };
    }
    const c = cur % cols;
    const r = (cur - c) / cols;
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const n = nr * cols + nc;
      if (parent[n] >= 0 || !free[n]) continue;
      // No cutting a rack's corner on a diagonal.
      if (dc && dr && (!free[r * cols + nc] || !free[nr * cols + c])) continue;
      parent[n] = cur;
      queue[tail++] = n;
    }
  }
  return null;
}

/** A straight run from `a` to `b` stays clear of racks and walls. */
function inSight(world: SampleStampedeWorld, a: Point, b: Point) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(length / 0.4);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (
      !clearAt(
        world,
        a.x + (b.x - a.x) * t,
        a.z + (b.z - a.z) * t,
        SIGHT_CLEARANCE,
      )
    )
      return false;
  }
  return true;
}

/** Where the driver wants to go, and how close counts as there. */
function driverGoal(
  world: SampleStampedeWorld,
  cart: ShoppingCart,
  memory: DriverMemory,
): { key: string; targets: (Point & { id?: string })[]; radius: number } {
  const rival = world.carts.find((c) => c.team !== cart.team);
  // A teddy fails the receipt check: take it over to the rival for the
  // rider to swat into their basket.
  if (carriesContraband(cart) && rival)
    return { key: 'rival', targets: [rival], radius: SWAT_RANGE };

  const wanted = wantedKinds(cart);
  if (!wanted.size && cart.items.length)
    return {
      key: 'exit',
      targets: [world.exitGauntlet],
      radius: 1.2,
    };

  // Shop the list from the top, like a person reading it: the first line
  // there is stock for. (The rider still takes any listed item it passes.)
  const stock = world.groundItems.filter(
    (it) => wanted.has(it.kind) && (memory.skip.get(it.id) ?? 0) <= world.clock,
  );
  const line = cart.manifest.targetItems.find(
    (ti) => wanted.has(ti.kind) && stock.some((it) => it.kind === ti.kind),
  );
  if (line)
    return {
      key: `stock:${line.kind}`,
      targets: stock.filter((it) => it.kind === line.kind),
      radius: PARK_RADIUS,
    };

  // A needed sample is not out yet: wait by the kiosk that serves it.
  const kiosk =
    world.kiosks.find((k) => wanted.has(k.sampleKind) && k.active) ??
    world.kiosks.find((k) => wanted.has(k.sampleKind));
  if (kiosk) return { key: `kiosk:${kiosk.id}`, targets: [kiosk], radius: 3.5 };
  return { key: 'none', targets: [], radius: 0 };
}

function computeDriverBotInput(
  world: SampleStampedeWorld,
  cart: ShoppingCart,
  memory: DriverMemory,
): PlayerInput {
  const elapsed = Math.max(0, world.clock - memory.lastClock);
  memory.lastClock = world.clock;
  const forward = cart.vx * Math.cos(cart.rotY) - cart.vz * Math.sin(cart.rotY);

  const goal = driverGoal(world, cart, memory);
  const plan = memory.plan;
  if (
    !plan ||
    plan.key !== goal.key ||
    world.clock - plan.madeAt >= REPLAN_MS
  ) {
    const found = findPath(world, cart, goal.targets, goal.radius);
    memory.plan = found && {
      key: goal.key,
      madeAt: world.clock,
      path: found.path,
      target: found.target,
      arrived: found.path.length === 1,
    };
  }
  const route = memory.plan;
  if (!route) return input(0, 0);

  // Parked by stock the rider has not managed to take: try other stock.
  if (route.arrived && goal.key.startsWith('stock') && route.target.id) {
    if (memory.parked?.id !== route.target.id)
      memory.parked = { id: route.target.id, since: world.clock };
    else if (world.clock - memory.parked.since > PARK_PATIENCE_MS) {
      memory.skip.set(route.target.id, world.clock + SKIP_MS);
      memory.parked = null;
      memory.plan = null;
    }
  } else memory.parked = null;

  // Aim at the farthest point along the route that is in plain sight.
  let aim: Point = route.target;
  if (!route.arrived) {
    aim = route.path[Math.min(1, route.path.length - 1)];
    for (let i = Math.min(route.path.length - 1, 14); i >= 1; i--)
      if (inSight(world, cart, route.path[i])) {
        aim = route.path[i];
        break;
      }
  }
  const turn = turnTo(cart, aim);
  let steer = clamp(turn * 2.2, -1, 1);

  // Stock and kiosks are reached by parking; the exit and a rival by
  // driving right up.
  const toTarget = Math.hypot(route.target.x - cart.x, route.target.z - cart.z);
  const parks = goal.key.startsWith('stock') || goal.key.startsWith('kiosk');
  let desired =
    route.arrived && parks
      ? 0
      : Math.min(TOP_SPEED, 2 + 1.5 * toTarget) *
        Math.max(0.15, 1 - Math.abs(turn) / 1.3);
  // Ease off behind another cart, so meeting one is a nudge, not a crash,
  // and keep to one side of a cart dead ahead so two carts can pass.
  for (const other of world.carts) {
    if (other === cart) continue;
    const gap = Math.hypot(other.x - cart.x, other.z - cart.z);
    const bearing = turnTo(cart, other);
    if (gap < 6 && Math.abs(bearing) < 1) {
      desired = Math.min(desired, Math.max(1, (gap - 2.2) * 1.2));
      if (Math.abs(bearing) < 0.5)
        steer = clamp(steer + (bearing >= 0 ? -0.6 : 0.6), -1, 1);
    }
  }
  if (route.arrived && parks) steer = 0;
  const throttle = clamp((desired - forward) * 0.35, -1, 1);

  // Not getting anywhere: back off, turning toward the route.
  if (world.clock < memory.reverseUntil)
    return input(memory.reverseSteer, -0.8);
  if (!(route.arrived && parks) && Math.abs(forward) < 0.7)
    memory.stuckMs += elapsed;
  else memory.stuckMs = 0;
  if (memory.stuckMs > 1000) {
    memory.stuckMs = 0;
    memory.reverseUntil = world.clock + 800;
    memory.reverseSteer = turn >= 0 ? 1 : -1;
    memory.plan = null;
  }
  return input(steer, throttle);
}

function input(steer: number, throttle: number): PlayerInput {
  return {
    x: steer,
    z: throttle,
    steer,
    throttle,
    drift: false,
    grabberAction: false,
  };
}

/** The item the claw would close on when the pole swings toward `p`. */
function clawCatch(world: SampleStampedeWorld, cart: ShoppingCart, p: Point) {
  const d = Math.hypot(p.x - cart.x, p.z - cart.z) || 1;
  const clawX = cart.x + ((p.x - cart.x) / d) * GRAB_REACH;
  const clawZ = cart.z + ((p.z - cart.z) / d) * GRAB_REACH;
  let caught = null;
  let nearest = GRAB_RADIUS;
  for (const it of world.groundItems) {
    const dist = Math.hypot(it.x - clawX, it.z - clawZ);
    if (dist < nearest) {
      nearest = dist;
      caught = it;
    }
  }
  return caught;
}

function computeGrabberBotInput(
  world: SampleStampedeWorld,
  cart: ShoppingCart,
): PlayerInput {
  const distance = (p: Point) => Math.hypot(p.x - cart.x, p.z - cart.z);
  const rival = world.carts.find((c) => c.team !== cart.team);
  let aimAt: Point | null = null;

  // A teddy goes into the rival's basket with a swat.
  if (rival && carriesContraband(cart) && distance(rival) < POLE_MAX)
    aimAt = rival;

  // Otherwise the nearest listed item the claw would really close on.
  if (!aimAt) {
    const wanted = wantedKinds(cart);
    let best = Infinity;
    for (const it of world.groundItems) {
      if (!wanted.has(it.kind)) continue;
      const d = distance(it);
      if (d < POLE_MIN || d > POLE_MAX || d >= best) continue;
      const caught = clawCatch(world, cart, it);
      if (!caught || !wanted.has(caught.kind)) continue;
      best = d;
      aimAt = it;
    }
  }

  // And a rival that comes close gets swatted.
  if (!aimAt && rival && distance(rival) < SWAT_RANGE) aimAt = rival;

  return {
    x: 0,
    z: 0,
    steer: 0,
    throttle: 0,
    drift: false,
    grabberAction: !!aimAt,
    grabberAngle: aimAt ? turnTo(cart, aimAt) : 0,
  };
}
