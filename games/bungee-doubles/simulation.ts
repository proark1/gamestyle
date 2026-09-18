import {
  COURT,
  TARGET_SCORE,
  idleInput,
  type Ball,
  type BungeeAction,
  type BungeeSnapshot,
  type BungeeWorld,
  type Player,
  type TeamId,
} from './types';
import {
  calculateRacketShot,
  isInsideCourt,
  stepBallPhysics,
  stepBungeeTether,
} from './physics';

export function freshBall(): Ball {
  return {
    x: 0,
    y: 1.2,
    z: -7.5,
    vx: 0,
    vy: 0,
    vz: 0,
    state: 'serving',
    currentSide: 'red',
    bouncesOnCurrentSide: 0,
    lastHitBy: null,
    lastHitTeam: 'red',
    hitCountOnSide: 0,
    isSmash: false,
    speedTrail: false,
    spinX: 0,
    spinZ: 0,
    wallHitsOnCurrentSide: 0,
  };
}

export function newPlayer(
  id: string,
  name: string,
  color: number,
  team: TeamId,
  bot = false,
  slot = 0,
): Player {
  // Spawn positions on court
  // slot 0: front-court, slot 1: back-court
  const isRed = team === 'red';
  const startX = slot === 0 ? (isRed ? -2.2 : 2.2) : isRed ? 2.0 : -2.0;
  const startZ = slot === 0 ? (isRed ? -3.5 : 3.5) : isRed ? -7.5 : 7.5;
  const facing = isRed ? 0 : Math.PI; // Red faces +Z (towards net), Blue faces -Z

  return {
    id,
    name: name.slice(0, 16),
    color,
    team,
    bot,
    x: startX,
    y: 0,
    z: startZ,
    vx: 0,
    vy: 0,
    vz: 0,
    facing,
    grounded: true,
    jumping: false,
    specialState: 'none',
    stateTimer: 0,
    swingCooldown: 0,
    stunnedUntil: 0,
    slingshotUntil: 0,
    score: 0,
    hits: 0,
    smashes: 0,
    slingshots: 0,
    bonks: 0,
    input: idleInput(),
    seen: 0,
  };
}

export function freshBungeeWorld(now = Date.now()): BungeeWorld {
  return {
    clock: 0,
    phase: 'serving',
    started: now,
    endedAt: 0,
    scores: { red: 0, blue: 0 },
    serverTeam: 'red',
    servingPlayerId: null,
    rallyCount: 0,
    maxRally: 0,
    targetScore: TARGET_SCORE,
    players: [],
    ball: freshBall(),
    tethers: { red: null, blue: null },
    events: [],
    eventId: 0,
    winner: null,
    scoreBanner: null,
  };
}

export function prepareServe(world: BungeeWorld, team: TeamId) {
  world.phase = 'serving';
  world.serverTeam = team;
  world.rallyCount = 0;

  const server = world.players.find((p) => p.team === team) ?? world.players[0];
  world.servingPlayerId = server ? server.id : null;

  world.ball = {
    ...freshBall(),
    x: server ? server.x : team === 'red' ? 1.5 : -1.5,
    y: 1.1,
    z: server
      ? server.z + (team === 'red' ? 0.9 : -0.9)
      : team === 'red'
        ? -7.5
        : 7.5,
    state: 'serving',
    currentSide: team,
    lastHitTeam: team,
    lastHitBy: server ? server.id : null,
  };
}

/** The player a serve is waiting on, or undefined while the ball is live. */
export function awaitedServer(world: BungeeWorld): Player | undefined {
  if (world.phase !== 'serving' || world.ball.state !== 'serving') return;
  // Nobody is named before the first point: the serving team's first player
  // is the one who can serve, and bots only serve once named.
  return world.servingPlayerId
    ? world.players.find((p) => p.id === world.servingPlayerId)
    : world.players.find((p) => p.team === world.serverTeam);
}

/**
 * Serves for whoever a serve has waited on for `patienceMs`. Party rounds use
 * it because the human is red's named server, so an idle player would
 * otherwise hold the match at the serve forever. Call it once a frame: it
 * remembers when the current wait began.
 */
