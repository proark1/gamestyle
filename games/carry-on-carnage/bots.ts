import {
  REACH_DISTANCE,
  idleInput,
  type CarryOnWorld,
  type LuggageItem,
  type Suitcase,
  type Traveler,
} from './types';
import { carryOnAction, newTraveler } from './simulation';
import {
  checkSizerFit,
  computeSuitcaseBulge,
  SIZER_X,
  SIZER_Z,
  TSA_GATE_X,
} from './physics';

const BOT_NAMES = ['Desperate Dave', 'Panic Penny', 'Sprint Sam'];

/** How hard one traveller sitting on a bag squeezes it (see `stepPhysics`). */
const SIT_SQUEEZE = 0.88;
/** A bot pauses this long after each thing it does, so people can follow it. */
const HANDS_MS = 500;
/** Walking this long without getting any closer means something is in the way. */
const STUCK_MS = 900;
/** How long a blocked bot sidesteps before heading for its goal again. */
const DETOUR_MS = 600;
/** Sidesteps a bot tries before it leaves that goal alone for a while. */
const DETOURS = 3;
const GIVE_UP_MS = 10_000;

const SIZER = { x: SIZER_X, z: SIZER_Z };
/** Where a bot queues for the sizer box, clear of the gate desk. */
const SIZER_SPOT = { x: SIZER_X - 1.3, z: SIZER_Z };
/**
 * Where bots set bags down, one spot per bag along the far wall, so a bag on
 * the floor never blocks the sizer queue or the way through security.
 */
const PARKING = [5.3, 6.7, 8.1, 9.5].map((x) => ({ x, z: 4.2 }));
/**
 * Security is a wall with two gaps, each one traveller wide: bots go out
 * through the arch and come back past the guard desk, so they never meet.
 */
const OUTBOUND = [
  { x: TSA_GATE_X - 1.1, z: 0 },
  { x: TSA_GATE_X + 1.1, z: 0 },
];
const INBOUND = [
  { x: TSA_GATE_X + 1.1, z: 3.9 },
  { x: TSA_GATE_X - 1.1, z: 3.9 },
];

type Spot = { x: number; z: number };
type Move = [number, number];
const STILL: Move = [0, 0];

/** What a bot is after and how its walk there is going; never part of the world. */
type Mind = {
  goal: string;
  at: number;
  busyUntil: number;
  best: number;
  since: number;
  detours: number;
  detourUntil: number;
  side: number;
  next: Spot | null;
  skip: Map<string, number>;
};
const minds = new WeakMap<Traveler, Mind>();

function mindOf(bot: Traveler) {
  let mind = minds.get(bot);
  if (!mind) {
    mind = {
      goal: '',
      at: 0,
      busyUntil: 0,
      best: Infinity,
      since: 0,
      detours: 0,
      detourUntil: 0,
      side: 1,
      next: null,
      skip: new Map(),
    };
    minds.set(bot, mind);
  }
  return mind;
}

const flat = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);

/** Synchronize NPC bot companions for solo practice and empty seats */
export function reconcileCarryOnBots(world: CarryOnWorld, now: number) {
  // Keep 3 players total in solo practice
  const targetTotal = 3;
  const currentHumans = world.players.filter((p) => !p.bot).length;
  const neededBots = Math.max(0, targetTotal - currentHumans);

  // Remove excess bots
  const currentBots = world.players.filter((p) => p.bot);
  if (currentBots.length > neededBots) {
    const toRemove = currentBots.slice(neededBots);
    world.players = world.players.filter((p) => !toRemove.includes(p));
  }

  // Add missing bots
  while (world.players.filter((p) => p.bot).length < neededBots) {
    const idx = world.players.filter((p) => p.bot).length;
    const color = (world.players.length + 1) % 4;
    const bot = newTraveler(
      `bot-${idx + 1}`,
      BOT_NAMES[idx % BOT_NAMES.length],
      color,
      now,
    );
    bot.bot = true;
    world.players.push(bot);
  }
}

/**
 * Bots pack bags the sizer will pass, sit on them to zip them and carry them
 * to the gate. They name what they act on, so standing between two bags never
 * touches the wrong one, and they walk around whatever blocks them. The bag
 * that would complete the quota is left for the players.
 */
