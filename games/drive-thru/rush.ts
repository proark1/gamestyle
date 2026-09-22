import { computeWindowReachGap, GRILL_BOUNDS } from './physics';
import type {
  BurgerLayer,
  DriveThruEvent,
  DriveThruWorld,
  RushState,
} from './types';

type Emit = (
  w: DriveThruWorld,
  kind: DriveThruEvent['kind'],
  text: string,
) => void;
export const SHIFT_ORDERS = 3;
export const FILL_BAND = [0.72, 0.94] as const;
export const SLIDE_BAND = [0.42, 0.7] as const;
export const LAYER_NAMES: Record<BurgerLayer, string> = {
  bottom_bun: 'Bottom bun',
  patty: 'Cooked patty',
  cheese: 'Cheese',
  lettuce: 'Lettuce',
  top_bun: 'Top bun',
};

export function freshRush(): RushState {
  return {
    elapsed: 0,
    stage: 'preparing',
    charge: 0,
    trayTravel: 0,
    trayVelocity: 0,
    grip: 0,
    danger: 0,
    cupFill: 0,
    pouring: false,
    friesReady: false,
    flipped: [],
    stackCooldown: 0,
    flipCooldown: 0,
    intermission: 0,
    spills: 0,
    notice: 'Three orders. Park, prepare, slide, catch.',
    noticeTime: 5,
    warning: 0,
    nextDistraction: 12,
    previousSpeed: 0,
    botWait: {},
  };
}

export function notifyRush(
  w: DriveThruWorld,
  text: string,
  duration = 3,
): void {
  w.rush.notice = text;
  w.rush.noticeTime = duration;
}

export function orderProblems(w: DriveThruWorld): string[] {
  const ticket = w.ticket;
  if (!ticket) return ['No ticket'];
  const problems: string[] = [];
  if (ticket.requestedBurger.join(',') !== w.kitchen.trayStack.join(','))
    problems.push('Finish the burger in ticket order');
  if (w.kitchen.sodasPoured !== ticket.requestedDrinks)
    problems.push(`Fill ${ticket.requestedDrinks} cups`);
  if (ticket.wantsFries && !w.rush.friesReady)
    problems.push('Lift golden fries');
  return problems;
}

export function stackLayer(w: DriveThruWorld, layer: BurgerLayer): boolean {
  const r = w.rush,
    k = w.kitchen;
  if (r.stage !== 'preparing' || r.stackCooldown > 0) return false;
  const expected = w.ticket?.requestedBurger[k.trayStack.length];
  if (layer !== expected) {
    notifyRush(
      w,
      `Next layer: ${expected ? LAYER_NAMES[expected] : 'burger complete'}`,
    );
    return false;
  }
  if (layer === 'patty') {
    const patty = k.patties.find(
      (p) => p.state === 'cooked' && p.vy === 0 && r.flipped.includes(p.id),
    );
    if (!patty) {
      notifyRush(w, 'Flip a patty, then wait for the green cooked state.');
      return false;
    }
    k.patties = k.patties.filter((p) => p !== patty);
  }
  k.trayStack.push(layer);
  r.stackCooldown = 0.65;
  return true;
}

export function liftFries(w: DriveThruWorld, emit: Emit): void {
  if (!w.kitchen.fryerBasketDown || !w.ticket?.wantsFries) return;
  if (w.kitchen.fryerTimer < 0.5) {
    notifyRush(w, 'Fries are pale. Lift in the golden band (50–80%).');
    return;
  }
  if (w.kitchen.fryerTimer > 0.85) {
    w.kitchen.fryerTimer = 0;
    w.phaseTimer = Math.max(0, w.phaseTimer - 3);
    notifyRush(w, 'Burnt fries! Fresh basket down. −3 seconds.');
    return;
  }
  w.rush.friesReady = true;
  w.kitchen.fryerBasketDown = false;
  emit(w, 'fryer_lifted', 'Golden fries lifted safely.');
}

