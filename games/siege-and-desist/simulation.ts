import { Vec3 } from 'cannon-es';
import { buildCastle, buildClashCastles, defenderPosts } from './castle';
import { solverFor } from './physics';
import {
  AMMO,
  AMMO_ORDER,
  BANNER_DOWN,
  CRANK,
  CRANK_RED,
  CRANK_BLUE,
  ENGINE_REACH,
  FIELD,
  MAX_TURN,
  RELIEF_MS,
  ROUND_MS,
  ELEVATION,
  GRAVITY,
  LAUNCH_Y,
  SLING,
  SLING_RED,
  SLING_BLUE,
  TREBUCHET,
  TREBUCHET_RED,
  TREBUCHET_BLUE,
  idleInput,
  power,
  tally,
  windTime,
  type AmmoKind,
  type Crew,
  type GameMode,
  type SiegeAction,
  type Block,
  type Shot,
  type SiegeEvent,
  type SiegeSnapshot,
  type SiegeWorld,
  type TeamId,
} from './types';

const POT_INTERVAL = 7200;

export function freshSiege(
  now: number,
  mode: GameMode = 'classic',
): SiegeWorld {
  const isClash = mode === 'clash2v2';
  const blocks = isClash ? buildClashCastles() : buildCastle();
  const world: SiegeWorld = {
    clock: now,
    started: 0,
    remainder: 0,
    phase: 'lobby',
    mode,
    players: [],
    blocks,
    totalBlocks: blocks.length,
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
    ...(isClash
      ? {
          engineBlue: {
            wind: 0,
            turn: 0,
            loaded: 'boulder',
            rider: '',
            loosedAt: -10000,
            supply: [...AMMO_ORDER, 'boulder', 'cow', 'firepot', 'boulder'],
          },
          towers: {
            red: [true, true, true],
            blue: [true, true, true],
          },
          goose: {
            x: 0,
            z: 0,
            vx: 0.8,
            vz: 0.3,
            honkUntil: 0,
          },
        }
      : {}),
  };
  return world;
}

