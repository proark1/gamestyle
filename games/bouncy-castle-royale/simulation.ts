import { clamp } from '../../shared/math/clamp';
import {
  ALLOCATION,
  COURT,
  MATCH_MS,
  PRESETS,
  TARGET,
  TEAMS,
  cleanInput,
  idleInput,
  opposite,
  side,
  teamAt,
  type Air,
  type Ball,
  type CastleEvent,
  type Player,
  type Preset,
  type Snapshot,
  type Team,
  type World,
} from './types';

const emptyBall = (): Ball => ({
  x: 0,
  y: 4,
  z: 5,
  vx: 0,
  vy: 0,
  vz: 0,
  last: null,
  team: null,
  touches: 0,
  hitAt: 0,
});
const freshAir = (): Air => ({
  preset: 'floor',
  pressure: 1,
  ...ALLOCATION.floor,
  changed: 0,
});
export const pumpPosition = (team: Team) => ({
  x: side(team) * 4.9,
  z: side(team) * 5.8,
});
export const nearPump = (p: Player) =>
  Math.hypot(p.x - pumpPosition(p.team).x, p.z - pumpPosition(p.team).z) <
    1.5 && p.grounded;
export const wallHeight = (w: World, team: Team) =>
  0.45 + w.air[team].walls * w.air[team].pressure * 4;
export const bouncePower = (w: World, team: Team) =>
  5.8 + w.air[team].floor * w.air[team].pressure * 6;

export function newPlayer(seat: number): Player {
  const team = seat % 2 === 0 ? 'red' : 'blue';
  return {
    id: `bot-${seat}`,
    name: ['Pip', 'Mika', 'Jo', 'Nora'][seat],
    color: seat,
    team,
    seat,
    bot: true,
    x: seat < 2 ? -2.2 : 2.2,
    z: side(team) * 4,
    y: COURT.floor,
    vx: 0,
    vy: 0,
    vz: 0,
    seen: 0,
    input: idleInput(),
    grounded: true,
    swingUntil: 0,
    hitAfter: 0,
    jumpAfter: 0,
    waveAfter: 0,
    pumpAt: 0,
    hits: 0,
    jumps: 0,
    pumped: 0,
  };
}
export function freshWorld(now: number): World {
  return {
    clock: now,
    started: 0,
    tick: 0,
    phase: 'lobby',
    players: [0, 1, 2, 3].map(newPlayer),
    ball: emptyBall(),
    air: { red: freshAir(), blue: freshAir() },
    scores: { red: 0, blue: 0 },
    serving: 'red',
    until: now,
    winner: null,
    message: 'ready',
    waves: [],
    events: [],
    nextEvent: 0,
    nextWave: 0,
    rally: 0,
    bestRally: 0,
  };
}
export function emit(
  w: World,
  kind: CastleEvent['kind'],
  x = 0,
  z = 0,
  strength = 1,
) {
  w.events.push({ id: ++w.nextEvent, kind, x, z, strength });
  if (w.events.length > 24) w.events.splice(0, w.events.length - 24);
}
function positions(w: World) {
  for (const p of w.players) {
    p.x = p.seat < 2 ? -2.2 : 2.2;
    p.z = side(p.team) * 4;
    p.y = COURT.floor;
    p.vx = p.vy = p.vz = 0;
    p.grounded = true;
    p.swingUntil = 0;
    p.input = idleInput();
  }
  w.waves = [];
}
export function prepareServe(w: World, team: Team) {
  w.phase = 'serve';
  w.serving = team;
  w.until = w.clock + 1800;
  w.rally = 0;
  positions(w);
  w.ball = { ...emptyBall(), z: side(team) * 5.5, y: 3.4 };
}
function finish(w: World) {
  w.phase = 'ended';
  w.winner =
    w.scores.red === w.scores.blue
      ? 'draw'
      : w.scores.red > w.scores.blue
        ? 'red'
        : 'blue';
  w.until = w.clock;
  emit(w, 'win');
  for (const p of w.players) p.input = idleInput();
}
export function scorePoint(w: World, team: Team, reason: string) {
  if (w.phase !== 'playing') return;
  w.scores[team]++;
  w.message = reason;
  w.serving = team;
  w.phase = 'point';
  w.until = w.clock + 1400;
  emit(w, 'point', w.ball.x, w.ball.z);
  if (w.scores[team] >= TARGET || w.clock - w.started >= MATCH_MS) finish(w);
}
export function jump(w: World, p: Player) {
  if (!p.grounded || w.clock < p.jumpAfter || w.phase !== 'playing') return;
  p.vy = bouncePower(w, teamAt(p.z));
  p.grounded = false;
  p.jumpAfter = w.clock + 350;
  p.jumps++;
  emit(w, 'bounce', p.x, p.z, 0.5);
}
export function slap(w: World, p: Player) {
  if (w.phase !== 'playing' || w.clock < p.hitAfter) return;
  p.swingUntil = w.clock + 260;
  p.hitAfter = w.clock + 460;
}
export function castleAction(
  w: World,
  id: string,
  action: Record<string, unknown>,
  isHost: boolean,
) {
  const p = w.players.find((q) => q.id === id);
  if (!p) return;
  if (['start', 'ready', 'reset'].includes(String(action.type))) {
    if (!isHost) throw new Error('The host starts the match.');
    if (w.partyRoundStarted && action.type === 'reset') return;
    if (action.type !== 'reset' && !['lobby', 'ended'].includes(w.phase))
      return;
    w.scores = { red: 0, blue: 0 };
    w.air = { red: freshAir(), blue: freshAir() };
    w.started = w.clock;
    w.winner = null;
    w.bestRally = 0;
    w.message = 'ready';
    for (const q of w.players) q.hits = q.jumps = q.pumped = 0;
    prepareServe(w, 'red');
  } else if (action.type === 'jump') jump(w, p);
  else if (action.type === 'slap') slap(w, p);
  else if (action.type === 'air') {
    if (w.phase === 'ended') return;
    const air = w.air[p.team];
    if (w.clock < air.changed + 350) return;
    const preset = action.preset;
    if (preset !== undefined && !PRESETS.includes(preset as Preset))
      throw new Error('Unknown air setting.');
    air.preset =
      preset === undefined
        ? PRESETS[(PRESETS.indexOf(air.preset) + 1) % PRESETS.length]
        : (preset as Preset);
    air.changed = w.clock;
    emit(w, 'air', p.x, p.z, 0.5);
  } else if (action.type === 'switch_team') {
    if (!['lobby', 'ended'].includes(w.phase) || w.partyRoundStarted) return;
    const other = w.players.find((q) => q.team !== p.team && q.bot);
    if (!other) throw new Error('The other team is full.');
    [p.team, other.team] = [other.team, p.team];
    [p.seat, other.seat] = [other.seat, p.seat];
    positions(w);
  }
}

