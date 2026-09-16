import { computeEndScore, stepCurlingPhysics } from './physics';
import {
  HACK_Z,
  RINK_WIDTH,
  STONE_CONFIGS,
  TEE_Z,
  type CurlingPlayer,
  type IceTile,
  type PanicCurlingAction,
  type PanicCurlingSnapshot,
  type PanicCurlingWorld,
  type Role,
  type Stone,
  type StoneKind,
  type TeamId,
  idleInput,
} from './types';

export function createIceGrid(): IceTile[] {
  const tiles: IceTile[] = [];
  const startZ = 4.0;
  const endZ = 32.0;
  const tileWidth = 1.6;
  const tileDepth = 2.8;

  let id = 0;
  for (let z = startZ; z < endZ; z += tileDepth) {
    for (
      let x = -RINK_WIDTH / 2 + 0.8;
      x < RINK_WIDTH / 2 - 0.4;
      x += tileWidth
    ) {
      tiles.push({
        id: `ice-${id++}`,
        x: Number(x.toFixed(2)),
        z: Number(z.toFixed(2)),
        w: tileWidth,
        d: tileDepth,
        health: 1.0,
        stress: 0,
        cracked: false,
        broken: false,
      });
    }
  }
  return tiles;
}

export function newCurlingPlayer(
  id: string,
  name: string,
  color: number,
  team: TeamId,
  role: Role,
  bot: boolean,
): CurlingPlayer {
  const spawnX = team === 'red' ? -1.0 : 1.0;
  const spawnZ = role === 'deliverer' ? HACK_Z : 2.0;

  return {
    id,
    name,
    color,
    team,
    role,
    bot,
    x: spawnX,
    y: 0,
    z: spawnZ,
    vx: 0,
    vz: 0,
    rotation: 0,
    status: 'normal',
    statusTimer: 0,
    gadget: 'broom',
    bananasLeft: 2,
    sweepIntensity: 0,
    steerDir: 0,
    seen: Date.now(),
    input: idleInput(),
  };
}

export function freshCurlingWorld(now: number): PanicCurlingWorld {
  return {
    clock: now,
    phase: 'warmup',
    phaseTimer: 0,
    round: 1,
    maxRounds: 3,
    throwIndex: 0,
    totalThrowsPerEnd: 6, // 3 stones per team per end for fast-paced action
    turnTeam: 'red',
    hammerTeam: 'blue',
    scores: { red: 0, blue: 0 },
    endScores: [],
    players: [],
    stones: [],
    activeStoneId: null,
    iceTiles: createIceGrid(),
    hazards: [],
    events: [],
    started: now,
  };
}

/** Delivers a stone down the ice track with aim, power, and spin. */
export function launchDelivery(
  world: PanicCurlingWorld,
  power: number,
  angle: number,
  spin: number,
  kind: StoneKind,
): Stone {
  const cfg = STONE_CONFIGS[kind];
  // Speed tuned so 0.5 power travels roughly to the house, 1.0 shoots out back
  const launchSpeed = 3.2 + power * 5.4;
  const vx = Math.sin(angle) * launchSpeed;
  const vz = Math.cos(angle) * launchSpeed;

  const stone: Stone = {
    id: `stone-${world.round}-${world.throwIndex}-${Date.now()}`,
    kind,
    team: world.turnTeam,
    x: 0,
    y: cfg.height / 2,
    z: HACK_Z + 0.8,
    vx,
    vz,
    spin: spin * 2.8, // angular velocity
    rotation: 0,
    active: true,
    stopped: false,
    inPlay: true,
    outOfBounds: false,
    distanceToTee: Math.hypot(0, HACK_Z - TEE_Z),
  };

  world.stones.push(stone);
  world.activeStoneId = stone.id;
  world.phase = 'sliding';
  world.phaseTimer = 0;

  // 1. Deliverer slides forward with the stone towards the hog line
  const deliverer = world.players.find(
    (p) => p.team === world.turnTeam && p.role === 'deliverer',
  );
  if (deliverer) {
    deliverer.status = 'sliding';
    deliverer.x = 0;
    deliverer.z = HACK_Z;
    deliverer.vx = vx * 0.95;
    deliverer.vz = vz * 0.95;
    deliverer.rotation = angle;
  }

  // 2. Position the active sweeper directly in front of the stone to escort it
  const sweeper = world.players.find(
    (p) => p.team === world.turnTeam && p.role === 'sweeper',
  );
  if (sweeper) {
    sweeper.status = 'normal';
    sweeper.x = stone.x + 0.45;
    sweeper.z = stone.z + 1.2;
    sweeper.vx = vx;
    sweeper.vz = vz;
    sweeper.rotation = 0;
  }

  world.events.push({
    type: 'stone_delivered',
    stoneId: stone.id,
    speed: launchSpeed,
  });

  return stone;
}