export function updateCarryOnBots(
  world: CarryOnWorld,
  eventIdRef: { current: number },
) {
  if (world.phase !== 'packing') return;
  const now = world.clock;
  for (const bot of world.players) {
    if (!bot.bot) continue;
    const mind = mindOf(bot);
    for (const [goal, until] of mind.skip)
      if (until <= now) mind.skip.delete(goal);
    const [x, z] =
      now < bot.downUntil || now < mind.busyUntil
        ? STILL
        : think(world, bot, mind, eventIdRef);
    // A bot with nothing to do claims nothing.
    if (mind.at !== now) mind.goal = '';
    bot.input = { ...idleInput(), x, z, seq: bot.input.seq + 1 };
  }
}

function think(
  world: CarryOnWorld,
  bot: Traveler,
  mind: Mind,
  eventIdRef: { current: number },
): Move {
  const now = world.clock;
  const act = (
    action: 'grab' | 'compress' | 'zip' | 'drop',
    target?: string,
  ) => {
    mind.busyUntil = now + HANDS_MS;
    carryOnAction(
      world,
      bot.id,
      { type: 'interact', action, target },
      eventIdRef,
    );
  };
  /** Head for `spot` (by way of `from`), then `then()` once it is in reach. */
  const reach = (goal: string, spot: Spot, then: () => void, from = spot) => {
    if (flat(bot, spot) < REACH_DISTANCE) {
      settle(mind, goal, now);
      then();
      return STILL;
    }
    return walk(bot, mind, goal, from, now);
  };
  const free = (goal: string) =>
    !mind.skip.has(goal) &&
    !world.players.some(
      (other) => other !== bot && other.bot && minds.get(other)?.goal === goal,
    );
  const bag = (id: string | null) => world.suitcases.find((sc) => sc.id === id);
  const cage = bag(world.sizer.insertedSuitcase);
  // Bags approved or on their way: the one that completes the quota is left
  // for the players, where they packed it.
  const bound =
    world.approvedCount +
    world.suitcases.filter(
      (sc) =>
        !sc.approved &&
        !sc.rejected &&
        ((sc === cage && world.sizer.status === 'testing') ||
          world.players.some(
            (player) => player.bot && player.holdingSuitcase === sc.id,
          )),
    ).length;
  const quota = world.players.some((player) => !player.bot)
    ? world.targetBags - 1
    : world.targetBags;

  // Sitting squeezes the bag; zip it once it gives, then get up.
  if (bot.sittingOn) {
    const seat = bag(bot.sittingOn);
    settle(mind, `sit:${bot.sittingOn}`, now);
    if (!seat || seat.zipped >= 0.98) act('compress');
    else if (!zippable(world, seat)) {
      mind.skip.set(`sit:${seat.id}`, now + GIVE_UP_MS);
      act('compress');
    } else if (computeSuitcaseBulge(seat, world.items).canZip)
      act('zip', seat.id);
    return STILL;
  }

  if (bot.holdingSuitcase) {
    const held = bag(bot.holdingSuitcase);
    if (!held) {
      act('drop');
      return STILL;
    }
    // Park a judged bag, or the players' last one.
    if (held.approved || held.rejected || bound > quota) {
      const spot = PARKING[held.color % PARKING.length];
      if (flat(bot, spot) < 0.5 || mind.skip.has('park')) {
        act('drop');
        return STILL;
      }
      return walk(bot, mind, 'park', spot, now);
    }
    // The sizer lets a judged bag out by itself; until then, wait.
    return reach(
      'sizer',
      SIZER,
      () => {
        if (world.sizer.status === 'idle') act('grab');
      },
      SIZER_SPOT,
    );
  }

  if (bot.holdingItem) {
    const item = world.items.find((it) => it.id === bot.holdingItem);
    const into =
      item &&
      world.suitcases
        .filter(
          (sc) =>
            packable(world, sc) &&
            !mind.skip.has(`pack:${sc.id}`) &&
            fits(world, sc, item),
        )
        .sort(
          (a, b) =>
            b.items.length - a.items.length || flat(bot, a) - flat(bot, b),
        )[0];
    if (!into) {
      if (item) mind.skip.set(`item:${item.id}`, now + GIVE_UP_MS);
      act('drop');
      return STILL;
    }
    return reach(`pack:${into.id}`, into, () => act('grab', into.id));
  }

  const loose = world.items.filter(
    (it) => !it.packedIn && !it.heldBy && !mind.skip.has(`item:${it.id}`),
  );
  const nearest = <T extends Spot>(things: T[]) =>
    things.sort((a, b) => flat(bot, a) - flat(bot, b))[0];

  const lift =
    bound < quota &&
    nearest(
      world.suitcases.filter(
        (sc) =>
          sc.zipped >= 0.95 &&
          !sc.approved &&
          !sc.rejected &&
          !sc.burst &&
          !sc.heldBy &&
          sc.id !== world.sizer.insertedSuitcase &&
          !seated(world, sc) &&
          passes(world, sc) &&
          free(`lift:${sc.id}`),
      ),
    );
  if (lift) return reach(`lift:${lift.id}`, lift, () => act('grab', lift.id));

  // A bag nothing else fits into is done: sit on it and zip it.
  const done = nearest(
    world.suitcases.filter(
      (sc) =>
        sc.open &&
        !sc.burst &&
        !sc.heldBy &&
        sc.items.length > 0 &&
        !seated(world, sc) &&
        free(`sit:${sc.id}`) &&
        free(`pack:${sc.id}`) &&
        zippable(world, sc) &&
        passes(world, sc) &&
        !loose.some((it) => fits(world, sc, it)),
    ),
  );
  if (done)
    return reach(`sit:${done.id}`, done, () => act('compress', done.id));

  const fetch = nearest(
    loose.filter(
      (it) =>
        free(`item:${it.id}`) &&
        world.suitcases.some(
          (sc) => packable(world, sc) && fits(world, sc, it),
        ),
    ),
  );
  if (fetch)
    return reach(`item:${fetch.id}`, fetch, () => act('grab', fetch.id));
  return STILL;
}

