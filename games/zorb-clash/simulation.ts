import {
  BALL_RADIUS,
  GOAL_WIDTH,
  MATCH_DURATION,
  PITCH_LENGTH,
  PITCH_WIDTH,
  WINNING_SCORE,
  ZORB_RADIUS,
  idleInput,
  type Ramp,
  type SpringCushion,
  type TeamId,
  type ZorbClashAction,
  type ZorbClashSnapshot,
  type ZorbClashWorld,
  type ZorbPlayer,
} from './types';
import { ZorbClashPhysics, STEP } from './physics';
import { updateBots } from './bots';
import type { ZorbClashAudio } from './audio';

export function createSpringCushions(): SpringCushion[] {
  const cushions: SpringCushion[] = [];
  const halfW = PITCH_WIDTH / 2;
  const halfL = PITCH_LENGTH / 2;
  const goalHalfW = GOAL_WIDTH / 2;

  // West side wall cushions (X = -halfW)
  cushions.push({
    id: 'cushion_west_1',
    side: 'west',
    x: -halfW,
    y: 1.0,
    z: -halfL / 2,
    width: 0.8,
    height: 1.8,
    depth: halfL * 0.9,
    compression: 0,
  });
  cushions.push({
    id: 'cushion_west_2',
    side: 'west',
    x: -halfW,
    y: 1.0,
    z: halfL / 2,
    width: 0.8,
    height: 1.8,
    depth: halfL * 0.9,
    compression: 0,
  });

  // East side wall cushions (X = halfW)
  cushions.push({
    id: 'cushion_east_1',
    side: 'east',
    x: halfW,
    y: 1.0,
    z: -halfL / 2,
    width: 0.8,
    height: 1.8,
    depth: halfL * 0.9,
    compression: 0,
  });
  cushions.push({
    id: 'cushion_east_2',
    side: 'east',
    x: halfW,
    y: 1.0,
    z: halfL / 2,
    width: 0.8,
    height: 1.8,
    depth: halfL * 0.9,
    compression: 0,
  });

  // North end cushions (flanking Blue goal at +halfL)
  const endFlankWidth = halfW - goalHalfW;
  cushions.push({
    id: 'cushion_north_left',
    side: 'north',
    x: -(goalHalfW + endFlankWidth / 2),
    y: 1.0,
    z: halfL,
    width: endFlankWidth,
    height: 1.8,
    depth: 0.8,
    compression: 0,
  });
  cushions.push({
    id: 'cushion_north_right',
    side: 'north',
    x: goalHalfW + endFlankWidth / 2,
    y: 1.0,
    z: halfL,
    width: endFlankWidth,
    height: 1.8,
    depth: 0.8,
    compression: 0,
  });

  // South end cushions (flanking Red goal at -halfL)
  cushions.push({
    id: 'cushion_south_left',
    side: 'south',
    x: -(goalHalfW + endFlankWidth / 2),
    y: 1.0,
    z: -halfL,
    width: endFlankWidth,
    height: 1.8,
    depth: 0.8,
    compression: 0,
  });
  cushions.push({
    id: 'cushion_south_right',
    side: 'south',
    x: goalHalfW + endFlankWidth / 2,
    y: 1.0,
    z: -halfL,
    width: endFlankWidth,
    height: 1.8,
    depth: 0.8,
    compression: 0,
  });

  return cushions;
}

export function createTiltRamps(): Ramp[] {
  return [
    {
      id: 'ramp_west',
      x: -11,
      y: 0.2,
      z: 0,
      width: 4.5,
      length: 6.0,
      height: 1.2,
      rotation: 0,
    },
    {
      id: 'ramp_east',
      x: 11,
      y: 0.2,
      z: 0,
      width: 4.5,
      length: 6.0,
      height: 1.2,
      rotation: Math.PI,
    },
  ];
}

export function freshZorbWorld(now: number): ZorbClashWorld {
  return {
    clock: 0,
    started: now,
    phase: 'playing',
    timeRemaining: MATCH_DURATION,
    status: 'playing',
    celebrationTimer: 0,
    score: { red: 0, blue: 0 },
    players: [],
    ball: {
      x: 0,
      y: BALL_RADIUS + 0.5,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      lastTouchTeam: null,
      lastTouchPlayerId: null,
    },
    cushions: createSpringCushions(),
    ramps: createTiltRamps(),
    lastGoal: null,
    bonkCount: 0,
  };
}

export function newZorbPlayer(
  id: string,
  name: string,
  color: number,
  team: TeamId,
  bot = false,
): ZorbPlayer {
  const isRed = team === 'red';
  return {
    id,
    name,
    color,
    team,
    bot,
    x: isRed ? -4 : 4,
    y: ZORB_RADIUS + 0.2,
    z: isRed ? -12 : 12,
    vx: 0,
    vy: 0,
    vz: 0,
    qx: 0,
    qy: isRed ? 0 : 1,
    qz: 0,
    qw: isRed ? 1 : 0,
    dashCharge: 0,
    dashing: 0,
    braced: false,
    turtle: false,
    turtleTimer: 0,
    wiggleProgress: 0,
    bonks: 0,
    goals: 0,
    input: idleInput(),
    seen: 0,
  };
}

