import { buildCastle, defenderPosts } from './castle';
import { solverFor } from './physics';
import {
  AMMO,
  AMMO_ORDER,
  BANNER_DOWN,
  CRANK,
  ENGINE_REACH,
  FIELD,
  MAX_TURN,
  RELIEF_MS,
  ROUND_MS,
  ELEVATION,
  GRAVITY,
  LAUNCH_Y,
  SLING,
  TREBUCHET,
  idleInput,
  power,
  tally,
  windTime,
  type AmmoKind,
  type Crew,
  type SiegeAction,
  type Block,
  type Shot,
  type SiegeEvent,
  type SiegeSnapshot,
  type SiegeWorld,
} from './types';

const POT_INTERVAL = 7200;

export function freshSiege(now: number): SiegeWorld {
  const world: SiegeWorld = {
    clock: now,
    started: 0,
    remainder: 0,
    phase: 'lobby',
    players: [],
    blocks: buildCastle(),
    totalBlocks: 0,
    gone: [],
    shots: [],
    pots: [],
    events: [],
    eventId: 0,
    shotId: 0,
    potId: 0,
    wind: 0,
    turn: 0,
    loaded: null,
    rider: '',
    loosedAt: -10000,
    supply: [...AMMO_ORDER, 'boulder', 'boulder', 'firepot', 'boulder'],
    rubble: 0,
    bannerDown: false,
    beesUntil: 0,
    reliefAt: 0,
    nextPot: 0,
    crewSize: 0,
    volleys: 0,
  };
  world.totalBlocks = world.blocks.length;
  return world;
}

export function newCrew(
  id: string,
  name: string,
  color: number,
  now: number,
): Crew {
  return {
    id,
    name: name.slice(0, 18),
    color,
    // Every crewmate starts in reach of the winch, so the opening move is
    // obvious and all four can put their shoulder to it immediately.
    x: CRANK.x + (color % 2 ? 2 : -2),
    y: 0,
    z: CRANK.z - 1 + Math.floor(color / 2) * 1.2,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: Math.PI,
    flying: false,
    winding: false,
    pushing: 0,
    stunnedUntil: 0,
    seen: now,
    input: idleInput(),
    lastJump: -1,
    lastAction: -10000,
    hits: 0,
    loaded: 0,
    launches: 0,
  };
}

function emit(w: SiegeWorld, kind: SiegeEvent['kind'], text: string) {
  w.events.push({ id: ++w.eventId, at: w.clock, kind, text });
  if (w.events.length > 24) w.events.shift();
}

const near = (
  p: { x: number; z: number },
  spot: { x: number; z: number },
  r: number,
) => Math.hypot(p.x - spot.x, p.z - spot.z) <= r;
const upright = (p: Crew, w: SiegeWorld) =>
  !p.flying && p.stunnedUntil <= w.clock;

export const banner = (w: SiegeWorld) =>
  w.blocks.find((b) => b.part === 'banner');
export const winders = (w: SiegeWorld) =>
  w.players.filter(
    (p) => p.winding && upright(p, w) && near(p, TREBUCHET, ENGINE_REACH),
  ).length;

function finish(w: SiegeWorld, won: boolean) {
  w.phase = won ? 'won' : 'lost';
  for (const p of w.players) {
    p.input = idleInput();
    p.winding = false;
    p.pushing = 0;
  }
  emit(
    w,
    'finish',
    won
      ? `The banner is down. ${tally(w.rubble)} of the keep came with it.`
      : `Dawn, and the walls are still standing. ${tally(w.rubble)} loosened, though.`,
  );
}

export function removeCrew(w: SiegeWorld, id: string) {
  w.players = w.players.filter((p) => p.id !== id);
  if (w.rider === id) w.rider = '';
  if ((w.phase === 'playing' || w.phase === 'relief') && !w.players.length)
    finish(w, false);
}

