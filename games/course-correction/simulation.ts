import { clamp } from '../../shared/math/clamp';
import { createCourse, STARTS } from './courses';
import { launchBall, stepPhysics } from './physics';
import {
  BALL_RADIUS,
  HOLE_MS,
  OPENING_MS,
  RESULT_MS,
  cleanShot,
  idleInput,
  type CoursePlayer,
  type CourseSnapshot,
  type CourseWorld,
} from './types';

const STEP = 1000 / 60;

function random(w: CourseWorld) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}

export function newPlayer(seat: number): CoursePlayer {
  return {
    id: `bot-${seat}`,
    name: ['Pip', 'Momo', 'Bean', 'Noodle'][seat],
    color: seat,
    seat,
    bot: true,
    seen: 0,
    input: idleInput(),
    aim: (seat - 1.5) * 0.055,
    power: 0.58,
    openingReady: false,
    botAt: 0,
    holeStrokes: 0,
    totalStrokes: 0,
    assists: 0,
    finishedAt: null,
  };
}

function balls(w: CourseWorld) {
  return w.players.map((player) => {
    const start = STARTS[player.seat];
    return {
      id: `ball-${player.seat}`,
      owner: player.id,
      x: start.x,
      z: start.z,
      vx: 0,
      vz: 0,
      radius: BALL_RADIUS,
      moving: false,
      holed: false,
      safe: { ...start },
      restFor: 1,
      lastTouch: null,
      lastTouchAt: 0,
    };
  });
}

export function freshWorld(now: number): CourseWorld {
  const world: CourseWorld = {
    clock: now,
    started: 0,
    phaseAt: now,
    remainder: 0,
    tick: 0,
    seed: (Math.floor(now) ^ 0xcc2026) >>> 0,
    phase: 'lobby',
    hole: 0,
    openingEnds: 0,
    holeEnds: 0,
    players: [0, 1, 2, 3].map(newPlayer),
    balls: [],
    course: createCourse(0),
    events: [],
    nextEvent: 0,
  };
  world.balls = balls(world);
  return world;
}

function beginHole(w: CourseWorld, hole: number) {
  w.hole = hole;
  w.course = createCourse(hole);
  w.phase = 'opening';
  w.phaseAt = w.clock;
  w.openingEnds = w.clock + OPENING_MS;
  w.holeEnds = w.clock + HOLE_MS;
  for (const player of w.players) {
    player.holeStrokes = 0;
    player.finishedAt = null;
    player.openingReady = player.bot;
    player.botAt = w.clock + 550 + player.seat * 170;
    player.aim = (player.seat - 1.5) * 0.055;
    player.power = 0.56 + player.seat * 0.025;
  }
  w.balls = balls(w);
}

function finishHole(w: CourseWorld) {
  if (w.phase === 'hole_result' || w.phase === 'match_over') return;
  const completed = w.players
    .filter((p) => p.finishedAt !== null)
    .map((p) => p.holeStrokes);
  const fallback =
    (completed.length
      ? Math.max(...completed)
      : Math.max(0, ...w.players.map((p) => p.holeStrokes))) + 2;
  for (const player of w.players) {
    if (player.finishedAt === null)
      player.holeStrokes = Math.max(player.holeStrokes, fallback);
    player.totalStrokes += player.holeStrokes;
  }
  w.phase = 'hole_result';
  w.phaseAt = w.clock;
  w.events.push({ id: ++w.nextEvent, kind: 'hole', at: w.clock, x: 0, z: 0 });
}

function bots(w: CourseWorld) {
  for (const player of w.players) {
    if (!player.bot || player.finishedAt !== null || w.clock < player.botAt)
      continue;
    const ball = w.balls.find((candidate) => candidate.owner === player.id);
    if (!ball || ball.holed || ball.moving) continue;
    const cupX = w.course.platform
      ? w.course.platform.baseX + w.course.platform.offset
      : w.course.cup.x;
    const cupZ = w.course.platform?.z ?? w.course.cup.z;
    const error = (random(w) - 0.5) * (0.08 + player.seat * 0.015);
    player.aim = Math.atan2(cupX - ball.x, cupZ - ball.z) + error;
    player.power = clamp(
      Math.hypot(cupX - ball.x, cupZ - ball.z) / 13 + 0.12,
      0.28,
      0.92,
    );
    if (w.phase === 'opening') player.openingReady = true;
    else if (w.phase === 'playing')
      launchBall(w, player.id, player.aim, player.power);
    player.botAt = w.clock + 900 + random(w) * 800;
  }
}