export function autoServe(patienceMs: number) {
  let waitingOn: string | undefined;
  let since = 0;
  return (world: BungeeWorld, now: number) => {
    const server = awaitedServer(world);
    if (server?.id !== waitingOn) {
      waitingOn = server?.id;
      since = now;
    } else if (server && now - since >= patienceMs)
      bungeeAction(world, server.id, { type: 'swing' }, now);
  };
}

export function scorePoint(
  world: BungeeWorld,
  winningTeam: TeamId,
  reason: string,
  now: number,
) {
  if (world.phase === 'ended') return;

  world.scores[winningTeam]++;
  world.phase = 'scored';
  world.scoreBanner = {
    team: winningTeam,
    text: `POINT ${winningTeam.toUpperCase()}!`,
    subtext: reason,
  };

  world.events.push({
    id: ++world.eventId,
    type: 'point_scored',
    text: `${winningTeam.toUpperCase()} +1! (${reason})`,
    team: winningTeam,
  });

  // Check win condition
  if (world.scores[winningTeam] >= world.targetScore) {
    world.phase = 'ended';
    world.winner = winningTeam;
    world.endedAt = now;

    world.events.push({
      id: ++world.eventId,
      type: 'game_won',
      text: `${winningTeam.toUpperCase()} WINS THE MATCH!`,
      team: winningTeam,
    });
  }
}

/** Handles player input actions like swings, jumps, dives */
export function bungeeAction(
  world: BungeeWorld,
  playerId: string,
  action: BungeeAction,
  now = Date.now(),
) {
  const p = world.players.find((pl) => pl.id === playerId);
  if (!p) return;

  if (action.type === 'restart') {
    world.scores = { red: 0, blue: 0 };
    world.winner = null;
    world.endedAt = 0;
    world.rallyCount = 0;
    prepareServe(world, 'red');
    return;
  }

  if (action.type === 'switchTeam') {
    p.team = p.team === 'red' ? 'blue' : 'red';
    return;
  }

  if (p.stunnedUntil > now) return;

  if (action.type === 'jump' && p.grounded) {
    p.vy = 6.8;
    p.grounded = false;
    p.jumping = true;

    // Check slingshot opportunity
    const tether = world.tethers[p.team];
    if (tether && tether.tension > 0.55) {
      p.slingshotUntil = now + 900;
      p.specialState = 'slingshot';
      p.slingshots++;
      const forwardDir = p.team === 'red' ? 1 : -1;
      p.vz += forwardDir * 8.5;

      world.events.push({
        id: ++world.eventId,
        type: 'slingshot',
        text: 'SLINGSHOT BOOST!',
        team: p.team,
        pos: [p.x, 1, p.z],
      });
    }
  }

  if (action.type === 'dive' && p.grounded && p.specialState !== 'diving') {
    p.specialState = 'diving';
    p.stateTimer = 0.5;
    const forwardDir = p.team === 'red' ? 1 : -1;
    p.vz += forwardDir * 10.0;

    world.events.push({
      id: ++world.eventId,
      type: 'dive',
      text: 'Dive Save!',
      team: p.team,
      pos: [p.x, 0.2, p.z],
    });
  }

  if (action.type === 'swing' || action.type === 'smash') {
    executeRacketHit(world, p, action.type === 'smash', now);
  }
}

