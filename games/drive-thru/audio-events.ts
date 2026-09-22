import {
  GRILL_BOUNDS,
  SPEAKER_POLE_POS,
  SPEAKER_POLE_RADIUS,
  WINDOW_SILL_POS,
} from './physics';
import type {
  BurgerLayer,
  DriveThruPlayer,
  DriveThruWorld,
  GamePhase,
  RoleId,
} from './types';

/**
 * Pure sound planning for Drive-Thru Static. Nothing here touches Web Audio:
 * `DriveThruSound` feeds it the previous and next world each frame and plays
 * whatever it returns, so every rule is testable in Node.
 */

export type Point = { x: number; y?: number; z: number };
export type DriveThruCue = {
  id: string;
  position?: Point;
  strength?: number;
  /** Speech that cuts off the current line instead of waiting its turn. */
  urgent?: boolean;
  /** Minimum milliseconds since this cue last played; the player enforces it. */
  gap?: number;
};

/** Fixed places on the lot, matching `models.ts`. */
export const SPOTS = {
  speaker: { x: SPEAKER_POLE_POS.x, y: 1.4, z: SPEAKER_POLE_POS.z },
  window: { x: WINDOW_SILL_POS.x, y: WINDOW_SILL_POS.y, z: WINDOW_SILL_POS.z },
  grill: { x: 4.2, y: GRILL_BOUNDS.y, z: -0.75 },
  fryer: { x: 4.2, y: 0.9, z: 2.5 },
  shake: { x: 3.6, y: 1.4, z: -2.2 },
  soda: { x: 3.4, y: 1.1, z: -1.4 },
  tray: { x: 4.4, y: 0.95, z: -0.2 },
  drain: { x: 1.5, y: -0.4, z: 0 },
  kitchen: { x: 5.6, y: 1.2, z: 0 },
} as const;

/** Round clock moments, in milliseconds since the round started. */
export const MOMENTS = {
  /** A snapshot this young counts as the start of the round. */
  fresh: 1500,
  /** Still parked at the speaker by now: the narrator nudges the driver on. */
  idleNudge: 8000,
  /** Nothing has gone wrong yet by now: a little encouragement. */
  encourage: 12000,
} as const;

/** After a meltdown, the narrator's verdict follows the disaster line. */
export const VERDICT_DELAY_MS = 5000;
/** The win / fail stinger has finished by now; the result screen gets the menu loop. */
export const RESULT_MUSIC_MS = 9000;
/** Tension music holds this long after the last dangerous moment. */
export const TENSION_HOLD_MS = 6000;

export const STACK_CUES: Record<BurgerLayer, string> = {
  bottom_bun: 'event.stack-bun',
  top_bun: 'event.stack-bun',
  patty: 'event.stack-patty',
  cheese: 'event.stack-topping',
  lettuce: 'event.stack-topping',
};

const clamp = (value: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, value));
/** True when the clock crossed a multiple of `every` between two worlds. */
const ticked = (a: DriveThruWorld, b: DriveThruWorld, every: number) =>
  Math.floor(a.clock / every) !== Math.floor(b.clock / every);
const crossedUp = (before: number, after: number, line: number) =>
  before < line && after >= line;

export const isActivePhase = (phase: GamePhase) =>
  phase === 'ordering' || phase === 'assembling' || phase === 'reaching';
export const isEndedPhase = (phase: GamePhase) =>
  phase === 'completed' || phase === 'meltdown';
const timedPhase = isActivePhase;

export function localRole(world: DriveThruWorld, localId: string): RoleId {
  return world.players.find((p) => p.id === localId)?.role ?? 'driver';
}
const inCar = (role: RoleId) => role === 'driver' || role === 'passenger';

