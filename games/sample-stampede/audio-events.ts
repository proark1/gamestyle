import type { AudioEvent, Point } from '../../shared/audio/world';
import { leadingSide } from '../../shared/ui/party-round';
import { WAREHOUSE_BOUNDS } from './physics';
import {
  ITEM_DEFS,
  type ItemKind,
  type SampleStampedeSnapshot,
  type SampleStampedeWorld,
  type ShoppingCart,
  type StampedeEvent,
  type TeamId,
} from './types';

/** Seconds left when the closing-time music and crowd take over. */
export const TENSION_SECONDS = 30;
/** Seconds counted down with a scanner beep each. */
export const COUNTDOWN_SECONDS = 10;
/** A velocity change this sharp in one update is an impact, not steering. */
export const IMPACT_DELTA = 4.5;
/** Two carts closing at this speed before the jolt actually met. */
export const CLOSING_SPEED = 2.5;
/** Lateral slide that starts a drift skid; steering alone stays below it. */
export const SKID_SLIP = 2;
/** A shopper this close to a cart this fast is a near miss. */
export const NEAR_MISS_RADIUS = 1.5;
export const NEAR_MISS_SPEED = 5.5;
/** The swat reaches 1.6 m around the claw; a little slack for the rival moving. */
export const WHACK_RADIUS = 1.9;
/** At most one incidental commentary line in this window. */
export const SPEECH_GAP_MS = 7000;
/** The same incidental line is not repeated inside this window. */
export const LINE_REPEAT_MS = 25_000;
/**
 * Minimum spacing per cue and source. A slide or a scrape along a rack is
 * sustained, so without this it would retrigger on every frame.
 */
export const CUE_SPACING_MS: Readonly<Record<string, number>> = {
  'cart.skid': 1200,
  'cart.hit_shelf': 400,
  'stampede.cart_crash': 300,
  'grabber.whack': 300,
  'cart.near_miss': 1500,
  'item.drop': 250,
};
/** The win or fail stinger plays once, then the lounge loop returns. */
export const STINGER_MS = 9000;

/** Every score the game can ask for, in the order a round meets them. */
export const MUSIC_CUES = [
  'music.menu',
  'stampede.store_muzak',
  'music.tension',
  'music.win',
  'music.fail',
] as const;

/** Loop channel -> recorded bed. The squeaky wheel is a speed-scaled bed. */
export const BED_CUES = {
  warehouse: 'ambience.warehouse',
  shoppers: 'ambience.shoppers',
  checkout: 'ambience.checkout',
  roll: 'ambience.cart_roll',
  squeak: 'stampede.squeaky_wheel',
} as const;
export type StampedeBeds = Record<keyof typeof BED_CUES, number>;

/** Highest priority first; only one line is spoken per update. */
export const LINE_PRIORITY = [
  'speech.win',
  'speech.fail',
  'speech.ten_seconds',
  'speech.one_minute',
  'speech.rejected',
  'speech.approved',
  'speech.teddy_stuck',
  'speech.teddy_gift',
  'speech.list_complete',
  'speech.sugar_rush',
  'speech.slip',
  'speech.crash',
  'speech.sample',
  'speech.midround',
  'speech.start',
] as const;
/** These interrupt whatever the commentator is saying and skip the gap. */
export const URGENT_LINES: ReadonlySet<string> = new Set([
  'speech.win',
  'speech.fail',
  'speech.ten_seconds',
  'speech.one_minute',
  'speech.rejected',
  'speech.approved',
]);

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const speedOf = (cart: { vx: number; vz: number }) =>
  Math.hypot(cart.vx, cart.vz);
const cartPoint = (cart: ShoppingCart): Point => ({
  x: cart.x,
  y: 0.8,
  z: cart.z,
});

export function stampedeLocalCart(snapshot: SampleStampedeSnapshot) {
  return (
    snapshot.world.carts.find((cart) => cart.id === snapshot.localCartId) ??
    snapshot.world.carts.find((cart) => cart.team === snapshot.myTeam)
  );
}

/** Your team leads the tills outright. A shared top score is not a win. */
export function stampedeWon(snapshot: SampleStampedeSnapshot) {
  const team = stampedeLocalCart(snapshot)?.team ?? snapshot.myTeam;
  return leadingSide(snapshot.world.teamScores) === team;
}

/** Every sample shares one pick-up; bulk products each have their own. */
export function itemGrabCue(kind: ItemKind) {
  return ITEM_DEFS[kind].isSample ? 'item.sample.grab' : `item.${kind}.grab`;
}