/** The goal is in reach: nothing to walk to, and the next walk starts fresh. */
function settle(mind: Mind, goal: string, now: number) {
  if (mind.goal !== goal) mind.detours = 0;
  Object.assign(mind, { goal, at: now, best: Infinity, next: null });
}

/**
 * One step towards `to`. A bot that stops getting closer sidesteps, first one
 * way and then the other, and after a few tries leaves the goal alone.
 */
function walk(
  bot: Traveler,
  mind: Mind,
  goal: string,
  to: Spot,
  now: number,
): Move {
  const next = via(bot, to);
  const dx = next.x - bot.x;
  const dz = next.z - bot.z;
  const dist = Math.hypot(dx, dz);
  if (mind.goal !== goal) {
    mind.detours = 0;
    mind.detourUntil = 0;
  }
  const fresh =
    mind.goal !== goal ||
    now - mind.at > 250 ||
    mind.next?.x !== next.x ||
    mind.next?.z !== next.z;
  Object.assign(mind, { goal, at: now, next });

  if (fresh || now < mind.detourUntil || dist < mind.best - 0.1) {
    mind.best = dist;
    mind.since = now;
  } else if (now - mind.since > STUCK_MS) {
    if (++mind.detours > DETOURS) {
      mind.skip.set(goal, now + GIVE_UP_MS);
      mind.detours = 0;
      return STILL;
    }
    mind.side = -mind.side;
    mind.detourUntil = now + DETOUR_MS * mind.detours;
  }
  if (dist < 0.05) return STILL;
  const ix = dx / dist;
  const iz = dz / dist;
  return now < mind.detourUntil ? [-iz * mind.side, ix * mind.side] : [ix, iz];
}

/** Crossing security: line up with this direction's gap, then walk through. */
function via(bot: Traveler, to: Spot): Spot {
  const west = bot.x < TSA_GATE_X;
  if (west === to.x < TSA_GATE_X) return to;
  const [near, far] = west ? OUTBOUND : INBOUND;
  const lined =
    Math.abs(bot.z - near.z) < 0.3 &&
    (west ? bot.x > near.x - 0.2 : bot.x < near.x + 0.2);
  return lined ? far : near;
}

const seated = (world: CarryOnWorld, sc: Suitcase) =>
  world.players.some((player) => player.sittingOn === sc.id);

/** An open bag nobody has started to close. */
const packable = (world: CarryOnWorld, sc: Suitcase) =>
  sc.open && !sc.burst && sc.zipped === 0 && !seated(world, sc);

/** Whether the bag would pass the sizer, zipped and no longer squashed. */
function passes(world: CarryOnWorld, sc: Suitcase, extra?: LuggageItem) {
  const items = extra
    ? [...world.items, { ...extra, packedIn: sc.id }]
    : world.items;
  return checkSizerFit({ ...sc, zipped: 1, compression: 0 }, items).pass;
}

/** Whether the item still fits: the bag must pass the sizer afterwards. */
const fits = (world: CarryOnWorld, sc: Suitcase, item: LuggageItem) =>
  passes(world, sc, item);

/** Whether one traveller sitting on the bag squeezes it enough to zip. */
const zippable = (world: CarryOnWorld, sc: Suitcase) =>
  computeSuitcaseBulge({ ...sc, compression: SIT_SQUEEZE }, world.items).canZip;