function spill(w: DriveThruWorld, reason: string, emit: Emit): void {
  const r = w.rush;
  r.stage = 'preparing';
  r.trayTravel = 0;
  r.charge = 0;
  r.grip = 0;
  r.danger = 0;
  r.spills++;
  w.score = Math.max(0, w.score - 75);
  w.phaseTimer = Math.max(0, w.phaseTimer - 4);
  w.kitchen.trayAtWindow = false;
  w.kitchen.trayGrabbed = false;
  w.kitchen.trayDroppedInCurb = true;
  w.kitchen.sodasPoured = Math.max(0, w.kitchen.sodasPoured - 1);
  w.car.balanceMeter = 0;
  w.car.passengerReach = 0;
  notifyRush(w, `${reason} Refill the lost cup and try again. −4 seconds.`, 5);
  emit(w, 'curb_plop', reason);
}

/** Timed, reversible actions shared by people and bots. */
export function stepRush(w: DriveThruWorld, dt: number, emit: Emit): boolean {
  const r = w.rush,
    k = w.kitchen,
    c = w.car;
  r.elapsed += dt;
  r.noticeTime = Math.max(0, r.noticeTime - dt);
  if (r.noticeTime === 0) k.trayDroppedInCurb = false;
  r.stackCooldown = Math.max(0, r.stackCooldown - dt);
  r.flipCooldown = Math.max(0, r.flipCooldown - dt);
  const passenger = w.players.find((p) => p.role === 'passenger')?.input;
  const barista = w.players.find((p) => p.role === 'barista')?.input;
  const grill = w.players.find((p) => p.role === 'grill')?.input;
  const level = w.ticket?.orderNumber ?? 1;

  // Successful orders allow the crew to breathe before the next car arrives.
  if (r.stage === 'between') {
    r.intermission -= dt;
    return r.intermission <= 0;
  }

  if (grill?.action3) {
    const next = w.ticket?.requestedBurger[k.trayStack.length];
    if (next) stackLayer(w, next);
  }
  if (barista?.action1) {
    if (!k.shakeVenting) emit(w, 'shake_vented', 'Pressure valve opened.');
    k.shakeVenting = true;
    k.shakePressure = Math.max(0, k.shakePressure - 32 * dt);
    if (k.shakePressure < 25) k.shakeExploded = false;
  } else k.shakeVenting = false;

  // A cup must be released in the fill band. Holding the button cannot fill a row of cups.
  const pouring =
    !!barista?.action2 &&
    r.stage === 'preparing' &&
    k.sodasPoured < (w.ticket?.requestedDrinks ?? 0);
  if (pouring) {
    if (r.cupFill < 1.2) r.cupFill += dt * (0.55 + level * 0.06);
  } else if (r.pouring) {
    if (r.cupFill >= FILL_BAND[0] && r.cupFill <= FILL_BAND[1]) {
      k.sodasPoured++;
      notifyRush(w, 'Cup filled.');
    } else {
      w.phaseTimer = Math.max(0, w.phaseTimer - 2);
      notifyRush(
        w,
        r.cupFill > FILL_BAND[1]
          ? 'Cup overflowed. Release in the green band. −2 seconds.'
          : 'Cup underfilled. Hold longer before releasing. −2 seconds.',
      );
    }
    r.cupFill = 0;
  }
  r.pouring = pouring;

  const push = !!barista?.action3;
  if (r.stage === 'preparing' && push && orderProblems(w).length === 0) {
    r.stage = 'charging';
    r.charge = 0;
    k.trayDroppedInCurb = false;
  }
  if (r.stage === 'charging') {
    if (push) r.charge = Math.min(1, r.charge + dt * (0.5 + level * 0.07));
    else if (r.charge < SLIDE_BAND[0]) {
      r.stage = 'preparing';
      notifyRush(w, 'Tray stopped short. Charge into the green band.');
      r.charge = 0;
    } else if (r.charge > SLIDE_BAND[1])
      spill(w, 'Tray launched too hard!', emit);
    else {
      r.stage = 'sliding';
      r.trayTravel = 0;
      r.trayVelocity = 0.6 + r.charge * 0.7;
      notifyRush(w, 'Tray sliding! Passenger, get ready.');
    }
  }
  if (r.stage === 'sliding') {
    r.trayTravel = Math.min(1, r.trayTravel + r.trayVelocity * dt);
    if (r.trayTravel >= 1) {
      r.stage = 'offered';
      k.trayAtWindow = true;
      r.grip = 0;
    }
  }

  // Later tickets announce a disturbance before it affects the handoff.
  if (level > 1 && r.elapsed >= r.nextDistraction && r.warning === 0) {
    r.warning = 1.5;
    r.nextDistraction = r.elapsed + 12 - level;
    notifyRush(w, 'Back-seat wobble incoming! Brace or swat the toy.', 2);
  }
  if (r.warning > 0) {
    r.warning = Math.max(0, r.warning - dt);
    if (passenger?.action2) {
      r.warning = 0;
      w.distractions.toddlerSqueaking = false;
    } else if (r.warning === 0) {
      w.distractions.toddlerSqueaking = true;
      if (r.stage === 'carrying' || r.stage === 'offered')
        c.balanceMeter += 0.35;
    }
  }
  if (passenger?.action2) w.distractions.toddlerSqueaking = false;

  const gap = computeWindowReachGap(c);
  const steady =
    Math.abs(c.speed) < 0.25 && Math.abs(Math.sin(c.yaw)) < 0.4 && gap.canReach;
  const extending = !!passenger?.action1;
  c.passengerReach = Math.max(
    0,
    Math.min(1, c.passengerReach + (extending ? 0.65 : -0.48) * dt),
  );
  const handling =
    (r.stage === 'offered' && c.passengerReach > 0.3) || r.stage === 'carrying';
  if (handling) {
    const acceleration = (c.speed - r.previousSpeed) / Math.max(dt, 0.001);
    const wobble =
      Math.sin(r.elapsed * 2.1) * (0.35 + level * 0.12) +
      Math.sin(r.elapsed * 0.7) * 0.2;
    c.balanceMeter +=
      ((passenger?.x ?? 0) * 1.6 +
        wobble +
        c.balanceMeter * 0.3 +
        acceleration * 0.12) *
      dt *
      (0.65 + gap.gapDistance * 0.45);
    r.danger =
      Math.abs(c.balanceMeter) > 0.95
        ? r.danger + dt
        : Math.max(0, r.danger - dt * 2);
    if (r.danger > 0.4 || (r.stage === 'carrying' && !steady)) {
      spill(
        w,
        steady ? 'The tray tipped!' : 'The car moved during the handoff!',
        emit,
      );
    }
  } else c.balanceMeter *= Math.exp(-2 * dt);
  r.previousSpeed = c.speed;

  if (r.stage === 'offered') {
    if (
      extending &&
      c.passengerReach > 0.8 &&
      steady &&
      Math.abs(c.balanceMeter) < 0.72
    )
      r.grip = Math.min(1, r.grip + dt / (0.7 + gap.gapDistance * 0.25));
    else r.grip = Math.max(0, r.grip - dt);
    if (r.grip >= 1) {
      r.stage = 'carrying';
      k.trayGrabbed = true;
      notifyRush(
        w,
        'Got it! Release reach to pull in. Keep the tray level.',
        5,
      );
    }
  }
  if (r.stage === 'carrying' && c.passengerReach < 0.08 && !extending) {
    if (orderProblems(w).length) {
      spill(w, 'The order is incomplete!', emit);
      return false;
    }
    w.ordersServed++;
    const points = Math.max(
      150,
      500 + Math.round(w.phaseTimer * 3) - r.spills * 75,
    );
    w.score += points;
    emit(w, 'order_delivered', `Order ${level} served! +${points}`);
    if (w.ordersServed >= SHIFT_ORDERS) {
      w.phase = 'completed';
      c.speed = 0;
      emit(w, 'round_win', 'Three orders served. Lunch rush survived!');
    } else {
      r.stage = 'between';
      r.intermission = 3.5;
      notifyRush(w, `Order ${level} served! Next car arriving…`, 4);
    }
  }
  return false;
}

/** Burnt food is replaced with a fresh patty, costing time rather than ending a shift. */
export function replaceBurntPatty(w: DriveThruWorld, id: string): void {
  const p = w.kitchen.patties.find((p) => p.id === id);
  if (!p) return;
  Object.assign(p, {
    state: 'raw',
    sizzleProgress: 0,
    burnProgress: 0,
    y: GRILL_BOUNDS.y,
    vy: 0,
    vx: 0,
    vz: 0,
  });
  w.rush.flipped = w.rush.flipped.filter((v) => v !== id);
  w.phaseTimer = Math.max(0, w.phaseTimer - 3);
  notifyRush(
    w,
    'Burnt patty replaced. Flip it, then stack when cooked. −3 seconds.',
    4,
  );
}
