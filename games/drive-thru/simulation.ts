import {
  freshRush,
  liftFries,
  notifyRush,
  orderProblems,
  replaceBurntPatty,
  stackLayer,
  stepRush,
} from './rush';
import {
  computeWindowReachGap,
  GRILL_BOUNDS,
  stepCarPhysics,
  stepPattyPhysics,
} from './physics';
import {
  idleInput,
  ROLES,
  type BurgerLayer,
  type DriveThruAction,
  type DriveThruEvent,
  type DriveThruPlayer,
  type DriveThruSnapshot,
  type DriveThruWorld,
  type FailStateKind,
  type OrderTicket,
  type Patty,
  type RoleId,
} from './types';

const ORDER_TEMPLATES = [
  {
    clear: 'Cheeseburger and one soda. Easy does it!',
    scrambled: 'CHEESE... [KHZZZT]... ONE S-SODA!',
    burger: ['bottom_bun', 'patty', 'cheese', 'top_bun'] as BurgerLayer[],
    drinks: 1,
    shake: false,
    fries: false,
  },
  {
    clear: 'Double cheeseburger, two shakes and golden fries!',
    scrambled: 'D-DOUBLE... [CRACKLE]... TWO SHAKES... FRIES!',
    burger: [
      'bottom_bun',
      'patty',
      'cheese',
      'patty',
      'cheese',
      'top_bun',
    ] as BurgerLayer[],
    drinks: 2,
    shake: true,
    fries: true,
  },
  {
    clear: 'Triple burger with lettuce, three shakes and fries. Hurry!',
    scrambled: 'TRIPLE... [HONK]... THREE SHAKES... [BUZZ]... FRIES!',
    burger: [
      'bottom_bun',
      'patty',
      'cheese',
      'patty',
      'patty',
      'lettuce',
      'top_bun',
    ] as BurgerLayer[],
    drinks: 3,
    shake: true,
    fries: true,
  },
];

let nextEventId = 1;
export function addDriveThruEvent(
  w: DriveThruWorld,
  kind: DriveThruEvent['kind'],
  text: string,
): void {
  w.events.push({ id: nextEventId++, kind, text });
  if (w.events.length > 8) {
    w.events = w.events.slice(-8);
  }
}

export function generateOrderTicket(orderNumber: number): OrderTicket {
  const tpl = ORDER_TEMPLATES[(orderNumber - 1) % ORDER_TEMPLATES.length];
  return {
    id: `ticket-${orderNumber}`,
    orderNumber,
    scrambledText: tpl.scrambled,
    clearText: tpl.clear,
    requestedBurger: [...tpl.burger],
    requestedDrinks: tpl.drinks,
    wantsMilkshake: tpl.shake,
    wantsFries: tpl.fries,
  };
}

export function newDriveThruPlayer(
  id: string,
  name: string,
  color: number,
  role: RoleId,
  bot = false,
): DriveThruPlayer {
  return {
    id,
    name,
    color,
    role,
    bot,
    score: 0,
    seen: Date.now(),
    input: idleInput(),
  };
}

export function freshDriveThruWorld(now = Date.now()): DriveThruWorld {
  const initialPatties: Patty[] = [
    {
      id: 'patty-1',
      x: 3.8,
      y: GRILL_BOUNDS.y,
      z: -1.0,
      vx: 0,
      vy: 0,
      vz: 0,
      flipAngle: 0,
      state: 'sizzling',
      sizzleProgress: 0.5,
      burnProgress: 0.2,
      onSpatula: false,
    },
    {
      id: 'patty-2',
      x: 4.4,
      y: GRILL_BOUNDS.y,
      z: -0.6,
      vx: 0,
      vy: 0,
      vz: 0,
      flipAngle: 0,
      state: 'raw',
      sizzleProgress: 0.1,
      burnProgress: 0,
      onSpatula: false,
    },
    {
      id: 'patty-3',
      x: 4.1,
      y: GRILL_BOUNDS.y,
      z: -0.1,
      vx: 0,
      vy: 0,
      vz: 0,
      flipAngle: 0,
      state: 'raw',
      sizzleProgress: 0,
      burnProgress: 0,
      onSpatula: false,
    },
  ];

  return {
    clock: now,
    started: now,
    rush: freshRush(),
    phase: 'ordering',
    phaseTimer: 75,
    ticket: generateOrderTicket(1),
    car: {
      x: -1.2,
      y: 0,
      z: 14.0, // Clear lane beside the ordering speaker
      yaw: 0,
      speed: 0,
      steer: 0,
      honking: false,
      bumperDamage: 0,
      reversedIntoPole: false,
      windshieldSplat: 0,
      wipersActive: false,
      passengerReach: 0,
      beltHeld: true,
      balanceMeter: 0,
    },
    kitchen: {
      patties: initialPatties.slice(0, 1),
      spatulaX: 4.0,
      spatulaZ: -0.5,
      fryerBasketDown: false,
      fryerTimer: 0.2,
      fryerGreaseFire: false,
      shakePressure: 25,
      shakeVenting: false,
      shakeExploded: false,
      sodasPoured: 0,
      trayStack: [],
      trayAtWindow: false,
      trayGrabbed: false,
      trayDroppedInCurb: false,
    },
    distractions: {
      toddlerSqueaking: true,
      screechingBelt: true,
      radioStaticIntensity: 0.85,
    },
    failState: 'none',
    failReason: '',
    score: 0,
    ordersServed: 0,
    players: [],
    events: [],
  };
}

