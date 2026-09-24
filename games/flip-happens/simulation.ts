import { clamp } from '../../shared/math/clamp';
import {
  CHARGE_MS,
  DAILY_MS,
  MATCH_MS,
  OBJECTS,
  TABLE,
  charge,
  cleanInput,
  idleInput,
  type EventKind,
  type Player,
  type Prop,
  type Snapshot,
  type World,
} from './types';

const GRAVITY = 12;
const STEP = 1000 / 120;
const TAU = Math.PI * 2;
export function daySeed(day: string) {
  let seed = 2166136261;
  for (const ch of day) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  return seed >>> 0;
}
function random(w: World) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}
export function newPlayer(seat: number): Player {
  return {
    id: `bot-${seat}`,
    name: ['Pip', 'Momo', 'Bean', 'Noodle'][seat],
    color: seat,
    seat,
    bot: true,
    seen: 0,
    input: idleInput(),
    x: seat % 2 ? 3.1 : -3.1,
    z: seat < 2 ? 4.3 : -4.3,
    aimX: seat % 2 ? 1.7 : -1.7,
    aimZ: seat < 2 ? 1 : -1,
    selected: 0,
    score: 0,
    pending: 0,
    combo: 0,
    chain: 0,
    bestCombo: 0,
    chargingAt: null,
    readyAt: 0,
    botAt: 0,
    botCharge: 0.6,
    throws: 0,
    lands: 0,
    banks: 0,
    busts: 0,
    last: '',
    lastAt: 0,
  };
}
export function freshWorld(now: number): World {
  const day = new Date(now).toISOString().slice(0, 10),
    seed = daySeed(day);
  return {
    clock: now,
    started: 0,
    remainder: 0,
    tick: 0,
    phase: 'lobby',
    mode: 'versus',
    day,
    seed,
    initialSeed: seed,
    duration: MATCH_MS,
    nextNudge: 0,
    players: [0, 1, 2, 3].map(newPlayer),
    props: [],
    events: [],
    nextProp: 0,
    nextEvent: 0,
    table: { x: 0, z: 0, vx: 0, vz: 0 },
    winner: null,
  };
}
export function tableHeight(w: World, x: number, z: number) {
  return TABLE.y + Math.sin(w.table.z) * x - Math.sin(w.table.x) * z;
}
function event(w: World, kind: EventKind, x = 0, z = 0, strength = 0.7) {
  w.events.push({ id: ++w.nextEvent, kind, x, z, strength, born: w.clock });
  if (w.events.length > 32) w.events.shift();
}
function notice(w: World, p: Player, kind: Player['last']) {
  p.last = kind;
  p.lastAt = w.clock;
}
export const airborne = (w: World, p: Player) =>
  w.props.some((o) => o.owner === p.id && o.state === 'air' && !o.scored);
export const canBank = (w: World, p: Player) =>
  w.phase === 'playing' &&
  p.pending > 0 &&
  !w.props.some(
    (o) =>
      o.owner === p.id && o.chain === p.chain && !o.banked && o.state === 'air',
  );
