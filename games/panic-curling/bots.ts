import { launchDelivery, newCurlingPlayer } from './simulation';
import {
  FAR_HOG_Z,
  STONE_CONFIGS,
  TEE_Z,
  type CurlingPlayer,
  type PanicCurlingWorld,
  type Role,
  type StoneKind,
  type TeamId,
} from './types';

const BOT_NAMES = [
  'Barnaby Sweep',
  'Frosty Phil',
  'Blizzard Bob',
  'Gale Glider',
  'Iggy Iceman',
  'Penny Pebble',
  'Torch Tim',
  'Skip Stanley',
];

/** Ensures the world has enough players by filling empty slots with funny bots. */
export function reconcileCurlingBots(world: PanicCurlingWorld) {
  const teams: TeamId[] = ['red', 'blue'];
  const neededRoles: Role[] = ['deliverer', 'sweeper', 'defender'];

  let nameIndex = 0;

  for (const team of teams) {
    // If a human deliverer exists on this team, remove any AI deliverer on this team
    const hasHumanDeliverer = world.players.some(
      (p) => !p.bot && p.team === team && p.role === 'deliverer',
    );
    if (hasHumanDeliverer) {
      world.players = world.players.filter(
        (p) => !(p.bot && p.team === team && p.role === 'deliverer'),
      );
    }

    for (const role of neededRoles) {
      const exists = world.players.some(
        (p) => p.team === team && p.role === role,
      );
      if (!exists) {
        const id = `bot-${team}-${role}-${Date.now()}-${nameIndex}`;
        const name = BOT_NAMES[nameIndex % BOT_NAMES.length];
        const color = team === 'red' ? 0 : 1;
        world.players.push(newCurlingPlayer(id, name, color, team, role, true));
        nameIndex++;
      }
    }
  }
}

/** Updates AI bot decision making every tick. */
export function updateCurlingBots(world: PanicCurlingWorld, dt: number) {
  for (const bot of world.players) {
    if (!bot.bot) continue;

    // Reset default inputs
    bot.input.x = 0;
    bot.input.z = 0;
    bot.input.sweep = false;
    bot.input.steer = 0;
    bot.input.rescue = false;

    // Slipping bots can't act
    if (bot.status === 'slipping') continue;

    // Role specific behavior
    if (world.phase === 'aiming') {
      if (bot.team === world.turnTeam && bot.role === 'deliverer') {
        // Human deliverers take priority: never auto-deliver if a human deliverer is present!
        const hasHumanDeliverer = world.players.some(
          (p) => !p.bot && p.team === world.turnTeam && p.role === 'deliverer',
        );
        if (hasHumanDeliverer) continue;

        // AI Deliverer waits briefly then launches stone
        if (world.phaseTimer > 1.8) {
          botDeliverStone(world, bot);
        }
      }
    } else if (world.phase === 'sliding') {
      const activeStone = world.stones.find(
        (s) => s.id === world.activeStoneId,
      );
      if (!activeStone || activeStone.stopped) continue;

      if (bot.role === 'sweeper') {
        updateSweeperBot(world, bot, activeStone, dt);
      } else if (bot.role === 'defender') {
        updateDefenderBot(world, bot, activeStone);
      }
    }
  }
}

function botDeliverStone(world: PanicCurlingWorld, bot: CurlingPlayer) {
  // Target center of the house
  const targetX = (Math.random() - 0.5) * 0.4;
  const targetZ = TEE_Z + (Math.random() - 0.5) * 0.6;

  const dx = targetX - bot.x;
  const dz = targetZ - bot.z;
  const angle = Math.atan2(dx, dz);

  // Power calibration (roughly 0.48 to 0.62)
  const power = 0.52 + (Math.random() - 0.5) * 0.12;
  const spin = Math.random() < 0.5 ? 1 : -1;

  // Pick stone
  const kinds: StoneKind[] = ['granite', 'granite', 'anvil', 'basket'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];

  launchDelivery(world, power, angle, spin, kind);
}

function updateSweeperBot(
  _world: PanicCurlingWorld,
  bot: CurlingPlayer,
  stone: import('./types').Stone,
  _dt: number,
) {
  if (bot.team === stone.team) {
    // Decide whether to sweep
    // Estimated stopping distance: z + v^2 / (2 * mu * g)
    const cfg = STONE_CONFIGS[stone.kind];
    const speed = Math.hypot(stone.vx, stone.vz);
    const estStopZ = stone.z + (speed * speed) / (2 * cfg.baseFriction * 9.81);

    // If stone will stop short of tee, sweep hard to reduce friction and extend slide!
    if (estStopZ < TEE_Z + 0.8 && stone.z < TEE_Z + 1.5) {
      bot.input.sweep = true;
      bot.sweepIntensity = 1.0;
    }

    // Steer if stone is curling off-center
    if (stone.x > 0.35) {
      bot.input.steer = -1; // steer left toward button center
      bot.steerDir = -1;
    } else if (stone.x < -0.35) {
      bot.input.steer = 1; // steer right toward button center
      bot.steerDir = 1;
    }
  }
}

function updateDefenderBot(
  world: PanicCurlingWorld,
  bot: CurlingPlayer,
  stone: import('./types').Stone,
) {
  if (bot.team !== stone.team) {
    // Saboteur: throw banana peel ahead of opponent stone!
    if (bot.bananasLeft > 0 && stone.z > 8.0 && stone.z < FAR_HOG_Z) {
      const dist = Math.hypot(stone.x - bot.x, stone.z - bot.z);
      if (dist < 3.5) {
        // Toss banana
        bot.bananasLeft--;
        world.hazards.push({
          id: `banana-bot-${Date.now()}`,
          x: stone.x + (Math.random() - 0.5) * 0.4,
          z: stone.z + 2.5,
          active: true,
          team: bot.team,
        });
      }
    }
  }
}