export function landingWave(w: World, p: Player, speed: number) {
  if (speed < 4 || w.clock < p.waveAfter) return;
  const power =
    clamp(speed / 12, 0.25, 1) *
    (0.3 + w.air[teamAt(p.z)].floor * w.air[teamAt(p.z)].pressure);
  w.waves.push({
    id: ++w.nextWave,
    x: p.x,
    z: p.z,
    power,
    born: w.clock,
    source: p.id,
    caught: [],
  });
  if (w.waves.length > 12) w.waves.shift();
  p.waveAfter = w.clock + 1100;
  emit(w, 'wave', p.x, p.z, power);
}

function bots(w: World) {
  const b = w.ball;
  for (const p of w.players) {
    if (!p.bot) continue;
    const own = side(p.team),
      mates = w.players.filter((q) => q.team === p.team);
    const incoming = teamAt(b.z) === p.team || b.vz * own > 0;
    const fall = clamp(
      (b.vy +
        Math.sqrt(Math.max(0, b.vy * b.vy + 24 * Math.max(0, b.y - 1.7)))) /
        12,
      0.05,
      1.6,
    );
    const tx = clamp(b.x + b.vx * fall * 0.65, -5.2, 5.2);
    const tz = own * clamp((b.z + b.vz * fall * 0.65) * own, 1, 7);
    const receiver = [...mates].sort(
      (a, c) =>
        Math.hypot(a.x - tx, a.z - tz) +
        (a.id === b.last ? 6 : 0) -
        (Math.hypot(c.x - tx, c.z - tz) + (c.id === b.last ? 6 : 0)),
    )[0];
    const pumping =
      w.air[p.team].pressure < 0.72 && (receiver !== p || !incoming);
    const target = pumping
      ? pumpPosition(p.team)
      : incoming && receiver === p
        ? { x: tx, z: tz }
        : { x: p.seat < 2 ? -2.8 : 2.8, z: own * 4.8 };
    const dx = target.x - p.x,
      dz = target.z - p.z,
      distance = Math.hypot(dx, dz);
    p.input = {
      x: distance > 0.25 ? dx / Math.max(1, distance) : 0,
      z: distance > 0.25 ? dz / Math.max(1, distance) : 0,
      brace: pumping,
      pump: pumping,
    };
    if (
      receiver === p &&
      incoming &&
      p.id !== b.last &&
      Math.hypot(b.x - p.x, b.z - p.z) < 2
    ) {
      if (b.y > p.y + 2.1 && b.y < p.y + 4.7 && b.vy < 2) jump(w, p);
      if (b.y >= p.y + 0.15 && b.y < p.y + 2.9) slap(w, p);
    }
  }
}

