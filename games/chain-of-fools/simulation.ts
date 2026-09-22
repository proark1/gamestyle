import {
  ANCHORS,
  CHECKPOINTS,
  FINISH_X,
  COURSE_END_X,
  PENDULUM,
  checkpoint,
  checkpointAt,
  nearNet,
  pendulumBall,
  courseSolids,
} from './course';
import {
  HARD_LANDING_SPEED,
  haulToward,
  pushOutOfGeometry,
  stepChain,
  stepPendulum,
  stepPlank,
  stepPlayer,
  stepMachinery,
} from './physics';
import {
  BRACE_COOLDOWN,
  BRACE_STAMINA_DRAIN,
  BRACE_STAMINA_MAX,
  BRACE_STAMINA_RECOVER,
  CLIP_REACH,
  CREW_SIZE,
  HAUL_RATE,
  HAUL_REACH,
  DANGLE_AIR_TIME,
  DANGLE_DROP,
  LIMP_SECONDS,
  NO_SUPPORT,
  PLAYER_HEIGHT,
  RESPAWN_MS,
  REVIVE_REACH,
  REVIVE_SECONDS,
  ROUND_TIME_MS,
  WIPE_Y,
  chainOrder,
  clamp,
  idleInput,
  type ChainAction,
  type ChainSnapshot,
  type ChainWorld,
  type GameEvent,
  type Player,
} from './types';

/** Line-order spacing when the crew is set down, well inside the slack. */
const SPAWN_SPREAD = 0.9;
/** How long the whole crew has to be over nothing before the run resets. */
const WIPE_DELAY = 1.1;
const MAX_SUBSTEP = 1 / 60;

export function newPlayer(
  id: string,
  name: string,
  color: number,
  link: number,
  bot: boolean,
): Player {
  const spawn = checkpoint(0).spawn;
  return {
    id,
    name,
    color,
    bot,
    link,
    x: spawn[0] + (1.5 - link) * SPAWN_SPREAD,
    y: spawn[1],
    z: spawn[2],
    vx: 0,
    vy: 0,
    vz: 0,
    facing: 0,
    state: 'standing',
    grounded: true,
    braced: false,
    stamina: BRACE_STAMINA_MAX,
    braceCooldown: 0,
    airTime: 0,
    jumpGrace: 0,
    anchorId: null,
    supportY: spawn[1],
    haulProgress: 0,
    limpTimer: 0,
    reviveProgress: 0,
    respawnAt: 0,
    checkpoint: 0,
    falls: 0,
    hauls: 0,
    braceTime: 0,
    input: idleInput(),
    seen: 0,
  };
}

export function freshChainWorld(now: number, seed = 7): ChainWorld {
  return {
    seed,
    clock: now,
    started: now,
    phase: 'lobby',
    startedAt: 0,
    endsAt: 0,
    endedAt: 0,
    winner: null,
    players: [],
    links: [],
    checkpoint: 0,
    pendulumAngle: PENDULUM.amplitude,
    pendulumVel: 0,
    pendulumRider: null,
    plankTilt: 0,
    plankVel: 0,
    hangTime: 0,
    wipes: 0,
    bestX: 0,
    events: [],
    eventId: 0,
  };
}

/** Put the whole crew back on the last banked checkpoint, still roped up. */
export function placeAtCheckpoint(world: ChainWorld, index: number) {
  const point = checkpoint(index);
  for (const player of chainOrder(world)) {
    player.x = point.spawn[0] + (1.5 - player.link) * SPAWN_SPREAD;
    player.y = point.spawn[1];
    player.z = point.spawn[2] + (player.link % 2 === 0 ? 0.3 : -0.3);
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.grounded = true;
    player.braced = false;
    player.checkpoint = point.index;
    player.input = idleInput();
    player.state = 'standing';
    player.anchorId = null;
    player.haulProgress = 0;
    player.reviveProgress = 0;
    player.limpTimer = 0;
    player.stamina = BRACE_STAMINA_MAX;
    player.braceCooldown = 0;
    player.airTime = 0;
    player.jumpGrace = 0;
    player.supportY = point.spawn[1];
    player.respawnAt = world.clock + RESPAWN_MS;
  }
  world.pendulumRider = null;
  world.plankTilt = 0;
  world.plankVel = 0;
  world.hangTime = 0;
}

