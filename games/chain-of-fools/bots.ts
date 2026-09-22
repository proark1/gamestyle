import { FINISH_X, NET, laneZ } from './course';
import { climbAhead, supportUnder } from './physics';
import { newPlayer } from './simulation';
import {
  CHAIN_SLACK,
  CREW_SIZE,
  HAUL_REACH,
  chainOrder,
  idleInput,
  type ChainWorld,
  type Player,
} from './types';

const BOT_NAMES = ['Rigger Rita', 'Bolt Benny', 'Clamp Carla', 'Hook Hugo'];

/** Keep the line four workers long, humans first, bots filling the rest. */
export function reconcileChainBots(world: ChainWorld) {
  const humans = world.players.filter((p) => !p.bot);
  const needed = Math.max(0, CREW_SIZE - humans.length);
  const bots = world.players.filter((p) => p.bot).slice(0, needed);

  while (bots.length < needed) {
    const index = bots.length;
    let number = 1;
    while (bots.some((p) => p.id === `bot-${number}`)) number++;
    bots.push(
      newPlayer(
        `bot-${number}`,
        BOT_NAMES[index % BOT_NAMES.length],
        (humans.length + index + 1) % 4,
        0,
        true,
      ),
    );
  }

  world.players = [...humans, ...bots];
  world.players.forEach((player, index) => {
    player.link = index;
  });
}

/** Whoever is one link further up the line: the worker this bot follows. */
function leaderOf(bot: Player, world: ChainWorld): Player | null {
  return world.players.find((p) => p.link === bot.link - 1) ?? null;
}

/** The neighbour further back down the course, who must not be left behind. */
function trailingNeighbour(bot: Player, world: ChainWorld): Player | null {
  const order = chainOrder(world);
  const index = order.findIndex((p) => p.id === bot.id);
  if (index < 0) return null;
  const neighbours = [order[index - 1], order[index + 1]].filter(Boolean);
  let worst: Player | null = null;
  for (const neighbour of neighbours) {
    if (!worst || neighbour.x < worst.x) worst = neighbour;
  }
  return worst;
}

export function stepChainBot(bot: Player, world: ChainWorld, _dt: number) {
  bot.input = idleInput();
  if (world.phase !== 'playing') return;
  if (bot.state === 'finished' || bot.state === 'limp') return;
  if (bot.respawnAt > world.clock) return;

  // Hanging on the line: kick off the wall and let the crew do the work.
  if (bot.state === 'dangling') {
    bot.input.jump = true;
    return;
  }

  // Somebody needs pulling up. That comes before making any more ground.
  const inTrouble = world.players.find(
    (other) =>
      other.id !== bot.id &&
      (other.state === 'dangling' || other.state === 'limp') &&
      Math.hypot(other.x - bot.x, other.z - bot.z) <= HAUL_REACH * 1.6,
  );
  if (inTrouble && bot.grounded) {
    bot.input.haul = true;
    const gap = Math.hypot(inTrouble.x - bot.x, inTrouble.z - bot.z);
    if (gap > HAUL_REACH * 0.7) {
      bot.input.x = Math.sign(inTrouble.x - bot.x) * 0.6;
      bot.input.z = Math.sign(inTrouble.z - bot.z) * 0.6;
    }
    return;
  }

  // Anyone below and pulling means planting the boots instead of walking.
  const dragging = world.players.some(
    (other) =>
      other.id !== bot.id &&
      other.state === 'dangling' &&
      Math.hypot(other.x - bot.x, other.z - bot.z) < CHAIN_SLACK * 1.5,
  );
  if (dragging && bot.grounded) {
    bot.input.brace = true;
    return;
  }

  if (bot.x >= FINISH_X) return;

  // Do not out-walk the far end of the line.
  const trailing = trailingNeighbour(bot, world);
  if (trailing && bot.x - trailing.x > CHAIN_SLACK * 0.85) {
    if (
      trailing.link < bot.link &&
      bot.grounded &&
      Math.abs(trailing.y - bot.y) < 0.6
    )
      bot.input.x = -0.4;
    if (trailing.state === 'dangling' || trailing.state === 'limp') {
      bot.input.brace = true;
    }
    return;
  }

  // Follow the route whoever is ahead on the line chose: their line across,
  // and never past them. The front of the line picks its own way.
  const leader = leaderOf(bot, world);
  const following =
    !!leader && leader.state !== 'finished' && Math.abs(leader.x - bot.x) < 7;
  // The net is wide enough to climb down side by side.
  const atNet = Math.abs(bot.x - NET.x) < 3 && bot.y > NET.minY + 0.5;
  const targetZ = atNet
    ? (bot.link - 1.5) * 1.2
    : following
      ? leader.z
      : laneZ(bot.x, bot.y);
  const lane = targetZ - bot.z;
  bot.input.z =
    Math.abs(lane) > 0.15 ? Math.max(-0.8, Math.min(0.8, lane * 1.6)) : 0;
  // Hang back behind the worker ahead, unless they have gone down a level:
  // then the way on is down after them.
  if (following && bot.x > leader.x - 1.0 && leader.y >= bot.y - 1.2) {
    if (bot.grounded && bot.x > leader.x - 0.6) bot.input.x = -0.4;
    return;
  }

  // Forward, which on the cargo net also means down it.
  bot.input.x = 1;

  if (!bot.grounded) return;

  // Look at the boots' own level rather than at any absolute height: a drop to
  // the low road reads as a gap exactly like open air does.
  const level = (probe: number) => {
    const support = supportUnder(probe, bot.y, bot.z, world.plankTilt);
    return support !== null && Math.abs(support - bot.y) < 0.6;
  };

  const lip = !level(bot.x + 0.9);
  const stepUp = climbAhead(bot.x + 0.9, bot.y, bot.z, 1.35) !== null;

  // A gap is worth jumping only when there is somewhere to land on the far side.
  let landing = false;
  for (let reach = 1.4; reach <= 4.0 && !landing; reach += 0.4) {
    if (level(bot.x + reach)) landing = true;
  }

  // If the worker ahead dropped to the low road, walk off after them instead.
  const leaderBelow = following && leader.y < bot.y - 1.2;
  if (stepUp || (lip && landing && !leaderBelow)) bot.input.jump = true;
}
