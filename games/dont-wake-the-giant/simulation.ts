import {
  armPosition,
  atDoor,
  CHANDELIER,
  EXIT,
  FOOT,
  inSlipper,
  onTop,
  platforms,
  GIANT_PARTS,
  type Platform,
} from './level';
import {
  ESCAPE,
  HEIGHT,
  ITEM_NAMES,
  idleInput,
  NIGHT,
  RADIUS,
  type GiantAction,
  type GiantEvent,
  type GiantItem,
  type GiantPlayer,
  type GiantWorld,
  type ItemKind,
  type Reaction,
  type Vec,
} from './types';
import { handoffTarget } from './handoff';
import { ITEM_BURDEN, itemImpactNoise, landingNoise } from './noise';
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const distance = (a: Vec, b: Vec) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const zero = () => ({ x: 0, y: 0, z: 0 });
export function giantPlayer(
  id: string,
  name: string,
  color: number,
  now: number,
): GiantPlayer {
  return {
    id,
    name,
    color,
    x: -10.8 + (color % 2) * 0.9,
    y: 0,
    z: 7.5 + Math.floor(color / 2) * 0.9,
    angle: 2.5,
    velocity: zero(),
    grounded: true,
    support: 'floor',
    input: idleInput(),
    seen: now,
    lastJump: 0,
    stepAt: now,
    downUntil: 0,
    escaped: false,
    caught: false,
  };
}
function loot(
  id: string,
  kind: ItemKind,
  value: number,
  x: number,
  y: number,
  z: number,
  support: string,
): GiantItem {
  return {
    id,
    kind,
    value,
    x,
    y: y + 0.12,
    z,
    support,
    heldBy: null,
    banked: false,
    velocity: zero(),
    rotation: 0,
  };
}
export function freshGiant(now: number): GiantWorld {
  return {
    phase: 'lobby',
    clock: now,
    started: now,
    deadline: now + NIGHT,
    escapeAt: 0,
    players: [],
    items: [
      loot('entry-coins', 'coin', 15, -8.2, 0, 7.4, 'floor'),
      loot('book-coins', 'coin', 20, -5.3, 1.3, 4.6, 'book-two'),
      loot('bed-coins', 'coin', 20, 4.7, 2.6, 4.4, 'bed'),
      loot('pocket-coins', 'coin', 30, 2.5, 4.95, 0.3, 'belly'),
      loot('silver-cup', 'cup', 35, -6.6, 3.3, -2.6, 'nightstand'),
      loot('necklace', 'necklace', 80, 2, 4.95, -3.15, 'chest'),
      loot(
        'chandelier-coins',
        'coin',
        45,
        CHANDELIER.x,
        CHANDELIER.y,
        CHANDELIER.z,
        'chandelier',
      ),
      loot('slipper-coins', 'coin', 12, -9.2, 0, 2.7, 'floor'),
      loot('rug-coins', 'coin', 15, 8, 0, 5, 'floor'),
      loot('window-pouch', 'pouch', 25, 10.5, 0, -5.5, 'floor'),
      loot('bedside-gem', 'gem', 20, -10, 0, -5, 'floor'),
      loot('book-gem', 'gem', 25, -7.3, 0.65, 6.1, 'book-one'),
      loot('drawer-coins', 'coin', 15, -6.7, 0.9, 0.3, 'low-drawer'),
      loot('drawer-pouch', 'pouch', 30, -6.2, 1.85, -0.65, 'drawer'),
      loot('stool-coins', 'coin', 18, -3.5, 2.05, 3.4, 'stool'),
      loot('bed-pouch', 'pouch', 30, 5.6, 2.6, 2.2, 'bed'),
      loot('bed-cup', 'cup', 35, 5.5, 2.6, -4.5, 'bed'),
      loot('knee-gem', 'gem', 35, 3.2, 3.85, 3.2, 'knees'),
      loot('pocket-pouch', 'pouch', 45, 3.7, 4.95, -0.8, 'belly'),
      loot('shoulder-gem', 'gem', 45, 0, 4.95, -3.3, 'chest'),
      loot('crown', 'crown', 100, 2, 5.2, -6.3, 'head'),
      loot(
        'chandelier-gem',
        'gem',
        60,
        CHANDELIER.x + 1.5,
        CHANDELIER.y,
        CHANDELIER.z - 0.3,
        'chandelier',
      ),
      loot('pillow-1', 'pillow', 0, -9.2, 0, 5.4, 'floor'),
      loot('pillow-2', 'pillow', 0, -1.3, 2.6, 5.7, 'bed'),
      loot('pillow-3', 'pillow', 0, 5, 2.6, -6.6, 'bed'),
      loot('spoon', 'spoon', 0, -8, 0, -0.8, 'floor'),
    ],
    wakefulness: 0,
    nextReaction: 30,
    pending: null,
    armFrom: 0.7,
    armTo: 0.7,
    armAt: now,
    lastReaction: now - 20000,
    sneezeAt: 0,
    banked: 0,
    target: 120,
    events: [],
    serial: 0,
  };
}
export function giantSnapshot(
  world: GiantWorld,
  code: string,
  host: string,
  you: string,
  version: number,
) {
  return { world, code, host, you, version };
}
function event(
  w: GiantWorld,
  text: string,
  kind: GiantEvent['kind'],
  p: Vec = FOOT,
  strength = 1,
) {
  // Callers may pass a full player/item; never let its id or kind overwrite the event.
  w.events.push({
    id: ++w.serial,
    text,
    kind,
    x: p.x,
    y: p.y,
    z: p.z,
    strength,
    at: w.clock,
  });
  w.events = w.events.slice(-18);
}
export function warnGiant(
  w: GiantWorld,
  kind: Reaction,
  at = w.clock + (kind === 'wake' ? 3000 : 2200),
) {
  if (
    w.phase !== 'playing' ||
    w.pending?.kind === 'wake' ||
    (w.pending && kind !== 'wake')
  )
    return;
  w.pending = { kind, at };
  event(
    w,
    kind === 'roll'
      ? 'His arm is moving! Watch the bedside crossing.'
      : kind === 'sneeze'
        ? 'His nose is twitching. Brace for a sneeze!'
        : 'He is waking up! Find the glowing door!',
    kind,
  );
}
export function makeNoise(w: GiantWorld, amount: number, p: Vec, text: string) {
  if (w.phase !== 'playing' || amount < 0.1) return;
  w.wakefulness = clamp(w.wakefulness + amount, 0, 100);
  event(w, text, 'noise', p, amount);
  if (w.wakefulness >= 100) warnGiant(w, 'wake');
  else if (
    w.wakefulness >= w.nextReaction &&
    w.clock - w.lastReaction > 9000 &&
    !w.pending
  ) {
    warnGiant(w, w.nextReaction < 55 ? 'roll' : 'sneeze');
    w.nextReaction += 28;
  }
}
export function heldItem(w: GiantWorld, id: string) {
  return w.items.find((i) => i.heldBy === id);
}
function drop(w: GiantWorld, p: GiantPlayer, gentle = false) {
  const item = heldItem(w, p.id);
  if (!item) return;
  item.heldBy = null;
  item.support = null;
  item.x = p.x + Math.sin(p.angle) * 0.5;
  item.z = p.z + Math.cos(p.angle) * 0.5;
  item.y = p.y + (gentle && p.grounded ? 0.18 : 0.85);
  // Releasing in midair keeps momentum; it cannot erase the coming crash.
  item.velocity = p.grounded ? zero() : { ...p.velocity };
}
function bank(w: GiantWorld, p: GiantPlayer) {
  const item = heldItem(w, p.id);
  if (!item || !item.value) return false;
  item.banked = true;
  item.heldBy = null;
  item.support = null;
  w.banked += item.value;
  event(
    w,
    `${p.name} secured ${item.value} gold. ${w.banked}/${w.target} safe outside.`,
    'coin',
    EXIT,
  );
  return true;
}
function finishIfEmpty(w: GiantWorld) {
  if (w.players.length && w.players.every((p) => p.escaped || p.caught)) {
    w.phase = 'ended';
    w.pending = null;
  }
}
export function removeGiantPlayer(w: GiantWorld, id: string) {
  const p = w.players.find((p) => p.id === id);
  if (p) drop(w, p, true);
  w.players = w.players.filter((p) => p.id !== id);
  finishIfEmpty(w);
}
export function giantAction(
  w: GiantWorld,
  id: string,
  action: GiantAction,
  host: string,
) {
  const p = w.players.find((p) => p.id === id);
  if (!p) throw new Error('Rejoin the cottage to play.');
  if (action.type === 'start' || action.type === 'restart') {
    if (id !== host) throw new Error('Only the host can start a heist.');
    if (action.type === 'start' && w.phase !== 'lobby')
      throw new Error('The heist has already started.');
    if (action.type === 'restart' && w.phase !== 'ended')
      throw new Error('Finish this heist before restarting.');
    const next = freshGiant(w.clock);
    next.players = w.players.map((p) => ({
      ...giantPlayer(p.id, p.name, p.color, w.clock),
      input: { ...idleInput(), seq: p.input.seq },
    }));
    Object.assign(w, next, { phase: 'playing' });
    event(
      w,
      'Eight minutes until sunrise. Bank 120 gold at the glowing door.',
      'help',
      EXIT,
    );
    return;
  }
  if (!['playing', 'escape'].includes(w.phase) || p.escaped || p.caught)
    throw new Error('This thief is not inside the cottage.');
  if (p.downUntil > w.clock)
    throw new Error('You are dazed. A friend can help, or wait a moment.');
  if (action.type === 'exit') {
    if (!atDoor(p))
      throw new Error('Reach the glowing door to leave the cottage.');
    bank(w, p);
    drop(w, p, true);
    p.escaped = true;
    p.input = { ...idleInput(), seq: p.input.seq };
    event(w, `${p.name} made it outside!`, 'help', EXIT);
    finishIfEmpty(w);
    return;
  }
  if (action.type === 'drop') {
    drop(w, p, true);
    return;
  }
  if (action.type === 'pass') {
    const item = heldItem(w, id),
      receiver = handoffTarget(w, p);
    if (!item || !receiver)
      throw new Error(
        'Stand at the edge beside an empty-handed friend, up to one ledge below. Both need steady footing.',
      );
    item.heldBy = receiver.id;
    item.support = null;
    item.velocity = zero();
    item.x = receiver.x + Math.sin(receiver.angle) * 0.38;
    item.y = receiver.y + 0.7;
    item.z = receiver.z + Math.cos(receiver.angle) * 0.38;
    event(
      w,
      `${p.name} quietly passed ${ITEM_NAMES[item.kind].toLowerCase()} to ${receiver.name}.`,
      'help',
      receiver,
    );
    return;
  }
  if (action.type === 'rotate') {
    const item = heldItem(w, p.id);
    if (item?.kind === 'spoon') item.rotation = (item.rotation + 1) % 2;
    return;
  }
  if (action.type === 'tickle') {
    if (w.phase !== 'playing') throw new Error('He is already awake. Run!');
    if (distance(p, FOOT) > 2.3)
      throw new Error('Climb to his bare foot to tickle him.');
    if (w.pending || w.clock - w.lastReaction < 7000)
      throw new Error('Let him settle before another tickle.');
    makeNoise(w, 19, p, `${p.name} tickled his foot. That was a choice.`);
    // Tickle always warns a sneeze unless the added noise already triggered waking.
    if ((w.pending as GiantWorld['pending'])?.kind !== 'wake') {
      w.pending = null;
      warnGiant(w, 'sneeze');
    }
    return;
  }
  const down = w.players.find(
    (other) =>
      other.id !== id && other.downUntil > w.clock && distance(p, other) < 1.9,
  );
  if (action.type === 'help' || (action.type === 'interact' && down)) {
    if (!down) throw new Error('Stand beside a dazed friend to help them up.');
    down.downUntil = 0;
    event(w, `${p.name} helped ${down.name} up.`, 'help', down);
    return;
  }
  if (action.type === 'interact') {
    if (atDoor(p) && bank(w, p)) return;
    if (heldItem(w, id)) {
      if (handoffTarget(w, p)) {
        giantAction(w, id, { type: 'pass' }, host);
        return;
      }
      drop(w, p, true);
      return;
    }
    const item = w.items
      .filter(
        (i) =>
          !i.banked && !i.heldBy && distance({ ...p, y: p.y + 0.4 }, i) < 1.65,
      )
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (!item)
      throw new Error('Move closer to treasure or a tool, then grab it.');
    item.heldBy = id;
    item.support = null;
    item.velocity = zero();
    event(
      w,
      item.value
        ? `${p.name} grabbed ${item.value} gold. Bring it to the door.`
        : `${p.name} picked up the ${item.kind}.`,
      'help',
      p,
    );
  }
}
function carryWithSupport(
  p: Vec & { support: string | null },
  before: Platform[],
  after: Platform[],
) {
  const old = before.find((b) => b.id === p.support),
    next = after.find((b) => b.id === p.support);
  if (old && next) {
    p.x += next.x - old.x;
    p.y += next.y - old.y;
    p.z += next.z - old.z;
  }
}
function moveRestingItems(w: GiantWorld, before: Platform[]) {
  const moved = new Set<string>();
  const move = (item: GiantItem) => {
    if (moved.has(item.id) || item.heldBy || item.banked || !item.support)
      return;
    moved.add(item.id);
    if (item.support.startsWith('item:')) {
      const parent = w.items.find((i) => `item:${i.id}` === item.support);
      if (parent) move(parent);
    }
    carryWithSupport(item, before, platforms(w));
    // Keep a fixed clearance, including rooms created with older torso heights.
    if (GIANT_PARTS.includes(item.support) && !w.escapeAt) {
      const base = platforms(w).find((p) => p.id === item.support);
      if (base) item.y = base.y + 0.12;
    }
    // Existing rooms may still have treasure on the former, lower fixture.
    if (item.support === 'chandelier') item.y = CHANDELIER.y + 0.12;
  };
  w.items.forEach(move);
}
function collideHorizontal(
  p: GiantPlayer,
  surfaces: Platform[],
  axis: 'x' | 'z',
  amount: number,
) {
  p[axis] += amount;
  if (!amount) return;
  for (const b of surfaces) {
    if (
      b.id === 'floor' ||
      b.id === p.support ||
      b.passFromBelow ||
      p.y >= b.y - 0.04 ||
      p.y + HEIGHT < b.y - b.h + 0.03
    )
      continue;
    if (
      Math.abs(p.x - b.x) < b.w / 2 + RADIUS &&
      Math.abs(p.z - b.z) < b.d / 2 + RADIUS
    ) {
      p[axis] =
        b[axis] - Math.sign(amount) * ((axis === 'x' ? b.w : b.d) / 2 + RADIUS);
      p.velocity[axis] = 0;
    }
  }
  p.x = clamp(p.x, -13.6, 13.6);
  p.z = clamp(p.z, -11.6, 11.6);
}
function react(w: GiantWorld) {
  const kind = w.pending?.kind;
  if (!kind || w.clock < w.pending!.at) return;
  const reactionAt = w.pending!.at;
  w.pending = null;
  w.lastReaction = reactionAt;
  if (kind === 'wake') {
    w.phase = 'escape';
    w.escapeAt = reactionAt + ESCAPE;
    w.wakefulness = 100;
    // His torso is becoming a wall. Toss passengers clear before it rises,
    // including thieves on a pillow or spoon placed on his body.
    const onTorso = (
      support: string | null,
      visited = new Set<string>(),
    ): boolean => {
      if (!support || visited.has(support)) return false;
      if (GIANT_PARTS.includes(support)) return true;
      visited.add(support);
      return (
        support.startsWith('item:') &&
        onTorso(
          w.items.find((i) => `item:${i.id}` === support)?.support ?? null,
          visited,
        )
      );
    };
    const loose = w.items.filter(
      (i) => !i.banked && !i.heldBy && onTorso(i.support),
    );
    for (const p of w.players) {
      if (p.escaped || p.caught || !onTorso(p.support)) continue;
      const side = p.x < 2 ? -1 : 1;
      p.x = side < 0 ? Math.min(p.x, -1.35) : Math.max(p.x, 5.35);
      p.support = null;
      p.grounded = false;
      p.velocity = { x: side * 2.8, y: 5, z: 1.5 };
    }
    for (const item of loose) {
      item.support = null;
      item.velocity = { x: item.x < 2 ? -3 : 3, y: 2.5, z: 1 };
    }
    event(
      w,
      'HE IS STANDING UP! Hold onto your loot. 25 seconds to reach the door!',
      'wake',
      FOOT,
      25,
    );
  } else if (kind === 'roll') {
    w.armFrom = armPosition(w);
    w.armTo = w.armTo < 0 ? 0.7 : -2.5;
    w.armAt = w.clock;
    event(
      w,
      'The giant shifted his arm. A different crossing is open.',
      'roll',
      FOOT,
    );
  } else {
    w.sneezeAt = w.clock;
    for (const p of w.players)
      if (
        !p.escaped &&
        !p.caught &&
        !inSlipper(p) &&
        Math.hypot(p.x - 2, p.z + 0.8) < 9
      ) {
        // Clear the higher platform by 1.5 units, then land without a dazing impact.
        p.velocity.y =
          p.y > 3.7
            ? Math.sqrt(2 * 18 * Math.max(3.24, CHANDELIER.y + 1.5 - p.y))
            : 7.8;
        // Belly launches land within reach of the chandelier, rather than arbitrarily off-map.
        p.velocity.x = clamp((CHANDELIER.x - p.x) * 1.2, -4, 4);
        p.velocity.z = clamp((CHANDELIER.z - p.z) * 1.2, -4, 4);
        p.grounded = false;
        p.support = null;
        drop(w, p);
      }
    for (const item of w.items)
      if (
        !item.banked &&
        !item.heldBy &&
        item.kind !== 'pillow' &&
        item.kind !== 'spoon' &&
        distance(item, { x: 2, y: 3, z: 0 }) < 7
      ) {
        item.support = null;
        item.velocity.y = 5;
      }
    event(
      w,
      'AAAA-CHOO! Watch for the chandelier!',
      'sneeze',
      { x: 2, y: 4.8, z: -5.6 },
      25,
    );
  }
}
function tick(w: GiantWorld, dt: number) {
  const before = platforms(w);
  w.clock += dt * 1000;
  react(w);
  moveRestingItems(w, before);
  const surfaces = platforms(w);
  for (const p of w.players) {
    if (p.escaped || p.caught) continue;
    if (p.grounded) carryWithSupport(p, before, surfaces);
    if (p.grounded && p.support === 'chandelier') p.y = CHANDELIER.y;
    const enabled = w.clock - p.seen < 1200 && p.downUntil <= w.clock;
    const input = enabled ? p.input : idleInput();
    const carried = heldItem(w, p.id);
    const mag = Math.max(1, Math.hypot(input.x, input.z));
    const speed =
      (input.crouch ? 1.85 : 4.2) *
      (heldItem(w, p.id)?.kind === 'spoon' ? 0.8 : 1);
    const blend = p.grounded ? 1 : Math.min(1, dt * 2.8);
    p.velocity.x += ((input.x / mag) * speed - p.velocity.x) * blend;
    p.velocity.z += ((input.z / mag) * speed - p.velocity.z) * blend;
    if (input.x || input.z) p.angle = Math.atan2(input.x, input.z);
    if (input.jump && p.grounded && w.clock - p.lastJump > 260) {
      p.velocity.y = 7.5;
      p.grounded = false;
      p.support = null;
      p.lastJump = w.clock;
    }
    p.input.jump = false;
    collideHorizontal(p, surfaces, 'x', p.velocity.x * dt);
    collideHorizontal(p, surfaces, 'z', p.velocity.z * dt);
    const supporting = surfaces.find((b) => b.id === p.support);
    if (p.grounded && (!supporting || !onTop(p, supporting, RADIUS * 0.45))) {
      p.grounded = false;
      p.support = null;
    }
    if (!p.grounded) {
      const previousY = p.y;
      p.velocity.y -= 18 * dt;
      p.y += p.velocity.y * dt;
      const landing = surfaces
        .filter(
          (b) =>
            onTop(p, b, RADIUS * 0.5) &&
            p.velocity.y <= 0 &&
            previousY >= b.y - 0.12 &&
            p.y <= b.y,
        )
        .sort((a, b) => b.y - a.y)[0];
      if (landing) {
        const impact = -p.velocity.y;
        p.y = landing.y;
        p.grounded = true;
        p.support = landing.id;
        p.velocity.y = 0;
        const cushion = landing.soft || inSlipper(p);
        if (impact > 3)
          makeNoise(
            w,
            landingNoise(
              impact,
              carried,
              input.crouch,
              cushion ? (GIANT_PARTS.includes(landing.id) ? 0.45 : 0.12) : 1,
            ),
            p,
            cushion
              ? 'A soft landing. Good thinking.'
              : carried && ITEM_BURDEN[carried.kind] > 0
                ? `${p.name} landed hard with ${ITEM_NAMES[carried.kind].toLowerCase()}! Pass it down first.`
                : `${p.name} landed with a thud.`,
          );
        if (impact > 12 && !cushion) {
          p.downUntil = w.clock + 4500;
          drop(w, p);
          event(w, `${p.name} is dazed. A nearby friend can help.`, 'help', p);
        }
      }
    }
    if (
      p.grounded &&
      Math.hypot(input.x, input.z) > 0.1 &&
      w.clock - p.stepAt > 650
    ) {
      p.stepAt = w.clock;
      if (!input.crouch && !inSlipper(p))
        makeNoise(
          w,
          (p.support === 'floor' ? 0.9 : 0.55) *
            (1 + (carried ? ITEM_BURDEN[carried.kind] : 0)),
          p,
          `${p.name}'s footsteps.`,
        );
    }
  }
  for (const item of w.items) {
    if (item.banked) continue;
    const holder = w.players.find((p) => p.id === item.heldBy);
    if (holder) {
      item.x = holder.x + Math.sin(holder.angle) * 0.38;
      item.y = holder.y + 0.7;
      item.z = holder.z + Math.cos(holder.angle) * 0.38;
      continue;
    }
    const base = surfaces.find((b) => b.id === item.support);
    if (base && onTop(item, base)) continue;
    item.support = null;
    const py = item.y;
    item.velocity.y -= 18 * dt;
    item.x = clamp(item.x + item.velocity.x * dt, -13.5, 13.5);
    item.z = clamp(item.z + item.velocity.z * dt, -11.5, 11.5);
    item.y += item.velocity.y * dt;
    const landing = surfaces
      .filter(
        (b) =>
          b.id !== `item:${item.id}` &&
          onTop(item, b) &&
          item.velocity.y <= 0 &&
          py >= b.y - 0.02 &&
          item.y <= b.y + 0.12,
      )
      .sort((a, b) => b.y - a.y)[0];
    if (landing) {
      const impact = -item.velocity.y;
      item.y = landing.y + 0.12;
      item.support = landing.id;
      item.velocity = zero();
      if (impact > 2 && item.kind !== 'pillow')
        makeNoise(
          w,
          itemImpactNoise(
            impact,
            item,
            landing.soft ? (GIANT_PARTS.includes(landing.id) ? 0.45 : 0.12) : 1,
          ),
          item,
          landing.soft
            ? `The ${ITEM_NAMES[item.kind].toLowerCase()} landed softly.`
            : `CRASH! ${ITEM_NAMES[item.kind]} hit the floor.`,
        );
    }
  }
  if (w.phase === 'playing') {
    w.wakefulness = Math.max(0, w.wakefulness - dt * 0.22);
    if (w.clock >= w.deadline) warnGiant(w, 'wake');
  }
  if (w.phase === 'escape' && w.clock >= w.escapeAt) {
    for (const p of w.players)
      if (!p.escaped) {
        p.caught = true;
        drop(w, p, true);
      }
    w.phase = 'ended';
    event(
      w,
      'The giant found the remaining thieves. Banked treasure is safe.',
      'wake',
    );
  }
  finishIfEmpty(w);
}
export function advanceGiant(w: GiantWorld, now: number) {
  if (now <= w.clock) return;
  if (w.phase === 'lobby' || w.phase === 'ended') {
    w.clock = now;
    return;
  }
  if (w.phase === 'playing' && now >= w.deadline)
    warnGiant(w, 'wake', w.deadline + 3000);
  // Bound catch-up work after an idle room; preserve wall-clock deadlines.
  if (now - w.clock > 2500) {
    const skip = now - w.clock - 2500;
    const old = platforms(w);
    w.clock += skip;
    moveRestingItems(w, old);
    const next = platforms(w);
    for (const p of w.players) if (p.grounded) carryWithSupport(p, old, next);
  }
  while (now - w.clock > 0.01 && ['playing', 'escape'].includes(w.phase))
    tick(w, Math.min(1 / 60, (now - w.clock) / 1000));
  w.clock = now;
}
export function giantHint(w: GiantWorld, id: string) {
  const p = w.players.find((p) => p.id === id);
  if (!p) return 'Four tiny thieves. One enormous nap.';
  if (p.escaped)
    return 'You made it outside. Watch your friends finish the heist.';
  if (p.caught) return 'Caught! Your banked treasure is safe outside.';
  if (p.downUntil > w.clock)
    return `Dazed · help arrives in ${Math.ceil((p.downUntil - w.clock) / 1000)}s, or a friend can help now.`;
  if (atDoor(p))
    return heldItem(w, id)?.value
      ? 'E · Bank treasure   /   X · Leave the cottage'
      : 'X · Leave the cottage with your share';
  if (w.phase === 'escape')
    return 'He is wide awake! Run to the glowing door. X · Escape with your loot';
  const receiver = handoffTarget(w, p);
  if (receiver)
    return `E · Pass quietly to ${receiver.name}${receiver.y < p.y - 0.4 ? ' below' : ''}   /   Q · Place`;
  if (distance(p, FOOT) < 2.3)
    return 'F · Tickle his foot. A sneeze can launch you to the chandelier.';
  if (heldItem(w, id)?.kind === 'pillow')
    return 'Q · Place a pillow to cushion a landing';
  if (heldItem(w, id)?.kind === 'spoon')
    return 'R · Turn the teaspoon   /   Q · Place your bridge';
  if (heldItem(w, id))
    return 'Loaded landings are louder. E · Pass to a friend at the edge   /   Q · Place';
  return 'E · Grab nearby treasure   /   Shift · Creep quietly';
}