function drawAmmo(w: SiegeWorld): AmmoKind {
  if (!w.supply.length)
    w.supply = ['boulder', 'boulder', 'firepot', 'boulder', 'beehive', 'cow'];
  // The pile is stocked in order so a crew can plan the cow, not fish for it.
  return w.supply.shift()!;
}

export function siegeAction(
  w: SiegeWorld,
  id: string,
  action: SiegeAction,
  host: string,
) {
  const p = w.players.find((c) => c.id === id);
  if (!p) throw new Error('Join the siege first.');
  if (action.type === 'start' || action.type === 'restart') {
    if (id !== host) throw new Error('Only the captain can call the assault.');
    if (action.type === 'start' && w.phase !== 'lobby')
      throw new Error('The assault has already begun.');
    if (action.type === 'restart' && w.phase !== 'won' && w.phase !== 'lost')
      throw new Error('See this siege out before calling another.');
    const players = w.players.map((c) =>
      newCrew(c.id, c.name, c.color, w.clock),
    );
    const eventId = w.eventId;
    Object.assign(w, freshSiege(w.clock), {
      players,
      phase: 'playing',
      started: w.clock,
      crewSize: players.length,
      nextPot: w.clock + POT_INTERVAL,
      // Pointed at the keep from the off. The opening swing used to be random,
      // which meant the first job of every siege was undoing it.
      turn: 0,
      eventId,
    });
    // The pile loads itself, in order, so nobody spends the round fetching.
    w.loaded = drawAmmo(w);
    emit(w, 'start', 'Hold the winch to wind it, then loose. That is the job.');
    return;
  }
  if (w.phase !== 'playing' && w.phase !== 'relief')
    throw new Error('Wait for the captain to call the assault.');
  if (p.flying) throw new Error('You are currently airborne. Enjoy the view.');
  if (action.type === 'stopWind') {
    p.winding = false;
    return;
  }
  if (action.type === 'stopPush') {
    p.pushing = 0;
    return;
  }
  if (p.stunnedUntil > w.clock)
    throw new Error('You are flat on your back. A friend can haul you up.');
  if (action.type === 'jump') {
    if (p.y <= 0.04 && w.clock - p.lastJump > 350) {
      p.vy = 7.4;
      p.lastJump = w.clock;
    }
    return;
  }
  if (action.type === 'help') {
    const friend = w.players.find(
      (f) =>
        f.id !== id &&
        f.stunnedUntil > w.clock &&
        !f.flying &&
        Math.hypot(p.x - f.x, p.z - f.z) < 2.5,
    );
    if (!friend) throw new Error('Stand beside a flattened crewmate to help.');
    friend.stunnedUntil = w.clock;
    emit(w, 'squash', `${p.name} hauled ${friend.name} back onto their feet.`);
    return;
  }
  if (action.type === 'wind') {
    if (!near(p, TREBUCHET, ENGINE_REACH))
      throw new Error('Get to the engine first.');
    p.winding = true;
    return;
  }
  if (action.type === 'push') {
    if (!near(p, TREBUCHET, ENGINE_REACH))
      throw new Error('Get to the engine first.');
    // Which way you lean is the key you hold, not the side you happen to be
    // standing on. Working that out was a puzzle nobody asked for.
    p.pushing = action.side === -1 ? -1 : 1;
    return;
  }
  if (action.type === 'ride') {
    if (!near(p, SLING, 2.4))
      throw new Error('Climb into the sling at the back of the frame.');
    if (w.rider === p.id) {
      w.rider = '';
      w.loaded = drawAmmo(w);
      emit(w, 'load', `${p.name} thought better of it and climbed out.`);
      return;
    }
    if (w.rider) throw new Error('Someone braver is already in the sling.');
    // Whatever the sling had reloaded goes back on the pile to make room.
    if (w.loaded) w.supply.unshift(w.loaded);
    w.loaded = null;
    w.rider = p.id;
    emit(
      w,
      'load',
      `${p.name} climbed into the sling. This is a plan, apparently.`,
    );
    return;
  }
  if (action.type !== 'loose') throw new Error('Unknown siege action.');
  if (!near(p, TREBUCHET, ENGINE_REACH))
    throw new Error('Get to the engine first.');
  // The one job you still cannot do alone, which is the whole joke.
  if (w.rider === p.id)
    throw new Error('You are in the sling. Someone else pulls the pin.');
  if (!w.loaded && !w.rider) throw new Error('Nothing is loaded.');
  if (w.wind < 0.12) throw new Error('Wind the counterweight first.');
  loose(w, p.name);
}