/** Items on the local shopping list that the cart now carries. */
export function listProgress(cart: ShoppingCart) {
  const counts = new Map<ItemKind, number>();
  for (const item of cart.items)
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return cart.manifest.targetItems.filter(
    (target) => (counts.get(target.kind) ?? 0) >= target.required,
  ).length;
}

/** Fresh round in the first moments of play: the doors have just opened. */
export function roundYoung(world: SampleStampedeWorld) {
  return (
    world.status === 'active' && world.matchDuration - world.timeRemaining < 1.5
  );
}

/** A new room, player, round, restart or clock gap: nothing old may replay. */
export function stampedeAudioDiscontinuity(
  previous: SampleStampedeSnapshot,
  next: SampleStampedeSnapshot,
) {
  const before = previous.world,
    after = next.world;
  return (
    previous.code !== next.code ||
    previous.localPlayerId !== next.localPlayerId ||
    before.started !== after.started ||
    after.clock < before.clock ||
    after.clock - before.clock > 2500 ||
    after.timeRemaining > before.timeRemaining + 1 ||
    (before.status === 'finished' && after.status !== 'finished')
  );
}

/** The same round, so an older clock is a late packet rather than a restart. */
export function stampedeSameRound(
  previous: SampleStampedeSnapshot,
  next: SampleStampedeSnapshot,
) {
  return (
    previous.code === next.code &&
    previous.localPlayerId === next.localPlayerId &&
    previous.world.started === next.world.started
  );
}

function inGauntlet(world: SampleStampedeWorld, cart: ShoppingCart) {
  const gate = world.exitGauntlet;
  return (
    Math.abs(cart.x - gate.x) < gate.width / 2 + 1 &&
    Math.abs(cart.z - gate.z) < gate.depth / 2 + 1
  );
}

function besideObstacle(world: SampleStampedeWorld, cart: ShoppingCart) {
  const { minX, maxX, minZ, maxZ } = WAREHOUSE_BOUNDS;
  const edge = 1.4;
  if (
    cart.x < minX + edge ||
    cart.x > maxX - edge ||
    cart.z < minZ + edge ||
    cart.z > maxZ - edge
  )
    return true;
  return world.shelves.some(
    (shelf) =>
      Math.abs(cart.x - shelf.x) < shelf.width / 2 + 1.1 &&
      Math.abs(cart.z - shelf.z) < shelf.length / 2 + 1.1,
  );
}

/** Positive when two carts were driving into each other. */
function closingSpeed(a: ShoppingCart, b: ShoppingCart) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    distance = Math.hypot(dx, dz) || 1;
  return -((b.vx - a.vx) * dx + (b.vz - a.vz) * dz) / distance;
}

/**
 * Pure planner: previous and next snapshot plus the events that are new since
 * the previous one become one-shot cues. Only confirmed changes sound; a
 * missing or discontinuous previous snapshot plays nothing old.
 */
