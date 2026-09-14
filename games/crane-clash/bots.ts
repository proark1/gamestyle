import {
  CRANE_CONFIG,
  CRATE_CONFIGS,
  PAD_Y,
  ROLES,
  TEAMS,
  clamp,
  type Crate,
  type CraneClashWorld,
  type Role,
  type TeamId,
} from './types';
import { emitEvent, newPlayer } from './simulation';
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

function normalizeAngle(a: number): number {
  let angle = a;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

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
  for (const team of TEAMS) {
    const humans = w.players.filter((p) => !p.bot && p.team === team);
    if (humans.length === 0) {
      // Both slots are bots: execute coordinated 2-bot teamwork!
      driveCooperativeTeamBots(w, team);
    } else if (humans.length === 1) {
      // Solo human on this team controls both crane and swinger!
      // Keep any bot on this team idle so it doesn't fight the human's input.
      const botPartner = w.players.find((p) => p.bot && p.team === team);
      if (botPartner) {
        botPartner.input = {
          x: 0,
          z: 0,
          y: 0,
          craneX: 0,
          craneZ: 0,
          craneY: 0,
          grab: false,
          seq: botPartner.input.seq + 1,
        };
        botPartner.seen = w.clock;
      }
    }
    // If humans.length >= 2, humans are driving their respective roles.
  }
}

export function getTeamTargetCrate(
  w: CraneClashWorld,
  team: TeamId,
): Crate | null {
  const cfg = CRANE_CONFIG[team];
  let bestCrate: Crate | null = null;
  let bestScore = -Infinity;

  for (const crate of w.crates) {
    if (crate.heldBy) continue;
    if (crate.teamPad) continue; // Don't steal crates already stacked on a pad

    // Must be within reach of the crane jib
    const distFromMast = Math.hypot(crate.x - cfg.mast.x, crate.z - cfg.mast.z);
    if (
      distFromMast < cfg.reachMin + 0.3 ||
      distFromMast > cfg.reachMax - 0.3
    ) {
      continue;
    }
    // Must be on/near the ground
    if (crate.y < 0 || crate.y > 10) continue;

    const config = CRATE_CONFIGS[crate.kind];
    let score = config.points * 30; // Golden = 90, Block/Beam = 60, Crate/Barrel = 30
    // Prefer crates closer to the build platform for faster cycling
    const distToPad = Math.hypot(crate.x - cfg.pad.x, crate.z - cfg.pad.z);
    score -= distToPad * 2.2;

    if (score > bestScore) {
      bestScore = score;
      bestCrate = crate;
    }
  }

  return bestCrate;
}