export const carPoint = (w: DriveThruWorld): Point => ({
  x: w.car.x,
  y: 0.8,
  z: w.car.z,
});
/** The open passenger window on the car's right-hand side. */
const passengerPoint = (w: DriveThruWorld): Point => ({
  x: w.car.x + Math.cos(w.car.yaw) * 0.9,
  y: 1,
  z: w.car.z + Math.sin(w.car.yaw) * 0.9,
});
export const speakerDistance = (w: DriveThruWorld) =>
  Math.hypot(w.car.x - SPEAKER_POLE_POS.x, w.car.z - SPEAKER_POLE_POS.z);
const windowDistance = (w: DriveThruWorld) =>
  Math.hypot(w.car.x - WINDOW_SILL_POS.x, w.car.z - WINDOW_SILL_POS.z);
const poleStanding = (w: DriveThruWorld) =>
  !w.car.reversedIntoPole && w.failState !== 'pole_crash';
/** Car centre to pole distance while the bumper is touching it (see physics). */
const POLE_CONTACT = SPEAKER_POLE_RADIUS + 1.25;
const curbRubbing = (w: DriveThruWorld) =>
  w.car.x >= 1.799 || w.car.x <= -7.999;
const cornering = (w: DriveThruWorld) =>
  Math.abs(w.car.steer) > 0.5 && Math.abs(w.car.speed) > 7;

/**
 * A copy of just what the planner compares. The game mutates one world in
 * place every frame, so the previous frame has to be kept separately.
 */
export function audioCopy(w: DriveThruWorld): DriveThruWorld {
  return {
    ...w,
    car: { ...w.car },
    kitchen: {
      ...w.kitchen,
      patties: w.kitchen.patties.map((p) => ({ ...p })),
      trayStack: [...w.kitchen.trayStack],
    },
    distractions: { ...w.distractions },
    players: w.players.map((p) => ({ ...p, input: { ...p.input } })),
    events: w.events.map((e) => ({ ...e })),
  };
}

/** A new round, a clock running backwards or a long gap: never replay history. */
export function driveThruAudioDiscontinuity(
  previous: DriveThruWorld,
  next: DriveThruWorld,
) {
  return (
    previous.started !== next.started ||
    next.clock < previous.clock ||
    next.clock - previous.clock > 2500
  );
}

/** The car rolls up to the speaker, the kitchen drops the first fries. */
export function roundStartCues(w: DriveThruWorld): DriveThruCue[] {
  return [
    { id: 'speech.welcome' },
    { id: 'event.lane-chime', strength: 0.8 },
    { id: 'event.speaker-crackle', position: SPOTS.speaker, strength: 0.8 },
    ...(w.kitchen.fryerBasketDown
      ? [{ id: 'event.fryer-splash', position: SPOTS.fryer, strength: 0.7 }]
      : []),
  ];
}

const lastEventId = (w: DriveThruWorld) =>
  w.events.reduce((max, event) => Math.max(max, event.id), 0);

const driverOf = (w: DriveThruWorld): DriveThruPlayer | undefined =>
  w.players.find((p) => p.role === 'driver');

/**
 * One-shot cues for what changed between two frames of the same round. Speech
 * comes out in priority order: results and disasters first.
 */