function launchOpening(w: CourseWorld) {
  for (const player of w.players)
    launchBall(w, player.id, player.aim, player.power);
  w.phase = 'playing';
  w.phaseAt = w.clock;
}

function step(w: CourseWorld, dt: number) {
  bots(w);
  if (w.phase === 'opening') {
    const humans = w.players.filter((p) => !p.bot);
    if (w.clock >= w.openingEnds || humans.every((p) => p.openingReady))
      launchOpening(w);
  }
  if (w.phase === 'playing') {
    stepPhysics(w, dt);
    if (w.balls.every((ball) => ball.holed) || w.clock >= w.holeEnds)
      finishHole(w);
  } else if (w.phase === 'hole_result' && w.clock - w.phaseAt >= RESULT_MS) {
    if (w.hole < 2) beginHole(w, w.hole + 1);
    else {
      w.phase = 'match_over';
      w.phaseAt = w.clock;
      w.events.push({
        id: ++w.nextEvent,
        kind: 'match',
        at: w.clock,
        x: 0,
        z: 0,
      });
    }
  }
}

export function advanceWorld(w: CourseWorld, now: number) {
  if (!Number.isFinite(now)) return;
  const delta = clamp(now - w.clock, 0, 100);
  w.remainder += delta;
  while (w.remainder + 0.00001 >= STEP) {
    w.remainder -= STEP;
    w.clock += STEP;
    w.tick++;
    step(w, STEP / 1000);
  }
}

export function setInput(
  w: CourseWorld,
  id: string,
  raw: Record<string, unknown>,
) {
  const player = w.players.find((candidate) => candidate.id === id);
  if (!player) return;
  const x =
    typeof raw.x === 'number' && Number.isFinite(raw.x)
      ? clamp(raw.x, -1, 1)
      : 0;
  const z =
    typeof raw.z === 'number' && Number.isFinite(raw.z)
      ? clamp(raw.z, -1, 1)
      : 0;
  player.input = { x, z };
  if (!player.openingReady) {
    if (typeof raw.angle === 'number' && Number.isFinite(raw.angle))
      player.aim = clamp(raw.angle, -Math.PI, Math.PI);
    else player.aim = clamp(player.aim + x * 0.035, -Math.PI, Math.PI);
    if (typeof raw.power === 'number' && Number.isFinite(raw.power))
      player.power = clamp(raw.power, 0.12, 1);
  }
}

export function courseAction(
  w: CourseWorld,
  id: string,
  action: Record<string, unknown>,
  host: boolean,
) {
  const player = w.players.find((candidate) => candidate.id === id);
  if (!player) throw new Error('Player not found.');
  switch (action.type) {
    case 'start':
    case 'ready':
      if (!host) throw new Error('Only the host can start the match.');
      if (w.phase !== 'lobby' && w.phase !== 'match_over') return;
      for (const candidate of w.players) {
        candidate.totalStrokes = 0;
        candidate.assists = 0;
      }
      w.started = w.clock;
      beginHole(w, 0);
      return;
    case 'aim': {
      const shot = cleanShot(action.angle, action.power);
      if (!shot || !['opening', 'playing'].includes(w.phase)) return;
      player.aim = shot.angle;
      player.power = shot.power;
      return;
    }
    case 'shoot': {
      const shot = cleanShot(action.angle, action.power);
      if (!shot || w.phase !== 'playing') return;
      launchBall(w, id, shot.angle, shot.power);
      return;
    }
    case 'lock': {
      const shot = cleanShot(action.angle, action.power);
      if (!shot || w.phase !== 'opening') return;
      player.aim = shot.angle;
      player.power = shot.power;
      player.openingReady = true;
      return;
    }
    case 'restart':
      if (!host) throw new Error('Only the host can restart the match.');
      if (w.phase !== 'match_over') return;
      for (const candidate of w.players) {
        candidate.totalStrokes = 0;
        candidate.assists = 0;
      }
      beginHole(w, 0);
      return;
    default:
      throw new Error('Unknown action.');
  }
}

export function replaceOwner(w: CourseWorld, previous: string, next: string) {
  const ball = w.balls.find((candidate) => candidate.owner === previous);
  if (ball) {
    ball.owner = next;
    if (ball.lastTouch === previous) ball.lastTouch = next;
  }
}

export function snapshot(
  w: CourseWorld,
  code: string,
  host: string,
  selfId: string,
  version: number,
): CourseSnapshot {
  return { code, host, selfId, version, world: structuredClone(w) };
}
