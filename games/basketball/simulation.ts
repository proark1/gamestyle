import {
  BALL_RADIUS,
  HOOP,
  SHOT_CLOCK_SEC,
  TARGET_SCORE,
  idleInput,
  type Ball,
  type BasketballAction,
  type BasketballSnapshot,
  type BasketballWorld,
  type GameEvent,
  type Player,
  type TeamId,
} from './types';
import {
  calculateShotVelocity,
  distanceToHoop,
  stepBallPhysics,
  stepPlayerMovement,
} from './physics';

export function freshBall(): Ball {
  return {
    x: 0,
    y: 1.0,
    z: -1.0,
    vx: 0,
    vy: 0,
    vz: 0,
    heldBy: null,
    lastHeldBy: null,
    shotBy: null,
    shotTeam: null,
    isSuperShot: false,
    isDunk: false,
    isThreePointer: false,
    spin: 0,
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
  // Spawn positions on court for 2v2
  // Orange starts left, Teal starts right
  const side = team === 'orange' ? -1 : 1;
  const startX = side * (2.2 + slot * 1.8);
  const startZ = -1.0 + slot * 2.0;

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
    facing: Math.PI,
    grounded: true,
    jumping: false,
    hasBall: false,
    dribblePhase: 0,
    chargingShot: false,
    shotCharge: 0,
    shotReleased: false,
    superJump: false,
    combo: 0,
    score: 0,
    dunks: 0,
    steals: 0,
    stunnedUntil: 0,
    lastJump: 0,
    specialMove: 'none',
    moveTimer: 0,
    celebrateUntil: 0,
    hangUntil: 0,
    spinAngle: 0,
    input: idleInput(),
    seen: 0,
  };
}

export function freshBasketballWorld(now: number): BasketballWorld {
  return {
    clock: now,
    phase: 'lobby',
    started: 0,
    endedAt: 0,
    scores: { orange: 0, teal: 0 },
    possession: 'orange',
    needsClearance: false,
    shotClockRemaining: SHOT_CLOCK_SEC,
    targetScore: TARGET_SCORE,
    players: [],
    ball: freshBall(),
    events: [],
    eventId: 0,
    winner: null,
  };
}

function emitEvent(
  w: BasketballWorld,
  type: GameEvent['type'],
  text: string,
  team?: TeamId,
  pos?: [number, number, number],
) {
  w.events.push({
    id: ++w.eventId,
    type,
    text,
    team,
    pos,
  });
  if (w.events.length > 20) w.events.shift();
}

/** Check if player has enough combo / heat to trigger a Super Jump */
export function canSuperJump(player: Player): boolean {
  return player.combo >= 60;
}

/** Reset ball position after score or turnover */
export function resetPossession(
  w: BasketballWorld,
  team: TeamId,
  awardToTeammate = true,
) {
  w.possession = team;
  w.shotClockRemaining = SHOT_CLOCK_SEC;
  w.ball = freshBall();

  // Reset all players' ball status
  for (const p of w.players) {
    p.hasBall = false;
    p.chargingShot = false;
    p.shotCharge = 0;
  }

  // Find a player from the team to receive the ball at the top of the key
  const teamPlayers = w.players.filter((p) => p.team === team);
  if (teamPlayers.length > 0 && awardToTeammate) {
    const handler = teamPlayers[0];
    handler.x = 0;
    handler.z = 1.5;
    handler.y = 0;
    handler.vx = handler.vy = handler.vz = 0;
    handler.hasBall = true;
    w.ball.heldBy = handler.id;
    w.ball.x = handler.x;
    w.ball.y = 1.0;
    w.ball.z = handler.z;
  }
}