export function chainOfFoolsAction(
  world: ChainWorld,
  id: string,
  action: ChainAction,
) {
  const player = world.players.find((p) => p.id === id);
  const eventIdRef = { current: world.eventId };

  switch (action.type) {
    case 'start': {
      if (world.phase === 'playing') break;
      world.endedAt = 0;
      world.pendulumAngle = PENDULUM.amplitude;
      world.pendulumVel = 0;
      world.phase = 'playing';
      world.startedAt = world.clock;
      world.endsAt = world.clock + ROUND_TIME_MS;
      world.winner = null;
      world.checkpoint = 0;
      world.wipes = 0;
      world.bestX = 0;
      placeAtCheckpoint(world, 0);
      for (const p of world.players) {
        p.falls = 0;
        p.hauls = 0;
        p.braceTime = 0;
        p.respawnAt = 0;
      }
      break;
    }

    case 'restart': {
      world.endedAt = 0;
      world.phase = 'playing';
      world.startedAt = world.clock;
      world.endsAt = world.clock + ROUND_TIME_MS;
      world.winner = null;
      world.checkpoint = 0;
      world.wipes = 0;
      world.bestX = 0;
      world.pendulumAngle = PENDULUM.amplitude;
      world.pendulumVel = 0;
      placeAtCheckpoint(world, 0);
      for (const p of world.players) {
        p.falls = 0;
        p.hauls = 0;
        p.braceTime = 0;
        p.respawnAt = 0;
      }
      break;
    }

    case 'jump': {
      if (player && player.grounded && player.state === 'standing') {
        player.input.jump = true;
      }
      break;
    }

    case 'clip': {
      if (
        world.phase !== 'playing' ||
        !player ||
        player.state === 'limp' ||
        player.state === 'finished'
      )
        break;

      if (player.anchorId) {
        player.anchorId = null;
        world.events.push({
          id: ++eventIdRef.current,
          type: 'unclip',
          playerId: player.id,
          detail: `${player.name} unclipped the line`,
        });
        break;
      }

      if (world.pendulumRider === player.id) {
        world.pendulumRider = null;
        break;
      }

      // The wrecking load's hook counts as something to hang off.
      const [bx, by, bz] = pendulumBall(world.pendulumAngle);
      const toBall = Math.hypot(
        player.x - bx,
        player.y + PLAYER_HEIGHT * 0.6 - by,
        player.z - bz,
      );
      if (
        !world.pendulumRider &&
        toBall <= PENDULUM.hookReach + PENDULUM.ballRadius
      ) {
        world.pendulumRider = player.id;
        world.events.push({
          id: ++eventIdRef.current,
          type: 'clip',
          playerId: player.id,
          detail: `${player.name} grabbed the wrecking hook`,
        });
        break;
      }

      let nearest: string | null = null;
      let best = CLIP_REACH;
      for (const anchor of ANCHORS) {
        const distance = Math.hypot(
          player.x - anchor.x,
          player.y - anchor.y,
          player.z - anchor.z,
        );
        if (distance < best) {
          best = distance;
          nearest = anchor.id;
        }
      }
      if (nearest) {
        player.anchorId = nearest;
        player.vx = 0;
        player.vy = 0;
        player.vz = 0;
        world.events.push({
          id: ++eventIdRef.current,
          type: 'clip',
          playerId: player.id,
          detail: `${player.name} clipped onto a ring`,
        });
      }
      break;
    }

    case 'ping': {
      if (player) {
        world.events.push({
          id: ++eventIdRef.current,
          type: 'brace',
          playerId: player.id,
          detail: `${player.name} called the crew over`,
        });
      }
      break;
    }
  }

  world.eventId = eventIdRef.current;
}