export function stampedeAudioEvents(
  previous: SampleStampedeSnapshot | null,
  next: SampleStampedeSnapshot,
  events: readonly StampedeEvent[] = [],
): AudioEvent[] {
  const w = next.world;
  const cues: AudioEvent[] = [];
  const play = (
    id: string,
    position?: Point,
    strength = 1,
    extra: Partial<AudioEvent> = {},
  ) => cues.push({ id, position, strength: clamp(strength), ...extra });

  if (!previous || stampedeAudioDiscontinuity(previous, next)) {
    if (roundYoung(w)) {
      play('event.round_start');
      play('speech.start');
      if (w.activeAnnouncement) play('stampede.sample_bell');
    }
    return cues;
  }

  const old = previous.world;
  const me = stampedeLocalCart(next);
  const myTeam = me?.team ?? next.myTeam;
  const oldCart = (id: string) => old.carts.find((cart) => cart.id === id);
  const teamCart = (team?: TeamId) => w.carts.find((c) => c.team === team);
  const nearestCart = (at: { x: number; z: number }) =>
    [...w.carts].sort(
      (a, b) =>
        Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z),
    )[0];
  const at = (event: StampedeEvent): Point => ({
    x: event.x,
    y: event.y,
    z: event.z,
  });

  // The clock: halfway, a minute, the last ten seconds and closing time.
  if (old.status === 'active' && w.status === 'finished') {
    play(stampedeWon(next) ? 'speech.win' : 'speech.fail');
    play('event.time_up');
  }
  if (w.status === 'active') {
    const crossed = (seconds: number) =>
      old.timeRemaining > seconds && w.timeRemaining <= seconds;
    if (crossed(COUNTDOWN_SECONDS)) play('speech.ten_seconds');
    if (crossed(60)) {
      play('speech.one_minute');
      play('event.closing_chime');
    }
    if (crossed(w.matchDuration / 2)) play('speech.midround');
    for (let second = COUNTDOWN_SECONDS; second >= 1; second--)
      if (crossed(second)) {
        play(
          'event.countdown',
          undefined,
          0.55 + (COUNTDOWN_SECONDS - second) * 0.05,
        );
        break;
      }
  }

  // Confirmed game events.
  const crashed = new Set<string>();
  const whacked = new Set<string>();
  const tumbles: StampedeEvent[] = [];
  for (const event of events) {
    const cart = teamCart(event.team);
    const own = event.team !== undefined && event.team === myTeam;
    switch (event.type) {
      case 'sample_announcement':
        play('stampede.sample_bell');
        play('stampede.crowd_rush', at(event), 0.85, { sourceId: 'crowd' });
        play('speech.sample');
        break;
      case 'sugar_rush':
        play(
          'stampede.sugar_rush',
          own ? undefined : at(event),
          own ? 1 : 0.7,
          {
            sourceId: cart?.id,
          },
        );
        if (own) play('speech.sugar_rush');
        break;
      case 'cart_crash': {
        const victim = nearestCart(event);
        if (victim) crashed.add(victim.id);
        play('stampede.cart_crash', at(event), event.intensity ?? 1, {
          variant: true,
          sourceId: victim?.id,
        });
        if (victim && victim.id === me?.id) play('speech.crash');
        break;
      }
      case 'item_snagged':
        play('grabber.snag', at(event), own ? 0.85 : 0.65, {
          variant: true,
          sourceId: cart?.id,
        });
        break;
      case 'plate_slip':
        play('stampede.plate_slip', at(event), 1, {
          variant: true,
          sourceId: cart?.id,
        });
        if (own) play('speech.slip');
        break;
      case 'shelf_tumble':
        tumbles.push(event);
        break;
      case 'receipt_approved':
        play('stampede.receipt_approved', own ? undefined : at(event));
        play('stampede.receipt_print', own ? undefined : at(event), 0.8);
        if (own) play('speech.approved');
        break;
      case 'receipt_rejected':
        play('stampede.receipt_rejected', own ? undefined : at(event));
        play('stampede.receipt_print', own ? undefined : at(event), 0.8);
        if (own) play('speech.rejected');
        break;
      case 'grabber_whack': {
        play('grabber.swing', at(event), own ? 0.6 : 0.5, {
          variant: true,
          sourceId: cart?.id,
        });
        const victim = w.carts.find(
          (rival) =>
            rival.team !== event.team &&
            Math.hypot(rival.x - event.x, rival.z - event.z) < WHACK_RADIUS,
        );
        if (victim) {
          whacked.add(victim.id);
          play('grabber.whack', cartPoint(victim), 1, {
            variant: true,
            sourceId: victim.id,
          });
        }
        break;
      }
      case 'item_lost':
        // Heard through the basket comparison below: a drop or a teddy gift.
        break;
    }
  }
  if (tumbles.length) {
    const centre = {
      x: tumbles.reduce((sum, e) => sum + e.x, 0) / tumbles.length,
      y: 1.5,
      z: tumbles.reduce((sum, e) => sum + e.z, 0) / tumbles.length,
    };
    play('stampede.shelf_tumble', centre, 0.55 + 0.1 * tumbles.length, {
      variant: true,
      sourceId: 'shelves',
    });
  }

  // Baskets: what went in, what fell out and which teddy changed carts.
  const ownerBefore = new Map<string, string>();
  for (const cart of old.carts)
    for (const item of cart.items) ownerBefore.set(item.id, cart.id);
  const ownerAfter = new Map<string, string>();
  for (const cart of w.carts)
    for (const item of cart.items) ownerAfter.set(item.id, cart.id);
  for (const cart of w.carts) {
    const before = oldCart(cart.id);
    if (!before) continue;
    const mine = cart.id === me?.id;
    const had = new Set(before.items.map((item) => item.id));
    for (const item of cart.items) {
      if (had.has(item.id)) continue;
      const from = ownerBefore.get(item.id);
      play(itemGrabCue(item.kind), cartPoint(cart), mine ? 0.9 : 0.7, {
        sourceId: cart.id,
      });
      if (from && from !== cart.id) {
        if (mine) play('speech.teddy_stuck');
        else if (from === me?.id) play('speech.teddy_gift');
      }
    }
    // A checkout empties the basket on purpose; that is not a drop.
    if (cart.score > before.score) continue;
    const kept = new Set(cart.items.map((item) => item.id));
    if (
      before.items.some(
        (item) => !kept.has(item.id) && !ownerAfter.has(item.id),
      )
    )
      play('item.drop', cartPoint(cart), 0.8, { sourceId: cart.id });
  }

  // Your shopping list filling up.
  const was = me && oldCart(me.id);
  if (me && was && me.score === was.score) {
    const done = listProgress(me);
    if (done > listProgress(was)) {
      if (done === me.manifest.targetItems.length) {
        play('event.list_complete');
        play('speech.list_complete');
      } else play('event.list_tick');
    }
  }

  // Impacts, drift skids and near misses read from the carts themselves.
  const dt = (w.clock - old.clock) / 1000;
  for (const cart of w.carts) {
    const before = oldCart(cart.id);
    if (!before) continue;
    if (
      cart.slipSpinTimer <= 0 &&
      before.driftSlip < SKID_SLIP &&
      cart.driftSlip >= SKID_SLIP
    )
      play('cart.skid', cartPoint(cart), 0.5 + cart.driftSlip / 6, {
        variant: true,
        sourceId: cart.id,
      });
    const jolt = Math.hypot(cart.vx - before.vx, cart.vz - before.vz);
    if (
      dt <= 0 ||
      dt > 0.25 ||
      jolt < IMPACT_DELTA ||
      crashed.has(cart.id) ||
      whacked.has(cart.id) ||
      inGauntlet(w, cart)
    )
      continue;
    const strength = clamp(jolt / 10);
    const partner = w.carts.find((other) => {
      const otherBefore = oldCart(other.id);
      return (
        other.id !== cart.id &&
        !!otherBefore &&
        Math.hypot(other.x - cart.x, other.z - cart.z) < 2.4 &&
        closingSpeed(before, otherBefore) > CLOSING_SPEED
      );
    });
    if (partner) {
      if (crashed.has(partner.id)) continue;
      crashed.add(cart.id);
      crashed.add(partner.id);
      play(
        'stampede.cart_crash',
        {
          x: (cart.x + partner.x) / 2,
          y: 0.8,
          z: (cart.z + partner.z) / 2,
        },
        strength,
        { variant: true, sourceId: cart.id },
      );
    } else if (speedOf(before) - speedOf(cart) > 3 && besideObstacle(w, cart)) {
      crashed.add(cart.id);
      play('cart.hit_shelf', cartPoint(cart), strength, {
        variant: true,
        sourceId: cart.id,
      });
    } else continue;
    if (strength >= 0.7 && (cart.id === me?.id || partner?.id === me?.id))
      play('speech.crash');
  }
  if (me && was && speedOf(me) > NEAR_MISS_SPEED) {
    const shopper = w.npcShoppers.find(
      (npc) =>
        Math.hypot(npc.x - me.x, npc.z - me.z) < NEAR_MISS_RADIUS &&
        Math.hypot(npc.x - was.x, npc.z - was.z) >= NEAR_MISS_RADIUS,
    );
    if (shopper)
      play('cart.near_miss', { x: shopper.x, y: 1.2, z: shopper.z }, 1, {
        sourceId: shopper.id,
      });
  }
  return cues;
}

