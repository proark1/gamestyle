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
    clear:
      'No ice, extra ranch, a large diet water and a double cheese burger!',
    scrambled:
      'N-N-NO ICE... [KHZZZT] EXTRA R-RANCH... L-LARGE DIET W-WATER... [SQUELCH]',
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
    clear:
      'Triple mega burger, charred crisp, four large sodas and extra fries!',
    scrambled:
      'TRIP-PLE... [CRACKLE]... C-CHARRED CRISP... FOUR S-SODAS... [STATIC CRACKLE]',
    burger: [
      'bottom_bun',
      'patty',
      'patty',
      'cheese',
      'patty',
      'lettuce',
      'top_bun',
    ] as BurgerLayer[],
    drinks: 4,
    shake: false,
    fries: true,
  },
  {
    clear:
      'Single deluxe with lettuce, no pickles, and a high-foam strawberry shake!',
    scrambled:
      'SING-GL... [WHIRR]... DELUXE... [BEEP]... HIGH-FOAM S-SHAKE... [BUZZZT]',
    burger: [
      'bottom_bun',
      'patty',
      'lettuce',
      'cheese',
      'top_bun',
    ] as BurgerLayer[],
    drinks: 1,
    shake: true,
    fries: false,
  },
  {
    clear:
      'Quadruple carnivore stack, burnt patties only, zero greens, three drinks!',
    scrambled:
      'QUAD... [SCREECH]... B-BURNT ONLY... ZERO GREENS... [HONK SQUELCH]',
    burger: [
      'bottom_bun',
      'patty',
      'patty',
      'cheese',
      'patty',
      'patty',
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
    phase: 'ordering',
    phaseTimer: 60,
    ticket: generateOrderTicket(1),
    car: {
      x: -3.8,
      y: 0,
      z: 14.0, // Just before the intercom speaker pole
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
      patties: initialPatties,
      spatulaX: 4.0,
      spatulaZ: -0.5,
      fryerBasketDown: true,
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

  switch (a.type) {
    case 'start':
      if (w.phase === 'lobby') {
        w.phase = 'ordering';
        w.phaseTimer = 60;
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
        closest.vy = 4.2; // Upward flip impulse
        closest.vx = (Math.random() - 0.5) * 0.4;
        closest.vz = (Math.random() - 0.5) * 0.4;
        addDriveThruEvent(
          w,
          'patty_flipped',
          'Spatula flipped a sizzling burger patty!',
        );
      }
      break;
    }

    case 'stackIngredient':
      if (w.kitchen.trayStack.length < 8) {
        w.kitchen.trayStack.push(a.layer);
      }
      break;

    case 'ventMilkshake':
      w.kitchen.shakeVenting = true;
      w.kitchen.shakePressure = Math.max(0, w.kitchen.shakePressure - 35);
      addDriveThruEvent(
        w,
        'shake_vented',
        'Milkshake pressure release valve vented safely!',
      );
      break;

    case 'liftFryer':
      w.kitchen.fryerBasketDown = false;
      addDriveThruEvent(
        w,
        'fryer_lifted',
        'Lifted fryer basket before grease ignited!',
      );
      break;

    case 'pushTray':
      w.kitchen.trayAtWindow = true;
      break;

    case 'reachTray':
      w.car.passengerReach = Math.min(1.0, w.car.passengerReach + 0.3);
      break;

    case 'toggleWipers':
      w.car.wipersActive = !w.car.wipersActive;
      break;

    case 'swatDistraction':
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

  // 1. Process inputs by role
  for (const p of w.players) {
    const inp = p.input;

    if (p.role === 'driver') {
      // Driver controls car
      stepCarPhysics(w.car, inp.action1, inp.action2, inp.x, dt);
      if (inp.action3) {
        w.car.honking = true;
      }
    } else if (p.role === 'passenger') {
      // Passenger reach and distractions
      if (inp.action1) {
        w.car.passengerReach = Math.min(1.0, w.car.passengerReach + 1.2 * dt);
      } else {
        w.car.passengerReach = Math.max(0, w.car.passengerReach - 1.5 * dt);
      }
      if (inp.action2) {
        w.distractions.toddlerSqueaking = false;
      }
      if (inp.action3) {
        w.car.wipersActive = true;
      }
      // Balance drift based on lateral movement
      w.car.balanceMeter += (inp.x * 1.5 - w.car.balanceMeter * 0.8) * dt;
    } else if (p.role === 'grill') {
      // Move spatula over grill bounds
      w.kitchen.spatulaX = Math.max(
        GRILL_BOUNDS.minX,
        Math.min(GRILL_BOUNDS.maxX, w.kitchen.spatulaX + inp.x * 2.5 * dt),
      );
      w.kitchen.spatulaZ = Math.max(
        GRILL_BOUNDS.minZ,
        Math.min(GRILL_BOUNDS.maxZ, w.kitchen.spatulaZ + inp.z * 2.5 * dt),
      );
      if (inp.action1) {
        // Trigger flip
        driveThruAction(w, p.id, { type: 'flipPatty' });
      }
      if (inp.action2) {
        driveThruAction(w, p.id, { type: 'liftFryer' });
      }
      if (inp.action3 && w.kitchen.trayStack.length < 8) {
        // Stacking next required layer
        const cookedPatty = w.kitchen.patties.find(
          (pat) => pat.state === 'cooked',
        );
        if (cookedPatty && !w.kitchen.trayStack.includes('patty')) {
          w.kitchen.trayStack.push('patty');
        } else if (!w.kitchen.trayStack.includes('bottom_bun')) {
          w.kitchen.trayStack.push('bottom_bun');
        } else if (!w.kitchen.trayStack.includes('cheese')) {
          w.kitchen.trayStack.push('cheese');
        } else if (!w.kitchen.trayStack.includes('lettuce')) {
          w.kitchen.trayStack.push('lettuce');
        } else if (!w.kitchen.trayStack.includes('top_bun')) {
          w.kitchen.trayStack.push('top_bun');
        }
      }
    } else if (p.role === 'barista') {
      if (inp.action1) {
        driveThruAction(w, p.id, { type: 'ventMilkshake' });
      }
      if (inp.action2 && w.kitchen.sodasPoured < 4) {
        w.kitchen.sodasPoured += 1;
      }
      if (inp.action3) {
        w.kitchen.trayAtWindow = true;
      }
    }
  }

  // 2. Step physics for patties
  for (const pat of w.kitchen.patties) {
    stepPattyPhysics(pat, dt);
    if (pat.state === 'fire' && !w.kitchen.fryerGreaseFire) {
      triggerFailState(
        w,
        'grease_fire',
        'Burger patty caught fire on the flat-top grill!',
      );
    }
  }

  // 3. Step fryer oil
  if (w.kitchen.fryerBasketDown) {
    w.kitchen.fryerTimer += 0.04 * dt;
    if (w.kitchen.fryerTimer >= 1.0 && !w.kitchen.fryerGreaseFire) {
      w.kitchen.fryerGreaseFire = true;
      triggerFailState(
        w,
        'grease_fire',
        'Deep fryer oil hit flashpoint! Massive grease fire!',
      );
    }
  }

  // 4. Step milkshake machine pressure
  if (!w.kitchen.shakeExploded) {
    w.kitchen.shakePressure += 6.5 * dt;
    if (w.kitchen.shakePressure >= 100) {
      w.kitchen.shakeExploded = true;
      w.car.windshieldSplat = 1.0;
      addDriveThruEvent(
        w,
        'shake_exploded',
        'Milkshake machine exploded in a violent violent foam spray!',
      );
      addDriveThruEvent(
        w,
        'windshield_splatted',
        'Milkshake splattered across the sedan windshield!',
      );
    }
  }

  // 5. Check fail states: pole crash
  if (w.car.reversedIntoPole) {
    triggerFailState(
      w,
      'pole_crash',
      'Car reversed into the drive-thru speaker pole and destroyed it!',
    );
  }

  // 6. Phase timer countdown
  w.phaseTimer -= dt;
  if (w.phaseTimer <= 0 && w.phase === 'ordering') {
    w.phase = 'assembling';
    w.phaseTimer = 60;
  }

  // 7. Check Window Reach Phase & Short Stop
  const { gapDistance, isShortStop, canReach } = computeWindowReachGap(w.car);

  if (w.car.z <= 3.0 && w.car.z >= -3.0 && Math.abs(w.car.speed) < 0.8) {
    // Car is stopped near the window
    if (w.phase !== 'reaching') {
      w.phase = 'reaching';
      if (isShortStop) {
        addDriveThruEvent(
          w,
          'short_stop_reach',
          `SHORT STOP! Car parked ${gapDistance.toFixed(1)}m away. Passenger must lean!`,
        );
      }
    }

    // Checking handoff
    if (w.kitchen.trayAtWindow && canReach && w.car.passengerReach > 0.75) {
      // Balance check: if passenger loses balance, sodas drop!
      if (Math.abs(w.car.balanceMeter) > 0.85) {
        w.kitchen.trayDroppedInCurb = true;
        triggerFailState(
          w,
          'curb_plop',
          'Passenger overextended and dropped the 4 sodas down the curb drain!',
        );
      } else {
        // Success!
        w.kitchen.trayGrabbed = true;
        w.phase = 'completed';
        w.score += 500;
        if (isShortStop) w.score += 250; // Bonus for surviving the Short Stop reach!
        w.ordersServed += 1;
        addDriveThruEvent(
          w,
          'order_delivered',
          'ORDER SERVED! Successfully survived the drive-thru meltdown!',
        );
        addDriveThruEvent(w, 'round_win', `Shift complete! Score: ${w.score}`);
      }
    }
  }
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