export function driveThruAudioEvents(
  previous: DriveThruWorld | null,
  next: DriveThruWorld,
  localId: string,
): DriveThruCue[] {
  if (!previous || driveThruAudioDiscontinuity(previous, next))
    return isActivePhase(next.phase) &&
      next.clock - next.started >= 0 &&
      next.clock - next.started < MOMENTS.fresh
      ? roundStartCues(next)
      : [];

  const a = previous;
  const b = next;
  const role = localRole(b, localId);
  // The grill clatters all round; the cook hears it fully, everyone else less.
  const grillLevel = role === 'grill' ? 1 : 0.55;
  const car = carPoint(b);
  const cues: DriveThruCue[] = [];
  const used = new Set<string>();
  const add = (
    id: string,
    position?: Point,
    strength = 1,
    extra: Pick<DriveThruCue, 'urgent' | 'gap'> = {},
  ) => {
    if (used.has(id)) return;
    used.add(id);
    cues.push({ id, position, strength: clamp(strength), ...extra });
  };
  const say = (id: string, urgent = false) =>
    add(id, undefined, 1, urgent ? { urgent } : {});

  // Results and disasters.
  if (a.phase === 'lobby' && isActivePhase(b.phase))
    for (const cue of roundStartCues(b))
      add(cue.id, cue.position, cue.strength);
  if (a.failState === 'none' && b.failState !== 'none') {
    if (b.failState === 'grease_fire') {
      say('speech.fire-alert', true);
      add(
        'event.grease-fire',
        b.kitchen.fryerGreaseFire ? SPOTS.fryer : SPOTS.grill,
      );
    } else if (b.failState === 'pole_crash') {
      say('speech.pole-crash', true);
      add('event.pole-crash', SPOTS.speaker);
    } else if (b.failState === 'curb_plop') {
      say('speech.curb-plop', true);
      add('event.curb-plop', SPOTS.drain);
    } else add('event.windshield-splat', car);
  }
  if (a.phase !== 'completed' && b.phase === 'completed') {
    say('speech.win', true);
    add('event.order-served');
    add('event.tray-grab', SPOTS.window);
  }

  // Confirmed new simulation events.
  const seen = lastEventId(a);
  for (const event of b.events) {
    if (event.id <= seen) continue;
    switch (event.kind) {
      case 'order_placed':
        add('event.speaker-crackle', SPOTS.speaker, 0.8);
        break;
      case 'horn_honked':
        add('event.car-horn', car, 1, { gap: 350 });
        break;
      case 'patty_flipped':
        add(
          'event.patty-flip',
          {
            x: b.kitchen.spatulaX,
            y: GRILL_BOUNDS.y,
            z: b.kitchen.spatulaZ,
          },
          grillLevel,
        );
        break;
      case 'patty_burnt':
        add('event.patty-burnt', SPOTS.grill);
        break;
      case 'grease_fire':
        add('event.grease-fire', SPOTS.fryer);
        break;
      case 'fryer_lifted':
        // Holding the button re-sends this every frame; only a real lift counts.
        if (a.kitchen.fryerBasketDown && !b.kitchen.fryerBasketDown)
          add('event.fryer-lift', SPOTS.fryer);
        break;
      case 'shake_vented':
        // Venting an empty machine releases nothing, so it makes no hiss.
        if (a.kitchen.shakePressure > 0 && b.kitchen.shakeVenting)
          add(
            'event.shake-vent',
            SPOTS.shake,
            clamp(a.kitchen.shakePressure / 70, 0.45, 1),
            { gap: 300 },
          );
        break;
      case 'shake_exploded':
        say('speech.shake-explode', true);
        add('event.shake-explode', SPOTS.shake);
        break;
      case 'pole_crashed':
        add('event.pole-crash', SPOTS.speaker);
        break;
      case 'windshield_splatted':
        add('event.windshield-splat', car);
        break;
      case 'short_stop_reach':
        say('speech.short-stop', true);
        add('event.short-stop-reach', passengerPoint(b));
        break;
      case 'order_delivered':
        add('event.order-served');
        add('event.tray-grab', SPOTS.window);
        break;
      case 'curb_plop':
        add('event.curb-plop', SPOTS.drain);
        break;
      case 'meltdown':
      case 'round_win':
        // Voiced from the fail state and the phase, which carry the reason.
        break;
    }
  }

  // The rest only happens while the shift is running.
  if (!isActivePhase(b.phase)) return cues;

  // The clock on the ticket.
  if (timedPhase(a.phase) && a.ticket?.id === b.ticket?.id) {
    const was = Math.ceil(a.phaseTimer);
    const now = Math.ceil(b.phaseTimer);
    if (was > 10 && now <= 10 && now > 0) say('speech.ten-seconds', true);
    if (now < was && now >= 1 && now <= 5)
      add('event.countdown-tick', undefined, 0.7);
  }
  if (a.phase === 'ordering' && b.phase === 'assembling')
    add('event.ticket-print', SPOTS.tray);
  if (a.phase !== 'reaching' && b.phase === 'reaching')
    add('event.window-slide', SPOTS.window);

  // Tray and window.
  if (!a.kitchen.trayAtWindow && b.kitchen.trayAtWindow) {
    say('speech.order-ready');
    add('event.tray-slide', SPOTS.window);
  }
  if (!a.kitchen.trayGrabbed && b.kitchen.trayGrabbed)
    add('event.tray-grab', SPOTS.window);
  if (b.kitchen.trayStack.length > a.kitchen.trayStack.length) {
    const added = b.kitchen.trayStack.slice(a.kitchen.trayStack.length);
    for (const layer of added) add(STACK_CUES[layer], SPOTS.tray, 0.8);
    if (added.includes('top_bun')) add('event.burger-wrap', SPOTS.tray);
  }

  // Kitchen machines.
  if (
    !b.kitchen.shakeExploded &&
    crossedUp(a.kitchen.shakePressure, b.kitchen.shakePressure, 75)
  ) {
    say('speech.shake-warning');
    add('event.shake-strain', SPOTS.shake);
  }
  if (
    b.kitchen.fryerBasketDown &&
    crossedUp(a.kitchen.fryerTimer, b.kitchen.fryerTimer, 0.8)
  )
    say('speech.fryer-warning');
  if (b.kitchen.sodasPoured > a.kitchen.sodasPoured)
    add('event.soda-pour', SPOTS.soda, 0.75);

  // The round clock: a nudge at the speaker, then encouragement.
  const before = a.clock - a.started;
  const after = b.clock - b.started;
  const nearSpeaker = speakerDistance(b) < 4.5;
  if (crossedUp(before, after, MOMENTS.idleNudge) && nearSpeaker)
    say('speech.intercom-scramble');
  if (
    crossedUp(before, after, MOMENTS.encourage) &&
    !nearSpeaker &&
    b.failState === 'none'
  )
    say('speech.encourage');

  // The grill.
  for (const patty of b.kitchen.patties) {
    const old = a.kitchen.patties.find((p) => p.id === patty.id);
    if (!old) continue;
    const at = { x: patty.x, y: patty.y, z: patty.z };
    if (old.state === 'raw' && patty.state === 'sizzling')
      add('event.grill-sizzle', at, 0.8 * grillLevel);
    if (
      old.state !== 'burnt' &&
      old.state !== 'fire' &&
      patty.state === 'burnt'
    )
      add('event.patty-burnt', at);
    if (old.y > GRILL_BOUNDS.y + 0.02 && patty.y <= GRILL_BOUNDS.y + 0.001)
      add('event.patty-land', at, clamp(-old.vy / 4, 0.5, 1) * grillLevel);
  }
  const spatulaMoved = Math.hypot(
    b.kitchen.spatulaX - a.kitchen.spatulaX,
    b.kitchen.spatulaZ - a.kitchen.spatulaZ,
  );
  if (spatulaMoved > 0.001 && ticked(a, b, 320))
    add(
      'event.spatula-scrape',
      { x: b.kitchen.spatulaX, y: GRILL_BOUNDS.y, z: b.kitchen.spatulaZ },
      0.6 * grillLevel * grillLevel,
    );

  // The driver's pedals and horn.
  const was = driverOf(a);
  const is = driverOf(b);
  if (was && is && was.id === is.id) {
    if (is.input.action3 && !was.input.action3)
      add(
        'event.car-horn',
        car,
        is.bot ? 0.6 : 1,
        // A bot honks at the toddler on a whim; keep it occasional.
        { gap: is.bot ? 1800 : 350 },
      );
    if (is.input.action1 && !was.input.action1 && Math.abs(a.car.speed) < 4)
      add(
        b.distractions.screechingBelt ? 'event.fan-belt' : 'event.engine-rev',
        car,
        0.9,
        { gap: 1500 },
      );
    if (is.input.action2 && !was.input.action2 && a.car.speed > 3)
      add('event.tyre-screech', car, clamp(a.car.speed / 9, 0.4, 1), {
        gap: 1200,
      });
  }
  if (cornering(b) && !cornering(a))
    add('event.tyre-screech', car, 0.8, { gap: 1200 });

  // The car against the lot. Damage stops counting at 100, so a bounce off
  // the pole (the speed flips sign right beside it) counts as a bump too.
  const bounced =
    a.car.speed * b.car.speed < 0 &&
    Math.abs(a.car.speed) > 1 &&
    speakerDistance(b) < POLE_CONTACT;
  if (
    (b.car.bumperDamage > a.car.bumperDamage || bounced) &&
    !b.car.reversedIntoPole
  )
    add(
      'event.pole-bump',
      SPOTS.speaker,
      clamp(Math.abs(a.car.speed) / 6, 0.4, 1),
      { gap: 500 },
    );
  if (
    curbRubbing(b) &&
    Math.abs(b.car.speed) > 0.5 &&
    (!curbRubbing(a) || ticked(a, b, 700))
  )
    add('event.curb-scrape', car, clamp(Math.abs(b.car.speed) / 6, 0.4, 1));
  if (poleStanding(b) && speakerDistance(b) < 6 && ticked(a, b, 3200))
    add(
      'event.speaker-crackle',
      SPOTS.speaker,
      (0.35 + 0.65 * b.distractions.radioStaticIntensity) *
        (1 - speakerDistance(b) / 8),
    );

  // Inside the cabin.
  if (b.distractions.toddlerSqueaking && ticked(a, b, 2600))
    add('event.toddler-toy', car, 0.75);
  if (
    (a.distractions.toddlerSqueaking && !b.distractions.toddlerSqueaking) ||
    (a.distractions.screechingBelt && !b.distractions.screechingBelt)
  )
    add('event.distraction-swat', car);
  if (b.car.wipersActive && !a.car.wipersActive)
    add('event.wiper-sweep', car, 0.7);
  else if (
    b.car.wipersActive &&
    b.car.windshieldSplat > 0.02 &&
    ticked(a, b, 1100)
  )
    add('event.wiper-sweep', car, 0.4 + 0.6 * b.car.windshieldSplat);
  if (crossedUp(a.car.passengerReach, b.car.passengerReach, 0.45))
    add('event.passenger-lean', passengerPoint(b), 0.8, { gap: 1500 });
  if (
    b.phase === 'reaching' &&
    crossedUp(Math.abs(a.car.balanceMeter), Math.abs(b.car.balanceMeter), 0.6)
  )
    add('event.balance-wobble', car, 0.9, { gap: 1500 });

  return cues;
}