/** Stride progress per walker between updates; the planner stays pure. */
export type StrideMemory = ReadonlyMap<
  string,
  { x: number; z: number; stride: number; clock: number }
>;

/**
 * Footsteps of every cart driver (running behind the handle) and every
 * wandering shopper. Longer strides at speed keep a sprint from buzzing.
 */
export function stampedeFootsteps(
  memory: StrideMemory,
  snapshot: SampleStampedeSnapshot,
) {
  const w = snapshot.world;
  const next = new Map<
    string,
    { x: number; z: number; stride: number; clock: number }
  >();
  const cues: AudioEvent[] = [];
  if (w.status !== 'active') return { memory: next, cues };
  const walkers = [
    ...w.carts
      .filter((cart) =>
        w.players.some(
          (player) => player.cartId === cart.id && player.role === 'driver',
        ),
      )
      .map((cart) => ({
        id: `driver:${cart.id}`,
        x: cart.x - Math.cos(cart.rotY) * 1.1,
        z: cart.z + Math.sin(cart.rotY) * 1.1,
        strength: cart.id === snapshot.localCartId ? 0.55 : 0.35,
      })),
    ...w.npcShoppers.map((npc) => ({
      id: `npc:${npc.id}`,
      x: npc.x,
      z: npc.z,
      strength: 0.3,
    })),
  ];
  for (const walker of walkers) {
    const before = memory.get(walker.id);
    let stride = before?.stride ?? 0;
    const seconds = before ? (w.clock - before.clock) / 1000 : 0;
    if (before && seconds > 0 && seconds < 1) {
      const distance = Math.hypot(walker.x - before.x, walker.z - before.z);
      const speed = distance / seconds;
      if (distance < 2 && speed > 0.4) {
        stride += distance;
        if (stride >= Math.min(2.6, 0.8 + speed * 0.22)) {
          stride = 0;
          cues.push({
            id: 'step.concrete',
            position: { x: walker.x, y: 0, z: walker.z },
            strength: walker.strength * Math.min(1, 0.6 + speed / 12),
            variant: true,
            sourceId: walker.id,
          });
        }
      } else if (distance >= 2) stride = 0;
    }
    next.set(walker.id, { x: walker.x, z: walker.z, stride, clock: w.clock });
  }
  return { memory: next, cues };
}