export function newCrew(
  id: string,
  name: string,
  color: number,
  now: number,
  team?: TeamId,
  bot = false,
  mode: GameMode = 'classic',
): Crew {
  const is2v2 = mode === 'clash2v2';
  const isBlue = is2v2 && team === 'blue';
  const crank = is2v2 ? (team === 'blue' ? CRANK_BLUE : CRANK_RED) : CRANK;
  const facing = isBlue ? 0 : Math.PI;

  return {
    id,
    name: name.slice(0, 18),
    color,
    team: team ?? (is2v2 ? (color % 2 === 1 ? 'blue' : 'red') : 'red'),
    bot,
    x: crank.x + (color % 2 ? 1.4 : -1.4),
    y: 0,
    z:
      crank.z +
      (isBlue
        ? Math.floor(color / 2)
          ? 0.8
          : -0.8
        : Math.floor(color / 2)
          ? -0.8
          : 0.8),
    vx: 0,
    vy: 0,
    vz: 0,
    facing,
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

export const CLASH_BOT_ROSTER = [
  { id: 'bot-roger', name: 'Brother Roger' },
  { id: 'bot-cedric', name: 'Sir Cedric' },
  { id: 'bot-dunce', name: 'Lord Dunce' },
  { id: 'bot-baron', name: 'Baron Bumbling' },
] as const;

export function reconcileClashBots(w: SiegeWorld) {
  if (w.mode !== 'clash2v2') return;

  const humans = w.players.filter((p) => !p.bot);
  const redHumans = humans.filter((p) => (p.team ?? 'red') === 'red');
  const blueHumans = humans.filter((p) => p.team === 'blue');

  const redBotsNeeded = Math.max(0, 2 - redHumans.length);
  const blueBotsNeeded = Math.max(0, 2 - blueHumans.length);

  // Current bots
  const redBots = w.players.filter((p) => p.bot && (p.team ?? 'red') === 'red');
  const blueBots = w.players.filter((p) => p.bot && p.team === 'blue');

  // Prune excess bots
  if (redBots.length > redBotsNeeded) {
    const toRemove = redBots.slice(redBotsNeeded);
    const removeIds = new Set(toRemove.map((b) => b.id));
    w.players = w.players.filter((p) => !removeIds.has(p.id));
  }
  if (blueBots.length > blueBotsNeeded) {
    const toRemove = blueBots.slice(blueBotsNeeded);
    const removeIds = new Set(toRemove.map((b) => b.id));
    w.players = w.players.filter((p) => !removeIds.has(p.id));
  }

  // Add missing bots to Red
  const currentRedBots = w.players.filter(
    (p) => p.bot && (p.team ?? 'red') === 'red',
  );
  if (currentRedBots.length < redBotsNeeded) {
    const needed = redBotsNeeded - currentRedBots.length;
    for (let i = 0; i < needed; i++) {
      const usedIds = new Set(w.players.map((p) => p.id));
      const template = CLASH_BOT_ROSTER.find((b) => !usedIds.has(b.id)) ?? {
        id: `bot-red-${Date.now()}-${i}`,
        name: `Red Bot ${i + 1}`,
      };
      const usedColors = new Set(w.players.map((p) => p.color));
      let color = 0;
      while (usedColors.has(color) && color < 4) color++;
      w.players.push(
        newCrew(
          template.id,
          template.name,
          color,
          w.clock,
          'red',
          true,
          'clash2v2',
        ),
      );
    }
  }

  // Add missing bots to Blue
  const currentBlueBots = w.players.filter((p) => p.bot && p.team === 'blue');
  if (currentBlueBots.length < blueBotsNeeded) {
    const needed = blueBotsNeeded - currentBlueBots.length;
    for (let i = 0; i < needed; i++) {
      const usedIds = new Set(w.players.map((p) => p.id));
      const template = CLASH_BOT_ROSTER.find((b) => !usedIds.has(b.id)) ?? {
        id: `bot-blue-${Date.now()}-${i}`,
        name: `Blue Bot ${i + 1}`,
      };
      const usedColors = new Set(w.players.map((p) => p.color));
      let color = 1;
      while (usedColors.has(color) && color < 4) color++;
      w.players.push(
        newCrew(
          template.id,
          template.name,
          color,
          w.clock,
          'blue',
          true,
          'clash2v2',
        ),
      );
    }
  }
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
export const winders = (w: SiegeWorld, team: TeamId = 'red') => {
  const is2v2 = w.mode === 'clash2v2';
  const treb =
    is2v2 && team === 'blue'
      ? TREBUCHET_BLUE
      : is2v2
        ? TREBUCHET_RED
        : TREBUCHET;
  return w.players.filter(
    (p) => p.winding && upright(p, w) && near(p, treb, ENGINE_REACH),
  ).length;
};

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

function drawAmmoBlue(w: SiegeWorld): AmmoKind {
  if (!w.engineBlue) return 'boulder';
  if (!w.engineBlue.supply.length)
    w.engineBlue.supply = [
      'boulder',
      'boulder',
      'firepot',
      'boulder',
      'beehive',
      'cow',
    ];
  return w.engineBlue.supply.shift()!;
}

function finishClash(w: SiegeWorld, winner: TeamId | 'draw') {
  w.phase = 'won';
  w.winner = winner;
  for (const p of w.players) {
    p.input = idleInput();
    p.winding = false;
    p.pushing = 0;
  }
  emit(
    w,
    'finish',
    winner === 'draw'
      ? 'Catastrophic double collapse! Both castles lie in ruins. It is a draw!'
      : `${winner.toUpperCase()} TEAM WINS! All three opposing towers have been toppled!`,
  );
}

export function siegeAction(
  w: SiegeWorld,
  id: string,
  action: SiegeAction,
  host: string,
) {
  const p = w.players.find((c) => c.id === id);
  if (!p) throw new Error('Join the siege first.');

  if (action.type === 'setMode') {
    if (id !== host)
      throw new Error('Only the captain can choose the game mode.');
    if (w.phase !== 'lobby') throw new Error('The assault has already begun.');
    const nextMode = action.mode ?? 'classic';
    w.mode = nextMode;
    const fresh = freshSiege(w.clock, nextMode);
    w.blocks = fresh.blocks;
    w.totalBlocks = fresh.totalBlocks;
    w.engineBlue = fresh.engineBlue;
    w.towers = fresh.towers;
    w.goose = fresh.goose;
    if (nextMode === 'clash2v2') {
      reconcileClashBots(w);
    } else {
      w.players = w.players.filter((c) => !c.bot);
    }
    emit(
      w,
      'wind',
      `Mode set to ${nextMode === 'clash2v2' ? '2v2 Castle Clash' : 'Classic Siege'}.`,
    );
    return;
  }

  if (action.type === 'switchTeam') {
    if (w.phase !== 'lobby')
      throw new Error('Teams are locked once assault begins.');
    p.team = action.team ?? (p.team === 'blue' ? 'red' : 'blue');
    reconcileClashBots(w);
    emit(w, 'load', `${p.name} joined Team ${p.team.toUpperCase()}.`);
    return;
  }

  if (action.type === 'start' || action.type === 'restart') {
    if (id !== host) throw new Error('Only the captain can call the assault.');
    if (action.type === 'start' && w.phase !== 'lobby')
      throw new Error('The assault has already begun.');
    if (action.type === 'restart' && w.phase !== 'won' && w.phase !== 'lost')
      throw new Error('See this siege out before calling another.');

    const mode = action.mode ?? w.mode ?? 'classic';
    let players: Crew[];

    if (mode === 'clash2v2') {
      reconcileClashBots(w);
      players = w.players.map((c) =>
        newCrew(c.id, c.name, c.color, w.clock, c.team, c.bot, 'clash2v2'),
      );
    } else {
      players = w.players
        .filter((c) => !c.bot)
        .map((c) =>
          newCrew(c.id, c.name, c.color, w.clock, 'red', false, 'classic'),
        );
    }

    const eventId = w.eventId;
    Object.assign(w, freshSiege(w.clock, mode), {
      players,
      phase: 'playing',
      started: w.clock,
      crewSize: players.length,
      nextPot: w.clock + POT_INTERVAL,
      turn: 0,
      eventId,
    });
    w.loaded = drawAmmo(w);
    if (w.engineBlue) w.engineBlue.loaded = drawAmmoBlue(w);
    emit(
      w,
      'start',
      mode === 'clash2v2'
        ? '2v2 CASTLE CLASH! Topple all three opposing towers to win!'
        : 'Hold the winch to wind it, then loose. That is the job.',
    );
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

  // Determine which engine the player is standing near
  const is2v2 = w.mode === 'clash2v2';
  const nearBlueEngine = is2v2 && near(p, TREBUCHET_BLUE, ENGINE_REACH);
  const nearRedEngine = near(
    p,
    is2v2 ? TREBUCHET_RED : TREBUCHET,
    ENGINE_REACH,
  );
  const usingBlue = nearBlueEngine && (!nearRedEngine || p.team === 'blue');

  if (action.type === 'wind') {
    if (!nearBlueEngine && !nearRedEngine)
      throw new Error('Get to an engine first.');
    p.winding = true;
    return;
  }
  if (action.type === 'push') {
    if (!nearBlueEngine && !nearRedEngine)
      throw new Error('Get to an engine first.');
    p.pushing = action.side === -1 ? -1 : 1;
    return;
  }
  if (action.type === 'ride') {
    const slingSpot = usingBlue ? SLING_BLUE : is2v2 ? SLING_RED : SLING;
    if (!near(p, slingSpot, 2.6))
      throw new Error('Climb into the sling at the back of the frame.');

    const engine = usingBlue ? w.engineBlue! : w;
    if (engine.rider === p.id) {
      engine.rider = '';
      engine.loaded = usingBlue ? drawAmmoBlue(w) : drawAmmo(w);
      emit(w, 'load', `${p.name} thought better of it and climbed out.`);
      return;
    }
    if (engine.rider)
      throw new Error('Someone braver is already in the sling.');
    if (engine.loaded) engine.supply.unshift(engine.loaded);
    engine.loaded = null;
    engine.rider = p.id;
    emit(
      w,
      'load',
      `${p.name} climbed into the sling. This is a plan, apparently.`,
    );
    return;
  }

  if (action.type !== 'loose') throw new Error('Unknown siege action.');
  if (!nearBlueEngine && !nearRedEngine)
    throw new Error('Get to an engine first.');

  const engine = usingBlue ? w.engineBlue! : w;
  if (engine.rider === p.id)
    throw new Error('You are in the sling. Someone else pulls the pin.');
  if (!engine.loaded && !engine.rider) throw new Error('Nothing is loaded.');
  if (engine.wind < 0.12) throw new Error('Wind the counterweight first.');

  loose(w, p.name, usingBlue ? 'blue' : 'red');
}

function loose(w: SiegeWorld, by: string, team: TeamId = 'red') {
  const isBlue = team === 'blue' && w.mode === 'clash2v2' && !!w.engineBlue;
  const engine = isBlue ? w.engineBlue! : w;
  const kind: AmmoKind = engine.rider ? 'crew' : engine.loaded!;
  const v = power(engine.wind);
  const horizontal = v * Math.cos(ELEVATION);

  // Red shoots towards North (-z), Blue shoots towards South (+z)
  const dirZ = isBlue ? 1 : -1;
  const vx = isBlue
    ? -Math.sin(engine.turn) * horizontal
    : Math.sin(engine.turn) * horizontal;
  const vz = dirZ * Math.cos(engine.turn) * horizontal;
  const vy = v * Math.sin(ELEVATION);
  const slingPos = isBlue
    ? SLING_BLUE
    : w.mode === 'clash2v2'
      ? SLING_RED
      : SLING;

  const shot: Shot = {
    id: ++w.shotId,
    kind,
    rider: engine.rider,
    team,
    x: slingPos.x - Math.sin(engine.turn) * 1.4,
    y: LAUNCH_Y,
    z: isBlue
      ? slingPos.z + Math.cos(engine.turn) * 1.4
      : slingPos.z - Math.cos(engine.turn) * 1.4,
    vx,
    vy,
    vz,
    spin: (Math.random() - 0.5) * 6,
    landed: 0,
    struck: 0,
  };
  w.shots.push(shot);
  solverFor(w).addShot(shot);

  if (engine.rider) {
    const rider = w.players.find((c) => c.id === engine.rider);
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
  engine.loaded = isBlue ? drawAmmoBlue(w) : drawAmmo(w);
  engine.rider = '';
  engine.wind = 0;
  engine.loosedAt = w.clock;
  emit(
    w,
    'loose',
    kind === 'crew'
      ? `${by} loosed the sling. There is a person in it.`
      : `${by} loosed the ${AMMO[kind].name.toLowerCase()}!`,
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

function stepBots(w: SiegeWorld, dt: number) {
  if (w.phase !== 'playing' && w.phase !== 'relief') return;
  const is2v2 = w.mode === 'clash2v2';
  const bots = w.players.filter((p) => p.bot && upright(p, w) && !p.flying);

  for (const bot of bots) {
    const isBlue = bot.team === 'blue';
    const engine = isBlue ? w.engineBlue : w;
    if (!engine) continue;
    const crank = isBlue ? CRANK_BLUE : is2v2 ? CRANK_RED : CRANK;
    const treb = isBlue ? TREBUCHET_BLUE : is2v2 ? TREBUCHET_RED : TREBUCHET;

    // 1. Rescue downed ally
    const downedAlly = w.players.find(
      (a) =>
        a.team === bot.team &&
        a.id !== bot.id &&
        a.stunnedUntil > w.clock &&
        !a.flying &&
        Math.hypot(bot.x - a.x, bot.z - a.z) < 6,
    );
    if (downedAlly) {
      const dx = downedAlly.x - bot.x;
      const dz = downedAlly.z - bot.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.2) {
        downedAlly.stunnedUntil = w.clock;
        emit(
          w,
          'squash',
          `${bot.name} hauled ${downedAlly.name} back onto their feet.`,
        );
      } else {
        bot.input = { x: dx / dist, z: dz / dist, seq: bot.input.seq + 1 };
      }
      continue;
    }

    // 2. Wind engine if under threshold
    if (engine.wind < 0.72) {
      const distToCrank = Math.hypot(bot.x - crank.x, bot.z - crank.z);
      if (distToCrank > 1.6) {
        const dx = crank.x - bot.x;
        const dz = crank.z - bot.z;
        const dist = Math.hypot(dx, dz);
        bot.input = { x: dx / dist, z: dz / dist, seq: bot.input.seq + 1 };
        bot.winding = false;
      } else {
        bot.input = idleInput();
        bot.winding = true;
      }
      continue;
    }

    // 3. Engine is wound! Aim and loose
    bot.winding = false;
    let targetTurn = 0;
    if (is2v2 && w.towers) {
      const oppTeam = isBlue ? 'red' : 'blue';
      const towers = w.towers[oppTeam];
      // Tower 0 (Left, x = -8.5), Tower 1 (Center, x = 0), Tower 2 (Right, x = +8.5)
      if (towers[0]) targetTurn = isBlue ? -0.26 : 0.26;
      else if (towers[2]) targetTurn = isBlue ? 0.26 : -0.26;
      else targetTurn = 0;
    }

    if (Math.abs(engine.turn - targetTurn) > 0.04) {
      engine.turn += Math.sign(targetTurn - engine.turn) * 0.22 * dt;
      continue;
    }

    const distToTreb = Math.hypot(bot.x - treb.x, bot.z - treb.z);
    if (distToTreb > ENGINE_REACH - 1.5) {
      const dx = treb.x - bot.x;
      const dz = treb.z - bot.z;
      const dist = Math.hypot(dx, dz);
      bot.input = { x: dx / dist, z: dz / dist, seq: bot.input.seq + 1 };
    } else {
      bot.input = idleInput();
      if (
        !engine.rider &&
        Math.random() < 0.04 &&
        w.clock - bot.lastAction > 20000
      ) {
        bot.lastAction = w.clock;
        engine.rider = bot.id;
        emit(w, 'load', `${bot.name} climbed into the sling! For glory!`);
      } else if (engine.wind >= 0.2 && (engine.loaded || engine.rider)) {
        loose(w, bot.name, isBlue ? 'blue' : 'red');
      }
    }
  }
}

function step(w: SiegeWorld, dt: number) {
  if (w.phase !== 'playing' && w.phase !== 'relief') return;
  const is2v2 = w.mode === 'clash2v2';

  if (
    !is2v2 &&
    w.phase === 'playing' &&
    w.clock >= w.started + ROUND_MS - RELIEF_MS
  ) {
    w.phase = 'relief';
    w.reliefAt = w.started + ROUND_MS;
    emit(
      w,
      'wind',
      'Dust on the road. A relief column is coming. Last volleys!',
    );
  }
  if (!is2v2 && w.phase === 'relief' && w.clock >= w.reliefAt) {
    finish(w, false);
    return;
  }

  // 1. Run bot AI updates
  stepBots(w, dt);

  const solver = solverFor(w);

  // 2. Winch and aim for primary (Red) engine
  const redTreb = is2v2 ? TREBUCHET_RED : TREBUCHET;
  const crank = winders(w);
  if (crank) w.wind = Math.min(1, w.wind + (dt * 1000) / windTime(crank));
  const pushers = w.players.filter(
    (p) => p.pushing && upright(p, w) && near(p, redTreb, ENGINE_REACH),
  );
  if (pushers.length) {
    const direction = pushers.reduce((n, p) => n + p.pushing, 0);
    w.turn = Math.max(
      -MAX_TURN,
      Math.min(MAX_TURN, w.turn + Math.sign(direction) * 0.22 * dt),
    );
  }

  // 3. Winch and aim for Blue engine in 2v2
  if (is2v2 && w.engineBlue) {
    const blueWinders = w.players.filter(
      (p) =>
        p.winding && upright(p, w) && near(p, TREBUCHET_BLUE, ENGINE_REACH),
    ).length;
    if (blueWinders) {
      w.engineBlue.wind = Math.min(
        1,
        w.engineBlue.wind + (dt * 1000) / windTime(blueWinders),
      );
    }
    const bluePushers = w.players.filter(
      (p) =>
        p.pushing && upright(p, w) && near(p, TREBUCHET_BLUE, ENGINE_REACH),
    );
    if (bluePushers.length) {
      const direction = bluePushers.reduce((n, p) => n + p.pushing, 0);
      w.engineBlue.turn = Math.max(
        -MAX_TURN,
        Math.min(
          MAX_TURN,
          w.engineBlue.turn + Math.sign(direction) * 0.22 * dt,
        ),
      );
    }
  }

  // 4. Update players
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
      const slingPos = is2v2 ? SLING_RED : SLING;
      p.x = slingPos.x - Math.sin(w.turn) * 1.2;
      p.z = slingPos.z - Math.cos(w.turn) * 1.2;
      p.y = 0.7 + w.wind * 0.5;
      p.facing = Math.PI + w.turn;
      continue;
    }
    if (is2v2 && w.engineBlue && w.engineBlue.rider === p.id) {
      p.x = SLING_BLUE.x + Math.sin(w.engineBlue.turn) * 1.2;
      p.z = SLING_BLUE.z + Math.cos(w.engineBlue.turn) * 1.2;
      p.y = 0.7 + w.engineBlue.wind * 0.5;
      p.facing = w.engineBlue.turn;
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

  // 5. Defenders (clay pots) in classic mode only
  if (!is2v2 && w.clock >= w.nextPot && w.clock >= w.beesUntil) {
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
      const nudge = (pot.x < TREBUCHET.x ? 1 : -1) * 0.05;
      w.turn = Math.max(-MAX_TURN, Math.min(MAX_TURN, w.turn + nudge));
      if (w.wind > 0) {
        w.wind = Math.max(0, w.wind - 0.22);
        emit(w, 'pot', 'A pot hit the winch. The counterweight slipped back.');
      } else emit(w, 'pot', 'A pot rocked the frame. The aim has drifted.');
    }
  }
  w.pots = w.pots.filter((c) => c.y > 0);

  // 6. Midfield wandering Goose
  if (w.goose) {
    const g = w.goose;
    g.x += g.vx * dt;
    g.z += g.vz * dt;
    if (g.x < -14 || g.x > 14) g.vx = -g.vx;
    if (g.z < -4 || g.z > 4) g.vz = -g.vz;
    for (const p of w.players) {
      if (Math.hypot(p.x - g.x, p.z - g.z) < 2.0 && w.clock > g.honkUntil) {
        g.honkUntil = w.clock + 2500;
        g.vx = (g.x < p.x ? -1 : 1) * 3.5;
        g.vz = (g.z < p.z ? -1 : 1) * 3.5;
        emit(w, 'honk', `${p.name} startled the Goose of War! *HONK*`);
      }
    }
  }

  // 7. Fire effects
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

  // 8. Mid-air projectile collisions
  const colliding = new Set<number>();
  for (let i = 0; i < w.shots.length; i++) {
    const s1 = w.shots[i];
    if (s1.landed || s1.y < 1.2 || colliding.has(s1.id)) continue;
    for (let j = i + 1; j < w.shots.length; j++) {
      const s2 = w.shots[j];
      if (s2.landed || s2.y < 1.2 || colliding.has(s2.id)) continue;
      const d = Math.hypot(s1.x - s2.x, s1.y - s2.y, s1.z - s2.z);
      if (d < 1.8) {
        colliding.add(s1.id);
        colliding.add(s2.id);
        solver.removeShot(s1.id);
        solver.removeShot(s2.id);
        emit(
          w,
          'midair',
          `MID-AIR COLLISION! ${AMMO[s1.kind].name} and ${AMMO[s2.kind].name} shattered in mid-air!`,
        );
      }
    }
  }
  if (colliding.size > 0) {
    w.shots = w.shots.filter((s) => !colliding.has(s.id));
  }

  // 9. Process shots & impacts
  for (const s of w.shots) {
    strike(w, s);
    const resting = Math.hypot(s.vx, s.vy, s.vz) < 1.2 && s.y < 3;
    if (!s.landed && (resting || s.y <= AMMO[s.kind].radius + 0.05))
      landShot(w, s.id);
  }

  // Counter-battery hits in 2v2
  if (is2v2) {
    for (const s of w.shots) {
      if (s.landed && w.clock - s.landed < 200) {
        if (s.team === 'red' && w.engineBlue) {
          if (
            Math.hypot(s.x - TREBUCHET_BLUE.x, s.z - TREBUCHET_BLUE.z) < 4.4
          ) {
            if (w.engineBlue.wind > 0.08) {
              w.engineBlue.wind = 0;
              emit(
                w,
                'counterbattery',
                'Direct hit on Blue trebuchet! Counterweight slipped!',
              );
            }
          }
        }
        if (s.team === 'blue') {
          if (Math.hypot(s.x - TREBUCHET_RED.x, s.z - TREBUCHET_RED.z) < 4.4) {
            if (w.wind > 0.08) {
              w.wind = 0;
              emit(
                w,
                'counterbattery',
                'Direct hit on Red trebuchet! Counterweight slipped!',
              );
            }
          }
        }
      }
    }
  }

  for (const s of w.shots.filter(
    (o) => o.landed && w.clock - o.landed > 6000,
  )) {
    solver.removeShot(s.id);
  }
  w.shots = w.shots.filter((s) => !s.landed || w.clock - s.landed <= 6000);

  // 10. Rubble & Tower checking
  let rubble = 0;
  for (const b of w.blocks) {
    const moved =
      b.homeY - b.y > 0.55 || Math.hypot(b.x - b.homeX, b.z - b.homeZ) > 1.1;
    if (moved !== b.fallen) b.fallen = moved;
    if (moved) rubble++;
  }
  w.rubble = rubble + (w.totalBlocks - w.blocks.length);

  // 2v2 Tower checking
  if (is2v2 && w.towers) {
    const teams: TeamId[] = ['red', 'blue'];
    for (const team of teams) {
      // Tower 0: Rooster
      if (w.towers[team][0]) {
        const rooster = w.blocks.find(
          (b) => b.team === team && b.towerIndex === 0 && b.part === 'mascot',
        );
        if (
          rooster &&
          (rooster.y < 2.5 ||
            Math.hypot(rooster.x - rooster.homeX, rooster.z - rooster.homeZ) >
              1.8)
        ) {
          w.towers[team][0] = false;
          emit(
            w,
            'topple',
            `${team === 'red' ? 'Red' : 'Blue'} team's Golden Rooster was toppled! 🐓`,
          );
        }
      }
      // Tower 1: Banner & Keep
      if (w.towers[team][1]) {
        const flag = w.blocks.find(
          (b) => b.team === team && b.towerIndex === 1 && b.part === 'banner',
        );
        if (
          flag &&
          (flag.y < 3.2 ||
            Math.hypot(flag.x - flag.homeX, flag.z - flag.homeZ) > 1.8)
        ) {
          w.towers[team][1] = false;
          emit(
            w,
            'topple',
            `${team === 'red' ? 'Red' : 'Blue'} team's Royal Keep crashed down! 👑`,
          );
        }
      }
      // Tower 2: Cheese
      if (w.towers[team][2]) {
        const cheese = w.blocks.find(
          (b) => b.team === team && b.towerIndex === 2 && b.part === 'mascot',
        );
        if (
          cheese &&
          (cheese.y < 2.5 ||
            Math.hypot(cheese.x - cheese.homeX, cheese.z - cheese.homeZ) > 1.8)
        ) {
          w.towers[team][2] = false;
          const cheeseBody = solver.blocks.get(cheese.id);
          if (cheeseBody) {
            const impulseZ = team === 'blue' ? 40 : -40;
            cheeseBody.applyImpulse(
              new Vec3((Math.random() - 0.5) * 30, 15, impulseZ),
              new Vec3(0, 0, 0),
            );
          }
          emit(
            w,
            'topple',
            `${team === 'red' ? 'Red' : 'Blue'} team's Sacred Cheese is loose and rolling! 🧀`,
          );
        }
      }
    }

    // Check rolling cheese knocking down players
    const rollingCheeses = w.blocks.filter(
      (b) => b.mascotKind === 'cheese' && !b.sleeping,
    );
    for (const cheese of rollingCheeses) {
      for (const p of w.players) {
        if (upright(p, w) && Math.hypot(p.x - cheese.x, p.z - cheese.z) < 1.6) {
          knock(w, p, 2000, `${p.name} was steamrolled by the Sacred Cheese!`);
        }
      }
    }

    // Victory check for 2v2
    const redLost = !w.towers.red[0] && !w.towers.red[1] && !w.towers.red[2];
    const blueLost =
      !w.towers.blue[0] && !w.towers.blue[1] && !w.towers.blue[2];
    if (redLost && blueLost) {
      finishClash(w, 'draw');
    } else if (redLost) {
      finishClash(w, 'blue');
    } else if (blueLost) {
      finishClash(w, 'red');
    }
  } else {
    // Classic banner check
    const flag = banner(w);
    if (flag && !w.bannerDown && flag.y < BANNER_DOWN) {
      w.bannerDown = true;
      emit(w, 'banner', 'THE BANNER IS DOWN. The keep is yours.');
      finish(w, true);
    }
  }
}

export function advanceSiege(w: SiegeWorld, now: number) {
  if (!Number.isFinite(now) || now <= w.clock) return;
  if (w.mode === 'clash2v2' && w.players.length > 0) {
    reconcileClashBots(w);
  }
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
  if (w.phase === 'lobby') {
    for (const p of w.players) {
      if (p.bot) p.seen = w.clock;
    }
  }
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
  const baseline = w.mode === 'clash2v2' ? buildClashCastles() : buildCastle();
  w.blocks = baseline
    .filter((b) => !dropped.has(b.id))
    .map((b) => sent.get(b.id) ?? b);
  return w;
}