function driveCooperativeTeamBots(w: CraneClashWorld, team: TeamId) {
  const operator = w.players.find(
    (p) => p.bot && p.team === team && p.role === 'operator',
  );
  const swinger = w.players.find(
    (p) => p.bot && p.team === team && p.role === 'swinger',
  );
  if (!operator || !swinger) return;

  const cfg = CRANE_CONFIG[team];
  const crane = w.cranes[team];
  const padX = cfg.pad.x;
  const padZ = cfg.pad.z;
  const towerH = w.scores[team].height;

  if (!swinger.holdingCrateId) {
    // ============================================
    // PHASE 1: RETRIEVE CRATE
    // ============================================
    const targetCrate = getTeamTargetCrate(w, team);
    if (!targetCrate) {
      // Idle over pad
      operator.input = {
        x: 0,
        z: 0,
        y: 0,
        seq: (operator.input.seq + 1) % 10000,
      };
      swinger.input = { x: 0, z: 0, seq: (swinger.input.seq + 1) % 10000 };
      return;
    }

    // Operator targets the crate
    const targetAngle = Math.atan2(
      targetCrate.z - cfg.mast.z,
      targetCrate.x - cfg.mast.x,
    );
    const targetDist = Math.hypot(
      targetCrate.x - cfg.mast.x,
      targetCrate.z - cfg.mast.z,
    );

    const angleDiff = normalizeAngle(targetAngle - crane.angle);
    const distDiff = targetDist - crane.trolleyDist;

    let slewInput = 0;
    if (Math.abs(angleDiff) > 0.03) {
      slewInput = Math.sign(angleDiff);
    }

    let trolleyInput = 0;
    if (Math.abs(distDiff) > 0.2) {
      trolleyInput = Math.sign(distDiff);
    }

    // Trolley distance to crate in world coordinates
    const trolleyCrateDist = Math.hypot(
      crane.trolleyX - targetCrate.x,
      crane.trolleyZ - targetCrate.z,
    );

    // Hoist height:
    // If trolley is still travelling, maintain safe travel clearance (3.5m)
    // If trolley is over the crate, lower hook to grab height (crate.y + 0.8m)
    const targetHookY =
      trolleyCrateDist > 1.6 ? 3.5 : Math.max(1.3, targetCrate.y + 0.8);

    let hoistInput = 0;
    if (crane.hookY < targetHookY - 0.3) {
      hoistInput = 1; // Hoist UP
    } else if (crane.hookY > targetHookY + 0.3) {
      hoistInput = -1; // Hoist DOWN
    }

    operator.input = {
      x: slewInput,
      z: trolleyInput,
      y: hoistInput,
      seq: (operator.input.seq + 1) % 10000,
    };
    operator.seen = w.clock;

    // Swinger Bot:
    const hookDist3D = Math.hypot(
      targetCrate.x - crane.hookX,
      targetCrate.y - crane.hookY,
      targetCrate.z - crane.hookZ,
    );

    // Check if swinger is close enough to grab
    if (hookDist3D <= GRAB_REACH) {
      const physics = new CraneClashPhysics(w);
      const grabbedId = physics.grabCrate(swinger);
      if (grabbedId) {
        emitEvent(
          w,
          'grab',
          `${swinger.name} hat eine ${CRATE_CONFIGS[targetCrate.kind]?.name || 'Kiste'} gepackt!`,
          team,
        );
      }
      swinger.input = {
        x: 0,
        z: 0,
        grab: true,
        seq: (swinger.input.seq + 1) % 10000,
      };
      swinger.seen = w.clock;
      return;
    }

    // Swing towards the crate to help bridge the distance
    const dx = targetCrate.x - crane.hookX;
    const dz = targetCrate.z - crane.hookZ;
    const len = Math.hypot(dx, dz);
    swinger.input = {
      x: len > 0.1 ? clamp(dx / len, -1, 1) : 0,
      z: len > 0.1 ? clamp(dz / len, -1, 1) : 0,
      seq: (swinger.input.seq + 1) % 10000,
    };
    swinger.seen = w.clock;
  } else {
    // ============================================
    // PHASE 2 & 3: TRANSPORT, SETTLE & STACK
    // ============================================
    const padAngle = Math.atan2(padZ - cfg.mast.z, padX - cfg.mast.x);
    const padDist = Math.hypot(padX - cfg.mast.x, padZ - cfg.mast.z);

    const angleDiff = normalizeAngle(padAngle - crane.angle);
    const distDiff = padDist - crane.trolleyDist;

    const trolleyPadDist = Math.hypot(
      crane.trolleyX - padX,
      crane.trolleyZ - padZ,
    );

    let slewInput = 0;
    if (Math.abs(angleDiff) > 0.02) {
      slewInput = Math.sign(angleDiff);
    }

    let trolleyInput = 0;
    if (Math.abs(distDiff) > 0.15) {
      trolleyInput = Math.sign(distDiff);
    }

    // Safe transit height vs drop height
    const safeTransitY = Math.max(5.2, towerH + 3.6);
    const placeHookY = towerH + PAD_Y + 1.1;

    // While travelling across yard, stay high! Once over pad, lower down gently.
    const targetHookY = trolleyPadDist > 1.2 ? safeTransitY : placeHookY;

    let hoistInput = 0;
    if (crane.hookY < targetHookY - 0.25) {
      hoistInput = 1; // Hoist UP
    } else if (crane.hookY > targetHookY + 0.25) {
      hoistInput = -1; // Hoist DOWN
    }

    operator.input = {
      x: slewInput,
      z: trolleyInput,
      y: hoistInput,
      seq: (operator.input.seq + 1) % 10000,
    };
    operator.seen = w.clock;

    // Swinger Bot:
    const hookPadDist = Math.hypot(crane.hookX - padX, crane.hookZ - padZ);
    const horizSpeed = Math.hypot(crane.hookVx, crane.hookVz);

    if (trolleyPadDist <= 1.2) {
      // Trolley is over the pad! Actively dampen pendulum sway
      const brakeX = -clamp(crane.hookVx * 1.6, -1, 1);
      const brakeZ = -clamp(crane.hookVz * 1.6, -1, 1);
      swinger.input = {
        x: brakeX,
        z: brakeZ,
        seq: (swinger.input.seq + 1) % 10000,
      };
      swinger.seen = w.clock;

      // Drop condition check:
      const stableOverPad = hookPadDist < 1.0;
      const calmVelocity = horizSpeed < 0.85;
      const gentleVertical = Math.abs(crane.hookVy) < 0.8;
      const readyHeight =
        crane.hookY >= towerH + PAD_Y && crane.hookY <= placeHookY + 1.2;

      if (stableOverPad && calmVelocity && readyHeight && gentleVertical) {
        // Place crate gently onto stack!
        const physics = new CraneClashPhysics(w);
        const releasedId = physics.releaseCrate(swinger, true);
        if (releasedId) {
          emitEvent(
            w,
            'place',
            `${swinger.name} hat eine Kiste auf den Turm gestapelt!`,
            team,
          );
        }
        swinger.input = {
          x: 0,
          z: 0,
          grab: false,
          seq: (swinger.input.seq + 1) % 10000,
        };
        return;
      }
    } else {
      // In transit: calm steering
      swinger.input = { x: 0, z: 0, seq: (swinger.input.seq + 1) % 10000 };
      swinger.seen = w.clock;
    }
  }
}