/** The narrator's verdict, a few seconds after a meltdown. */
export function driveThruResultCues(
  w: DriveThruWorld,
  endedBefore: number,
  endedNow: number,
): DriveThruCue[] {
  return w.phase === 'meltdown' &&
    endedBefore >= 0 &&
    crossedUp(endedBefore, endedNow, VERDICT_DELAY_MS)
    ? [{ id: 'speech.fail', urgent: true }]
    : [];
}

/** Something is about to go badly wrong (or the ticket clock is nearly out). */
export function driveThruDanger(w: DriveThruWorld): boolean {
  if (!isActivePhase(w.phase)) return false;
  const k = w.kitchen;
  return (
    (timedPhase(w.phase) && w.phaseTimer > 0 && w.phaseTimer <= 10) ||
    (!k.shakeExploded && k.shakePressure >= 70) ||
    (k.fryerBasketDown && k.fryerTimer >= 0.7) ||
    // A patty this dark catches fire within seconds unless it is served.
    k.patties.some((p) => p.state !== 'fire' && p.burnProgress >= 0.6) ||
    (w.phase === 'reaching' && Math.abs(w.car.balanceMeter) >= 0.5)
  );
}

/**
 * The music for a world: menu in the lobby, the rush while playing, tension
 * near a disaster, then the win or fail stinger once, then the menu again
 * under the result screen.
 */
