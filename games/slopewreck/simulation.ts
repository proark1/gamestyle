import { clamp } from '../../shared/math/clamp';
import {
  FINISH_Z,
  HALF_WIDTH,
  KICKERS,
  RACE_MS,
  cleanInput,
  idleInput,
  type RaceEvent,
  type Rider,
  type Snapshot,
  type Trick,
  type World,
} from './types';

const BOT_NAMES = ['Pip', 'Mika', 'Jo', 'Nora'];
const LANES = [-5.1, -1.7, 1.7, 5.1];

export function newRider(seat: number): Rider {
  return {
    id: `bot-${seat}`,
    name: BOT_NAMES[seat],
    color: seat,
    seat,
    bot: true,
    x: LANES[seat],
    z: 0,
    speed: 8,
    height: 0,
    vy: 0,
    grounded: true,
    airStarted: 0,
    spin: 0,
    trick: null,
    trickStarted: 0,
    lastJump: 0,
    lastKicker: -1,
    wipeoutUntil: 0,
    finishAt: 0,
    style: 0,
    cleanLandings: 0,
    wipeouts: 0,
    featuresMade: 0,
    input: idleInput(),
    seen: 0,
  };
}

export function freshWorld(now: number): World {
  return {
    clock: now,
    started: 0,
    tick: 0,
    phase: 'lobby',
    players: [0, 1, 2, 3].map(newRider),
    features: [],
    events: [],
    nextFeature: 0,
    nextEvent: 0,
    winner: null,
  };
}

function emit(w: World, kind: RaceEvent['kind'], p: Rider) {
  w.events.push({ id: ++w.nextEvent, kind, rider: p.id, x: p.x, z: p.z });
  if (w.events.length > 24) w.events.splice(0, w.events.length - 24);
}

function resetRace(w: World) {
  w.started = w.clock;
  w.phase = 'racing';
  w.features = [];
  w.events = [];
  w.winner = null;
  w.players.forEach((p, seat) => {
    const fresh = newRider(seat);
    Object.assign(p, {
      ...fresh,
      id: p.id,
      name: p.name,
      color: p.color,
      bot: p.bot,
    });
  });
}

export function jump(w: World, p: Rider, kicker = false) {
  if (
    w.phase !== 'racing' ||
    !p.grounded ||
    p.finishAt ||
    w.clock < p.wipeoutUntil ||
    w.clock < p.lastJump + 350
  )
    return;
  p.grounded = false;
  p.vy = kicker ? 9.3 : 8;
  p.height = 0.04;
  p.airStarted = w.clock;
  p.lastJump = w.clock;
  p.spin = 0;
  p.trick = null;
  emit(w, 'jump', p);
}

export function chooseTrick(w: World, p: Rider, kind: Trick) {
  if (
    w.phase !== 'racing' ||
    p.grounded ||
    p.finishAt ||
    p.trick ||
    w.clock < p.wipeoutUntil
  )
    return;
  p.trick = kind;
  p.trickStarted = w.clock;
  emit(w, 'trick', p);
}

export function raceAction(
  w: World,
  id: string,
  action: Record<string, unknown>,
  isHost: boolean,
) {
  const p = w.players.find((q) => q.id === id);
  if (!p) return;
  if (['start', 'ready', 'reset'].includes(String(action.type))) {
    if (!isHost) throw new Error('The host starts the race.');
    if (w.partyRoundStarted && action.type === 'reset') return;
    if (w.phase === 'racing') return;
    resetRace(w);
  } else if (action.type === 'jump') jump(w, p);
  else if (action.type === 'trick_ramp') chooseTrick(w, p, 'ramp');
  else if (action.type === 'trick_rail') chooseTrick(w, p, 'rail');
}

export function setInput(w: World, id: string, raw: Record<string, unknown>) {
  const p = w.players.find((q) => q.id === id);
  if (p) {
    p.input = cleanInput(raw);
    p.seen = w.clock;
  }
}

function wipeout(w: World, p: Rider) {
  p.wipeouts++;
  p.wipeoutUntil = w.clock + 1050;
  p.speed = Math.max(4.5, p.speed * 0.53);
  p.spin = 0;
  emit(w, 'wipeout', p);
}

function land(w: World, p: Rider) {
  const airtime = w.clock - p.airStarted;
  const clean = !p.trick || (airtime >= 540 && p.spin >= 300);
  p.height = 0;
  p.vy = 0;
  p.grounded = true;
  if (p.trick) {
    const kind = p.trick;
    w.features.push({
      id: ++w.nextFeature,
      owner: p.id,
      kind,
      x: p.x,
      z: Math.max(0, p.z - 2.5),
      wild: !clean,
      born: w.clock,
    });
    if (w.features.length > 28) w.features.shift();
    p.featuresMade++;
    emit(w, 'feature', p);
    if (clean) {
      p.cleanLandings++;
      p.style += kind === 'rail' ? 150 : 100;
      p.speed = Math.min(17, p.speed + 0.8);
      emit(w, 'land', p);
    } else wipeout(w, p);
  } else emit(w, 'land', p);
  p.spin = 0;
  p.trick = null;
}