export function driveThruAction(
  w: DriveThruWorld,
  playerId: string,
  a: DriveThruAction,
): void {
  const player = w.players.find((p) => p.id === playerId);
  if (!player && a.type !== 'start' && a.type !== 'restart') return;

  if (
    (w.phase === 'completed' || w.phase === 'meltdown') &&
    a.type !== 'restart'
  )
    return;
  switch (a.type) {
    case 'start':
      if (w.phase === 'lobby') {
        w.phase = 'ordering';
        w.phaseTimer = 75;
        addDriveThruEvent(
          w,
          'order_placed',
          'A beat-up sedan pulls up to the speaker box!',
        );
      }
      break;

    case 'restart':
      Object.assign(w, freshDriveThruWorld(Date.now()));
      addDriveThruEvent(w, 'order_placed', 'New shift started! Order up!');
      break;

    case 'switchRole':
      if (player && ROLES.includes(a.role)) {
        player.role = a.role;
      }
      break;

    case 'honk':
      w.car.honking = true;
      addDriveThruEvent(
        w,
        'horn_honked',
        'BEEP BEEP! Driver honked the erratic horn!',
      );
      break;

    case 'flipPatty': {
      if (w.rush.flipCooldown > 0) break;
      // Find the patty nearest the spatula
      let closest: Patty | null = null;
      let minDist = 0.85;
      for (const p of w.kitchen.patties) {
        const d = Math.hypot(
          p.x - w.kitchen.spatulaX,
          p.z - w.kitchen.spatulaZ,
        );
        if (d < minDist) {
          minDist = d;
          closest = p;
        }
      }
      if (closest && closest.vy === 0) {
        w.rush.flipCooldown = 0.55;
        if (!w.rush.flipped.includes(closest.id))
          w.rush.flipped.push(closest.id);
        closest.vy = 4.2; // Upward flip impulse
        closest.vx = 0;
        closest.vz = 0;
        addDriveThruEvent(
          w,
          'patty_flipped',
          'Spatula flipped a sizzling burger patty!',
        );
      }
      break;
    }

    case 'selectPatty': {
      const patty = w.kitchen.patties.find((p) => p.id === a.id);
      if (patty) {
        w.kitchen.spatulaX = patty.x;
        w.kitchen.spatulaZ = patty.z;
      }
      break;
    }
    case 'stackIngredient':
      stackLayer(w, a.layer);
      break;
    case 'stackNext': {
      const next = w.ticket?.requestedBurger[w.kitchen.trayStack.length];
      if (next) stackLayer(w, next);
      break;
    }

    case 'ventMilkshake':
      notifyRush(w, 'Hold the vent control to release pressure.');
      break;
    case 'liftFryer':
      liftFries(w, addDriveThruEvent);
      break;
    case 'pourDrink':
      notifyRush(w, 'Hold pour, then release inside the green fill band.');
      break;
    case 'pushTray':
      notifyRush(
        w,
        orderProblems(w)[0] ??
          'Hold slide, then release inside the green launch band.',
      );
      break;
    case 'reachTray':
      notifyRush(
        w,
        'Hold reach to secure the tray. Release to pull it inside.',
      );
      break;

    case 'toggleWipers':
      w.car.wipersActive = !w.car.wipersActive;
      break;

    case 'swatDistraction':
      w.rush.warning = 0;
      w.distractions.toddlerSqueaking = false;
      w.distractions.screechingBelt = false;
      break;
  }
}

