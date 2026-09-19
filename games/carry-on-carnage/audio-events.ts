import type { AudioEvent, Footsteps, Point } from '../../shared/audio/world';
import { takeBase } from './audio/profile';
import { TSA_GATE_X, WALK_SPEED } from './physics';
import {
  REACH_DISTANCE,
  ROUND_MS,
  timeLeft,
  type CarryOnEvent,
  type CarryOnWorld,
  type ItemKind,
  type Traveler,
} from './types';

/**
 * What Carry-On Carnage should sound like, decided from plain world states so
 * it can be tested without a browser. `CarryOnSound` only applies the answers.
 */

/** The HUD's FINAL CALL window: the music and the hall tense up with it. */
export const FINAL_CALL_MS = 30_000;
/** How long the win or fail sting holds before the lounge music returns. */
export const RESULT_STING_MS = 9_000;
/** At most one incidental narrator line in this window. */
export const NARRATOR_GAP_MS = 7_000;
/** The same incidental line never twice in this window. */
export const LINE_REPEAT_MS = 20_000;
/** Falling faster than this (m/s) makes an item audible when it lands. */
const LANDING_SPEED = 2;
/** Other travellers' footsteps beyond this distance are left out. */
const STEP_RANGE = 14;

export const ITEM_MATERIAL: Record<ItemKind, 'soft' | 'hard' | 'glass'> = {
  clothes: 'soft',
  duck: 'soft',
  flamingo: 'soft',
  shoes: 'soft',
  racket: 'hard',
  lobster: 'hard',
  shampoo: 'hard',
  snowglobe: 'glass',
};

export const ROUND_START: readonly AudioEvent[] = [
  { id: 'carryon.airport_chime' },
  { id: 'speech.start' },
];

/** Lines that cut off whatever the narrator is saying and skip the rate limit. */
export const URGENT_LINES: ReadonlySet<string> = new Set([
  'speech.one-minute',
  'speech.ten-seconds',
  'speech.target',
  'speech.win',
  'speech.fail',
]);