/** Advances the simulation state by a fixed timestep. */
export function advancePanicCurling(world: PanicCurlingWorld, now: number) {
  const dt = Math.min(0.1, Math.max(0.001, (now - world.clock) / 1000));
  world.clock = now;
  world.phaseTimer += dt;
  world.events = [];

  // Update players input to state
  for (const p of world.players) {
    if (p.status !== 'slipping' && p.status !== 'sliding') {
      p.sweepIntensity = p.input.sweep ? 1.0 : 0;
      p.steerDir = p.input.steer;
      if (p.input.sweep) {
        p.status = 'sweeping';
      } else if (p.status === 'sweeping') {
        p.status = 'normal';
      }
    }
  }

  // When stone is sliding, sync human deliverer commands to active sweeper
  if (world.phase === 'sliding') {
    const humanDeliverer = world.players.find(
      (p) => p.team === world.turnTeam && p.role === 'deliverer' && !p.bot,
    );
    const activeSweeper = world.players.find(
      (p) => p.team === world.turnTeam && p.role === 'sweeper',
    );
    if (humanDeliverer && activeSweeper) {
      if (humanDeliverer.input.sweep || humanDeliverer.sweepIntensity > 0) {
        activeSweeper.sweepIntensity = 1.0;
        activeSweeper.status = 'sweeping';
      }
      if (humanDeliverer.steerDir !== 0) {
        activeSweeper.steerDir = humanDeliverer.steerDir;
      }
      activeSweeper.gadget = humanDeliverer.gadget;
    }
  }

  switch (world.phase) {
    case 'warmup': {
      if (world.phaseTimer > 1.2) {
        world.phase = 'aiming';
        world.phaseTimer = 0;
        resetPlayerPositions(world);
      }
      break;
    }

    case 'aiming': {
      // Deliverer aims and charges power
      break;
    }

    case 'delivering': {
      // Short transitional animation
      if (world.phaseTimer > 0.4) {
        world.phase = 'sliding';
        world.phaseTimer = 0;
      }
      break;
    }

    case 'sliding': {
      // Physics step
      stepCurlingPhysics(
        world.stones,
        world.players,
        world.iceTiles,
        world.hazards,
        dt,
        world.events,
      );

      // Check if all stones are at rest
      const activeStone = world.stones.find(
        (s) => s.id === world.activeStoneId,
      );
      const allStopped =
        (!activeStone || activeStone.stopped || activeStone.outOfBounds) &&
        world.stones.every((s) => s.stopped || s.outOfBounds);

      // Timeout safety: if sliding takes longer than 15s, stop all stones
      const timeout = world.phaseTimer > 15.0;

      if (allStopped || timeout) {
        if (activeStone) {
          activeStone.active = false;
        }
        for (const s of world.stones) {
          s.vx = 0;
          s.vz = 0;
          s.stopped = true;
          s.distanceToTee = Math.hypot(s.x, s.z - TEE_Z);
        }

        world.throwIndex++;

        if (world.throwIndex >= world.totalThrowsPerEnd) {
          // End of this round! Score calculation
          const endResult = computeEndScore(world.stones);
          world.scores.red += endResult.red;
          world.scores.blue += endResult.blue;
          world.endScores.push({ red: endResult.red, blue: endResult.blue });

          world.events.push({
            type: 'end_scored',
            redPoints: endResult.red,
            bluePoints: endResult.blue,
          });

          world.phase = 'end_summary';
          world.phaseTimer = 0;
        } else {
          // Next throw in current end
          world.turnTeam = world.turnTeam === 'red' ? 'blue' : 'red';
          world.phase = 'aiming';
          world.phaseTimer = 0;
          world.activeStoneId = null;
          resetPlayerPositions(world);
        }
      }
      break;
    }

    case 'end_summary': {
      if (world.phaseTimer > 3.8) {
        if (world.round >= world.maxRounds) {
          world.phase = 'match_over';
          world.phaseTimer = 0;
        } else {
          // Start next end
          world.round++;
          world.throwIndex = 0;
          world.stones = [];
          world.hazards = [];
          world.activeStoneId = null;
          world.iceTiles = createIceGrid(); // Fresh pristine ice sheet
          // Hammer goes to team that did NOT score, or alternates
          world.turnTeam = world.round % 2 === 1 ? 'red' : 'blue';
          world.phase = 'aiming';
          world.phaseTimer = 0;
          resetPlayerPositions(world);
        }
      }
      break;
    }

    case 'match_over': {
      break;
    }
  }
}