export function advanceDriveThruWorld(
  w: DriveThruWorld,
  nowOrDt: number,
  maybeNow?: number,
): void {
  const now =
    typeof maybeNow === 'number'
      ? maybeNow
      : typeof nowOrDt === 'number' && nowOrDt > 100000
        ? nowOrDt
        : Date.now();
  const dt =
    typeof maybeNow === 'number'
      ? nowOrDt
      : nowOrDt <= 1000
        ? nowOrDt
        : Math.min(0.1, Math.max(0.001, (now - (w.clock || now)) / 1000));
  w.clock = now;

  if (w.phase === 'meltdown' || w.phase === 'completed') {
    return;
  }

  if (dt <= 0 || !Number.isFinite(dt)) return;
  if (dt > 1 / 30 + 1e-8) {
    const count = Math.ceil(Math.min(dt, 2) * 30),
      h = Math.min(dt, 2) / count;
    for (let i = 0; i < count; i++)
      advanceDriveThruWorld(w, h, now - (count - i - 1) * h * 1000);
    return;
  }
  if (w.rush.stage === 'between') {
    if (stepRush(w, dt, addDriveThruEvent)) {
      const next = freshDriveThruWorld(now),
        number = w.ordersServed + 1;
      w.ticket = generateOrderTicket(number);
      w.car = {
        ...next.car,
        x: number === 2 ? -1.9 : -1.5,
        z: 14.5,
        yaw: number === 2 ? 0.08 : -0.08,
      };
      w.kitchen = next.kitchen;
      w.kitchen.patties = Array.from({ length: number }, (_, i) => ({
        ...next.kitchen.patties[0],
        id: `patty-${i}`,
        x: GRILL_BOUNDS.minX + 0.3 + i * 0.4,
      }));
      w.kitchen.fryerBasketDown = !!w.ticket.wantsFries;
      w.kitchen.shakePressure = 25 + number * 5;
      w.rush = freshRush();
      w.distractions = next.distractions;
      w.phase = 'ordering';
      w.phaseTimer = 80 - number * 5;
      for (const p of w.players) p.input = idleInput();
      notifyRush(w, `Order ${number} of 3. More food, less time.`, 4);
      addDriveThruEvent(w, 'order_placed', w.ticket.clearText);
    }
    return;
  }
  for (const p of w.players) {
    const inp = p.input;
    if (p.role === 'driver') {
      if (inp.jump) {
        w.car.speed =
          Math.sign(w.car.speed) * Math.max(0, Math.abs(w.car.speed) - dt * 14);
        stepCarPhysics(w.car, false, false, inp.x, dt);
      } else {
        if (
          ['offered', 'carrying'].includes(w.rush.stage) &&
          computeWindowReachGap(w.car).canReach &&
          !inp.action1 &&
          !inp.action2 &&
          Math.abs(w.car.speed) < 0.6
        )
          w.car.speed += dt * 3.5;
        stepCarPhysics(w.car, inp.action1, inp.action2, inp.x, dt);
      }
      w.car.honking = inp.action3;
    } else if (p.role === 'passenger') {
      if (inp.action2) w.distractions.toddlerSqueaking = false;
      if (inp.action3) w.car.wipersActive = true;
    } else if (p.role === 'grill') {
      w.kitchen.spatulaX = Math.max(
        GRILL_BOUNDS.minX,
        Math.min(GRILL_BOUNDS.maxX, w.kitchen.spatulaX + inp.x * dt * 2.5),
      );
      w.kitchen.spatulaZ = Math.max(
        GRILL_BOUNDS.minZ,
        Math.min(GRILL_BOUNDS.maxZ, w.kitchen.spatulaZ + inp.z * dt * 2.5),
      );
      if (inp.action1) driveThruAction(w, p.id, { type: 'flipPatty' });
      if (inp.action2) liftFries(w, addDriveThruEvent);
    }
  }
  for (const pat of w.kitchen.patties) {
    stepPattyPhysics(pat, dt);
    if (pat.state === 'fire') {
      addDriveThruEvent(w, 'patty_burnt', 'Burnt patty replaced.');
      replaceBurntPatty(w, pat.id);
    }
  }
  if (w.kitchen.fryerBasketDown) {
    w.kitchen.fryerTimer += (0.032 + w.ordersServed * 0.006) * dt;
    if (w.kitchen.fryerTimer >= 1) {
      w.kitchen.fryerTimer = 0;
      w.phaseTimer = Math.max(0, w.phaseTimer - 4);
      notifyRush(
        w,
        'Fryer smoked! Fresh fries down. Lift at 50-80%. -4 seconds.',
        5,
      );
      addDriveThruEvent(w, 'grease_fire', 'Fryer smoked; basket replaced.');
    }
  }
  if (!w.kitchen.shakeExploded) {
    w.kitchen.shakePressure += (4 + w.ordersServed * 2) * dt;
    if (w.kitchen.shakePressure >= 100) {
      w.kitchen.shakeExploded = true;
      w.car.windshieldSplat = 1;
      w.kitchen.sodasPoured = Math.max(0, w.kitchen.sodasPoured - 1);
      addDriveThruEvent(
        w,
        'shake_exploded',
        'Milkshake blew! Vent the tank and refill the lost cup.',
      );
      addDriveThruEvent(w, 'windshield_splatted', 'Wipers needed!');
      notifyRush(
        w,
        'Shake blowout! Vent below 25%, refill, and use the wipers.',
        5,
      );
    }
  }
  if (w.car.reversedIntoPole) {
    w.car.reversedIntoPole = false;
    w.car.speed = 0;
    w.phaseTimer = Math.max(0, w.phaseTimer - 5);
    addDriveThruEvent(
      w,
      'pole_crashed',
      'Bumper hit! Back off and try again. -5 seconds.',
    );
    notifyRush(w, 'Pole collision! Back off and try again. -5 seconds.', 4);
  }
  if (w.car.wipersActive)
    w.car.windshieldSplat = Math.max(0, w.car.windshieldSplat - dt * 0.55);
  w.phaseTimer -= dt;
  if (w.phaseTimer <= 0) {
    w.phaseTimer = 0;
    triggerFailState(
      w,
      'none',
      `Order ${w.ticket?.orderNumber ?? 1} ran out of time. ${w.ordersServed}/3 orders served.`,
    );
    return;
  }
  const gap = computeWindowReachGap(w.car);
  if (gap.canReach && Math.abs(w.car.speed) < 0.8) {
    if (w.phase !== 'reaching')
      addDriveThruEvent(
        w,
        'short_stop_reach',
        'Hold the handbrake. Passenger, prepare to reach.',
      );
    w.phase = 'reaching';
  } else w.phase = 'assembling';
  stepRush(w, dt, addDriveThruEvent);
}