function movePlayers(w: World, dt: number) {
  for (const p of w.players) {
    const input = p.input,
      speed = input.brace ? 2.5 : 5.5;
    const friction = 1 - Math.exp(-dt * (p.grounded ? 12 : 3));
    p.vx += (input.x * speed - p.vx) * friction;
    p.vz += (input.z * speed - p.vz) * friction;
    const oldZ = p.z;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    if (Math.abs(p.z) < 0.65 && p.y < COURT.floor + COURT.net) {
      p.z = Math.sign(oldZ || side(p.team)) * 0.65;
      p.vz *= -0.25;
    }
    if (!p.grounded) {
      p.vy -= 16 * dt;
      p.y += p.vy * dt;
      if (p.y <= COURT.floor) {
        const impact = -p.vy;
        p.y = COURT.floor;
        p.vy = 0;
        p.grounded = true;
        if (!input.brace) landingWave(w, p, impact);
      }
    }
    const air = w.air[teamAt(p.z)];
    if (Math.abs(p.x) > COURT.x - 0.4) {
      const dir = Math.sign(p.x);
      p.x = dir * (COURT.x - 0.4);
      p.vx = -dir * (2 + air.bumpers * air.pressure * 9);
      if (!input.brace && p.grounded && air.preset === 'bumpers') {
        p.vy = 5;
        p.grounded = false;
      }
    }
    if (Math.abs(p.z) > COURT.z - 0.4) {
      p.z = Math.sign(p.z) * (COURT.z - 0.4);
      p.vz *= -0.55;
    }
    if (input.pump && nearPump(p)) {
      w.air[p.team].pressure = Math.min(1, w.air[p.team].pressure + dt * 0.32);
      p.pumped += dt;
      if (w.clock - p.pumpAt > 480) {
        p.pumpAt = w.clock;
        emit(w, 'pump', p.x, p.z, 0.5);
      }
    }
  }
  for (const wave of w.waves) {
    const radius = ((w.clock - wave.born) / 1000) * 8;
    for (const p of w.players) {
      const dist = Math.hypot(p.x - wave.x, p.z - wave.z);
      if (
        p.id === wave.source ||
        wave.caught.includes(p.id) ||
        dist > 7 ||
        Math.abs(dist - radius) > 0.5
      )
        continue;
      wave.caught.push(p.id);
      if (!p.grounded) continue;
      const power = wave.power * Math.max(0.25, 1 - dist / 9);
      const damping = p.input.brace ? 0.16 : 1;
      p.vy = (5 + power * 5) * damping;
      p.vx += ((p.x - wave.x) / Math.max(0.4, dist)) * power * 5 * damping;
      p.vz += ((p.z - wave.z) / Math.max(0.4, dist)) * power * 5 * damping;
      p.grounded = false;
    }
  }
  w.waves = w.waves.filter((wave) => w.clock - wave.born < 1000);
}

function hitBall(w: World) {
  const b = w.ball;
  if (w.clock - b.hitAt < 180) return;
  for (const p of w.players) {
    if (
      p.swingUntil <= w.clock ||
      Math.hypot(b.x - p.x, b.z - p.z) > 1.95 ||
      b.y < p.y + 0.1 ||
      b.y > p.y + 2.95
    )
      continue;
    p.swingUntil = 0;
    if (b.last === p.id) {
      scorePoint(w, opposite(p.team), 'double');
      return;
    }
    b.touches = b.team === p.team ? b.touches + 1 : 1;
    b.team = p.team;
    if (b.touches > 3) {
      scorePoint(w, opposite(p.team), 'four');
      return;
    }
    const attacking = !p.grounded && b.y > 3.4;
    const aimX = clamp(b.x + p.input.x * 4.5, -4.7, 4.7);
    const aimZ = -side(p.team) * (attacking ? 5.6 : 4.5);
    const travel = attacking ? 1.05 : 1.4;
    b.vx = (aimX - b.x) / travel;
    b.vz = (aimZ - b.z) / travel;
    // Aim to pass above the net, even for contacts made close to it.
    const netTime = Math.max(0.08, Math.abs(b.z / (b.vz || 1)));
    const clearance =
      (COURT.floor +
        COURT.net +
        COURT.radius +
        0.25 -
        b.y +
        6 * netTime * netTime) /
      netTime;
    b.vy = clamp(Math.max(attacking ? 1.5 : 7.4, clearance), 0, 11);
    b.last = p.id;
    b.hitAt = w.clock;
    p.hits++;
    w.rally++;
    w.bestRally = Math.max(w.bestRally, w.rally);
    emit(w, attacking ? 'smash' : 'slap', p.x, p.z);
    break;
  }
}

