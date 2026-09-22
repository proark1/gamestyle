import { orderProblems } from './rush';
import {
  computeWindowReachGap,
  poleClearance,
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
const PARK_X = 0.15;
const PARK_Z = 0.5;
/**
 * Where along the lane the bot driver may stop, in order of preference: a car
 * angled at the window that cannot straighten out in time pulls on past it.
 */
const PARK_DEPTHS = [PARK_Z, -0.5, -1.5];
/** Metres ahead on the lane line that the bot driver steers toward. */
const LANE_LOOKAHEAD = 4;
const STEER_GAIN = 2.5;
const CRUISE_SPEED = 5;
const BACKUP_SPEED = 3;
/** Deceleration the bot driver plans its stop around (coasting gives 3.2). */
const PLANNED_BRAKING = 2.5;
/** Seconds of driving the bot previews before it commits to a manoeuvre. */
const PREVIEW_SECONDS = 2.5;
/** Seconds of approach the bot previews to see where the car comes to rest. */
const APPROACH_SECONDS = 10;
const PREVIEW_STEP = 1 / 30;
/**
 * The passenger reaches the sill from 2.2 m. The bot driver stops backing up
 * once an approach would park the passenger window this close, and otherwise
 * keeps to an approach within the looser bound, so it does not dither.
 */
const PLANNED_GAP = 1.6;
const KEPT_GAP = 2;
/** Room the bot driver keeps between the car body and the speaker pole. */
const POLE_MARGIN = 0.3;
/** The lane to the window runs on this side (+x) of the speaker pole. */
const WINDOW_SIDE = 1;

type Drive = { throttle: boolean; reverse: boolean; steer: number };
type Plan = (car: SedanState) => Drive;

function clampSteer(steer: number): number {
  return Math.max(-1, Math.min(1, steer));
}

function angleTo(target: number, yaw: number): number {
  return Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
}

/** Follow the lane to the pickup window and stop beside it at `parkZ`. */
function laneDrive(car: SedanState, parkZ = PARK_Z): Drive {
  // The lane runs toward -z, so this is how far there is still to go.
  const toPark = car.z - parkZ;
  if (toPark < -1) {
    // Rolled past the window: creep straight back.
    return { throttle: false, reverse: car.speed > -1, steer: 0 };
  }
  // Close to the stop, aim at it rather than down the lane line.
  const lookahead = Math.max(1, Math.min(LANE_LOOKAHEAD, toPark));
  const heading = Math.atan2(PARK_X - car.x, lookahead);
  const target = Math.min(
    CRUISE_SPEED,
    Math.sqrt(2 * PLANNED_BRAKING * Math.max(0, toPark)),
  );
  return {
    throttle: car.speed < target - 0.3,
    reverse: car.speed > target + 1 && car.speed > 0.5,
    steer: clampSteer(angleTo(heading, car.yaw) * STEER_GAIN),
  };
}

/**
 * Reverse up the lane, steering the tail onto the lane line, for a longer run
 * at the window. Signed reverse velocity turns the nose oppositely; mirror heading and steering.
 */
function backUp(car: SedanState): Drive {
  const heading = -Math.atan2(PARK_X - car.x, LANE_LOOKAHEAD);
  return {
    throttle: false,
    reverse: car.speed > -BACKUP_SPEED,
    steer: clampSteer(-angleTo(heading, car.yaw) * STEER_GAIN),
  };
}

/** Whether the passenger can take the tray with the car parked here. */
function windowWithin(car: SedanState, gap: number): boolean {
  // The passenger bot reaches out from z = 2, the handoff counts from z = -3.
  return (
    car.z <= 2 && car.z >= -3 && computeWindowReachGap(car).gapDistance <= gap
  );
}

/**
 * Previews following the lane to `parkZ` with the real car physics: whether
 * the car comes to rest with the window within `gap`.
 */
function approachReaches(car: SedanState, parkZ: number, gap: number): boolean {
  const preview = { ...car };
  for (let t = 0; t < APPROACH_SECONDS; t += PREVIEW_STEP) {
    const drive = laneDrive(preview, parkZ);
    if (preview.speed === 0 && !drive.throttle && !drive.reverse) {
      return windowWithin(preview, gap);
    }
    stepCarPhysics(
      preview,
      drive.throttle,
      drive.reverse,
      drive.steer,
      PREVIEW_STEP,
    );
    // The pole preview steers round the pole; the approach is judged again
    // from the far side.
    if (poleGap(preview) < 0.01) return true;
  }
  // Never came to rest: grinding along an edge or shuttling, not parking.
  return false;
}

function poleGap(car: SedanState): number {
  return poleClearance(car);
}

/** Try a direct approach, a wider turn, then backing up for more room. */
function approachPlans(parkZ: number): Plan[] {
  return [
    (car) => laneDrive(car, parkZ),
    (car) => ({ ...laneDrive(car, parkZ), steer: WINDOW_SIDE }),
    (car) => ({
      ...laneDrive(car, parkZ),
      throttle: false,
      reverse: car.speed > -BACKUP_SPEED,
    }),
  ];
}

/**
 * Backing up toward the pole, the bot swings its tail to the window side
 * (reversing with the opposite steer), otherwise round the far side of the
 * pole, otherwise pulls forward again.
 */
const BACKUP_PLANS: Plan[] = [
  backUp,
  (car) => ({ ...backUp(car), steer: -WINDOW_SIDE }),
  (car) => ({ ...backUp(car), steer: WINDOW_SIDE }),
  (car) => ({ ...laneDrive(car), steer: WINDOW_SIDE }),
];

/** Parked within the passenger's reach: wait there for the tray. */
const WAIT_PLANS: Plan[] = [
  () => ({ throttle: false, reverse: false, steer: 0 }),
];

/**
 * Previews `plan` with the real car physics: seconds until it brings the car
 * to the pole, or Infinity if it stays clear.
 */
function timeToPole(car: SedanState, plan: Plan): number {
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

/**
 * Where the bot driver is headed: nowhere once parked within reach, else down
 * the lane to the first stop that leaves the window in the passenger's reach,
 * or, when none does (a bot took the wheel from a human off the lane line, and
 * the turning circle is ~7 m), back up the lane for another run.
 */
function driverRoute(car: SedanState): Plan[] {
  if (Math.abs(car.speed) < 0.05 && windowWithin(car, KEPT_GAP)) {
    return WAIT_PLANS;
  }
  const gap = car.speed < 0 ? PLANNED_GAP : KEPT_GAP;
  const parkZ = PARK_DEPTHS.find((z) => approachReaches(car, z, gap));
  return parkZ === undefined ? BACKUP_PLANS : approachPlans(parkZ);
}

type RecoveryPlan = { targetZ: number; until: number; drive: Drive };
const recoveries = new WeakMap<SedanState, RecoveryPlan>();
function recoveryDrive(car: SedanState, dt: number): Drive | null {
  let recovery = recoveries.get(car);
  if (!recovery && Math.abs(angleTo(0, car.yaw)) > 0.9 && car.z > 3) {
    recovery = {
      targetZ: Math.max(15, car.z + 1),
      until: 0,
      drive: { throttle: false, reverse: false, steer: 0 },
    };
    recoveries.set(car, recovery);
  }
  if (!recovery) return null;
  if (Math.abs(angleTo(0, car.yaw)) < 0.25 && car.x > -1.2) {
    recoveries.delete(car);
    return null;
  }
  recovery.until -= dt;
  if (recovery.until > 0) return recovery.drive;
  const targetZ = recovery.targetZ;
  const drives: Drive[] = [-1, 1].flatMap((direction) =>
    [-1, 0, 1].map((steer) => ({
      throttle: direction > 0,
      reverse: direction < 0,
      steer,
    })),
  );
  type Node = { car: SedanState; first: Drive; cost: number; penalty: number };
  let beam: Node[] = [
    { car: { ...car }, first: drives[0], cost: 0, penalty: 0 },
  ];
  for (let depth = 0; depth < 4; depth++) {
    const next: Node[] = [];
    for (const node of beam)
      for (const drive of drives) {
        const preview = { ...node.car };
        let penalty = node.penalty;
        for (let i = 0; i < 18; i++) {
          stepCarPhysics(
            preview,
            drive.throttle,
            drive.reverse,
            drive.steer,
            1 / 30,
          );
          if (poleClearance(preview) < 0.08) penalty += 4;
        }
        const cost =
          Math.hypot(preview.x + 0.3, (preview.z - targetZ) * 0.65) +
          Math.abs(angleTo(0, preview.yaw)) * 3 +
          penalty;
        next.push({
          car: preview,
          first: depth === 0 ? drive : node.first,
          cost,
          penalty,
        });
      }
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, 8);
  }
  recovery.drive = beam[0].first;
  recovery.until = 0.22;
  return recovery.drive;
}

/** The first plan that stays clear of the pole, or the one that hits it last. */
function driverDrive(car: SedanState): Drive {
  const plans = driverRoute(car);
  let best = plans[0];
  let latest = -1;
  for (const plan of plans) {
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
  const wait = (w.rush.botWait[bot.role] ?? 0) - _dt;
  w.rush.botWait[bot.role] = wait;
  if (wait > 0) return;
  w.rush.botWait[bot.role] = 0.16 + (w.ticket?.orderNumber ?? 1) * 0.015;
  bot.input.jump = false;
  // Reset bot inputs
  bot.input.x = 0;
  bot.input.z = 0;
  bot.input.action1 = false;
  bot.input.action2 = false;
  bot.input.action3 = false;

  if (
    w.phase === 'meltdown' ||
    w.phase === 'completed' ||
    w.rush.stage === 'between'
  )
    return;

  switch (bot.role) {
    case 'driver': {
      if (
        computeWindowReachGap(w.car).gapDistance < 1.65 &&
        Math.abs(w.car.speed) < 0.9 &&
        Math.abs(Math.sin(w.car.yaw)) < 0.4
      ) {
        bot.input.jump = true;
        break;
      }
      const drive =
        recoveryDrive(w.car, 0.16 + (w.ticket?.orderNumber ?? 1) * 0.015) ??
        driverDrive(w.car);
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
      bot.input.action1 =
        w.rush.stage === 'offered' || w.rush.stage === 'sliding';
      const wobble =
        Math.sin(w.rush.elapsed * 2.1) *
          (0.35 + (w.ticket?.orderNumber ?? 1) * 0.12) +
        Math.sin(w.rush.elapsed * 0.7) * 0.2;
      bot.input.x = Math.max(
        -1,
        Math.min(1, -w.car.balanceMeter * 2 - wobble / 1.6),
      );
      bot.input.action2 = w.rush.warning > 0 || w.distractions.toddlerSqueaking;
      bot.input.action3 = w.car.windshieldSplat > 0.15;
      break;
    }
    case 'grill': {
      bot.input.action2 =
        w.kitchen.fryerBasketDown && w.kitchen.fryerTimer > 0.57;
      const patty = w.kitchen.patties.find(
        (p) => !w.rush.flipped.includes(p.id) && p.sizzleProgress > 0.35,
      );
      if (patty) {
        const dx = patty.x - w.kitchen.spatulaX,
          dz = patty.z - w.kitchen.spatulaZ;
        bot.input.x = Math.max(-1, Math.min(1, dx * 3));
        bot.input.z = Math.max(-1, Math.min(1, dz * 3));
        if (Math.hypot(dx, dz) < 0.2) bot.input.action1 = true;
      }
      const nextLayer = w.ticket?.requestedBurger[w.kitchen.trayStack.length];
      bot.input.action3 =
        w.rush.stackCooldown <= 0 &&
        (nextLayer !== 'patty' ||
          w.kitchen.patties.some(
            (p) =>
              p.state === 'cooked' &&
              p.vy === 0 &&
              w.rush.flipped.includes(p.id),
          ));
      break;
    }
    case 'barista': {
      bot.input.action1 =
        w.kitchen.shakePressure > 48 || w.kitchen.shakeExploded;
      bot.input.action2 =
        w.kitchen.sodasPoured < (w.ticket?.requestedDrinks ?? 1) &&
        w.rush.stage === 'preparing' &&
        w.rush.cupFill < 0.75;
      bot.input.action3 =
        (w.rush.stage === 'preparing' && orderProblems(w).length === 0) ||
        (w.rush.stage === 'charging' && w.rush.charge < 0.51);
      break;
    }
  }
}