export function driveThruMusic(
  w: DriveThruWorld,
  endedFor: number,
  tense: boolean,
): string {
  if (isEndedPhase(w.phase))
    return endedFor >= RESULT_MUSIC_MS
      ? 'music.menu'
      : w.phase === 'completed'
        ? 'music.win'
        : 'music.fail';
  if (!isActivePhase(w.phase)) return 'music.menu';
  return tense ? 'music.tension' : 'music.drive-thru-rush';
}

export type AmbienceChannel =
  | 'lane'
  | 'kitchen'
  | 'engine'
  | 'intercom'
  | 'fire';
export type AmbienceMix = Record<
  AmbienceChannel,
  { id: string; level: number } | null
>;

/** Layered beds, each mixed by where the local player is and what is going on. */
export function driveThruAmbience(
  w: DriveThruWorld,
  localId: string,
): AmbienceMix {
  const role = localRole(w, localId);
  const car = inCar(role);
  if (w.phase === 'lobby')
    return {
      lane: { id: 'ambience.drive-thru-lane', level: 0.5 },
      kitchen: null,
      engine: null,
      intercom: null,
      fire: null,
    };
  const ended = isEndedPhase(w.phase);
  const k = w.kitchen;
  // 1 with the car at the pickup window, 0 back at the speaker.
  const nearKitchen = clamp(1 - (windowDistance(w) - 3) / 12);
  const activity = clamp(
    (k.patties.filter((p) => p.state === 'sizzling' || p.state === 'cooked')
      .length /
      3) *
      0.5 +
      (k.fryerBasketDown ? k.fryerTimer * 0.3 : 0) +
      (k.shakeExploded ? 0 : (k.shakePressure / 100) * 0.2),
  );
  const speed = clamp(Math.abs(w.car.speed) / 11);
  const hearing = clamp(1 - (speakerDistance(w) - 2) / 10);
  const intercom =
    !ended && poleStanding(w)
      ? w.distractions.radioStaticIntensity *
        (car ? hearing : w.phase === 'ordering' ? 0.35 : 0.15)
      : 0;
  const fire =
    w.failState === 'grease_fire'
      ? 0.9
      : !ended && k.patties.some((p) => p.state === 'burnt')
        ? 0.3
        : 0;
  return {
    lane: {
      id: 'ambience.drive-thru-lane',
      level: (car ? 0.85 : 0.4) * (ended ? 0.7 : 1),
    },
    kitchen: {
      id: 'ambience.kitchen-chaos',
      level:
        (car ? 0.2 + 0.55 * nearKitchen : 0.85) *
        (0.75 + 0.25 * activity) *
        (ended ? 0.7 : 1),
    },
    engine: {
      id: 'ambience.sedan-engine',
      level: (car ? 1 : 0.2 + 0.45 * nearKitchen) * (0.35 + 0.65 * speed),
    },
    intercom:
      intercom >= 0.03
        ? { id: 'ambience.intercom-static', level: intercom }
        : null,
    fire:
      fire > 0
        ? { id: 'ambience.grease-fire', level: fire * (car ? 0.6 : 1) }
        : null,
  };
}

/** Where the local player hears from: the car's cabin or the kitchen camera. */
export function driveThruListener(
  w: DriveThruWorld,
  localId: string,
): { position: Point; yaw: number } {
  // SiteAudio pans by (dx cos yaw - dz sin yaw): -car yaw faces the car's
  // right-hand side to the right ear; the kitchen camera looks down -x.
  return inCar(localRole(w, localId))
    ? { position: { x: w.car.x, y: 1, z: w.car.z }, yaw: -w.car.yaw }
    : { position: SPOTS.kitchen, yaw: Math.PI / 2 };
}