function loose(w: SiegeWorld, by: string) {
  const kind: AmmoKind = w.rider ? 'crew' : w.loaded!;
  const v = power(w.wind);
  const horizontal = v * Math.cos(ELEVATION);
  const vx = -Math.sin(w.turn) * horizontal;
  const vz = -Math.cos(w.turn) * horizontal;
  const vy = v * Math.sin(ELEVATION);
  const shot = {
    id: ++w.shotId,
    kind,
    rider: w.rider,
    x: SLING.x - Math.sin(w.turn) * 1.4,
    y: LAUNCH_Y,
    z: SLING.z - Math.cos(w.turn) * 1.4,
    vx,
    vy,
    vz,
    spin: (Math.random() - 0.5) * 6,
    landed: 0,
    struck: 0,
  };
  w.shots.push(shot);
  solverFor(w).addShot(shot);
  if (w.rider) {
    const rider = w.players.find((c) => c.id === w.rider);
    if (rider) {
      rider.flying = true;
      rider.winding = false;
      rider.pushing = 0;
      rider.launches++;
      rider.x = shot.x;
      rider.y = shot.y;
      rider.z = shot.z;
      rider.vx = vx;
      rider.vy = vy;
      rider.vz = vz;
    }
  }
  w.volleys++;
  // The next payload is already in the sling by the time the arm settles.
  w.loaded = drawAmmo(w);
  w.rider = '';
  w.wind = 0;
  w.loosedAt = w.clock;
  emit(
    w,
    'loose',
    kind === 'crew'
      ? `${by} loosed the sling. There is a person in it.`
      : `${by} loosed the ${AMMO[kind].name.toLowerCase()}.`,
  );
}

function knock(w: SiegeWorld, p: Crew, ms: number, text: string) {
  if (p.stunnedUntil > w.clock) return;
  p.stunnedUntil = w.clock + ms;
  p.winding = false;
  p.pushing = 0;
  p.hits++;
  emit(w, 'squash', text);
}

function landShot(w: SiegeWorld, shotId: number) {
  const shot = w.shots.find((s) => s.id === shotId);
  if (!shot || shot.landed) return;
  shot.landed = w.clock;
  const solver = solverFor(w);
  if (shot.kind === 'firepot') {
    solver.burst(shot.x, shot.y, shot.z, 22, 4.4);
    let lit = 0;
    for (const b of w.blocks)
      if (Math.hypot(b.x - shot.x, b.y - shot.y, b.z - shot.z) < 4.4) {
        b.burning = w.clock + (b.part === 'gate' ? 5200 : 11000);
        lit++;
      }
    emit(
      w,
      'impact',
      lit
        ? `Fire pot! ${lit} stones alight.`
        : 'The fire pot burst on open ground.',
    );
    return;
  }
  if (shot.kind === 'beehive') {
    const onWall = shot.z < -6;
    if (onWall) {
      w.beesUntil = w.clock + 26000;
      emit(w, 'bees', 'Bees over the battlements. The pot-throwers have left.');
    } else
      emit(
        w,
        'impact',
        'The hive burst harmlessly in the field. The bees are cross.',
      );
    return;
  }
  if ((shot.kind === 'boulder' || shot.kind === 'cow') && !shot.struck)
    emit(w, 'impact', 'Short. It thumped into the field.');
  if (shot.rider) {
    const rider = w.players.find((c) => c.id === shot.rider);
    if (rider) {
      rider.flying = false;
      rider.y = 0;
      rider.vx = rider.vy = rider.vz = 0;
      rider.x = Math.max(-FIELD.x, Math.min(FIELD.x, shot.x));
      rider.z = Math.max(-FIELD.z, Math.min(FIELD.z, shot.z));
      knock(
        w,
        rider,
        2600,
        shot.z < -10
          ? `${rider.name} cleared the wall. Absolutely nobody planned that.`
          : `${rider.name} landed. Mostly intact.`,
      );
    }
  }
}

