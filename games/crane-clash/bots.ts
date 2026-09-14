import {
  CRANE_CONFIG,
  ROLES,
  TEAMS,
  type CraneClashWorld,
  type Player,
  type Role,
  type TeamId,
} from './types';
import { newPlayer } from './simulation';
import { CraneClashPhysics, GRAB_REACH } from './physics';

const BOT_NAMES: Record<TeamId, Record<Role, string>> = {
  orange: {
    operator: 'Kran-Klaus (Bot)',
    swinger: 'Schwing-Susi (Bot)',
  },
  teal: {
    operator: 'Hebe-Helmut (Bot)',
    swinger: 'Pendel-Peter (Bot)',
  },
};

const BOT_COLORS: Record<TeamId, Record<Role, number>> = {
  orange: { operator: 0, swinger: 1 },
  teal: { operator: 2, swinger: 3 },
};

export function reconcileClashBots(w: CraneClashWorld) {
  for (const team of TEAMS) {
    for (const role of ROLES) {
      const human = w.players.find(
        (p) => !p.bot && p.team === team && p.role === role,
      );
      const existingBot = w.players.find(
        (p) => p.bot && p.team === team && p.role === role,
      );

      if (human) {
        // If a human is here, remove any bot occupying this slot
        if (existingBot) {
          w.players = w.players.filter((p) => p.id !== existingBot.id);
        }
      } else {
        // No human in this slot, ensure a bot is present
        if (!existingBot) {
          const botId = `bot-${team}-${role}`;
          const bot = newPlayer(
            botId,
            BOT_NAMES[team][role],
            BOT_COLORS[team][role],
            team,
            role,
            true,
          );
          w.players.push(bot);
        }
      }
    }
  }
}

export function driveBots(w: CraneClashWorld) {
  for (const p of w.players) {
    if (!p.bot) continue;

    if (p.role === 'operator') {
      driveOperatorBot(w, p);
    } else if (p.role === 'swinger') {
      driveSwingerBot(w, p);
    }
  }
}

function driveOperatorBot(w: CraneClashWorld, bot: Player) {
  const team = bot.team;
  const crane = w.cranes[team];
  const cfg = CRANE_CONFIG[team];
  const partner = w.players.find(
    (other) => other.team === team && other.role === 'swinger',
  );

  let targetX = cfg.pad.x;
  let targetZ = cfg.pad.z;
  let targetHookY = 5.0;

  if (partner?.holdingCrateId) {
    // Partner has a crate! Move trolley over the team build pad
    targetX = cfg.pad.x;
    targetZ = cfg.pad.z;
    const currentTowerHeight = w.scores[team].height;
    targetHookY = Math.max(4.0, currentTowerHeight + 3.2);
  } else {
    // Partner needs a crate: target nearest unheld crate in the yard
    let bestDist = 999;
    for (const crate of w.crates) {
      if (crate.heldBy) continue;
      const d = Math.hypot(crate.x - cfg.mast.x, crate.z - cfg.mast.z);
      if (d >= cfg.reachMin && d <= cfg.reachMax && d < bestDist) {
        bestDist = d;
        targetX = crate.x;
        targetZ = crate.z;
      }
    }
    targetHookY = 2.0; // Lower cable so swinger can grab
  }

  // Slew angle towards target
  const targetAngle = Math.atan2(targetZ - cfg.mast.z, targetX - cfg.mast.x);
  let angleDiff = targetAngle - crane.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  let slewInput = 0;
  if (Math.abs(angleDiff) > 0.05) {
    slewInput = Math.sign(angleDiff);
  }

  // Trolley distance
  const targetDist = Math.hypot(targetX - cfg.mast.x, targetZ - cfg.mast.z);
  const distDiff = targetDist - crane.trolleyDist;
  let trolleyInput = 0;
  if (Math.abs(distDiff) > 0.3) {
    trolleyInput = Math.sign(distDiff);
  }

  // Hoist up / down
  let hoistInput = 0;
  const currentHookY = crane.hookY;
  if (currentHookY < targetHookY - 0.4) {
    hoistInput = 1; // Hoist UP
  } else if (currentHookY > targetHookY + 0.4) {
    hoistInput = -1; // Hoist DOWN
  }

  bot.input = {
    x: slewInput,
    z: trolleyInput,
    y: hoistInput,
    seq: (bot.input.seq + 1) % 10000,
  };
  bot.seen = w.clock;
}

function driveSwingerBot(w: CraneClashWorld, bot: Player) {
  const team = bot.team;
  const cfg = CRANE_CONFIG[team];
  const crane = w.cranes[team];

  if (!bot.holdingCrateId) {
    // Search for crate within reach to grab
    let targetCrate = null;
    let bestDist = GRAB_REACH;
    for (const crate of w.crates) {
      if (crate.heldBy) continue;
      const d = Math.hypot(
        crate.x - crane.hookX,
        crate.y - crane.hookY,
        crate.z - crane.hookZ,
      );
      if (d < bestDist) {
        bestDist = d;
        targetCrate = crate;
      }
    }

    if (targetCrate) {
      // Within reach! Perform grab
      const physics = new CraneClashPhysics(w);
      physics.grabCrate(bot);
      bot.input = { x: 0, z: 0, grab: true, seq: bot.input.seq + 1 };
      bot.seen = w.clock;
      return;
    }

    // Otherwise swing towards nearest crate
    let nearestCrate = null;
    let minD = 999;
    for (const crate of w.crates) {
      if (crate.heldBy) continue;
      const d = Math.hypot(crate.x - crane.hookX, crate.z - crane.hookZ);
      if (d < minD) {
        minD = d;
        nearestCrate = crate;
      }
    }

    let swingX = 0;
    let swingZ = 0;
    if (nearestCrate) {
      const dx = nearestCrate.x - crane.hookX;
      const dz = nearestCrate.z - crane.hookZ;
      const len = Math.hypot(dx, dz);
      if (len > 0.2) {
        swingX = dx / len;
        swingZ = dz / len;
      }
    }

    bot.input = { x: swingX, z: swingZ, seq: bot.input.seq + 1 };
    bot.seen = w.clock;
  } else {
    // Holding crate: swing towards build pad
    const padX = cfg.pad.x;
    const padZ = cfg.pad.z;
    const distToPad = Math.hypot(crane.hookX - padX, crane.hookZ - padZ);

    if (distToPad < 1.8 && crane.hookVy < 0.8 && crane.hookVy > -1.2) {
      // Directly above pad and stable: drop the crate!
      const physics = new CraneClashPhysics(w);
      physics.releaseCrate(bot);
      bot.input = { x: 0, z: 0, grab: false, seq: bot.input.seq + 1 };
      bot.seen = w.clock;
      return;
    }

    // Pump swing towards the pad
    const dx = padX - crane.hookX;
    const dz = padZ - crane.hookZ;
    const len = Math.hypot(dx, dz);
    bot.input = {
      x: len > 0.1 ? dx / len : 0,
      z: len > 0.1 ? dz / len : 0,
      seq: bot.input.seq + 1,
    };
    bot.seen = w.clock;
  }
}
