import { Collapse, STEP } from './physics';
import { driveBots, reconcileSiteNpcs } from './bots';
import type { NpcSlot } from '../../shared/rooms/npc-slots';
import {
  HALF_D,
  HALF_W,
  PIANO_BAY,
  buildHouse,
  pianoSupport,
  releaseUnsupported,
  strainOf,
} from './structure';
import {
  FLOOR,
  HELP_REACH,
  PART_NAMES,
  PIANO_INTEGRITY,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  RUBBLE_HEIGHT,
  ROUND_MS,
  SWING_MS,
  SWING_REACH,
  alive,
  clamp,
  idleInput,
  partBottom,
  partTop,
  timeLeft,
  type LoadAction,
  type LoadEvent,
  type LoadSnapshot,
  type LoadWorld,
  type Part,
  type Wrecker,
} from './types';

const YARD = { x: 13, z: 11 };
const DOWN_MS = 9000;

export function freshSite(
  now: number,
  mode: LoadWorld['mode'] = 'normal',
  seed = 1,
): LoadWorld {
  return {
    clock: now,
    started: 0,
    remainder: 0,
    phase: 'lobby',
    mode,
    players: [],
    parts: buildHouse(),
    piano: {
      x: PIANO_BAY.x,
      y: 4.25,
      z: PIANO_BAY.z,
      vy: 0,
      integrity: PIANO_INTEGRITY,
      resting: true,
    },
    crane: {
      owner: null,
      x: 0,
      y: 9,
      z: -8,
      ballX: 0,
      ballY: 5,
      ballZ: -8,
      vx: 0,
      vy: 0,
      vz: 0,
    },
    standing: 0,
    events: [],
    eventId: 0,
    seed,
  };
}

export function newWrecker(
  id: string,
  name: string,
  color: number,
  now: number,
): Wrecker {
  return {
    id,
    name: name.slice(0, 18),
    color,
    x: -8 + (color % 2) * 2.2,
    y: FLOOR,
    z: 8 + Math.floor(color / 2) * 1.6,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: Math.PI,
    grounded: true,
    down: false,
    downUntil: 0,
    swingUntil: 0,
    seen: now,
    input: idleInput(),
    lastJump: -1,
    lastAction: -10000,
    hits: 0,
  };
}

function emit(w: LoadWorld, kind: LoadEvent['kind'], text: string) {
  w.events.push({ id: ++w.eventId, at: w.clock, kind, text });
  if (w.events.length > 24) w.events.shift();
}

export const standingParts = (w: LoadWorld) =>
  w.parts.filter((p) => alive(p) && partTop(p) > RUBBLE_HEIGHT);

export function removeWrecker(w: LoadWorld, id: string) {
  w.parts.forEach((p) => {
    if (p.markedBy === id) delete p.markedBy;
  });
  if (w.crane.owner === id) w.crane.owner = null;
  w.players = w.players.filter((p) => p.id !== id);
}

function finish(w: LoadWorld, won: boolean, reason: string) {
  w.phase = won ? 'won' : 'lost';
  w.crane.owner = null;
  for (const p of w.players) p.input = idleInput();
  emit(w, 'finish', reason);
}

/** Anything dropping fast enough knocks a worker off their feet. */
function crush(w: LoadWorld) {
  for (const p of w.players) {
    if (p.down) continue;
    for (const part of w.parts) {
      if (!alive(part) || !part.falling) continue;
      const speed = Math.hypot(part.vx, part.vy, part.vz);
      if (speed < 3.2) continue;
      if (
        Math.abs(p.x - part.x) < part.w / 2 + PLAYER_RADIUS &&
        Math.abs(p.z - part.z) < part.d / 2 + PLAYER_RADIUS &&
        partBottom(part) < p.y + PLAYER_HEIGHT &&
        partTop(part) > p.y
      ) {
        p.down = true;
        p.downUntil = w.clock + DOWN_MS;
        p.vx = p.vz = 0;
        p.input = idleInput();
        emit(w, 'down', `${p.name} is under the rubble. Press F to help.`);
        break;
      }
    }
  }
}