/** Minimum gap (world ms) between repeats of one cue from one source. */
const CUE_GAPS: Record<string, number> = {
  'luggage.zip_jam': 1_500,
  'carryon.compress_groan': 400,
  'carryon.zipper_pull': 150,
  'luggage.pickup': 350,
  'luggage.set_down': 350,
  'item.grab': 120,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const point = (at: { x: number; y: number; z: number }): Point => ({
  x: at.x,
  y: at.y,
  z: at.z,
});
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
const eventPoint = (event: CarryOnEvent): Point | undefined =>
  event.pos ? { x: event.pos[0], y: event.pos[1], z: event.pos[2] } : undefined;

export const carryOnWon = (world: CarryOnWorld) =>
  world.approvedCount >= world.targetBags;

export const carryOnSurface = (player: Traveler) =>
  player.wearingTinFoil ? 'foil' : 'tile';

/** A restart, a rejoin or a clock jump: nothing from before may replay. */
export function carryOnAudioDiscontinuity(
  previous: CarryOnWorld,
  next: CarryOnWorld,
) {
  return (
    previous.started !== next.started ||
    next.clock < previous.clock ||
    next.clock - previous.clock > 2_500
  );
}

function newEvents(old: CarryOnWorld, next: CarryOnWorld) {
  let seen = 0;
  for (const event of old.events) seen = Math.max(seen, event.id);
  return next.events.filter((event) => event.id > seen);
}

/**
 * One-shot cues for what changed between two confirmed world states. A first
 * state, or one after a discontinuity, only announces a round that has just
 * begun; everything older stays silent.
 */
export function carryOnAudioEvents(
  previous: CarryOnWorld | null,
  next: CarryOnWorld,
  localId: string,
): AudioEvent[] {
  if (!previous || carryOnAudioDiscontinuity(previous, next))
    return next.phase === 'packing' && next.clock - next.started < 750
      ? [...ROUND_START]
      : [];
  const old = previous;
  const cues: AudioEvent[] = [];
  const play = (id: string, position?: Point, strength?: number) =>
    cues.push({ id, position, strength });
  const me = next.players.find((player) => player.id === localId);

  // Urgent narration first: the player lets one voice speak at a time.
  if (old.phase !== next.phase) {
    if (next.phase === 'flight_departed') {
      const won = carryOnWon(next);
      play(won ? 'speech.win' : 'speech.fail');
      play('terminal.takeoff');
      if (won) play('gate.cheer');
    } else if (next.phase === 'packing') cues.push(...ROUND_START);
  }
  const targetReached =
    old.approvedCount < old.targetBags && next.approvedCount >= next.targetBags;
  if (targetReached) {
    play('speech.target');
    play('gate.cheer');
  }
  if (old.phase === 'packing' && next.phase === 'packing') {
    const before = timeLeft(old),
      after = timeLeft(next);
    const crossed = (mark: number) => before > mark && after <= mark;
    if (crossed(10_000)) play('speech.ten-seconds');
    if (crossed(60_000)) {
      play('carryon.airport_chime');
      play('speech.one-minute');
    }
    if (crossed(FINAL_CALL_MS)) play('carryon.airport_chime');
    if (crossed(ROUND_MS / 2)) {
      play('carryon.airport_chime');
      play('speech.halfway');
    }
    // The departures board flips on each of the last ten seconds.
    const second = Math.ceil(after / 1000);
    if (second < Math.ceil(before / 1000) && second >= 1 && second <= 10)
      play('terminal.board_flap');
  }

  const smuggled = next.contrabandCount > old.contrabandCount;
  for (const event of newEvents(old, next)) {
    const at = eventPoint(event);
    switch (event.type) {
      case 'pack':
        if (event.detail === 'inserted') {
          play('gate.sizer_insert', at);
          play('gate.sizer_scan', at);
        } else if (event.item && event.detail !== 'unpacked')
          play(`item.${event.item}.pack`, at);
        // An unpack is heard as the grab below; the boarding call is the round start.
        break;
      case 'compress':
        play('carryon.compress_groan', at);
        break;
      case 'zip':
        if (event.detail === 'jammed') {
          play('luggage.zip_jam', at);
          // The hint is for whoever is at that zipper, not for the bots' troubles.
          if (me && at && flat(me, at) < REACH_DISTANCE + 1) play('speech.jam');
        } else
          play(
            event.detail === 'closed'
              ? 'luggage.zip_closed'
              : 'carryon.zipper_pull',
            at,
          );
        break;
      case 'burst':
        play('carryon.burst_pinata', at);
        play('speech.burst');
        break;
      case 'tsa_distracted':
        if (event.detail === 'sneak') {
          play('security.sneak', at);
          break;
        }
        play('carryon.tsa_alarm', at);
        play('speech.tsa-distracted');
        break;
      case 'tsa_alarm':
        play('carryon.tsa_alarm', at);
        play('speech.tsa-distracted');
        break;
      case 'tsa_caught':
        play('security.whistle', at);
        play('speech.tsa-caught');
        break;
      case 'sizer_passed':
        play('carryon.sizer_pass', at);
        if (!targetReached)
          play(smuggled ? 'speech.contraband' : 'speech.approved');
        break;
      case 'sizer_rejected':
        play('carryon.sizer_reject', at);
        play('gate.fee', at);
        play('speech.rejected');
        break;
      case 'flight_departed':
        // The phase change above carries the departure.
        break;
    }
  }

  const oldItems = new Map(old.items.map((item) => [item.id, item]));
  for (const item of next.items) {
    const before = oldItems.get(item.id);
    if (!before) continue;
    if (item.heldBy && item.heldBy !== before.heldBy) {
      const holder = next.players.find((player) => player.id === item.heldBy);
      const at = point(holder ?? item);
      play('item.grab', at, item.heldBy === localId ? 0.85 : 0.55);
      if (item.kind === 'lobster') play('carryon.lobster_pinch', at);
    } else if (
      !item.heldBy &&
      !item.packedIn &&
      !before.heldBy &&
      !before.packedIn &&
      before.vy < -LANDING_SPEED &&
      item.vy > before.vy + LANDING_SPEED / 2 &&
      item.y < 0.6
    )
      play(
        `item.land.${ITEM_MATERIAL[item.kind]}`,
        point(item),
        Math.max(0.3, Math.min(1, -before.vy / 8)),
      );
  }

  const oldCases = new Map(old.suitcases.map((sc) => [sc.id, sc]));
  for (const sc of next.suitcases) {
    const before = oldCases.get(sc.id);
    if (!before) continue;
    if (sc.heldBy && !before.heldBy)
      play('luggage.pickup', point(sc), sc.heldBy === localId ? 0.9 : 0.6);
    else if (
      !sc.heldBy &&
      before.heldBy &&
      next.sizer.insertedSuitcase !== sc.id
    )
      play(
        'luggage.set_down',
        point(sc),
        before.heldBy === localId ? 0.9 : 0.6,
      );
  }

  // Several bags or items doing the same thing in one frame make one sound.
  const heard = new Set<string>();
  return cues.filter((cue) => {
    if (heard.has(cue.id)) return false;
    heard.add(cue.id);
    return true;
  });
}

/** Footsteps, jumps and landings, heard from how far each traveller moved. */
export function carryOnMovement(
  footsteps: Footsteps,
  world: CarryOnWorld,
  localId: string,
): AudioEvent[] {
  if (world.phase !== 'packing') return [];
  const me = world.players.find((player) => player.id === localId);
  const cues: AudioEvent[] = [];
  for (const player of world.players) {
    // Sitting on a suitcase moves the body without a single step.
    if (player.sittingOn) continue;
    const local = player.id === localId;
    const near = local || !me || flat(player, me) < STEP_RANGE;
    const down = player.downUntil > world.clock;
    for (const cue of footsteps.update(
      player.id,
      point(player),
      player.grounded,
      carryOnSurface(player),
      world.clock,
    )) {
      // A traveller flung by a burst skids across the floor without walking.
      if (!near || (down && cue.id.startsWith('step.'))) continue;
      cues.push({ ...cue, strength: local ? 0.75 : 0.3, sourceId: player.id });
    }
  }
  return cues;
}

export type CarryOnLoop = { id: string | null; level: number };
export type CarryOnLoops = Record<
  'terminal' | 'apron' | 'security' | 'wheels' | 'strain',
  CarryOnLoop
>;

/** The layered beds and how loud each is for this listener, right now. */
export function carryOnAmbience(
  world: CarryOnWorld,
  localId: string,
): CarryOnLoops {
  const me = world.players.find((player) => player.id === localId);
  const ear = me ?? { x: 0, z: 0 };
  const packing = world.phase === 'packing';
  const urgency = packing ? clamp01(1 - timeLeft(world) / FINAL_CALL_MS) : 0;
  // 1 against the runway windows along the back wall, 0 at the front.
  const windows = clamp01((5 - ear.z) / 10);
  let wheels = 0;
  let strain = 0;
  if (packing) {
    for (const player of world.players) {
      if (!player.holdingSuitcase || player.sittingOn || !player.grounded)
        continue;
      const speed = clamp01(Math.hypot(player.vx, player.vz) / WALK_SPEED);
      const weight =
        player.id === localId ? 1 : 0.45 * clamp01(1 - flat(player, ear) / 12);
      wheels = Math.max(wheels, speed * weight);
    }
    for (const sc of world.suitcases) {
      if (sc.burst || sc.zipped >= 0.9) continue;
      const tension = clamp01((sc.strain - 0.35) / 1.2);
      strain = Math.max(
        strain,
        tension * (0.35 + 0.65 * clamp01(1 - flat(sc, ear) / 10)),
      );
    }
  }
  return {
    terminal: {
      id: 'ambience.terminal',
      level: packing ? 0.75 + 0.25 * urgency : 0.55,
    },
    // The engines spool up as departure nears; after it the apron is quieter.
    apron: {
      id: 'ambience.apron',
      level:
        world.phase === 'flight_departed'
          ? 0.3
          : 0.35 + 0.3 * windows + 0.35 * urgency,
    },
    security: {
      id: 'ambience.security',
      level:
        0.12 + 0.88 * clamp01(1 - flat(ear, { x: TSA_GATE_X, z: -2.2 }) / 9),
    },
    wheels: { id: packing ? 'ambience.wheels' : null, level: wheels },
    strain: { id: packing ? 'ambience.strain' : null, level: strain },
  };
}

/** Lounge music between rounds, packing music, the final call, then one sting. */
export function carryOnMusic(world: CarryOnWorld) {
  if (world.phase === 'lobby') return 'music.menu';
  if (world.phase === 'flight_departed')
    return world.clock - world.deadline >= RESULT_STING_MS
      ? 'music.menu'
      : carryOnWon(world)
        ? 'music.win'
        : 'music.fail';
  return timeLeft(world) <= FINAL_CALL_MS ? 'music.tension' : 'music.play';
}

/**
 * Keeps the commentary sparse and repeats from stacking up. Urgent lines
 * interrupt; an incidental line waits for a quiet moment and is not repeated
 * soon; frequent effects keep a small gap per source.
 */
export class CarryOnCueGate {
  private speechAt = Number.NEGATIVE_INFINITY;
  private lines = new Map<string, number>();
  private cues = new Map<string, number>();

  reset() {
    this.speechAt = Number.NEGATIVE_INFINITY;
    this.lines.clear();
    this.cues.clear();
  }

  admit(cue: AudioEvent, clock: number): 'play' | 'interrupt' | null {
    const { id } = cue;
    if (id.startsWith('speech.')) {
      const urgent = URGENT_LINES.has(id);
      if (
        !urgent &&
        (clock - this.speechAt < NARRATOR_GAP_MS ||
          clock - (this.lines.get(id) ?? Number.NEGATIVE_INFINITY) <
            LINE_REPEAT_MS)
      )
        return null;
      this.speechAt = clock;
      this.lines.set(id, clock);
      return urgent ? 'interrupt' : 'play';
    }
    const base = takeBase(id);
    const gap = CUE_GAPS[base];
    if (!gap) return 'play';
    const key = cue.sourceId ? `${base}:${cue.sourceId}` : base;
    if (clock - (this.cues.get(key) ?? Number.NEGATIVE_INFINITY) < gap)
      return null;
    this.cues.set(key, clock);
    return 'play';
  }
}
