import {
  ANGLER_COLORS,
  BOAT_HALF,
  CATCHES,
  HULL_HALF,
  LAKE_RADIUS,
  NET_REACH,
  ROUND_MS,
  idleInput,
  type Angler,
  type CatchKind,
  type Fish,
  type ReelAction,
  type ReelEvent,
  type ReelSnapshot,
  type ReelWorld,
  type Vector,
} from './types';
import { advanceChaos, freshWeather, freshWildlife, random } from './chaos';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const distance = (a: Vector, b: Vector) => Math.hypot(a.x - b.x, a.z - b.z);
export function announce(w: ReelWorld, kind: ReelEvent['kind'], text: string) {
  w.events.push({ id: ++w.eventId, kind, text });
  if (w.events.length > 8) w.events.shift();
}
export function anglerPosition(w: ReelWorld, p: Angler): Vector {
  if (p.swimming) return { x: p.x, z: p.z };
  const c = Math.cos(w.boat.yaw),
    s = Math.sin(w.boat.yaw);
  const x = p.x * Math.cos(w.boat.roll) - 0.52 * Math.sin(w.boat.roll);
  const z =
    p.z * Math.cos(w.boat.pitch) +
    (p.x * Math.sin(w.boat.roll) + 0.52 * Math.cos(w.boat.roll)) *
      Math.sin(w.boat.pitch);
  return { x: w.boat.x + x * c + z * s, z: w.boat.z - x * s + z * c };
}
function toBoat(w: ReelWorld, point: Vector): Vector {
  const dx = point.x - w.boat.x,
    dz = point.z - w.boat.z,
    c = Math.cos(w.boat.yaw),
    s = Math.sin(w.boat.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
function fromBoat(w: ReelWorld, local: Vector): Vector {
  const c = Math.cos(w.boat.yaw),
    s = Math.sin(w.boat.yaw);
  return {
    x: w.boat.x + local.x * c + local.z * s,
    z: w.boat.z - local.x * s + local.z * c,
  };
}
/** Clearance from the hull's outer edge in metres; negative underneath the boat. */
export function hullGap(w: ReelWorld, point: Vector, margin = 0) {
  const local = toBoat(w, point),
    outX = Math.abs(local.x) - (HULL_HALF.x + margin),
    outZ = Math.abs(local.z) - (HULL_HALF.z + margin);
  return outX > 0 || outZ > 0
    ? Math.hypot(Math.max(0, outX), Math.max(0, outZ))
    : Math.max(outX, outZ);
}
/** Big catches need more water than small ones before they touch paint. */
const hullMargin = (kind: CatchKind) => 0.25 + CATCHES[kind].size * 0.5;
/** Nearest point outside the hull, or null when the point is already clear. */
function pushOutOfHull(w: ReelWorld, point: Vector, margin: number) {
  const local = toBoat(w, point),
    halfX = HULL_HALF.x + margin,
    halfZ = HULL_HALF.z + margin,
    outX = Math.abs(local.x) - halfX,
    outZ = Math.abs(local.z) - halfZ;
  if (outX >= 0 || outZ >= 0) return null;
  // Leaving by the shallowest face keeps the catch on the side it arrived from.
  return outX > outZ
    ? fromBoat(w, { x: (local.x < 0 ? -1 : 1) * halfX, z: local.z })
    : fromBoat(w, { x: local.x, z: (local.z < 0 ? -1 : 1) * halfZ });
}
/** Lines are the source of truth: a fish never has an exclusive owner. */
export function hookedAnglers(w: ReelWorld, fishId: string) {
  return w.players.filter(
    (p) => !p.swimming && p.line?.kind === 'fish' && p.line.target === fishId,
  );
}
export function newAngler(
  id: string,
  name: string,
  color: number,
  now: number,
): Angler {
  return {
    id,
    name,
    color: color % ANGLER_COLORS.length,
    x: color % 2 ? 1.1 : -1.1,
    z: color < 2 ? 1 : -1,
    facing: color % 2 ? Math.PI / 2 : -Math.PI / 2,
    slipX: 0,
    slipZ: 0,
    swimming: false,
    overboardAt: 0,
    recoveredAt: now,
    seen: now,
    input: idleInput(),
    line: null,
    lastAction: -1000,
    catches: 0,
    splashes: 0,
  };
}
export function freshReel(now: number): ReelWorld {
  const w: ReelWorld = {
    clock: now,
    started: 0,
    phase: 'lobby',
    seed: 421337,
    remainder: 0,
    players: [],
    boat: {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      spin: 0,
      roll: 0,
      pitch: 0,
      rollVelocity: 0,
      pitchVelocity: 0,
    },
    fish: [],
    weather: freshWeather(now),
    wildlife: freshWildlife(now),
    score: 0,
    goal: 180,
    gear: { tire: false, magnet: false, boot: false },
    haul: {},
    events: [],
    eventId: 0,
  };
  const kinds: CatchKind[] = [
    'perch',
    'salmon',
    'tire',
    'perch',
    'pike',
    'magnet',
    'salmon',
    'eel',
    'boot',
    'monster',
    'perch',
    'salmon',
  ];
  w.fish = kinds.map((kind, i) => {
    const angle = (i / kinds.length) * Math.PI * 2;
    const radius = kind === 'monster' ? 18 : 8 + (i % 3) * 3;
    return {
      id: `fish-${i}`,
      kind,
      x: Math.sin(angle) * radius,
      z: Math.cos(angle) * radius,
      vx: 0,
      vz: 0,
      angle,
      stamina: CATCHES[kind].stamina,
      respawnAt: 0,
      surge: false,
    };
  });
  return w;
}
export function cutLine(_w: ReelWorld, p: Angler) {
  p.line = null;
}
export function removeAngler(w: ReelWorld, id: string) {
  const p = w.players.find((p) => p.id === id);
  if (p) cutLine(w, p);
  for (const other of w.players)
    if (other.line?.kind === 'player' && other.line.target === id)
      other.line = null;
  w.players = w.players.filter((p) => p.id !== id);
}
function board(w: ReelWorld, p: Angler, assisted: boolean) {
  p.swimming = false;
  p.x = p.color % 2 ? 0.8 : -0.8;
  p.z = p.color < 2 ? 0.8 : -0.8;
  p.recoveredAt = w.clock;
  p.slipX = p.slipZ = 0;
  for (const other of w.players)
    if (other.line?.kind === 'player' && other.line.target === p.id)
      other.line = null;
  announce(
    w,
    'rescue',
    `${p.name} ${assisted ? 'is back aboard!' : 'caught the safety rope. Back aboard!'}`,
  );
}
function splash(w: ReelWorld, p: Angler) {
  const point = anglerPosition(w, p);
  cutLine(w, p);
  p.swimming = true;
  p.x = point.x;
  p.z = point.z;
  p.overboardAt = w.clock;
  p.slipX = p.slipZ = 0;
  p.splashes++;
  announce(
    w,
    'splash',
    `${p.name} went overboard! Swim close and press F to climb back.`,
  );
}
export function reelAction(
  w: ReelWorld,
  id: string,
  a: ReelAction,
  host: string,
) {
  const p = w.players.find((p) => p.id === id);
  if (!p) throw new Error('Join the boat before playing.');
  if (a.type === 'start' || a.type === 'restart') {
    if (id !== host)
      throw new Error('Only the captain can start a tournament.');
    if (a.type === 'start' && w.phase !== 'lobby')
      throw new Error('The tournament has already started.');
    const members = w.players.map((p) =>
      newAngler(p.id, p.name, p.color, w.clock),
    );
    const eventId = w.eventId;
    Object.assign(w, freshReel(w.clock));
    w.players = members;
    w.eventId = eventId;
    w.phase = 'playing';
    w.started = w.clock;
    w.goal = 100 + members.length * 40;
    announce(w, 'start', 'Five minutes. One tiny boat. Bring in the big ones!');
    return;
  }
  if (w.phase !== 'playing') return;
  if (w.clock - p.lastAction < 200) return;
  p.lastAction = w.clock;
  if (a.type === 'cut') {
    cutLine(w, p);
    return;
  }
  if (a.type === 'rescue') {
    if (p.swimming && distance(p, w.boat) < 6.3) board(w, p, true);
    else if (!p.swimming) {
      const friend = w.players.find(
        (other) => other.swimming && distance(anglerPosition(w, p), other) < 7,
      );
      if (friend) board(w, friend, true);
      else throw new Error('Get closer to an overboard friend to help.');
    } else throw new Error('Swim closer to the boat, then climb aboard.');
    return;
  }
  if (p.swimming) throw new Error('Climb aboard before fishing.');
  if (a.type === 'untangle') {
    if (!p.line?.tangled) return;
    for (const other of w.players)
      if (
        other.line &&
        distance(anglerPosition(w, p), anglerPosition(w, other)) < 6
      ) {
        other.line.tangled = false;
        other.line.crossing = 0;
        other.line.clearUntil = w.clock + 3500;
      }
    announce(
      w,
      'rescue',
      `${p.name} worked the knot loose. Spread your lines!`,
    );
    return;
  }
  if (a.type !== 'cast') return;
  if (p.line)
    throw new Error('Cut or finish your current line before casting again.');
  const from = anglerPosition(w, p);
  let target: Vector;
  if (a.x !== undefined || a.z !== undefined) {
    if (!Number.isFinite(a.x) || !Number.isFinite(a.z))
      throw new Error('Aim at the lake.');
    target = { x: a.x!, z: a.z! };
  } else {
    const closest = w.fish
      .filter(
        (f) => !f.respawnAt && distance(from, f) >= 1 && distance(from, f) < 22,
      )
      .sort((a, b) => {
        const priority = (f: Fish) =>
          distance(from, f) *
          (CATCHES[f.kind].power >= 9 && hookedAnglers(w, f.id).length
            ? 0.35
            : 1);
        return priority(a) - priority(b);
      })[0];
    target = closest
      ? { x: closest.x, z: closest.z }
      : {
          x: from.x + Math.sin(p.facing + w.boat.yaw) * 10,
          z: from.z + Math.cos(p.facing + w.boat.yaw) * 10,
        };
  }
  const length = distance(from, target);
  if (
    length > 24 ||
    length < 0.7 ||
    Math.hypot(target.x, target.z) > LAKE_RADIUS
  )
    throw new Error('Cast into the water within 24 metres.');
  const friend = w.players.find(
    (other) =>
      other.id !== id && distance(anglerPosition(w, other), target) < 1.2,
  );
  p.line = {
    kind: friend ? 'player' : 'waiting',
    target: friend?.id ?? '',
    x: target.x,
    z: target.z,
    length: Math.max(2, length),
    tension: 0,
    strain: 0,
    tangled: false,
    crossing: 0,
    castAt: w.clock,
    clearUntil: w.clock + 900,
  };
  p.facing = Math.atan2(target.x - from.x, target.z - from.z) - w.boat.yaw;
  announce(
    w,
    friend ? 'tangle' : 'cast',
    friend
      ? `${p.name} hooked ${friend.name}. That is not a fish.`
      : `${p.name} cast a line.`,
  );
}
export function segmentsCross(a: Vector, b: Vector, c: Vector, d: Vector) {
  const side = (p: Vector, q: Vector, r: Vector) =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  return (
    side(a, b, c) * side(a, b, d) < -0.001 &&
    side(c, d, a) * side(c, d, b) < -0.001
  );
}
function land(w: ReelWorld, p: Angler, f: Fish) {
  if (f.respawnAt) return;
  const spec = CATCHES[f.kind];
  const crew = hookedAnglers(w, f.id);
  w.score += spec.value;
  for (const angler of crew) angler.catches++;
  w.haul[f.kind] = (w.haul[f.kind] ?? 0) + 1;
  if (f.kind === 'tire' || f.kind === 'magnet' || f.kind === 'boot')
    w.gear[f.kind] = true;
  const bonus =
    f.kind === 'tire'
      ? ' Tyre fitted: a steadier boat.'
      : f.kind === 'magnet'
        ? ' Magnet fitted: a wider bite zone.'
        : f.kind === 'boot'
          ? ' Lucky boot fitted: fish tire faster.'
          : '';
  announce(
    w,
    'catch',
    `${crew.map((angler) => angler.name).join(' & ') || p.name} landed ${spec.name}! +${spec.value}.${bonus}`,
  );
  for (const angler of crew) cutLine(w, angler);
  f.respawnAt = w.clock + 9000;
  f.surge = false;
}
function step(w: ReelWorld, dt: number) {
  const boat = w.boat;
  const sea = advanceChaos(w, dt, announce);
  let forceX = Math.sin(w.clock / 9000) * 0.8 + sea.forceX,
    forceZ = Math.cos(w.clock / 12000) * 0.6 + sea.forceZ,
    torque = 0;
  let rollLoad = sea.roll,
    pitchLoad = sea.pitch;
  for (const p of w.players) {
    const input = p.input,
      norm = Math.max(1, Math.hypot(input.x, input.z));
    if (p.swimming) {
      p.x += (input.x / norm) * dt * 4.4;
      p.z += (input.z / norm) * dt * 4.4;
      if (w.clock - p.overboardAt > 12_000) board(w, p, false);
      continue;
    }
    const speed = input.brace ? 0.8 : 2.5;
    const c = Math.cos(boat.yaw),
      s = Math.sin(boat.yaw);
    p.x += ((input.x * c - input.z * s) / norm) * speed * dt;
    p.z += ((input.x * s + input.z * c) / norm) * speed * dt;
    if (!p.line && (input.x || input.z))
      p.facing = Math.atan2(input.x, input.z) - boat.yaw;
    const slopeX = -Math.sin(boat.roll);
    const slopeZ = Math.sin(boat.pitch) * Math.cos(boat.roll);
    const slope = Math.hypot(slopeX, slopeZ);
    const protectedFromFall = w.clock - p.recoveredAt < 1800;
    const grip = (input.brace ? 0.66 : 0.24) - w.weather.rain * 0.1;
    const acceleration = protectedFromFall
      ? 0
      : Math.max(0, slope - grip) * 9.8;
    const drag = Math.exp(-(input.brace ? 5 : 2.1) * dt);
    p.slipX =
      (p.slipX + (slopeX / Math.max(0.01, slope)) * acceleration * dt) * drag;
    p.slipZ =
      (p.slipZ + (slopeZ / Math.max(0.01, slope)) * acceleration * dt) * drag;
    p.x += p.slipX * dt;
    p.z += p.slipZ * dt;
    const sliding =
      !protectedFromFall &&
      slope > (input.brace ? 0.76 : 0.32 - w.weather.rain * 0.05);
    if (
      (Math.abs(p.x) > BOAT_HALF.x + 0.2 ||
        Math.abs(p.z) > BOAT_HALF.z + 0.2) &&
      sliding
    ) {
      splash(w, p);
      continue;
    }
    // The tilted rim must allow accumulated movement through its margin.
    // Clamping to the deck every frame made the old fall threshold unreachable.
    if (!sliding) {
      p.x = clamp(p.x, -BOAT_HALF.x, BOAT_HALF.x);
      p.z = clamp(p.z, -BOAT_HALF.z, BOAT_HALF.z);
      if (protectedFromFall) p.slipX = p.slipZ = 0;
    }
    rollLoad -= p.x * (input.brace ? 0.035 : 0.075);
    pitchLoad += p.z * (input.brace ? 0.025 : 0.05);
  }
  for (const f of w.fish) {
    const spec = CATCHES[f.kind];
    if (f.respawnAt) {
      if (w.clock < f.respawnAt) continue;
      f.respawnAt = 0;
      const angle = random(w) * Math.PI * 2;
      f.x = clamp(boat.x + Math.sin(angle) * (9 + random(w) * 7), -30, 30);
      f.z = clamp(boat.z + Math.cos(angle) * (9 + random(w) * 7), -30, 30);
      f.stamina = spec.stamina;
    }
    const isJunk = ['tire', 'magnet', 'boot'].includes(f.kind);
    const crew = hookedAnglers(w, f.id);
    f.surge =
      !isJunk &&
      crew.length > 0 &&
      Math.sin(w.clock / 1050 + Number(f.id.slice(5)) * 1.7) > 0.45 &&
      f.stamina > 0;
    if (crew.length) {
      const from = crew.reduce(
          (point, p) => {
            const position = anglerPosition(w, p);
            point.x += position.x / crew.length;
            point.z += position.z / crew.length;
            return point;
          },
          { x: 0, z: 0 },
        ),
        d = Math.max(0.1, distance(from, f));
      const dx = (f.x - from.x) / d,
        dz = (f.z - from.z) / d;
      const fight =
        spec.power * (f.stamina <= 0 ? 0.025 : f.surge ? 1.7 : 0.22);
      // Swimming thrust and line force act on the same mass. Larger fish pull
      // harder without acquiring impossible acceleration during a surge.
      const mass = Math.max(1, spec.power / 3);
      f.vx += ((dx * fight) / mass) * dt;
      f.vz += ((dz * fight) / mass) * dt;
      f.angle = Math.atan2(dx, dz);
      const effort = crew.reduce(
        (sum, p) => sum + (p.input.reel ? (p.line?.tangled ? 0.2 : 1) : 0),
        0,
      );
      f.stamina = Math.max(
        0,
        f.stamina - effort * dt * (f.surge ? 0.3 : w.gear.boot ? 2.3 : 1.5),
      );
    } else {
      f.angle += Math.sin(w.clock / 3300 + Number(f.id.slice(5))) * dt * 0.4;
      if (Math.hypot(f.x, f.z) > 32 || distance(f, boat) > 22)
        f.angle = Math.atan2(boat.x - f.x, boat.z - f.z);
      f.vx += Math.sin(f.angle) * dt * (isJunk ? 0.03 : 0.55);
      f.vz += Math.cos(f.angle) * dt * (isJunk ? 0.03 : 0.55);
      f.stamina = Math.min(spec.stamina, f.stamina + dt * 0.6);
    }
    f.vx *= Math.exp(-1.4 * dt);
    f.vz *= Math.exp(-1.4 * dt);
    f.x += f.vx * dt;
    f.z += f.vz * dt;
    const radius = Math.hypot(f.x, f.z);
    if (radius > LAKE_RADIUS - 1) {
      f.x *= (LAKE_RADIUS - 1) / radius;
      f.z *= (LAKE_RADIUS - 1) / radius;
    }
    // The hull is solid. Without this a reeled fish is dragged straight through
    // it and surfaces on the deck, inside the live well.
    const clear = pushOutOfHull(w, f, hullMargin(f.kind));
    if (clear) {
      const nx = clear.x - f.x,
        nz = clear.z - f.z,
        push = Math.hypot(nx, nz);
      f.x = clear.x;
      f.z = clear.z;
      // Drop the speed aimed at the hull so it settles alongside instead of grinding.
      const into = push > 1e-6 ? (f.vx * nx + f.vz * nz) / push : 0;
      if (into < 0) {
        f.vx -= (into * nx) / push;
        f.vz -= (into * nz) / push;
      }
    }
  }
  for (const p of w.players) {
    const line = p.line;
    if (!line || p.swimming) continue;
    const from = anglerPosition(w, p);
    if (line.kind === 'waiting' && w.clock - line.castAt > 400) {
      const fish = w.fish
        .filter(
          (f) => !f.respawnAt && distance(f, line) < (w.gear.magnet ? 5 : 3.3),
        )
        .sort((a, b) => distance(a, line) - distance(b, line))[0];
      if (fish) {
        line.kind = 'fish';
        line.target = fish.id;
        const helpers = hookedAnglers(w, fish.id).length;
        announce(
          w,
          'bite',
          helpers > 1
            ? `${p.name} joined the pull on ${CATCHES[fish.kind].name}! ${helpers} lines working together.`
            : `${p.name} hooked ${CATCHES[fish.kind].name}! Friends can cast onto the same fish to help.`,
        );
      }
    }
    const fish =
      line.kind === 'fish'
        ? w.fish.find((f) => f.id === line.target)
        : undefined;
    const friend =
      line.kind === 'player'
        ? w.players.find((o) => o.id === line.target)
        : undefined;
    if (
      (line.kind === 'fish' && (!fish || fish.respawnAt)) ||
      (line.kind === 'player' && !friend)
    ) {
      cutLine(w, p);
      continue;
    }
    const to = fish ?? (friend ? anglerPosition(w, friend) : line);
    line.x = to.x;
    line.z = to.z;
    const d = Math.max(0.1, distance(from, to)),
      dx = (to.x - from.x) / d,
      dz = (to.z - from.z) / d;
    if (p.input.reel) {
      // A catch pinned against the hull has nowhere left to come. Stop winding in
      // there so holding E fights the fish rather than the boat.
      const pinned =
        fish && hullGap(w, fish, hullMargin(fish.kind)) <= 0.01
          ? Math.max(0.8, d - 2)
          : 0.8;
      line.length = Math.max(
        pinned,
        line.length - dt * (line.tangled ? 0.16 : 2.0),
      );
    } else if (fish?.surge) line.length = Math.min(28, line.length + dt * 2.9);
    const stretch = Math.max(0, d - line.length);
    const pull = Math.min(38, stretch * 11);
    const limit = line.tangled ? 22 : 35;
    line.tension = clamp(
      pull / limit + (fish?.surge && p.input.reel ? 0.45 : 0),
      0,
      1.5,
    );
    line.strain = Math.max(0, line.strain + dt * (line.tension > 1 ? 1 : -1.6));
    if (line.strain > 1.1 || d > 34) {
      announce(
        w,
        'snap',
        `${p.name} snapped a line! Ease off E when the tension turns red.`,
      );
      cutLine(w, p);
      continue;
    }
    if (fish || friend) {
      forceX += dx * pull;
      forceZ += dz * pull;
      torque +=
        (from.z - boat.z) * dx * pull * 0.015 -
        (from.x - boat.x) * dz * pull * 0.015;
      const localX = dx * Math.cos(boat.yaw) - dz * Math.sin(boat.yaw);
      const localZ = dx * Math.sin(boat.yaw) + dz * Math.cos(boat.yaw);
      rollLoad -= localX * pull * (p.input.brace ? 0.006 : 0.015);
      pitchLoad += localZ * pull * (p.input.brace ? 0.003 : 0.009);
      if (fish) {
        const mass = Math.max(1, CATCHES[fish.kind].power / 3);
        fish.vx -= ((dx * pull) / mass) * dt;
        fish.vz -= ((dz * pull) / mass) * dt;
        // Landed from alongside the hull, at any heading, whatever the fish's size.
        if (fish.stamina <= 0 && hullGap(w, fish) < NET_REACH) {
          land(w, p, fish);
          continue;
        }
      }
      if (friend) {
        if (friend.swimming) {
          friend.x -= dx * pull * dt * 0.14;
          friend.z -= dz * pull * dt * 0.14;
          if (distance(friend, boat) < 5.5 && p.input.reel)
            board(w, friend, true);
        } else if (p.input.reel && !friend.input.brace) {
          friend.x -= localX * dt * pull * 0.065;
          friend.z -= localZ * dt * pull * 0.065;
          if (
            Math.abs(friend.x) > BOAT_HALF.x + 0.15 ||
            Math.abs(friend.z) > BOAT_HALF.z + 0.15
          )
            splash(w, friend);
        }
      }
    } else if (p.input.reel) {
      line.x -= dx * dt * 2.5;
      line.z -= dz * dt * 2.5;
      // An empty hook wound back as far as the hull is simply home again.
      if (d < 1.5 || hullGap(w, line) <= 0) cutLine(w, p);
    }
  }
  for (let i = 0; i < w.players.length; i++) {
    const p = w.players[i];
    if (!p.line) continue;
    let crossed = false;
    for (let j = i + 1; j < w.players.length; j++) {
      const q = w.players[j];
      if (!q.line || w.clock < p.line.clearUntil || w.clock < q.line.clearUntil)
        continue;
      if (
        p.line.kind === 'fish' &&
        q.line.kind === 'fish' &&
        p.line.target === q.line.target
      )
        continue;
      if (
        segmentsCross(
          anglerPosition(w, p),
          p.line,
          anglerPosition(w, q),
          q.line,
        )
      ) {
        crossed = true;
        p.line.crossing += dt;
        if (p.line.crossing > 0.55 && !p.line.tangled) {
          p.line.tangled = q.line.tangled = true;
          announce(
            w,
            'tangle',
            `${p.name} tangled lines with ${q.name}! R loosens the knot; Q cuts free.`,
          );
        }
      }
    }
    if (!crossed) p.line.crossing = 0;
  }
  const mass = 9 + w.players.filter((p) => !p.swimming).length * 1.8;
  boat.vx = (boat.vx + (forceX / mass) * dt) * Math.exp(-0.42 * dt);
  boat.vz = (boat.vz + (forceZ / mass) * dt) * Math.exp(-0.42 * dt);
  boat.x += boat.vx * dt;
  boat.z += boat.vz * dt;
  if (Math.hypot(boat.x, boat.z) > 34) {
    const normal = Math.atan2(boat.x, boat.z);
    boat.x = Math.sin(normal) * 34;
    boat.z = Math.cos(normal) * 34;
    const outward = boat.vx * Math.sin(normal) + boat.vz * Math.cos(normal);
    if (outward > 0) {
      boat.vx -= Math.sin(normal) * outward * 1.5;
      boat.vz -= Math.cos(normal) * outward * 1.5;
    }
  }
  boat.spin = (boat.spin + (torque * dt) / mass) * Math.exp(-1.4 * dt);
  boat.yaw += boat.spin * dt;
  const stability = w.gear.tire ? 0.5 : 1;
  const rollTarget = clamp(
    rollLoad * stability + Math.sin(w.clock / 1350) * 0.025,
    -1.05,
    1.05,
  );
  const pitchTarget = clamp(
    pitchLoad * stability + Math.cos(w.clock / 1700) * 0.025,
    -0.9,
    0.9,
  );
  boat.rollVelocity +=
    ((rollTarget - boat.roll) * 8 - boat.rollVelocity * 3.2) * dt;
  boat.pitchVelocity +=
    ((pitchTarget - boat.pitch) * 8 - boat.pitchVelocity * 3.2) * dt;
  boat.roll += boat.rollVelocity * dt;
  boat.pitch += boat.pitchVelocity * dt;
}
export function advanceReel(w: ReelWorld, now: number) {
  const elapsed = Math.max(0, Math.min(100, now - w.clock));
  if (w.phase !== 'playing') {
    w.clock += elapsed;
    return;
  }
  w.remainder += elapsed / 1000;
  w.clock += elapsed;
  while (w.remainder >= 1 / 60) {
    w.remainder -= 1 / 60;
    step(w, 1 / 60);
    if (w.clock - w.started >= ROUND_MS) {
      w.phase = w.score >= w.goal ? 'won' : 'lost';
      for (const p of w.players) cutLine(w, p);
      announce(
        w,
        'finish',
        w.phase === 'won'
          ? 'Tournament won! Questionable technique. Excellent fish.'
          : 'Time! The lake won this round. Your next big catch is out there.',
      );
      break;
    }
  }
}
export function reelSnapshot(
  w: ReelWorld,
  code: string,
  host: string,
  _id: string,
  version: number,
): ReelSnapshot {
  return { code, host, version, world: structuredClone(w) };
}