function executeRacketHit(
  world: BungeeWorld,
  player: Player,
  isSmashIntent: boolean,
  now: number,
) {
  const ball = world.ball;
  const isServing = ball.state === 'serving';

  // If serving, only the designated server can hit
  if (isServing) {
    if (player.team !== world.serverTeam) return;

    ball.state = 'in_play';
    world.phase = 'rally';
    const shot = calculateRacketShot(
      player.x,
      ball.y,
      player.z,
      player.team,
      false,
      false,
      player.facing,
    );
    ball.vx = shot.vx;
    ball.vy = shot.vy;
    ball.vz = shot.vz;
    ball.lastHitBy = player.id;
    ball.lastHitTeam = player.team;
    ball.bouncesOnCurrentSide = 0;
    ball.currentSide = null;
    player.specialState = 'swinging';
    player.stateTimer = 0.35;
    player.hits++;

    world.events.push({
      id: ++world.eventId,
      type: 'racket_hit',
      text: 'Serve!',
      team: player.team,
      pos: [ball.x, ball.y, ball.z],
    });
    return;
  }

  // During rally, check distance to ball
  const dx = ball.x - player.x;
  const dz = ball.z - player.z;
  const dist = Math.hypot(dx, dz);

  const reach = player.specialState === 'diving' ? 2.6 : 2.0;
  const heightReach = player.jumping ? 3.4 : 2.4;

  if (dist <= reach && ball.y <= heightReach && ball.y >= 0.1) {
    const isSmash =
      isSmashIntent ||
      player.jumping ||
      player.slingshotUntil > now ||
      ball.y > 2.0;
    const isDive = player.specialState === 'diving';

    const shot = calculateRacketShot(
      player.x,
      ball.y,
      player.z,
      player.team,
      isSmash,
      isDive,
      player.facing,
    );

    ball.vx = shot.vx;
    ball.vy = shot.vy;
    ball.vz = shot.vz;
    ball.isSmash = isSmash;
    ball.speedTrail = isSmash;
    ball.lastHitBy = player.id;
    ball.lastHitTeam = player.team;
    ball.bouncesOnCurrentSide = 0;
    ball.currentSide = null;
    ball.wallHitsOnCurrentSide = 0;
    ball.hitCountOnSide++;

    player.specialState = isSmash ? 'smashing' : 'swinging';
    player.stateTimer = 0.35;
    player.hits++;
    if (isSmash) player.smashes++;

    world.rallyCount++;
    world.maxRally = Math.max(world.maxRally, world.rallyCount);

    world.events.push({
      id: ++world.eventId,
      type: isSmash ? 'smash_hit' : 'racket_hit',
      text: isSmash ? 'SMASH!' : `Rally ${world.rallyCount}!`,
      team: player.team,
      pos: [ball.x, ball.y, ball.z],
    });
  }
}

/**
 * Step the whole Bungee Doubles simulation forward by dt seconds (default 1/60).
 * The world clock counts milliseconds, as every game's does: the peer engine
 * reads it to decide when a silent player's controls are let go.
 */