function breakPart(w: LoadWorld, part: Part, by: string, ball = false) {
  part.hits = 0;
  emit(
    w,
    'break',
    ball
      ? `The ball took out a ${PART_NAMES[part.kind].toLowerCase()}.`
      : `${by} broke a ${PART_NAMES[part.kind].toLowerCase()}.`,
  );
  const released = releaseUnsupported(w);
  if (released.length > 2)
    emit(w, 'collapse', `${released.length} pieces just lost their support.`);
}

/** Land one blow on a part, shared by the crew's hammers and the NPC crew. */
export function strike(w: LoadWorld, by: Wrecker, part: Part) {
  part.hits -= 1;
  by.hits += 1;
  if (part.hits <= 0) breakPart(w, part, by.name);
  else
    emit(w, 'hit', `${by.name} is working on a ${PART_NAMES[part.kind].toLowerCase()}.`);
}

export function syncNpcs(w: LoadWorld, slots: NpcSlot[]) {
  reconcileSiteNpcs(w, slots, newWrecker);
}

export function advanceSite(w: LoadWorld, now: number) {
  if (now <= w.clock) return;
  const elapsed = Math.min((now - w.clock) / 1000, 0.5);
  w.clock = now;
  if (w.phase !== 'playing') return;

  driveBots(w, strike);

  for (const p of w.players)
    if (p.down && w.clock >= p.downUntil) {
      p.down = false;
      emit(w, 'help', `${p.name} got back up.`);
    }

  const total = elapsed + w.remainder;
  const steps = Math.floor((total + 1e-9) / STEP);
  w.remainder = total - steps * STEP;
  if (steps) {
    if (!pianoSupport(w)) w.piano.resting = false;
    // Crew, debris and the ball all share one solver, so a falling slab
    // genuinely shoves a worker instead of passing through them.
    const collapse = new Collapse(w);
    for (let step = 0; step < steps; step++) {
      for (const p of w.players)
        collapse.controls(p, w.clock - p.seen > 750 ? idleInput() : p.input);
      collapse.step(1);
      for (const p of w.players) collapse.readPlayer(p);
    }
    const { damage, destroyed } = collapse.save();
    if (damage > 0) {
      w.piano.integrity = Math.max(0, w.piano.integrity - damage);
      if (w.piano.integrity > 0)
        emit(w, 'piano', `The piano took a hit. ${Math.round(w.piano.integrity)}% left.`);
    }
    for (const id of destroyed) {
      const part = w.parts.find((p) => p.id === id);
      if (part && alive(part)) breakPart(w, part, 'The ball', true);
    }
  }

  for (const p of w.players) {
    p.x = clamp(p.x, -YARD.x, YARD.x);
    p.z = clamp(p.z, -YARD.z, YARD.z);
  }
  for (const part of w.parts)
    if (alive(part) && !part.falling) part.strain = strainOf(w.parts, part);
  // Debris that has come to rest on the ground stops being a falling body.
  for (const part of w.parts)
    if (part.falling && partBottom(part) <= FLOOR + 0.12 && part.sleeping)
      part.falling = false;

  crush(w);
  releaseUnsupported(w);
  w.standing = standingParts(w).length;

  if (w.piano.integrity <= 0) {
    finish(w, false, 'The piano is kindling. The client is on the phone.');
    return;
  }
  if (w.standing === 0) {
    finish(w, true, 'House down, piano intact. Textbook.');
    return;
  }
  if (w.mode !== 'practice' && timeLeft(w) <= 0)
    finish(w, false, `Time. ${w.standing} pieces still standing.`);
}