/** Approximate sphere-versus-block contact, used to time a shot's one blow. */
function biting(shot: Shot, b: Block, reach: number) {
  const r = AMMO[shot.kind].radius + reach;
  return (
    Math.abs(shot.x - b.x) < b.w / 2 + r &&
    Math.abs(shot.y - b.y) < b.h / 2 + r &&
    Math.abs(shot.z - b.z) < b.d / 2 + r
  );
}

/**
 * A solid shot lands one designed blow the moment it reaches the stonework.
 * The solver alone under-delivers here: contact impulses spend themselves on a
 * bonded stack, and the crew sees a boulder bounce off a wall it should have
 * broken. The blow wakes the masonry, then the solver owns the collapse.
 */
function strike(w: SiegeWorld, s: Shot) {
  if (s.struck || s.landed) return;
  const speed = Math.hypot(s.vx, s.vy, s.vz);
  if (speed < 5) return;
  if (!w.blocks.some((b) => biting(s, b, 0.15))) return;
  s.struck = w.clock;
  const spec = AMMO[s.kind];
  const force = speed * spec.mass * spec.damage * 0.05;
  const hits = solverFor(w).impact(
    s.x,
    s.y,
    s.z,
    { x: s.vx / speed, y: s.vy / speed, z: s.vz / speed },
    force,
    1.5,
  );
  if (s.kind === 'boulder' || s.kind === 'cow' || s.kind === 'crew')
    emit(
      w,
      'impact',
      s.kind === 'cow'
        ? `The cow connected with ${hits} stones. Extraordinary.`
        : s.kind === 'crew'
          ? 'A crewmate hit the stonework. They will feel that tomorrow.'
          : `Boulder into the stonework: ${hits} stones shaken.`,
    );
}