export function advanceBungee(
  world: BungeeWorld,
  dt = 1 / 60,
  now = Date.now(),
) {
  world.clock += dt * 1000;

  // Handle post-score delay before next serve
  if (world.phase === 'scored') {
    if (!world.scoreBanner) {
      const nextServer = world.serverTeam === 'red' ? 'blue' : 'red';
      prepareServe(world, nextServer);
    }
  }

  const eventIdRef = { current: world.eventId };

  // Step players
  for (const p of world.players) {
    if (p.stunnedUntil > now) {
      p.specialState = 'stunned';
      p.vx *= 0.85;
      p.vz *= 0.85;
    } else {
      if (p.specialState === 'stunned') p.specialState = 'none';

      // Timers
      if (p.stateTimer > 0) {
        p.stateTimer -= dt;
        if (p.stateTimer <= 0 && p.specialState !== 'none') {
          p.specialState = 'none';
        }
      }

      // Input movement
      const speed = p.specialState === 'diving' ? 3.0 : 7.2;
      const targetVx = p.input.x * speed;
      const targetVz = p.input.z * speed;

      p.vx += (targetVx - p.vx) * 0.25;
      p.vz += (targetVz - p.vz) * 0.25;

      if (Math.hypot(p.input.x, p.input.z) > 0.1) {
        p.facing = Math.atan2(p.input.x, p.input.z);
      }
    }

    // Gravity for jumping
    if (!p.grounded) {
      p.vy += -18.0 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.grounded = true;
        p.jumping = false;
      }
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // Court boundary and Net restriction
    // Red stays on Z in [-10.8, -0.6], Blue stays on Z in [0.6, 10.8]
    const halfW = COURT.width / 2 + 0.8;
    p.x = Math.max(-halfW, Math.min(halfW, p.x));

    if (p.team === 'red') {
      p.z = Math.max(-COURT.length / 2 - 1.2, Math.min(-0.6, p.z));
    } else {
      p.z = Math.max(0.6, Math.min(COURT.length / 2 + 1.2, p.z));
    }
  }

  // Step Bungee Tethers for both teams
  for (const team of ['red', 'blue'] as const) {
    const teamPlayers = world.players.filter((p) => p.team === team);
    if (teamPlayers.length >= 2) {
      world.tethers[team] = stepBungeeTether(
        teamPlayers[0],
        teamPlayers[1],
        dt,
        now,
        world.events,
        eventIdRef,
      );
    } else {
      world.tethers[team] = null;
    }
  }

  // Step Ball
  if (world.ball.state === 'in_play') {
    const { bounced, hitWall, wallPos } = stepBallPhysics(
      world.ball,
      dt,
      world.events,
      eventIdRef,
    );

    // Current side tracking: Z < 0 is Red, Z > 0 is Blue
    const currentSide: TeamId = world.ball.z < 0 ? 'red' : 'blue';

    if (world.ball.currentSide !== currentSide) {
      world.ball.currentSide = currentSide;
      world.ball.bouncesOnCurrentSide = 0;
      world.ball.hitCountOnSide = 0;
      world.ball.wallHitsOnCurrentSide = 0;
    }

    if (hitWall) {
      if (world.ball.bouncesOnCurrentSide === 0) {
        // In padel, hitting the wall directly on the fly is OUT!
        const pointWinner: TeamId =
          world.ball.lastHitTeam === 'red' ? 'blue' : 'red';
        const wallName = hitWall === 'back' ? 'Glass Wall' : 'Side Mesh';
        scorePoint(world, pointWinner, `Out! Direct ${wallName} hit`, now);
      } else {
        // Legal wall rebound: ball bounced on the court floor first!
        world.ball.wallHitsOnCurrentSide++;
        world.events.push({
          id: ++eventIdRef.current,
          type: 'wall_rebound',
          text: hitWall === 'back' ? 'Glass Rebound!' : 'Side Mesh Rebound!',
          pos: wallPos ?? [world.ball.x, world.ball.y, world.ball.z],
        });
      }
    }

    if (bounced) {
      world.ball.bouncesOnCurrentSide++;
      const inCourt = isInsideCourt(world.ball.x, world.ball.z);

      if (world.ball.bouncesOnCurrentSide === 1) {
        if (!inCourt) {
          // Ball bounced outside court on first bounce: OUT!
          // Point goes to team that did NOT hit the ball
          const pointWinner: TeamId =
            world.ball.lastHitTeam === 'red' ? 'blue' : 'red';
          scorePoint(world, pointWinner, 'Out of Bounds!', now);
        }
      } else if (world.ball.bouncesOnCurrentSide >= 2) {
        // Double bounce! Point goes to the team that hit it across
        const pointWinner: TeamId = currentSide === 'red' ? 'blue' : 'red';
        scorePoint(world, pointWinner, 'Double Bounce!', now);
      }
    }
  } else if (world.ball.state === 'serving') {
    // Ball hovers in front of server
    const server = world.players.find((p) => p.id === world.servingPlayerId);
    if (server) {
      world.ball.x = server.x;
      world.ball.y = 1.1 + Math.sin((world.clock / 1000) * 4) * 0.08;
      world.ball.z = server.z + (server.team === 'red' ? 0.9 : -0.9);
    }
  }

  world.eventId = eventIdRef.current;
}

export function bungeeSnapshot(
  world: BungeeWorld,
  code: string,
  host: string,
  localId: string,
  version = 0,
): BungeeSnapshot {
  return {
    code,
    host,
    isHost: host === localId,
    world: {
      ...world,
      events: [...world.events],
    },
    localId,
    version,
  };
}