function retireChain(w: World, p: Player) {
  for (const o of w.props)
    if (o.owner === p.id && o.chain === p.chain) o.banked = true;
  p.chain++;
  p.pending = 0;
  p.combo = 0;
}
export function bank(w: World, p: Player) {
  if (!canBank(w, p)) return false;
  p.score += p.pending;
  p.banks++;
  retireChain(w, p);
  notice(w, p, 'bank');
  event(w, 'bank', p.x, p.z);
  return true;
}
function bust(w: World, o: Prop) {
  if (o.banked) return;
  const p = w.players.find((q) => q.id === o.owner);
  if (p && p.chain === o.chain) {
    p.busts++;
    retireChain(w, p);
    notice(w, p, 'bust');
    event(w, 'bust', o.x, o.z);
  }
}
function impact(w: World, o: Prop) {
  const mass = OBJECTS[o.object].mass;
  w.table.vx = clamp(w.table.vx + o.z * mass * 0.035, -1, 1);
  w.table.vz = clamp(w.table.vz - o.x * mass * 0.026, -1, 1);
  if (mass < 2) return;
  event(w, 'impact', o.x, o.z, Math.min(1, mass / 7));
  for (const other of w.props) {
    if (other.id === o.id || other.state !== 'landed') continue;
    const dx = other.x - o.x,
      dz = other.z - o.z,
      distance = Math.hypot(dx, dz);
    const kick = Math.max(0, 1 - distance / (1.6 + mass * 0.24)) * mass;
    if (kick < 0.65) continue;
    const scale = 1 / Math.sqrt(OBJECTS[other.object].mass);
    other.state = 'air';
    other.vy = (1.2 + kick * 0.5) * scale;
    other.vx += (dx / (distance || 1)) * kick * 0.8 * scale;
    other.vz += (dz / (distance || 1)) * kick * 0.8 * scale;
    other.spin = kick * 2 * scale;
  }
}
export function launch(w: World, p: Player, power: number) {
  if (w.phase !== 'playing' || airborne(w, p) || w.clock < p.readyAt)
    return false;
  const item = OBJECTS[p.selected];
  const vy = 5.6 + clamp(power, 0, 1) * 2;
  const y = TABLE.y + item.height / 2 + 0.35;
  const flight = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * 0.35)) / GRAVITY;
  const o: Prop = {
    id: ++w.nextProp,
    owner: p.id,
    chain: p.chain,
    object: p.selected,
    born: w.clock,
    x: p.x,
    y,
    z: p.z * 0.84,
    vx: (p.aimX - p.x) / flight,
    vy,
    vz: (p.aimZ - p.z * 0.84) / flight,
    angle: 0,
    spin: (TAU / flight) * (1 + (power - item.ideal) * 1.3),
    state: 'air',
    scored: false,
    banked: false,
  };
  // Keep active throws and the newest landed props. Expiration never costs points.
  if (w.props.length >= 32) {
    const oldest = w.props.findIndex((q) => q.state !== 'air');
    if (oldest >= 0) w.props.splice(oldest, 1);
    else return false;
  }
  w.props.push(o);
  p.throws++;
  p.readyAt = w.clock + 750;
  p.chargingAt = null;
  notice(w, p, 'throw');
  event(w, 'throw', p.x, p.z);
  return true;
}
function resetRound(w: World) {
  const now = w.clock;
  w.started = now;
  w.phase = 'playing';
  w.winner = null;
  w.props = [];
  w.events = [];
  w.table = { x: 0, z: 0, vx: 0, vz: 0 };
  w.seed = w.initialSeed;
  w.nextNudge = now + 6000;
  w.remainder = 0;
  w.duration = w.mode === 'daily' ? DAILY_MS : MATCH_MS;
  for (const p of w.players) {
    const base = newPlayer(p.seat);
    Object.assign(p, base, {
      id: p.id,
      name: p.name,
      color: p.color,
      bot: p.bot,
      seen: now,
    });
    p.botAt = now + 650 + p.seat * 230;
  }
}
export function flipAction(
  w: World,
  id: string,
  a: Record<string, unknown>,
  host: boolean,
) {
  const p = w.players.find((q) => q.id === id);
  if (!p) throw new Error('Player not found.');
  switch (a.type) {
    case 'mode':
      if (!host || w.phase === 'playing')
        throw new Error('Only the host can choose a mode between rounds.');
      if (a.mode !== 'daily' && a.mode !== 'versus')
        throw new Error('Unknown mode.');
      if (a.mode === 'daily' && w.players.filter((q) => !q.bot).length > 1)
        throw new Error('The daily challenge is played solo.');
      w.mode = a.mode;
      w.duration = w.mode === 'daily' ? DAILY_MS : MATCH_MS;
      w.phase = 'lobby';
      return;
    case 'start':
    case 'ready':
    case 'reset':
      if (!host) throw new Error('Only the host can start the round.');
      if (w.phase === 'playing') return;
      resetRound(w);
      return;
    case 'select':
      if (w.mode === 'daily' || p.chargingAt !== null || airborne(w, p)) return;
      if (a.object === undefined)
        p.selected = (p.selected + 1) % OBJECTS.length;
      else if (
        typeof a.object === 'number' &&
        Number.isInteger(a.object) &&
        a.object >= 0 &&
        a.object < OBJECTS.length
      )
        p.selected = a.object;
      else throw new Error('Unknown object.');
      event(w, 'select', p.x, p.z, 0.35);
      return;
    case 'bank':
      bank(w, p);
      return;
    case 'charge':
      if (
        w.phase === 'playing' &&
        !airborne(w, p) &&
        w.clock >= p.readyAt &&
        p.chargingAt === null
      )
        p.chargingAt = w.clock;
      return;
    case 'throw': {
      if (p.chargingAt === null) return;
      const power = charge(w, p);
      p.chargingAt = null;
      launch(w, p, power);
      return;
    }
    case 'cancel':
      p.chargingAt = null;
      return;
    default:
      throw new Error('Unknown action.');
  }
}
export function setInput(w: World, id: string, raw: Record<string, unknown>) {
  const p = w.players.find((q) => q.id === id);
  if (p) {
    p.input = cleanInput(raw);
    p.seen = w.clock;
  }
}
function bots(w: World, p: Player) {
  if (w.mode === 'daily') return;
  if (p.chargingAt !== null) {
    if (charge(w, p) >= p.botCharge) launch(w, p, charge(w, p));
    return;
  }
  if (airborne(w, p) || w.clock < p.botAt || w.clock < p.readyAt) return;
  if (p.pending && (p.combo >= 3 || random(w) < 0.35)) bank(w, p);
  p.selected = Math.min(5, Math.floor(random(w) * (2 + p.combo * 1.5)));
  p.aimX = (random(w) - 0.5) * 6.6;
  p.aimZ = (random(w) - 0.5) * 3.8;
  p.botCharge =
    OBJECTS[p.selected].ideal + (random(w) - 0.5) * (0.09 + p.seat * 0.015);
  p.chargingAt = w.clock;
  p.botAt = w.clock + 2300 + random(w) * 1100;
}
function moveProp(w: World, o: Prop, dt: number) {
  const item = OBJECTS[o.object],
    radius = item.radius;
  if (o.state === 'landed') {
    o.vx = (o.vx - Math.sin(w.table.z) * 5 * dt) * Math.exp(-dt * 2.5);
    o.vz = (o.vz + Math.sin(w.table.x) * 5 * dt) * Math.exp(-dt * 2.5);
    o.x += o.vx * dt;
    o.z += o.vz * dt;
    o.y = tableHeight(w, o.x, o.z) + item.height / 2;
    o.angle = w.table.x;
    if (
      Math.abs(o.x) > TABLE.x - radius * 0.3 ||
      Math.abs(o.z) > TABLE.z - radius * 0.3
    ) {
      o.state = 'falling';
      o.spin = 3;
      bust(w, o);
    }
    return;
  }
  const before = o.y - tableHeight(w, o.x, o.z) - item.height / 2;
  o.x += o.vx * dt;
  o.z += o.vz * dt;
  o.y += o.vy * dt - GRAVITY * dt * dt * 0.5;
  o.vy -= GRAVITY * dt;
  o.angle += o.spin * dt;
  const after = o.y - tableHeight(w, o.x, o.z) - item.height / 2;
  if (o.state === 'air' && o.vy < 0 && before >= 0 && after <= 0) {
    if (
      Math.abs(o.x) > TABLE.x - radius * 0.3 ||
      Math.abs(o.z) > TABLE.z - radius * 0.3
    ) {
      o.state = 'falling';
      bust(w, o);
      return;
    }
    // Interpolate contact within the fixed step so the upright window is not frame dependent.
    const angle =
      o.angle - o.spin * dt * (-after / Math.max(0.0001, before - after));
    const upright =
      Math.abs(
        Math.atan2(Math.sin(angle - w.table.x), Math.cos(angle - w.table.x)),
      ) < item.tolerance;
    impact(w, o);
    if (!upright) {
      o.state = 'falling';
      o.vy = 1.5;
      o.vx *= 0.55;
      o.vz *= 0.55;
      bust(w, o);
      return;
    }
    o.state = 'landed';
    o.y = tableHeight(w, o.x, o.z) + item.height / 2;
    o.vx *= 0.04;
    o.vz *= 0.04;
    o.vy = 0;
    o.spin = 0;
    if (!o.scored) {
      o.scored = true;
      const p = w.players.find((q) => q.id === o.owner);
      if (p && p.chain === o.chain && !o.banked) {
        p.combo = Math.min(8, p.combo + 1);
        p.lands++;
        p.bestCombo = Math.max(p.bestCombo, p.combo);
        p.pending += item.points * Math.min(8, p.combo);
        notice(w, p, 'land');
        if (w.mode === 'daily') p.selected = p.throws % OBJECTS.length;
        event(w, 'land', o.x, o.z);
      }
    }
  }
  if (o.state === 'air' && o.y < TABLE.y - 1) {
    o.state = 'falling';
    bust(w, o);
  }
}
function step(w: World, dt: number) {
  for (const p of w.players) {
    if (p.bot) bots(w, p);
    else {
      if (p.input.aimX !== null && p.input.aimZ !== null) {
        p.aimX = p.input.aimX;
        p.aimZ = p.input.aimZ;
      }
      p.aimX = clamp(
        p.aimX + p.input.x * dt * 3,
        -TABLE.x + 0.8,
        TABLE.x - 0.8,
      );
      p.aimZ = clamp(
        p.aimZ + p.input.z * dt * 3,
        -TABLE.z + 0.8,
        TABLE.z - 0.8,
      );
      // A lost key-up never leaves a player charging indefinitely.
      if (p.chargingAt !== null && w.clock - p.chargingAt > CHARGE_MS + 1200)
        p.chargingAt = null;
    }
  }
  if (w.mode === 'daily' && w.clock >= w.nextNudge) {
    w.nextNudge += 6000;
    w.table.vx += (random(w) - 0.5) * 0.5;
    w.table.vz += (random(w) - 0.5) * 0.5;
    event(w, 'impact', (random(w) - 0.5) * 4, (random(w) - 0.5) * 2, 0.5);
  }
  const t = w.table;
  t.vx += (-t.x * 16 - t.vx * 2.6) * dt;
  t.vz += (-t.z * 16 - t.vz * 2.6) * dt;
  t.x = clamp(t.x + t.vx * dt, -0.2, 0.2);
  t.z = clamp(t.z + t.vz * dt, -0.2, 0.2);
  for (const o of w.props) moveProp(w, o, dt);
  w.props = w.props.filter(
    (o) => o.y > -6 && (o.state === 'air' || w.clock - o.born < 18_000),
  );
  // Daily object order also progresses after a failed attempt.
  if (w.mode === 'daily')
    for (const p of w.players)
      if (!p.bot && !airborne(w, p)) p.selected = p.throws % OBJECTS.length;
  if (w.clock - w.started >= w.duration - 0.01) {
    for (const p of w.players) {
      // A last-second throw earns nothing, but previously settled points still count.
      const unstable = w.props.some(
        (o) =>
          o.owner === p.id &&
          o.chain === p.chain &&
          !o.banked &&
          o.scored &&
          o.state === 'air',
      );
      if (!unstable && p.pending) {
        p.score += p.pending;
        retireChain(w, p);
      }
      p.chargingAt = null;
    }
    w.phase = 'ended';
    const active = w.players.filter((p) => w.mode !== 'daily' || !p.bot);
    const best = Math.max(...active.map((p) => p.score));
    const winners = active.filter((p) => p.score === best);
    w.winner = winners.length === 1 ? winners[0].id : 'draw';
    event(w, 'win');
  }
}
export function advanceWorld(w: World, now: number) {
  if (!Number.isFinite(now)) return;
  const delta = clamp(now - w.clock, 0, 100);
  if (w.phase !== 'playing') {
    w.clock += delta;
    return;
  }
  w.remainder += delta;
  while (w.remainder + 0.00001 >= STEP && w.phase === 'playing') {
    w.remainder -= STEP;
    w.clock += STEP;
    w.tick++;
    step(w, STEP / 1000);
  }
}
export function replaceOwner(w: World, old: string, next: string) {
  for (const o of w.props) if (o.owner === old) o.owner = next;
  if (w.winner === old) w.winner = next;
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