function moveBall(w: World, dt: number) {
  const b = w.ball,
    beforeZ = b.z;
  b.vy -= 12 * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  const ballSide = teamAt(b.z);
  if (
    (beforeZ * b.z <= 0 || Math.abs(b.z) < COURT.radius) &&
    b.y - COURT.radius < COURT.floor + COURT.net
  ) {
    b.z = (Math.sign(beforeZ) || side(w.serving)) * (COURT.radius + 0.08);
    b.vz *= -0.65;
    emit(w, 'net', b.x, 0, 0.6);
  }
  const height = COURT.floor + wallHeight(w, ballSide);
  const air = w.air[ballSide];
  if (
    Math.abs(b.x) >= COURT.x - COURT.radius &&
    Math.abs(b.x) < COURT.x + 0.2 &&
    b.y - COURT.radius < height
  ) {
    b.x = Math.sign(b.x) * (COURT.x - COURT.radius);
    b.vx =
      -Math.sign(b.x) *
      Math.max(2.2, Math.abs(b.vx) * (0.55 + air.bumpers * air.pressure));
    b.vy = Math.max(b.vy, air.bumpers * air.pressure * 5);
    emit(w, 'wall', b.x, b.z, 0.6);
  }
  if (
    Math.abs(b.z) >= COURT.z - COURT.radius &&
    Math.abs(b.z) < COURT.z + 0.2 &&
    b.y - COURT.radius < height
  ) {
    b.z = Math.sign(b.z) * (COURT.z - COURT.radius);
    b.vz = -Math.sign(b.z) * Math.max(2, Math.abs(b.vz) * 0.65);
    emit(w, 'wall', b.x, b.z, 0.6);
  }
  if (Math.abs(b.x) > COURT.x + 0.7 || Math.abs(b.z) > COURT.z + 0.7) {
    scorePoint(w, opposite(b.team ?? w.serving), 'out');
    return;
  }
  hitBall(w);
  if (w.phase === 'playing' && b.y <= COURT.floor + COURT.radius) {
    b.y = COURT.floor + COURT.radius;
    scorePoint(w, opposite(teamAt(b.z)), 'floor');
  }
}

export function advanceWorld(w: World, now: number) {
  if (!Number.isFinite(now) || now <= w.clock) return;
  const end = w.clock + Math.min(250, now - w.clock);
  while (w.clock < end - 0.001) {
    const dt = Math.min(1 / 120, (end - w.clock) / 1000);
    w.clock += dt * 1000;
    w.tick++;
    if (w.phase === 'lobby' || w.phase === 'ended') continue;
    if (w.clock - w.started >= MATCH_MS) {
      finish(w);
      continue;
    }
    if (w.phase === 'point') {
      if (w.clock >= w.until) prepareServe(w, w.serving);
      continue;
    }
    if (w.phase === 'serve') {
      if (w.clock >= w.until) {
        w.phase = 'playing';
        w.ball.vz = -side(w.serving) * 5.4;
        w.ball.vy = 6.8;
        w.ball.team = w.serving;
        emit(w, 'slap', w.ball.x, w.ball.z, 0.7);
      }
      continue;
    }
    for (const team of TEAMS) {
      const air = w.air[team],
        target = ALLOCATION[air.preset],
        smooth = 1 - Math.exp(-dt * 3);
      for (const part of PRESETS)
        air[part] += (target[part] - air[part]) * smooth;
      air.pressure = Math.max(0.3, air.pressure - dt * 0.025);
    }
    bots(w);
    movePlayers(w, dt);
    moveBall(w, dt);
  }
}
export function setInput(w: World, id: string, raw: Record<string, unknown>) {
  const p = w.players.find((q) => q.id === id);
  if (p) {
    p.input = cleanInput(raw);
    p.seen = w.clock;
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