function step(w: SiegeWorld, dt: number) {
  if (w.phase !== 'playing' && w.phase !== 'relief') return;
  if (w.phase === 'playing' && w.clock >= w.started + ROUND_MS - RELIEF_MS) {
    w.phase = 'relief';
    w.reliefAt = w.started + ROUND_MS;
    emit(
      w,
      'wind',
      'Dust on the road. A relief column is coming. Last volleys!',
    );
  }
  if (w.phase === 'relief' && w.clock >= w.reliefAt) {
    finish(w, false);
    return;
  }
  const solver = solverFor(w);
  // Winch and aim, both driven by however many shoulders are on them.
  const crank = winders(w);
  if (crank) w.wind = Math.min(1, w.wind + (dt * 1000) / windTime(crank));
  const pushers = w.players.filter((p) => p.pushing && upright(p, w));
  if (pushers.length) {
    const direction = pushers.reduce((n, p) => n + p.pushing, 0);
    w.turn = Math.max(
      -MAX_TURN,
      Math.min(MAX_TURN, w.turn + Math.sign(direction) * 0.22 * dt),
    );
  }
  for (const p of w.players) {
    if (p.flying) {
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.flying = false;
        p.vx = p.vy = p.vz = 0;
        knock(w, p, 2200, `${p.name} came back down to earth.`);
      }
      continue;
    }
    if (w.rider === p.id) {
      p.x = SLING.x - Math.sin(w.turn) * 1.2;
      p.z = SLING.z - Math.cos(w.turn) * 1.2;
      p.y = 0.7 + w.wind * 0.5;
      p.facing = Math.PI + w.turn;
      continue;
    }
    const stunned = p.stunnedUntil > w.clock;
    const anchored = p.winding || p.pushing !== 0;
    const length = Math.max(1, Math.hypot(p.input.x, p.input.z));
    const ix = stunned || anchored ? 0 : p.input.x / length;
    const iz = stunned || anchored ? 0 : p.input.z / length;
    const grounded = p.y <= 0.04;
    const speed = 4.7;
    const grip = grounded ? 11 : 0.6;
    p.vx += (ix * speed - p.vx) * Math.min(1, grip * dt);
    p.vz += (iz * speed - p.vz) * Math.min(1, grip * dt);
    if (ix || iz) p.facing = Math.atan2(ix, iz);
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y < 0) {
      p.y = 0;
      p.vy = 0;
    }
    p.x = Math.max(-FIELD.x, Math.min(FIELD.x, p.x));
    p.z = Math.max(-FIELD.z, Math.min(FIELD.z, p.z));
    // Falling masonry flattens anyone standing under it.
    if (grounded && !stunned)
      for (const b of w.blocks) {
        if (b.sleeping || b.y > 3.4) continue;
        if (Math.hypot(b.x - p.x, b.z - p.z) < 1.5 && b.y < 2.2)
          knock(w, p, 2000, `${p.name} was flattened by falling masonry.`);
      }
  }
  // Defenders answer with clay pots until the bees arrive.
  if (w.clock >= w.nextPot && w.clock >= w.beesUntil) {
    const posts = defenderPosts();
    const post = posts[Math.floor(Math.random() * posts.length)];
    const target = {
      x: TREBUCHET.x + (Math.random() - 0.5) * 7,
      z: TREBUCHET.z + (Math.random() - 0.5) * 7,
    };
    const flight = 2.1;
    w.pots.push({
      id: ++w.potId,
      x: post.x,
      y: post.y,
      z: post.z,
      vx: (target.x - post.x) / flight,
      vy: (0 - post.y) / flight + (GRAVITY * flight) / 2,
      vz: (target.z - post.z) / flight,
    });
    w.nextPot = w.clock + POT_INTERVAL + Math.random() * 2600;
  }
  for (const pot of w.pots) {
    pot.vy -= GRAVITY * dt;
    pot.x += pot.vx * dt;
    pot.y += pot.vy * dt;
    pot.z += pot.vz * dt;
  }
  for (const pot of w.pots.filter((c) => c.y <= 0)) {
    for (const p of w.players)
      if (!p.flying && Math.hypot(p.x - pot.x, p.z - pot.z) < 2.3)
        knock(w, p, 1900, `${p.name} caught a clay pot. Rude.`);
    if (Math.hypot(pot.x - TREBUCHET.x, pot.z - TREBUCHET.z) < 4) {
      // A pot on the frame costs both the wind and the aim, so a crew under
      // fire has to keep coming back to the winch and the push points.
      const nudge = (pot.x < TREBUCHET.x ? 1 : -1) * 0.05;
      w.turn = Math.max(-MAX_TURN, Math.min(MAX_TURN, w.turn + nudge));
      if (w.wind > 0) {
        w.wind = Math.max(0, w.wind - 0.22);
        emit(w, 'pot', 'A pot hit the winch. The counterweight slipped back.');
      } else emit(w, 'pot', 'A pot rocked the frame. The aim has drifted.');
    }
  }
  w.pots = w.pots.filter((c) => c.y > 0);
  // Fire eats through timber first, then loosens the stone around it.
  const burnt = w.blocks.filter((b) => b.burning && w.clock >= b.burning);
  if (burnt.length) {
    for (const b of burnt) {
      solver.removeBlock(b.id);
      w.gone.push(b.id);
    }
    const lost = new Set(burnt.map((b) => b.id));
    w.blocks = w.blocks.filter((b) => !lost.has(b.id));
    emit(
      w,
      'rubble',
      `Burnt through. ${burnt.length} stone${burnt.length === 1 ? '' : 's'} gone.`,
    );
  }
  solver.step(dt);
  solver.read(w);
  for (const s of w.shots) {
    strike(w, s);
    const resting = Math.hypot(s.vx, s.vy, s.vz) < 1.2 && s.y < 3;
    if (!s.landed && (resting || s.y <= AMMO[s.kind].radius + 0.05))
      landShot(w, s.id);
  }
  for (const s of w.shots.filter(
    (o) => o.landed && w.clock - o.landed > 6000,
  )) {
    solver.removeShot(s.id);
  }
  w.shots = w.shots.filter((s) => !s.landed || w.clock - s.landed <= 6000);
  let rubble = 0;
  for (const b of w.blocks) {
    const moved =
      b.homeY - b.y > 0.55 || Math.hypot(b.x - b.homeX, b.z - b.homeZ) > 1.1;
    if (moved !== b.fallen) b.fallen = moved;
    if (moved) rubble++;
  }
  const flag = banner(w);
  w.rubble = rubble + (w.totalBlocks - w.blocks.length);
  if (flag && !w.bannerDown && flag.y < BANNER_DOWN) {
    w.bannerDown = true;
    emit(w, 'banner', 'THE BANNER IS DOWN. The keep is yours.');
    finish(w, true);
  }
}