const physicsCache = new WeakMap<ZorbClashWorld, ZorbClashPhysics>();

export function getOrCreatePhysics(w: ZorbClashWorld): ZorbClashPhysics {
  let physics = physicsCache.get(w);
  if (!physics) {
    physics = new ZorbClashPhysics(w);
    physicsCache.set(w, physics);
  } else {
    physics.syncPlayers(w.players);
  }
  return physics;
}

export function advanceZorbClashWorld(w: ZorbClashWorld, now: number) {
  const lastTime = w.clock > 0 ? w.clock : now / 1000;
  const currentTime = now / 1000;
  const dt = Math.min(Math.max(currentTime - lastTime, STEP), 0.1);
  const physics = getOrCreatePhysics(w);
  advanceZorbClash(w, physics, dt);
}

export function advanceZorbClash(
  world: ZorbClashWorld,
  physics: ZorbClashPhysics,
  dt: number,
  audio?: ZorbClashAudio | null,
  onImpact?: (x: number, y: number, z: number, intensity: number) => void,
  onGoal?: (x: number, y: number, z: number) => void,
) {
  world.clock += dt;

  // Handle Goal Celebration Freeze
  if (world.status === 'goal_scored') {
    world.celebrationTimer -= dt;
    if (world.celebrationTimer <= 0) {
      physics.resetBall();
      physics.resetPlayers();
      world.status = 'playing';
      audio?.whistle();
    }
    return;
  }

  if (world.status === 'ended') {
    return;
  }

  // Update Match Timer
  world.timeRemaining = Math.max(0, world.timeRemaining - dt);
  if (world.timeRemaining <= 0) {
    world.status = 'ended';
    audio?.whistle();
    return;
  }

  // AI Bots updates
  updateBots(world, world.clock);

  // Physics Step
  physics.step(dt);

  // Process Collision Audio & Events
  for (const impact of physics.impacts) {
    if (impact.type === 'zorb_zorb') {
      world.bonkCount++;
      audio?.bonk(impact.intensity);
      onImpact?.(impact.x, impact.y, impact.z, impact.intensity);

      // Add bonk score to player
      if (impact.playerA) {
        const p = world.players.find((pl) => pl.id === impact.playerA);
        if (p) p.bonks++;
      }
    } else if (impact.type === 'cushion') {
      audio?.springCushion();
    } else if (impact.type === 'zorb_ball') {
      audio?.bonk(0.4);
      if (impact.playerA) {
        const p = world.players.find((pl) => pl.id === impact.playerA);
        if (p) {
          world.ball.lastTouchTeam = p.team;
          world.ball.lastTouchPlayerId = p.id;
        }
      }
    }
  }

  // Goal Detection
  const goalResult = physics.checkGoal();
  if (goalResult && goalResult.scored) {
    world.status = 'goal_scored';
    world.celebrationTimer = 3.2;

    const scoringTeam = goalResult.team;
    world.score[scoringTeam]++;

    let scorerName = `${scoringTeam.toUpperCase()} TEAM`;
    let scorerId: string | null = null;

    if (world.ball.lastTouchPlayerId) {
      const p = world.players.find(
        (pl) => pl.id === world.ball.lastTouchPlayerId,
      );
      if (p) {
        scorerName = p.name;
        scorerId = p.id;
        p.goals++;
      }
    }

    world.lastGoal = {
      team: scoringTeam,
      scorerId,
      scorerName,
      isTurtleGoal: goalResult.isTurtleGoal,
      clock: world.clock,
    };

    audio?.goal(goalResult.isTurtleGoal);
    onGoal?.(world.ball.x, world.ball.y + 1, world.ball.z);

    // Check Match Point
    if (world.score[scoringTeam] >= WINNING_SCORE || world.timeRemaining <= 0) {
      world.status = 'ended';
    }
  }
}

export function zorbClashAction(
  world: ZorbClashWorld,
  playerId: string,
  action: ZorbClashAction,
  isHost: boolean,
) {
  const player = world.players.find((p) => p.id === playerId);
  if (!player) return;

  if (action.type === 'input') {
    player.input = action.input;
    player.seen = world.clock;
  } else if (action.type === 'switch_team') {
    player.team = player.team === 'red' ? 'blue' : 'red';
  } else if (action.type === 'reset' && isHost) {
    world.score = { red: 0, blue: 0 };
    world.timeRemaining = MATCH_DURATION;
    world.status = 'playing';
    world.lastGoal = null;
    world.bonkCount = 0;
  }
}

export function zorbClashSnapshot(
  world: ZorbClashWorld,
  code: string,
  host: string,
  selfId: string,
  version: number,
): ZorbClashSnapshot {
  return {
    code,
    host,
    version,
    clock: world.clock,
    world,
    selfId,
  };
}
