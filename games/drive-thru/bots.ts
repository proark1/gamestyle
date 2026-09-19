import {
  CAR_BODY_RADIUS,
  SPEAKER_POLE_POS,
  SPEAKER_POLE_RADIUS,
  stepCarPhysics,
} from './physics';
import { newDriveThruPlayer } from './simulation';
import {
  ROLES,
  type DriveThruPlayer,
  type DriveThruWorld,
  type RoleId,
  type SedanState,
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

// Where the bot driver parks: a short stop beside the pickup window.
const PARK_X = 0.4;
const PARK_Z = 0.5;
/** Metres ahead on the lane line that the bot driver steers toward. */
const LANE_LOOKAHEAD = 4;
const STEER_GAIN = 2.5;
const CRUISE_SPEED = 5;
/** Deceleration the bot driver plans its stop around (coasting gives 3.2). */
const PLANNED_BRAKING = 2.5;
/** Seconds of driving the bot previews before it commits to a manoeuvre. */
const PREVIEW_SECONDS = 2.5;
const PREVIEW_STEP = 1 / 30;
/** Room the bot driver keeps between the car body and the speaker pole. */
const POLE_MARGIN = 0.3;
/** The lane to the window runs on this side (+x) of the speaker pole. */
const WINDOW_SIDE = 1;

type Drive = { throttle: boolean; reverse: boolean; steer: number };

/** Follow the lane to the pickup window and stop beside it. */
function laneDrive(car: SedanState): Drive {
  // The lane runs toward -z, so this is how far there is still to go.
  const toPark = car.z - PARK_Z;
  if (toPark < -1) {
    // Rolled past the window: creep straight back.
    return { throttle: false, reverse: car.speed > -1, steer: 0 };
  }
  const heading = Math.atan2(PARK_X - car.x, LANE_LOOKAHEAD);
  const error = Math.atan2(
    Math.sin(heading - car.yaw),
    Math.cos(heading - car.yaw),
  );
  const target = Math.min(
    CRUISE_SPEED,
    Math.sqrt(2 * PLANNED_BRAKING * Math.max(0, toPark)),
  );
  return {
    throttle: car.speed < target - 0.3,
    reverse: car.speed > target + 1 && car.speed > 0.5,
    steer: Math.max(-1, Math.min(1, error * STEER_GAIN)),
  };
}

function poleGap(car: SedanState): number {
  return (
    Math.hypot(car.x - SPEAKER_POLE_POS.x, car.z - SPEAKER_POLE_POS.z) -
    SPEAKER_POLE_RADIUS -
    CAR_BODY_RADIUS
  );
}

/**
 * The car starts right behind the speaker pole, and even a full-lock turn
 * from there clips it, so the bot follows the lane only while that stays
 * clear, otherwise swerves toward the window side, otherwise backs up.
 */
const DRIVER_PLANS: ((car: SedanState) => Drive)[] = [
  laneDrive,
  (car) => ({ ...laneDrive(car), steer: WINDOW_SIDE }),
  () => ({ throttle: false, reverse: true, steer: 0 }),
];

/**
 * Previews `plan` with the real car physics: seconds until it brings the car
 * to the pole, or Infinity if it stays clear.
 */
function timeToPole(car: SedanState, plan: (car: SedanState) => Drive): number {
  // A car already inside the margin (a human left mid-scrape) may still pull
  // away; only plans that close in on the pole count against it.
  const limit = Math.max(1e-6, Math.min(POLE_MARGIN, poleGap(car) / 2));
  const preview = { ...car };
  for (let t = 0; t < PREVIEW_SECONDS; t += PREVIEW_STEP) {
    const drive = plan(preview);
    stepCarPhysics(
      preview,
      drive.throttle,
      drive.reverse,
      drive.steer,
      PREVIEW_STEP,
    );
    if (poleGap(preview) < limit) return t;
  }
  return Infinity;
}

/** The first plan that stays clear of the pole, or the one that hits it last. */
function driverDrive(car: SedanState): Drive {
  let best = DRIVER_PLANS[0];
  let latest = -1;
  for (const plan of DRIVER_PLANS) {
    const t = timeToPole(car, plan);
    if (t === Infinity) return plan(car);
    if (t > latest) {
      best = plan;
      latest = t;
    }
  }
  return best(car);
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
      const drive = driverDrive(w.car);
      bot.input.action1 = drive.throttle;
      bot.input.action2 = drive.reverse;
      bot.input.x = drive.steer;

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