function triggerFailState(
  w: DriveThruWorld,
  kind: FailStateKind,
  reason: string,
): void {
  if (w.failState === 'none') {
    w.failState = kind;
    w.failReason = reason;
    w.phase = 'meltdown';
    addDriveThruEvent(w, 'meltdown', `MELTDOWN! ${reason}`);
  }
}

export function driveThruSnapshot(
  w: DriveThruWorld,
  _roomCode: string,
  hostId: string,
  localId: string,
  _version: number,
): DriveThruSnapshot {
  const me = w.players.find((p) => p.id === localId);
  return {
    code: _roomCode,
    host: hostId,
    version: _version,
    world: w,
    rush: {
      ...w.rush,
      flipped: [...w.rush.flipped],
      botWait: { ...w.rush.botWait },
    },
    clock: w.clock,
    phase: w.phase,
    phaseTimer: Math.max(0, Math.ceil(w.phaseTimer)),
    ticket: w.ticket,
    car: { ...w.car },
    kitchen: {
      ...w.kitchen,
      patties: w.kitchen.patties.map((pat) => ({ ...pat })),
      trayStack: [...w.kitchen.trayStack],
    },
    distractions: { ...w.distractions },
    failState: w.failState,
    failReason: w.failReason,
    score: w.score,
    ordersServed: w.ordersServed,
    players: w.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      role: p.role,
      bot: p.bot,
      score: p.score,
    })),
    events: [...w.events],
    myRole: me ? me.role : 'driver',
    isHost: hostId === localId,
  };
}