export function advanceChainOfFools(
  world: ChainWorld,
  now: number,
  dtParam?: number,
) {
  const elapsed =
    dtParam ??
    clamp((now - (world.clock || now)) / 1000 || 1 / 60, 0.001, 0.05);
  world.clock = now;

  if (world.events.length > 60) world.events = world.events.slice(-36);
  const eventIdRef = { current: world.eventId };

  if (world.phase !== 'playing') {
    world.eventId = eventIdRef.current;
    return;
  }

  let remaining = clamp(elapsed, 0.001, 0.1);
  world.clock = now - remaining * 1000;
  while (remaining > 0 && world.phase === 'playing') {
    const dt = Math.min(MAX_SUBSTEP, remaining);
    remaining -= dt;
    world.clock += dt * 1000;
    stepWorld(world, dt, eventIdRef);
  }
  world.clock = now;

  if (world.phase === 'playing' && world.clock >= world.endsAt) {
    world.phase = 'ended';
    world.endedAt = world.clock;
    world.winner = 'failed';
    world.events.push({
      id: ++eventIdRef.current,
      type: 'timeout',
      detail: 'The shift horn went before the crew reached the office',
    });
  }

  world.eventId = eventIdRef.current;
}

function stepWorld(
  world: ChainWorld,
  dt: number,
  eventIdRef: { current: number },
) {
  const events = world.events;
  const solids = courseSolids(world);

  stepMachinery(world, dt);
  stepPlank(world, dt, events, eventIdRef);
  stepPendulum(world, dt, events, eventIdRef);

  for (const player of world.players) {
    if (player.state === 'finished') continue;
    if (player.id === world.pendulumRider) continue;
    if (player.respawnAt > world.clock) player.input = idleInput();

    const wasGrounded = player.grounded;
    const wantsBrace =
      player.input.brace && player.grounded && player.state === 'standing';

    if (player.braceCooldown > 0) {
      player.braceCooldown = Math.max(0, player.braceCooldown - dt);
      player.braced = false;
    } else {
      player.braced = wantsBrace;
    }

    if (player.braced) {
      player.stamina = Math.max(0, player.stamina - BRACE_STAMINA_DRAIN * dt);
      player.braceTime += dt;
      if (player.stamina <= 0) {
        // Arms give out, and they stay given out for a beat.
        player.braced = false;
        player.braceCooldown = BRACE_COOLDOWN;
      }
    } else {
      player.stamina = Math.min(
        BRACE_STAMINA_MAX,
        player.stamina + BRACE_STAMINA_RECOVER * dt,
      );
    }

    const result = stepPlayer(player, dt, world.plankTilt, solids);
    player.airTime = player.grounded ? 0 : player.airTime + dt;

    if (result.jumped) {
      events.push({
        id: ++eventIdRef.current,
        type: 'jump',
        playerId: player.id,
        pos: [player.x, player.y, player.z],
      });
    }

    if (result.landed && !wasGrounded) {
      if (result.impact > HARD_LANDING_SPEED && player.state !== 'limp') {
        player.state = 'limp';
        player.limpTimer = LIMP_SECONDS;
        player.reviveProgress = 0;
        events.push({
          id: ++eventIdRef.current,
          type: 'limp',
          playerId: player.id,
          detail: `${player.name} came down hard and is dead weight`,
          pos: [player.x, player.y, player.z],
        });
      } else {
        events.push({
          id: ++eventIdRef.current,
          type: 'land',
          playerId: player.id,
          pos: [player.x, player.y, player.z],
        });
      }
    }
  }

  world.links = stepChain(world, dt, events, eventIdRef);

  for (const player of world.players) {
    if (player.state === 'finished') continue;
    pushOutOfGeometry(player, world.plankTilt, solids);
  }

  resolveStates(world, dt, eventIdRef);
  resolveHelp(world, dt, eventIdRef);
  resolveProgress(world, dt, eventIdRef);
}

