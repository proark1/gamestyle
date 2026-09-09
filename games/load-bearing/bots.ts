import type { NpcSlot } from '../../shared/rooms/npc-slots';
import { PIANO_BAY } from './structure';
import {
  SWING_MS,
  SWING_REACH,
  alive,
  partBottom,
  partTop,
  type LoadWorld,
  type Part,
  type Wrecker,
} from './types';

/** How close a bot keeps to the piano bay. Competent crew work away from it. */
const PIANO_CLEARANCE = 3.2;
const NAMES = ['Mika', 'Jo', 'Nora', 'Sam'];

export function newBot(
  id: string,
  name: string,
  color: number,
  now: number,
  make: (id: string, name: string, color: number, now: number) => Wrecker,
): Wrecker {
  const bot = make(id, name, color, now);
  bot.bot = true;
  return bot;
}

/** Match the world's NPC seats to the host's roster, keeping humans in place. */
export function reconcileSiteNpcs(
  world: LoadWorld,
  slots: NpcSlot[],
  make: (id: string, name: string, color: number, now: number) => Wrecker,
) {
  const wanted = new Map(slots.map((slot) => [slot.id, slot]));
  world.players = world.players.filter((p) => !p.bot || wanted.has(p.id));
  for (const slot of slots)
    if (!world.players.some((p) => p.id === slot.id))
      world.players.push(
        newBot(
          slot.id,
          slot.name || NAMES[slot.color] || 'Crew',
          slot.color,
          world.clock,
          make,
        ),
      );
  world.players.sort((a, b) => a.color - b.color);
}

/** A bot only takes on work it can actually reach from the ground. */
function workable(world: LoadWorld, part: Part) {
  if (!alive(part) || part.falling) return false;
  if (partBottom(part) > 1.4) return false;
  if (partTop(part) < 0.5) return false;
  const toPiano = Math.hypot(part.x - PIANO_BAY.x, part.z - PIANO_BAY.z);
  return toPiano > PIANO_CLEARANCE;
}

function chooseTarget(world: LoadWorld, bot: Wrecker) {
  const options = world.parts.filter((part) => workable(world, part));
  if (!options.length) return undefined;
  // A part the crew has marked is the agreed plan; take that first.
  const marked = options.filter((part) => part.markedBy);
  const pool = marked.length ? marked : options;
  return pool.sort(
    (a, b) =>
      Math.hypot(a.x - bot.x, a.z - bot.z) - Math.hypot(b.x - bot.x, b.z - bot.z),
  )[0];
}

/**
 * Walk the NPC crew to the nearest sensible part and let them swing at it,
 * through exactly the same reach and cooldown rules a human obeys.
 */
export function driveBots(
  world: LoadWorld,
  swing: (world: LoadWorld, bot: Wrecker, part: Part) => void,
) {
  if (world.phase !== 'playing') return;
  for (const bot of world.players) {
    if (!bot.bot) continue;
    if (bot.down) {
      bot.input = { x: 0, z: 0, jump: false, seq: bot.input.seq };
      continue;
    }
    bot.seen = world.clock;
    const target = chooseTarget(world, bot);
    if (!target) {
      bot.input = { x: 0, z: 0, jump: false, seq: bot.input.seq };
      continue;
    }
    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const distance = Math.hypot(dx, dz);
    const stand = SWING_REACH * 0.7 + Math.max(target.w, target.d) / 2;
    if (distance > stand) {
      bot.input = {
        x: dx / (distance || 1),
        z: dz / (distance || 1),
        jump: false,
        seq: bot.input.seq,
      };
      continue;
    }
    bot.input = { x: 0, z: 0, jump: false, seq: bot.input.seq };
    bot.facing = Math.atan2(dx, dz);
    if (world.clock - bot.lastAction < SWING_MS * 1.35) continue;
    bot.lastAction = world.clock;
    bot.swingUntil = world.clock + SWING_MS;
    swing(world, bot, target);
  }
}