export function advanceBasketball(w: BasketballWorld, dt: number): void {
  w.clock += dt * 1000;

  if (w.phase !== 'playing') {
    // Simple ball bounce in lobby
    if (w.ball.heldBy === null) {
      const eventIdRef = { current: w.eventId };
      stepBallPhysics(w.ball, dt, eventIdRef);
      w.eventId = eventIdRef.current;
    }
    return;
  }

  // 1. Advance Shot Clock
  w.shotClockRemaining = Math.max(0, w.shotClockRemaining - dt);
  if (w.shotClockRemaining <= 0) {
    emitEvent(w, 'buzzer', 'Shot Clock Violation!', w.possession);
    // Turnover to other team
    const nextTeam: TeamId = w.possession === 'orange' ? 'teal' : 'orange';
    resetPossession(w, nextTeam);
    return;
  }

  // 2. Step all players
  for (const p of w.players) {
    // Check stun
    if (p.stunnedUntil > w.clock) {
      p.input.x = 0;
      p.input.z = 0;
    }

    // Shot charging logic
    if (p.hasBall) {
      if (p.input.shoot) {
        p.chargingShot = true;
        // Charge rate: takes about 0.65s to reach sweet spot (0.75)
        p.shotCharge = Math.min(1.0, p.shotCharge + dt * 1.5);
      } else if (p.chargingShot) {
        // Released shoot button -> perform jump shot or dunk!
        executeShot(w, p);
      }
    } else {
      p.chargingShot = false;
      p.shotCharge = 0;
    }

    stepPlayerMovement(p, dt, w.clock);
  }

  // 3. Position held ball or step loose/flying ball
  const ballHolder = w.ball.heldBy
    ? w.players.find((p) => p.id === w.ball.heldBy)
    : null;

  if (ballHolder) {
    // Ball is glued to holder
    if (ballHolder.chargingShot || ballHolder.jumping) {
      // Held high overhead
      w.ball.x = ballHolder.x;
      w.ball.y = ballHolder.y + 1.85;
      w.ball.z = ballHolder.z + Math.cos(ballHolder.facing) * 0.25;
    } else {
      // Dribbling ball to the side
      const dribbleY =
        BALL_RADIUS +
        Math.abs(Math.sin(ballHolder.dribblePhase)) * (0.9 - BALL_RADIUS);
      const sideX = Math.sin(ballHolder.facing + Math.PI / 2) * 0.45;
      const sideZ = Math.cos(ballHolder.facing + Math.PI / 2) * 0.45;

      w.ball.x = ballHolder.x + sideX;
      w.ball.y = dribbleY;
      w.ball.z = ballHolder.z + sideZ;

      // Emit subtle bounce when dribble reaches bottom
      if (dribbleY <= BALL_RADIUS + 0.05 && Math.random() < 0.15) {
        emitEvent(w, 'bounce', 'dribble', ballHolder.team, [
          w.ball.x,
          w.ball.y,
          w.ball.z,
        ]);
      }
    }
  } else {
    // Check Alley-Oop mid-air finish
    if (w.ball.isAlleyOop && w.ball.shotBy) {
      const recipient = w.players.find((p) => p.id === w.ball.shotBy);
      if (recipient) {
        const distHoop = Math.hypot(recipient.x - HOOP.x, recipient.z - HOOP.z);
        const distBall = Math.hypot(
          recipient.x - w.ball.x,
          recipient.z - w.ball.z,
        );
        if (distHoop < 2.2 && distBall < 2.0 && w.ball.y >= HOOP.y - 0.5) {
          // Mid-air catch and slam!
          w.ball.x = recipient.x;
          w.ball.y = HOOP.y + 0.25;
          w.ball.z = recipient.z;
          w.ball.vx = (HOOP.x - recipient.x) * 3.0;
          w.ball.vy = -6.5;
          w.ball.vz = (HOOP.z - recipient.z) * 3.0;
          w.ball.isDunk = true;
          recipient.specialMove = 'dunk';
          recipient.dunkType = 'powerhang';
        }
      }
    }

    // Ball is in air or loose on ground
    const eventIdRef = { current: w.eventId };
    const stepResult = stepBallPhysics(w.ball, dt, eventIdRef);
    w.eventId = eventIdRef.current;

    for (const ev of stepResult.events) {
      w.events.push(ev);
    }
    if (w.events.length > 20) w.events.shift();

    // Check if basket was scored
    if (stepResult.scored) {
      const scoringTeam = (stepResult.shooterTeam as TeamId) || w.possession;
      const shooter = w.players.find((p) => p.id === stepResult.shooterId);

      const points = stepResult.isThree ? 3 : 2;
      w.scores[scoringTeam] += points;

      if (shooter) {
        shooter.score += points;
        if (stepResult.isDunk) shooter.dunks++;
        // Boost combo
        shooter.combo = Math.min(
          100,
          shooter.combo + (stepResult.isSuper ? 45 : 25),
        );
        // Trigger celebratory pose
        shooter.celebrateUntil = w.clock + 1300;
        if (shooter.dunkType === 'powerhang') {
          shooter.hangUntil = w.clock + 450;
          emitEvent(w, 'rimhang', 'Rattle on the rim!', scoringTeam, [
            HOOP.x,
            HOOP.y,
            HOOP.z,
          ]);
        }
      }

      emitEvent(
        w,
        stepResult.isSuper ? 'superdunk' : stepResult.isDunk ? 'dunk' : 'swish',
        `${scoringTeam.toUpperCase()} SCORED ${points} PTS!`,
        scoringTeam,
        [HOOP.x, HOOP.y, HOOP.z],
      );

      // Grand celebration crowd roar
      if (stepResult.isDunk || stepResult.isSuper || stepResult.isThree) {
        emitEvent(w, 'cheer', 'CROWD ERUPTION!', scoringTeam, [
          HOOP.x,
          HOOP.y,
          HOOP.z,
        ]);
      }
      if (stepResult.isSuper) {
        emitEvent(w, 'fire', 'FIRE EXPLOSION!', scoringTeam, [
          HOOP.x,
          HOOP.y,
          HOOP.z,
        ]);
      }
      if (w.ball.isAlleyOop) {
        emitEvent(
          w,
          'alleyoop',
          `🚀 ALLEY-OOP SLAM BY ${shooter?.name ?? 'TEAMMATE'}!`,
          scoringTeam,
          [HOOP.x, HOOP.y, HOOP.z],
        );
        w.ball.isAlleyOop = false;
      }

      // Check win condition
      if (w.scores[scoringTeam] >= w.targetScore) {
        w.phase = 'ended';
        w.winner = scoringTeam;
        w.endedAt = w.clock;
        emitEvent(
          w,
          'buzzer',
          `${scoringTeam.toUpperCase()} WINS THE GAME!`,
          scoringTeam,
        );
        return;
      }

      // Turnover to other team after basket
      const nextTeam: TeamId = scoringTeam === 'orange' ? 'teal' : 'orange';
      resetPossession(w, nextTeam);
      return;
    }

    // Check loose ball pickup by any player
    for (const p of w.players) {
      if (p.stunnedUntil > w.clock) continue;
      const dist = Math.hypot(p.x - w.ball.x, p.z - w.ball.z);
      if (dist < 1.15 && Math.abs(p.y - w.ball.y) < 1.5) {
        // Pick up ball!
        p.hasBall = true;
        w.ball.heldBy = p.id;
        w.ball.lastHeldBy = p.id;
        w.ball.vx = 0;
        w.ball.vy = 0;
        w.ball.vz = 0;
        w.possession = p.team;
        w.shotClockRemaining = SHOT_CLOCK_SEC;
        emitEvent(w, 'pass', `${p.name} grabbed the ball!`, p.team);
        break;
      }
    }
  }
}