export function siteAction(
  w: LoadWorld,
  id: string,
  action: LoadAction,
  host: string,
) {
  const p = w.players.find((p) => p.id === id);
  if (!p) throw new Error('Join the crew first.');
  if (action.type === 'start' || action.type === 'restart' || action.type === 'practice') {
    if (id !== host) throw new Error('Only the site foreman can start a job.');
    if (action.type === 'start' && w.phase !== 'lobby')
      throw new Error('This job has already started.');
    if (action.type === 'restart' && w.phase !== 'won' && w.phase !== 'lost')
      throw new Error('Finish this job before starting another.');
    const mode = action.type === 'practice' ? 'practice' : w.mode;
    const next = freshSite(w.clock, mode, w.seed + 1);
    next.phase = 'playing';
    next.started = w.clock;
    next.players = w.players.map((a) => {
      const fresh = newWrecker(a.id, a.name, a.color, w.clock);
      if (a.bot) fresh.bot = true;
      return fresh;
    });
    Object.assign(w, next);
    w.standing = standingParts(w).length;
    emit(
      w,
      'start',
      mode === 'practice'
        ? 'Practice run. No clock, same piano.'
        : 'Three minutes. Mind the piano.',
    );
    return;
  }
  if (w.phase !== 'playing') throw new Error('Start a job to swing at anything.');
  if (p.down && action.type !== 'wave')
    throw new Error('You are pinned. A teammate can free you with F.');

  if (action.type === 'swing') {
    if (w.clock - p.lastAction < SWING_MS)
      throw new Error('Let the hammer come back round.');
    p.lastAction = w.clock;
    p.swingUntil = w.clock + SWING_MS;
    const part = reachable(w, p, action.target);
    if (!part) throw new Error('Get closer to something worth hitting.');
    strike(w, p, part);
    return;
  }
  if (action.type === 'mark') {
    const part = reachable(w, p, action.target);
    if (!part) throw new Error('Stand next to the part you want to mark.');
    if (part.markedBy) delete part.markedBy;
    else {
      part.markedBy = p.id;
      emit(w, 'mark', `${p.name} marked a ${PART_NAMES[part.kind].toLowerCase()}.`);
    }
    return;
  }
  if (action.type === 'help') {
    const mate = w.players.find(
      (s) =>
        s.down &&
        s.id !== p.id &&
        Math.hypot(s.x - p.x, s.z - p.z) < HELP_REACH &&
        Math.abs(s.y - p.y) < 3,
    );
    if (!mate) throw new Error('Get closer to whoever is down.');
    mate.down = false;
    mate.downUntil = 0;
    emit(w, 'help', `${p.name} dug ${mate.name} out.`);
    return;
  }
  if (action.type === 'crane') {
    if (w.crane.owner === id) {
      w.crane.owner = null;
      emit(w, 'crane', `${p.name} parked the ball.`);
      return;
    }
    if (w.crane.owner) throw new Error('A teammate is on the crane.');
    w.crane.owner = id;
    emit(w, 'crane', `${p.name} has the wrecking ball. Clear out.`);
    return;
  }
  if (action.type === 'crane-move') {
    if (w.crane.owner !== id) throw new Error('Take the crane first.');
    const c = w.crane;
    c.x = clamp(c.x + clamp(action.x ?? 0, -1, 1), -HALF_W - 4, HALF_W + 4);
    c.z = clamp(c.z + clamp(action.z ?? 0, -1, 1), -HALF_D - 5, HALF_D + 5);
    c.y = clamp(c.y + clamp(action.y ?? 0, -1, 1), 3, 12);
    return;
  }
  if (action.type === 'crane-drop') {
    if (w.crane.owner !== id) throw new Error('Take the crane first.');
    w.crane.owner = null;
    emit(w, 'crane', 'Ball released.');
    return;
  }
  if (action.type === 'wave') {
    emit(w, 'help', `${p.name}: over here!`);
    return;
  }
  throw new Error('Unknown site action.');
}

function reachable(w: LoadWorld, p: Wrecker, target?: string) {
  const candidates = w.parts.filter(
    (part) =>
      alive(part) &&
      !part.falling &&
      Math.hypot(part.x - p.x, part.z - p.z) <
        SWING_REACH + Math.max(part.w, part.d) / 2 &&
      partBottom(part) < p.y + PLAYER_HEIGHT + 0.6 &&
      partTop(part) > p.y - 0.6,
  );
  if (target) return candidates.find((part) => part.id === target);
  return candidates.sort(
    (a, b) =>
      Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
  )[0];
}

export function siteSnapshot(
  world: LoadWorld,
  code: string,
  host: string,
  _id: string,
  version: number,
): LoadSnapshot {
  return { code, host, version, world };
}

export { ROUND_MS, timeLeft };