function hitFeature(w: World, p: Rider, previousZ: number) {
  if (!p.grounded || w.clock < p.wipeoutUntil) return;
  for (const f of w.features) {
    if (
      f.owner === p.id ||
      previousZ > f.z ||
      p.z < f.z ||
      Math.abs(p.x - f.x) > 1.8
    )
      continue;
    if (f.kind === 'ramp') {
      jump(w, p, true);
      p.speed = Math.min(18, p.speed + (f.wild ? 2.8 : 1.5));
    } else if (Math.abs(p.x - f.x) < (f.wild ? 0.65 : 1.1)) {
      p.speed = Math.min(19, p.speed + (f.wild ? 4 : 2.6));
      p.style += 30;
    } else wipeout(w, p);
    emit(w, 'boost', p);
    break;
  }
}

function botInput(w: World, p: Rider) {
  const upcoming = w.features.find(
    (f) => f.owner !== p.id && f.z > p.z + 2 && f.z < p.z + 22,
  );
  const target =
    upcoming?.x ?? LANES[p.seat] + Math.sin(p.z * 0.028 + p.seat * 1.6) * 2;
  p.input = {
    x: 0,
    z: 0,
    steer: clamp((target - p.x) * 0.45, -1, 1),
    tuck: p.seat === 3 || Math.sin(p.z * 0.045 + p.seat) > 0.3,
    brake: false,
  };
  if (!p.grounded && !p.trick && w.clock - p.airStarted > 80)
    chooseTrick(w, p, p.seat % 2 ? 'rail' : 'ramp');
  if (
    p.grounded &&
    p.z > 18 &&
    Math.floor(p.z / 75) > Math.floor((p.z - p.speed / 60) / 75)
  )
    jump(w, p);
}

function move(w: World, p: Rider, dt: number) {
  if (p.finishAt) return;
  if (p.bot) botInput(w, p);
  if (w.clock < p.wipeoutUntil) {
    p.speed = Math.max(4, p.speed - 6 * dt);
    p.x += Math.sin(w.clock * 0.013 + p.seat) * dt * 1.3;
  } else {
    const desired = p.input.brake ? 5 : p.input.tuck ? 16 : 12.3;
    p.speed +=
      (desired - p.speed) * Math.min(1, dt * (p.input.brake ? 2.4 : 0.52));
    p.x = clamp(
      p.x + p.input.steer * (p.grounded ? 7.5 : 4.5) * dt,
      -HALF_WIDTH - 0.7,
      HALF_WIDTH + 0.7,
    );
  }
  const previousZ = p.z;
  p.z = Math.min(FINISH_Z, p.z + p.speed * dt);
  if (Math.abs(p.x) > HALF_WIDTH) {
    p.x = clamp(p.x, -HALF_WIDTH, HALF_WIDTH);
    if (w.clock >= p.wipeoutUntil) wipeout(w, p);
  }
  if (p.grounded) {
    for (let i = 0; i < KICKERS.length; i++) {
      const z = KICKERS[i];
      if (previousZ <= z && p.z >= z && p.lastKicker !== i) {
        p.lastKicker = i;
        jump(w, p, true);
        break;
      }
    }
    hitFeature(w, p, previousZ);
  } else {
    p.height += p.vy * dt;
    p.vy -= 15 * dt;
    if (p.trick) p.spin = Math.min(360, p.spin + 600 * dt);
    if (p.height <= 0) land(w, p);
  }
  if (p.z >= FINISH_Z && !p.finishAt) {
    p.finishAt = w.clock;
    emit(w, 'finish', p);
  }
}

function endRace(w: World) {
  w.phase = 'ended';
  const ordered = [...w.players].sort((a, b) =>
    a.finishAt && b.finishAt
      ? a.finishAt - b.finishAt
      : a.finishAt
        ? -1
        : b.finishAt
          ? 1
          : b.z - a.z,
  );
  w.winner = ordered[0]?.id ?? null;
}

export function advanceWorld(w: World, now: number) {
  if (!Number.isFinite(now) || now <= w.clock) return;
  const end = w.clock + Math.min(250, now - w.clock);
  while (w.clock < end - 0.001) {
    const dt = Math.min(1 / 90, (end - w.clock) / 1000);
    w.clock += dt * 1000;
    w.tick++;
    if (w.phase !== 'racing') continue;
    if (w.clock - w.started >= RACE_MS) {
      endRace(w);
      continue;
    }
    for (const p of w.players) move(w, p, dt);
    if (w.players.every((p) => p.finishAt)) endRace(w);
    w.features = w.features.filter((f) => w.clock - f.born < 42_000);
  }
}

export function snapshot(
  w: World,
  code: string,
  host: string,
  selfId: string,
  version: number,
): Snapshot {
  return { code, host, selfId, version, world: structuredClone(w) };
}