/** Execute jump shot or dunk */
function executeShot(w: BasketballWorld, p: Player): void {
  const charge = p.shotCharge;
  const isSuper = p.superJump || (canSuperJump(p) && charge > 0.6);
  const dist = distanceToHoop(p.x, p.z);

  p.chargingShot = false;
  p.shotCharge = 0;
  p.hasBall = false;
  w.ball.heldBy = null;
  w.ball.shotBy = p.id;
  w.ball.shotTeam = p.team;
  w.ball.isSuperShot = isSuper;

  // Jump into the air for shot
  if (p.grounded) {
    p.grounded = false;
    p.jumping = true;
    p.vy = isSuper ? 10.2 : 6.8;
  }

  // Check if close enough to hoop for a Slam Dunk! (dist < 3.2m)
  if (dist < 3.2 && (p.input.sprint || isSuper || p.vy > 4)) {
    // Dunk action!
    w.ball.isDunk = true;
    w.ball.isThreePointer = false;
    p.specialMove = 'dunk';
    if (isSuper) {
      p.dunkType = 'windmill360';
    } else if (p.input.sprint && p.combo >= 25) {
      p.dunkType = 'powerhang';
    } else {
      p.dunkType = 'tomahawk';
    }

    // Launch towards rim apex
    w.ball.x = p.x;
    w.ball.y = p.y + 1.8;
    w.ball.z = p.z;
    const dx = HOOP.x - p.x;
    const dz = HOOP.z - p.z;
    w.ball.vx = dx * 2.8;
    w.ball.vy = 3.5;
    w.ball.vz = dz * 2.8;

    const dunkLabel = isSuper
      ? 'SUPER DUNK!'
      : p.dunkType === 'powerhang'
        ? 'POWER SLAM!'
        : 'SLAM DUNK!';

    emitEvent(
      w,
      isSuper ? 'superdunk' : 'dunk',
      `${p.name} goes for a ${dunkLabel}`,
      p.team,
    );
    if (isSuper) p.combo = 0; // Consume super combo
    return;
  }

  // Regular Jump Shot
  w.ball.isDunk = false;
  const startX = p.x;
  const startY = p.y + 1.85;
  const startZ = p.z + Math.cos(p.facing) * 0.3;

  w.ball.x = startX;
  w.ball.y = startY;
  w.ball.z = startZ;

  const { vx, vy, vz, isThree } = calculateShotVelocity(
    startX,
    startY,
    startZ,
    charge,
    isSuper,
  );
  w.ball.vx = vx;
  w.ball.vy = vy;
  w.ball.vz = vz;
  w.ball.isThreePointer = isThree;

  emitEvent(
    w,
    'squeak',
    `${p.name} shoots from ${isThree ? '3-PT range!' : 'mid-range!'}`,
    p.team,
  );

  if (isSuper) p.combo = 0;
}