/** The score for a moment of the round. */
export function stampedeMusic(
  snapshot: SampleStampedeSnapshot,
  msSinceFinish = 0,
): (typeof MUSIC_CUES)[number] {
  const w = snapshot.world;
  if (w.status === 'warmup') return 'music.menu';
  if (w.status === 'finished')
    return msSinceFinish < STINGER_MS
      ? stampedeWon(snapshot)
        ? 'music.win'
        : 'music.fail'
      : 'music.menu';
  return w.timeRemaining <= TENSION_SECONDS
    ? 'music.tension'
    : 'stampede.store_muzak';
}

/** Loop levels from 0 to 1 for the warehouse beds and your own cart. */
export function stampedeAmbience(
  snapshot: SampleStampedeSnapshot,
): StampedeBeds {
  const w = snapshot.world;
  if (w.status !== 'active')
    return {
      warehouse: w.status === 'warmup' ? 0.6 : 0.5,
      shoppers: w.status === 'warmup' ? 0.25 : 0.15,
      checkout: 0,
      roll: 0,
      squeak: 0,
    };
  const me = stampedeLocalCart(snapshot);
  const speed = me ? speedOf(me) : 0;
  const kiosks = w.kiosks.filter((kiosk) => kiosk.active);
  const kioskDistance = me
    ? Math.min(
        ...kiosks.map((kiosk) => Math.hypot(kiosk.x - me.x, kiosk.z - me.z)),
      )
    : Infinity;
  const frenzy = kiosks.length ? 0.5 + 0.5 * clamp(1 - kioskDistance / 30) : 0;
  const exitDistance = me
    ? Math.hypot(me.x - w.exitGauntlet.x, me.z - w.exitGauntlet.z)
    : Infinity;
  const moving = speed >= 0.3;
  return {
    warehouse: 0.8,
    shoppers: clamp(
      0.3 + 0.35 * frenzy + (w.timeRemaining <= TENSION_SECONDS ? 0.3 : 0),
    ),
    checkout: Math.max(0.1, clamp(1 - exitDistance / 30)),
    roll: moving ? clamp(0.25 + speed / 10) : 0,
    squeak:
      me && moving ? clamp(me.wobbleIntensity * 0.85 + me.driftSlip / 8) : 0,
  };
}

/** Drops repeats that come sooner than `CUE_SPACING_MS` allows for their source. */
export function spaceCues(
  cues: readonly AudioEvent[],
  now: number,
  last: ReadonlyMap<string, number>,
) {
  const next = new Map(last);
  const kept = cues.filter((cue) => {
    const gap = CUE_SPACING_MS[cue.id];
    if (!gap) return true;
    const key = `${cue.id}:${cue.sourceId ?? ''}`;
    if (now - (next.get(key) ?? -Infinity) < gap) return false;
    next.set(key, now);
    return true;
  });
  return { cues: kept, last: next };
}

/**
 * One line per update: the most important. Urgent lines always speak;
 * incidental ones wait out the gap and never repeat themselves too soon.
 */
export function pickLine(
  cues: readonly AudioEvent[],
  now: number,
  lastLineAt: number,
  spoken: ReadonlyMap<string, number> = new Map(),
) {
  const rank = (id: string) => {
    const index = (LINE_PRIORITY as readonly string[]).indexOf(id);
    return index < 0 ? LINE_PRIORITY.length : index;
  };
  const id = cues
    .map((cue) => cue.id)
    .filter(
      (cueId) =>
        cueId.startsWith('speech.') &&
        (URGENT_LINES.has(cueId) ||
          now - (spoken.get(cueId) ?? -Infinity) >= LINE_REPEAT_MS),
    )
    .sort((a, b) => rank(a) - rank(b))[0];
  if (!id) return null;
  const urgent = URGENT_LINES.has(id);
  return urgent || now - lastLineAt >= SPEECH_GAP_MS ? { id, urgent } : null;
}
