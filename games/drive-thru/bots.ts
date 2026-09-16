import { newDriveThruPlayer } from './simulation';
import {
  ROLES,
  type DriveThruPlayer,
  type DriveThruWorld,
  type RoleId,
} from './types';

const BOT_NAMES: Record<RoleId, string> = {
  driver: 'Wheelman-Bot',
  passenger: 'Intercom-Bot',
  grill: 'BurgerFlip-Bot',
  barista: 'ShakeMaster-Bot',
};

const ROLE_COLORS: Record<RoleId, number> = {
  driver: 0,
  passenger: 1,
  grill: 2,
  barista: 3,
};

/**
 * Ensures all 4 roles (driver, passenger, grill, barista) have an assigned human or bot player.
 */
export function reconcileDriveThruBots(w: DriveThruWorld): void {
  for (const role of ROLES) {
    const humanInRole = w.players.find((p) => !p.bot && p.role === role);
    const botInRole = w.players.find((p) => p.bot && p.role === role);

    if (!humanInRole && !botInRole) {
      // Spawn bot for this unfilled role
      const botId = `bot-${role}`;
      w.players.push(
        newDriveThruPlayer(
          botId,
          BOT_NAMES[role],
          ROLE_COLORS[role],
          role,
          true,
        ),
      );
    } else if (humanInRole && botInRole) {
      // Remove redundant bot because a human joined this role
      w.players = w.players.filter((p) => p.id !== botInRole.id);
    }
  }
}

/**
 * Autonomous decision logic for a computer-controlled player.
 */
export function stepDriveThruBot(
  bot: DriveThruPlayer,
  w: DriveThruWorld,
  _dt: number,
): void {
  // Reset bot inputs
  bot.input.x = 0;
  bot.input.z = 0;
  bot.input.action1 = false;
  bot.input.action2 = false;
  bot.input.action3 = false;

  if (w.phase === 'meltdown' || w.phase === 'completed') return;

  switch (bot.role) {
    case 'driver': {
      // Steer toward target window at z = 0, x = 0
      const targetZ = 0.5;
      const targetX = 0.4;
      const dx = targetX - w.car.x;

      if (w.car.z > targetZ + 0.5) {
        // Drive forward
        bot.input.action1 = true;
        bot.input.x = Math.max(-1, Math.min(1, dx * 0.8));
      } else if (w.car.z < targetZ - 1.0) {
        // Too far past window, gently reverse
        bot.input.action2 = true;
      } else {
        // Stopped nicely at window
        bot.input.action1 = false;
        bot.input.action2 = false;
      }

      // Honk playfully if toddler is squeaking
      if (w.distractions.toddlerSqueaking && Math.random() < 0.05) {
        bot.input.action3 = true;
      }
      break;
    }

    case 'passenger': {
      // Swat toddler toy if squeaking
      if (w.distractions.toddlerSqueaking) {
        bot.input.action2 = true;
      }
      // Reach out window if tray is ready at window
      if (w.kitchen.trayAtWindow && w.car.z <= 2.0) {
        bot.input.action1 = true;
      }
      // Toggle wipers if windshield is messy
      if (w.car.windshieldSplat > 0.2 && !w.car.wipersActive) {
        bot.input.action3 = true;
      }
      break;
    }

    case 'grill': {
      // 1. Check fryer basket
      if (w.kitchen.fryerTimer > 0.65 && w.kitchen.fryerBasketDown) {
        bot.input.action2 = true; // Lift fryer
        return;
      }

      // 2. Find closest sizzling or browned patty to flip
      const pattyToFlip = w.kitchen.patties.find(
        (p) => (p.state === 'sizzling' || p.state === 'cooked') && p.vy === 0,
      );
      if (pattyToFlip) {
        const dx = pattyToFlip.x - w.kitchen.spatulaX;
        const dz = pattyToFlip.z - w.kitchen.spatulaZ;
        if (Math.hypot(dx, dz) > 0.25) {
          bot.input.x = Math.max(-1, Math.min(1, dx * 3.0));
          bot.input.z = Math.max(-1, Math.min(1, dz * 3.0));
        } else {
          bot.input.action1 = true; // Flip patty!
        }
      }

      // 3. Stack burger layers onto tray
      if (w.kitchen.trayStack.length < 5 && Math.random() < 0.1) {
        bot.input.action3 = true;
      }
      break;
    }

    case 'barista': {
      // 1. Vent milkshake machine if pressure is rising
      if (w.kitchen.shakePressure > 60) {
        bot.input.action1 = true;
      }
      // 2. Pour drinks if needed
      if (w.kitchen.sodasPoured < (w.ticket?.requestedDrinks ?? 2)) {
        bot.input.action2 = true;
      }
      // 3. Push tray to window once burger has at least 3 layers
      if (w.kitchen.trayStack.length >= 3 && !w.kitchen.trayAtWindow) {
        bot.input.action3 = true;
      }
      break;
    }
  }
}