export function basketballAction(
  w: BasketballWorld,
  id: string,
  action: BasketballAction,
  _host: boolean,
): void {
  const p = w.players.find((pl) => pl.id === id);

  if (action.type === 'start') {
    if (w.phase === 'lobby') {
      w.phase = 'playing';
      w.started = w.clock;
      resetPossession(w, 'orange');
      emitEvent(w, 'whistle', 'Game Started! Tip off!');
    }
    return;
  }

  if (action.type === 'restart') {
    if (w.phase === 'ended' || w.phase === 'playing') {
      const players = w.players.map((pl, i) =>
        newPlayer(pl.id, pl.name, pl.color, pl.team, pl.bot, i % 2),
      );
      Object.assign(w, freshBasketballWorld(w.clock));
      w.players = players;
      w.phase = 'playing';
      w.started = w.clock;
      resetPossession(w, 'orange');
      emitEvent(w, 'whistle', 'Rematch started!');
    }
    return;
  }

  if (!p) return;

  if (action.type === 'switchTeam') {
    if (w.phase === 'lobby') {
      p.team = p.team === 'orange' ? 'teal' : 'orange';
    }
    return;
  }

  if (w.phase !== 'playing') return;

  // Crossover / Ankle Breaker move
  if (
    action.type === 'crossover' &&
    p.hasBall &&
    p.grounded &&
    p.moveTimer <= 0
  ) {
    p.specialMove = 'crossover';
    p.moveTimer = 0.35;
    p.combo = Math.min(100, p.combo + 15);

    // Lateral burst
    const cutSide = p.input.x < 0 ? -1 : 1;
    const sideAngle = p.facing + cutSide * (Math.PI / 2);
    p.vx += Math.sin(sideAngle) * 5.8;
    p.vz += Math.cos(sideAngle) * 5.8;

    // Check for defender ankle breaker within 2.2m
    const defenders = w.players.filter((other) => other.team !== p.team);
    const nearbyDefender = defenders.find((other) => {
      const dist = Math.hypot(other.x - p.x, other.z - p.z);
      return dist < 2.2;
    });

    if (nearbyDefender) {
      nearbyDefender.stunnedUntil = w.clock + 1100;
      nearbyDefender.specialMove = 'stumbled';
      nearbyDefender.vx *= 0.15;
      nearbyDefender.vz *= 0.15;
      p.combo = Math.min(100, p.combo + 25);
      emitEvent(
        w,
        'anklebreaker',
        `⚡ ${p.name} BROKE ${nearbyDefender.name}'S ANKLES!`,
        p.team,
        [nearbyDefender.x, nearbyDefender.y, nearbyDefender.z],
      );
      emitEvent(w, 'gasp', 'OHHHHHH!', p.team);
    } else {
      emitEvent(w, 'crossover', `${p.name} cuts with a crossover!`, p.team);
    }
    return;
  }

  // 360 Spin Move
  if (action.type === 'spin' && p.hasBall && p.grounded && p.moveTimer <= 0) {
    p.specialMove = 'spin';
    p.moveTimer = 0.4;
    p.spinAngle = 0;
    p.combo = Math.min(100, p.combo + 15);
    p.vx = Math.sin(p.facing) * 7.5;
    p.vz = Math.cos(p.facing) * 7.5;
    emitEvent(w, 'spin', `🌪️ ${p.name} hits a 360 spin move!`, p.team);
    return;
  }

  // Step-back Jumper
  if (
    action.type === 'stepback' &&
    p.hasBall &&
    p.grounded &&
    p.moveTimer <= 0
  ) {
    p.specialMove = 'stepback';
    p.moveTimer = 0.35;
    const dx = p.x - HOOP.x;
    const dz = p.z - HOOP.z;
    const dist = Math.max(0.1, Math.hypot(dx, dz));
    p.vx = (dx / dist) * 6.5;
    p.vz = (dz / dist) * 6.5;
    p.combo = Math.min(100, p.combo + 10);
    emitEvent(w, 'stepback', `🎯 ${p.name} steps back for separation!`, p.team);
    return;
  }

  // Pass or Alley-Oop Lob to teammate
  if ((action.type === 'pass' || action.type === 'alleyoop') && p.hasBall) {
    const teammates = w.players.filter(
      (mate) => mate.team === p.team && mate.id !== p.id,
    );
    if (teammates.length > 0) {
      // Check for Alley-Oop: Teammate cutting near hoop (< 4.8m)
      const cuttingMate = teammates.find(
        (mate) => distanceToHoop(mate.x, mate.z) < 4.8,
      );

      if (
        cuttingMate &&
        (action.type === 'alleyoop' || distanceToHoop(p.x, p.z) > 4.2)
      ) {
        // High Alley-Oop Lob Pass!
        p.hasBall = false;
        w.ball.heldBy = null;
        w.ball.lastHeldBy = p.id;
        w.ball.shotBy = cuttingMate.id;
        w.ball.shotTeam = p.team;
        w.ball.isAlleyOop = true;
        w.ball.isDunk = false;

        w.ball.x = p.x;
        w.ball.y = p.y + 1.8;
        w.ball.z = p.z;

        const targetX = HOOP.x;
        const targetZ = HOOP.z + 0.3;
        const dx = targetX - p.x;
        const dz = targetZ - p.z;
        const timeToHoop = 0.75;

        w.ball.vx = dx / timeToHoop;
        w.ball.vy = 7.2;
        w.ball.vz = dz / timeToHoop;

        cuttingMate.grounded = false;
        cuttingMate.jumping = true;
        cuttingMate.vy = 9.2;
        cuttingMate.specialMove = 'dunk';
        cuttingMate.dunkType = 'powerhang';

        p.combo = Math.min(100, p.combo + 25);
        emitEvent(
          w,
          'alleyoop',
          `🚀 ${p.name} LOBS AN ALLEY-OOP TO ${cuttingMate.name}!`,
          p.team,
        );
        return;
      }

      // Normal Pass
      const target = teammates[0];
      p.hasBall = false;
      w.ball.heldBy = null;
      w.ball.lastHeldBy = p.id;

      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      const passSpeed = 12.0;

      w.ball.vx = (dx / dist) * passSpeed;
      w.ball.vy = 2.2;
      w.ball.vz = (dz / dist) * passSpeed;

      p.combo = Math.min(100, p.combo + 15);
      emitEvent(w, 'pass', `${p.name} passes to ${target.name}!`, p.team);
    }
    return;
  }

  // Steal / Swipe (Cannot steal from a spinning player)
  if (action.type === 'steal' && !p.hasBall) {
    const ballHandler = w.players.find((other) => other.hasBall);
    if (ballHandler && ballHandler.team !== p.team) {
      if (ballHandler.specialMove === 'spin') {
        // Spin move evades the steal!
        emitEvent(
          w,
          'squeak',
          `${ballHandler.name} spun right past the steal!`,
          ballHandler.team,
        );
        return;
      }

      const dist = Math.hypot(p.x - ballHandler.x, p.z - ballHandler.z);
      if (dist < 1.75) {
        // Successful steal!
        ballHandler.hasBall = false;
        ballHandler.stunnedUntil = w.clock + 700;
        p.hasBall = true;
        p.steals++;
        p.combo = Math.min(100, p.combo + 25);
        w.ball.heldBy = p.id;
        w.possession = p.team;
        w.shotClockRemaining = SHOT_CLOCK_SEC;
        emitEvent(w, 'steal', `${p.name} STOLE THE BALL!`, p.team);
      }
    }
    return;
  }

  // Super Jump trigger
  if (action.type === 'superJump' && canSuperJump(p) && p.grounded) {
    p.superJump = true;
    p.grounded = false;
    p.jumping = true;
    p.vy = 10.5;
    emitEvent(w, 'superdunk', `${p.name} activates SUPER JUMP!`, p.team);
  }
}

export function basketballSnapshot(
  w: BasketballWorld,
  code: string,
  hostId: string,
  localId: string,
  version: number,
): BasketballSnapshot {
  return {
    code,
    host: hostId,
    isHost: hostId === localId,
    world: w,
    localId,
    version,
  };
}