function resolveStates(
  world: ChainWorld,
  dt: number,
  eventIdRef: { current: number },
) {
  for (const player of world.players) {
    if (player.state === 'finished') continue;

    if (player.state === 'limp') {
      player.limpTimer = Math.max(0, player.limpTimer - dt);
      if (player.limpTimer <= 0) {
        player.state = player.grounded ? 'standing' : 'airborne';
        player.reviveProgress = 0;
      }
      continue;
    }

    // A worker being hauled stays on the line until the pull finishes or lapses.
    if (player.state === 'dangling' && player.haulProgress > 0) continue;

    if (player.grounded) {
      player.state = 'standing';
      player.haulProgress = 0;
      continue;
    }

    // Hands on the cargo net is climbing, however far the ground is.
    if (nearNet(player.x, player.y, player.z)) {
      player.state = 'airborne';
      player.haulProgress = 0;
      continue;
    }

    // Hanging on the line means nothing within reach underneath, not merely
    // being off the ground: a jump over a girder gap is not a fall.
    const nothingBelow =
      player.supportY <= NO_SUPPORT + 1 ||
      player.y - player.supportY > DANGLE_DROP;
    const hanging =
      player.airTime > DANGLE_AIR_TIME && player.jumpGrace <= 0 && nothingBelow;

    if (hanging) {
      if (player.state !== 'dangling') {
        player.state = 'dangling';
        player.falls++;
        world.events.push({
          id: ++eventIdRef.current,
          type: 'dangle',
          playerId: player.id,
          detail: `${player.name} went over and is hanging on the line`,
          pos: [player.x, player.y, player.z],
        });
      }
    } else {
      player.state = 'airborne';
      player.haulProgress = 0;
    }
  }
}

/** Hauling a dangling mate back up, and getting a limp one on their feet. */
function resolveHelp(
  world: ChainWorld,
  dt: number,
  eventIdRef: { current: number },
) {
  const helpers = world.players.filter(
    (p) =>
      p.input.haul &&
      p.grounded &&
      (p.state === 'standing' || p.anchorId !== null),
  );

  for (const target of world.players) {
    if (target.state === 'dangling') {
      // A haul already under way keeps its grip while the worker is reeled in.
      const reach = target.haulProgress > 0 ? HAUL_REACH * 1.6 : HAUL_REACH;
      const pulling = helpers.filter(
        (h) =>
          h.id !== target.id &&
          Math.hypot(h.x - target.x, h.z - target.z) <= reach,
      );
      if (pulling.length === 0) {
        target.haulProgress = Math.max(0, target.haulProgress - dt * 0.25);
        continue;
      }

      if (target.haulProgress === 0) {
        world.events.push({
          id: ++eventIdRef.current,
          type: 'haul_start',
          playerId: target.id,
          detail: `The crew started hauling ${target.name} up`,
        });
      }

      // The dangler helps by kicking off the wall.
      const kick = target.input.jump ? 0.45 : 0;
      target.haulProgress += (HAUL_RATE * pulling.length + kick) * dt;

      const lead = pulling[0];
      haulToward(target, lead, dt, world.plankTilt, courseSolids(world));

      if (target.haulProgress >= 1 && target.grounded) {
        target.haulProgress = 0;
        target.state = 'standing';
        target.grounded = true;
        target.vx = 0;
        target.vy = 0;
        target.vz = 0;
        for (const hauler of pulling) hauler.hauls++;
        world.events.push({
          id: ++eventIdRef.current,
          type: 'haul_done',
          playerId: target.id,
          detail: `${target.name} is back on the deck`,
          pos: [target.x, target.y, target.z],
        });
      }
      continue;
    }

    if (target.state === 'limp') {
      const reviving = helpers.filter(
        (h) =>
          h.id !== target.id &&
          Math.hypot(h.x - target.x, h.y - target.y, h.z - target.z) <=
            REVIVE_REACH,
      );
      if (reviving.length === 0) {
        target.reviveProgress = Math.max(0, target.reviveProgress - dt * 0.4);
        continue;
      }
      target.reviveProgress += (dt * reviving.length) / REVIVE_SECONDS;
      if (target.reviveProgress >= 1) {
        target.reviveProgress = 0;
        target.limpTimer = 0;
        target.state = target.grounded ? 'standing' : 'airborne';
        for (const hauler of reviving) hauler.hauls++;
        world.events.push({
          id: ++eventIdRef.current,
          type: 'revive',
          playerId: target.id,
          detail: `${target.name} was pulled back onto their feet`,
          pos: [target.x, target.y, target.z],
        });
      }
    }
  }
}