export function advanceSiege(w: SiegeWorld, now: number) {
  if (!Number.isFinite(now) || now <= w.clock) return;
  const target = w.clock + Math.min(250, now - w.clock);
  w.remainder += target - w.clock;
  const tick = 1000 / 60;
  while (w.remainder + 1e-7 >= tick) {
    w.remainder -= tick;
    w.clock = target - w.remainder;
    step(w, tick / 1000);
  }
  w.remainder = Math.max(0, w.remainder);
  w.clock = target;
}

/**
 * The castle is a hundred rigid blocks, and sending every one of them ten times
 * a second would swamp a data channel. `buildCastle` is deterministic, so a
 * snapshot carries only the masonry that has actually moved and each guest
 * rebuilds the untouched remainder locally.
 */
/**
 * True once a block no longer matches the pose `buildCastle` would give it.
 * The rubble score uses a much coarser threshold; this one has to be exact,
 * because anything it calls unmoved is rebuilt from the baseline by guests.
 */
function displaced(b: Block) {
  return (
    Math.abs(b.x - b.homeX) > 0.015 ||
    Math.abs(b.y - b.homeY) > 0.015 ||
    Math.abs(b.z - b.homeZ) > 0.015 ||
    Math.abs(b.qw - 1) > 0.002 ||
    Math.abs(b.qx) > 0.002 ||
    Math.abs(b.qy) > 0.002 ||
    Math.abs(b.qz) > 0.002
  );
}

export function siegeSnapshot(
  w: SiegeWorld,
  code: string,
  host: string,
  _id: string,
  version: number,
): SiegeSnapshot {
  const world = structuredClone({
    ...w,
    blocks: w.blocks.filter(
      (b) => !b.sleeping || b.burning > 0 || displaced(b),
    ),
  });
  return { code, host, version, world };
}

/** Restores the untouched masonry a snapshot deliberately left out. */
export function hydrateSiege(w: SiegeWorld): SiegeWorld {
  if (w.blocks.length + w.gone.length >= w.totalBlocks) return w;
  const sent = new Map(w.blocks.map((b) => [b.id, b]));
  const dropped = new Set(w.gone);
  w.blocks = buildCastle()
    .filter((b) => !dropped.has(b.id))
    .map((b) => sent.get(b.id) ?? b);
  return w;
}