function resetPlayerPositions(world: PanicCurlingWorld) {
  for (const p of world.players) {
    p.status = 'normal';
    p.statusTimer = 0;
    p.vx = 0;
    p.vz = 0;

    if (p.team === world.turnTeam && p.role === 'deliverer') {
      p.x = 0;
      p.z = HACK_Z;
      p.rotation = 0;
    } else if (p.role === 'sweeper') {
      // Sweepers wait ready near delivery hack to escort rock
      p.x = p.team === 'red' ? -0.7 : 0.7;
      p.z = HACK_Z + 1.5;
      p.rotation = 0;
    } else {
      // Defenders wait near center ice
      p.x = p.team === 'red' ? -1.8 : 1.8;
      p.z = 14.0 + Math.random() * 2.0;
      p.rotation = Math.PI;
    }
  }
}

/** Handles game actions from players or host. */
export function panicCurlingAction(
  world: PanicCurlingWorld,
  playerId: string,
  action: PanicCurlingAction,
  isHost: boolean,
) {
  const player = world.players.find((p) => p.id === playerId);

  switch (action.type) {
    case 'start': {
      if (isHost && world.phase === 'warmup') {
        world.phase = 'aiming';
        world.phaseTimer = 0;
        resetPlayerPositions(world);
      }
      break;
    }

    case 'restart': {
      if (isHost) {
        const players = world.players;
        Object.assign(world, freshCurlingWorld(world.clock));
        world.players = players;
        world.phase = 'aiming';
        resetPlayerPositions(world);
      }
      break;
    }

    case 'switchTeam': {
      if (player) {
        player.team = action.team;
        resetPlayerPositions(world);
      }
      break;
    }

    case 'switchRole': {
      if (player) {
        player.role = action.role;
        resetPlayerPositions(world);
      }
      break;
    }

    case 'switchGadget': {
      if (player) {
        player.gadget = action.gadget;
      }
      break;
    }

    case 'switchStone': {
      if (player) {
        player.input.stoneKind = action.kind;
      }
      break;
    }

    case 'deliver': {
      if (world.phase === 'aiming') {
        // Can be delivered by active deliverer or host
        if (
          isHost ||
          (player &&
            player.team === world.turnTeam &&
            player.role === 'deliverer')
        ) {
          launchDelivery(
            world,
            action.power,
            action.angle,
            action.spin,
            action.kind,
          );
        }
      }
      break;
    }

    case 'throwBanana': {
      if (player && player.bananasLeft > 0) {
        player.bananasLeft--;
        // Spawn banana slightly ahead of player
        const bx = player.x + Math.sin(player.rotation) * 1.2;
        const bz = player.z + Math.cos(player.rotation) * 1.2;
        world.hazards.push({
          id: `banana-${Date.now()}-${Math.random()}`,
          x: Math.max(
            -RINK_WIDTH / 2 + 0.5,
            Math.min(RINK_WIDTH / 2 - 0.5, bx),
          ),
          z: Math.max(0, Math.min(35, bz)),
          active: true,
          team: player.team,
        });
      }
      break;
    }

    case 'rescue': {
      // No-op: ice sheet is solid and curlers do not freeze or fall into holes
      break;
    }
  }
}

export function panicCurlingSnapshot(
  world: PanicCurlingWorld,
  code: string,
  host: string,
  _forPlayerId: string,
  version: number,
): PanicCurlingSnapshot {
  return {
    code,
    host,
    version,
    world,
  };
}