/** Checkpoints, the whole-crew wipe, and reaching the office. */
function resolveProgress(
  world: ChainWorld,
  dt: number,
  eventIdRef: { current: number },
) {
  const running = world.players.filter((p) => p.state !== 'finished');

  for (const player of world.players) {
    if (player.state === 'finished') continue;
    if (
      player.x >= FINISH_X &&
      player.x <= COURSE_END_X &&
      Math.abs(player.z) <= 8 &&
      player.grounded &&
      Math.abs(player.y) < 0.08
    ) {
      player.state = 'finished';
      player.vx = player.vy = player.vz = 0;
      player.anchorId = null;
      world.events.push({
        id: ++eventIdRef.current,
        type: 'checkpoint',
        playerId: player.id,
        detail: `${player.name} made it to the site office`,
      });
    }
  }

  world.bestX = Math.max(world.bestX, ...world.players.map((p) => p.x));

  if (running.length > 0) {
    const trailing = Math.min(...running.map((p) => p.x));
    const banked = checkpointAt(trailing);
    if (banked > world.checkpoint) {
      world.checkpoint = banked;
      for (const player of world.players) player.checkpoint = banked;
      world.events.push({
        id: ++eventIdRef.current,
        type: 'checkpoint',
        detail: `Crew reached ${CHECKPOINTS[banked].label}`,
      });
    }
  }

  const alive = world.players.filter(
    (p) => p.state !== 'finished' && p.respawnAt <= world.clock,
  );
  const allOverNothing =
    alive.length > 0 &&
    alive.every((p) => p.state === 'dangling' && !p.anchorId) &&
    !world.players.some(
      (p) =>
        p.state === 'finished' || p.anchorId || p.id === world.pendulumRider,
    );
  const anyLost = world.players.some((p) => p.y < WIPE_Y);

  world.hangTime = allOverNothing ? world.hangTime + dt : 0;

  if (anyLost || world.hangTime >= WIPE_DELAY) {
    world.wipes++;
    world.hangTime = 0;
    world.checkpoint = 0;
    world.startedAt = world.clock;
    world.endsAt = world.clock + ROUND_TIME_MS;
    world.endedAt = 0;
    world.pendulumAngle = PENDULUM.amplitude;
    world.pendulumVel = 0;
    world.links = [];
    placeAtCheckpoint(world, 0);
    world.events.push({
      id: ++eventIdRef.current,
      type: 'wipe',
      detail:
        'Crew lost! Back to the site gate. No checkpoints — save each other!',
    });
  }

  if (
    world.players.length > 0 &&
    world.players.every((p) => p.state === 'finished')
  ) {
    world.phase = 'ended';
    world.endedAt = world.clock;
    world.winner = 'crew';
    world.events.push({
      id: ++eventIdRef.current,
      type: 'win',
      detail: 'The whole crew clocked in at the site office',
    });
  }
}

export function chainSnapshot(
  world: ChainWorld,
  code: string,
  host: string,
  me: string,
  version: number,
): ChainSnapshot {
  return { code, host, me, version, world };
}

/** Crew score: distance banked, time left, and a clean-run bonus. */
export function crewScore(world: ChainWorld): number {
  const distance = Math.round(clamp(world.bestX, 0, FINISH_X) * 6);
  const timeBonus =
    world.winner === 'crew'
      ? Math.round(
          Math.max(0, world.endsAt - (world.endedAt || world.clock)) / 100,
        )
      : 0;
  const cleanBonus = world.winner === 'crew' && world.wipes === 0 ? 500 : 0;
  return distance + timeBonus + cleanBonus - world.wipes * 60;
}

export function crewSize(world: ChainWorld): number {
  return Math.min(CREW_SIZE, world.players.length);
}

export type { GameEvent };
